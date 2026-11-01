const { randomBytes, createHash } = require("node:crypto");
const db = require("../config/db");
const inicializarBanco = require("../config/initDb");
const { criarHash } = require("../security/senha");
const { obterConfiguracaoEmail, enviarEmailResend } = require("./emailService");

const TOKEN_VALIDO = /^[a-f0-9]{64}$/;
const MENSAGEM_SOLICITACAO = "Se houver uma conta com esse e-mail, voce recebera um link para redefinir sua senha.";
const MENSAGEM_TOKEN_INVALIDO = "O link de redefinicao e invalido ou expirou. Solicite um novo link.";

function emailValido(email) {
    return typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function senhaValida(senha) {
    return typeof senha === "string" && senha.length >= 10 && senha.length <= 128;
}

function hashToken(token) {
    return createHash("sha256").update(token).digest("hex");
}

function escaparHtml(valor) {
    return String(valor).replace(/[&<>"']/g, caractere => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[caractere]);
}

// A injecao existe apenas nesta funcao JavaScript para testes. HTTP e variaveis
// de ambiente nunca selecionam outro transporte ou endpoint do provedor.
function criarServicoRedefinicao({ transporteEmail = enviarEmailResend, configuracaoEmail } = {}) {
    if (typeof transporteEmail !== "function") throw new TypeError("Transporte de e-mail invalido.");
    // Configuracao explicita para os testes da factory, validada pelos mesmos
    // criterios da configuracao real; nunca recebida por rota ou query string.
    const carregarConfiguracao = configuracaoEmail
        ? () => obterConfiguracaoEmail({
            RESEND_API_KEY: configuracaoEmail.apiKey,
            RESEND_FROM: configuracaoEmail.from,
            APP_URL: configuracaoEmail.appUrl,
            NODE_ENV: process.env.NODE_ENV
        })
        : () => obterConfiguracaoEmail();
    const fila = [];
    const esperas = [];
    let ativos = 0;
    let processamentoAgendado = false;

    function disponibilidade() {
        return Boolean(carregarConfiguracao());
    }

    async function processarSolicitacao(email, configuracao) {
        await inicializarBanco();
        const client = await db.connect();
        let usuario;
        let token;
        let tokenHash;
        try {
            await client.query("BEGIN");
            // Mesmo bloqueio da redefinicao: emissoes e usos concorrentes da
            // mesma conta nao deixam um token anterior reutilizavel.
            usuario = (await client.query("SELECT id, nome, email FROM usuarios WHERE email = $1 FOR UPDATE", [email])).rows[0];
            if (usuario) {
                token = randomBytes(32).toString("hex");
                tokenHash = hashToken(token);
                await client.query(`INSERT INTO redefinicoes_senha (token_hash, usuario_id, expira_em)
                    VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '30 minutes')`, [tokenHash, usuario.id]);
            }
            await client.query("COMMIT");
        } catch (erro) {
            await client.query("ROLLBACK").catch(() => {});
            throw erro;
        } finally {
            client.release();
        }
        if (!usuario) return;
        const link = `${configuracao.appUrl}#redefinir_senha=${token}`;
        const nome = String(usuario.nome || "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 120);
        try {
            await transporteEmail({
                to: [usuario.email],
                subject: "Redefinicao de senha - Sistema de Demandas",
                text: `Ola ${nome},\n\nRecebemos uma solicitacao para redefinir sua senha no Sistema de Demandas.\nAbra este link, valido por 30 minutos e para um unico uso:\n${link}\n\nSe voce nao fez essa solicitacao, ignore esta mensagem. Sua senha permanece a mesma.\n\nSuporte: tigertechbr@outlook.com`,
                html: `<p>Ola ${escaparHtml(nome)},</p><p>Recebemos uma solicitacao para redefinir sua senha no Sistema de Demandas.</p><p><a href="${escaparHtml(link)}">Redefinir minha senha</a></p><p>Este link e valido por 30 minutos e para um unico uso.</p><p>Se voce nao fez essa solicitacao, ignore esta mensagem. Sua senha permanece a mesma.</p><p>Suporte: tigertechbr@outlook.com</p>`
            }, configuracao);
        } catch {
            // Uma falha/timeout de entrega nao deixa um token utilizavel no banco.
            await db.query("UPDATE redefinicoes_senha SET usado_em = clock_timestamp() WHERE token_hash = $1 AND usado_em IS NULL", [tokenHash]).catch(() => {});
            throw new Error("PASSWORD_RESET_EMAIL_FAILED");
        }
    }

    function finalizarSeOcioso() {
        if (!ativos && !fila.length && !processamentoAgendado) {
            while (esperas.length) esperas.shift()();
        }
    }

    function executarFila() {
        processamentoAgendado = false;
        while (ativos < 2 && fila.length) {
            const tarefa = fila.shift();
            ativos++;
            processarSolicitacao(tarefa.email, tarefa.configuracao)
                .catch(() => console.error("PASSWORD_RESET_DELIVERY_FAILED"))
                .finally(() => {
                    ativos--;
                    executarFila();
                    finalizarSeOcioso();
                });
        }
        finalizarSeOcioso();
    }

    function solicitarRedefinicao(email) {
        const configuracao = carregarConfiguracao();
        if (!configuracao) return false;
        if (!emailValido(email)) return false;
        if (fila.length >= 100) {
            console.error("PASSWORD_RESET_QUEUE_FULL");
            return true;
        }
        fila.push({ email: email.trim().toLowerCase(), configuracao });
        if (!processamentoAgendado) {
            processamentoAgendado = true;
            // Nenhuma consulta de conta ou chamada ao Resend atrasa a resposta HTTP.
            setImmediate(executarFila);
        }
        return true;
    }

    function aguardarPendentes() {
        if (!ativos && !fila.length && !processamentoAgendado) return Promise.resolve();
        return new Promise(resolve => esperas.push(resolve));
    }

    async function redefinirSenha({ token, senha } = {}) {
        if (typeof token !== "string" || !TOKEN_VALIDO.test(token) || !senhaValida(senha)) return false;
        const tokenHash = hashToken(token);
        const senhaHash = await criarHash(senha);
        await inicializarBanco();
        const client = await db.connect();
        try {
            await client.query("BEGIN");
            const registro = (await client.query("SELECT usuario_id FROM redefinicoes_senha WHERE token_hash = $1", [tokenHash])).rows[0];
            if (!registro) {
                await client.query("ROLLBACK");
                return false;
            }
            // A conta e bloqueada antes do token, inclusive quando dois links
            // diferentes chegam juntos; somente uma redefinicao pode vencer.
            const usuario = (await client.query("SELECT id FROM usuarios WHERE id = $1 FOR UPDATE", [registro.usuario_id])).rows[0];
            const valido = usuario && (await client.query(`UPDATE redefinicoes_senha SET usado_em = clock_timestamp()
                WHERE token_hash = $1 AND usuario_id = $2 AND usado_em IS NULL AND expira_em > clock_timestamp()
                RETURNING usuario_id`, [tokenHash, usuario.id])).rows[0];
            if (!valido) {
                await client.query("ROLLBACK");
                return false;
            }
            // Apenas a senha muda: papel, assinatura e dados da conta permanecem.
            await client.query("UPDATE usuarios SET senha_hash = $2 WHERE id = $1", [usuario.id, senhaHash]);
            await client.query("DELETE FROM sessoes WHERE usuario_id = $1", [usuario.id]);
            await client.query("UPDATE redefinicoes_senha SET usado_em = clock_timestamp() WHERE usuario_id = $1 AND usado_em IS NULL", [usuario.id]);
            await client.query("COMMIT");
            return true;
        } catch (erro) {
            await client.query("ROLLBACK").catch(() => {});
            throw erro;
        } finally {
            client.release();
        }
    }

    return { disponibilidade, solicitarRedefinicao, aguardarPendentes, redefinirSenha };
}

module.exports = { ...criarServicoRedefinicao(), criarServicoRedefinicao, emailValido, senhaValida, MENSAGEM_SOLICITACAO, MENSAGEM_TOKEN_INVALIDO };
