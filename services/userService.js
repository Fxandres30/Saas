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

// ✅ Crear usuario
export function crearUsuario(cliente_id) {
  const db = loadDB()

  if (db.usuarios[cliente_id]) return db.usuarios[cliente_id]

  db.usuarios[cliente_id] = {
    id: cliente_id,
    trial: true,
    fecha_creacion: Date.now(),
    mensajes: {
      disponible: "✅ TUS NÚMEROS HAN SIDO RESERVADOS",
      no_disponible: "❌ NO DISPONIBLES",
      combinado: "⚠️ ALGUNOS DISPONIBLES"
    }
  }

  saveDB(db)
  return db.usuarios[cliente_id]
}

// ✅ Obtener usuario
export function obtenerUsuario(cliente_id) {
  const db = loadDB()
  return db.usuarios[cliente_id]
}

// ✅ Actualizar mensajes globales
export function actualizarMensajes(cliente_id, mensajes) {
  const db = loadDB()

  if (!db.usuarios[cliente_id]) return false

  db.usuarios[cliente_id].mensajes = mensajes

  saveDB(db)
  return true
}