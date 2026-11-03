const { createHash } = require("node:crypto");
const { cobrancaPrecisaEncerramento } = require("./assinaturaService");

async function apagarContaNaTransacao(client, usuario) {
    if (usuario.papel !== "profissional" || cobrancaPrecisaEncerramento(usuario)) {
        throw Object.assign(new Error("Confirme o encerramento da cobrança antes de excluir o cadastro."),
            { status: 409, codigo: "CANCELAMENTO_NECESSARIO" });
    }
    const usuarioId = usuario.id;
    // O chamador ja bloqueou pagamentos e a conta; todas as escritas usam a mesma transacao.
    await client.query(`INSERT INTO referencias_pagamento_excluidas (referencia_hash)
        SELECT encode(sha256(convert_to(referencia, 'UTF8')), 'hex')
        FROM ativacoes_assinatura WHERE usuario_id = $1 ON CONFLICT DO NOTHING`, [usuarioId]);
    await client.query("DELETE FROM notificacoes_email WHERE usuario_id = $1", [usuarioId]);
    await client.query("DELETE FROM solicitacoes_privacidade WHERE usuario_id = $1", [usuarioId]);
    await client.query("DELETE FROM acoes_administrativas WHERE usuario_id = $1", [usuarioId]);
    await client.query("DELETE FROM ativacoes_assinatura WHERE usuario_id = $1", [usuarioId]);
    await client.query("DELETE FROM demandas WHERE usuario_id = $1", [usuarioId]);
    const chavesEmail = [`login:email:${usuario.email}`, `redefinicao:solicitar:email:${usuario.email}`]
        .map(chave => createHash("sha256").update(chave).digest("hex"));
    await client.query("DELETE FROM auth_limites WHERE chave IN ($1, $2)", chavesEmail);
    // As FKs revogam todas as sessoes e tokens de recuperacao.
    await client.query("DELETE FROM usuarios WHERE id = $1", [usuarioId]);
}

module.exports = { apagarContaNaTransacao };
