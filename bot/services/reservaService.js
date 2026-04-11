import { supabase } from "../../supabase.js"

export async function procesarReservas(grupo_id, numeros, usuarioNumero) {

  const reservados = []
  const ocupados = []
  const invalidos = []

  for (const n of numeros) {

    const numero = parseInt(n)

    // ❌ inválido
    if (isNaN(numero) || numero < 0 || numero > 99) {
      invalidos.push(n)
      continue
    }

    // 🔍 verificar si ya existe
    const { data: existente } = await supabase
      .from("reservas")
      .select("id")
      .eq("grupo_id", grupo_id)
      .eq("numero", numero)
      .single()

    if (existente) {
      ocupados.push(n)
      continue
    }

    // ✅ insertar reserva
    const { error } = await supabase
      .from("reservas")
      .insert({
        grupo_id,
        numero,
        usuario: usuarioNumero,
        estado: "reservado",
        timestamp: Date.now()
      })

    if (error) {
      ocupados.push(n)
      continue
    }

    reservados.push(n)
  }

  return { reservados, ocupados, invalidos }
}