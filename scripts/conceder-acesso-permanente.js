if (require.main === module) require("../config/env");
const db = require("../config/db");
const inicializarBanco = require("../config/initDb");
const { cobrancaPrecisaEncerramento } = require("../services/assinaturaService");

function argumentos(valores) {
    const opcoes = {};
    for (let i = 0; i < valores.length; i++) {
        if (valores[i] === "--confirmar") opcoes.confirmar = true;
        else if (["--email", "--administrador"].includes(valores[i]) && valores[i + 1]) opcoes[valores[i].slice(2)] = valores[++i];
        else throw new Error("Uso: node scripts/conceder-acesso-permanente.js --email pessoa@exemplo.com --administrador admin@exemplo.com --confirmar");
    }
    for (const chave of ["email", "administrador"]) {
        if (typeof opcoes[chave] !== "string" || opcoes[chave].length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(opcoes[chave].trim())) throw new Error("Informe os e-mails da pessoa e do administrador existente.");
        opcoes[chave] = opcoes[chave].trim().toLowerCase();
    }
    if (!opcoes.confirmar) throw new Error("Use --confirmar para conceder acesso gratuito permanente a esta conta existente.");
    return opcoes;
}

async function concederAcessoPermanente(opcoes) {
    const validado = argumentos(["--email", opcoes.email, "--administrador", opcoes.administrador, ...(opcoes.confirmar ? ["--confirmar"] : [])]);
    await inicializarBanco();
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(715120263)");
        const administrador = (await client.query("SELECT id FROM usuarios WHERE email = $1 AND papel = 'admin' AND bloqueado_em IS NULL FOR UPDATE", [validado.administrador])).rows[0];
        if (!administrador) throw new Error("Administrador ativo nao encontrado.");
        const usuario = (await client.query("SELECT id, papel, acesso_permanente, assinatura_plano, cancelamento_confirmado_em, contratacao_iniciada_em, exclusao_solicitada_em FROM usuarios WHERE email = $1 FOR UPDATE", [validado.email])).rows[0];
        if (!usuario || usuario.papel !== "profissional") throw new Error("Conta profissional existente nao encontrada.");
        if (usuario.exclusao_solicitada_em) throw new Error("O cadastro está aguardando exclusão. Confirme o encerramento da cobrança antes de concluir a exclusão.");
        if (cobrancaPrecisaEncerramento(usuario)) throw new Error("Cancele e confirme a assinatura ou contratação anterior antes de conceder gratuidade, para evitar cobranças indevidas.");
        if (!usuario.acesso_permanente) {
            await client.query("UPDATE usuarios SET acesso_permanente = true WHERE id = $1", [usuario.id]);
            await client.query(`INSERT INTO acoes_administrativas (administrador_id, usuario_id, acao)
                VALUES ($1, $2, 'acesso_permanente_concedido')`, [administrador.id, usuario.id]);
        }
        await client.query("COMMIT");
        return { email: validado.email, acesso_permanente: true, alterado: !usuario.acesso_permanente };
    } catch (erro) {
        await client.query("ROLLBACK").catch(() => {});
        throw erro;
    } finally { client.release(); }
}

async function main() {
    try {
        const resultado = await concederAcessoPermanente(argumentos(process.argv.slice(2)));
        console.log(`Acesso gratuito permanente ${resultado.alterado ? "concedido" : "ja registrado"} para ${resultado.email}. Demandas e senha preservadas.`);
    } catch (erro) {
        console.error(erro.code ? `Operacao nao concluida (${erro.code}).` : erro.message);
        process.exitCode = 1;
    } finally { await db.end(); }
}
if (require.main === module) main();
module.exports = { argumentos, concederAcessoPermanente };
