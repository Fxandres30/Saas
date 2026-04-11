export function extraerNumeros(texto) {

  texto = texto
    .toLowerCase()
    .replace(/[o]/g, "0")
    .replace(/[_\-.,;/|\\()]+/g, " ")

  let partes = texto.split(/\s+/).filter(Boolean)
  const hayMultiples = partes.length > 1

  let numeros = []

  for (let p of partes) {

    if (!/^\d+$/.test(p)) continue

    if (p.length === 1) {
      if (hayMultiples) {
        p = "0" + p
      } else {
        continue
      }
    }

    if (p.length === 2) {
      numeros.push(p)
    }
  }

  return numeros
}