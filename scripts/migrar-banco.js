require("../config/env");
const db = require("../config/db");
const inicializarBanco = require("../config/initDb");

inicializarBanco()
    .then(() => console.log("Estrutura do banco atualizada com sucesso."))
    .catch((erro) => {
        console.error("Nao foi possivel atualizar o banco:", erro.code || erro.codigo || "falha de conexao");
        process.exitCode = 1;
    })
    .finally(() => db.end());
