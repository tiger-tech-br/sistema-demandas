const express = require("express");
const { exigirAutenticacao } = require("../middleware/autenticacao");
const {
    obterLinkDoPlano,
    obterStatusCobranca,
    planoValido
} = require("../services/pagbankService");

const router = express.Router();

router.use(exigirAutenticacao);
router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});

router.get("/status", (req, res) => {
    res.json(obterStatusCobranca(req.assinatura));
});

router.post("/checkout", (req, res) => {
    const plano = req.body?.plano;

    if (!planoValido(plano)) {
        return res.status(400).json({
            mensagem: "Escolha o plano mensal ou anual."
        });
    }

    if (req.assinatura?.status === "teste") {
        return res.status(409).json({
            codigo: "TESTE_EM_ANDAMENTO",
            mensagem: "Aproveite seus 30 dias grátis. A contratação ficará disponível ao término do período de teste."
        });
    }

    if (req.assinatura?.status !== "expirada") {
        return res.status(409).json({
            codigo: "ASSINATURA_ATIVA",
            mensagem: "Você já possui acesso ativo. Consulte sua assinatura antes de contratar novamente."
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
