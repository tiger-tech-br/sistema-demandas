const { spawnSync } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

async function portaLivre() {
    const server = net.createServer();
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    const porta = server.address().port;
    await new Promise((resolve, reject) => server.close((erro) => erro ? reject(erro) : resolve()));
    return porta;
}

function executar(binario, args, ambiente, { silencioso = false, permitirFalha = false, timeoutMs = 45000 } = {}) {
    const resultado = spawnSync(binario, args, {
        env: ambiente,
        encoding: "utf8",
        windowsHide: true,
        ...(silencioso ? { stdio: "ignore" } : {}),
        timeout: timeoutMs,
        maxBuffer: 2 * 1024 * 1024
    });

    if (!permitirFalha && (resultado.error || resultado.status !== 0)) {
        throw new Error(
            `Falha ao executar ${path.basename(binario)}: ${resultado.error?.message || resultado.stderr || resultado.stdout}`
        );
    }
    return resultado;
}

async function iniciarPostgresTemporario() {
    const pastaBin = process.env.POSTGRES_BIN || (process.platform === "win32"
        ? "C:\\Program Files\\PostgreSQL\\18\\bin"
        : "");
    const executavel = (nome) => pastaBin
        ? path.join(pastaBin, `${nome}${process.platform === "win32" ? ".exe" : ""}`)
        : nome;
    const raizTemporaria = path.resolve(os.tmpdir());
    const diretorio = await fs.mkdtemp(path.join(raizTemporaria, "sistema-demandas-test-"));
    const dados = path.join(diretorio, "dados");
    const porta = await portaLivre();
    const ambiente = { ...process.env, PGCONNECT_TIMEOUT: "5" };

    for (const chave of Object.keys(ambiente)) {
        if (chave.startsWith("PG") && chave !== "PGCONNECT_TIMEOUT") delete ambiente[chave];
        if (chave === "DATABASE_URL" || chave.startsWith("DB_")) delete ambiente[chave];
    }

    let inicioTentado = false;

    async function encerrar() {
        if (inicioTentado) {
            const status = executar(executavel("pg_ctl"), ["-D", dados, "status"], ambiente, { silencioso: true, permitirFalha: true });
            if (status.status === 0) {
                executar(executavel("pg_ctl"), ["-D", dados, "-m", "immediate", "-w", "stop"], ambiente, { silencioso: true });
            } else if (status.error || status.status !== 3) {
                throw new Error("Nao foi possivel confirmar que o PostgreSQL temporario encerrou; os dados temporarios foram preservados.");
            }
            inicioTentado = false;
        }

        const caminhoResolvido = path.resolve(diretorio);
        if (path.dirname(caminhoResolvido) !== raizTemporaria || !path.basename(caminhoResolvido).startsWith("sistema-demandas-test-")) {
            throw new Error("Diretório temporário inesperado; limpeza recusada.");
        }
        await fs.rm(caminhoResolvido, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }

    try {
        // Banco estritamente descartavel: dispensa fsync de inicializacao e
        // tolera a verificacao de arquivos pelo antivirus do Windows.
        executar(executavel("initdb"), ["-D", dados, "-U", "postgres", "-A", "trust", "--no-locale", "--encoding=UTF8", "--no-sync"], ambiente, { silencioso: true, timeoutMs: 180000 });
        inicioTentado = true;
        // O processo postgres herda pipes do pg_ctl no Windows e pode manter
        // spawnSync preso mesmo depois de pg_ctl sair. O servidor usa seu log.
        executar(executavel("pg_ctl"), [
            "-D", dados,
            "-l", path.join(diretorio, "postgres.log"),
            "-o", `-h 127.0.0.1 -p ${porta} -F`,
            "-w", "start"
        ], ambiente, { silencioso: true });

        return {
            url: `postgresql://postgres@127.0.0.1:${porta}/postgres`,
            encerrar
        };
    } catch (erro) {
        try {
            await encerrar();
        } catch (erroLimpeza) {
            erro.message += `\nLimpeza temporaria: ${erroLimpeza.message}`;
        }
        throw erro;
    }
}

module.exports = { iniciarPostgresTemporario };
