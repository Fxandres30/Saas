import express from "express"
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys"
import QRCode from "qrcode"
import P from "pino"
import fs from "fs"

import { crearUsuario, obtenerUsuario } from "./services/userService.js"

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.static("public"))
app.use(express.json())

const clientes = {}
const qrs = {}
const estados = {}
const logs = {}

const DB_PATH = "./db.json"

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ usuarios: {}, grupos: {} }))
  }
  return JSON.parse(fs.readFileSync(DB_PATH))
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
}

// ================= SOCKET =================

async function iniciarCliente(cliente_id) {
  const path = `./sessions/${cliente_id}`

  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true })
  }

  const { state, saveCreds } = await useMultiFileAuthState(path)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: "silent" })
  })

  clientes[cliente_id] = sock
  estados[cliente_id] = "iniciando"
  logs[cliente_id] = []

  sock.ev.on("creds.update", saveCreds)

  // 🔥 CONEXIÓN
  sock.ev.on("connection.update", async (update) => {
    const { connection, qr, lastDisconnect } = update

    if (qr) {
      qrs[cliente_id] = await QRCode.toDataURL(qr)
      estados[cliente_id] = "esperando_qr"
      logs[cliente_id].push("📲 QR generado")
    }

    if (connection === "open") {
      estados[cliente_id] = "conectado"
      qrs[cliente_id] = null
      logs[cliente_id].push("✅ Conectado")
    }

    if (connection === "close") {
      estados[cliente_id] = "desconectado"
      logs[cliente_id].push("❌ Desconectado")

      const code = lastDisconnect?.error?.output?.statusCode

      if (code !== DisconnectReason.loggedOut) {
        setTimeout(() => iniciarCliente(cliente_id), 5000)
      } else {
        delete clientes[cliente_id]
      }
    }
  })

  // ================= MENSAJES =================

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message) return

    const jid = msg.key.remoteJid

    // ✅ SOLO GRUPOS
    if (!jid || !jid.endsWith("@g.us")) return

    logs[cliente_id].push(`📩 Grupo: ${jid}`)

    const db = loadDB()
    let grupo = db.grupos[jid]

// 🔥 SIEMPRE obtener nombre actualizado
let nombre = "Grupo"

try {
  const metadata = await sock.groupMetadata(jid)
  nombre = metadata.subject
} catch (err) {
  logs[cliente_id].push("⚠️ Error obteniendo nombre")
}

// 🆕 CREAR SI NO EXISTE
if (!grupo) {
  grupo = {
    id: jid,
    nombre: nombre,
    cliente_id,
    permitido: false,
    expiracion: Date.now() + 7 * 24 * 60 * 60 * 1000
  }

  db.grupos[jid] = grupo
  saveDB(db)

  logs[cliente_id].push("🆕 Grupo detectado")
}

// 🔥 ACTUALIZAR SI NO TIENE NOMBRE O CAMBIÓ
if (!grupo.nombre || grupo.nombre !== nombre) {
  grupo.nombre = nombre
  saveDB(db)
}

    // 🔒 VALIDAR PERMISO
    if (!grupo.permitido) {
      logs[cliente_id].push("🔒 Grupo bloqueado")
      return
    }

    // ⏰ VALIDAR EXPIRACIÓN
    if (Date.now() > grupo.expiracion) return

    const usuario = obtenerUsuario(cliente_id)
    if (!usuario) return

    const texto =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text

    if (!texto) return

    // 🔥 AQUÍ IRÁ TU LÓGICA (RESERVAS)
    if (texto === "test") {
      await sock.sendMessage(jid, {
        text: usuario.mensajes.disponible
      })
    }
  })
}

// ================= RUTAS =================

// Crear cliente
app.get("/crear", async (req, res) => {
  const cliente_id = "cliente_" + Date.now()

  crearUsuario(cliente_id)

  await iniciarCliente(cliente_id)

  res.json({ cliente_id })
})

// Estado
app.get("/estado/:id", (req, res) => {
  res.json({
    estado: estados[req.params.id] || "cargando",
    qr: qrs[req.params.id] || null,
    logs: logs[req.params.id] || []
  })
})

// Grupos
app.get("/grupos/:cliente_id", (req, res) => {
  const db = loadDB()

  const grupos = Object.values(db.grupos)
    .filter(g => g.cliente_id === req.params.cliente_id)
    .map(g => ({
      id: g.id,
      nombre: g.nombre,
      permitido: g.permitido
    }))

  res.json(grupos)
})

// Activar grupo (simulación pago 💰)
app.get("/activar/:grupo_id", (req, res) => {
  const db = loadDB()

  const grupo = db.grupos[req.params.grupo_id]

  if (!grupo) return res.send("No existe")

  grupo.permitido = true
  grupo.expiracion = Date.now() + 30 * 24 * 60 * 60 * 1000

  saveDB(db)

  res.send("✅ Grupo activado")
})

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`)
})