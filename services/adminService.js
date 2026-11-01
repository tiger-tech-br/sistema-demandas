const db = require("../config/db");
const inicializarBanco = require("../config/initDb");
const { obterAssinatura, obterPlanos } = require("./assinaturaService");

const CAMPOS = "id, nome, email, criado_em, papel, bloqueado_em, teste_expira_em, assinatura_plano, assinatura_expira_em, CURRENT_TIMESTAMP AS agora";
function erroPublico(status, codigo, mensagem) {
    return Object.assign(new Error(mensagem), { status, codigo });
}
function serializarPessoa(usuario) {
    return {
        id: usuario.id, nome: usuario.nome, email: usuario.email,
        criado_em: new Date(usuario.criado_em).toISOString(),
        bloqueado: Boolean(usuario.bloqueado_em),
        assinatura: obterAssinatura(usuario, usuario.agora)
    };
}
async function buscarPessoa(client, id, bloquear = false) {
    const usuario = (await client.query(`SELECT ${CAMPOS} FROM usuarios WHERE id = $1 AND papel = 'profissional'${bloquear ? " FOR UPDATE" : ""}`, [id])).rows[0];
    if (!usuario) throw erroPublico(404, "PESSOA_NAO_ENCONTRADA", "Pessoa nao encontrada.");
    return usuario;
}
async function listarPessoas() {
    await inicializarBanco();
    const pessoas = (await db.query(`SELECT ${CAMPOS} FROM usuarios WHERE papel = 'profissional' ORDER BY criado_em DESC, id DESC`)).rows.map(serializarPessoa);
    const resumo = { total: pessoas.length, em_teste: 0, ativas: 0, expiradas: 0, bloqueadas: 0 };
    for (const pessoa of pessoas) {
        if (pessoa.bloqueado) resumo.bloqueadas++;
        else if (pessoa.assinatura.status === "teste") resumo.em_teste++;
        else if (pessoa.assinatura.status === "ativa") resumo.ativas++;
        else resumo.expiradas++;
    }
    return { pessoas, resumo };
}
async function detalharPessoa(id) {
    await inicializarBanco();
    const usuario = await buscarPessoa(db, id);
    const ativacoes = (await db.query(`SELECT id, referencia, plano, valor_centavos, acesso_ate, ativado_em
        FROM ativacoes_assinatura WHERE usuario_id = $1 ORDER BY ativado_em DESC, id DESC LIMIT 100`, [id])).rows;
    return { pessoa: serializarPessoa(usuario), ativacoes };
}
async function ativarPlano(administradorId, pessoaId, dados) {
    const plano = obterPlanos().planos.find(item => item.id === dados?.plano);
    const referencia = typeof dados?.referencia === "string" ? dados.referencia.trim() : "";
    if (!plano || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/.test(referencia)) {
        throw erroPublico(400, "ATIVACAO_INVALIDA", "Escolha o plano e informe a referencia unica do pagamento conferido (3 a 120 caracteres).");
    }
    await inicializarBanco();
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        // A CLI usa o mesmo bloqueio: uma referencia nao pode prorrogar dois acessos.
        await client.query("SELECT pg_advisory_xact_lock(715120263)");
        const usuario = await buscarPessoa(client, pessoaId, true);
        const anterior = (await client.query(`SELECT id, usuario_id, referencia, plano, valor_centavos, acesso_ate, ativado_em
            FROM ativacoes_assinatura WHERE referencia = $1`, [referencia])).rows[0];
        if (anterior) {
            if (anterior.usuario_id !== pessoaId || anterior.plano !== plano.id) {
                throw erroPublico(409, "REFERENCIA_UTILIZADA", "Esta referencia ja foi registrada para outra pessoa ou plano. Nenhum acesso foi alterado.");
            }
            await client.query("COMMIT");
            const { usuario_id, ...ativacao } = anterior;
            return { pessoa: serializarPessoa(usuario), ativacao, repetida: true };
        }
        await client.query(`UPDATE usuarios SET assinatura_plano = $2::varchar(10),
            assinatura_expira_em = GREATEST(CURRENT_TIMESTAMP, teste_expira_em, assinatura_expira_em)
                + CASE WHEN $2::varchar(10) = 'mensal' THEN INTERVAL '1 month' ELSE INTERVAL '1 year' END
            WHERE id = $1`, [pessoaId, plano.id]);
        const atualizado = await buscarPessoa(client, pessoaId);
        const ativacao = (await client.query(`INSERT INTO ativacoes_assinatura (usuario_id, referencia, plano, valor_centavos, acesso_ate)
            VALUES ($1, $2, $3, $4, $5) RETURNING id, referencia, plano, valor_centavos, acesso_ate, ativado_em`,
        [pessoaId, referencia, plano.id, plano.valor_centavos, atualizado.assinatura_expira_em])).rows[0];
        await client.query(`INSERT INTO acoes_administrativas (administrador_id, usuario_id, acao, detalhes)
            VALUES ($1, $2, 'assinatura_conferida', $3::jsonb)`, [administradorId, pessoaId, JSON.stringify({ referencia, plano: plano.id, valor_centavos: plano.valor_centavos })]);
        await client.query("COMMIT");
        return { pessoa: serializarPessoa(atualizado), ativacao, repetida: false };
    } catch (erro) {
        await client.query("ROLLBACK").catch(() => {});
        throw erro;
    } finally { client.release(); }
}
async function alterarAcesso(administradorId, pessoaId, bloqueado) {
    if (typeof bloqueado !== "boolean") throw erroPublico(400, "ACESSO_INVALIDO", "Informe se o acesso deve ser bloqueado ou liberado.");
    await inicializarBanco();
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const usuario = await buscarPessoa(client, pessoaId, true);
        if (Boolean(usuario.bloqueado_em) !== bloqueado) {
            await client.query("UPDATE usuarios SET bloqueado_em = CASE WHEN $2::boolean THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id = $1", [pessoaId, bloqueado]);
            await client.query(`INSERT INTO acoes_administrativas (administrador_id, usuario_id, acao)
                VALUES ($1, $2, $3)`, [administradorId, pessoaId, bloqueado ? "acesso_bloqueado" : "acesso_liberado"]);
        }
        const atualizado = await buscarPessoa(client, pessoaId);
        await client.query("COMMIT");
        return { pessoa: serializarPessoa(atualizado) };
    } catch (erro) {
        await client.query("ROLLBACK").catch(() => {});
        throw erro;
    } finally { client.release(); }
}
module.exports = { listarPessoas, detalharPessoa, ativarPlano, alterarAcesso };
