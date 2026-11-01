const db = require("../config/db");
const inicializarBanco = require("../config/initDb");
const { obterAssinatura } = require("./assinaturaService");

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

async function solicitarCancelamento(usuarioId) {
    await inicializarBanco();
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const usuario = (await client.query("SELECT *, CURRENT_TIMESTAMP AS agora FROM usuarios WHERE id = $1 AND papel = 'profissional' FOR UPDATE", [usuarioId])).rows[0];
        if (!usuario) throw erroPublico(404, "PESSOA_NAO_ENCONTRADA", "Conta nao encontrada.");
        if (!usuario.assinatura_plano || usuario.acesso_permanente) {
            throw erroPublico(409, "SEM_ASSINATURA_PAGA", "Sua conta nao possui uma assinatura paga para cancelar.");
        }
        if (!usuario.cancelamento_solicitado_em && !usuario.cancelamento_confirmado_em) {
            const atualizado = (await client.query(`UPDATE usuarios SET cancelamento_solicitado_em = clock_timestamp()
                WHERE id = $1 RETURNING *, CURRENT_TIMESTAMP AS agora`, [usuarioId])).rows[0];
            Object.assign(usuario, atualizado);
        }
        await client.query("COMMIT");
        return {
            assinatura: obterAssinatura(usuario, usuario.agora),
            mensagem: usuario.cancelamento_confirmado_em
                ? "O cancelamento da sua assinatura ja foi confirmado."
                : "Pedido recebido. O responsavel precisa cancelar a cobranca no PagBank e confirmar aqui. Voce recebera um e-mail apos a confirmacao. Seu acesso pago permanece ate o vencimento."
        };
    } catch (erro) {
        await client.query("ROLLBACK").catch(() => {});
        throw erro;
    } finally { client.release(); }
}

module.exports = { registrarBoasVindas, solicitarCancelamento };
