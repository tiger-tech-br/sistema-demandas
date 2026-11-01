import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Check, CreditCard, RefreshCw, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { api, geracaoSessao } from '../api';
import { dataFormatada, type Assinatura as TipoAssinatura, type Conta, type Plano, type Cobranca } from '../types';

export function MinhaConta({ conta }: { conta: Conta }) {
  const admin = conta.usuario.papel === 'admin';
  return <div className="page account-page"><div className="page-header"><div><span className="eyebrow">{admin ? 'ADMINISTRAÇÃO DA PLATAFORMA' : 'SEU ESPAÇO INDIVIDUAL'}</span><h1>Minha conta</h1><p>Os dados que identificam seu acesso ao sistema.</p></div></div><section className="panel account-card"><span className="account-portrait"><UserRound size={36}/></span><div className="account-identity"><h2>{conta.usuario.nome}</h2><p>{conta.usuario.email}</p><span className="status done"><ShieldCheck size={13}/>{admin ? 'Administrador do sistema' : 'Conta individual'}</span></div><div className="account-details"><div><span>Nome</span><strong>{conta.usuario.nome}</strong></div><div><span>E-mail de acesso</span><strong>{conta.usuario.email}</strong></div><div><span>{admin ? 'Sua função' : 'Sua privacidade'}</span><p>{admin ? 'Administrar as pessoas assinantes, seus períodos de acesso e a conferência de pagamentos.' : 'As demandas cadastradas ficam vinculadas exclusivamente à sua conta.'}</p></div></div></section><div className="account-note"><ShieldCheck size={21}/><p>Ao usar um computador compartilhado, lembre-se de sair da conta quando terminar.</p></div></div>;
}

async function abrirCheckout(plano: 'mensal' | 'anual', geracao: number) {
  const resposta = await api<{ url: string }>('/cobranca/checkout', 'POST', { plano });
  if (geracao !== geracaoSessao()) return;
  const url = new URL(resposta.url);
  if (url.protocol !== 'https:') throw new Error('O endereço de pagamento está indisponível.');
  location.assign(url.href);
}

export function BoasVindas({ conta, cobranca, concluir }: { conta: Conta; cobranca: Cobranca | null; concluir: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => { const elemento = dialog.current; elemento?.showModal(); return () => elemento?.close(); }, []);
  async function escolher(escolha: 'teste' | 'mensal' | 'anual') {
    if (selecionado) return;
    const geracao = geracaoSessao(); setSelecionado(escolha); setErro('');
    try {
      await api('/cobranca/boas-vindas', 'POST', { escolha }); if (geracao !== geracaoSessao()) return;
      if (escolha === 'teste') concluir();
      else { await abrirCheckout(escolha, geracao); if (geracao === geracaoSessao()) concluir(); }
    } catch (error) { if (geracao === geracaoSessao()) setErro((error as Error).message); }
    finally { if (geracao === geracaoSessao()) setSelecionado(null); }
  }
  return <dialog ref={dialog} className="demand-modal welcome-modal" aria-labelledby="welcome-title" onCancel={event => event.preventDefault()}><span className="eyebrow"><Sparkles size={16}/>BEM-VINDO AO SEU ESPAÇO</span><h2 id="welcome-title">Como você quer começar?</h2><p>Experimente grátis ou escolha um plano pago agora. Sua conta é individual e todos os planos incluem as mesmas funções.</p>{erro && <div className="notice notice--error" role="alert">{erro}</div>}<div className="welcome-plans"><article className="plan-card"><span className="plan-icon"><Sparkles size={24}/></span><h3>Free</h3><div className="plan-price">Gratuito</div><p className="plan-period">Por 30 dias · sem cartão</p><p className="welcome-plan-description">720 horas a partir do cadastro. O prazo não recomeça ao escolher esta opção.</p><button className="ghost-btn" disabled={selecionado !== null} onClick={() => void escolher('teste')}>{selecionado === 'teste' ? 'Preparando...' : 'Continuar com Free'}</button></article>{(['mensal', 'anual'] as const).map(plano => {
    const pode = cobranca?.pode_assinar && cobranca.planos.some(item => item.id === plano && item.disponivel);
    return <article className={`plan-card ${plano === 'anual' ? 'featured' : ''}`} key={plano}><span className="plan-icon"><CalendarDays size={24}/></span><h3>{plano === 'anual' ? 'Anual' : 'Mensal'}</h3><div className="plan-price">R$ {plano === 'anual' ? '350' : '35'}<small>/{plano === 'anual' ? 'ano' : 'mês'}</small></div><p className="plan-period">{plano === 'anual' ? 'Renovação a cada ano' : 'Renovação a cada mês'}</p><p className="welcome-plan-description">A primeira cobrança ocorre ao concluir a contratação. O acesso pago é liberado após conferência do pagamento.</p><button className="primary-btn" disabled={!pode || selecionado !== null} onClick={() => void escolher(plano)}>{selecionado === plano ? 'Preparando...' : pode ? `Escolher ${plano}` : 'Contratação indisponível'}<ArrowRight size={17}/></button></article>;
  })}</div><p className="welcome-expiry">Seu período gratuito termina em {dataFormatada(conta.assinatura.teste_expira_em, true)}. Depois disso, suas demandas permanecem salvas e o acesso a elas exige um plano ativo.</p>{cobranca?.mensagem && <p className="privacy-note">{cobranca.mensagem}</p>}</dialog>;
}

