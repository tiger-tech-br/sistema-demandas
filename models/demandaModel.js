const db = require("../config/db");
const inicializarBanco = require("../config/initDb");

let bancoInicializado = false;

async function garantirBanco() {
    if (bancoInicializado) {
        return;
    }

    await inicializarBanco();
    bancoInicializado = true;
}

async function criarDemanda(numero_demanda, beneficiario, regional, assunto, data_vencimento, concluida = false) {
    await garantirBanco();

    const sql = `
        INSERT INTO demandas
        (
            numero_demanda,
            beneficiario,
            regional,
            assunto,
            data_vencimento,
            concluida
        )
        VALUES
        ($1, $2, $3, $4, $5, $6)
        RETURNING
            id,
            numero_demanda,
            beneficiario,
            regional,
            assunto,
            TO_CHAR(data_vencimento, 'YYYY-MM-DD') AS data_vencimento,
            concluida;
    `;

    const resultado = await db.query(sql, [
        numero_demanda,
        beneficiario,
        regional,
        assunto,
        data_vencimento,
        concluida
    ]);

    return resultado.rows[0];
}

async function listarDemandas() {
    await garantirBanco();

    const sql = `
        SELECT
            id,
            numero_demanda,
            beneficiario,
            regional,
            assunto,
            TO_CHAR(data_vencimento, 'YYYY-MM-DD') AS data_vencimento,
            concluida
        FROM demandas
        ORDER BY data_vencimento ASC, id ASC;
    `;

    const resultado = await db.query(sql);

    return resultado.rows;
}

async function excluirDemanda(id) {
    await garantirBanco();

    const sql = `
        DELETE FROM demandas
        WHERE id = $1
        RETURNING *;
    `;

    const resultado = await db.query(sql, [id]);

    return resultado.rows[0];
}

async function atualizarDemanda(id, numero_demanda, beneficiario, regional, assunto, data_vencimento, concluida = false) {
    await garantirBanco();

    const sql = `
        UPDATE demandas
        SET
            numero_demanda = $1,
            beneficiario = $2,
            regional = $3,
            assunto = $4,
            data_vencimento = $5,
            concluida = $6
        WHERE id = $7
        RETURNING
            id,
            numero_demanda,
            beneficiario,
            regional,
            assunto,
            TO_CHAR(data_vencimento, 'YYYY-MM-DD') AS data_vencimento,
            concluida;
    `;

    const resultado = await db.query(sql, [
        numero_demanda,
        beneficiario,
        regional,
        assunto,
        data_vencimento,
        concluida,
        id
    ]);

    return resultado.rows[0];
}

async function buscarDemandasVencendoAmanha() {
    await garantirBanco();

    const sql = `
        SELECT
            id,
            numero_demanda,
            beneficiario,
            regional,
            assunto,
            TO_CHAR(data_vencimento, 'YYYY-MM-DD') AS data_vencimento,
            concluida
        FROM demandas
        WHERE data_vencimento = (
            (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date + 1
        )
        AND concluida = false
        ORDER BY data_vencimento ASC, id ASC;
    `;

    const resultado = await db.query(sql);

    return resultado.rows;
}

module.exports = {
    criarDemanda,
    listarDemandas,
    excluirDemanda,
    atualizarDemanda,
    buscarDemandasVencendoAmanha
};
