if (require.main === module) require("../config/env");
const db = require("../config/db");
const inicializarBanco = require("../config/initDb");

function argumentos(valores) {
    const opcoes = {};
    for (let i = 0; i < valores.length; i++) {
        const nome = valores[i];
        if (nome === "--confirmar") opcoes.confirmar = true;
        else if (["--email", "--quantidade"].includes(nome) && valores[i + 1] && !valores[i + 1].startsWith("--")) opcoes[nome.slice(2)] = valores[++i];
        else throw new Error("Uso: node scripts/atribuir-legado.js --email pessoa@exemplo.com [--confirmar --quantidade N]");
    }
    if (!opcoes.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(opcoes.email) || opcoes.email.length > 254) throw new Error("Informe o e-mail de uma conta ja cadastrada em --email.");
    if (opcoes.confirmar && (!/^\d+$/.test(opcoes.quantidade || "") || !Number.isSafeInteger(Number(opcoes.quantidade)))) throw new Error("Para confirmar, informe a quantidade esperada em --quantidade N.");
    return { ...opcoes, email: opcoes.email.trim().toLowerCase() };
}

async function atribuirLegado(opcoes) {
    await inicializarBanco();
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(715120262)");
        const usuario = (await client.query("SELECT id, email FROM usuarios WHERE email = $1 FOR UPDATE", [opcoes.email])).rows[0];
        if (!usuario) throw new Error("Conta nao encontrada. Cadastre a conta de destino antes de atribuir o legado.");
        // O bloqueio garante que a quantidade revisada corresponda ao conjunto atualizado.
        await client.query("LOCK TABLE demandas IN SHARE ROW EXCLUSIVE MODE");
        const quantidade = Number((await client.query("SELECT COUNT(*) AS quantidade FROM demandas WHERE usuario_id IS NULL")).rows[0].quantidade);
        if (opcoes.confirmar && quantidade !== Number(opcoes.quantidade)) throw new Error(`Existem ${quantidade} demandas sem dono; a quantidade difere da confirmada. Execute a previa novamente.`);
        if (opcoes.confirmar) await client.query("UPDATE demandas SET usuario_id = $1 WHERE usuario_id IS NULL", [usuario.id]);
        await client.query("COMMIT");
        return { email: usuario.email, quantidade, aplicado: Boolean(opcoes.confirmar) };
    } catch (erro) {
        await client.query("ROLLBACK").catch(() => {});
        throw erro;
    } finally {
        client.release();
    }
}

async function main() {
    try {
        const resultado = await atribuirLegado(argumentos(process.argv.slice(2)));
        console.log(`${resultado.quantidade} demanda(s) ${resultado.aplicado ? "atribuida(s)" : "disponivel(is) para atribuir"} a ${resultado.email}.`);
        if (!resultado.aplicado) console.log(`Revise o destino e execute novamente com --confirmar --quantidade ${resultado.quantidade} para aplicar.`);
    } catch (erro) {
        console.error(erro.code ? `Operacao nao concluida (${erro.code}). Nenhuma atribuicao foi aplicada.` : erro.message);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

if (require.main === module) main();
module.exports = { argumentos, atribuirLegado };
