const db = require("../config/db");
const inicializarBanco = require("../config/initDb");
const { obterAssinatura, cobrancaPrecisaEncerramento } = require("./assinaturaService");
const { obterLinkDoPlano, planoValido, podeContratar } = require("./pagbankService");

const erroPublico = (status, codigo, mensagem) => Object.assign(new Error(mensagem), { status, codigo });

async function registrarBoasVindas(usuarioId, escolha) {
    if (!["teste", "mensal", "anual"].includes(escolha)) {
        throw erroPublico(400, "ESCOLHA_INVALIDA", "Escolha o teste gratuito ou um dos planos pagos.");
    }
    await inicializarBanco();
    // A escolha de um card nao confirma pagamento nem altera o inicio do teste.
    await db.query("UPDATE usuarios SET boas_vindas_em = COALESCE(boas_vindas_em, CURRENT_TIMESTAMP) WHERE id = $1 AND papel = 'profissional'", [usuarioId]);
    return { vistas: true };
}

async function iniciarCheckout(usuarioId, plano) {
    if (!planoValido(plano)) throw erroPublico(400, "PLANO_INVALIDO", "Escolha o plano mensal ou anual.");
    await inicializarBanco();
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(715120263)");
        const usuario = (await client.query("SELECT *, CURRENT_TIMESTAMP AS agora FROM usuarios WHERE id = $1 AND papel = 'profissional' FOR UPDATE", [usuarioId])).rows[0];
        if (!usuario) throw erroPublico(404, "PESSOA_NAO_ENCONTRADA", "Conta não encontrada.");
        if (usuario.bloqueado_em) throw erroPublico(403, "ACESSO_BLOQUEADO", "Seu acesso foi suspenso pela administração.");
        if (usuario.exclusao_solicitada_em) throw erroPublico(409, "EXCLUSAO_PENDENTE", "Seu cadastro está aguardando exclusão após a confirmação do cancelamento. Não é possível abrir uma nova contratação.");
        if (usuario.acesso_permanente) throw erroPublico(409, "ACESSO_PERMANENTE", "Sua conta possui acesso gratuito permanente. Não é necessário contratar um plano.");
        if (!podeContratar(obterAssinatura(usuario, usuario.agora))) {
            throw erroPublico(409, "RENOVACAO_EM_CONFERENCIA", "Sua assinatura recorrente já existe. Aguarde a conferência do pagamento ou a confirmação do cancelamento antes de contratar novamente.");
        }
        const url = obterLinkDoPlano(plano);
        if (!url) throw erroPublico(503, "COBRANCA_INDISPONIVEL", "A contratação deste plano ainda não está disponível. Entre em contato com o responsável pelo sistema.");
        // Registra antes de expor o link: o pagamento pode ocorrer antes da conferencia local.
        const atualizado = (await client.query(`UPDATE usuarios SET
            contratacao_iniciada_em = COALESCE(contratacao_iniciada_em, clock_timestamp()),
            contratacao_plano = $2,
            cancelamento_solicitado_em = CASE WHEN contratacao_iniciada_em IS NULL THEN NULL ELSE cancelamento_solicitado_em END
            WHERE id = $1 RETURNING *, CURRENT_TIMESTAMP AS agora`, [usuarioId, plano])).rows[0];
        await client.query("COMMIT");
        return { url, confirmacao_automatica: false, assinatura: obterAssinatura(atualizado, atualizado.agora),
            mensagem: "Finalize a assinatura no PagBank usando o mesmo e-mail da sua conta. A liberação do acesso ocorre após conferência do pagamento." };
    } catch (erro) {
        await client.query("ROLLBACK").catch(() => {});
        throw erro;
    } finally { client.release(); }
}

async function solicitarCancelamento(usuarioId) {
    await inicializarBanco();
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(715120263)");
        const usuario = (await client.query("SELECT *, CURRENT_TIMESTAMP AS agora FROM usuarios WHERE id = $1 AND papel = 'profissional' FOR UPDATE", [usuarioId])).rows[0];
        if (!usuario) throw erroPublico(404, "PESSOA_NAO_ENCONTRADA", "Conta nao encontrada.");
        if (!usuario.assinatura_plano && !usuario.contratacao_iniciada_em) {
            throw erroPublico(409, "SEM_ASSINATURA_PAGA", "Sua conta nao possui uma assinatura paga para cancelar.");
        }
        const precisaEncerramento = cobrancaPrecisaEncerramento(usuario);
        if (precisaEncerramento && (!usuario.cancelamento_solicitado_em ||
                (usuario.contratacao_iniciada_em && new Date(usuario.cancelamento_solicitado_em) < new Date(usuario.contratacao_iniciada_em)))) {
            const atualizado = (await client.query(`UPDATE usuarios SET cancelamento_solicitado_em = clock_timestamp()
                WHERE id = $1 RETURNING *, CURRENT_TIMESTAMP AS agora`, [usuarioId])).rows[0];
            Object.assign(usuario, atualizado);
        }
        await client.query("COMMIT");
        return {
            assinatura: obterAssinatura(usuario, usuario.agora),
            mensagem: usuario.exclusao_solicitada_em
                ? "Pedido recebido. O cadastro será excluído automaticamente após a confirmação do encerramento da cobrança no PagBank."
                : !precisaEncerramento && usuario.cancelamento_confirmado_em
                ? "O cancelamento da sua assinatura ja foi confirmado."
                : !usuario.assinatura_plano
                ? "Pedido recebido. O responsável verificará a contratação no PagBank e confirmará o encerramento nesta página."
                : "Pedido recebido. O responsavel precisa cancelar a cobranca no PagBank e confirmar aqui. Voce recebera um e-mail apos a confirmacao. Seu acesso pago permanece ate o vencimento."
        };
    } catch (erro) {
        await client.query("ROLLBACK").catch(() => {});
        throw erro;
    } finally { client.release(); }
}

module.exports = { registrarBoasVindas, iniciarCheckout, solicitarCancelamento };
