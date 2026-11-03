const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { once } = require("node:events");
const { createHash, randomBytes } = require("node:crypto");
const { iniciarPostgresTemporario } = require("./helpers/postgres");

let cluster;
let db;
let app;
let server;
let base;
let alice;
let bruno;
let admin;
let carla;
let vencimento;

const senha = "Senha-de-teste-123";
const aceiteTermos = { aceite_termos: true, versao_termos: "2026-11-03" };

async function requisicao(caminho, { metodo = "GET", cookie, dados, headers = {} } = {}) {
    const resposta = await fetch(`${base}${caminho}`, {
        method: metodo,
        headers: {
            ...(dados !== undefined ? { "Content-Type": "application/json" } : {}),
            ...(cookie ? { Cookie: cookie } : {}),
            ...headers
        },
        ...(dados !== undefined ? { body: JSON.stringify(dados) } : {})
    });
    return { status: resposta.status, headers: resposta.headers, corpo: await resposta.json() };
}

async function cadastrar(nome, email, extras = {}) {
    const resposta = await requisicao("/auth/cadastro", { metodo: "POST", dados: { nome, email, senha, ...aceiteTermos, ...extras } });
    assert.equal(resposta.status, 201);
    return { ...resposta, cookie: resposta.headers.get("set-cookie").split(";")[0] };
}

function demanda(numero) {
    return {
        numero_demanda: numero,
        beneficiario: "Pessoa de teste",
        regional: "ABC",
        assunto: "Demanda de teste",
        data_vencimento: vencimento,
        concluida: false
    };
}

async function criarDemandaLixeira(cookie, dados) {
    const resposta = await requisicao("/demandas", { metodo: "POST", cookie, dados });
    assert.equal(resposta.status, 201);
    return resposta.corpo.demanda;
}

const tabelasDaConta = ["usuarios", "demandas", "sessoes", "redefinicoes_senha", "solicitacoes_privacidade", "ativacoes_assinatura", "notificacoes_email", "acoes_administrativas"];
async function registrosDaConta(usuarioId, outros = false) {
    return Object.fromEntries(await Promise.all(tabelasDaConta.map(async tabela => {
        const coluna = tabela === "usuarios" ? "id" : "usuario_id";
        const ordem = ["sessoes", "redefinicoes_senha"].includes(tabela) ? "token_hash" : "id";
        const resultado = await db.query(`SELECT * FROM ${tabela} WHERE ${coluna} ${outros ? "IS DISTINCT FROM" : "="} $1 ORDER BY ${ordem}`, [usuarioId]);
        return [tabela, resultado.rows];
    })));
}

async function comRecuperacao(executar, { configurado = true } = {}) {
    const { criarServicoRedefinicao } = require("../services/passwordResetService");
    const mensagens = [];
    const servico = criarServicoRedefinicao({
        transporteEmail: async (mensagem) => { mensagens.push(mensagem); },
        ...(configurado ? {
            configuracaoEmail: {
                apiKey: "re_teste_local",
                from: "Teste Local <nao-responda@example.invalid>",
                appUrl: "https://app.example.test/"
            }
        } : {})
    });
    const anterior = app.locals.servicoRedefinicao;
    app.locals.servicoRedefinicao = servico;
    // Isola os cenarios de rate limit, sem herdar tentativas dos testes anteriores.
    await db.query("DELETE FROM auth_limites");
    try {
        await executar({ servico, mensagens });
    } finally {
        await servico.aguardarPendentes();
        if (anterior) app.locals.servicoRedefinicao = anterior;
        else delete app.locals.servicoRedefinicao;
    }
}

async function solicitarToken(email, contexto) {
    const quantidade = contexto.mensagens.length;
    const resposta = await requisicao("/auth/esqueci-senha", { metodo: "POST", dados: { email } });
    assert.equal(resposta.status, 200);
    await contexto.servico.aguardarPendentes();
    assert.equal(contexto.mensagens.length, quantidade + 1);
    const texto = contexto.mensagens.at(-1).text;
    const token = extrairTokenRedefinicao(texto);
    // Mensagens de falha nunca incluem o link ou o token capturado.
    assert.ok(typeof token === "string" && /^[a-f0-9]{64}$/.test(token), "O e-mail deve conter um token aleatorio de 32 bytes.");
    return token;
}

function extrairTokenRedefinicao(texto) {
    const endereco = /https:\/\/app\.example\.test\/[^\s]*/.exec(texto)?.[0];
    assert.ok(endereco, "O e-mail deve incluir o endereco configurado para o aplicativo.");
    const link = new URL(endereco);
    assert.equal(link.search, "", "O token deve ficar no fragmento, fora da query HTTP.");
    return new URLSearchParams(link.hash.slice(1)).get("redefinir_senha");
}

before(async () => {
    cluster = await iniciarPostgresTemporario();
    // Este arquivo nunca carrega .env nem usa a conexao do aplicativo real.
    for (const chave of Object.keys(process.env)) {
        if (chave.startsWith("DB_") || chave.startsWith("PGBANK_") || chave.startsWith("PAGBANK_") || chave.startsWith("RESEND_") || chave === "APP_URL") delete process.env[chave];
    }
    process.env.DATABASE_URL = cluster.url;
    process.env.DATABASE_SSL = "false";
    process.env.NODE_ENV = "test";
    process.env.TRUST_PROXY_HOPS = "0";

    db = require("../config/db");
    // Reproduz o banco anterior ao SaaS para verificar migracao e legado sem dono.
    await db.query(`
        CREATE TABLE demandas (
            id SERIAL PRIMARY KEY, numero_demanda VARCHAR(20), beneficiario VARCHAR(120),
            regional VARCHAR(40), assunto VARCHAR(120), data_vencimento DATE,
            concluida BOOLEAN DEFAULT false, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO demandas (numero_demanda, beneficiario, regional, assunto, data_vencimento)
        VALUES ('999', 'Registro anterior', 'ABC', 'Legado privado', CURRENT_DATE + 1);
    `);
    vencimento = (await db.query("SELECT TO_CHAR((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date + 1, 'YYYY-MM-DD') AS data")).rows[0].data;
    app = require("../app");
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    base = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 240000 });

after(async () => {
    if (server) {
        server.closeAllConnections();
        await new Promise((resolve, reject) => server.close((erro) => erro ? reject(erro) : resolve()));
    }
    if (db) await db.end();
    if (cluster) await cluster.encerrar();
});

