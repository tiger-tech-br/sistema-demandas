// Operacao administrativa: preserva o banco original e exige quantidade revisada.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { createHash, randomBytes, timingSafeEqual } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { Pool } = require("pg");
const dotenv = require("dotenv");

const raiz = path.join(__dirname, "..");
const opcoes = process.argv.slice(2);
const aplicar = opcoes.includes("--aplicar-e-aguardar");
const indiceQuantidade = opcoes.indexOf("--quantidade");
const quantidadeEsperada = indiceQuantidade >= 0 ? Number(opcoes[indiceQuantidade + 1]) : null;
if (aplicar && (!Number.isSafeInteger(quantidadeEsperada) || quantidadeEsperada < 0)) {
    throw new Error("Revise o backup e informe --quantidade N para aplicar.");
}
const selecionar = `SELECT id, numero_demanda, beneficiario, regional, assunto,
    TO_CHAR(data_vencimento, 'YYYY-MM-DD') AS data_vencimento, concluida,
    TO_CHAR(criado_em, 'YYYY-MM-DD HH24:MI:SS.US') AS criado_em FROM demandas`;
const hash = (linhas) => createHash("sha256").update(JSON.stringify(linhas)).digest("hex");

async function main() {
    const anterior = dotenv.parse(fs.readFileSync(path.join(raiz, ".env")));
    const atual = dotenv.parse(fs.readFileSync(path.join(raiz, ".env.local")));
    const origem = new URL(anterior.DATABASE_URL);
    const destino = new URL(atual.DATABASE_URL);
    if (origem.hostname !== "altaria.proxy.rlwy.net" || origem.port !== "19491" ||
        !destino.hostname.endsWith(".neon.tech") || destino.pathname !== "/sistema_demandas") {
        throw new Error("Origem ou destino diferente dos bancos revisados. Operacao recusada.");
    }
    const source = new Pool({ connectionString: anterior.DATABASE_URL, ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 10000 });
    const target = new Pool({ connectionString: atual.DATABASE_URL, ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 10000 });
    let client;
    let servidor;
    let timer;
    let encerrando = false;
    const pastaBackup = path.join(raiz, "backups");
    fs.mkdirSync(pastaBackup, { recursive: true, mode: 0o700 });
    const controle = path.join(pastaBackup, "transferencia-em-andamento.json");

    async function encerrar() {
        if (encerrando) return;
        encerrando = true;
        clearTimeout(timer);
        if (servidor) await new Promise(resolve => servidor.close(resolve));
        if (client) { await client.query("ROLLBACK").catch(() => {}); client.release(); }
        await Promise.all([source.end(), target.end()]);
        if (aplicar && fs.existsSync(controle)) fs.unlinkSync(controle);
    }
    try {
        client = await source.connect();
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
        await client.query("SET LOCAL lock_timeout = '15s'");
        if (aplicar) await client.query("LOCK TABLE demandas IN SHARE MODE");
        const registros = (await client.query(`${selecionar} ORDER BY id`)).rows;
        const camposAusentes = Object.fromEntries(["numero_demanda", "beneficiario", "regional", "assunto", "data_vencimento", "concluida"].map(campo => [campo, registros.filter(registro => registro[campo] === null).length]));
        const instante = new Date().toISOString().replace(/[:.]/g, "-");
        const nomeBase = path.join(pastaBackup, `railway-demandas-${instante}`);
        const checksum = hash(registros);
        fs.writeFileSync(`${nomeBase}.json`, JSON.stringify({ criado_em: new Date().toISOString(), origem: "Railway/sistema-demandas", quantidade: registros.length, sha256: checksum, demandas: registros }, null, 2), { mode: 0o600 });

        if (!aplicar) {
            const pgDump = process.env.PG_DUMP_PATH || "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe";
            const resultado = spawnSync(pgDump, ["--format=custom", "--file", `${nomeBase}.dump`], {
                env: { ...process.env, PGHOST: origem.hostname, PGPORT: origem.port, PGUSER: decodeURIComponent(origem.username), PGPASSWORD: decodeURIComponent(origem.password), PGDATABASE: origem.pathname.slice(1), PGSSLMODE: "verify-full", PGCONNECT_TIMEOUT: "10" },
                stdio: "ignore", windowsHide: true, timeout: 120000
            });
            if (resultado.error || resultado.status !== 0) throw new Error("O backup completo do banco nao foi concluido.");
            console.log(JSON.stringify({ etapa: "backup_concluido", quantidade: registros.length, campos_ausentes: camposAusentes, numeros_fora_do_formato: registros.filter(registro => registro.numero_demanda != null && !/^[0-9]+$/.test(registro.numero_demanda)).length, sha256: checksum, backup: `${nomeBase}.dump`, exportacao: `${nomeBase}.json` }));
            await encerrar();
            return;
        }

        if (registros.length !== quantidadeEsperada) throw new Error("A quantidade da origem mudou. Revise o backup antes de continuar.");
        const destinoClient = await target.connect();
        try {
            await destinoClient.query("BEGIN");
            await destinoClient.query("LOCK TABLE demandas IN SHARE ROW EXCLUSIVE MODE");
            const total = Number((await destinoClient.query("SELECT COUNT(*) AS n FROM demandas")).rows[0].n);
            if (total !== 0) throw new Error("O destino ja contem demandas. Transferencia recusada para evitar sobrescrita.");
            for (const registro of registros) {
                await destinoClient.query(`INSERT INTO demandas (id, numero_demanda, beneficiario, regional, assunto, data_vencimento, concluida, criado_em, usuario_id)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL)`, [registro.id, registro.numero_demanda, registro.beneficiario, registro.regional, registro.assunto, registro.data_vencimento, registro.concluida, registro.criado_em]);
            }
            await destinoClient.query("SELECT setval(pg_get_serial_sequence('demandas','id'), COALESCE((SELECT MAX(id) FROM demandas), 1), EXISTS(SELECT 1 FROM demandas))");
            const copiados = (await destinoClient.query(`${selecionar} ORDER BY id`)).rows;
            if (hash(copiados) !== checksum) throw new Error("A conferencia dos registros nao coincidiu. Transferencia revertida.");
            await destinoClient.query("COMMIT");
        } catch (erro) { await destinoClient.query("ROLLBACK").catch(() => {}); throw erro; }
        finally { destinoClient.release(); }

        const token = randomBytes(32).toString("hex");
        servidor = http.createServer((req, res) => {
            const enviado = req.headers["x-transferencia"];
            const autorizado = typeof enviado === "string" && enviado.length === token.length && timingSafeEqual(Buffer.from(enviado), Buffer.from(token));
            if (!autorizado || req.headers.origin) { res.writeHead(403); res.end(); return; }
            res.setHeader("Content-Type", "application/json");
            if (req.method === "POST" && req.url === "/concluir") {
                res.end(JSON.stringify({ liberado: true }));
                void encerrar().then(() => process.exit(0));
            } else { res.end(JSON.stringify({ etapa: "copiado_origem_protegida", quantidade: registros.length, sha256: checksum })); }
        });
        await new Promise((resolve, reject) => { servidor.once("error", reject); servidor.listen(0, "127.0.0.1", resolve); });
        fs.writeFileSync(controle, JSON.stringify({ porta: servidor.address().port, token, pid: process.pid, quantidade: registros.length, sha256: checksum }), { mode: 0o600 });
        timer = setTimeout(() => { console.error("Janela de atualizacao encerrada; origem liberada automaticamente."); void encerrar().then(() => process.exit(2)); }, 20 * 60 * 1000);
        process.on("SIGINT", () => void encerrar().then(() => process.exit(0)));
        process.on("SIGTERM", () => void encerrar().then(() => process.exit(0)));
        console.log(JSON.stringify({ etapa: "copiado_origem_protegida", quantidade: registros.length, sha256: checksum, controle: "backups/transferencia-em-andamento.json" }));
    } catch (erro) {
        await encerrar();
        throw erro;
    }
}
main().catch((erro) => { console.error("Transferencia nao concluida:", erro.code || erro.message); process.exitCode = 1; });
