const express = require("express");
const { exigirAutenticacao, exigirProfissional } = require("../middleware/autenticacao");
const { obterStatusCobranca } = require("../services/pagbankService");
const cobranca = require("../services/cobrancaService");

const router = express.Router();

router.use(exigirAutenticacao);
router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});

const tratar = operacao => async (req, res, next) => {
    try { await operacao(req, res); }
    catch (erro) {
        if ([400, 403, 404, 409, 503].includes(erro.status)) return res.status(erro.status).json({ codigo: erro.codigo, mensagem: erro.message });
        return next(erro);
    }
};

// Encerrar a recorrencia permanece disponivel mesmo com acesso profissional bloqueado.
router.post("/cancelamento", (req, res, next) => {
    if (req.usuario.papel !== "profissional") {
        return res.status(403).json({ codigo: "PERFIL_NAO_PERMITIDO", mensagem: "Use o painel de administracao para gerenciar o sistema." });
    }
    return next();
}, tratar(async (req, res) => res.json(await cobranca.solicitarCancelamento(req.usuario.id))));

router.use(exigirProfissional);
router.get("/status", (req, res) => {
    res.json(obterStatusCobranca(req.assinatura));
});
router.post("/boas-vindas", tratar(async (req, res) => res.json(await cobranca.registrarBoasVindas(req.usuario.id, req.body?.escolha))));

router.post("/checkout", tratar(async (req, res) => res.json(await cobranca.iniciarCheckout(req.usuario.id, req.body?.plano))));

module.exports = router;
