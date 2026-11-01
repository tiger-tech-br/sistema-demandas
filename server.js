require("./config/env");

const os = require("os");
const app = require("./app");
const { iniciarNotificacoes } = require("./services/notificacaoService");
const PORT = process.env.PORT || 4000;

function obterIpDaRede() {
    const redes = os.networkInterfaces();

    for (const interfaces of Object.values(redes)) {
        const rede = interfaces.find((item) => (
            item.family === "IPv4" && !item.internal
        ));

        if (rede) {
            return rede.address;
        }
    }

    return "localhost";
}

app.listen(PORT, "0.0.0.0", () => {
    iniciarNotificacoes();
    console.log(`🌐 Local: http://localhost:${PORT}`);
    console.log(`📡 Rede : http://${obterIpDaRede()}:${PORT}`);
});
