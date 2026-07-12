const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");
const demandaRoutes = require("./routes/demandaRoutes");

const app = express();

/* ===========================
   CONFIGURAÇÕES
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

        console.log("✅ Banco de dados conectado.");

    })

    .catch((erro) => {

        console.error("❌ Erro ao conectar ao banco:");

        console.error(erro);

    });

/* ===========================
   SERVIDOR
=========================== */

const PORT = process.env.PORT || 3001;

app.listen(PORT, "0.0.0.0", () => {

    console.log("\n======================================");

    console.log("🚀 Sistema de Demandas iniciado");

    console.log(`🌐 Local: http://localhost:${PORT}`);

    console.log(`📡 Rede : http://192.168.0.8:${PORT}`);

    console.log("======================================\n");

});