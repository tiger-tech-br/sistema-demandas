const express = require("express");
const os = require("os");
const path = require("path");

const app = express();
const isDev = process.env.npm_lifecycle_event === "dev";
const PORT = isDev ? 4000 : process.env.PORT || 4000;
const publicPath = path.join(__dirname, "public");

app.use(express.static(publicPath));

app.use((req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
});

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
    console.log(`🌐 Local: http://localhost:${PORT}`);
    console.log(`📡 Rede : http://${obterIpDaRede()}:${PORT}`);
});
