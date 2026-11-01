if (require.main === module) require("../config/env");
const db = require("../config/db");
const inicializarBanco = require("../config/initDb");
const { obterPlanos } = require("../services/assinaturaService");

function argumentos(valores) {
    const opcoes = {};
    for (let i = 0; i < valores.length; i++) {
        const nome = valores[i];
        if (nome === "--confirmar") opcoes.confirmar = true;
        else if (["--email", "--plano", "--referencia"].includes(nome) && valores[i + 1] && !valores[i + 1].startsWith("--")) opcoes[nome.slice(2)] = valores[++i];
        else throw new Error("Uso: node scripts/ativar-assinatura.js --email pessoa@exemplo.com --plano mensal|anual --referencia ID_PAGAMENTO --confirmar");
    }
    if (!opcoes.confirmar) throw new Error("Confira o pagamento no PagBank e use --confirmar somente depois da conferencia.");
    if (!opcoes.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(opcoes.email) || opcoes.email.length > 254) throw new Error("Informe o e-mail da conta cadastrada em --email.");
    if (!obterPlanos().planos.some((plano) => plano.id === opcoes.plano)) throw new Error("Informe --plano mensal ou --plano anual.");
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/.test(opcoes.referencia || "")) throw new Error("Informe a referencia unica do pagamento conferido em --referencia (3 a 120 caracteres).");
    return { ...opcoes, email: opcoes.email.trim().toLowerCase() };
}

async function ativarAssinatura(opcoes) {
    // Revalida tambem quando a funcao e usada por outro script administrativo.
    const validado = argumentos(["--email", opcoes.email, "--plano", opcoes.plano, "--referencia", opcoes.referencia, ...(opcoes.confirmar ? ["--confirmar"] : [])]);
    const plano = obterPlanos().planos.find((item) => item.id === validado.plano);
    await inicializarBanco();
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(715120263)");
        const usuario = (await client.query("SELECT id, papel FROM usuarios WHERE email = $1 FOR UPDATE", [validado.email])).rows[0];
        if (!usuario) throw new Error("Conta nao encontrada. Cadastre a conta de destino primeiro.");
        if (usuario.papel !== "profissional") throw new Error("A conta de administrador nao utiliza assinatura de demandas.");
        const resultado = await client.query(`
            UPDATE usuarios SET
                assinatura_plano = $2::varchar(10),
                assinatura_expira_em = GREATEST(CURRENT_TIMESTAMP, teste_expira_em, assinatura_expira_em)
                    + CASE WHEN $2::varchar(10) = 'mensal' THEN INTERVAL '1 month' ELSE INTERVAL '1 year' END
            WHERE id = $1
            RETURNING assinatura_expira_em
        `, [usuario.id, plano.id]);
        const acessoAte = resultado.rows[0].assinatura_expira_em;
        await client.query(`
            INSERT INTO ativacoes_assinatura (usuario_id, referencia, plano, valor_centavos, acesso_ate)
            VALUES ($1, $2, $3, $4, $5)
        `, [usuario.id, validado.referencia, plano.id, plano.valor_centavos, acessoAte]);
        await client.query("COMMIT");
        return { email: validado.email, plano: plano.id, valor_centavos: plano.valor_centavos, acesso_ate: new Date(acessoAte).toISOString() };
    } catch (erro) {
        await client.query("ROLLBACK").catch(() => {});
        if (erro.code === "23505") throw new Error("Esta referencia de pagamento ja foi utilizada. A assinatura nao foi prorrogada novamente.");
        throw erro;
    } finally {
        client.release();
    }
}

async function main() {
    try {
        const resultado = await ativarAssinatura(argumentos(process.argv.slice(2)));
        console.log(`Plano ${resultado.plano} ativado para ${resultado.email} ate ${resultado.acesso_ate}.`);
    } catch (erro) {
        console.error(erro.code ? `Operacao nao concluida (${erro.code}). A assinatura nao foi alterada.` : erro.message);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

if (require.main === module) main();
module.exports = { argumentos, ativarAssinatura };
