const authModel = require("../models/authModel");
const { hashToken, obterToken } = require("../security/sessao");
const { obterAssinatura } = require("../services/assinaturaService");
const { VERSAO_POLITICA } = require("../services/privacidadeService");

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
        req.usuario = { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel, bloqueado: Boolean(usuario.bloqueado_em),
            politica_aceita: Boolean(usuario.termos_aceitos_em) && usuario.termos_versao === VERSAO_POLITICA,
            boas_vindas_vistas: Boolean(usuario.boas_vindas_em) };
        req.assinatura = obterAssinatura(usuario, usuario.agora);
        req.sessaoHash = tokenHash;
        return next();
    } catch (erro) {
        return next(erro);
    }
}

function exigirAssinatura(req, res, next) {
    if (!req.usuario.politica_aceita) {
        return res.status(428).json({ codigo: "POLITICA_NAO_ACEITA", mensagem: "Revise os Termos de Uso e a Politica de Privacidade para continuar." });
    }
    if (req.assinatura.status === "expirada") {
        return res.status(402).json({
            codigo: "ASSINATURA_EXPIRADA",
            mensagem: "Seu periodo de acesso terminou. Escolha um plano para continuar.",
            assinatura: req.assinatura
        });
    }
    return next();
}

function exigirProfissional(req, res, next) {
    if (req.usuario.papel !== "profissional") {
        return res.status(403).json({ codigo: "PERFIL_NAO_PERMITIDO", mensagem: "Use o painel de administracao para gerenciar o sistema." });
    }
    if (req.usuario.bloqueado) {
        return res.status(403).json({ codigo: "ACESSO_BLOQUEADO", mensagem: "Seu acesso foi suspenso pela administracao. Entre em contato com o responsavel pelo sistema." });
    }
    return next();
}

function exigirAdministrador(req, res, next) {
    if (req.usuario.papel !== "admin" || req.usuario.bloqueado) {
        return res.status(403).json({ codigo: "ADMINISTRACAO_RESTRITA", mensagem: "Esta area e exclusiva da administracao do sistema." });
    }
    return next();
}

module.exports = { exigirAutenticacao, exigirAssinatura, exigirProfissional, exigirAdministrador };