test("API SaaS: contas, isolamento, teste gratuito, cobranca e administracao", async (t) => {
    await t.test("rotas privadas exigem sessao e precos vem do servidor", async () => {
        for (const caminho of ["/demandas", "/demandas/vencendo-amanha", "/auth/me", "/cobranca/status"]) {
            assert.equal((await requisicao(caminho)).status, 401, caminho);
        }
        assert.equal((await requisicao("/cobranca/checkout", { metodo: "POST", dados: { plano: "mensal" } })).status, 401);
        const planos = await requisicao("/planos");
        assert.equal(planos.status, 200);
        assert.equal(planos.corpo.teste_dias, 30);
        assert.deepEqual(planos.corpo.planos.map(({ id, valor_centavos }) => ({ id, valor_centavos })), [
            { id: "mensal", valor_centavos: 3500 }, { id: "anual", valor_centavos: 35000 }
        ]);
        assert.equal(planos.headers.get("cache-control"), "no-store");
    });

    await t.test("cadastro valida dados, protege sessao e concede exatamente 30 dias", async () => {
        assert.equal((await requisicao("/auth/cadastro", { metodo: "POST", dados: { nome: "A", email: "invalido", senha: "123" } })).status, 400);
        alice = await cadastrar("Alice Teste", "ALICE@example.com", { papel: "admin", admin: true, role: "admin", acesso_permanente: true, assinatura: { status: "gratuita" } });
        bruno = await cadastrar("Bruno Teste", "bruno@example.com");
        assert.equal(alice.corpo.usuario.email, "alice@example.com");
        assert.equal(alice.corpo.usuario.papel, "profissional");
        assert.equal(alice.corpo.usuario.bloqueado, false);
        assert.equal((await db.query("SELECT papel FROM usuarios WHERE id = $1", [alice.corpo.usuario.id])).rows[0].papel, "profissional");
        assert.equal(alice.corpo.assinatura.status, "teste");
        assert.equal(alice.corpo.assinatura.acesso_permanente, false);
        assert.equal(alice.corpo.assinatura.dias_restantes, 30);
        assert.equal(alice.corpo.token, undefined);
        assert.equal(alice.corpo.usuario.senha_hash, undefined);
        assert.match(alice.headers.get("set-cookie"), /HttpOnly/i);
        assert.match(alice.headers.get("set-cookie"), /SameSite=Lax/i);
        const usuario = (await db.query("SELECT senha_hash, teste_expira_em - teste_iniciado_em AS duracao FROM usuarios WHERE id = $1", [alice.corpo.usuario.id])).rows[0];
        assert.notEqual(usuario.senha_hash, senha);
        assert.equal(usuario.duracao.days * 24 + (usuario.duracao.hours || 0), 720);
        const sessoes = (await db.query("SELECT token_hash FROM sessoes WHERE usuario_id = $1", [alice.corpo.usuario.id])).rows;
        assert.equal(sessoes.length, 1);
        assert.notEqual(sessoes[0].token_hash, alice.cookie.split("=")[1]);
        assert.equal((await requisicao("/auth/cadastro", { metodo: "POST", dados: { nome: "Alice", email: "alice@example.com", senha, ...aceiteTermos } })).status, 409);
        assert.equal((await requisicao("/auth/login", { metodo: "POST", dados: { email: "alice@example.com", senha: "Senha-incorreta-123" } })).status, 401);
        assert.equal((await requisicao("/auth/me", { cookie: alice.cookie })).corpo.usuario.id, alice.corpo.usuario.id);
    });

    await t.test("cada pessoa acessa apenas suas demandas e alertas, mesmo forjando IDs", async () => {
        assert.deepEqual((await requisicao("/demandas", { cookie: alice.cookie })).corpo, []);
        const criadaA = await requisicao("/demandas", { metodo: "POST", cookie: alice.cookie, dados: { ...demanda("101"), usuario_id: bruno.corpo.usuario.id } });
        const criadaB = await requisicao("/demandas", { metodo: "POST", cookie: bruno.cookie, dados: demanda("202") });
        assert.equal(criadaA.status, 201);
        assert.equal(criadaB.status, 201);
        const idA = criadaA.corpo.demanda.id;
        const idB = criadaB.corpo.demanda.id;
        assert.deepEqual((await requisicao("/demandas", { cookie: alice.cookie })).corpo.map((item) => item.id), [idA]);
        assert.deepEqual((await requisicao("/demandas", { cookie: bruno.cookie })).corpo.map((item) => item.id), [idB]);
        assert.equal((await requisicao(`/demandas/${idA}`, { metodo: "PUT", cookie: bruno.cookie, dados: { ...demanda("101"), concluida: true } })).status, 404);
        assert.equal((await requisicao(`/demandas/${idA}`, { metodo: "DELETE", cookie: bruno.cookie })).status, 404);
        assert.deepEqual((await requisicao("/demandas/vencendo-amanha", { cookie: alice.cookie })).corpo.map((item) => item.id), [idA]);
        assert.deepEqual((await requisicao("/demandas/vencendo-amanha", { cookie: bruno.cookie })).corpo.map((item) => item.id), [idB]);
        assert.equal((await db.query("SELECT usuario_id FROM demandas WHERE numero_demanda = '999'")).rows[0].usuario_id, null);
        const trocada = await requisicao("/demandas", { metodo: "POST", cookie: bruno.cookie, dados: demanda("303"), headers: { "X-Usuario-Id": String(alice.corpo.usuario.id) } });
        assert.equal(trocada.status, 401);
        assert.equal(trocada.corpo.codigo, "CONTA_ALTERADA");
        assert.equal(trocada.headers.get("set-cookie"), null);
        assert.equal((await requisicao("/auth/logout", { metodo: "POST", cookie: bruno.cookie, dados: {}, headers: { "X-Usuario-Id": String(alice.corpo.usuario.id) } })).status, 401);
        assert.equal((await requisicao("/auth/me", { cookie: bruno.cookie })).status, 200);
    });

    await t.test("vencimento bloqueia uso, preserva dados e retorno do checkout nao libera acesso", async () => {
        assert.equal((await requisicao("/cobranca/checkout", { metodo: "POST", cookie: bruno.cookie, dados: { plano: "mensal" } })).status, 503);
        await db.query("UPDATE usuarios SET teste_expira_em = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE id = $1", [alice.corpo.usuario.id]);
        assert.equal((await requisicao("/auth/me", { cookie: alice.cookie })).corpo.assinatura.status, "expirada");
        assert.equal((await requisicao("/demandas", { cookie: alice.cookie })).status, 402);
        assert.equal((await requisicao("/demandas", { metodo: "POST", cookie: alice.cookie, dados: demanda("404") })).status, 402);
        assert.equal((await requisicao("/cobranca/checkout", { metodo: "POST", cookie: alice.cookie, dados: { plano: "gratis", valor_centavos: 0 } })).status, 400);
        assert.equal((await requisicao("/cobranca/checkout", { metodo: "POST", cookie: alice.cookie, dados: { plano: "mensal" } })).status, 503);
        process.env.PAGBANK_LINK_MENSAL = "https://pag.ae/link-mensal-teste";
        const checkoutTeste = await requisicao("/cobranca/checkout", { metodo: "POST", cookie: bruno.cookie, dados: { plano: "mensal" } });
        assert.equal(checkoutTeste.status, 200);
        assert.equal((await requisicao("/auth/me", { cookie: bruno.cookie })).corpo.assinatura.status, "teste");
        const checkout = await requisicao("/cobranca/checkout", { metodo: "POST", cookie: alice.cookie, dados: { plano: "mensal", valor_centavos: 1 } });
        assert.equal(checkout.status, 200);
        assert.equal(checkout.corpo.confirmacao_automatica, false);
        assert.equal((await requisicao("/auth/me?status=paid&plano=anual", { cookie: alice.cookie })).corpo.assinatura.status, "expirada");
        assert.equal(Number((await db.query("SELECT COUNT(*) AS total FROM demandas WHERE usuario_id = $1", [alice.corpo.usuario.id])).rows[0].total), 1);
        delete process.env.PAGBANK_LINK_MENSAL;
    });

    await t.test("pagamento conferido e idempotente; logout revoga sessao de verdade", async () => {
        const { ativarAssinatura } = require("../scripts/ativar-assinatura");
        const opcoes = { email: "alice@example.com", plano: "mensal", referencia: "pagamento-teste-001", confirmar: true };
        const ativacao = await ativarAssinatura(opcoes);
        assert.equal(ativacao.valor_centavos, 3500);
        assert.equal((await requisicao("/auth/me", { cookie: alice.cookie })).corpo.assinatura.status, "ativa");
        assert.equal((await requisicao("/demandas", { cookie: alice.cookie })).status, 200);
        await assert.rejects(ativarAssinatura(opcoes), /ja foi utilizada/);
        assert.equal((await db.query("SELECT assinatura_expira_em FROM usuarios WHERE id = $1", [alice.corpo.usuario.id])).rows[0].assinatura_expira_em.toISOString(), ativacao.acesso_ate);
        const anual = await ativarAssinatura({ email: "bruno@example.com", plano: "anual", referencia: "pagamento-teste-002", confirmar: true });
        assert.equal(anual.valor_centavos, 35000);
        const prazoAnual = (await db.query("SELECT assinatura_expira_em = teste_expira_em + INTERVAL '1 year' AS correto FROM usuarios WHERE id = $1", [bruno.corpo.usuario.id])).rows[0].correto;
        assert.equal(prazoAnual, true);
        const saida = await requisicao("/auth/logout", { metodo: "POST", cookie: alice.cookie, dados: {} });
        assert.equal(saida.status, 200);
        // Uma resposta de logout atrasada nao pode apagar o cookie de um login posterior.
        assert.equal(saida.headers.get("set-cookie"), null);
        const invalida = await requisicao("/auth/me", { cookie: alice.cookie });
        assert.equal(invalida.status, 401);
        assert.equal(invalida.headers.get("set-cookie"), null);
        const entrada = await requisicao("/auth/login", { metodo: "POST", dados: { email: "alice@example.com", senha } });
        assert.equal(entrada.status, 200);
        const cookie = entrada.headers.get("set-cookie").split(";")[0];
        alice.cookie = cookie;
        assert.equal((await requisicao("/auth/me", { cookie })).corpo.usuario.id, alice.corpo.usuario.id);
    });

    await t.test("profissional nao ganha privilegios no cadastro nem acessa a administracao", async () => {
        assert.equal((await requisicao("/admin/pessoas")).status, 401);
        assert.equal((await requisicao("/admin/pessoas", { cookie: alice.cookie })).status, 403);
        assert.equal((await requisicao(`/admin/pessoas/${bruno.corpo.usuario.id}`, { cookie: alice.cookie })).status, 403);
        assert.equal((await requisicao(`/admin/pessoas/${bruno.corpo.usuario.id}/assinatura`, { metodo: "POST", cookie: alice.cookie, dados: { plano: "anual", referencia: "escalada-invalida-001" } })).status, 403);
        assert.equal((await requisicao(`/admin/pessoas/${bruno.corpo.usuario.id}/acesso`, { metodo: "PATCH", cookie: alice.cookie, dados: { bloqueado: true } })).status, 403);
        assert.equal((await db.query("SELECT bloqueado_em FROM usuarios WHERE id = $1", [bruno.corpo.usuario.id])).rows[0].bloqueado_em, null);
    });

    await t.test("administrador lista assinantes sem receber senhas, sessoes ou demandas privadas", async () => {
        admin = await cadastrar("Administrador de Teste", "administrador@example.invalid", { papel: "admin" });
        assert.equal(admin.corpo.usuario.papel, "profissional");
        const { promoverAdministrador } = require("../scripts/promover-administrador");
        await assert.rejects(promoverAdministrador({ email: "alice@example.com", confirmar: true }), /demandas/i);
        assert.equal((await requisicao("/auth/me", { cookie: alice.cookie })).corpo.usuario.papel, "profissional");
        await promoverAdministrador({ email: "administrador@example.invalid", confirmar: true });
        assert.equal((await requisicao("/auth/me", { cookie: admin.cookie })).status, 401);
        const entradaAdmin = await requisicao("/auth/login", { metodo: "POST", dados: { email: "administrador@example.invalid", senha } });
        assert.equal(entradaAdmin.status, 200);
        admin.cookie = entradaAdmin.headers.get("set-cookie").split(";")[0];
        await promoverAdministrador({ email: "administrador@example.invalid", confirmar: true });
        await db.query("UPDATE usuarios SET teste_expira_em = CURRENT_TIMESTAMP - INTERVAL '1 day' WHERE id = $1", [admin.corpo.usuario.id]);
        const sessaoAdmin = await requisicao("/auth/me", { cookie: admin.cookie });
        assert.equal(sessaoAdmin.status, 200);
        assert.equal(sessaoAdmin.corpo.usuario.papel, "admin");
        const lista = await requisicao("/admin/pessoas", { cookie: admin.cookie });
        assert.equal(lista.status, 200);
        assert.equal(lista.corpo.resumo.total, 2);
        assert.deepEqual(lista.corpo.pessoas.map(item => item.id).sort(), [alice.corpo.usuario.id, bruno.corpo.usuario.id].sort());
        const detalhe = await requisicao(`/admin/pessoas/${alice.corpo.usuario.id}`, { cookie: admin.cookie });
        assert.equal(detalhe.status, 200);
        assert.equal(detalhe.corpo.pessoa.id, alice.corpo.usuario.id);
        assert.ok(Array.isArray(detalhe.corpo.ativacoes));
        const serializado = JSON.stringify({ lista: lista.corpo, detalhe: detalhe.corpo });
        assert.doesNotMatch(serializado, /senha_hash|token_hash|beneficiario|numero_demanda|data_vencimento|Pessoa de teste/);
        for (const caminho of ["/demandas", "/demandas/vencendo-amanha", "/cobranca/status"]) {
            assert.equal((await requisicao(caminho, { cookie: admin.cookie })).status, 403, caminho);
        }
        assert.equal((await requisicao("/cobranca/checkout", { metodo: "POST", cookie: admin.cookie, dados: { plano: "mensal" } })).status, 403);
        assert.equal((await requisicao("/demandas", { metodo: "POST", cookie: admin.cookie, dados: demanda("909") })).status, 403);
        const demandaAlice = (await db.query("SELECT id FROM demandas WHERE usuario_id = $1", [alice.corpo.usuario.id])).rows[0].id;
        assert.equal((await requisicao(`/demandas/${demandaAlice}`, { metodo: "PUT", cookie: admin.cookie, dados: { ...demanda("101"), concluida: true } })).status, 403);
        assert.equal((await requisicao(`/demandas/${demandaAlice}`, { metodo: "DELETE", cookie: admin.cookie })).status, 403);
    });

    await t.test("ativacao administrativa respeita pessoa e preco e nao duplica referencia", async () => {
        carla = await cadastrar("Carla Teste", "carla@example.invalid");
        const id = carla.corpo.usuario.id;
        const antes = (await db.query("SELECT id, assinatura_expira_em FROM usuarios WHERE id = ANY($1::int[]) ORDER BY id", [[alice.corpo.usuario.id, bruno.corpo.usuario.id]])).rows;
        const caminho = `/admin/pessoas/${id}/assinatura`;
        const dados = { plano: "mensal", referencia: "admin-pagamento-001", usuario_id: alice.corpo.usuario.id, email: "alice@example.com", valor_centavos: 1 };
        const ativacao = await requisicao(caminho, { metodo: "POST", cookie: admin.cookie, dados });
        assert.ok([200, 201].includes(ativacao.status));
        assert.equal(ativacao.corpo.pessoa.id, id);
        assert.equal(ativacao.corpo.pessoa.assinatura.plano, "mensal");
        const registro = (await db.query("SELECT usuario_id, valor_centavos, acesso_ate FROM ativacoes_assinatura WHERE referencia = $1", [dados.referencia])).rows[0];
        assert.equal(registro.usuario_id, id);
        assert.equal(registro.valor_centavos, 3500);
        const repetida = await requisicao(caminho, { metodo: "POST", cookie: admin.cookie, dados });
        assert.equal(repetida.status, 200);
        assert.equal(repetida.corpo.repetida, true);
        assert.equal((await db.query("SELECT assinatura_expira_em FROM usuarios WHERE id = $1", [id])).rows[0].assinatura_expira_em.toISOString(), registro.acesso_ate.toISOString());
        assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM ativacoes_assinatura WHERE referencia = $1", [dados.referencia])).rows[0].n), 1);
        const outraPessoa = await requisicao(`/admin/pessoas/${bruno.corpo.usuario.id}/assinatura`, { metodo: "POST", cookie: admin.cookie, dados: { plano: "anual", referencia: dados.referencia } });
        assert.equal(outraPessoa.status, 409);
        const outroPlano = await requisicao(caminho, { metodo: "POST", cookie: admin.cookie, dados: { plano: "anual", referencia: dados.referencia } });
        assert.equal(outroPlano.status, 409);
        assert.equal((await requisicao(caminho, { metodo: "POST", cookie: admin.cookie, dados: { plano: "vitalicio", referencia: "admin-invalido-002" } })).status, 400);
        const depois = (await db.query("SELECT id, assinatura_expira_em FROM usuarios WHERE id = ANY($1::int[]) ORDER BY id", [[alice.corpo.usuario.id, bruno.corpo.usuario.id]])).rows;
        assert.deepEqual(depois, antes);
        assert.equal((await requisicao("/admin/pessoas/2147483647/assinatura", { metodo: "POST", cookie: admin.cookie, dados: { plano: "mensal", referencia: "admin-inexistente-003" } })).status, 404);
    });

    await t.test("bloqueio administrativo tem efeito imediato sem apagar demandas ou sessao", async () => {
        const id = carla.corpo.usuario.id;
        const criada = await requisicao("/demandas", { metodo: "POST", cookie: carla.cookie, dados: demanda("505") });
        assert.equal(criada.status, 201);
        const bloqueio = await requisicao(`/admin/pessoas/${id}/acesso`, { metodo: "PATCH", cookie: admin.cookie, dados: { bloqueado: true } });
        assert.equal(bloqueio.status, 200);
        assert.equal(bloqueio.corpo.pessoa.bloqueado, true);
        const contaBloqueada = await requisicao("/auth/me", { cookie: carla.cookie });
        assert.equal(contaBloqueada.status, 200);
        assert.equal(contaBloqueada.corpo.usuario.bloqueado, true);
        const negada = await requisicao("/demandas", { cookie: carla.cookie });
        assert.equal(negada.status, 403);
        assert.equal(negada.corpo.codigo, "ACESSO_BLOQUEADO");
        assert.equal((await requisicao("/demandas", { metodo: "POST", cookie: carla.cookie, dados: demanda("606") })).status, 403);
        assert.equal((await requisicao(`/demandas/${criada.corpo.demanda.id}`, { metodo: "DELETE", cookie: carla.cookie })).status, 403);
        assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM demandas WHERE usuario_id = $1", [id])).rows[0].n), 1);
        assert.equal((await requisicao(`/admin/pessoas/${id}/acesso`, { metodo: "PATCH", cookie: admin.cookie, dados: { bloqueado: "false" } })).status, 400);
        const desbloqueio = await requisicao(`/admin/pessoas/${id}/acesso`, { metodo: "PATCH", cookie: admin.cookie, dados: { bloqueado: false } });
        assert.equal(desbloqueio.status, 200);
        assert.equal(desbloqueio.corpo.pessoa.bloqueado, false);
        assert.equal((await requisicao("/demandas", { cookie: carla.cookie })).status, 200);
        const bloqueioAdmin = await requisicao(`/admin/pessoas/${admin.corpo.usuario.id}/acesso`, { metodo: "PATCH", cookie: admin.cookie, dados: { bloqueado: true } });
        assert.ok([400, 403, 404].includes(bloqueioAdmin.status));
        assert.equal((await requisicao("/auth/me", { cookie: admin.cookie })).corpo.usuario.bloqueado, false);
    });

    await t.test("recuperacao usa resposta uniforme, transporte local e apenas hash com prazo de 30 minutos", async () => {
        await comRecuperacao(async ({ mensagens }) => {
            const conhecida = await requisicao("/auth/esqueci-senha", { metodo: "POST", dados: { email: "alice@example.com" } });
            const desconhecida = await requisicao("/auth/esqueci-senha", { metodo: "POST", dados: { email: "sem-conta@example.invalid" } });
            assert.equal(conhecida.status, 503);
            assert.equal(desconhecida.status, 503);
            assert.deepEqual(conhecida.corpo, desconhecida.corpo);
            assert.equal(mensagens.length, 0);
        }, { configurado: false });
        await comRecuperacao(async contexto => {
            const desconhecida = await requisicao("/auth/esqueci-senha", { metodo: "POST", dados: { email: "sem-conta@example.invalid" } });
            const conhecida = await requisicao("/auth/esqueci-senha", { metodo: "POST", dados: { email: "ALICE@example.com" } });
            assert.equal(desconhecida.status, 200);
            assert.equal(conhecida.status, 200);
            assert.deepEqual(conhecida.corpo, desconhecida.corpo);
            assert.equal(conhecida.corpo.token, undefined);
            await contexto.servico.aguardarPendentes();
            assert.equal(contexto.mensagens.length, 1);
            assert.deepEqual(contexto.mensagens[0].to, ["alice@example.com"]);
            const token = extrairTokenRedefinicao(contexto.mensagens[0].text);
            assert.ok(token && /^[a-f0-9]{64}$/.test(token), "Token aleatorio valido no transporte sintetico.");
            const tokenHash = createHash("sha256").update(token).digest("hex");
            const registro = (await db.query("SELECT token_hash, usuario_id, usado_em, EXTRACT(EPOCH FROM expira_em - criado_em)::float8 AS segundos FROM redefinicoes_senha WHERE token_hash = $1", [tokenHash])).rows[0];
            assert.ok(registro, "O banco deve guardar o hash do token enviado.");
            assert.ok(registro.token_hash !== token, "O token em texto puro nao deve ser persistido.");
            assert.equal(registro.usuario_id, alice.corpo.usuario.id);
            assert.equal(registro.usado_em, null);
            assert.equal(registro.segundos, 1800);
        });
    });

    await t.test("links invalidos e expirados e senhas fora dos limites nao alteram a conta", async () => {
        await comRecuperacao(async contexto => {
            const antes = (await db.query("SELECT senha_hash, papel FROM usuarios WHERE id = $1", [alice.corpo.usuario.id])).rows[0];
            assert.equal((await requisicao("/auth/redefinir-senha", { metodo: "POST", dados: { token: "invalido", senha: "Nova-senha-de-teste-456" } })).status, 400);
            const token = await solicitarToken("alice@example.com", contexto);
            const tokenHash = createHash("sha256").update(token).digest("hex");
            for (const senhaInvalida of ["123456789", "x".repeat(129)]) {
                assert.equal((await requisicao("/auth/redefinir-senha", { metodo: "POST", dados: { token, senha: senhaInvalida } })).status, 400);
            }
            assert.equal((await db.query("SELECT usado_em FROM redefinicoes_senha WHERE token_hash = $1", [tokenHash])).rows[0].usado_em, null);
            await db.query("UPDATE redefinicoes_senha SET expira_em = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE token_hash = $1", [tokenHash]);
            assert.equal((await requisicao("/auth/redefinir-senha", { metodo: "POST", dados: { token, senha: "Nova-senha-de-teste-456" } })).status, 400);
            assert.deepEqual((await db.query("SELECT senha_hash, papel FROM usuarios WHERE id = $1", [alice.corpo.usuario.id])).rows[0], antes);
            assert.equal((await requisicao("/auth/me", { cookie: alice.cookie })).status, 200);
        });
    });

    await t.test("redefinicao e de uso unico transacional e revoga todas as sessoes e links da pessoa", async () => {
        await comRecuperacao(async contexto => {
            const extra = await requisicao("/auth/login", { metodo: "POST", dados: { email: "alice@example.com", senha } });
            assert.equal(extra.status, 200);
            const cookieExtra = extra.headers.get("set-cookie").split(";")[0];
            const token = await solicitarToken("alice@example.com", contexto);
            const outroToken = randomBytes(32).toString("hex");
            await db.query("INSERT INTO redefinicoes_senha (token_hash, usuario_id, expira_em) VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '30 minutes')", [createHash("sha256").update(outroToken).digest("hex"), alice.corpo.usuario.id]);
            const senhasNovas = ["Nova-senha-de-teste-456", "Outra-senha-de-teste-789"];
            const resultados = await Promise.all(senhasNovas.map(novaSenha => requisicao("/auth/redefinir-senha", { metodo: "POST", dados: { token, senha: novaSenha, papel: "admin" } })));
            assert.deepEqual(resultados.map(item => item.status).sort(), [200, 400]);
            const senhaVencedora = senhasNovas[resultados.findIndex(item => item.status === 200)];
            assert.equal((await requisicao("/auth/redefinir-senha", { metodo: "POST", dados: { token, senha: "Senha-de-reuso-invalido" } })).status, 400);
            assert.equal((await requisicao("/auth/redefinir-senha", { metodo: "POST", dados: { token: outroToken, senha: "Senha-de-outro-link-invalido" } })).status, 400);
            assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM sessoes WHERE usuario_id = $1", [alice.corpo.usuario.id])).rows[0].n), 0);
            assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM redefinicoes_senha WHERE usuario_id = $1 AND usado_em IS NULL", [alice.corpo.usuario.id])).rows[0].n), 0);
            assert.equal((await requisicao("/auth/me", { cookie: alice.cookie })).status, 401);
            assert.equal((await requisicao("/auth/me", { cookie: cookieExtra })).status, 401);
            assert.equal((await requisicao("/auth/me", { cookie: bruno.cookie })).status, 200);
            assert.equal((await requisicao("/auth/login", { metodo: "POST", dados: { email: "alice@example.com", senha } })).status, 401);
            const entrada = await requisicao("/auth/login", { metodo: "POST", dados: { email: "alice@example.com", senha: senhaVencedora } });
            assert.equal(entrada.status, 200);
            assert.equal(entrada.corpo.usuario.papel, "profissional");
            assert.equal(entrada.corpo.assinatura.status, "ativa");
            alice.cookie = entrada.headers.get("set-cookie").split(";")[0];
            assert.equal((await requisicao("/demandas", { cookie: alice.cookie })).corpo.length, 1);
        });
    });

    await t.test("recuperacao de administrador preserva o papel e exige novo login", async () => {
        await comRecuperacao(async contexto => {
            const token = await solicitarToken("administrador@example.invalid", contexto);
            const senhaAdmin = "Nova-senha-admin-de-teste-123";
            const redefinicao = await requisicao("/auth/redefinir-senha", { metodo: "POST", dados: { token, senha: senhaAdmin, papel: "profissional" } });
            assert.equal(redefinicao.status, 200);
            assert.equal((await requisicao("/auth/me", { cookie: admin.cookie })).status, 401);
            const entrada = await requisicao("/auth/login", { metodo: "POST", dados: { email: "administrador@example.invalid", senha: senhaAdmin } });
            assert.equal(entrada.status, 200);
            assert.equal(entrada.corpo.usuario.papel, "admin");
            admin.cookie = entrada.headers.get("set-cookie").split(";")[0];
            assert.equal((await requisicao("/admin/pessoas", { cookie: admin.cookie })).status, 200);
            assert.equal((await requisicao("/demandas", { cookie: admin.cookie })).status, 403);
        });
    });

    await t.test("solicitacoes repetidas de recuperacao recebem limite e prazo para tentar novamente", async () => {
        await comRecuperacao(async contexto => {
            const respostas = [];
            for (let tentativa = 0; tentativa < 6; tentativa++) respostas.push(await requisicao("/auth/esqueci-senha", { metodo: "POST", dados: { email: "limite-sem-conta@example.invalid" } }));
            assert.deepEqual(respostas.slice(0, 5).map(item => item.status), [200, 200, 200, 200, 200]);
            assert.equal(respostas[5].status, 429);
            assert.ok(Number(respostas[5].headers.get("retry-after")) > 0);
            await contexto.servico.aguardarPendentes();
            assert.equal(contexto.mensagens.length, 0);
        });
    });

    await t.test("cadastro exige aceite expresso da versao vigente e nao deixa conta parcial", async () => {
        const dados = { nome: "Sem aceite", email: "sem-aceite@example.invalid", senha };
        for (const extras of [{}, { aceite_termos: false, versao_termos: aceiteTermos.versao_termos }, { aceite_termos: "true", versao_termos: aceiteTermos.versao_termos }, { aceite_termos: true, versao_termos: "2020-01-01" }]) {
            assert.equal((await requisicao("/auth/cadastro", { metodo: "POST", dados: { ...dados, ...extras } })).status, 400);
        }
        assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM usuarios WHERE email = $1", [dados.email])).rows[0].n), 0);
    });

    await t.test("boas-vindas registra apenas a primeira escolha e nao reinicia o teste", async () => {
        const pessoa = await cadastrar("Boas Vindas", "boas-vindas@example.invalid", { boas_vindas_em: "2020-01-01", boas_vindas_vistas: true });
        const id = pessoa.corpo.usuario.id;
        assert.equal(pessoa.corpo.usuario.boas_vindas_vistas, false);
        const antes = (await db.query("SELECT teste_iniciado_em, teste_expira_em FROM usuarios WHERE id = $1", [id])).rows[0];
        assert.equal((await requisicao("/cobranca/boas-vindas", { metodo: "POST", cookie: pessoa.cookie, dados: { escolha: "invalida" } })).status, 400);
        assert.equal((await db.query("SELECT boas_vindas_em FROM usuarios WHERE id = $1", [id])).rows[0].boas_vindas_em, null);
        assert.equal((await requisicao("/cobranca/boas-vindas", { metodo: "POST", cookie: pessoa.cookie, dados: { escolha: "teste" } })).status, 200);
        const primeira = (await db.query("SELECT boas_vindas_em FROM usuarios WHERE id = $1", [id])).rows[0].boas_vindas_em;
        assert.ok(primeira instanceof Date);
        for (const escolha of ["mensal", "anual", "teste"]) {
            assert.equal((await requisicao("/cobranca/boas-vindas", { metodo: "POST", cookie: pessoa.cookie, dados: { escolha } })).status, 200);
        }
        assert.equal((await db.query("SELECT boas_vindas_em FROM usuarios WHERE id = $1", [id])).rows[0].boas_vindas_em.toISOString(), primeira.toISOString());
        assert.deepEqual((await db.query("SELECT teste_iniciado_em, teste_expira_em FROM usuarios WHERE id = $1", [id])).rows[0], antes);
        assert.equal((await requisicao("/auth/me", { cookie: pessoa.cookie })).corpo.usuario.boas_vindas_vistas, true);
    });

    await t.test("acesso permanente depende de concessao no servidor e permite CRUD sem vencimento", async () => {
        const pessoa = await cadastrar("Acesso Permanente", "permanente@example.invalid", { acesso_permanente: true });
        const id = pessoa.corpo.usuario.id;
        assert.equal((await db.query("SELECT acesso_permanente FROM usuarios WHERE id = $1", [id])).rows[0].acesso_permanente, false);
        const { concederAcessoPermanente } = require("../scripts/conceder-acesso-permanente");
        const concessao = { email: "permanente@example.invalid", administrador: "administrador@example.invalid", confirmar: true };
        await assert.rejects(concederAcessoPermanente({ ...concessao, confirmar: false }), /confirmar/);
        await assert.rejects(concederAcessoPermanente({ ...concessao, administrador: "bruno@example.com" }), /Administrador ativo/);
        await assert.rejects(concederAcessoPermanente({ ...concessao, email: "bruno@example.com" }), /assinatura paga/);
        assert.equal((await concederAcessoPermanente(concessao)).alterado, true);
        assert.equal((await concederAcessoPermanente(concessao)).alterado, false);
        assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM acoes_administrativas WHERE usuario_id = $1 AND acao = 'acesso_permanente_concedido'", [id])).rows[0].n), 1);
        await db.query("UPDATE usuarios SET teste_expira_em = CURRENT_TIMESTAMP - INTERVAL '1 day' WHERE id = $1", [id]);
        const conta = await requisicao("/auth/me", { cookie: pessoa.cookie });
        assert.equal(conta.status, 200);
        assert.equal(conta.corpo.assinatura.status, "gratuita");
        assert.equal(conta.corpo.assinatura.acesso_permanente, true);
        assert.equal(conta.corpo.assinatura.acesso_ate, null);
        assert.equal(conta.corpo.assinatura.dias_restantes, null);
        const criada = await requisicao("/demandas", { metodo: "POST", cookie: pessoa.cookie, dados: demanda("707") });
        assert.equal(criada.status, 201);
        const demandaId = criada.corpo.demanda.id;
        assert.equal((await requisicao(`/demandas/${demandaId}`, { metodo: "PUT", cookie: pessoa.cookie, dados: { ...demanda("707"), concluida: true } })).status, 200);
        assert.equal((await requisicao(`/demandas/${demandaId}`, { metodo: "DELETE", cookie: pessoa.cookie })).status, 200);
        assert.deepEqual((await requisicao("/demandas", { cookie: pessoa.cookie })).corpo, []);
        process.env.PAGBANK_LINK_MENSAL = "https://pag.ae/permanente-nao-cobra";
        try {
            assert.equal((await requisicao("/cobranca/status", { cookie: pessoa.cookie })).corpo.pode_assinar, false);
            assert.equal((await requisicao("/cobranca/checkout", { metodo: "POST", cookie: pessoa.cookie, dados: { plano: "mensal" } })).status, 409);
            assert.equal((await requisicao("/cobranca/cancelamento", { metodo: "POST", cookie: pessoa.cookie, dados: {} })).status, 409);
            assert.equal((await requisicao(`/admin/pessoas/${id}/assinatura`, { metodo: "POST", cookie: admin.cookie, dados: { plano: "mensal", referencia: "permanente-nao-cobra" } })).status, 409);
            const { ativarAssinatura } = require("../scripts/ativar-assinatura");
            await assert.rejects(ativarAssinatura({ email: concessao.email, plano: "mensal", referencia: "permanente-cli-nao-cobra", confirmar: true }), /gratuit|permanente/);
        } finally { delete process.env.PAGBANK_LINK_MENSAL; }
        const detalhe = await requisicao(`/admin/pessoas/${id}`, { cookie: admin.cookie });
        assert.equal(detalhe.corpo.pessoa.assinatura.status, "gratuita");
    });

    await t.test("politica publica e aceite de conta legada bloqueiam somente os dados operacionais", async () => {
        const politica = await requisicao("/privacidade/politica");
        assert.equal(politica.status, 200);
        assert.equal(politica.corpo.versao, aceiteTermos.versao_termos);
        assert.equal(politica.corpo.contato, "tigertechbr@outlook.com");
        assert.ok(politica.corpo.privacidade.length > 0);
        assert.ok(politica.corpo.termos.length > 0);
        const pessoa = await cadastrar("Conta Legada", "legada@example.invalid");
        const id = pessoa.corpo.usuario.id;
        await db.query("UPDATE usuarios SET termos_versao = NULL, termos_aceitos_em = NULL WHERE id = $1", [id]);
        const conta = await requisicao("/auth/me", { cookie: pessoa.cookie });
        assert.equal(conta.status, 200);
        assert.equal(conta.corpo.usuario.politica_aceita, false);
        for (const [caminho, opcoes] of [["/demandas", {}], ["/demandas/vencendo-amanha", {}], ["/demandas", { metodo: "POST", dados: demanda("808") }]]) {
            const resposta = await requisicao(caminho, { ...opcoes, cookie: pessoa.cookie });
            assert.equal(resposta.status, 428);
            assert.equal(resposta.corpo.codigo, "POLITICA_NAO_ACEITA");
        }
        assert.equal((await requisicao("/privacidade/dados", { cookie: pessoa.cookie })).status, 200);
        assert.equal((await requisicao("/privacidade/aceite", { metodo: "POST", dados: { versao: aceiteTermos.versao_termos } })).status, 401);
        assert.equal((await requisicao("/privacidade/aceite", { metodo: "POST", cookie: pessoa.cookie, dados: { versao: "2020-01-01" } })).status, 400);
        assert.equal((await requisicao("/auth/me", { cookie: pessoa.cookie })).corpo.usuario.politica_aceita, false);
        const aceite = await requisicao("/privacidade/aceite", { metodo: "POST", cookie: pessoa.cookie, dados: { versao: aceiteTermos.versao_termos, usuario_id: bruno.corpo.usuario.id } });
        assert.equal(aceite.status, 200);
        assert.equal(aceite.corpo.aceita, true);
        assert.equal((await requisicao("/auth/me", { cookie: pessoa.cookie })).corpo.usuario.politica_aceita, true);
        assert.equal((await requisicao("/demandas", { cookie: pessoa.cookie })).status, 200);
        await db.query("UPDATE usuarios SET termos_versao = NULL, termos_aceitos_em = NULL WHERE id = $1", [admin.corpo.usuario.id]);
        try { assert.equal((await requisicao("/admin/pessoas", { cookie: admin.cookie })).status, 200); }
        finally { await db.query("UPDATE usuarios SET termos_versao = $2, termos_aceitos_em = CURRENT_TIMESTAMP WHERE id = $1", [admin.corpo.usuario.id, aceiteTermos.versao_termos]); }
    });

    await t.test("portabilidade e solicitacoes de privacidade respeitam o titular mesmo sem acesso pago", async () => {
        for (const caminho of ["/privacidade/dados", "/privacidade/solicitacoes", "/admin/privacidade"]) {
            assert.equal((await requisicao(caminho)).status, 401);
        }
        const pessoa = await cadastrar("Privacidade Individual", "privacidade@example.invalid");
        const id = pessoa.corpo.usuario.id;
        const criada = await requisicao("/demandas", { metodo: "POST", cookie: pessoa.cookie, dados: demanda("818") });
        assert.equal(criada.status, 201);
        await db.query("UPDATE usuarios SET teste_expira_em = CURRENT_TIMESTAMP - INTERVAL '1 day', bloqueado_em = CURRENT_TIMESTAMP WHERE id = $1", [id]);
        const exportacao = await requisicao(`/privacidade/dados?usuario_id=${alice.corpo.usuario.id}`, { cookie: pessoa.cookie });
        assert.equal(exportacao.status, 200);
        assert.equal(exportacao.corpo.perfil.id, id);
        assert.deepEqual(exportacao.corpo.demandas.map(item => item.id), [criada.corpo.demanda.id]);
        assert.deepEqual(exportacao.corpo.ativacoes, []);
        assert.doesNotMatch(JSON.stringify(exportacao.corpo), /senha_hash|token_hash|alice@example.com|Registro anterior/);
        for (const dados of [{ tipo: "invalido", descricao: "Preciso de uma correcao" }, { tipo: "acesso", descricao: "curta" }, { tipo: "outro", descricao: "x".repeat(2001) }]) {
            assert.equal((await requisicao("/privacidade/solicitacoes", { metodo: "POST", cookie: pessoa.cookie, dados })).status, 400);
        }
        const dados = { tipo: "exclusao", descricao: "Solicito avaliar a exclusao dos meus dados pessoais.", usuario_id: alice.corpo.usuario.id };
        const solicitada = await requisicao("/privacidade/solicitacoes", { metodo: "POST", cookie: pessoa.cookie, dados });
        assert.equal(solicitada.status, 201);
        const solicitacaoId = solicitada.corpo.solicitacao.id;
        assert.equal(solicitada.corpo.solicitacao.status, "pendente");
        assert.equal((await requisicao("/privacidade/solicitacoes", { metodo: "POST", cookie: pessoa.cookie, dados })).status, 409);
        const proprias = await requisicao(`/privacidade/solicitacoes?usuario_id=${alice.corpo.usuario.id}`, { cookie: pessoa.cookie });
        assert.deepEqual(proprias.corpo.solicitacoes.map(item => item.id), [solicitacaoId]);
        assert.deepEqual((await requisicao("/privacidade/solicitacoes", { cookie: alice.cookie })).corpo.solicitacoes, []);
        assert.equal((await requisicao("/admin/privacidade", { cookie: pessoa.cookie })).status, 403);
        assert.equal((await requisicao(`/admin/privacidade/${solicitacaoId}/resposta`, { metodo: "POST", cookie: pessoa.cookie, dados: { resposta: "Resposta indevida de outro titular" } })).status, 403);
        const fila = await requisicao("/admin/privacidade", { cookie: admin.cookie });
        assert.equal(fila.status, 200);
        const naFila = fila.corpo.solicitacoes.find(item => item.id === solicitacaoId);
        assert.equal(naFila.email, "privacidade@example.invalid");
        assert.equal((await requisicao(`/admin/privacidade/${solicitacaoId}/resposta`, { metodo: "POST", cookie: admin.cookie, dados: { resposta: "curta" } })).status, 400);
        const resposta = "Recebemos sua solicitacao e informamos os proximos passos pelo suporte.";
        const respondida = await requisicao(`/admin/privacidade/${solicitacaoId}/resposta`, { metodo: "POST", cookie: admin.cookie, dados: { resposta } });
        assert.equal(respondida.status, 200);
        assert.equal(respondida.corpo.solicitacao.status, "respondida");
        assert.equal((await requisicao(`/admin/privacidade/${solicitacaoId}/resposta`, { metodo: "POST", cookie: admin.cookie, dados: { resposta } })).status, 409);
        const atualizada = await requisicao("/privacidade/solicitacoes", { cookie: pessoa.cookie });
        assert.equal(atualizada.corpo.solicitacoes[0].resposta, resposta);
        assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM usuarios WHERE id = $1", [id])).rows[0].n), 1);
        assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM demandas WHERE usuario_id = $1", [id])).rows[0].n), 1);
        assert.deepEqual((await requisicao("/privacidade/dados", { cookie: admin.cookie })).corpo.demandas, []);
    });

    await t.test("cancelamento exige conferencia preserva acesso e entrega confirmacao pela fila com retry", async () => {
        const { criarServicoNotificacoes } = require("../services/notificacaoService");
        const pessoa = await cadastrar("Cancelamento Teste", "cancelamento@example.invalid");
        const id = pessoa.corpo.usuario.id;
        const caminhoPlano = `/admin/pessoas/${id}/assinatura`;
        const caminhoCancelamento = `/admin/pessoas/${id}/cancelamento`;
        const anterior = app.locals.servicoNotificacoes;
        const mensagens = [];
        const semConfiguracao = criarServicoNotificacoes({ db, configuracaoEmail: null, transporteEmail: async mensagem => { mensagens.push(mensagem); } });
        app.locals.servicoNotificacoes = semConfiguracao;
        process.env.PAGBANK_LINK_MENSAL = "https://pag.ae/cancelamento-teste";
        try {
            assert.equal((await requisicao("/cobranca/cancelamento", { metodo: "POST", dados: {} })).status, 401);
            assert.equal((await requisicao("/cobranca/cancelamento", { metodo: "POST", cookie: pessoa.cookie, dados: {} })).status, 409);
            assert.equal((await requisicao(caminhoPlano, { metodo: "POST", cookie: admin.cookie, dados: { plano: "mensal", referencia: "cancel-pagamento-001", nova_assinatura: true } })).status, 409);
            assert.equal((await requisicao(caminhoPlano, { metodo: "POST", cookie: admin.cookie, dados: { plano: "mensal", referencia: "cancel-pagamento-001" } })).status, 201);
            const paga = (await db.query("SELECT assinatura_expira_em, teste_expira_em FROM usuarios WHERE id = $1", [id])).rows[0];
            assert.equal((await requisicao("/cobranca/checkout", { metodo: "POST", cookie: pessoa.cookie, dados: { plano: "mensal" } })).status, 409);
            await db.query("UPDATE usuarios SET teste_expira_em = CURRENT_TIMESTAMP - INTERVAL '2 days', assinatura_expira_em = CURRENT_TIMESTAMP - INTERVAL '1 day' WHERE id = $1", [id]);
            const expirada = await requisicao("/auth/me", { cookie: pessoa.cookie });
            assert.equal(expirada.corpo.assinatura.status, "expirada");
            assert.equal(expirada.corpo.assinatura.renovacao_status, "ativa");
            assert.equal((await requisicao("/cobranca/checkout", { metodo: "POST", cookie: pessoa.cookie, dados: { plano: "mensal" } })).status, 409);
            await db.query("UPDATE usuarios SET teste_expira_em = $2, assinatura_expira_em = $3 WHERE id = $1", [id, paga.teste_expira_em, paga.assinatura_expira_em]);
            const pedidos = await Promise.all([1, 2].map(() => requisicao("/cobranca/cancelamento", { metodo: "POST", cookie: pessoa.cookie, dados: { usuario_id: alice.corpo.usuario.id } })));
            for (const pedido of pedidos) {
                assert.equal(pedido.status, 200);
                assert.equal(pedido.corpo.assinatura.renovacao_status, "cancelamento_solicitado");
                assert.equal(pedido.corpo.assinatura.acesso_ate, paga.assinatura_expira_em.toISOString());
            }
            assert.equal(pedidos[0].corpo.assinatura.cancelamento_solicitado_em, pedidos[1].corpo.assinatura.cancelamento_solicitado_em);
            assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM notificacoes_email WHERE usuario_id = $1", [id])).rows[0].n), 0);
            const pendenteAntes = pedidos[0].corpo.assinatura.cancelamento_solicitado_em;
            assert.equal((await requisicao(caminhoPlano, { metodo: "POST", cookie: admin.cookie, dados: { plano: "mensal", referencia: "cancel-renovacao-002" } })).status, 201);
            const renovada = (await requisicao("/auth/me", { cookie: pessoa.cookie })).corpo.assinatura;
            assert.equal(renovada.cancelamento_solicitado_em, pendenteAntes);
            assert.equal(renovada.renovacao_status, "cancelamento_solicitado");
            const dados = { referencia: "cancel-confirmado-001", confirmado_no_pagbank: true };
            assert.equal((await requisicao(caminhoCancelamento, { metodo: "POST", cookie: pessoa.cookie, dados })).status, 403);
            for (const confirmado of [undefined, false, "true"]) {
                assert.equal((await requisicao(caminhoCancelamento, { metodo: "POST", cookie: admin.cookie, dados: { ...dados, confirmado_no_pagbank: confirmado } })).status, 400);
            }
            assert.equal((await db.query("SELECT cancelamento_confirmado_em FROM usuarios WHERE id = $1", [id])).rows[0].cancelamento_confirmado_em, null);
            app.locals.servicoNotificacoes = { enfileirarConfirmacaoCancelamento: async () => { throw new Error("Falha sintetica da persistencia da fila"); } };
            const naoConfirmada = await requisicao(caminhoCancelamento, { metodo: "POST", cookie: admin.cookie, dados });
            assert.equal(naoConfirmada.status, 503);
            assert.equal((await db.query("SELECT cancelamento_confirmado_em FROM usuarios WHERE id = $1", [id])).rows[0].cancelamento_confirmado_em, null);
            assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM acoes_administrativas WHERE usuario_id = $1 AND acao = 'cancelamento_confirmado'", [id])).rows[0].n), 0);
            app.locals.servicoNotificacoes = semConfiguracao;
            const confirmacoes = await Promise.all([1, 2].map(() => requisicao(caminhoCancelamento, { metodo: "POST", cookie: admin.cookie, dados })));
            for (const confirmacao of confirmacoes) {
                assert.equal(confirmacao.status, 200);
                assert.equal(confirmacao.corpo.pessoa.assinatura.renovacao_status, "cancelada");
                assert.equal(confirmacao.corpo.pessoa.assinatura.acesso_ate, renovada.acesso_ate);
                assert.equal(confirmacao.corpo.email_confirmacao, "pendente");
            }
            const confirmadoEm = confirmacoes[0].corpo.pessoa.assinatura.cancelamento_confirmado_em;
            assert.equal(confirmacoes[1].corpo.pessoa.assinatura.cancelamento_confirmado_em, confirmadoEm);
            assert.equal((await requisicao(caminhoCancelamento, { metodo: "POST", cookie: admin.cookie, dados: { ...dados, referencia: "outra-referencia-002" } })).status, 409);
            assert.equal((await requisicao("/demandas", { cookie: pessoa.cookie })).status, 200);
            const notificacoes = (await db.query("SELECT id, status, tentativas FROM notificacoes_email WHERE usuario_id = $1", [id])).rows;
            assert.equal(notificacoes.length, 1);
            assert.equal(notificacoes[0].status, "pendente");
            assert.equal(notificacoes[0].tentativas, 0);
            const notificacaoId = notificacoes[0].id;
            assert.deepEqual(await semConfiguracao.processarFila(), { reservadas: 0, enviadas: 0, falhas: 0, indisponivel: true });
            assert.equal((await db.query("SELECT tentativas FROM notificacoes_email WHERE id = $1", [notificacaoId])).rows[0].tentativas, 0);
            assert.equal(mensagens.length, 0);

            const configuracaoEmail = { apiKey: "re_teste_local", from: "Teste Local <nao-responda@example.invalid>", appUrl: "https://app.example.test/" };
            let falhar = true;
            const tentativas = [];
            const transporte = async (mensagem, configuracao, opcoes) => {
                tentativas.push({ mensagem, opcoes });
                if (falhar) throw new Error("Falha sintetica de entrega");
                mensagens.push(mensagem);
            };
            const fila = criarServicoNotificacoes({ db, configuracaoEmail, transporteEmail: transporte });
            const falha = await fila.processarFila();
            assert.equal(falha.falhas, 1);
            assert.equal(falha.enviadas, 0);
            const aposFalha = (await db.query("SELECT status, tentativas, erro_codigo, enviado_em FROM notificacoes_email WHERE id = $1", [notificacaoId])).rows[0];
            assert.equal(aposFalha.status, "pendente");
            assert.equal(aposFalha.tentativas, 1);
            assert.equal(aposFalha.erro_codigo, "ENVIO_INDISPONIVEL");
            assert.equal(aposFalha.enviado_em, null);
            const preservada = (await requisicao("/auth/me", { cookie: pessoa.cookie })).corpo.assinatura;
            assert.equal(preservada.cancelamento_confirmado_em, confirmadoEm);
            assert.equal(preservada.acesso_ate, renovada.acesso_ate);
            assert.equal((await fila.processarFila()).reservadas, 0);
            await db.query("UPDATE notificacoes_email SET proxima_tentativa_em = clock_timestamp() - INTERVAL '1 second' WHERE id = $1", [notificacaoId]);
            falhar = false;
            const segundaFila = criarServicoNotificacoes({ db, configuracaoEmail, transporteEmail: transporte });
            const envios = await Promise.all([fila.processarFila(), segundaFila.processarFila()]);
            assert.equal(envios.reduce((total, item) => total + item.enviadas, 0), 1);
            assert.equal(mensagens.length, 1);
            assert.equal(tentativas.length, 2);
            assert.equal(tentativas[0].opcoes.idempotencyKey, tentativas[1].opcoes.idempotencyKey);
            assert.deepEqual(mensagens[0].to, ["cancelamento@example.invalid"]);
            assert.match(mensagens[0].text, /https:\/\/app\.example\.test\//);
            assert.doesNotMatch(mensagens[0].text, /SISTEMA_DEMANDAS_APP_URL/);
            assert.equal((await db.query("SELECT status FROM notificacoes_email WHERE id = $1", [notificacaoId])).rows[0].status, "enviado");
            assert.equal((await fila.processarFila()).reservadas, 0);
            const repetida = await requisicao(caminhoCancelamento, { metodo: "POST", cookie: admin.cookie, dados });
            assert.equal(repetida.corpo.email_confirmacao, "enviado");
            assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM notificacoes_email WHERE usuario_id = $1", [id])).rows[0].n), 1);

            assert.equal((await requisicao("/cobranca/checkout", { metodo: "POST", cookie: pessoa.cookie, dados: { plano: "mensal" } })).status, 200);
            assert.equal((await requisicao(caminhoPlano, { metodo: "POST", cookie: admin.cookie, dados: { plano: "mensal", referencia: "nova-assinatura-003" } })).status, 409);
            const { ativarAssinatura } = require("../scripts/ativar-assinatura");
            await assert.rejects(ativarAssinatura({ email: "cancelamento@example.invalid", plano: "mensal", referencia: "cancelamento-cli-sem-nova", confirmar: true }), /nova contratacao|nova-assinatura/);
            const nova = await requisicao(caminhoPlano, { metodo: "POST", cookie: admin.cookie, dados: { plano: "mensal", referencia: "nova-assinatura-003", nova_assinatura: true } });
            assert.equal(nova.status, 201);
            assert.equal(nova.corpo.pessoa.assinatura.renovacao_status, "ativa");
            assert.equal(nova.corpo.pessoa.assinatura.cancelamento_solicitado_em, null);
            assert.equal(nova.corpo.pessoa.assinatura.cancelamento_confirmado_em, null);
            assert.equal((await requisicao("/cobranca/checkout", { metodo: "POST", cookie: pessoa.cookie, dados: { plano: "mensal" } })).status, 409);
        } finally {
            if (anterior) app.locals.servicoNotificacoes = anterior;
            else delete app.locals.servicoNotificacoes;
            delete process.env.PAGBANK_LINK_MENSAL;
        }
    });

    await t.test("profissional bloqueado pode pedir cancelamento sem liberar acesso nem alterar o prazo", async () => {
        // Isola o cadastro das contas deste cenario das tentativas dos testes anteriores.
        await db.query("DELETE FROM auth_limites");
        assert.equal((await requisicao("/cobranca/cancelamento", { metodo: "POST", dados: {} })).status, 401);
        assert.equal((await requisicao("/cobranca/cancelamento", { metodo: "POST", cookie: admin.cookie, dados: {} })).status, 403);
        for (const expirada of [false, true]) {
            const pessoa = await cadastrar("Cancelamento Bloqueado", `cancelamento-bloqueado-${expirada}@example.invalid`);
            const id = pessoa.corpo.usuario.id;
            await criarDemandaLixeira(pessoa.cookie, demanda(expirada ? "7202" : "7201"));
            const ativacao = await requisicao(`/admin/pessoas/${id}/assinatura`, {
                metodo: "POST", cookie: admin.cookie,
                dados: { plano: "mensal", referencia: `cancelamento-bloqueado-pagamento-${expirada}` }
            });
            assert.equal(ativacao.status, 201);
            if (expirada) {
                await db.query("UPDATE usuarios SET teste_expira_em = CURRENT_TIMESTAMP - INTERVAL '2 days', assinatura_expira_em = CURRENT_TIMESTAMP - INTERVAL '1 day' WHERE id = $1", [id]);
            }
            await db.query("UPDATE usuarios SET bloqueado_em = CURRENT_TIMESTAMP, termos_versao = NULL, termos_aceitos_em = NULL WHERE id = $1", [id]);
            const consultarPrazos = async () => (await db.query(`SELECT teste_expira_em, assinatura_expira_em,
                bloqueado_em, termos_versao, termos_aceitos_em FROM usuarios WHERE id = $1`, [id])).rows[0];
            const antes = await consultarPrazos();
            const conta = await requisicao("/auth/me", { cookie: pessoa.cookie });
            assert.equal(conta.corpo.usuario.bloqueado, true);
            assert.equal(conta.corpo.usuario.politica_aceita, false);
            assert.equal(conta.corpo.assinatura.status, expirada ? "expirada" : "ativa");

            const pedido = await requisicao("/cobranca/cancelamento", { metodo: "POST", cookie: pessoa.cookie, dados: {} });
            assert.equal(pedido.status, 200);
            assert.equal(pedido.headers.get("cache-control"), "no-store");
            assert.equal(pedido.corpo.assinatura.renovacao_status, "cancelamento_solicitado");
            assert.equal(pedido.corpo.assinatura.status, conta.corpo.assinatura.status);
            assert.equal(pedido.corpo.assinatura.acesso_ate, conta.corpo.assinatura.acesso_ate);
            assert.equal(pedido.corpo.assinatura.cancelamento_confirmado_em, null);
            assert.deepEqual(await consultarPrazos(), antes);
            assert.equal((await requisicao("/cobranca/checkout", { metodo: "POST", cookie: pessoa.cookie, dados: { plano: "mensal" } })).status, 403);
            assert.equal((await requisicao("/cobranca/status", { cookie: pessoa.cookie })).status, 403);
            assert.equal((await requisicao("/cobranca/boas-vindas", { metodo: "POST", cookie: pessoa.cookie, dados: { escolha: "teste" } })).status, 403);
            assert.equal((await requisicao("/demandas", { cookie: pessoa.cookie })).status, 403);
            assert.equal((await requisicao("/demandas", { metodo: "POST", cookie: pessoa.cookie, dados: demanda("7203") })).status, 403);
            assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM demandas WHERE usuario_id = $1", [id])).rows[0].n), 1);
        }
    });

    await t.test("redefinicao impede login antigo pausado de emitir uma nova sessao", async () => {
        await comRecuperacao(async contexto => {
            const pessoa = await cadastrar("Concorrencia Login", "concorrencia-login@example.invalid");
            const id = pessoa.corpo.usuario.id;
            const token = await solicitarToken("concorrencia-login@example.invalid", contexto);
            const hashAnterior = (await db.query("SELECT senha_hash FROM usuarios WHERE id = $1", [id])).rows[0].senha_hash;
            const authModel = require("../models/authModel");
            const emitirSessaoOriginal = authModel.criarSessao;
            let avisarPausa;
            let liberarEmissao;
            let pausou = false;
            let loginPendente;
            let limiteEspera;
            const chegouAoEmissor = new Promise(resolve => { avisarPausa = resolve; });
            const emissaoLiberada = new Promise(resolve => { liberarEmissao = resolve; });
            authModel.criarSessao = async function (...args) {
                // O controlador ja verificou a senha antiga; a emissao real ainda nao ocorreu.
                if (args[0] === id && !pausou) {
                    pausou = true;
                    avisarPausa();
                    await emissaoLiberada;
                }
                return emitirSessaoOriginal.apply(this, args);
            };
            try {
                const android = { Origin: "capacitor://localhost", "X-App-Client": "android" };
                loginPendente = requisicao("/auth/login", { metodo: "POST", headers: android,
                    dados: { email: "concorrencia-login@example.invalid", senha } });
                await Promise.race([
                    chegouAoEmissor,
                    loginPendente.then(() => { throw new Error("O login terminou antes de atingir a barreira de emissao."); }),
                    new Promise((resolve, reject) => {
                        limiteEspera = setTimeout(() => reject(new Error("O login nao atingiu a barreira de emissao em 15 segundos.")), 15000);
                    })
                ]);
                clearTimeout(limiteEspera);
                const novaSenha = "Nova-senha-concorrencia-123";
                const redefinida = await requisicao("/auth/redefinir-senha", { metodo: "POST", dados: { token, senha: novaSenha } });
                assert.equal(redefinida.status, 200);
                const hashAtual = (await db.query("SELECT senha_hash FROM usuarios WHERE id = $1", [id])).rows[0].senha_hash;
                assert.ok(hashAtual !== hashAnterior, "A redefinicao deve concluir a troca do hash antes de liberar o login antigo.");
                assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM sessoes WHERE usuario_id = $1", [id])).rows[0].n), 0);
                liberarEmissao();
                const antigo = await loginPendente;
                assert.equal(antigo.status, 401, "Uma senha verificada antes da redefinicao nao pode emitir sessao depois dela.");
                assert.equal(antigo.headers.get("set-cookie"), null);
                assert.equal(antigo.corpo.token, undefined);
                assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM sessoes WHERE usuario_id = $1", [id])).rows[0].n), 0);
                assert.equal((await requisicao("/auth/me", { cookie: pessoa.cookie })).status, 401);
                assert.equal((await requisicao("/auth/login", { metodo: "POST", dados: { email: "concorrencia-login@example.invalid", senha } })).status, 401);
                const atual = await requisicao("/auth/login", { metodo: "POST", dados: { email: "concorrencia-login@example.invalid", senha: novaSenha } });
                assert.equal(atual.status, 200);
                assert.equal(atual.corpo.token, undefined);
                assert.match(atual.headers.get("set-cookie"), /HttpOnly/i);
                assert.equal((await requisicao("/auth/me", { cookie: atual.headers.get("set-cookie").split(";")[0] })).corpo.usuario.id, id);
                const nativo = await requisicao("/auth/login", { metodo: "POST", headers: android,
                    dados: { email: "concorrencia-login@example.invalid", senha: novaSenha } });
                assert.equal(nativo.status, 200);
                assert.ok(typeof nativo.corpo.token === "string" && /^[a-f0-9]{64}$/.test(nativo.corpo.token), "O login Android deve preservar o token de sessao.");
                assert.equal((await requisicao("/auth/me", { headers: { Authorization: `Bearer ${nativo.corpo.token}` } })).corpo.usuario.id, id);
            } finally {
                clearTimeout(limiteEspera);
                liberarEmissao();
                if (loginPendente) await loginPendente.catch(() => {});
                authModel.criarSessao = emitirSessaoOriginal;
            }
        });
    });

    await t.test("lixeira preserva a demanda, oculta listas e alertas e permite restaurar apenas a propria", async () => {
        const pessoa = await cadastrar("Lixeira Restauracao", "lixeira-restauracao@example.invalid");
        const outra = await cadastrar("Lixeira Isolada", "lixeira-isolada@example.invalid");
        const criada = await criarDemandaLixeira(pessoa.cookie, { ...demanda("901"), excluida_em: "2000-01-01T00:00:00Z" });
        const ativa = await criarDemandaLixeira(pessoa.cookie, demanda("902"));
        const antes = (await db.query("SELECT * FROM demandas WHERE id = $1", [criada.id])).rows[0];
        assert.equal(antes.excluida_em, null, "O cadastro nao deve aceitar uma data de exclusao fornecida pelo cliente.");
        assert.equal((await db.query("SELECT excluida_em FROM demandas WHERE numero_demanda = '999'")).rows[0].excluida_em, null);

        assert.equal((await requisicao(`/demandas/${criada.id}`, { metodo: "DELETE", cookie: outra.cookie })).status, 404);
        assert.equal((await requisicao(`/demandas/${criada.id}`, { metodo: "DELETE", cookie: pessoa.cookie })).status, 200);
        assert.equal((await requisicao(`/demandas/${criada.id}`, { metodo: "DELETE", cookie: pessoa.cookie })).status, 404);
        const movida = (await db.query("SELECT * FROM demandas WHERE id = $1", [criada.id])).rows[0];
        assert.ok(movida.excluida_em instanceof Date && Number.isFinite(movida.excluida_em.getTime()));
        assert.deepEqual({ ...movida, excluida_em: null }, antes, "Mover para a lixeira deve preservar os dados da demanda.");

        const normais = await requisicao("/demandas", { cookie: pessoa.cookie });
        const alertas = await requisicao("/demandas/vencendo-amanha", { cookie: pessoa.cookie });
        assert.equal(normais.status, 200);
        assert.equal(alertas.status, 200);
        assert.deepEqual(normais.corpo.map(item => item.id), [ativa.id]);
        assert.deepEqual(alertas.corpo.map(item => item.id), [ativa.id]);
        const lixeira = await requisicao("/demandas/lixeira", { cookie: pessoa.cookie });
        assert.equal(lixeira.status, 200);
        assert.deepEqual(lixeira.corpo.map(item => item.id), [criada.id]);
        assert.ok(Number.isFinite(Date.parse(lixeira.corpo[0].excluida_em)));
        assert.deepEqual((await requisicao("/demandas/lixeira", { cookie: outra.cookie })).corpo, []);
        const exportacao = await requisicao("/privacidade/dados", { cookie: pessoa.cookie });
        assert.equal(exportacao.status, 200);
        const copiaExcluida = exportacao.corpo.demandas.find(item => item.id === criada.id);
        assert.ok(copiaExcluida, "A exportacao de dados proprios deve incluir as demandas ainda retidas na lixeira.");
        assert.ok(Number.isFinite(Date.parse(copiaExcluida.excluida_em)));

        assert.equal((await requisicao(`/demandas/${criada.id}`, { metodo: "PUT", cookie: pessoa.cookie,
            dados: { ...demanda("901"), assunto: "Alteracao indevida", excluida_em: null } })).status, 404);
        assert.equal((await requisicao(`/demandas/${criada.id}/restaurar`, { metodo: "POST", cookie: outra.cookie,
            dados: { usuario_id: pessoa.corpo.usuario.id } })).status, 404);
        const restaurada = await requisicao(`/demandas/${criada.id}/restaurar`, { metodo: "POST", cookie: pessoa.cookie });
        assert.equal(restaurada.status, 200);
        assert.equal(restaurada.corpo.demanda.id, criada.id);
        assert.equal(restaurada.corpo.demanda.excluida_em, null);
        assert.deepEqual((await db.query("SELECT * FROM demandas WHERE id = $1", [criada.id])).rows[0], antes);
        assert.deepEqual((await requisicao("/demandas/lixeira", { cookie: pessoa.cookie })).corpo, []);
        assert.deepEqual((await requisicao("/demandas", { cookie: pessoa.cookie })).corpo.map(item => item.id).sort((a, b) => a - b), [criada.id, ativa.id].sort((a, b) => a - b));
        assert.deepEqual((await requisicao("/demandas/vencendo-amanha", { cookie: pessoa.cookie })).corpo.map(item => item.id).sort((a, b) => a - b), [criada.id, ativa.id].sort((a, b) => a - b));
        assert.equal((await requisicao(`/demandas/${criada.id}/restaurar`, { metodo: "POST", cookie: pessoa.cookie })).status, 404);
        for (const idInvalido of ["abc", "0"]) {
            assert.equal((await requisicao(`/demandas/${idInvalido}`, { metodo: "DELETE", cookie: pessoa.cookie })).status, 400);
            assert.equal((await requisicao(`/demandas/${idInvalido}/restaurar`, { metodo: "POST", cookie: pessoa.cookie })).status, 400);
        }
    });

    await t.test("esvaziar lixeira apaga fisicamente apenas as proprias excluidas e preserva ativas, outras contas e legado", async () => {
        const pessoa = await cadastrar("Lixeira Exclusao", "lixeira-exclusao@example.invalid");
        const outra = await cadastrar("Lixeira Outra Conta", "lixeira-outra-conta@example.invalid");
        const primeira = await criarDemandaLixeira(pessoa.cookie, demanda("911"));
        const segunda = await criarDemandaLixeira(pessoa.cookie, demanda("912"));
        const ativa = await criarDemandaLixeira(pessoa.cookie, demanda("913"));
        const alheia = await criarDemandaLixeira(outra.cookie, demanda("914"));
        const ativaAlheia = await criarDemandaLixeira(outra.cookie, demanda("915"));
        for (const [item, cookie] of [[primeira, pessoa.cookie], [segunda, pessoa.cookie], [alheia, outra.cookie]]) {
            assert.equal((await requisicao(`/demandas/${item.id}`, { metodo: "DELETE", cookie })).status, 200);
        }

        const esvaziada = await requisicao("/demandas/lixeira", { metodo: "DELETE", cookie: pessoa.cookie,
            dados: { usuario_id: outra.corpo.usuario.id, id: alheia.id } });
        assert.equal(esvaziada.status, 200);
        assert.equal(esvaziada.corpo.excluidas, 2);
        assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM demandas WHERE id = ANY($1::int[])", [[primeira.id, segunda.id]])).rows[0].n), 0);
        const preservadas = (await db.query("SELECT id, excluida_em FROM demandas WHERE id = ANY($1::int[]) ORDER BY id", [[ativa.id, alheia.id, ativaAlheia.id]])).rows;
        assert.deepEqual(preservadas.map(item => item.id), [ativa.id, alheia.id, ativaAlheia.id].sort((a, b) => a - b));
        assert.equal(preservadas.find(item => item.id === ativa.id).excluida_em, null);
        assert.notEqual(preservadas.find(item => item.id === alheia.id).excluida_em, null);
        assert.equal(preservadas.find(item => item.id === ativaAlheia.id).excluida_em, null);
        assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM demandas WHERE numero_demanda = '999' AND usuario_id IS NULL")).rows[0].n), 1);
        assert.deepEqual((await requisicao("/demandas/lixeira", { cookie: pessoa.cookie })).corpo, []);
        assert.deepEqual((await requisicao("/demandas", { cookie: pessoa.cookie })).corpo.map(item => item.id), [ativa.id]);
        assert.deepEqual((await requisicao("/demandas/lixeira", { cookie: outra.cookie })).corpo.map(item => item.id), [alheia.id]);
        assert.deepEqual((await requisicao("/demandas", { cookie: outra.cookie })).corpo.map(item => item.id), [ativaAlheia.id]);
        const repetida = await requisicao("/demandas/lixeira", { metodo: "DELETE", cookie: pessoa.cookie });
        assert.equal(repetida.status, 200);
        assert.equal(repetida.corpo.excluidas, 0);
        assert.equal((await requisicao(`/demandas/${primeira.id}/restaurar`, { metodo: "POST", cookie: pessoa.cookie })).status, 404);
    });

    await t.test("lixeira exige sessao, conta profissional e acesso vigente antes de ler ou apagar dados", async () => {
        const pessoa = await cadastrar("Lixeira Expirada", "lixeira-expirada@example.invalid");
        const criada = await criarDemandaLixeira(pessoa.cookie, demanda("921"));
        assert.equal((await requisicao(`/demandas/${criada.id}`, { metodo: "DELETE", cookie: pessoa.cookie })).status, 200);
        const rotas = [
            { caminho: "/demandas/lixeira", metodo: "GET" },
            { caminho: "/demandas/lixeira", metodo: "DELETE" },
            { caminho: `/demandas/${criada.id}/restaurar`, metodo: "POST" }
        ];
        for (const { caminho, metodo } of rotas) {
            assert.equal((await requisicao(caminho, { metodo })).status, 401);
            assert.equal((await requisicao(caminho, { metodo, cookie: admin.cookie })).status, 403);
        }
        await db.query("UPDATE usuarios SET teste_expira_em = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE id = $1", [pessoa.corpo.usuario.id]);
        for (const { caminho, metodo } of rotas) {
            assert.equal((await requisicao(caminho, { metodo, cookie: pessoa.cookie })).status, 402);
        }
        const preservada = (await db.query("SELECT excluida_em FROM demandas WHERE id = $1", [criada.id])).rows[0];
        assert.notEqual(preservada.excluida_em, null);
        await db.query("UPDATE usuarios SET acesso_permanente = TRUE WHERE id = $1", [pessoa.corpo.usuario.id]);
        const liberada = await requisicao("/demandas/lixeira", { cookie: pessoa.cookie });
        assert.equal(liberada.status, 200);
        assert.deepEqual(liberada.corpo.map(item => item.id), [criada.id]);
    });

    await t.test("excluir tudo move todas as ativas da propria conta sem apagar dados nem modificar lixeira existente", async () => {
        const pessoa = await cadastrar("Lixeira Todas", "lixeira-todas@example.invalid");
        const outra = await cadastrar("Lixeira Todas Isolamento", "lixeira-todas-isolamento@example.invalid");
        const primeira = await criarDemandaLixeira(pessoa.cookie, demanda("931"));
        const concluida = await criarDemandaLixeira(pessoa.cookie, { ...demanda("932"), regional: "Campinas", concluida: true });
        const jaExcluida = await criarDemandaLixeira(pessoa.cookie, demanda("933"));
        const alheia = await criarDemandaLixeira(outra.cookie, demanda("934"));
        const excluidaAlheia = await criarDemandaLixeira(outra.cookie, demanda("935"));
        assert.equal((await requisicao(`/demandas/${jaExcluida.id}`, { metodo: "DELETE", cookie: pessoa.cookie })).status, 200);
        assert.equal((await requisicao(`/demandas/${excluidaAlheia.id}`, { metodo: "DELETE", cookie: outra.cookie })).status, 200);
        const ids = [primeira.id, concluida.id, jaExcluida.id, alheia.id, excluidaAlheia.id];
        const lerRegistros = async () => (await db.query("SELECT * FROM demandas WHERE id = ANY($1::int[]) ORDER BY id", [ids])).rows;
        const antes = await lerRegistros();
        const legadoAntes = (await db.query("SELECT * FROM demandas WHERE numero_demanda = '999' AND usuario_id IS NULL")).rows;
        const caminho = "/demandas/lixeira/todas";
        assert.equal((await requisicao(caminho, { metodo: "POST", dados: {} })).status, 401);
        assert.equal((await requisicao(caminho, { metodo: "POST", cookie: admin.cookie, dados: {} })).status, 403);
        assert.equal((await requisicao(caminho, { metodo: "POST", cookie: pessoa.cookie, dados: {}, headers: { Origin: "https://origem-nao-autorizada.example.invalid" } })).status, 403);
        await db.query("UPDATE usuarios SET teste_expira_em = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE id = $1", [pessoa.corpo.usuario.id]);
        assert.equal((await requisicao(caminho, { metodo: "POST", cookie: pessoa.cookie, dados: {} })).status, 402);
        assert.deepEqual(await lerRegistros(), antes, "Tentativas sem permissao nao podem mover nem apagar demandas.");
        await db.query("UPDATE usuarios SET acesso_permanente = TRUE WHERE id = $1", [pessoa.corpo.usuario.id]);

        const movidas = await requisicao(caminho, { metodo: "POST", cookie: pessoa.cookie, dados: {} });
        assert.equal(movidas.status, 200);
        assert.equal(movidas.corpo.movidas, 2, "Todas as ativas, inclusive concluidas ou de outra regional, devem ir para a lixeira.");
        const depois = await lerRegistros();
        assert.equal(depois.length, antes.length, "Excluir tudo deve mover os registros, sem exclusao fisica.");
        for (const original of antes) {
            const atual = depois.find(item => item.id === original.id);
            if (original.id === primeira.id || original.id === concluida.id) {
                assert.ok(atual.excluida_em instanceof Date && Number.isFinite(atual.excluida_em.getTime()));
                assert.deepEqual({ ...atual, excluida_em: null }, original);
            } else {
                assert.deepEqual(atual, original, "Demandas alheias e datas de exclusao anteriores devem permanecer intactas.");
            }
        }
        assert.deepEqual((await db.query("SELECT * FROM demandas WHERE numero_demanda = '999' AND usuario_id IS NULL")).rows, legadoAntes);
        assert.deepEqual((await requisicao("/demandas", { cookie: pessoa.cookie })).corpo, []);
        assert.deepEqual((await requisicao("/demandas/vencendo-amanha", { cookie: pessoa.cookie })).corpo, []);
        assert.deepEqual((await requisicao("/demandas/lixeira", { cookie: pessoa.cookie })).corpo.map(item => item.id).sort((a,b)=>a-b), [primeira.id, concluida.id, jaExcluida.id].sort((a,b)=>a-b));
        assert.deepEqual((await requisicao("/demandas", { cookie: outra.cookie })).corpo.map(item => item.id), [alheia.id]);
        const repetida = await requisicao(caminho, { metodo: "POST", cookie: pessoa.cookie, dados: {} });
        assert.equal(repetida.status, 200);
        assert.equal(repetida.corpo.movidas, 0);
        assert.deepEqual(await lerRegistros(), depois, "Repetir a operacao nao deve alterar datas nem registros ja na lixeira.");
    });

    await t.test("excluir cadastro exige confirmacao e apaga so o titular com assinatura recorrente sem revogar outras contas", async () => {
        await comRecuperacao(async contexto => {
            const pessoa = await cadastrar("Excluir Cadastro", "excluir-cadastro@example.invalid");
            const outra = await cadastrar("Preservar Cadastro", "preservar-cadastro@example.invalid");
            const id = pessoa.corpo.usuario.id;
            const referencia = "excluir-cadastro-pagamento-001";
            await criarDemandaLixeira(pessoa.cookie, demanda("9401"));
            const lixeira = await criarDemandaLixeira(pessoa.cookie, demanda("9402"));
            await criarDemandaLixeira(outra.cookie, demanda("9403"));
            assert.equal((await requisicao(`/demandas/${lixeira.id}`, { metodo: "DELETE", cookie: pessoa.cookie })).status, 200);
            assert.equal((await requisicao(`/admin/pessoas/${id}/assinatura`, {
                metodo: "POST", cookie: admin.cookie, dados: { plano: "mensal", referencia }
            })).status, 201);
            assert.equal((await requisicao("/privacidade/solicitacoes", {
                metodo: "POST", cookie: pessoa.cookie, dados: { tipo: "acesso", descricao: "Preciso consultar os meus dados completos." }
            })).status, 201);
            await db.query(`INSERT INTO notificacoes_email (usuario_id, evento, chave_unica, destinatario, assunto, texto, html)
                VALUES ($1, 'teste_exclusao', 'teste-exclusao-cadastro', $2, 'Mensagem de teste', 'Mensagem pendente de teste', '<p>Mensagem pendente de teste</p>')`,
            [id, pessoa.corpo.usuario.email]);
            const android = await requisicao("/auth/login", {
                metodo: "POST", headers: { Origin: "capacitor://localhost", "X-App-Client": "android" },
                dados: { email: pessoa.corpo.usuario.email, senha }
            });
            assert.equal(android.status, 200);
            assert.match(android.corpo.token, /^[a-f0-9]{64}$/);
            const tokenRedefinicao = await solicitarToken(pessoa.corpo.usuario.email, contexto);
            const chavesEmail = [`login:email:${pessoa.corpo.usuario.email}`, `redefinicao:solicitar:email:${pessoa.corpo.usuario.email}`]
                .map(chave => createHash("sha256").update(chave).digest("hex"));
            assert.equal((await db.query("SELECT chave FROM auth_limites WHERE chave IN ($1, $2)", chavesEmail)).rows.length, 2);
            const limitesOutrosAntes = (await db.query("SELECT * FROM auth_limites WHERE chave NOT IN ($1, $2) ORDER BY chave", chavesEmail)).rows;
            const antes = await registrosDaConta(id);
            assert.equal(antes.usuarios[0].assinatura_plano, "mensal");
            assert.equal(antes.usuarios[0].cancelamento_confirmado_em, null);
            assert.equal(antes.demandas.length, 2);
            assert.ok(antes.demandas.some(item => item.excluida_em));
            assert.equal(antes.sessoes.length, 2);
            for (const tabela of ["redefinicoes_senha", "solicitacoes_privacidade", "ativacoes_assinatura", "notificacoes_email", "acoes_administrativas"]) {
                assert.ok(antes[tabela].length > 0, `O cenario precisa conter dados em ${tabela}.`);
            }
            const outrosAntes = await registrosDaConta(id, true);
            const caminho = "/privacidade/conta";
            assert.equal((await requisicao(caminho, { metodo: "DELETE", dados: { confirmar: true } })).status, 401);
            assert.equal((await requisicao(caminho, { metodo: "DELETE", cookie: admin.cookie, dados: { confirmar: true } })).status, 403);
            assert.equal((await requisicao(caminho, { metodo: "DELETE", cookie: pessoa.cookie, dados: { confirmar: true }, headers: { Origin: "https://origem-nao-autorizada.example.invalid" } })).status, 403);
            assert.equal((await requisicao(caminho, { metodo: "DELETE", cookie: pessoa.cookie, dados: { confirmar: true }, headers: { "X-Usuario-Id": String(outra.corpo.usuario.id) } })).status, 401);
            for (const confirmar of [undefined, false, "true", 1, null]) {
                const invalida = await requisicao(caminho, { metodo: "DELETE", cookie: pessoa.cookie, dados: { confirmar } });
                assert.equal(invalida.status, 400);
                assert.equal(invalida.corpo.codigo, "CONFIRMACAO_NECESSARIA");
            }
            assert.deepEqual(await registrosDaConta(id), antes, "Sem confirmacao todos os dados e acessos devem permanecer intactos.");

            const excluida = await requisicao(`${caminho}?usuario_id=${outra.corpo.usuario.id}`, {
                metodo: "DELETE", cookie: pessoa.cookie,
                dados: { confirmar: true, usuario_id: outra.corpo.usuario.id, id: outra.corpo.usuario.id }
            });
            assert.equal(excluida.status, 200);
            assert.equal(excluida.corpo.excluida, true);
            assert.equal(excluida.headers.get("set-cookie"), null, "Excluir nao deve apagar um cookie mais novo de outra aba.");
            for (const [tabela, registros] of Object.entries(await registrosDaConta(id))) {
                assert.deepEqual(registros, [], `A exclusao deve remover os dados proprios em ${tabela}.`);
            }
            assert.deepEqual(await registrosDaConta(id, true), outrosAntes, "Contas, demandas, sessoes e registros de terceiros devem permanecer intactos.");
            assert.deepEqual((await db.query("SELECT chave FROM auth_limites WHERE chave IN ($1, $2)", chavesEmail)).rows, []);
            assert.deepEqual((await db.query("SELECT * FROM auth_limites WHERE chave NOT IN ($1, $2) ORDER BY chave", chavesEmail)).rows, limitesOutrosAntes, "Limites de IP e de outros e-mails devem ser preservados.");
            assert.equal((await requisicao("/auth/me", { cookie: pessoa.cookie })).status, 401);
            assert.equal((await requisicao("/auth/me", { headers: { Authorization: `Bearer ${android.corpo.token}` } })).status, 401);
            assert.equal((await requisicao(caminho, { metodo: "DELETE", cookie: pessoa.cookie, dados: { confirmar: true } })).status, 401);
            assert.equal((await requisicao("/auth/redefinir-senha", { metodo: "POST", dados: { token: tokenRedefinicao, senha: "Senha-apos-exclusao-123" } })).status, 400);
            assert.equal((await requisicao("/auth/login", { metodo: "POST", dados: { email: pessoa.corpo.usuario.email, senha } })).status, 401);
            assert.equal((await requisicao("/auth/me", { cookie: outra.cookie })).status, 200);
            assert.equal((await requisicao("/admin/pessoas", { cookie: admin.cookie })).status, 200);

            const outraAntes = (await requisicao("/auth/me", { cookie: outra.cookie })).corpo.assinatura;
            const reutilizada = await requisicao(`/admin/pessoas/${outra.corpo.usuario.id}/assinatura`, {
                metodo: "POST", cookie: admin.cookie, dados: { plano: "mensal", referencia }
            });
            assert.equal(reutilizada.status, 409, "Apagar a conta nao pode permitir reutilizar um pagamento antigo.");
            assert.equal(reutilizada.corpo.codigo, "REFERENCIA_UTILIZADA");
            assert.deepEqual((await requisicao("/auth/me", { cookie: outra.cookie })).corpo.assinatura, outraAntes);
            const referencias = (await db.query("SELECT referencia_hash FROM referencias_pagamento_excluidas WHERE referencia_hash = $1", [createHash("sha256").update(referencia).digest("hex")])).rows;
            assert.equal(referencias.length, 1);
            assert.doesNotMatch(JSON.stringify(referencias), /excluir-cadastro@example|excluir-cadastro-pagamento/);
        });
    });

    await t.test("exclusao direta continua disponivel com acesso expirado bloqueio e aceite pendente", async () => {
        await db.query("DELETE FROM auth_limites");
        const pessoa = await cadastrar("Excluir Expirada", "excluir-expirada@example.invalid");
        const id = pessoa.corpo.usuario.id;
        await criarDemandaLixeira(pessoa.cookie, demanda("9411"));
        await db.query(`UPDATE usuarios SET teste_expira_em = CURRENT_TIMESTAMP - INTERVAL '1 day',
            bloqueado_em = CURRENT_TIMESTAMP, termos_versao = NULL, termos_aceitos_em = NULL WHERE id = $1`, [id]);
        const conta = await requisicao("/auth/me", { cookie: pessoa.cookie });
        assert.equal(conta.corpo.assinatura.status, "expirada");
        assert.equal(conta.corpo.usuario.bloqueado, true);
        assert.equal(conta.corpo.usuario.politica_aceita, false);
        assert.equal((await requisicao("/privacidade/conta", { metodo: "DELETE", cookie: pessoa.cookie, dados: { confirmar: true } })).status, 200);
        assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM usuarios WHERE id = $1", [id])).rows[0].n), 0);
        assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM demandas WHERE usuario_id = $1", [id])).rows[0].n), 0);
        assert.equal((await requisicao("/auth/me", { cookie: pessoa.cookie })).status, 401);
    });

    await t.test("falha ao concluir exclusao reverte dados sessoes e reserva da referencia de pagamento", async () => {
        const { criarServicoPrivacidade } = require("../services/privacidadeService");
        await db.query("DELETE FROM auth_limites");
        const pessoa = await cadastrar("Excluir Rollback", "excluir-rollback@example.invalid");
        const id = pessoa.corpo.usuario.id;
        const referencia = "excluir-rollback-pagamento-001";
        await criarDemandaLixeira(pessoa.cookie, demanda("9421"));
        assert.equal((await requisicao(`/admin/pessoas/${id}/assinatura`, {
            metodo: "POST", cookie: admin.cookie, dados: { plano: "mensal", referencia }
        })).status, 201);
        assert.equal((await requisicao("/privacidade/solicitacoes", {
            metodo: "POST", cookie: pessoa.cookie, dados: { tipo: "acesso", descricao: "Solicito acesso aos registros da minha conta." }
        })).status, 201);
        const antes = await registrosDaConta(id);
        const servico = criarServicoPrivacidade({ inicializar: async () => {}, db: {
            connect: async () => {
                const client = await db.connect();
                return {
                    query: async (sql, parametros) => {
                        if (sql === "DELETE FROM usuarios WHERE id = $1") throw new Error("Falha sintetica antes de concluir exclusao");
                        return client.query(sql, parametros);
                    },
                    release: () => client.release()
                };
            }
        } });
        await assert.rejects(servico.excluirConta(id, true), /Falha sintetica antes de concluir exclusao/);
        assert.deepEqual(await registrosDaConta(id), antes, "Uma falha tardia deve preservar integralmente a conta.");
        assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM referencias_pagamento_excluidas WHERE referencia_hash = $1", [createHash("sha256").update(referencia).digest("hex")])).rows[0].n), 0);
        assert.equal((await requisicao("/auth/me", { cookie: pessoa.cookie })).status, 200);
        assert.equal((await requisicao("/demandas", { cookie: pessoa.cookie })).corpo.length, 1);
    });
});
