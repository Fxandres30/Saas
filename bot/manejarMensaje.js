import { extraerNumeros } from "./utils/extraerNumeros.js"
import { obtenerOcrearGrupo } from "./services/groupService.js"
import { procesarReservas } from "./services/reservaService.js"
import { armarRespuesta } from "./config/mensajes.js"
import { supabase } from "../supabase.js"

export async function manejarMensaje({ msg, sock, cliente_id }) {

  const jid = msg.key.remoteJid
  if (!jid || !jid.endsWith("@g.us")) return

  // ================= USUARIO =================

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", cliente_id)
    .single()

  if (!usuario) return

  // ================= GRUPO =================

  let nombre = "Grupo"
  try {
    const metadata = await sock.groupMetadata(jid)
    nombre = metadata.subject
  } catch {}

  const grupo = await obtenerOcrearGrupo(jid, nombre, cliente_id)

  if (!grupo.permitido) return
  if (Date.now() > grupo.expiracion) return

  // ================= TEXTO =================

  const texto =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text

  if (!texto) return

  const t = texto.trim().toLowerCase()

  if (t.includes("hola")) {
    await sock.sendMessage(jid, {
      text: "👋 Hola, el bot está activo 🔥"
    }, { quoted: msg })
    return
  }

  // ================= NUMEROS =================

  const numeros = extraerNumeros(t)
  if (numeros.length === 0) return

  const usuarioNumero = msg.key.participant || msg.key.remoteJid

  // ================= RESERVAS =================

  const resultado = await procesarReservas(
    grupo.id,
    numeros,
    usuarioNumero
  )

  // ================= MENSAJES =================

  const { data: mensajesDB } = await supabase
    .from("mensajes")
    .select("*")
    .eq("cliente_id", cliente_id)

  // 🔥 agrupar por tipo
  const mensajes = {}

  mensajesDB?.forEach(m => {
    if (!mensajes[m.tipo]) mensajes[m.tipo] = []
    mensajes[m.tipo].push(m.contenido)
  })

  // ================= RESPUESTA =================

  const respuesta = armarRespuesta(resultado, mensajes)

  if (respuesta) {
    await sock.sendMessage(jid, {
      text: respuesta
    }, { quoted: msg })
  }
}