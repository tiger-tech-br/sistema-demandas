const { randomBytes, createHash } = require("node:crypto");

const NOME_COOKIE = "demandas_sessao";
const DURACAO_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_VALIDO = /^[a-f0-9]{64}$/;

function hashToken(token) {
    return createHash("sha256").update(token).digest("hex");
}

function novaSessao() {
    const token = randomBytes(32).toString("hex");
    return { token, tokenHash: hashToken(token), expiraEm: new Date(Date.now() + DURACAO_MS) };
}

function obterToken(req) {
    const authorization = req.get("Authorization");
    if (authorization) {
        const partes = /^Bearer ([a-f0-9]{64})$/i.exec(authorization);
        return partes && TOKEN_VALIDO.test(partes[1]) ? partes[1] : null;
    }
    for (const cookie of (req.get("Cookie") || "").split(";")) {
        const [nome, ...valor] = cookie.trim().split("=");
        if (nome === NOME_COOKIE) {
            const token = valor.join("=");
            return TOKEN_VALIDO.test(token) ? token : null;
        }
    }
    return null;
}

function opcoesCookie() {
    return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" };
}

function definirCookie(res, token) {
    res.cookie(NOME_COOKIE, token, { ...opcoesCookie(), maxAge: DURACAO_MS });
}

function limparCookie(res) {
    res.clearCookie(NOME_COOKIE, opcoesCookie());
}

module.exports = { NOME_COOKIE, DURACAO_MS, hashToken, novaSessao, obterToken, definirCookie, limparCookie };
