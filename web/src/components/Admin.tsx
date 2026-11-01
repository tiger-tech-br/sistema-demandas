import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRight, BadgeCheck, CalendarClock, Check, ChevronRight, Clock3, CreditCard, ExternalLink, History, LockKeyhole, Mail, RefreshCw, Search, ShieldCheck, ShieldOff, UnlockKeyhole, UserRound, UsersRound, X } from 'lucide-react';
import { api, geracaoSessao } from '../api';
import { dataFormatada, type AtivacaoAssinatura, type PessoaAssinante, type Plano, type ResumoPessoas } from '../types';
import '../styles/admin.scss';

function moeda(centavos: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100); }
function estadoPessoa(pessoa: PessoaAssinante) {
  if (pessoa.bloqueado) return { texto: 'Bloqueado', classe: 'late' };
  if (pessoa.assinatura.acesso_permanente || pessoa.assinatura.status === 'gratuita') return { texto: 'Gratuito permanente', classe: 'done' };
  if (pessoa.assinatura.status === 'teste') return { texto: 'Em teste', classe: 'progress' };
  if (pessoa.assinatura.status === 'ativa') return { texto: 'Ativo', classe: 'done' };
  return { texto: 'Expirado', classe: 'pending' };
}
function planoPessoa(pessoa: PessoaAssinante) {
  if (pessoa.assinatura.acesso_permanente || pessoa.assinatura.status === 'gratuita') return 'Gratuito permanente';
  if (pessoa.assinatura.status === 'teste') return 'Teste gratuito';
  return pessoa.assinatura.plano === 'mensal' ? 'Mensal' : pessoa.assinatura.plano === 'anual' ? 'Anual' : 'Sem plano';
}

