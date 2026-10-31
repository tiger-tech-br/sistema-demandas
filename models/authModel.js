const db = require("../config/db");
const inicializarBanco = require("../config/initDb");

async function buscarPorEmail(email) {
    await inicializarBanco();
    const resultado = await db.query("SELECT *, CURRENT_TIMESTAMP AS agora FROM usuarios WHERE email = $1", [email]);
    return resultado.rows[0];
}

async function criarUsuarioComSessao({ nome, email, senhaHash }, sessao) {
    await inicializarBanco();
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const resultado = await client.query(`
            INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3)
            RETURNING *, CURRENT_TIMESTAMP AS agora
        `, [nome, email, senhaHash]);
        const usuario = resultado.rows[0];
        await client.query("INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES ($1, $2, $3)",
            [sessao.tokenHash, usuario.id, sessao.expiraEm]);
        await client.query("COMMIT");
        return usuario;
    } catch (erro) {
        await client.query("ROLLBACK").catch(() => {});
        throw erro;
    } finally {
        client.release();
    }
}

async function criarSessao(usuarioId, sessao) {
    await inicializarBanco();
    await db.query("INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES ($1, $2, $3)",
        [sessao.tokenHash, usuarioId, sessao.expiraEm]);
}

async function buscarSessao(tokenHash) {
    await inicializarBanco();
    const resultado = await db.query(`
        SELECT u.*, CURRENT_TIMESTAMP AS agora
        FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.token_hash = $1 AND s.expira_em > CURRENT_TIMESTAMP
    `, [tokenHash]);
    return resultado.rows[0];
}

async function excluirSessao(tokenHash) {
    await inicializarBanco();
    await db.query("DELETE FROM sessoes WHERE token_hash = $1", [tokenHash]);
}

async function consumirLimite(chave, duracaoMs) {
    await inicializarBanco();
    const resultado = await db.query(`
        INSERT INTO auth_limites (chave) VALUES ($1)
        ON CONFLICT (chave) DO UPDATE SET
            tentativas = CASE
                WHEN auth_limites.inicio_janela <= CURRENT_TIMESTAMP - ($2::bigint * INTERVAL '1 millisecond') THEN 1
                ELSE auth_limites.tentativas + 1 END,
            inicio_janela = CASE
                WHEN auth_limites.inicio_janela <= CURRENT_TIMESTAMP - ($2::bigint * INTERVAL '1 millisecond') THEN CURRENT_TIMESTAMP
                ELSE auth_limites.inicio_janela END
        RETURNING tentativas, inicio_janela
    `, [chave, duracaoMs]);
    return resultado.rows[0];
}

module.exports = { buscarPorEmail, criarUsuarioComSessao, criarSessao, buscarSessao, excluirSessao, consumirLimite };
