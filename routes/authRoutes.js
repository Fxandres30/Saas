import express from "express"
import { registrar, login } from "../bot/services/authService.js"

const router = express.Router()

// 🆕 REGISTRO
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body

    const result = await registrar(email, password)

    if (result.error) {
      return res.status(400).json(result)
    }

    res.json(result)

  } catch (err) {
    res.status(500).json({ error: "Error interno" })
  }
})

// 🔑 LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body

    const usuario = await login(email, password)

    if (!usuario) {
      return res.status(401).json({ error: "Credenciales incorrectas" })
    }

    res.json(usuario)

  } catch (err) {
    res.status(500).json({ error: "Error interno" })
  }
})

export default router