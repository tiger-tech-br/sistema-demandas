const dbPadrao = require("../config/db");
const inicializarBanco = require("../config/initDb");
const { obterConfiguracaoEmail, enviarEmailResend } = require("./emailService");

const MARCADOR_APP_URL = "{{SISTEMA_DEMANDAS_APP_URL}}";
const MAXIMO_TENTATIVAS = 6;

function escaparHtml(valor) {
    return String(valor).replace(/[&<>"']/g, caractere => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[caractere]);
}

function dataValida(valor) {
    if (!valor) return null;
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? null : data;
}

function criarServicoNotificacoes({ db = dbPadrao, transporteEmail = enviarEmailResend, configuracaoEmail } = {}) {
    if (typeof db?.query !== "function" || typeof transporteEmail !== "function") throw new TypeError("Servico de notificacoes invalido.");
    const carregarConfiguracao = () => configuracaoEmail === undefined
        ? obterConfiguracaoEmail()
        : configuracaoEmail && obterConfiguracaoEmail({
            RESEND_API_KEY: configuracaoEmail.apiKey,
            RESEND_FROM: configuracaoEmail.from,
            APP_URL: configuracaoEmail.appUrl,
            NODE_ENV: process.env.NODE_ENV
        });
    let emAndamento;
    let pararWorker;

    async function enfileirarConfirmacaoCancelamento(client, usuario) {
        const confirmadoEm = dataValida(usuario?.cancelamento_confirmado_em);
        const acessoAte = dataValida(usuario?.assinatura_expira_em);
        if (typeof client?.query !== "function" || !Number.isSafeInteger(usuario?.id) || usuario.id < 1 ||
            !confirmadoEm || !acessoAte || typeof usuario.email !== "string" || usuario.email.length > 254 ||
            !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(usuario.email)) {
            throw new Error("CANCELAMENTO_EMAIL_DADOS_INVALIDOS");
        }
        const nome = String(usuario.nome || "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 120);
        const dataAcesso = new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo"
        }).format(acessoAte);
        const appUrl = carregarConfiguracao()?.appUrl || MARCADOR_APP_URL;
        const assunto = "Cancelamento confirmado - Sistema de Demandas";
        const texto = `Ola ${nome},\n\nO cancelamento da sua assinatura foi confirmado apos a conferencia do responsavel.\nSeu acesso permanece disponivel ate ${dataAcesso} (horario de Brasilia).\n\nPara voltar a usar apos esse prazo, faca uma nova contratacao pelo aplicativo.\nAcesse sua conta: ${appUrl}\n\nSuporte: tigertechbr@outlook.com`;
        const html = `<p>Ola ${escaparHtml(nome)},</p><p>O cancelamento da sua assinatura foi confirmado apos a conferencia do responsavel.</p><p>Seu acesso permanece disponivel ate <strong>${escaparHtml(dataAcesso)}</strong> (horario de Brasilia).</p><p>Para voltar a usar apos esse prazo, faca uma nova contratacao pelo aplicativo.</p><p><a href="${escaparHtml(appUrl)}">Acessar minha conta</a></p><p>Suporte: tigertechbr@outlook.com</p>`;
        // Esta escrita pertence a mesma transacao da confirmacao administrativa.
        // A unicidade preserva o primeiro conteudo em chamadas repetidas.
        const resultado = await client.query(`INSERT INTO notificacoes_email
            (usuario_id, evento, chave_unica, destinatario, assunto, texto, html)
            VALUES ($1, 'cancelamento_confirmado', $2, $3, $4, $5, $6)
            ON CONFLICT (chave_unica) DO UPDATE SET chave_unica = EXCLUDED.chave_unica
            RETURNING id`, [usuario.id, `cancelamento:${usuario.id}:${confirmadoEm.toISOString()}`, usuario.email, assunto, texto, html]);
        return resultado.rows[0].id;
    }

    async function enviarReservada(notificacao, configuracao) {
        try {
            await transporteEmail({
                to: [notificacao.destinatario], subject: notificacao.assunto,
                text: notificacao.texto, html: notificacao.html
            }, configuracao, { idempotencyKey: `notificacao-email/${notificacao.id}` });
            const resultado = await db.query(`UPDATE notificacoes_email
                SET status = 'enviado', enviado_em = clock_timestamp(), bloqueado_ate = NULL, erro_codigo = NULL
                WHERE id = $1 AND status = 'processando' AND tentativas = $2`, [notificacao.id, notificacao.tentativas]);
            return resultado.rowCount ? "enviada" : "ignorada";
        } catch {
            const esperaSegundos = Math.min(3600, 60 * (2 ** (Number(notificacao.tentativas) - 1)));
            await db.query(`UPDATE notificacoes_email
                SET status = CASE WHEN tentativas >= $3 THEN 'falhou' ELSE 'pendente' END,
                    bloqueado_ate = NULL, erro_codigo = 'ENVIO_INDISPONIVEL',
                    proxima_tentativa_em = clock_timestamp() + ($4::integer * INTERVAL '1 second')
                WHERE id = $1 AND status = 'processando' AND tentativas = $2`,
            [notificacao.id, notificacao.tentativas, MAXIMO_TENTATIVAS, esperaSegundos])
                .catch(() => console.error("EMAIL_OUTBOX_PERSIST_FAILED"));
            console.error("EMAIL_OUTBOX_DELIVERY_FAILED");
            return "falha";
        }
    }

    async function executarRodada() {
        const configuracao = carregarConfiguracao();
        // Sem configuracao a fila permanece intacta, inclusive seu contador.
        if (!configuracao) return { reservadas: 0, enviadas: 0, falhas: 0, indisponivel: true };
        if (db === dbPadrao) await inicializarBanco();
        // Recupera tambem um processo que morreu durante sua ultima tentativa.
        await db.query(`UPDATE notificacoes_email
            SET status = 'falhou', bloqueado_ate = NULL, erro_codigo = 'TENTATIVAS_ESGOTADAS'
            WHERE status = 'processando' AND bloqueado_ate <= clock_timestamp() AND tentativas >= $1`, [MAXIMO_TENTATIVAS]);
        const resultado = await db.query(`WITH candidatas AS (
            SELECT id FROM notificacoes_email
            WHERE tentativas < $1 AND (
                (status = 'pendente' AND proxima_tentativa_em <= clock_timestamp()) OR
                (status = 'processando' AND bloqueado_ate <= clock_timestamp())
            )
            ORDER BY proxima_tentativa_em, id
            LIMIT 10 FOR UPDATE SKIP LOCKED
        )
        UPDATE notificacoes_email n
        SET status = 'processando', tentativas = n.tentativas + 1,
            bloqueado_ate = clock_timestamp() + INTERVAL '60 seconds', erro_codigo = NULL,
            texto = replace(n.texto, $2, $3), html = replace(n.html, $2, $4)
        FROM candidatas c WHERE n.id = c.id
        RETURNING n.id, n.destinatario, n.assunto, n.texto, n.html, n.tentativas`,
        [MAXIMO_TENTATIVAS, MARCADOR_APP_URL, configuracao.appUrl, escaparHtml(configuracao.appUrl)]);
        const resumo = { reservadas: resultado.rows.length, enviadas: 0, falhas: 0, indisponivel: false };
        // Duas entregas simultaneas; dez chamadas com timeout de 10 s cabem
        // na reserva de 60 s. A tentativa serve como cerca para reservas antigas.
        let indice = 0;
        async function entregarProxima() {
            while (indice < resultado.rows.length) {
                const notificacao = resultado.rows[indice++];
                const status = await enviarReservada(notificacao, configuracao);
                if (status === "enviada") resumo.enviadas++;
                if (status === "falha") resumo.falhas++;
            }
        }
        await Promise.all([entregarProxima(), entregarProxima()]);
        return resumo;
    }

    function processarFila() {
        if (!emAndamento) emAndamento = executarRodada().finally(() => { emAndamento = undefined; });
        return emAndamento;
    }

    function aguardarPendentes() {
        return emAndamento || Promise.resolve();
    }

    function iniciarNotificacoes({ intervaloMs = 30000 } = {}) {
        if (pararWorker) return pararWorker;
        if (!Number.isSafeInteger(intervaloMs) || intervaloMs < 1000 || intervaloMs > 300000) throw new TypeError("Intervalo de notificacoes invalido.");
        const executar = () => { processarFila().catch(() => console.error("EMAIL_OUTBOX_WORKER_FAILED")); };
        const timer = setInterval(executar, intervaloMs);
        timer.unref?.();
        executar();
        pararWorker = async () => {
            clearInterval(timer);
            pararWorker = undefined;
            await aguardarPendentes().catch(() => {});
        };
        return pararWorker;
    }

    return { enfileirarConfirmacaoCancelamento, processarFila, iniciarNotificacoes, aguardarPendentes };
}

module.exports = { ...criarServicoNotificacoes(), criarServicoNotificacoes };