export default function Admin({ planos }: { planos: Plano[] }) {
  const [pessoas, setPessoas] = useState<PessoaAssinante[]>([]);
  const [resumo, setResumo] = useState<ResumoPessoas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [plano, setPlano] = useState('');
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const montado = useRef(true);
  const sequencia = useRef(0);

  const carregar = useCallback(async () => {
    const geracao = geracaoSessao();
    const pedido = ++sequencia.current;
    setCarregando(true); setErro('');
    try {
      const dados = await api<{ pessoas: PessoaAssinante[]; resumo: ResumoPessoas }>('/admin/pessoas');
      if (!montado.current || pedido !== sequencia.current || geracao !== geracaoSessao()) return;
      setPessoas(dados.pessoas); setResumo(dados.resumo);
    } catch (error) {
      if (montado.current && pedido === sequencia.current && geracao === geracaoSessao()) setErro((error as Error).message);
    } finally {
      if (montado.current && pedido === sequencia.current && geracao === geracaoSessao()) setCarregando(false);
    }
  }, []);

  useEffect(() => { montado.current = true; void carregar(); return () => { montado.current = false; sequencia.current++; }; }, [carregar]);
  const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const termo = normalizar(busca.trim());
  const filtradas = pessoas.filter(pessoa => (!termo || normalizar(`${pessoa.nome} ${pessoa.email}`).includes(termo)) && (!status || (status === 'cancelamento' ? pessoa.assinatura.renovacao_status === 'cancelamento_solicitado' : status === 'bloqueado' ? pessoa.bloqueado : !pessoa.bloqueado && pessoa.assinatura.status === status)) && (!plano || (plano === 'sem_plano' ? !pessoa.assinatura.plano : pessoa.assinatura.plano === plano)));
  const cancelamentosPendentes = pessoas.filter(pessoa => pessoa.assinatura.renovacao_status === 'cancelamento_solicitado').length;
  const temFiltro = Boolean(busca || status || plano);
  const metricas = [{ label: 'Pessoas cadastradas', valor: resumo?.total, icon: UsersRound, tipo: 'teal' }, { label: 'Em teste gratuito', valor: resumo?.em_teste, icon: CalendarClock, tipo: 'blue' }, { label: 'Assinaturas ativas', valor: resumo?.ativas, icon: BadgeCheck, tipo: 'green' }, { label: 'Gratuito permanente', valor: resumo?.gratuitas, icon: ShieldCheck, tipo: 'teal' }, { label: 'Acessos bloqueados', valor: resumo?.bloqueadas, icon: ShieldOff, tipo: 'amber' }];

  function pessoaAtualizada(pessoa: PessoaAssinante) {
    setPessoas(anteriores => anteriores.map(item => item.id === pessoa.id ? pessoa : item));
    void carregar();
  }

  return <div className="page admin-page"><div className="page-header"><div><span className="eyebrow">PAINEL DA PLATAFORMA</span><h1>Pessoas assinantes</h1><p>Acompanhe quem usa o sistema, suas assinaturas e períodos de acesso.</p></div><button className="ghost-btn" disabled={carregando} onClick={() => void carregar()}><RefreshCw size={16} className={carregando ? 'spin' : ''}/>Atualizar lista</button></div>
    <section className="metric-grid" aria-label="Resumo das pessoas assinantes">{metricas.map(metrica => <article className={`metric-card ${metrica.tipo}`} key={metrica.label}><span className="metric-icon"><metrica.icon size={24}/></span><div><strong>{resumo ? metrica.valor : '—'}</strong><span>{metrica.label}</span></div></article>)}</section>
    {cancelamentosPendentes > 0 && <div className="notice" role="status"><CalendarClock size={19}/><span>{cancelamentosPendentes} {cancelamentosPendentes === 1 ? 'pedido de cancelamento aguarda' : 'pedidos de cancelamento aguardam'} sua conferência no PagBank.</span><button className="text-link" onClick={() => { setBusca(''); setPlano(''); setStatus('cancelamento'); }}>Ver pedidos</button></div>}
    <section className="panel admin-people-panel"><div className="panel-head"><h2><UsersRound size={21}/>Pessoas cadastradas <span className="count-badge">{pessoas.length}</span></h2><span className="muted small-text">Contas individuais</span></div>
      <div className="admin-filters"><label>Pesquisar pessoa<span className="input-icon"><Search size={18}/><input type="search" placeholder="Nome ou e-mail" value={busca} onChange={event => setBusca(event.target.value)}/></span></label><label>Situação<select value={status} onChange={event => setStatus(event.target.value)}><option value="">Todas as situações</option><option value="teste">Em teste gratuito</option><option value="ativa">Assinatura ativa</option><option value="gratuita">Gratuito permanente</option><option value="expirada">Acesso expirado</option><option value="bloqueado">Acesso bloqueado</option><option value="cancelamento">Cancelamento solicitado</option></select></label><label>Plano<select value={plano} onChange={event => setPlano(event.target.value)}><option value="">Todos os planos</option><option value="mensal">Mensal</option><option value="anual">Anual</option><option value="sem_plano">Sem plano pago</option></select></label>{temFiltro && <button className="text-link admin-clear" onClick={() => { setBusca(''); setStatus(''); setPlano(''); }}>Limpar filtros <X size={14}/></button>}</div>
      {erro ? <div className="inline-error" role="alert"><AlertCircle size={25}/><p>{erro}</p><button className="ghost-btn" onClick={() => void carregar()}>Tentar novamente</button></div> : carregando ? <div className="empty-state" role="status"><span className="spinner"/><strong>Carregando as pessoas assinantes...</strong></div> : !filtradas.length ? <div className="empty-state"><span className="empty-icon"><UsersRound size={31}/></span><strong>{temFiltro ? 'Nenhuma pessoa encontrada' : 'As primeiras pessoas aparecem aqui'}</strong><p>{temFiltro ? 'Tente outro nome, e-mail ou ajuste os filtros.' : 'Quando alguém criar sua conta, você poderá acompanhar e gerenciar o acesso por este painel.'}</p></div> : <div className="admin-table-scroll"><table className="admin-people-table"><thead><tr><th>Pessoa</th><th>Situação</th><th>Plano</th><th>Acesso até</th><th>Cadastro</th><th><span className="sr-only">Gerenciar pessoa</span></th></tr></thead><tbody>{filtradas.map(pessoa => {
        const estado = estadoPessoa(pessoa);
        return <tr key={pessoa.id}><td data-label="Pessoa"><div className="admin-person-cell"><span className="beneficiary-avatar">{pessoa.nome.charAt(0).toUpperCase()}</span><span><strong>{pessoa.nome}</strong><small>{pessoa.email}</small></span></div></td><td data-label="Situação"><span className={`status ${estado.classe}`}><i/>{estado.texto}</span>{pessoa.assinatura.renovacao_status === 'cancelamento_solicitado' && <small className="admin-time-note">Cancelamento solicitado</small>}</td><td data-label="Plano"><span className="admin-plan-label">{planoPessoa(pessoa)}</span></td><td data-label="Acesso até"><time dateTime={pessoa.assinatura.acesso_ate || undefined}>{dataFormatada(pessoa.assinatura.acesso_ate)}</time>{pessoa.assinatura.status === 'teste' && <small className="admin-time-note">{pessoa.assinatura.dias_restantes} dias de teste</small>}</td><td data-label="Cadastro"><time dateTime={pessoa.criado_em}>{dataFormatada(pessoa.criado_em)}</time></td><td className="admin-row-action"><button className="ghost-btn" onClick={() => setSelecionado(pessoa.id)} aria-label={`Gerenciar acesso de ${pessoa.nome}`}>Gerenciar <ChevronRight size={15}/></button></td></tr>;
      })}</tbody></table></div>}
      {!erro && !carregando && pessoas.length > 0 && <div className="admin-list-footer"><span>{filtradas.length} de {pessoas.length} {pessoas.length === 1 ? 'pessoa' : 'pessoas'}</span><span>{resumo?.expiradas || 0} com acesso expirado</span></div>}
    </section><div className="admin-operation-note"><ShieldCheck size={21}/><div><strong>Gestão de acesso com os registros preservados</strong><p>Confira o pagamento antes de registrar um período pago. Bloquear acesso não exclui a conta e não cancela cobranças no PagBank.</p></div></div>
    {selecionado !== null && <PessoaDialog key={selecionado} id={selecionado} planos={planos} fechar={() => setSelecionado(null)} atualizar={pessoaAtualizada}/>}
  </div>;
}

