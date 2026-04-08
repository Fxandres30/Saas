import fs from "fs"

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

// ✅ REGISTRO
export function registrar(email, password) {
  const db = loadDB()

  const existe = Object.values(db.usuarios).find(u => u.email === email)
  if (existe) return { error: "Usuario ya existe" }

  const id = "cliente_" + Date.now()

  db.usuarios[id] = {
    id,
    email,
    password,
    mensajes: {
      disponible: "✅ Disponible"
    }
  }

  saveDB(db)

  return { id }
}

// ✅ LOGIN
export function login(email, password) {
  const db = loadDB()

  const usuario = Object.values(db.usuarios).find(
    u => u.email === email && u.password === password
  )

  if (!usuario) return null

  return usuario
}