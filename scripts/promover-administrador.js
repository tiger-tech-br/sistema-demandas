if (require.main === module) require("../config/env");
const db = require("../config/db");
const inicializarBanco = require("../config/initDb");

function argumentos(valores) {
    const opcoes = {};
    for (let i = 0; i < valores.length; i++) {
        if (valores[i] === "--confirmar") opcoes.confirmar = true;
        else if (valores[i] === "--email" && valores[i + 1]) opcoes.email = valores[++i];
        else throw new Error("Uso: node scripts/promover-administrador.js --email pessoa@exemplo.com --confirmar");
    }
    if (!opcoes.confirmar || typeof opcoes.email !== "string" || opcoes.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(opcoes.email.trim())) {
        throw new Error("Informe o e-mail de uma conta existente e --confirmar para conceder administracao.");
    }
    return { email: opcoes.email.trim().toLowerCase(), confirmar: true };
}

async function promoverAdministrador(opcoes) {
    const validado = argumentos(["--email", opcoes.email, ...(opcoes.confirmar ? ["--confirmar"] : [])]);
    await inicializarBanco();
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const usuario = (await client.query("SELECT id, papel FROM usuarios WHERE email = $1 FOR UPDATE", [validado.email])).rows[0];
        if (!usuario) throw new Error("Conta nao encontrada. Cadastre a conta antes de conceder administracao.");
        if (usuario.papel === "admin") {
            await client.query("COMMIT");
            return { email: validado.email, papel: "admin", alterado: false, sessoes_revogadas: 0 };
        }
        if (Number((await client.query("SELECT COUNT(*) AS quantidade FROM demandas WHERE usuario_id = $1", [usuario.id])).rows[0].quantidade) > 0) {
            throw new Error("Esta conta possui demandas. Preserve seus registros antes de alterar o perfil.");
        }
        await client.query("UPDATE usuarios SET papel = 'admin', bloqueado_em = NULL WHERE id = $1", [usuario.id]);
        const revogadas = await client.query("DELETE FROM sessoes WHERE usuario_id = $1", [usuario.id]);
        await client.query("INSERT INTO acoes_administrativas (administrador_id, usuario_id, acao) VALUES ($1, $1, 'promocao_por_operador')", [usuario.id]);
        await client.query("COMMIT");
        return { email: validado.email, papel: "admin", alterado: true, sessoes_revogadas: revogadas.rowCount };
    } catch (erro) {
        await client.query("ROLLBACK").catch(() => {});
        throw erro;
    } finally { client.release(); }
}

async function main() {
    try {
        const resultado = await promoverAdministrador(argumentos(process.argv.slice(2)));
        console.log(`Acesso de administrador preparado para ${resultado.email}. Entre novamente com sua senha atual.`);
    } catch (erro) {
        console.error(erro.code ? `Operacao nao concluida (${erro.code}).` : erro.message);
        process.exitCode = 1;
    } finally { await db.end(); }
}

if (require.main === module) main();
module.exports = { argumentos, promoverAdministrador };
