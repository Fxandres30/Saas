import express from "express"

import authRoutes from "./routes/authRoutes.js"
import {
  iniciarCliente,
  estados,
  qrs,
  logs
} from "./bot/iniciarBot.js"

import { supabase } from "./supabase.js"

const app = express()
const PORT = process.env.PORT || 3000

// ================= MIDDLEWARES =================

app.use(express.static("public"))
app.use(express.json())

// ================= AUTH =================

app.use("/auth", authRoutes)

// ================= USUARIO =================

app.get("/usuario/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("id", req.params.id)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: "Usuario no existe" })
    }

    res.json(data)

  } catch (err) {
    res.status(500).json({ error: "Error servidor" })
  }
})

// ================= MENSAJES =================

app.post("/guardar-mensajes", async (req, res) => {
  try {
    const { cliente_id, mensajes } = req.body

    if (!cliente_id) {
      return res.json({ error: "cliente_id requerido" })
    }

    await supabase
      .from("mensajes")
      .delete()
      .eq("cliente_id", cliente_id)

    let inserts = []

    Object.entries(mensajes || {}).forEach(([tipo, lista]) => {
      if (!Array.isArray(lista)) return

      lista.forEach(texto => {
        inserts.push({
          cliente_id,
          tipo,
          contenido: texto,
          activo: true
        })
      })
    })

    if (inserts.length > 0) {
      const { error } = await supabase
        .from("mensajes")
        .insert(inserts)

      if (error) return res.json({ error: error.message })
    }

    res.json({ ok: true })

  } catch (err) {
    res.status(500).json({ error: "Error servidor" })
  }
})

app.get("/mensajes/:cliente_id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("mensajes")
      .select("*")
      .eq("cliente_id", req.params.cliente_id)
      .eq("activo", true)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    res.json(data || [])

  } catch (err) {
    res.status(500).json({ error: "Error servidor" })
  }
})

// ================= BOT =================

app.post("/iniciar", async (req, res) => {
  try {
    const { cliente_id } = req.body

    if (!cliente_id) {
      return res.status(400).json({ error: "cliente_id requerido" })
    }

    await iniciarCliente(cliente_id)

    res.json({ ok: true })

  } catch (err) {
    res.status(500).json({ error: "Error iniciando bot" })
  }
})

app.get("/estado/:id", (req, res) => {
  res.json({
    estado: estados[req.params.id] || "cargando",
    qr: qrs[req.params.id] || null,
    logs: logs[req.params.id] || []
  })
})

// ================= GRUPOS =================

app.get("/grupos/:cliente_id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("grupos")
      .select("id, nombre, permitido")
      .eq("cliente_id", req.params.cliente_id)

    if (error) return res.json({ error: error.message })

    res.json(data)

  } catch (err) {
    res.status(500).json({ error: "Error servidor" })
  }
})

app.get("/activar/:grupo_id", async (req, res) => {
  try {
    const { error } = await supabase
      .from("grupos")
      .update({
        permitido: true,
        expiracion: Date.now() + 30 * 24 * 60 * 60 * 1000
      })
      .eq("id", req.params.grupo_id)

    if (error) return res.send("Error")

    res.send("✅ Grupo activado")

  } catch (err) {
    res.status(500).send("Error servidor")
  }
})

// ================= TABLA =================

app.get("/tabla/:grupo_id", async (req, res) => {
  try {
    const { data: grupo } = await supabase
      .from("grupos")
      .select("*")
      .eq("id", req.params.grupo_id)
      .single()

    if (!grupo) {
      return res.json({ error: "Grupo no existe" })
    }

    const { data: reservas } = await supabase
      .from("reservas")
      .select("*")
      .eq("grupo_id", req.params.grupo_id)

    const mapa = {}

    reservas?.forEach(r => {
      mapa[r.numero] = r
    })

    const tabla = []

    for (let i = 0; i <= 99; i++) {
      const r = mapa[i]

      tabla.push({
        numero: i.toString().padStart(2, "0"),
        estado: r ? r.estado : "disponible",
        usuario: r ? r.usuario : null
      })
    }

    res.json({
      grupo: grupo.nombre,
      tabla
    })

  } catch (err) {
    res.status(500).json({ error: "Error servidor" })
  }
})

// ================= ACCIONES =================

app.post("/accion", async (req, res) => {
  try {
    const { grupo_id, numero, accion, usuario } = req.body

    if (!grupo_id || numero === undefined || !accion) {
      return res.json({ error: "Datos incompletos" })
    }

    const num = parseInt(numero)

    if (isNaN(num) || num < 0 || num > 99) {
      return res.json({ error: "Número inválido" })
    }

    const { data: existente } = await supabase
      .from("reservas")
      .select("*")
      .eq("grupo_id", grupo_id)
      .eq("numero", num)
      .maybeSingle()

    if (accion === "reservar") {
      if (existente) {
        return res.json({ error: "Número ocupado" })
      }

      await supabase.from("reservas").insert({
        grupo_id,
        numero: num,
        usuario: usuario || "manual",
        estado: "reservado",
        timestamp: Date.now()
      })
    }

    if (accion === "pagar") {
      await supabase
        .from("reservas")
        .update({ estado: "pagado" })
        .eq("grupo_id", grupo_id)
        .eq("numero", num)
    }

    if (accion === "liberar") {
      await supabase
        .from("reservas")
        .delete()
        .eq("grupo_id", grupo_id)
        .eq("numero", num)
    }

    res.json({ ok: true })

  } catch (err) {
    res.status(500).json({ error: "Error servidor" })
  }
})

// ================= START =================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor corriendo en ${PORT}`)
})