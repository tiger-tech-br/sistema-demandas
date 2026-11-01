const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { once } = require("node:events");
const { iniciarPostgresTemporario } = require("./helpers/postgres");

let cluster;
let db;
let server;
let base;
let alice;
let bruno;
let admin;
let carla;
let vencimento;

const senha = "Senha-de-teste-123";

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
    const resposta = await requisicao("/auth/cadastro", { metodo: "POST", dados: { nome, email, senha, ...extras } });
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

before(async () => {
    cluster = await iniciarPostgresTemporario();
    // Este arquivo nunca carrega .env nem usa a conexao do aplicativo real.
    for (const chave of Object.keys(process.env)) {
        if (chave.startsWith("DB_") || chave.startsWith("PGBANK_") || chave.startsWith("PAGBANK_")) delete process.env[chave];
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
    const app = require("../app");
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
        alice = await cadastrar("Alice Teste", "ALICE@example.com", { papel: "admin", admin: true, role: "admin" });
        bruno = await cadastrar("Bruno Teste", "bruno@example.com");
        assert.equal(alice.corpo.usuario.email, "alice@example.com");
        assert.equal(alice.corpo.usuario.papel, "profissional");
        assert.equal(alice.corpo.usuario.bloqueado, false);
        assert.equal((await db.query("SELECT papel FROM usuarios WHERE id = $1", [alice.corpo.usuario.id])).rows[0].papel, "profissional");
        assert.equal(alice.corpo.assinatura.status, "teste");
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
        assert.equal((await requisicao("/auth/cadastro", { metodo: "POST", dados: { nome: "Alice", email: "alice@example.com", senha } })).status, 409);
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
        assert.equal((await requisicao("/cobranca/checkout", { metodo: "POST", cookie: bruno.cookie, dados: { plano: "mensal" } })).status, 409);
        await db.query("UPDATE usuarios SET teste_expira_em = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE id = $1", [alice.corpo.usuario.id]);
        assert.equal((await requisicao("/auth/me", { cookie: alice.cookie })).corpo.assinatura.status, "expirada");
        assert.equal((await requisicao("/demandas", { cookie: alice.cookie })).status, 402);
        assert.equal((await requisicao("/demandas", { metodo: "POST", cookie: alice.cookie, dados: demanda("404") })).status, 402);
        assert.equal((await requisicao("/cobranca/checkout", { metodo: "POST", cookie: alice.cookie, dados: { plano: "gratis", valor_centavos: 0 } })).status, 400);
        assert.equal((await requisicao("/cobranca/checkout", { metodo: "POST", cookie: alice.cookie, dados: { plano: "mensal" } })).status, 503);
        process.env.PAGBANK_LINK_MENSAL = "https://pag.ae/link-mensal-teste";
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
});
