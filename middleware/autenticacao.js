const authModel = require("../models/authModel");
const { hashToken, obterToken } = require("../security/sessao");
const { obterAssinatura } = require("../services/assinaturaService");

async function exigirAutenticacao(req, res, next) {
    try {
        const token = obterToken(req);
        if (!token) {
            return res.status(401).json({ codigo: "AUTENTICACAO_NECESSARIA", mensagem: "Entre na sua conta para continuar." });
        }
        const tokenHash = hashToken(token);
        const usuario = await authModel.buscarSessao(tokenHash);
        if (!usuario) {
            return res.status(401).json({ codigo: "SESSAO_EXPIRADA", mensagem: "Sua sessao expirou. Entre novamente." });
        }
        // Uma aba antiga nao pode operar com o cookie de outra conta aberta depois.
        const usuarioEsperado = req.get("X-Usuario-Id");
        if (usuarioEsperado && usuarioEsperado !== String(usuario.id)) {
            return res.status(401).json({
                codigo: "CONTA_ALTERADA",
                mensagem: "A conta aberta mudou em outra aba. Entre novamente para continuar."
            });
        }
        req.usuario = { id: usuario.id, nome: usuario.nome, email: usuario.email };
        req.assinatura = obterAssinatura(usuario, usuario.agora);
        req.sessaoHash = tokenHash;
        return next();
    } catch (erro) {
        return next(erro);
    }
}

function exigirAssinatura(req, res, next) {
    if (req.assinatura.status === "expirada") {
        return res.status(402).json({
            codigo: "ASSINATURA_EXPIRADA",
            mensagem: "Seu periodo de acesso terminou. Escolha um plano para continuar.",
            assinatura: req.assinatura
        });
    }
    return next();
}

module.exports = { exigirAutenticacao, exigirAssinatura };
