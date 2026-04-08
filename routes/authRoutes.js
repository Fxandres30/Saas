import express from "express"
import { registrar, login } from "../services/authService.js"

const router = express.Router()

// 🆕 REGISTRO
router.post("/register", (req, res) => {
  const { email, password } = req.body

  const result = registrar(email, password)

  if (result.error) {
    return res.status(400).json(result)
  }

  res.json(result)
})

// 🔑 LOGIN
router.post("/login", (req, res) => {
  const { email, password } = req.body

  const usuario = login(email, password)

  if (!usuario) {
    return res.status(401).json({ error: "Credenciales incorrectas" })
  }

  res.json(usuario)
})

export default router
