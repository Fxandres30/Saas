import { supabase } from "../../supabase.js"

// ================= CREAR USUARIO =================

export async function crearUsuario(cliente_id) {

  // 🔍 verificar si ya existe
  const { data: existe } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", cliente_id)
    .single()

  if (existe) return existe

  const nuevo = {
    id: cliente_id,
    trial: true,
    fecha_creacion: Date.now()
  }

  const { data, error } = await supabase
    .from("usuarios")
    .insert(nuevo)
    .select()
    .single()

  if (error) {
    console.error("Error creando usuario:", error)
    return null
  }

  // 🔥 mensajes por defecto
  await supabase.from("mensajes").insert([
    {
      cliente_id,
      tipo: "reservado",
      contenido: "✅ TUS NÚMEROS HAN SIDO RESERVADOS"
    },
    {
      cliente_id,
      tipo: "ocupado",
      contenido: "❌ NO DISPONIBLES"
    },
    {
      cliente_id,
      tipo: "invalido",
      contenido: "⚠️ ALGUNOS DISPONIBLES"
    }
  ])

  return data
}

// ================= OBTENER USUARIO =================

export async function obtenerUsuario(cliente_id) {
  const { data } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", cliente_id)
    .single()

  return data
}

// ================= ACTUALIZAR MENSAJES =================

export async function actualizarMensajes(cliente_id, mensajes) {

  // 🧹 borrar anteriores
  await supabase
    .from("mensajes")
    .delete()
    .eq("cliente_id", cliente_id)

  // 🔄 insertar nuevos
  const inserts = Object.entries(mensajes).map(([tipo, contenido]) => ({
    cliente_id,
    tipo,
    contenido
  }))

  const { error } = await supabase
    .from("mensajes")
    .insert(inserts)

  if (error) {
    console.error("Error actualizando mensajes:", error)
    return false
  }

  return true
}