const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
const hasSeparateConfig = [
    process.env.DB_HOST,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    process.env.DB_NAME,
].every(Boolean);

const pool = new Pool({
    connectionTimeoutMillis: 10000,
    ...(connectionString
        ? { connectionString }
        : {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        }),
    ...(process.env.DATABASE_SSL !== "false"
        ? { ssl: { rejectUnauthorized: true } }
        : {}),
});

pool.hasConfig = Boolean(connectionString || hasSeparateConfig);

pool.on("error", (erro) => {
    console.error("Conexao inativa do banco encerrada:", erro.code || "erro de conexao");
});

module.exports = pool;
