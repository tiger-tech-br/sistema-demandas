const test = require("node:test");
const assert = require("node:assert/strict");
const {
    validarLinkPagBank,
    obterLinkDoPlano,
    planoValido,
    obterStatusCobranca
} = require("../services/pagbankService");

test("links de assinatura aceitam apenas destinos HTTPS do PagBank", () => {
    for (const link of [
        "https://pag.ae/plano-mensal",
        "https://pagamento.pagbank.com.br/pagamento?code=plano",
        "https://pagseguro.uol.com.br/pre-approvals/request.html?code=plano"
    ]) {
        assert.equal(validarLinkPagBank(link), link);
    }

    for (const link of [
        undefined, "", "não é uma URL", "https://pag.ae/", "http://pag.ae/plano",
        "https://pag.ae.evil.test/plano", "https://evil.test/?pag.ae",
        "https://pag.ae@evil.test/plano", "https://usuario:senha@pag.ae/plano",
        "https://pag.ae:8443/plano", "javascript:alert(1)",
        "https://pag.ae/plano#destino", "https://localhost/plano"
    ]) {
        assert.equal(validarLinkPagBank(link), null, String(link));
    }
});

test("plano recebido do navegador não pode escolher outro destino ou valor", () => {
    const ambiente = {
        PAGBANK_LINK_MENSAL: "https://pag.ae/mensal",
        PAGBANK_LINK_ANUAL: "https://pag.ae/anual"
    };

    assert.equal(obterLinkDoPlano("mensal", ambiente), ambiente.PAGBANK_LINK_MENSAL);
    assert.equal(obterLinkDoPlano("anual", ambiente), ambiente.PAGBANK_LINK_ANUAL);

    for (const plano of ["gratuito", "__proto__", "constructor", "https://evil.test/", null, {}]) {
        assert.equal(planoValido(plano), false);
        assert.equal(obterLinkDoPlano(plano, ambiente), null);
    }
});

test("configuração ausente ou inválida não oferece pagamento nem simula confirmação", () => {
    const status = obterStatusCobranca({ status: "expirada" }, {
        PAGBANK_LINK_MENSAL: "https://evil.test/falso"
    });

    assert.equal(status.disponivel, false);
    assert.equal(status.pode_assinar, false);
    assert.equal(status.confirmacao_automatica, false);
    assert.deepEqual(status.planos, [
        { id: "mensal", disponivel: false },
        { id: "anual", disponivel: false }
    ]);
});

test("contratacao permite o teste e impede duplicar cobranca recorrente ativa", () => {
    const ambiente = { PAGBANK_LINK_MENSAL: "https://pag.ae/mensal" };

    for (const assinatura of [
        { status: "ativa", plano: "mensal", renovacao_status: "ativa" },
        { status: "expirada", plano: "anual", renovacao_status: "ativa" },
        { status: "expirada", plano: "mensal", renovacao_status: "cancelamento_solicitado" },
        { status: "teste", plano: null, exclusao_solicitada_em: "2026-11-03T12:00:00.000Z" },
        { status: "ativa", plano: "mensal", renovacao_status: "cancelada", exclusao_solicitada_em: "2026-11-03T12:00:00.000Z" },
        { status: "gratuita", plano: null, acesso_permanente: true }
    ]) {
        const cobranca = obterStatusCobranca(assinatura, ambiente);
        assert.equal(cobranca.disponivel, true);
        assert.equal(cobranca.pode_assinar, false);
        assert.equal(cobranca.confirmacao_automatica, false);
    }

    for (const assinatura of [{ status: "teste", plano: null }, { status: "expirada", plano: null }, { status: "expirada", plano: "anual", renovacao_status: "cancelada" }]) {
        assert.equal(obterStatusCobranca(assinatura, ambiente).pode_assinar, true);
    }
});
