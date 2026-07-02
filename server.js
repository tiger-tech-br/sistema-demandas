const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");
const demandaRoutes = require("./routes/demandaRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Arquivos estáticos
app.use(express.static("public"));

// Rotas da API
app.use("/demandas", demandaRoutes);

db.connect()
    .then(() => {
        console.log("Banco de dados conectado com sucesso!");
    })
    .catch((err) => {
        console.error("Erro ao conectar ao banco:", err);
    });

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {

    console.log("=====================================");
    console.log("Servidor iniciado com sucesso!");
    console.log(`http://localhost:${PORT}`);
    console.log(`http://192.168.0.8:${PORT}`);
    console.log("=====================================");

});