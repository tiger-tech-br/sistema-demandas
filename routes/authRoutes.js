const express = require("express");
const authController = require("../controllers/authController");
const { exigirAutenticacao } = require("../middleware/autenticacao");
const limitarAutenticacao = require("../middleware/limitarAutenticacao");

const router = express.Router();
router.post("/cadastro", limitarAutenticacao("cadastro"), authController.cadastrar);
router.post("/login", limitarAutenticacao("login"), authController.login);
router.get("/me", exigirAutenticacao, authController.minhaConta);
router.post("/logout", exigirAutenticacao, authController.logout);
router.use((req, res) => res.status(404).json({ mensagem: "Rota de conta nao encontrada." }));

module.exports = router;
