const express = require("express");
const { exigirAutenticacao, exigirProfissional } = require("../middleware/autenticacao");
const {
    obterLinkDoPlano,
    obterStatusCobranca,
    planoValido,
    podeContratar
} = require("../services/pagbankService");
const cobranca = require("../services/cobrancaService");

const router = express.Router();

router.use(exigirAutenticacao, exigirProfissional);
router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});

router.get("/status", (req, res) => {
    res.json(obterStatusCobranca(req.assinatura));
});

const tratar = operacao => async (req, res, next) => {
    try { await operacao(req, res); }
    catch (erro) {
        if ([400, 404, 409].includes(erro.status)) return res.status(erro.status).json({ codigo: erro.codigo, mensagem: erro.message });
        return next(erro);
    }
};
router.post("/boas-vindas", tratar(async (req, res) => res.json(await cobranca.registrarBoasVindas(req.usuario.id, req.body?.escolha))));
router.post("/cancelamento", tratar(async (req, res) => res.json(await cobranca.solicitarCancelamento(req.usuario.id))));

router.post("/checkout", (req, res) => {
    const plano = req.body?.plano;

    if (!planoValido(plano)) {
        return res.status(400).json({
            mensagem: "Escolha o plano mensal ou anual."
        });
    }

    if (req.assinatura?.acesso_permanente) {
        return res.status(409).json({
            codigo: "ACESSO_PERMANENTE",
            mensagem: "Sua conta possui acesso gratuito permanente. Nao e necessario contratar um plano."
        });
    }

    if (!podeContratar(req.assinatura)) {
        return res.status(409).json({
            codigo: "RENOVACAO_EM_CONFERENCIA",
            mensagem: "Sua assinatura recorrente ja existe. Aguarde a conferencia do pagamento ou a confirmacao do cancelamento antes de contratar novamente. Entre em contato com o suporte se precisar."
        });
    }

    const url = obterLinkDoPlano(plano);

    if (!url) {
        return res.status(503).json({
            codigo: "COBRANCA_INDISPONIVEL",
            mensagem: "A contratação deste plano ainda não está disponível. Entre em contato com o responsável pelo sistema."
        });
    }

    return res.json({
        url,
        confirmacao_automatica: false,
        mensagem: "Finalize a assinatura no PagBank usando o mesmo e-mail da sua conta. A liberação do acesso ocorre após conferência do pagamento."
    });
});

module.exports = router;
