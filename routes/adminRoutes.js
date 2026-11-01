const express = require("express");
const { exigirAutenticacao, exigirAdministrador } = require("../middleware/autenticacao");
const admin = require("../services/adminService");
const router = express.Router();
router.use(exigirAutenticacao, exigirAdministrador);
router.param("id", (req, res, next, valor) => {
    const id = Number(valor);
    if (!/^[1-9][0-9]*$/.test(valor) || !Number.isSafeInteger(id) || id > 2147483647) {
        return res.status(400).json({ codigo: "ID_INVALIDO", mensagem: "Escolha uma pessoa cadastrada." });
    }
    req.pessoaId = id;
    return next();
});
const tratar = operacao => async (req, res, next) => {
    try { await operacao(req, res); }
    catch (erro) {
        if ([400, 404, 409].includes(erro.status)) return res.status(erro.status).json({ codigo: erro.codigo, mensagem: erro.message });
        return next(erro);
    }
};
router.get("/pessoas", tratar(async (req, res) => res.json(await admin.listarPessoas())));
router.get("/pessoas/:id", tratar(async (req, res) => res.json(await admin.detalharPessoa(req.pessoaId))));
router.post("/pessoas/:id/assinatura", tratar(async (req, res) => {
    const resultado = await admin.ativarPlano(req.usuario.id, req.pessoaId, req.body);
    return res.status(resultado.repetida ? 200 : 201).json(resultado);
}));
router.patch("/pessoas/:id/acesso", tratar(async (req, res) => res.json(await admin.alterarAcesso(req.usuario.id, req.pessoaId, req.body?.bloqueado))));
router.use((req, res) => res.status(404).json({ mensagem: "Rota de administracao nao encontrada." }));
module.exports = router;
