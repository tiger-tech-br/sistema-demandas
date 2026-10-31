import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, CheckCheck, ChevronRight, ClipboardList, Filter, Plus, Search, X } from 'lucide-react';
import { REGIONAIS, dataFormatada, statusDemanda, type Demanda, type NovaDemanda } from '../types';

export function DemandaTable({ demandas, carregando, concluindo, concluir, compacto = false }: { demandas: Demanda[]; carregando: boolean; concluindo: number | null; concluir: (demanda: Demanda) => void; compacto?: boolean }) {
  if (carregando) return <div className="empty-state" role="status"><span className="spinner"/><strong>Buscando suas demandas...</strong><p>Um instante para colocar tudo em ordem.</p></div>;
  if (!demandas.length) return <div className="empty-state"><span className="empty-icon"><ClipboardList size={31}/></span><strong>Nenhuma demanda por aqui</strong><p>{compacto ? 'Cadastre sua primeira demanda e acompanhe os prazos por aqui.' : 'Cadastre uma nova demanda ou ajuste os filtros da busca.'}</p></div>;
  return <div className="table-scroll"><table className={`demanda-table ${compacto ? 'compact' : ''}`}><thead><tr><th>Nº da demanda</th><th>Beneficiário / assunto</th>{!compacto && <th>Regional</th>}<th>Vencimento</th><th>Status</th><th><span className="sr-only">Ação</span></th></tr></thead><tbody>{demandas.map(demanda => {
    const status = statusDemanda(demanda);
    return <tr key={demanda.id}><td data-label="Nº da demanda"><span className="demand-number">#{demanda.numero_demanda}</span></td><td data-label="Beneficiário / assunto"><div className="beneficiary-cell"><span className="beneficiary-avatar">{demanda.beneficiario.charAt(0).toUpperCase()}</span><span><strong>{demanda.beneficiario}</strong><small title={demanda.assunto}>{demanda.assunto}</small></span></div></td>{!compacto && <td data-label="Regional"><span className="regional-cell">{demanda.regional}</span></td>}<td data-label="Vencimento"><time dateTime={demanda.data_vencimento}>{dataFormatada(demanda.data_vencimento)}</time></td><td data-label="Status"><span className={`status ${status.classe}`}><i/>{status.label}</span></td><td className="action-cell">{demanda.concluida ? <span className="finished-label"><CheckCheck size={17}/><span>Concluída</span></span> : <button className="table-action" disabled={concluindo !== null} onClick={() => concluir(demanda)} aria-label={`Concluir demanda ${demanda.numero_demanda}`}><Check size={15}/>{concluindo === demanda.id ? 'Salvando...' : 'Concluir'}</button>}</td></tr>;
  })}</tbody></table></div>;
}

