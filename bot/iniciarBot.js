import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys"
import QRCode from "qrcode"
import P from "pino"
import fs from "fs"

import { manejarMensaje } from "./manejarMensaje.js"

// ================= VARIABLES =================

export const clientes = {}
export const qrs = {}
export const estados = {}
export const logs = {}

const reintentos = {}
const reseteando = {}
const conectando = {} // 🔥 clave

// ================= RESET =================

function resetCliente(cliente_id) {
  if (reseteando[cliente_id]) return
  reseteando[cliente_id] = true

  try {
    const path = `./sessions/${cliente_id}`

    console.log("🔥 Reseteando sesión:", cliente_id)

    if (clientes[cliente_id]) {
      try { clientes[cliente_id].end?.() } catch {}
    }

    if (fs.existsSync(path)) {
      fs.rmSync(path, { recursive: true, force: true })
    }

    delete clientes[cliente_id]
    estados[cliente_id] = "reiniciando"
    qrs[cliente_id] = null
    reintentos[cliente_id] = 0

    setTimeout(() => {
      reseteando[cliente_id] = false
      iniciarCliente(cliente_id)
    }, 3000)

  } catch (err) {
    console.error("❌ Error reset:", err)
    reseteando[cliente_id] = false
  }
}

// ================= BOT =================

export async function iniciarCliente(cliente_id) {
  try {

    // 🔥 evitar múltiples conexiones
    if (conectando[cliente_id]) return
    conectando[cliente_id] = true

    if (clientes[cliente_id]) {
      console.log("⚠️ Ya existe cliente:", cliente_id)
      conectando[cliente_id] = false
      return
    }

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

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async (update) => {
      const { connection, qr, lastDisconnect } = update

      if (qr) {
        qrs[cliente_id] = await QRCode.toDataURL(qr)
        estados[cliente_id] = "esperando_qr"
        console.log("📲 QR generado:", cliente_id)
      }

      if (connection === "open") {
        estados[cliente_id] = "conectado"
        qrs[cliente_id] = null
        reintentos[cliente_id] = 0
        conectando[cliente_id] = false

        console.log("✅ Conectado:", cliente_id)
      }

      if (connection === "close") {
        const code = lastDisconnect?.error?.output?.statusCode

        console.log("❌ Desconectado:", cliente_id, "Code:", code)

        estados[cliente_id] = "desconectado"

        // 🔥 NO reiniciar si hay QR (usuario debe escanear)
        if (qrs[cliente_id]) {
          console.log("⏳ Esperando QR, no reiniciar")
          conectando[cliente_id] = false
          return
        }

        // 🔥 logout real
        if (
          code === DisconnectReason.loggedOut ||
          code === 401 ||
          code === 403
        ) {
          console.log("🚨 Sesión inválida → reset")
          conectando[cliente_id] = false
          resetCliente(cliente_id)
          return
        }

        reintentos[cliente_id] = (reintentos[cliente_id] || 0) + 1

        if (reintentos[cliente_id] > 5) {
          console.log("🛑 Demasiados intentos → reset")
          conectando[cliente_id] = false
          resetCliente(cliente_id)
          return
        }

        console.log("🔄 Reintentando...", reintentos[cliente_id])

        delete clientes[cliente_id]

        setTimeout(() => {
          conectando[cliente_id] = false
          iniciarCliente(cliente_id)
        }, 5000)
      }
    })

    sock.ev.on("messages.upsert", async ({ messages }) => {
      try {
        const msg = messages[0]
        if (!msg || !msg.message || msg.key.fromMe) return

        await manejarMensaje({
          msg,
          sock,
          cliente_id
        })

      } catch (err) {
        console.error("❌ ERROR BOT:", err)
      }
    })

  } catch (error) {
    console.error("❌ Error iniciarCliente:", error)
    conectando[cliente_id] = false
  }
}