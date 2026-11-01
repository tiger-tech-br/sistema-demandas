const express = require("express");
const { createHash } = require("node:crypto");
const authModel = require("../models/authModel");
const passwordResetService = require("../services/passwordResetService");

async function limitarRedefinicao(req, res, acao) {
    const janela = 15 * 60 * 1000;
    const limites = [{ escopo: `ip:${req.ip}`, maximo: 20 }];
    if (acao === "solicitar" && passwordResetService.emailValido(req.body?.email)) {
        limites.push({ escopo: `email:${req.body.email.trim().toLowerCase()}`, maximo: 5 });
    }
    if (acao === "redefinir" && typeof req.body?.token === "string" && /^[a-f0-9]{64}$/.test(req.body.token)) {
        limites.push({ escopo: `token:${req.body.token}`, maximo: 10 });
    }
    for (const limite of limites) {
        const chave = createHash("sha256").update(`redefinicao:${acao}:${limite.escopo}`).digest("hex");
        const uso = await authModel.consumirLimite(chave, janela);
        if (uso.tentativas > limite.maximo) {
            const espera = Math.max(1, Math.ceil((new Date(uso.inicio_janela).getTime() + janela - Date.now()) / 1000));
            res.set("Retry-After", String(espera));
            res.status(429).json({ mensagem: "Muitas tentativas. Aguarde um pouco antes de tentar novamente." });
            return false;
        }
    }
    return true;
}

function criarRotasRedefinicao(servico = passwordResetService) {
    const router = express.Router();
    router.post("/esqueci-senha", async (req, res, next) => {
        try {
            const instancia = req.app.locals.servicoRedefinicao || servico;
            // Falha igual para todos os e-mails, antes de consultar qualquer conta.
            if (!instancia.disponibilidade()) return res.status(503).json({ mensagem: "A recuperacao de senha esta indisponivel no momento. Tente novamente mais tarde." });
            if (!await limitarRedefinicao(req, res, "solicitar")) return;
            if (!passwordResetService.emailValido(req.body?.email)) return res.status(400).json({ mensagem: "Informe um e-mail valido com ate 254 caracteres." });
            if (!instancia.solicitarRedefinicao(req.body.email)) return res.status(503).json({ mensagem: "A recuperacao de senha esta indisponivel no momento. Tente novamente mais tarde." });
            return res.json({ mensagem: passwordResetService.MENSAGEM_SOLICITACAO });
        } catch (erro) {
            return next(erro);
        }
    });
    router.post("/redefinir-senha", async (req, res, next) => {
        try {
            const instancia = req.app.locals.servicoRedefinicao || servico;
            if (!await limitarRedefinicao(req, res, "redefinir")) return;
            if (!passwordResetService.senhaValida(req.body?.senha)) return res.status(400).json({ mensagem: "A senha deve ter de 10 a 128 caracteres." });
            const sucesso = await instancia.redefinirSenha({ token: req.body?.token, senha: req.body.senha });
            if (!sucesso) return res.status(400).json({ mensagem: passwordResetService.MENSAGEM_TOKEN_INVALIDO });
            return res.json({ mensagem: "Senha redefinida. Entre novamente com sua nova senha." });
        } catch (erro) {
            return next(erro);
        }
    });
    return router;
}

module.exports = criarRotasRedefinicao();
module.exports.criarRotasRedefinicao = criarRotasRedefinicao;
