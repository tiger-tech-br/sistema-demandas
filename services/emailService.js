const { randomUUID } = require("node:crypto");

const EMAIL_VALIDO = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function obterConfiguracaoEmail(ambiente = process.env) {
    const apiKey = ambiente.RESEND_API_KEY?.trim();
    const from = ambiente.RESEND_FROM?.trim();
    const appUrl = ambiente.APP_URL?.trim();
    if (!apiKey || apiKey.length > 512 || /\s/.test(apiKey) || !from || from.length > 320 || /[\r\n]/.test(from) || !appUrl) return null;
    const remetente = /^(?:[^<>]+\s*)?<([^<>]+)>$/.exec(from)?.[1] || from;
    if (!EMAIL_VALIDO.test(remetente)) return null;
    try {
        const url = new URL(appUrl);
        const local = new Set(["localhost", "127.0.0.1", "[::1]"]).has(url.hostname);
        if (url.username || url.password || url.search || url.hash ||
            (url.protocol !== "https:" && !(ambiente.NODE_ENV !== "production" && local && url.protocol === "http:"))) return null;
        return { apiKey, from, appUrl: url.href };
    } catch {
        return null;
    }
}

async function enviarEmailResend(mensagem, configuracao, { idempotencyKey } = {}) {
    if (idempotencyKey !== undefined && (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9._:/-]{1,256}$/.test(idempotencyKey))) {
        throw new Error("EMAIL_IDEMPOTENCY_KEY_INVALID");
    }
    const resposta = await fetch("https://api.resend.com/emails", {
        method: "POST",
        redirect: "error",
        headers: {
            Authorization: `Bearer ${configuracao.apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey || randomUUID()
        },
        body: JSON.stringify({ from: configuracao.from, ...mensagem, reply_to: "tigertechbr@outlook.com" }),
        signal: AbortSignal.timeout(10000)
    });
    // O corpo do provedor pode conter dados pessoais; nao o registramos nem o repassamos.
    await resposta.body?.cancel();
    if (!resposta.ok) throw new Error("PASSWORD_RESET_EMAIL_FAILED");
}

module.exports = { obterConfiguracaoEmail, enviarEmailResend };
