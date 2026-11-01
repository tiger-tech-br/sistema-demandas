const VARIAVEIS_POR_PLANO = Object.freeze({
    mensal: "PAGBANK_LINK_MENSAL",
    anual: "PAGBANK_LINK_ANUAL"
});

const HOSTS_PAGBANK = new Set([
    "pag.ae",
    "pagamento.pagbank.com.br",
    "pagseguro.uol.com.br"
]);

function validarLinkPagBank(valor) {
    if (typeof valor !== "string" || !valor.trim()) {
        return null;
    }

    try {
        const url = new URL(valor.trim());

        if (
            url.protocol !== "https:" ||
            !HOSTS_PAGBANK.has(url.hostname) ||
            url.username || url.password || url.port ||
            url.pathname === "/" || url.hash
        ) {
            return null;
        }

        return url.href;
    } catch {
        return null;
    }
}

function obterLinkDoPlano(plano, ambiente = process.env) {
    if (!Object.hasOwn(VARIAVEIS_POR_PLANO, plano)) {
        return null;
    }

    return validarLinkPagBank(ambiente[VARIAVEIS_POR_PLANO[plano]]);
}

function planoValido(plano) {
    return typeof plano === "string" && Object.hasOwn(VARIAVEIS_POR_PLANO, plano);
}

function podeContratar(assinatura) {
    // O vencimento local nao significa que o mandato recorrente no PagBank acabou.
    // Exigir o cancelamento confirmado evita duas cobrancas recorrentes paralelas.
    return Boolean(assinatura) && !assinatura.acesso_permanente &&
        (!assinatura.plano || assinatura.renovacao_status === "cancelada");
}

function obterStatusCobranca(assinatura, ambiente = process.env) {
    const planos = Object.keys(VARIAVEIS_POR_PLANO).map((id) => ({
        id,
        disponivel: Boolean(obterLinkDoPlano(id, ambiente))
    }));
    const disponivel = planos.some((plano) => plano.disponivel);

    return {
        provedor: "pagbank",
        modo: "link_recorrente",
        disponivel,
        confirmacao_automatica: false,
        pode_assinar: podeContratar(assinatura) && disponivel,
        mensagem: disponivel
            ? "Pague no ambiente seguro do PagBank. A liberação do acesso ocorre após conferência do pagamento."
            : "A contratação dos planos ainda não está disponível. Entre em contato com o responsável pelo sistema.",
        planos
    };
}

module.exports = {
    validarLinkPagBank,
    obterLinkDoPlano,
    planoValido,
    podeContratar,
    obterStatusCobranca
};
