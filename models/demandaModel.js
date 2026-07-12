const db = require("../config/db");

/* ===========================
   CRIAR
=========================== */

async function criarDemanda(numero_demanda, assunto, data_vencimento) {

    const sql = `
        INSERT INTO demandas
        (
            numero_demanda,
            assunto,
            data_vencimento
        )
        VALUES
        ($1, $2, $3)
        RETURNING *;
    `;

    const resultado = await db.query(sql, [
        numero_demanda,
        assunto,
        data_vencimento
    ]);

    return resultado.rows[0];

}

/* ===========================
   LISTAR
=========================== */

async function listarDemandas() {

    const sql = `
        SELECT
            id,
            numero_demanda,
            assunto,
            TO_CHAR(data_vencimento, 'YYYY-MM-DD') AS data_vencimento
        FROM demandas
        ORDER BY data_vencimento ASC;
    `;

    const resultado = await db.query(sql);

    console.log(resultado.rows);

    return resultado.rows;

}

/* ===========================
   EXCLUIR
=========================== */

async function excluirDemanda(id) {

    const sql = `
        DELETE FROM demandas
        WHERE id = $1
        RETURNING *;
    `;

    const resultado = await db.query(sql, [id]);

    return resultado.rows[0];

}

/* ===========================
   ATUALIZAR
=========================== */

async function atualizarDemanda(id, numero_demanda, assunto, data_vencimento) {

    const sql = `
        UPDATE demandas
        SET
            numero_demanda = $1,
            assunto = $2,
            data_vencimento = $3
        WHERE id = $4
        RETURNING *;
    `;

    const resultado = await db.query(sql, [
        numero_demanda,
        assunto,
        data_vencimento,
        id
    ]);

    return resultado.rows[0];

}

/* ===========================
   VENCENDO AMANHÃ
=========================== */

async function buscarDemandasVencendoAmanha() {

    const sql = `
        SELECT
            id,
            numero_demanda,
            assunto,
            TO_CHAR(data_vencimento, 'YYYY-MM-DD') AS data_vencimento
        FROM demandas
        WHERE data_vencimento = CURRENT_DATE + INTERVAL '1 day'
        ORDER BY data_vencimento;
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