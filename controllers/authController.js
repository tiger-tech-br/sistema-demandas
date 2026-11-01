const authModel = require("../models/authModel");
const { criarHash, verificarSenha } = require("../security/senha");
const { novaSessao, definirCookie, obterToken, hashToken } = require("../security/sessao");
const { clienteAndroid } = require("../middleware/origem");
const { obterAssinatura } = require("../services/assinaturaService");

function validarCredenciais(body, cadastro = false) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return "Informe os dados da sua conta.";
    }
    if (typeof body.email !== "string" || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
        return "Informe um e-mail valido com ate 254 caracteres.";
    }
    if (typeof body.senha !== "string" || body.senha.length < 10 || body.senha.length > 128) {
        return "A senha deve ter de 10 a 128 caracteres.";
    }
    if (cadastro && (typeof body.nome !== "string" || body.nome.trim().length < 2 || body.nome.trim().length > 120 || /[\u0000-\u001f\u007f]/.test(body.nome))) {
        return "Informe seu nome com 2 a 120 caracteres.";
    }
    return null;
}

function respostaConta(req, usuario, sessao) {
    const resposta = {
        usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel, bloqueado: Boolean(usuario.bloqueado_em) },
        assinatura: obterAssinatura(usuario, usuario.agora)
    };
    if (sessao && clienteAndroid(req)) resposta.token = sessao.token;
    return resposta;
}

async function revogarSessaoAnterior(req) {
    const token = obterToken(req);
    if (token) await authModel.excluirSessao(hashToken(token));
}

async function cadastrar(req, res, next) {
    const erroValidacao = validarCredenciais(req.body, true);
    if (erroValidacao) return res.status(400).json({ mensagem: erroValidacao });
    try {
        const sessao = novaSessao();
        const usuario = await authModel.criarUsuarioComSessao({
            nome: req.body.nome.trim(),
            email: req.body.email.trim().toLowerCase(),
            senhaHash: await criarHash(req.body.senha)
        }, sessao);
        await revogarSessaoAnterior(req);
        definirCookie(res, sessao.token);
        return res.status(201).json(respostaConta(req, usuario, sessao));
    } catch (erro) {
        if (erro.code === "23505") return res.status(409).json({ mensagem: "Ja existe uma conta com esse e-mail. Entre na sua conta." });
        return next(erro);
    }
}

async function login(req, res, next) {
    const erroValidacao = validarCredenciais(req.body);
    if (erroValidacao) return res.status(400).json({ mensagem: erroValidacao });
    try {
        const usuario = await authModel.buscarPorEmail(req.body.email.trim().toLowerCase());
        const senhaCorreta = await verificarSenha(req.body.senha, usuario?.senha_hash);
        if (!usuario || !senhaCorreta) return res.status(401).json({ mensagem: "E-mail ou senha incorretos." });
        const sessao = novaSessao();
        await authModel.criarSessao(usuario.id, sessao);
        await revogarSessaoAnterior(req);
        definirCookie(res, sessao.token);
        return res.json(respostaConta(req, usuario, sessao));
    } catch (erro) {
        return next(erro);
    }
}

function minhaConta(req, res) {
    return res.json({ usuario: req.usuario, assinatura: req.assinatura });
}

async function logout(req, res, next) {
    try {
        await authModel.excluirSessao(req.sessaoHash);
        // Revoga no servidor sem apagar um cookie mais novo de outra aba.
        return res.json({ mensagem: "Voce saiu da sua conta." });
    } catch (erro) {
        return next(erro);
    }
}

module.exports = { cadastrar, login, minhaConta, logout };
