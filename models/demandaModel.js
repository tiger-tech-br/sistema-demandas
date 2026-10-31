const db = require("../config/db");
const inicializarBanco = require("../config/initDb");

async function garantirBanco() {
    await inicializarBanco();
}

async function criarDemanda(usuarioId, numero_demanda, beneficiario, regional, assunto, data_vencimento, concluida = false) {
    await garantirBanco();

    const sql = `
        INSERT INTO demandas
        (
            numero_demanda,
            beneficiario,
            regional,
            assunto,
            data_vencimento,
            concluida,
            usuario_id
        )
        VALUES
        ($1, $2, $3, $4, $5, $6, $7)
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
        usuarioId
    ]);

    return resultado.rows[0];
}

async function listarDemandas(usuarioId) {
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
        WHERE usuario_id = $1
        ORDER BY data_vencimento ASC, id ASC;
    `;

    const resultado = await db.query(sql, [usuarioId]);

    return resultado.rows;
}

async function excluirDemanda(usuarioId, id) {
    await garantirBanco();

    const sql = `
        DELETE FROM demandas
        WHERE id = $1 AND usuario_id = $2
        RETURNING *;
    `;

    const resultado = await db.query(sql, [id, usuarioId]);

    return resultado.rows[0];
}

async function atualizarDemanda(usuarioId, id, numero_demanda, beneficiario, regional, assunto, data_vencimento, concluida = false) {
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
        WHERE id = $7 AND usuario_id = $8
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
        id,
        usuarioId
    ]);

    return resultado.rows[0];
}

async function buscarDemandasVencendoAmanha(usuarioId) {
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
        WHERE usuario_id = $1 AND data_vencimento = (
            (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date + 1
        )
        AND concluida = false
        ORDER BY data_vencimento ASC, id ASC;
    `;

    const resultado = await db.query(sql, [usuarioId]);

    return resultado.rows;
}

module.exports = {
    criarDemanda,
    listarDemandas,
    excluirDemanda,
    atualizarDemanda,
    buscarDemandasVencendoAmanha
};