type Props = { demandas: Demanda[]; carregando: boolean; concluindo: number | null; concluir: (demanda: Demanda) => void; nova: () => void; erro: string; recarregar: () => void };
export default function Demandas({ demandas, carregando, concluindo, concluir, nova, erro, recarregar }: Props) {
  const [beneficiario, setBeneficiario] = useState('');
  const [assunto, setAssunto] = useState('');
  const [regional, setRegional] = useState('');
  const [status, setStatus] = useState('');
  const [conclusao, setConclusao] = useState('');
  const normalizar = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtradas = demandas.filter(demanda => (!beneficiario || normalizar(demanda.beneficiario).includes(normalizar(beneficiario))) && (!assunto || normalizar(demanda.assunto).includes(normalizar(assunto))) && (!regional || demanda.regional === regional) && (!status || (status === 'proxima' ? statusDemanda(demanda).classe === 'pending' : status === 'andamento' ? !demanda.concluida && statusDemanda(demanda).classe !== 'pending' : demanda.concluida)) && (!conclusao || demanda.concluida === (conclusao === 'concluida')));
  const temFiltro = Boolean(beneficiario || assunto || regional || status || conclusao);
  function limpar() { setBeneficiario(''); setAssunto(''); setRegional(''); setStatus(''); setConclusao(''); }
  return <div className="page demand-page"><div className="page-header"><div><span className="eyebrow">SEU DIA MAIS ORGANIZADO</span><h1>Minhas demandas</h1><p>Acompanhe cada registro, do cadastro à conclusão.</p></div><button className="primary-btn" disabled={carregando} onClick={nova}><Plus size={19}/>Nova demanda</button></div>
    <section className="panel filter-panel" aria-label="Filtrar demandas"><div className="panel-head"><h2><Filter size={18}/>Encontre uma demanda</h2>{temFiltro && <button className="text-link" onClick={limpar}>Limpar filtros <X size={14}/></button>}</div><div className="filters"><label>Beneficiário<span className="input-icon"><Search size={17}/><input type="search" placeholder="Pesquisar nome" value={beneficiario} onChange={event => setBeneficiario(event.target.value)}/></span></label><label>Assunto<span className="input-icon"><Search size={17}/><input type="search" placeholder="Pesquisar assunto" value={assunto} onChange={event => setAssunto(event.target.value)}/></span></label><label>Regional<select value={regional} onChange={event => setRegional(event.target.value)}><option value="">Todas as regionais</option>{REGIONAIS.map(item => <option key={item}>{item}</option>)}</select></label><label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="">Todos os status</option><option value="andamento">Em andamento</option><option value="proxima">Próxima de vencer</option><option value="concluida">Concluída</option></select></label><label>Conclusão<select value={conclusao} onChange={event => setConclusao(event.target.value)}><option value="">Todas</option><option value="pendente">Pendente</option><option value="concluida">Concluída</option></select></label></div></section>
    <section className="panel table-panel"><div className="panel-head"><h2><ClipboardList size={20}/>Seus registros <span className="count-badge">{filtradas.length}</span></h2><span className="muted small-text">Por ordem de vencimento</span></div>{erro ? <div className="inline-error" role="alert"><p>{erro}</p><button className="ghost-btn" onClick={recarregar}>Tentar novamente</button></div> : <DemandaTable demandas={filtradas} carregando={carregando} concluindo={concluindo} concluir={concluir}/>}</section><p className="page-footnote"><CheckCheck size={14}/>Marque como concluída quando uma demanda estiver resolvida.</p>
  </div>;
}

export function NovaDemandaModal({ salvar, fechar }: { salvar: (dados: NovaDemanda) => Promise<void>; fechar: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const montado = useRef(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => { montado.current = true; dialog.current?.showModal(); return () => { montado.current = false; dialog.current?.close(); }; }, []);
  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (salvando) return;
    const dados = new FormData(event.currentTarget);
    setSalvando(true); setErro('');
    try { await salvar({ numero_demanda: String(dados.get('numero')).trim(), beneficiario: String(dados.get('beneficiario')).trim(), regional: String(dados.get('regional')), assunto: String(dados.get('assunto')).trim(), data_vencimento: String(dados.get('vencimento')), concluida: false }); if (montado.current) fechar(); }
    catch (error) { if (montado.current) setErro((error as Error).message); }
    finally { if (montado.current) setSalvando(false); }
  }
  return <dialog ref={dialog} className="demand-modal" aria-labelledby="modal-title" onCancel={event => { event.preventDefault(); if (!salvando) fechar(); }}><div className="modal-header"><span className="modal-icon"><ClipboardList size={25}/></span><button className="icon-btn" type="button" aria-label="Fechar cadastro" disabled={salvando} onClick={fechar}><X size={21}/></button></div><h2 id="modal-title">Uma nova demanda</h2><p className="muted">Preencha os dados e deixe o prazo com a gente.</p>{erro && <div className="notice notice--error" role="alert">{erro}</div>}<form onSubmit={enviar}><fieldset disabled={salvando} className="form-grid"><label>Nº da demanda<input name="numero" inputMode="numeric" pattern="[0-9]{1,20}" maxLength={20} required placeholder="Ex.: 12345" autoFocus/></label><label>Regional<select name="regional" required defaultValue=""><option value="" disabled>Selecione a regional</option>{REGIONAIS.map(item => <option key={item}>{item}</option>)}</select></label><label className="full-width">Nome do beneficiário<input name="beneficiario" required minLength={2} maxLength={120} placeholder="Nome completo"/></label><label className="full-width">Assunto<input name="assunto" required minLength={3} maxLength={120} placeholder="Sobre o que é esta demanda?"/></label><label className="full-width">Vencimento<input name="vencimento" type="date" required/></label></fieldset><div className="modal-footer"><button className="ghost-btn" type="button" disabled={salvando} onClick={fechar}>Cancelar</button><button className="primary-btn" type="submit" disabled={salvando}>{salvando ? 'Cadastrando...' : 'Cadastrar demanda'}<ChevronRight size={17}/></button></div></form></dialog>;
}
