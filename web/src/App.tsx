import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { api, ApiError, definirConta, geracaoSessao, iniciarCliente, limparSessaoLocal } from './api';
import { diasAte, type Assinatura as AssinaturaTipo, type Cobranca, type Conta, type Demanda, type NovaDemanda, type Plano, type Visao } from './types';
import AuthScreen from './components/AuthScreen';
import AppShell from './components/AppShell';
import Dashboard from './components/Dashboard';
import Demandas, { NovaDemandaModal } from './components/Demandas';
import Assinatura, { MinhaConta } from './components/Assinatura';
import Brand from './components/Brand';
import AvisoPrazo from './components/AvisoPrazo';

const EVENTO_ABAS = 'demandas-conta-evento';
export default function App() {
  const [pronto, setPronto] = useState(false);
  const [conta, setConta] = useState<Conta | null>(null);
  const [avisoAcesso, setAvisoAcesso] = useState('');
  const [visao, setVisao] = useState<Visao>('dashboard');
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [cobranca, setCobranca] = useState<Cobranca | null>(null);
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erroDemandas, setErroDemandas] = useState('');
  const [concluindo, setConcluindo] = useState<number | null>(null);
  const [modal, setModal] = useState(false);
  const [avisoPrazo, setAvisoPrazo] = useState<Demanda[]>([]);
  const [saindo, setSaindo] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  const contaRef = useRef<Conta | null>(null);
  const canalRef = useRef<BroadcastChannel | null>(null);
  contaRef.current = conta;

  const limparTela = useCallback((mensagem = '') => {
    void limparSessaoLocal();
    contaRef.current = null;
    setConta(null); setDemandas([]); setCobranca(null); setModal(false); setAvisoPrazo([]); setConcluindo(null); setCarregando(false); setSaindo(false); setAtualizando(false); setErroDemandas(''); setAviso(null); setVisao('dashboard'); setAvisoAcesso(mensagem); setPronto(true);
  }, []);

  function notificarAbas() {
    const evento = { instante: Date.now(), nonce: Math.random().toString(36).slice(2) };
    canalRef.current?.postMessage(evento);
    try { localStorage.setItem(EVENTO_ABAS, JSON.stringify(evento)); } catch { /* O canal atende navegadores com armazenamento indisponivel. */ }
  }

  useEffect(() => {
    let ativo = true;
    const semSessao = (event: Event) => limparTela(contaRef.current ? (event as CustomEvent<string>).detail : '');
    const assinaturaMudou = (event: Event) => {
      const assinatura = (event as CustomEvent<AssinaturaTipo>).detail;
      setConta(anterior => anterior ? { ...anterior, assinatura } : null);
      setModal(false);
      if (assinatura.status === 'expirada') { setDemandas([]); setAvisoPrazo([]); setVisao('assinatura'); }
    };
    const outraAba = () => limparTela('O acesso foi alterado em outra aba. Entre novamente para continuar.');
    const armazenamento = (event: StorageEvent) => { if (event.key === EVENTO_ABAS && event.newValue) outraAba(); };
    window.addEventListener('demandas:sem-sessao', semSessao);
    window.addEventListener('demandas:assinatura', assinaturaMudou);
    window.addEventListener('storage', armazenamento);
    try { canalRef.current = new BroadcastChannel('demandas-conta'); canalRef.current.onmessage = outraAba; } catch { /* Evento storage serve como alternativa. */ }
    void (async () => {
      await iniciarCliente();
      const geracao = geracaoSessao();
      const [catalogo, sessao] = await Promise.allSettled([api<{ planos: Plano[] }>('/planos'), api<Conta>('/auth/me')]);
      if (!ativo) return;
      if (catalogo.status === 'fulfilled') setPlanos(catalogo.value.planos);
      if (sessao.status === 'fulfilled' && geracao === geracaoSessao()) {
        const definindo = definirConta(sessao.value);
        const geracaoRestaurada = geracaoSessao();
        await definindo;
        if (!ativo || geracaoRestaurada !== geracaoSessao()) return;
        setCarregando(sessao.value.assinatura.status !== 'expirada');
        setConta(sessao.value);
      }
      else if (sessao.status === 'rejected' && !(sessao.reason instanceof ApiError && sessao.reason.status === 401)) setAvisoAcesso('Não foi possível verificar seu acesso. Confira sua conexão e tente entrar novamente.');
      setPronto(true);
    })().catch(() => { if (ativo) { setPronto(true); setAvisoAcesso('Não foi possível iniciar. Atualize a página para tentar novamente.'); } });
    return () => { ativo = false; window.removeEventListener('demandas:sem-sessao', semSessao); window.removeEventListener('demandas:assinatura', assinaturaMudou); window.removeEventListener('storage', armazenamento); canalRef.current?.close(); };
  }, [limparTela]);

  const carregarDemandas = useCallback(async () => {
    if (!contaRef.current || contaRef.current.assinatura.status === 'expirada') { setDemandas([]); setAvisoPrazo([]); setCarregando(false); return; }
    const geracao = geracaoSessao();
    setCarregando(true); setErroDemandas('');
    try {
      const lista = await api<Demanda[]>('/demandas');
      if (geracao === geracaoSessao()) {
        setDemandas(lista);
        setAvisoPrazo(lista.filter(item => !item.concluida && diasAte(item.data_vencimento) === 1));
      }
    }
    catch (error) { if (geracao === geracaoSessao()) setErroDemandas((error as Error).message); }
    finally { if (geracao === geracaoSessao()) setCarregando(false); }
  }, []);

  useEffect(() => {
    if (!conta) return;
    void carregarDemandas();
    const geracao = geracaoSessao();
    void api<Cobranca>('/cobranca/status').then(resultado => { if (geracao === geracaoSessao()) setCobranca(resultado); }).catch(() => { if (geracao === geracaoSessao()) setCobranca(null); });
  }, [conta?.usuario.id, conta?.assinatura.status, carregarDemandas]);

  useEffect(() => { if (!aviso) return; const timer = window.setTimeout(() => setAviso(null), 6500); return () => clearTimeout(timer); }, [aviso]);
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [conta?.usuario.id]);

  async function entrar(dados: Conta) {
    const definindo = definirConta(dados);
    const geracao = geracaoSessao();
    await definindo;
    if (geracao !== geracaoSessao()) return;
    setDemandas([]); setAvisoPrazo([]); setCobranca(null); setAvisoAcesso(''); setCarregando(dados.assinatura.status !== 'expirada'); setConta(dados); setVisao(dados.assinatura.status === 'expirada' ? 'assinatura' : 'dashboard'); notificarAbas();
    if (!planos.length) void api<{ planos: Plano[] }>('/planos').then(resultado => setPlanos(resultado.planos)).catch(() => {});
  }

  async function sair() {
    if (saindo) return;
    const geracao = geracaoSessao();
    setSaindo(true);
    try {
      await api('/auth/logout', 'POST', {});
      if (geracao !== geracaoSessao()) return;
      limparTela(); notificarAbas();
    }
    catch (error) { if (geracao === geracaoSessao() && !(error instanceof ApiError && error.status === 401)) setAviso({ texto: 'Não foi possível sair. Confira a conexão e tente novamente.', erro: true }); }
    finally { if (geracao === geracaoSessao()) setSaindo(false); }
  }

  async function salvar(dados: NovaDemanda) {
    const geracao = geracaoSessao();
    const resultado = await api<{ demanda: Demanda }>('/demandas', 'POST', dados);
    if (geracao !== geracaoSessao()) return;
    setDemandas(anteriores => [...anteriores, resultado.demanda].sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento) || a.id - b.id));
    if (!resultado.demanda.concluida && diasAte(resultado.demanda.data_vencimento) === 1) {
      setModal(false);
      setAvisoPrazo([...demandas, resultado.demanda].filter(item => !item.concluida && diasAte(item.data_vencimento) === 1));
    }
    setAviso({ texto: 'Demanda cadastrada. Mais um prazo sob controle!', erro: false });
  }

  async function concluir(demanda: Demanda) {
    if (concluindo !== null || carregando) return;
    const geracao = geracaoSessao();
    setConcluindo(demanda.id);
    try { const resultado = await api<{ demanda: Demanda }>(`/demandas/${demanda.id}`, 'PUT', { ...demanda, concluida: true }); if (geracao !== geracaoSessao()) return; setDemandas(anteriores => anteriores.map(item => item.id === resultado.demanda.id ? resultado.demanda : item)); setAviso({ texto: 'Demanda concluída. Bom trabalho!', erro: false }); }
    catch (error) { if (geracao === geracaoSessao()) setAviso({ texto: (error as Error).message, erro: true }); }
    finally { if (geracao === geracaoSessao()) setConcluindo(null); }
  }

  async function atualizarAcesso() {
    if (atualizando) return;
    const geracao = geracaoSessao();
    setAtualizando(true);
    try {
      const [dados, catalogo, pagamento] = await Promise.all([api<Conta>('/auth/me'), api<{ planos: Plano[] }>('/planos'), api<Cobranca>('/cobranca/status')]);
      if (geracao !== geracaoSessao()) return;
      if (contaRef.current && contaRef.current.usuario.id !== dados.usuario.id) { limparTela('A conta aberta mudou em outra aba. Entre novamente para continuar.'); return; }
      setConta(dados); setPlanos(catalogo.planos); setCobranca(pagamento); setAviso({ texto: 'Informações de acesso atualizadas.', erro: false });
    } catch (error) { if (geracao === geracaoSessao()) setAviso({ texto: (error as Error).message, erro: true }); }
    finally { if (geracao === geracaoSessao()) setAtualizando(false); }
  }

  if (!pronto) return <main className="boot-screen"><Brand/><span className="spinner"/><p>Preparando seu espaço...</p></main>;
  if (!conta) return <AuthScreen onDone={entrar} aviso={avisoAcesso}/>;
  const nova = () => { if (!carregando && conta.assinatura.status !== 'expirada') setModal(true); };
  const pendentes = demandas.filter(item => !item.concluida && diasAte(item.data_vencimento) >= 0 && diasAte(item.data_vencimento) <= 3).length;
  return <AppShell conta={conta} visao={visao} navegar={setVisao} sair={() => void sair()} saindo={saindo} pendentes={pendentes}>
    {aviso && <div className={`toast ${aviso.erro ? 'toast--error' : ''}`} role={aviso.erro ? 'alert' : 'status'}>{aviso.erro ? <AlertCircle size={20}/> : <CheckCircle2 size={20}/>}<span>{aviso.texto}</span><button className="icon-btn" onClick={() => setAviso(null)} aria-label="Fechar aviso"><X size={16}/></button></div>}
    {visao === 'dashboard' && <Dashboard conta={conta} demandas={demandas} carregando={carregando} concluindo={concluindo} concluir={item => void concluir(item)} nova={nova} navegar={setVisao} erro={erroDemandas} recarregar={() => void carregarDemandas()}/>}
    {visao === 'demandas' && (conta.assinatura.status === 'expirada' ? <Assinatura conta={conta} planos={planos} cobranca={cobranca} recarregar={() => void atualizarAcesso()} carregando={atualizando}/> : <Demandas key={conta.usuario.id} demandas={demandas} carregando={carregando} concluindo={concluindo} concluir={item => void concluir(item)} nova={nova} erro={erroDemandas} recarregar={() => void carregarDemandas()}/>)}
    {visao === 'assinatura' && <Assinatura conta={conta} planos={planos} cobranca={cobranca} recarregar={() => void atualizarAcesso()} carregando={atualizando}/>}
    {visao === 'conta' && <MinhaConta conta={conta}/>}
    {modal && <NovaDemandaModal salvar={salvar} fechar={() => setModal(false)}/>}
    {avisoPrazo.length > 0 && <AvisoPrazo demandas={avisoPrazo} fechar={() => setAvisoPrazo([])}/>}
  </AppShell>;
}
