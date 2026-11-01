const db = require("./db");

let inicializacao;

async function executarMigracao() {
    if (!db.hasConfig) {
        const erro = new Error("Configure DATABASE_URL ou DB_HOST, DB_USER, DB_PASSWORD e DB_NAME para usar o sistema.");
        erro.status = 503;
        erro.codigo = "BANCO_NAO_CONFIGURADO";
        throw erro;
    }
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        // Serializa a migracao inclusive entre varias instancias do servidor.
        await client.query("SELECT pg_advisory_xact_lock(715120261)");
        await client.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(120) NOT NULL,
                email VARCHAR(254) NOT NULL UNIQUE,
                senha_hash TEXT NOT NULL,
                criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                teste_iniciado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                teste_expira_em TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '720 hours'),
                assinatura_plano VARCHAR(10) CHECK (assinatura_plano IN ('mensal', 'anual')),
                assinatura_expira_em TIMESTAMPTZ,
                CONSTRAINT usuarios_email_normalizado CHECK (email = LOWER(email))
            );
            CREATE TABLE IF NOT EXISTS sessoes (
                token_hash CHAR(64) PRIMARY KEY,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                expira_em TIMESTAMPTZ NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sessoes_expira_em ON sessoes (expira_em);
            CREATE TABLE IF NOT EXISTS redefinicoes_senha (
                token_hash CHAR(64) PRIMARY KEY,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                expira_em TIMESTAMPTZ NOT NULL,
                usado_em TIMESTAMPTZ
            );
            CREATE INDEX IF NOT EXISTS idx_redefinicoes_usuario ON redefinicoes_senha (usuario_id, expira_em);
            ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS papel VARCHAR(20) NOT NULL DEFAULT 'profissional';
            ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_em TIMESTAMPTZ;
            ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS acesso_permanente BOOLEAN NOT NULL DEFAULT false;
            ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS termos_versao VARCHAR(30);
            ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS termos_aceitos_em TIMESTAMPTZ;
            ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS boas_vindas_em TIMESTAMPTZ;
            ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cancelamento_solicitado_em TIMESTAMPTZ;
            ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cancelamento_confirmado_em TIMESTAMPTZ;
            ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cancelamento_referencia VARCHAR(120);
            CREATE TABLE IF NOT EXISTS acoes_administrativas (
                id SERIAL PRIMARY KEY,
                administrador_id INTEGER NOT NULL REFERENCES usuarios(id),
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
                acao VARCHAR(40) NOT NULL,
                detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
                criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS ativacoes_assinatura (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
                referencia VARCHAR(120) NOT NULL UNIQUE,
                plano VARCHAR(10) NOT NULL CHECK (plano IN ('mensal', 'anual')),
                valor_centavos INTEGER NOT NULL,
                acesso_ate TIMESTAMPTZ NOT NULL,
                ativado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS auth_limites (
                chave CHAR(64) PRIMARY KEY,
                inicio_janela TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                tentativas INTEGER NOT NULL DEFAULT 1
            );
            CREATE TABLE IF NOT EXISTS solicitacoes_privacidade (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
                tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('acesso', 'correcao', 'exclusao', 'outro')),
                status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'respondida')),
                descricao TEXT NOT NULL,
                criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                resposta TEXT,
                respondido_em TIMESTAMPTZ,
                administrador_id INTEGER REFERENCES usuarios(id)
            );
            CREATE INDEX IF NOT EXISTS idx_privacidade_usuario ON solicitacoes_privacidade (usuario_id, criado_em DESC);
            CREATE TABLE IF NOT EXISTS notificacoes_email (
                id BIGSERIAL PRIMARY KEY,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
                evento VARCHAR(40) NOT NULL,
                chave_unica VARCHAR(160) NOT NULL UNIQUE,
                destinatario VARCHAR(254) NOT NULL,
                assunto VARCHAR(160) NOT NULL,
                texto TEXT NOT NULL,
                html TEXT NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'enviado', 'falhou')),
                tentativas INTEGER NOT NULL DEFAULT 0,
                proxima_tentativa_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                bloqueado_ate TIMESTAMPTZ,
                enviado_em TIMESTAMPTZ,
                criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                erro_codigo VARCHAR(40)
            );
            CREATE INDEX IF NOT EXISTS idx_notificacoes_fila ON notificacoes_email (status, proxima_tentativa_em);
            CREATE TABLE IF NOT EXISTS demandas (
                id SERIAL PRIMARY KEY,
                numero_demanda VARCHAR(20),
                beneficiario VARCHAR(120),
                regional VARCHAR(40),
                assunto VARCHAR(120),
                data_vencimento DATE,
                concluida BOOLEAN DEFAULT false,
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE demandas ADD COLUMN IF NOT EXISTS numero_demanda VARCHAR(20);
            ALTER TABLE demandas ADD COLUMN IF NOT EXISTS beneficiario VARCHAR(120);
            ALTER TABLE demandas ADD COLUMN IF NOT EXISTS regional VARCHAR(40);
            ALTER TABLE demandas ADD COLUMN IF NOT EXISTS assunto VARCHAR(120);
            ALTER TABLE demandas ADD COLUMN IF NOT EXISTS data_vencimento DATE;
            ALTER TABLE demandas ADD COLUMN IF NOT EXISTS concluida BOOLEAN DEFAULT false;
            ALTER TABLE demandas ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            -- NULL preserva o legado sem atribui-lo a cadastros publicos.
            ALTER TABLE demandas ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id);
            CREATE INDEX IF NOT EXISTS idx_demandas_usuario_vencimento ON demandas (usuario_id, data_vencimento, id);
        `);
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'usuarios_papel_valido' AND conrelid = 'usuarios'::regclass
                ) THEN
                    ALTER TABLE usuarios ADD CONSTRAINT usuarios_papel_valido
                    CHECK (papel IN ('profissional', 'admin'));
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'chk_numero_demanda_numerico'
                      AND conrelid = 'demandas'::regclass
                ) THEN
                    ALTER TABLE demandas ADD CONSTRAINT chk_numero_demanda_numerico
                    CHECK (numero_demanda ~ '^[0-9]+$');
                END IF;
            END
            $$;
        `);
        await client.query("COMMIT");
    } catch (erro) {
        await client.query("ROLLBACK").catch(() => {});
        throw erro;
    } finally {
        client.release();
    }
}

function inicializarBanco() {
    if (!inicializacao) {
        inicializacao = executarMigracao().catch((erro) => {
            inicializacao = undefined;
            throw erro;
        });
    }
    return inicializacao;
}

module.exports = inicializarBanco;
