const TESTE_DIAS = 30;
const PLANOS = Object.freeze([
    Object.freeze({ id: "mensal", nome: "Mensal", valor_centavos: 3500, periodicidade: "mes" }),
    Object.freeze({ id: "anual", nome: "Anual", valor_centavos: 35000, periodicidade: "ano" })
]);

function obterPlanos() {
    return { teste_dias: TESTE_DIAS, planos: PLANOS };
}

function obterAssinatura(usuario, agora = new Date()) {
    const instante = new Date(agora).getTime();
    const teste = new Date(usuario.teste_expira_em);
    const paga = usuario.assinatura_expira_em ? new Date(usuario.assinatura_expira_em) : null;
    const plano = PLANOS.some((item) => item.id === usuario.assinatura_plano) ? usuario.assinatura_plano : null;
    const renovacao_status = !plano ? "sem_assinatura" : usuario.cancelamento_confirmado_em ? "cancelada" : usuario.cancelamento_solicitado_em ? "cancelamento_solicitado" : "ativa";
    const renovacao = {
        renovacao_status,
        cancelamento_solicitado_em: usuario.cancelamento_solicitado_em ? new Date(usuario.cancelamento_solicitado_em).toISOString() : null,
        cancelamento_confirmado_em: usuario.cancelamento_confirmado_em ? new Date(usuario.cancelamento_confirmado_em).toISOString() : null
    };
    if (usuario.acesso_permanente === true) {
        return { status: "gratuita", plano: null, acesso_permanente: true,
            teste_expira_em: teste.toISOString(), acesso_ate: null, dias_restantes: null, ...renovacao };
    }
    const pagaAtiva = plano && paga && paga.getTime() > instante;
    const acesso = paga && plano && paga > teste ? paga : teste;
    const status = pagaAtiva ? "ativa" : teste.getTime() > instante ? "teste" : "expirada";
    return {
        status, plano, acesso_permanente: false, ...renovacao,
        teste_expira_em: teste.toISOString(),
        acesso_ate: acesso.toISOString(),
        dias_restantes: Math.max(0, Math.ceil((acesso.getTime() - instante) / 86400000))
    };
}

module.exports = { obterPlanos, obterAssinatura };
