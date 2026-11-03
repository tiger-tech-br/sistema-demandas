const express = require("express");
const { exigirAutenticacao } = require("../middleware/autenticacao");
const privacidade = require("../services/privacidadeService");

const router = express.Router();
router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});
router.get("/politica", (req, res) => res.json(privacidade.obterPolitica()));

// O exercicio dos direitos independe de assinatura, aceite atualizado ou bloqueio profissional.
router.use(exigirAutenticacao);
const tratar = operacao => async (req, res, next) => {
    try { await operacao(req, res); }
    catch (erro) {
        if ([400, 403, 404, 409].includes(erro.status)) {
            return res.status(erro.status).json({ codigo: erro.codigo, mensagem: erro.message });
        }
        return next(erro);
    }
};
router.post("/aceite", tratar(async (req, res) => res.json(await privacidade.aceitarTermos(req.usuario.id, req.body?.versao))));
router.get("/dados", tratar(async (req, res) => res.json(await privacidade.exportarDados(req.usuario.id))));
router.delete("/conta", tratar(async (req, res) => res.json(await privacidade.excluirConta(req.usuario.id, req.body?.confirmar))));
router.get("/solicitacoes", tratar(async (req, res) => res.json(await privacidade.listarSolicitacoes(req.usuario.id))));
router.post("/solicitacoes", tratar(async (req, res) => res.status(201).json(await privacidade.criarSolicitacao(req.usuario.id, req.body))));
router.use((req, res) => res.status(404).json({ mensagem: "Recurso de privacidade não encontrado." }));

module.exports = router;
