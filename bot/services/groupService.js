import { supabase } from "../../supabase.js"

export async function obtenerOcrearGrupo(jid, nombre, cliente_id) {

  // 🔍 buscar grupo
  let { data: grupo } = await supabase
    .from("grupos")
    .select("*")
    .eq("id", jid)
    .single()

  // 🆕 si no existe → crear
  if (!grupo) {
    const nuevo = {
      id: jid,
      nombre,
      cliente_id,
      permitido: true,
      expiracion: Date.now() + 7 * 24 * 60 * 60 * 1000
    }

    const { data } = await supabase
      .from("grupos")
      .insert(nuevo)
      .select()
      .single()

    return data
  }

  // 🔄 si cambió el nombre → actualizar
  if (grupo.nombre !== nombre) {
    await supabase
      .from("grupos")
      .update({ nombre })
      .eq("id", jid)

    grupo.nombre = nombre
  }

  return grupo
}