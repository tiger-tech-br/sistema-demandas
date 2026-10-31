const { createHash } = require("node:crypto");
const authModel = require("../models/authModel");

function limitarAutenticacao(acao) {
    return async function limitar(req, res, next) {
        try {
            const janela = acao === "cadastro" ? 3600000 : 900000;
            const limites = [{ escopo: `ip:${req.ip}`, maximo: acao === "cadastro" ? 10 : 30 }];
            if (acao === "login" && typeof req.body?.email === "string" && req.body.email.length <= 254) {
                limites.push({ escopo: `email:${req.body.email.trim().toLowerCase()}`, maximo: 10 });
            }
            for (const limite of limites) {
                const chave = createHash("sha256").update(`${acao}:${limite.escopo}`).digest("hex");
                const uso = await authModel.consumirLimite(chave, janela);
                if (uso.tentativas > limite.maximo) {
                    const espera = Math.max(1, Math.ceil((new Date(uso.inicio_janela).getTime() + janela - Date.now()) / 1000));
                    res.set("Retry-After", String(espera));
                    return res.status(429).json({ mensagem: "Muitas tentativas. Aguarde um pouco antes de tentar novamente." });
                }
            }
            return next();
        } catch (erro) {
            return next(erro);
        }
    };
}

module.exports = limitarAutenticacao;
