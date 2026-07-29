const express = require("express");
const os = require("os");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");
const demandaRoutes = require("./routes/demandaRoutes");

const app = express();

/* ===========================
   CONFIGURAÃ‡Ã•ES
=========================== */

app.use(cors());

app.use(express.json());

app.use(express.static("public"));

/* ===========================
   ROTAS
=========================== */

app.use("/demandas", demandaRoutes);

/* ===========================
   ROTA PRINCIPAL
=========================== */

app.get("/", (req, res) => {

    res.sendFile(__dirname + "/public/index.html");

});

/* ===========================
   TESTE DA API
=========================== */

app.get("/api", (req, res) => {

    res.json({

        status: "online",

        mensagem: "API funcionando."

    });

});

/* ===========================
   BANCO DE DADOS
=========================== */

db.connect()

    .then(() => {

        console.log("Banco de dados conectado.");

    })

    .catch((erro) => {

        console.error("Erro ao conectar ao banco:");

        console.error(erro);

    });

function obterIpDaRede() {
    const redes = os.networkInterfaces();

    for (const interfaces of Object.values(redes)) {
        const rede = interfaces.find((item) => item.family === "IPv4" && !item.internal);

        if (rede) {
            return rede.address;
        }
    }

    return "localhost";
}
/* ===========================
   SERVIDOR
=========================== */

const isDev = process.env.npm_lifecycle_event === "dev";
const PORT = isDev ? 4000 : process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {

    console.log("\n======================================");

    console.log("Sistema de Demandas iniciado");

    console.log(`Local: http://localhost:${PORT}`);

    console.log(`Rede : http://${obterIpDaRede()}:${PORT}`);

    console.log("======================================\n");

});


