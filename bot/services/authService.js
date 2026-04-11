import { supabase } from "../../supabase.js"

// ================= REGISTRO =================

export async function registrar(email, password) {
  // 🔍 verificar si ya existe
  const { data: existe } = await supabase
    .from("usuarios")
    .select("id")
    .eq("email", email)
    .single()

  if (existe) {
    return { error: "Usuario ya existe" }
  }

  const id = "cliente_" + Date.now()

  const { error } = await supabase
    .from("usuarios")
    .insert({
      id,
      email,
      password // ⚠️ luego metemos bcrypt
    })

  if (error) {
    return { error: error.message }
  }

  return { id }
}

// ================= LOGIN =================

export async function login(email, password) {
  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("email", email)
    .eq("password", password)
    .single()

  if (error || !data) return null

  return data
}