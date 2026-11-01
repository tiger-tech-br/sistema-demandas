import { useState } from 'react';
import { ArrowRight, CalendarDays, Check, CreditCard, RefreshCw, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { api, geracaoSessao } from '../api';
import { dataFormatada, type Conta, type Plano, type Cobranca } from '../types';

export function MinhaConta({ conta }: { conta: Conta }) {
  const admin = conta.usuario.papel === 'admin';
  return <div className="page account-page"><div className="page-header"><div><span className="eyebrow">{admin ? 'ADMINISTRAÇÃO DA PLATAFORMA' : 'SEU ESPAÇO INDIVIDUAL'}</span><h1>Minha conta</h1><p>Os dados que identificam seu acesso ao sistema.</p></div></div><section className="panel account-card"><span className="account-portrait"><UserRound size={36}/></span><div className="account-identity"><h2>{conta.usuario.nome}</h2><p>{conta.usuario.email}</p><span className="status done"><ShieldCheck size={13}/>{admin ? 'Administrador do sistema' : 'Conta individual'}</span></div><div className="account-details"><div><span>Nome</span><strong>{conta.usuario.nome}</strong></div><div><span>E-mail de acesso</span><strong>{conta.usuario.email}</strong></div><div><span>{admin ? 'Sua função' : 'Sua privacidade'}</span><p>{admin ? 'Administrar as pessoas assinantes, seus períodos de acesso e a conferência de pagamentos.' : 'As demandas cadastradas ficam vinculadas exclusivamente à sua conta.'}</p></div></div></section><div className="account-note"><ShieldCheck size={21}/><p>Ao usar um computador compartilhado, lembre-se de sair da conta quando terminar.</p></div></div>;
}

export default function Assinatura({ conta, planos, cobranca, recarregar, carregando }: { conta: Conta; planos: Plano[]; cobranca: Cobranca | null; recarregar: () => void; carregando: boolean }) {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const { assinatura } = conta;
  const teste = assinatura.status === 'teste';
  const ativa = assinatura.status === 'ativa';
  async function assinar(plano: Plano) {
    if (selecionado) return;
    setSelecionado(plano.id); setErro('');
    const geracao = geracaoSessao();
    try {
      const resposta = await api<{ url: string }>('/cobranca/checkout', 'POST', { plano: plano.id });
      if (geracao !== geracaoSessao()) return;
      const url = new URL(resposta.url);
      if (url.protocol !== 'https:') throw new Error('O endereço de pagamento está indisponível.');
      location.assign(url.href);
    } catch (error) { if (geracao === geracaoSessao()) setErro((error as Error).message); }
    finally { setSelecionado(null); }
  }
  return <div className="page subscription-page"><div className="page-header"><div><span className="eyebrow">CONTINUE ORGANIZANDO SUA ROTINA</span><h1>Plano e assinatura</h1><p>Um plano simples para manter seus prazos no lugar.</p></div><button className="ghost-btn" disabled={carregando} onClick={recarregar}><RefreshCw size={16} className={carregando ? 'spin' : ''}/>Atualizar acesso</button></div>
    <section className={`access-card ${assinatura.status}`}><div className="access-card-icon">{teste ? <Sparkles size={29}/> : <CreditCard size={29}/>}</div><div><span className="eyebrow">SEU ACESSO AGORA</span><h2>{teste ? 'Você está no período de teste' : ativa ? `Plano ${assinatura.plano === 'anual' ? 'anual' : 'mensal'} ativo` : 'Seu período de acesso terminou'}</h2><p>{teste ? `Aproveite todas as funções até ${dataFormatada(assinatura.teste_expira_em, true)}.` : ativa ? `Acesso liberado até ${dataFormatada(assinatura.acesso_ate, true)}.` : 'Suas demandas continuam salvas. Escolha um plano para voltar a acessá-las.'}</p></div>{teste && <div className="trial-days"><strong>{assinatura.dias_restantes}</strong><span>dias restantes</span></div>}{ativa && <span className="status done"><Check size={14}/>Acesso liberado</span>}</section>
    <div className="plans-heading"><h2>Escolha o ritmo ideal para você</h2><p>Os mesmos recursos. A frequência de pagamento que combina com sua rotina.</p></div>
    {erro && <div className="notice notice--error" role="alert">{erro}</div>}
    {!planos.length ? <div className="panel inline-error" role="alert"><p>Não foi possível carregar os planos. Atualize para tentar novamente.</p><button className="ghost-btn" disabled={carregando} onClick={recarregar}>Consultar planos</button></div> : <div className="plan-grid">{planos.map(plano => {
      const anual = plano.id === 'anual';
      const disponivel = cobranca?.planos.some(item => item.id === plano.id && item.disponivel);
      const pode = assinatura.status === 'expirada' && disponivel;
      const valor = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(plano.valor_centavos / 100);
      return <article className={`plan-card ${anual ? 'featured' : ''}`} key={plano.id}>{anual && <span className="plan-recommendation"><Sparkles size={13}/>Mais tranquilidade o ano todo</span>}<span className="plan-icon"><CalendarDays size={26}/></span><h3>{plano.nome}</h3><p className="plan-description">{anual ? 'Um ano inteiro com tudo em dia.' : 'Flexibilidade para a sua rotina.'}</p><div className="plan-price">{valor}<small> / {anual ? 'ano' : 'mês'}</small></div><p className="plan-period">{anual ? 'Pagamento único a cada ano.' : 'Cobrança a cada mês.'}</p><ul><li><Check size={16}/>Cadastro e controle de demandas</li><li><Check size={16}/>Filtros e acompanhamento de prazos</li><li><Check size={16}/>Avisos de demandas próximas de vencer</li><li><Check size={16}/>Acesso pelo computador e celular</li></ul><button className={anual ? 'primary-btn' : 'ghost-btn'} disabled={!pode || selecionado !== null} onClick={() => assinar(plano)}>{selecionado === plano.id ? 'Preparando...' : teste ? 'Disponível após o teste' : ativa ? 'Você já tem acesso ativo' : disponivel ? 'Assinar agora' : 'Contratação indisponível'}{pode && <ArrowRight size={17}/>}</button></article>;
    })}</div>}
    <div className="billing-explanation"><ShieldCheck size={21}/><div><strong>{teste ? '30 dias para experimentar, sem cartão' : 'Pagamento em ambiente seguro'}</strong><p>{teste ? 'A contratação fica disponível depois do teste. Nenhuma cobrança é feita durante o período gratuito.' : ativa ? 'Consulte suas cobranças e o cancelamento na sua conta PagBank.' : cobranca?.mensagem || 'A contratação está temporariamente indisponível. Atualize para consultar novamente.'}</p>{!teste && !ativa && cobranca?.disponivel && <p>Use o mesmo e-mail da sua conta. Depois do pagamento, o acesso é liberado após conferência. Clique em “Atualizar acesso” para consultar a liberação.</p>}</div></div>
  </div>;
}
