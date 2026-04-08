import { obtenerUsuario } from "../services/userService.js"

export async function manejarMensaje({ msg, sock, cliente_id, loadDB, saveDB }) {
  const jid = msg.key.remoteJid

  if (!jid || !jid.endsWith("@g.us")) return

  const db = loadDB()
  let grupo = db.grupos[jid]

  let nombre = "Grupo"

  try {
    const metadata = await sock.groupMetadata(jid)
    nombre = metadata.subject
  } catch {}

  // ================= CREAR GRUPO =================
  if (!grupo) {
    grupo = {
      id: jid,
      nombre,
      cliente_id,
      permitido: true,
      expiracion: Date.now() + 7 * 24 * 60 * 60 * 1000
    }

    db.grupos[jid] = grupo
    saveDB(db)
  }

  // 🔥 ACTUALIZAR NOMBRE
  if (grupo.nombre !== nombre) {
    grupo.nombre = nombre
    db.grupos[jid] = grupo
    saveDB(db)
  }

  // ================= USUARIO CONFIG =================

  const usuario = db.usuarios[cliente_id]
  const mensajesUsuario = usuario?.mensajes || {}

  // ================= VALIDACIONES =================

  if (!grupo.permitido) return
  if (Date.now() > grupo.expiracion) return

  const texto =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text

  if (!texto) return

  const t = texto.trim().toLowerCase()

  // ================= RESPUESTA =================

  if (t.includes("hola")) {
    await sock.sendMessage(jid, {
      text: "👋 Hola, el bot está activo 🔥"
    })
    return
  }

  // ================= CONFIG GRUPO =================

  if (!grupo.config) {
    grupo.config = {
      mensajes: {
        reservado: "✅ Número {numero} reservado",
        ocupado: "❌ Número {numero} ya está ocupado",
        invalido: "⚠️ Número inválido"
      }
    }

    db.grupos[jid] = grupo
    saveDB(db)
  }

  const mensajesGrupo = grupo.config.mensajes

  // ================= RESERVAS =================

  const numero = parseInt(t)

  if (!isNaN(numero)) {

    if (numero < 0 || numero > 99) {
      await sock.sendMessage(jid, {
        text: mensajesUsuario.invalido || mensajesGrupo.invalido
      })
      return
    }

    grupo.reservas = grupo.reservas || {}

    const usuarioNumero = msg.key.participant || msg.key.remoteJid

    if (grupo.reservas[numero]) {
      await sock.sendMessage(jid, {
        text: (mensajesUsuario.ocupado || mensajesGrupo.ocupado)
          .replace("{numero}", numero)
      })
      return
    }

    // ✅ GUARDAR
    grupo.reservas[numero] = {
      numero,
      usuario: usuarioNumero,
      estado: "reservado",
      timestamp: Date.now()
    }

    db.grupos[jid] = grupo
    saveDB(db)

    // ✅ MENSAJE RESERVA (PRIORIDAD USUARIO)
    const msgReservado =
      mensajesUsuario.reservado || mensajesGrupo.reservado

    await sock.sendMessage(jid, {
      text: msgReservado.replace("{numero}", numero)
    })

    return
  }
}