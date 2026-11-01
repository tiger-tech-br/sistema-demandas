import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, RefreshCw, RotateCcw, Trash2, X } from 'lucide-react';
import { api, geracaoSessao } from '../api';
import { dataFormatada, type Demanda, type Visao } from '../types';

export function ConfirmacaoLixeira({ titulo, children, textoConfirmar, definitiva = false, confirmar, fechar }: { titulo: string; children: ReactNode; textoConfirmar: string; definitiva?: boolean; confirmar: () => Promise<void>; fechar: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const montado = useRef(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => { montado.current = true; dialog.current?.showModal(); return () => { montado.current = false; dialog.current?.close(); }; }, []);
  async function executar() {
    if (ocupado) return;
    setOcupado(true); setErro('');
    try { await confirmar(); if (montado.current) fechar(); }
    catch (error) { if (montado.current) setErro((error as Error).message); }
    finally { if (montado.current) setOcupado(false); }
  }
  return <dialog ref={dialog} className="demand-modal trash-confirm-modal" aria-labelledby="trash-confirm-title" aria-describedby="trash-confirm-description" onCancel={event => { event.preventDefault(); if (!ocupado) fechar(); }}>
    <div className="modal-header"><span className={`modal-icon ${definitiva ? 'modal-icon--danger' : ''}`}>{definitiva ? <AlertTriangle size={25}/> : <Trash2 size={25}/>}</span><button className="icon-btn" aria-label="Fechar confirmação" disabled={ocupado} onClick={fechar}><X size={21}/></button></div>
    <h2 id="trash-confirm-title">{titulo}</h2><div id="trash-confirm-description" className="trash-confirm-description">{children}</div>
    {erro && <div className="notice notice--error" role="alert">{erro}</div>}
    <div className="modal-footer"><button className="ghost-btn" autoFocus disabled={ocupado} onClick={fechar}>Cancelar</button><button className={definitiva ? 'danger-btn' : 'primary-btn'} disabled={ocupado} onClick={() => void executar()}><Trash2 size={18}/>{ocupado ? 'Excluindo...' : textoConfirmar}</button></div>
  </dialog>;
}

export default function Lixeira({ navegar, aoAlterar }: { navegar: (visao: Visao) => void; aoAlterar: () => Promise<void> }) {
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [restaurando, setRestaurando] = useState<number | null>(null);
  const [esvaziar, setEsvaziar] = useState(false);
  const montado = useRef(true);
  const pedido = useRef(0);
  const carregar = useCallback(async () => {
    const atual = ++pedido.current;
    const geracao = geracaoSessao();
    setCarregando(true); setErro('');
    try { const lista = await api<Demanda[]>('/demandas/lixeira'); if (montado.current && atual === pedido.current && geracao === geracaoSessao()) setDemandas(lista); }
    catch (error) { if (montado.current && atual === pedido.current && geracao === geracaoSessao()) setErro((error as Error).message); }
    finally { if (montado.current && atual === pedido.current && geracao === geracaoSessao()) setCarregando(false); }
  }, []);
  useEffect(() => { montado.current = true; void carregar(); return () => { montado.current = false; pedido.current++; }; }, [carregar]);
  async function restaurar(demanda: Demanda) {
    if (restaurando !== null || carregando || esvaziar) return;
    const geracao = geracaoSessao();
    setRestaurando(demanda.id); setErro(''); setAviso('');
    try {
      await api(`/demandas/${demanda.id}/restaurar`, 'POST', {});
      if (!montado.current || geracao !== geracaoSessao()) return;
      setDemandas(anteriores => anteriores.filter(item => item.id !== demanda.id));
      setAviso(`Demanda #${demanda.numero_demanda} restaurada. Ela já está em Minhas demandas.`);
      await Promise.all([carregar(), aoAlterar()]);
    } catch (error) { if (montado.current && geracao === geracaoSessao()) setErro((error as Error).message); }
    finally { if (montado.current && geracao === geracaoSessao()) setRestaurando(null); }
  }
  async function excluirTudo() {
    const geracao = geracaoSessao();
    const resultado = await api<{ excluidas: number }>('/demandas/lixeira', 'DELETE');
    if (!montado.current || geracao !== geracaoSessao()) return;
    setDemandas([]); setAviso(`${resultado.excluidas} ${resultado.excluidas === 1 ? 'demanda excluída definitivamente' : 'demandas excluídas definitivamente'}.`);
    await Promise.all([carregar(), aoAlterar()]);
  }
  return <div className="page trash-page"><div className="page-header"><div><span className="eyebrow">SEUS REGISTROS EXCLUÍDOS</span><h1>Lixeira</h1><p>Restaure uma demanda ou exclua os registros definitivamente.</p></div><button className="danger-btn" disabled={carregando || restaurando !== null || !demandas.length} onClick={() => { setAviso(''); setEsvaziar(true); }}><Trash2 size={18}/>Esvaziar lixeira</button></div>
    <div className="notice trash-notice"><Trash2 size={21}/><p>As demandas ficam aqui até você restaurá-las ou esvaziar a lixeira. Elas não aparecem no painel nem geram lembretes de prazo.</p></div>
    {aviso && <div className="notice" role="status">{aviso}</div>}
    <section className="panel trash-panel" aria-labelledby="trash-list-title"><div className="panel-head"><h2 id="trash-list-title"><Trash2 size={20}/>Demandas na lixeira <span className="count-badge">{carregando ? '…' : demandas.length}</span></h2><button className="ghost-btn trash-refresh" disabled={carregando || restaurando !== null} onClick={() => void carregar()}><RefreshCw size={16} className={carregando ? 'spin' : ''}/><span>Atualizar</span></button></div>
      {erro && <div className="inline-error" role="alert"><p>{erro}</p><button className="ghost-btn" disabled={carregando || restaurando !== null} onClick={() => void carregar()}>Tentar novamente</button></div>}
      {carregando ? <div className="empty-state" role="status"><span className="spinner"/><strong>Buscando a lixeira...</strong></div> : !erro && !demandas.length ? <div className="empty-state"><span className="empty-icon"><Trash2 size={31}/></span><strong>Sua lixeira está vazia</strong><p>As demandas que você excluir aparecerão aqui.</p><button className="ghost-btn" onClick={() => navegar('demandas')}><ArrowLeft size={16}/>Ver minhas demandas</button></div> : <div className="trash-list">{demandas.map(demanda => <article className="trash-item" key={demanda.id}><span className="trash-item-icon"><Trash2 size={22}/></span><div className="trash-item-content"><div className="trash-item-heading"><span className="demand-number">#{demanda.numero_demanda}</span><strong>{demanda.beneficiario}</strong></div><p>{demanda.assunto}</p><div className="trash-item-meta"><span>{demanda.regional}</span><span>Vencimento: {dataFormatada(demanda.data_vencimento)}</span>{demanda.excluida_em && <time dateTime={demanda.excluida_em}>Excluída em {dataFormatada(demanda.excluida_em, true)}</time>}</div></div><button className="ghost-btn restore-btn" disabled={restaurando !== null} onClick={() => void restaurar(demanda)} aria-label={`Restaurar demanda ${demanda.numero_demanda}`}><RotateCcw size={17}/>{restaurando === demanda.id ? 'Restaurando...' : 'Restaurar'}</button></article>)}</div>}
    </section>
    {esvaziar && <ConfirmacaoLixeira titulo="Esvaziar a lixeira?" textoConfirmar="Excluir definitivamente" definitiva confirmar={excluirTudo} fechar={() => setEsvaziar(false)}><p>Todas as demandas que estão na sua lixeira serão apagadas definitivamente.</p><p><strong>Esta ação não pode ser desfeita.</strong> As demandas da lista principal serão mantidas.</p></ConfirmacaoLixeira>}
  </div>;
}
