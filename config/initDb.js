const db = require("./db");

async function inicializarBanco() {
    if (!db.hasConfig) {
        console.warn("Banco de dados nao configurado. A API ficara indisponivel.");
        return;
    }

    await db.query(`
        CREATE TABLE IF NOT EXISTS demandas (
            id SERIAL PRIMARY KEY,
            numero_demanda VARCHAR(20),
            assunto VARCHAR(120),
            data_vencimento DATE,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await db.query(`
        ALTER TABLE demandas
        ADD COLUMN IF NOT EXISTS numero_demanda VARCHAR(20);
    `);

    await db.query(`
        ALTER TABLE demandas
        ADD COLUMN IF NOT EXISTS assunto VARCHAR(120);
    `);

    await db.query(`
        ALTER TABLE demandas
        ADD COLUMN IF NOT EXISTS data_vencimento DATE;
    `);

    await db.query(`
        ALTER TABLE demandas
        ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await db.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'chk_numero_demanda_numerico'
            ) THEN
                ALTER TABLE demandas
                ADD CONSTRAINT chk_numero_demanda_numerico
                CHECK (numero_demanda ~ '^[0-9]+$');
            END IF;
        END
        $$;
    `);

    await db.query(`
        CREATE INDEX IF NOT EXISTS idx_demandas_data_vencimento
        ON demandas (data_vencimento);
    `);

    console.log("Tabela demandas verificada/criada com sucesso.");
}

module.exports = inicializarBanco;
