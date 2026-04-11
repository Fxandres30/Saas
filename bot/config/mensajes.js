export function armarRespuesta(
  { reservados, ocupados, invalidos },
  mensajes = {}
) {

  function random(arr, fallback) {
    if (!arr || arr.length === 0) return fallback
    return arr[Math.floor(Math.random() * arr.length)]
  }

  let respuesta = ""

  const reservadoMsg = random(
    mensajes.reservado,
    "✅ Reservados: {numeros}"
  )

  const ocupadoMsg = random(
    mensajes.ocupado,
    "❌ Ocupados: {numeros}"
  )

  const invalidoMsg = random(
    mensajes.invalido,
    "⚠️ Inválidos: {numeros}"
  )

  if (reservados.length > 0) {
    respuesta += reservadoMsg.replace("{numeros}", reservados.join(", ")) + "\n"
  }

  if (ocupados.length > 0) {
    respuesta += ocupadoMsg.replace("{numeros}", ocupados.join(", ")) + "\n"
  }

  if (invalidos.length > 0) {
    respuesta += invalidoMsg.replace("{numeros}", invalidos.join(", ")) + "\n"
  }

  return respuesta.trim()
}