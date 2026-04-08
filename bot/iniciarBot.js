import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys"
import QRCode from "qrcode"
import P from "pino"
import fs from "fs"

import { obtenerUsuario } from "../services/userService.js"
import { manejarMensaje } from "./mensajes.js"

// ================= VARIABLES COMPARTIDAS =================

export const clientes = {}
export const qrs = {}
export const estados = {}
export const logs = {}

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

// ================= BOT =================

export async function iniciarCliente(cliente_id) {
  try {
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

    sock.ev.on("connection.update", async (update) => {
      const { connection, qr, lastDisconnect } = update

      if (qr) {
        qrs[cliente_id] = await QRCode.toDataURL(qr)
        estados[cliente_id] = "esperando_qr"
      }

      if (connection === "open") {
        estados[cliente_id] = "conectado"
        qrs[cliente_id] = null
      }

      if (connection === "close") {
        estados[cliente_id] = "desconectado"

        const code = lastDisconnect?.error?.output?.statusCode

        if (code !== DisconnectReason.loggedOut) {
          setTimeout(() => iniciarCliente(cliente_id), 5000)
        } else {
          delete clientes[cliente_id]
        }
      }
    })

    sock.ev.on("groups.update", async (updates) => {
  const db = loadDB()

  for (const update of updates) {
    const grupo = db.grupos[update.id]

    if (grupo && update.subject) {
      grupo.nombre = update.subject
      db.grupos[update.id] = grupo
      saveDB(db)

      logs[cliente_id].push("🔄 Nombre actualizado: " + update.subject)
    }
  }
})

    // 🔥 AQUÍ LLAMAMOS LA LÓGICA EXTERNA
    sock.ev.on("messages.upsert", async ({ messages }) => {
      try {
        const msg = messages[0]
        if (!msg || !msg.message || msg.key.fromMe) return

        await manejarMensaje({ msg, sock, cliente_id, loadDB, saveDB })

      } catch (err) {
        console.error("❌ ERROR BOT:", err)
      }
    })

  } catch (error) {
    console.error("❌ Error iniciarCliente:", error)
  }
}