function PessoaDialog({ id, planos, fechar, atualizar }: { id: number; planos: Plano[]; fechar: () => void; atualizar: (pessoa: PessoaAssinante) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const montado = useRef(true);
  const [pessoa, setPessoa] = useState<PessoaAssinante | null>(null);
  const [ativacoes, setAtivacoes] = useState<AtivacaoAssinatura[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [plano, setPlano] = useState<'mensal' | 'anual'>('mensal');
  const [referencia, setReferencia] = useState('');
  const [conferido, setConferido] = useState(false);
  const [confirmarBloqueio, setConfirmarBloqueio] = useState(false);
  const [novaAssinatura, setNovaAssinatura] = useState(false);
  const [referenciaCancelamento, setReferenciaCancelamento] = useState('');
  const [canceladoNoPagbank, setCanceladoNoPagbank] = useState(false);

  const carregar = useCallback(async () => {
    const geracao = geracaoSessao();
    setCarregando(true); setErro('');
    try {
      const resultado = await api<{ pessoa: PessoaAssinante; ativacoes: AtivacaoAssinatura[] }>(`/admin/pessoas/${id}`);
      if (!montado.current || geracao !== geracaoSessao()) return;
      setPessoa(resultado.pessoa); setAtivacoes(resultado.ativacoes);
    } catch (error) { if (montado.current && geracao === geracaoSessao()) setErro((error as Error).message); }
    finally { if (montado.current && geracao === geracaoSessao()) setCarregando(false); }
  }, [id]);

  useEffect(() => {
    montado.current = true;
    const elemento = dialog.current;
    elemento?.showModal();
    void carregar();
    return () => { montado.current = false; elemento?.close(); };
  }, [carregar]);

  async function ativar(event: FormEvent) {
    event.preventDefault();
    if (!pessoa || ocupado || !conferido || !planos.some(item => item.id === plano) || (pessoa.assinatura.renovacao_status === 'cancelada' && !novaAssinatura)) return;
    const geracao = geracaoSessao();
    setOcupado(true); setErro(''); setAviso(''); setConfirmarBloqueio(false);
    try {
      const resultado = await api<{ pessoa: PessoaAssinante; ativacao: AtivacaoAssinatura; repetida: boolean }>(`/admin/pessoas/${id}/assinatura`, 'POST', { plano, referencia: referencia.trim(), ...(pessoa.assinatura.renovacao_status === 'cancelada' ? { nova_assinatura: novaAssinatura } : {}) });
      if (!montado.current || geracao !== geracaoSessao()) return;
      setPessoa(resultado.pessoa);
      if (resultado.ativacao) setAtivacoes(anteriores => [resultado.ativacao, ...anteriores.filter(item => item.id !== resultado.ativacao.id)]);
      setReferencia(''); setConferido(false); setNovaAssinatura(false);
      setAviso(resultado.repetida ? 'Esse pagamento já estava registrado. Nenhum período adicional foi concedido.' : `Pagamento registrado. Acesso até ${dataFormatada(resultado.pessoa.assinatura.acesso_ate, true)}.`);
      atualizar(resultado.pessoa);
    } catch (error) { if (montado.current && geracao === geracaoSessao()) setErro((error as Error).message); }
    finally { if (montado.current && geracao === geracaoSessao()) setOcupado(false); }
  }

  async function confirmarCancelamento(event: FormEvent) {
    event.preventDefault(); if (!pessoa || ocupado || !canceladoNoPagbank) return;
    const geracao = geracaoSessao(); setOcupado(true); setErro(''); setAviso('');
    try {
      const resultado = await api<{ pessoa: PessoaAssinante; email_confirmacao: string }>(`/admin/pessoas/${id}/cancelamento`, 'POST', { referencia: referenciaCancelamento.trim(), confirmado_no_pagbank: true });
      if (!montado.current || geracao !== geracaoSessao()) return;
      setPessoa(resultado.pessoa); setReferenciaCancelamento(''); setCanceladoNoPagbank(false); atualizar(resultado.pessoa);
      setAviso('Cancelamento confirmado no sistema. O acesso já pago permanece válido. A confirmação por e-mail foi colocada na fila de envio.');
    } catch (error) { if (montado.current && geracao === geracaoSessao()) setErro((error as Error).message); }
    finally { if (montado.current && geracao === geracaoSessao()) setOcupado(false); }
  }

  async function alternarBloqueio() {
    if (!pessoa || ocupado) return;
    const geracao = geracaoSessao();
    const bloqueado = !pessoa.bloqueado;
    setOcupado(true); setErro(''); setAviso('');
    try {
      const resultado = await api<{ pessoa: PessoaAssinante }>(`/admin/pessoas/${id}/acesso`, 'PATCH', { bloqueado });
      if (!montado.current || geracao !== geracaoSessao()) return;
      setPessoa(resultado.pessoa); setConfirmarBloqueio(false);
      setAviso(bloqueado ? 'Acesso bloqueado. A conta e seus registros continuam preservados.' : 'Bloqueio removido. O acesso segue o prazo do teste ou da assinatura.');
      atualizar(resultado.pessoa);
    } catch (error) { if (montado.current && geracao === geracaoSessao()) setErro((error as Error).message); }
    finally { if (montado.current && geracao === geracaoSessao()) setOcupado(false); }
  }

  const estado = pessoa ? estadoPessoa(pessoa) : null;
  const escolhido = planos.find(item => item.id === plano);
  return <dialog ref={dialog} className="demand-modal admin-person-dialog" aria-labelledby="admin-pessoa-titulo" onCancel={event => { event.preventDefault(); if (!ocupado) fechar(); }}>
    <div className="modal-header"><span className="modal-icon"><UserRound size={25}/></span><button className="icon-btn" disabled={ocupado} onClick={fechar} aria-label="Fechar detalhes da pessoa"><X size={21}/></button></div><span className="eyebrow">PESSOA ASSINANTE</span><h2 id="admin-pessoa-titulo">{pessoa?.nome || 'Detalhes do acesso'}</h2>{pessoa && <p className="admin-person-email"><Mail size={15}/>{pessoa.email}</p>}
    {erro && <div className="notice notice--error" role="alert">{erro}{!pessoa && <button className="text-link" onClick={() => void carregar()}>Tentar novamente</button>}</div>}{aviso && <div className="notice admin-success" role="status"><Check size={18}/>{aviso}</div>}
    {carregando ? <div className="empty-state" role="status"><span className="spinner"/><strong>Carregando os detalhes...</strong></div> : pessoa && <>
      <div className="admin-detail-summary"><div><span>Situação</span><strong><span className={`status ${estado?.classe}`}><i/>{estado?.texto}</span></strong></div><div><span>Plano</span><strong>{planoPessoa(pessoa)}</strong></div><div><span>Acesso até</span><strong>{dataFormatada(pessoa.assinatura.acesso_ate, true)}</strong></div><div><span>Cadastro</span><strong>{dataFormatada(pessoa.criado_em)}</strong></div></div>
      {!pessoa.assinatura.acesso_permanente && pessoa.assinatura.status !== 'gratuita' && <section className="admin-detail-section"><div className="admin-section-heading"><span><CreditCard size={19}/><h3>Registrar pagamento conferido</h3></span><a href="https://assinaturas.pagbank.com.br/login" target="_blank" rel="noopener noreferrer">Painel PagBank <ExternalLink size={13}/></a></div><p>O registro libera ou renova o período de acesso. Ele não cobra o cartão da pessoa.</p>
        <form onSubmit={ativar}><fieldset disabled={ocupado} className="admin-payment-form"><label>Plano pago<select value={plano} onChange={event => { setPlano(event.target.value as 'mensal' | 'anual'); setConferido(false); }}>{planos.map(item => <option key={item.id} value={item.id}>{item.nome} — {moeda(item.valor_centavos)} / {item.periodicidade === 'mes' ? 'mês' : 'ano'}</option>)}</select></label><label>Referência única do pagamento<input required minLength={3} maxLength={120} value={referencia} onChange={event => setReferencia(event.target.value)} placeholder="ID da transação aprovada" autoComplete="off"/></label><label className="admin-confirm-payment"><input type="checkbox" required checked={conferido} onChange={event => setConferido(event.target.checked)}/><span>Conferi no PagBank a aprovação deste pagamento, o titular e o valor {escolhido ? `de ${moeda(escolhido.valor_centavos)}` : 'do plano escolhido'}.</span></label>{pessoa.assinatura.renovacao_status === 'cancelada' && <label className="admin-confirm-payment"><input type="checkbox" required checked={novaAssinatura} onChange={event => setNovaAssinatura(event.target.checked)}/><span>Conferi uma nova contratação no PagBank, feita depois do cancelamento confirmado da assinatura anterior.</span></label>}<div className="admin-payment-action"><small>{plano === 'anual' ? 'Acrescenta um ano de acesso.' : 'Acrescenta um mês de acesso.'} O período já disponível é preservado.</small><button className="primary-btn" type="submit" disabled={!conferido || !escolhido || ocupado || (pessoa.assinatura.renovacao_status === 'cancelada' && !novaAssinatura)}>{ocupado ? 'Salvando...' : 'Registrar pagamento'}<Check size={17}/></button></div></fieldset></form>{!planos.length && <p className="admin-form-warning">Os planos não foram carregados. Feche os detalhes e atualize a página para consultar os valores.</p>}
      </section>}
      {pessoa.assinatura.plano && !pessoa.assinatura.acesso_permanente && <section className="admin-detail-section"><div className="admin-section-heading"><span><CalendarClock size={19}/><h3>Cancelamento da renovação</h3></span><a href="https://assinaturas.pagbank.com.br/login" target="_blank" rel="noopener noreferrer">Painel PagBank <ExternalLink size={13}/></a></div>{pessoa.assinatura.renovacao_status === 'cancelada' ? <p>Cancelamento confirmado em {dataFormatada(pessoa.assinatura.cancelamento_confirmado_em, true)}. Acesso pago mantido até {dataFormatada(pessoa.assinatura.acesso_ate, true)}.</p> : <><p>{pessoa.assinatura.renovacao_status === 'cancelamento_solicitado' ? 'Pedido de cancelamento recebido em ' + dataFormatada(pessoa.assinatura.cancelamento_solicitado_em, true) + '.' : 'A renovação consta como ativa.'} Primeiro cancele a assinatura no painel PagBank. Depois registre abaixo a confirmação real do provedor. Esta ação apenas registra a conferência e não executa o cancelamento no PagBank.</p><form onSubmit={confirmarCancelamento}><fieldset className="admin-payment-form" disabled={ocupado}><label className="full-width">Referência do cancelamento no PagBank<input required minLength={3} maxLength={120} value={referenciaCancelamento} onChange={event => setReferenciaCancelamento(event.target.value)} placeholder="Protocolo ou ID da assinatura cancelada" autoComplete="off"/></label><label className="admin-confirm-payment"><input type="checkbox" required checked={canceladoNoPagbank} onChange={event => setCanceladoNoPagbank(event.target.checked)}/><span>Conferi no PagBank que a assinatura recorrente desta pessoa já foi cancelada e que não haverá novas renovações desse contrato.</span></label><div className="admin-payment-action"><small>O período já pago é preservado. A confirmação por e-mail entra na fila de envio após este registro.</small><button className="primary-btn" disabled={!canceladoNoPagbank || referenciaCancelamento.trim().length < 3 || ocupado}>{ocupado ? 'Salvando...' : 'Registrar cancelamento confirmado'}<Check size={17}/></button></div></fieldset></form></>}</section>}
      <section className="admin-detail-section"><div className="admin-section-heading"><span>{pessoa.bloqueado ? <UnlockKeyhole size={19}/> : <LockKeyhole size={19}/>}<h3>Controle de acesso</h3></span></div><p>{pessoa.bloqueado ? 'O acesso desta pessoa está bloqueado. Ao desbloquear, continua valendo o prazo do teste ou da assinatura.' : 'O bloqueio impede o uso das demandas e preserva a conta e seus registros. Ele não cancela pagamentos recorrentes.'}</p>{confirmarBloqueio ? <div className="admin-block-confirm"><strong>{pessoa.bloqueado ? 'Desbloquear o acesso desta pessoa?' : 'Bloquear o acesso desta pessoa?'}</strong><p>{pessoa.nome} · {pessoa.email}</p><div><button className="ghost-btn" disabled={ocupado} onClick={() => setConfirmarBloqueio(false)}>Voltar</button><button className={pessoa.bloqueado ? 'primary-btn' : 'admin-danger-btn'} disabled={ocupado} onClick={() => void alternarBloqueio()}>{ocupado ? 'Salvando...' : pessoa.bloqueado ? 'Confirmar desbloqueio' : 'Confirmar bloqueio'}</button></div></div> : <button className={pessoa.bloqueado ? 'ghost-btn' : 'admin-danger-btn'} disabled={ocupado} onClick={() => { setConfirmarBloqueio(true); setErro(''); setAviso(''); }}>{pessoa.bloqueado ? <UnlockKeyhole size={16}/> : <LockKeyhole size={16}/>} {pessoa.bloqueado ? 'Desbloquear acesso' : 'Bloquear acesso'}</button>}</section>
      <section className="admin-detail-section"><div className="admin-section-heading"><span><History size={19}/><h3>Histórico de períodos pagos</h3></span><span className="count-badge">{ativacoes.length}</span></div>{!ativacoes.length ? <p>Nenhum período pago registrado para esta pessoa.</p> : <div className="admin-history">{ativacoes.map(ativacao => <article key={ativacao.id}><span className="admin-history-icon"><Check size={17}/></span><div><strong>{ativacao.plano === 'anual' ? 'Plano anual' : 'Plano mensal'} · {moeda(ativacao.valor_centavos)}</strong><span>Registrado em {dataFormatada(ativacao.ativado_em, true)}</span><small>Referência: {ativacao.referencia}</small></div><div className="admin-history-date"><span>Acesso até</span><strong>{dataFormatada(ativacao.acesso_ate)}</strong></div></article>)}</div>}</section>
    </>}
    <div className="modal-footer"><button className="ghost-btn" disabled={ocupado} onClick={fechar}>Fechar detalhes</button></div>
  </dialog>;
}
