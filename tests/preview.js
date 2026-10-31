// Previa descartavel para conferir a interface sem carregar .env ou usar o Neon.
const { iniciarPostgresTemporario } = require("./helpers/postgres");

(async () => {
    const banco = await iniciarPostgresTemporario();
    process.env.DATABASE_URL = banco.url;
    process.env.DATABASE_SSL = "false";
    process.env.NODE_ENV = "test";
    process.env.TRUST_PROXY_HOPS = "0";
    process.env.PAGBANK_LINK_MENSAL = "";
    process.env.PAGBANK_LINK_ANUAL = "";
    const app = require("../app");
    const db = require("../config/db");
    const servidor = app.listen(4173, "127.0.0.1", () => {
        console.log("API de verificacao isolada: http://localhost:4173");
    });
    let encerrando = false;
    const encerrar = async () => {
        if (encerrando) return;
        encerrando = true;
        servidor.closeAllConnections();
        await new Promise((resolve) => servidor.close(resolve));
        await db.end();
        await banco.encerrar();
        process.exit(0);
    };
    servidor.on("error", async () => {
        console.error("Nao foi possivel abrir a porta da previa.");
        await db.end();
        await banco.encerrar();
        process.exit(1);
    });
    process.on("SIGINT", () => void encerrar());
    process.on("SIGTERM", () => void encerrar());
})().catch((erro) => {
    console.error("Previa indisponivel:", erro.code || erro.message);
    process.exit(1);
});
