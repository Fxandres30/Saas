import express from "express"
import fs from "fs"

import authRoutes from "./routes/authRoutes.js"
import {
  iniciarCliente,
  estados,
  qrs,
  logs
} from "./bot/iniciarBot.js"

const app = express()
const PORT = process.env.PORT || 3000

// ================= MIDDLEWARES =================

app.use(express.static("public"))
app.use(express.json())

// ================= DB =================

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

// ================= AUTH =================

app.use("/auth", authRoutes)

// ================= MENSAJES =================

app.post("/guardar-mensajes", (req, res) => {
  const { cliente_id, mensajes } = req.body

  const db = loadDB()
  const usuario = db.usuarios[cliente_id]

  if (!usuario) {
    return res.json({ error: "Usuario no existe" })
  }

  usuario.mensajes = mensajes

  db.usuarios[cliente_id] = usuario
  saveDB(db)

  res.json({ ok: true })
})

// ================= BOT =================

app.post("/iniciar", async (req, res) => {
  const { cliente_id } = req.body

  if (!cliente_id) {
    return res.status(400).json({ error: "cliente_id requerido" })
  }

  await iniciarCliente(cliente_id)

  res.json({ ok: true })
})

app.get("/estado/:id", (req, res) => {
  res.json({
    estado: estados[req.params.id] || "cargando",
    qr: qrs[req.params.id] || null,
    logs: logs[req.params.id] || []
  })
})

// ================= GRUPOS =================

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

app.get("/activar/:grupo_id", (req, res) => {
  const db = loadDB()
  const grupo = db.grupos[req.params.grupo_id]

  if (!grupo) return res.send("No existe")

  grupo.permitido = true
  grupo.expiracion = Date.now() + 30 * 24 * 60 * 60 * 1000

  db.grupos[req.params.grupo_id] = grupo
  saveDB(db)

  res.send("✅ Grupo activado")
})

// ================= TABLA =================

app.get("/tabla/:grupo_id", (req, res) => {
  const db = loadDB()
  const grupo = db.grupos[req.params.grupo_id]

  if (!grupo) {
    return res.json({ error: "Grupo no existe" })
  }

  const reservas = grupo.reservas || {}
  const tabla = []

  for (let i = 0; i <= 99; i++) {
    const r = reservas[i]

    tabla.push({
      numero: i.toString().padStart(2, "0"),
      estado: r ? r.estado : "disponible",
      usuario: r ? r.usuario : null
    })
  }

  res.json({
    grupo: grupo.nombre,
    tabla
  })
})

// ================= ACCIONES =================

app.post("/accion", (req, res) => {
  const { grupo_id, numero, accion, usuario } = req.body

  if (!grupo_id || numero === undefined || !accion) {
    return res.json({ error: "Datos incompletos" })
  }

  const db = loadDB()
  const grupo = db.grupos[grupo_id]

  if (!grupo) {
    return res.json({ error: "Grupo no existe" })
  }

  grupo.reservas = grupo.reservas || {}

  const num = parseInt(numero)

  if (isNaN(num) || num < 0 || num > 99) {
    return res.json({ error: "Número inválido" })
  }

  if (accion === "reservar") {
    grupo.reservas[num] = {
      numero: num,
      usuario: usuario || "manual",
      estado: "reservado",
      timestamp: Date.now()
    }
  }

  if (accion === "pagar") {
    if (grupo.reservas[num]) {
      grupo.reservas[num].estado = "pagado"
    }
  }

  if (accion === "liberar") {
    delete grupo.reservas[num]
  }

  db.grupos[grupo_id] = grupo
  saveDB(db)

  res.json({ ok: true })
})

// ================= START =================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor corriendo en ${PORT}`)
})