export default function Assinatura({ conta, planos, cobranca, recarregar, carregando, alterar }: { conta: Conta; planos: Plano[]; cobranca: Cobranca | null; recarregar: () => void; carregando: boolean; alterar: (assinatura: TipoAssinatura) => void }) {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false);
  const { assinatura } = conta;
  const teste = assinatura.status === 'teste';
  const ativa = assinatura.status === 'ativa';
  const permanente = assinatura.acesso_permanente || assinatura.status === 'gratuita';
  const renovacao = assinatura.renovacao_status;
  async function assinar(plano: Plano) {
    if (selecionado) return;
    setSelecionado(plano.id); setErro('');
    const geracao = geracaoSessao();
    try {
      await abrirCheckout(plano.id, geracao);
    } catch (error) { if (geracao === geracaoSessao()) setErro((error as Error).message); }
    finally { setSelecionado(null); }
  }
  async function cancelarRenovacao() {
    if (selecionado) return; const geracao = geracaoSessao(); setSelecionado('cancelamento'); setErro(''); setAviso('');
    try { const resultado = await api<{ assinatura: TipoAssinatura; mensagem: string }>('/cobranca/cancelamento', 'POST', {}); if (geracao !== geracaoSessao()) return; alterar(resultado.assinatura); setConfirmarCancelamento(false); setAviso(resultado.mensagem); recarregar(); }
    catch (error) { if (geracao === geracaoSessao()) setErro((error as Error).message); }
    finally { if (geracao === geracaoSessao()) setSelecionado(null); }
  }
  return <div className="page subscription-page"><div className="page-header"><div><span className="eyebrow">CONTINUE ORGANIZANDO SUA ROTINA</span><h1>{permanente ? 'Meu acesso' : 'Plano e assinatura'}</h1><p>{permanente ? 'Seu espaço individual está disponível sem prazo de expiração.' : 'Um plano simples para manter seus prazos no lugar.'}</p></div><button className="ghost-btn" disabled={carregando} onClick={recarregar}><RefreshCw size={16} className={carregando ? 'spin' : ''}/>Atualizar acesso</button></div>
    <section className={`access-card ${assinatura.status}`}><div className="access-card-icon">{teste ? <Sparkles size={29}/> : permanente ? <ShieldCheck size={29}/> : <CreditCard size={29}/>}</div><div><span className="eyebrow">SEU ACESSO AGORA</span><h2>{permanente ? 'Acesso gratuito permanente' : teste ? 'Você está no período de teste' : ativa ? `Plano ${assinatura.plano === 'anual' ? 'anual' : 'mensal'} ativo` : 'Seu período de acesso terminou'}</h2><p>{permanente ? 'Todas as funções liberadas, sem prazo de expiração e sem cobrança.' : teste ? `Aproveite todas as funções até ${dataFormatada(assinatura.teste_expira_em, true)}. Você pode assinar agora se preferir.` : ativa ? `Acesso liberado até ${dataFormatada(assinatura.acesso_ate, true)}.` : 'Suas demandas continuam salvas. Sua conta e as informações de privacidade continuam disponíveis.'}</p></div>{teste && <div className="trial-days"><strong>{assinatura.dias_restantes}</strong><span>dias restantes</span></div>}{(ativa || permanente) && <span className="status done"><Check size={14}/>Acesso liberado</span>}</section>
    {permanente ? <div className="billing-explanation"><ShieldCheck size={21}/><div><strong>Seu espaço está disponível</strong><p>Esta conta possui acesso gratuito permanente. Nenhuma contratação é necessária.</p></div></div> : <>
    {aviso && <div className="notice admin-success" role="status">{aviso}</div>}
    {assinatura.plano && <section className="panel renewal-panel"><h2>Renovação da assinatura</h2>{renovacao === 'cancelamento_solicitado' ? <><p>Seu pedido de cancelamento foi registrado em {dataFormatada(assinatura.cancelamento_solicitado_em, true)}. O responsável ainda precisa confirmar o cancelamento no PagBank.</p><p>O pedido ainda não confirma o fim das cobranças. Seu acesso já pago permanece disponível até {dataFormatada(assinatura.acesso_ate, true)}.</p><span className="status pending">Aguardando confirmação</span></> : renovacao === 'cancelada' ? <><p>Cancelamento confirmado em {dataFormatada(assinatura.cancelamento_confirmado_em, true)}. O período já pago permanece disponível até {dataFormatada(assinatura.acesso_ate, true)}.</p><p>Se desejar voltar, a reativação abrirá uma nova contratação no ambiente de pagamento.</p><span className="status done">Renovação cancelada</span></> : <><p>A renovação é recorrente. Para encerrar as próximas cobranças, registre seu pedido; o responsável concluirá o cancelamento no PagBank e confirmará nesta página.</p>{confirmarCancelamento ? <div className="renewal-confirm"><strong>Solicitar o cancelamento da renovação?</strong><p>Seu acesso já pago será mantido até {dataFormatada(assinatura.acesso_ate, true)}. Aguarde a confirmação antes de considerar encerradas as cobranças.</p><div><button className="ghost-btn" disabled={selecionado !== null} onClick={() => setConfirmarCancelamento(false)}>Voltar</button><button className="ghost-btn" disabled={selecionado !== null} onClick={() => void cancelarRenovacao()}>{selecionado === 'cancelamento' ? 'Enviando...' : 'Confirmar solicitação'}</button></div></div> : <button className="ghost-btn" disabled={selecionado !== null} onClick={() => setConfirmarCancelamento(true)}>Cancelar assinatura</button>}</>}</section>}
    <div className="plans-heading"><h2>Escolha o ritmo ideal para você</h2><p>Os mesmos recursos. A frequência de pagamento que combina com sua rotina.</p></div>
    {erro && <div className="notice notice--error" role="alert">{erro}</div>}
    {!planos.length ? <div className="panel inline-error" role="alert"><p>Não foi possível carregar os planos. Atualize para tentar novamente.</p><button className="ghost-btn" disabled={carregando} onClick={recarregar}>Consultar planos</button></div> : <div className="plan-grid">{planos.map(plano => {
      const anual = plano.id === 'anual';
      const disponivel = cobranca?.planos.some(item => item.id === plano.id && item.disponivel);
      const pode = Boolean(cobranca?.pode_assinar && disponivel);
      const valor = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(plano.valor_centavos / 100);
      return <article className={`plan-card ${anual ? 'featured' : ''}`} key={plano.id}>{anual && <span className="plan-recommendation"><Sparkles size={13}/>Mais tranquilidade o ano todo</span>}<span className="plan-icon"><CalendarDays size={26}/></span><h3>{plano.nome}</h3><p className="plan-description">{anual ? 'Um ano inteiro com tudo em dia.' : 'Flexibilidade para a sua rotina.'}</p><div className="plan-price">{valor}<small> / {anual ? 'ano' : 'mês'}</small></div><p className="plan-period">{anual ? 'Renovação a cada ano.' : 'Renovação a cada mês.'}</p><ul><li><Check size={16}/>Cadastro e controle de demandas</li><li><Check size={16}/>Filtros e acompanhamento de prazos</li><li><Check size={16}/>Avisos de demandas próximas de vencer</li><li><Check size={16}/>Acesso pelo computador e celular</li></ul><button className={anual ? 'primary-btn' : 'ghost-btn'} disabled={!pode || selecionado !== null} onClick={() => assinar(plano)}>{selecionado === plano.id ? 'Preparando...' : pode ? renovacao === 'cancelada' ? 'Reativar com nova contratação' : 'Assinar agora' : renovacao === 'cancelamento_solicitado' ? 'Aguardando cancelamento' : renovacao === 'ativa' ? 'Assinatura já contratada' : 'Contratação indisponível'}{pode && <ArrowRight size={17}/>}</button></article>;
    })}</div>}
    <div className="billing-explanation"><ShieldCheck size={21}/><div><strong>{teste ? '30 dias para experimentar, sem cartão' : 'Pagamento em ambiente seguro'}</strong><p>{cobranca?.mensagem || 'Atualize para consultar a disponibilidade de contratação.'}</p>{teste && <p>O teste dura 720 horas desde seu cadastro. Escolher um plano não reinicia esse prazo e nenhuma cobrança acontece sem contratação.</p>}{cobranca?.pode_assinar && <p>Use o mesmo e-mail da sua conta. Depois do pagamento, o acesso é liberado após conferência. Clique em “Atualizar acesso” para consultar a liberação.</p>}</div></div></>}
  </div>;
}
