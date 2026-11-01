const express = require("express");
const { exigirAutenticacao, exigirAdministrador } = require("../middleware/autenticacao");
const privacidade = require("../services/privacidadeService");

const router = express.Router();
router.use(exigirAutenticacao, exigirAdministrador);
router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});
router.param("id", (req, res, next, valor) => {
    const id = Number(valor);
    if (!/^[1-9][0-9]*$/.test(valor) || !Number.isSafeInteger(id) || id > 2147483647) {
        return res.status(400).json({ codigo: "ID_INVALIDO", mensagem: "Escolha uma solicitação válida." });
    }
    req.solicitacaoPrivacidadeId = id;
    return next();
});
const tratar = operacao => async (req, res, next) => {
    try { await operacao(req, res); }
    catch (erro) {
        if ([400, 404, 409].includes(erro.status)) {
            return res.status(erro.status).json({ codigo: erro.codigo, mensagem: erro.message });
        }
        return next(erro);
    }
};
router.get("/", tratar(async (req, res) => res.json(await privacidade.listarSolicitacoesAdministrativas())));
router.post("/:id/resposta", tratar(async (req, res) => res.json(await privacidade.responderSolicitacao(
    req.usuario.id, req.solicitacaoPrivacidadeId, req.body?.resposta
))));
router.use((req, res) => res.status(404).json({ mensagem: "Recurso administrativo de privacidade não encontrado." }));

module.exports = router;
