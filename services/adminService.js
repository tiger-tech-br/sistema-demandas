const { createHash } = require("node:crypto");
const db = require("../config/db");
const inicializarBanco = require("../config/initDb");
const { obterAssinatura, obterPlanos } = require("./assinaturaService");
const { apagarContaNaTransacao } = require("./exclusaoContaService");

const CAMPOS = "id, nome, email, criado_em, papel, bloqueado_em, teste_expira_em, assinatura_plano, assinatura_expira_em, acesso_permanente, exclusao_solicitada_em, contratacao_iniciada_em, contratacao_plano, cancelamento_solicitado_em, cancelamento_confirmado_em, cancelamento_referencia, CURRENT_TIMESTAMP AS agora";
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
    const resumo = { total: pessoas.length, em_teste: 0, ativas: 0, expiradas: 0, bloqueadas: 0, gratuitas: 0 };
    for (const pessoa of pessoas) {
        if (pessoa.bloqueado) resumo.bloqueadas++;
        else if (pessoa.assinatura.status === "teste") resumo.em_teste++;
        else if (pessoa.assinatura.status === "ativa") resumo.ativas++;
        else if (pessoa.assinatura.status === "gratuita") resumo.gratuitas++;
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
        const excluida = await client.query("SELECT 1 FROM referencias_pagamento_excluidas WHERE referencia_hash = $1",
            [createHash("sha256").update(referencia).digest("hex")]);
        if (excluida.rowCount) {
            throw erroPublico(409, "REFERENCIA_UTILIZADA", "Esta referencia de pagamento ja foi utilizada. Nenhum acesso foi alterado.");
        }
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
        if (usuario.exclusao_solicitada_em) throw erroPublico(409, "EXCLUSAO_PENDENTE", "O cadastro está aguardando exclusão. Confirme o encerramento da cobrança antes de finalizar a exclusão.");
        if (usuario.acesso_permanente) throw erroPublico(409, "ACESSO_PERMANENTE", "Esta conta possui acesso gratuito permanente e nao precisa de um plano pago.");
        if (usuario.cancelamento_confirmado_em && dados.nova_assinatura !== true) {
            throw erroPublico(409, "NOVA_ASSINATURA_NECESSARIA", "Confirme que o pagamento pertence a uma nova contratacao apos o cancelamento anterior.");
        }
        if (!usuario.cancelamento_confirmado_em && dados.nova_assinatura === true) {
            throw erroPublico(409, "CANCELAMENTO_NAO_CONFIRMADO", "Confirme o cancelamento da assinatura anterior antes de registrar uma nova contratacao.");
        }
        await client.query(`UPDATE usuarios SET assinatura_plano = $2::varchar(10),
            assinatura_expira_em = GREATEST(CURRENT_TIMESTAMP, teste_expira_em, assinatura_expira_em)
                + CASE WHEN $2::varchar(10) = 'mensal' THEN INTERVAL '1 month' ELSE INTERVAL '1 year' END,
            cancelamento_solicitado_em = CASE WHEN $3::boolean THEN NULL ELSE cancelamento_solicitado_em END,
            cancelamento_confirmado_em = CASE WHEN $3::boolean THEN NULL ELSE cancelamento_confirmado_em END,
            cancelamento_referencia = CASE WHEN $3::boolean THEN NULL ELSE cancelamento_referencia END,
            contratacao_iniciada_em = NULL, contratacao_plano = NULL
            WHERE id = $1`, [pessoaId, plano.id, dados.nova_assinatura === true]);
        const atualizado = await buscarPessoa(client, pessoaId);
        const ativacao = (await client.query(`INSERT INTO ativacoes_assinatura (usuario_id, referencia, plano, valor_centavos, acesso_ate)
            VALUES ($1, $2, $3, $4, $5) RETURNING id, referencia, plano, valor_centavos, acesso_ate, ativado_em`,
        [pessoaId, referencia, plano.id, plano.valor_centavos, atualizado.assinatura_expira_em])).rows[0];
        await client.query(`INSERT INTO acoes_administrativas (administrador_id, usuario_id, acao, detalhes)
            VALUES ($1, $2, 'assinatura_conferida', $3::jsonb)`, [administradorId, pessoaId, JSON.stringify({ referencia, plano: plano.id, valor_centavos: plano.valor_centavos, nova_assinatura: dados.nova_assinatura === true })]);
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
async function confirmarCancelamento(administradorId, pessoaId, dados, notificacoes = require("./notificacaoService")) {
    const referencia = typeof dados?.referencia === "string" ? dados.referencia.trim() : "";
    if (dados?.confirmado_no_pagbank !== true || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/.test(referencia)) {
        throw erroPublico(400, "CANCELAMENTO_INVALIDO", "Cancele a assinatura no PagBank, confirme a conferencia e informe uma referencia de 3 a 120 caracteres.");
    }
    await inicializarBanco();
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(715120263)");
        const usuario = await buscarPessoa(client, pessoaId, true);
        if (!usuario.assinatura_plano && !usuario.contratacao_iniciada_em) {
            throw erroPublico(409, "SEM_ASSINATURA_PAGA", "Esta conta nao possui uma assinatura paga para cancelar.");
        }
        const encerramentoConfirmado = Boolean(usuario.cancelamento_confirmado_em && !usuario.contratacao_iniciada_em);
        if (encerramentoConfirmado && usuario.cancelamento_referencia !== referencia) {
            throw erroPublico(409, "CANCELAMENTO_JA_CONFIRMADO", "O cancelamento ja foi confirmado com outra referencia.");
        }
        if (!encerramentoConfirmado) {
            await client.query(`UPDATE usuarios SET
                cancelamento_solicitado_em = COALESCE(cancelamento_solicitado_em, clock_timestamp()),
                cancelamento_confirmado_em = clock_timestamp(), cancelamento_referencia = $2,
                contratacao_iniciada_em = NULL, contratacao_plano = NULL
                WHERE id = $1`, [pessoaId, referencia]);
            await client.query(`INSERT INTO acoes_administrativas (administrador_id, usuario_id, acao, detalhes)
                VALUES ($1, $2, 'cancelamento_confirmado', $3::jsonb)`, [administradorId, pessoaId, JSON.stringify({ referencia })]);
        }
        const atualizado = await buscarPessoa(client, pessoaId);
        if (atualizado.exclusao_solicitada_em) {
            await apagarContaNaTransacao(client, atualizado);
            await client.query("COMMIT");
            return { excluida: true, pessoa: null, pessoa_id: pessoaId, email_confirmacao: null,
                mensagem: "Cancelamento confirmado e cadastro excluído definitivamente." };
        }
        if (!atualizado.assinatura_plano || !atualizado.assinatura_expira_em) {
            await client.query("COMMIT");
            return { pessoa: serializarPessoa(atualizado), email_confirmacao: null,
                mensagem: "O encerramento da contratação no PagBank foi confirmado." };
        }
        const notificacaoId = await notificacoes.enfileirarConfirmacaoCancelamento(client, atualizado);
        const email = (await client.query("SELECT status FROM notificacoes_email WHERE id = $1", [notificacaoId])).rows[0];
        await client.query("COMMIT");
        return { pessoa: serializarPessoa(atualizado), email_confirmacao: email.status === "enviado" ? "enviado" : "pendente" };
    } catch (erro) {
        await client.query("ROLLBACK").catch(() => {});
        throw erro;
    } finally { client.release(); }
}
module.exports = { listarPessoas, detalharPessoa, ativarPlano, alterarAcesso, confirmarCancelamento };
