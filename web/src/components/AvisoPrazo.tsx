import { useEffect, useRef } from 'react';
import { CalendarClock, Check, X } from 'lucide-react';
import type { Demanda } from '../types';

export default function AvisoPrazo({ demandas, fechar }: { demandas: Demanda[]; fechar: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const elemento = dialog.current; elemento?.showModal(); return () => elemento?.close(); }, []);
  const plural = demandas.length !== 1;
  return <dialog ref={dialog} className="demand-modal deadline-modal" aria-labelledby="aviso-prazo-titulo" aria-describedby="aviso-prazo-descricao" onCancel={event => { event.preventDefault(); fechar(); }}>
    <div className="modal-header"><span className="modal-icon"><CalendarClock size={25}/></span><button className="icon-btn" aria-label="Fechar aviso de vencimento" onClick={fechar}><X size={20}/></button></div>
    <span className="eyebrow">UM LEMBRETE PARA VOCÊ</span><h2 id="aviso-prazo-titulo">{plural ? 'Você tem demandas para amanhã' : 'Uma demanda vence amanhã'}</h2>
    <p id="aviso-prazo-descricao">{plural ? 'Estas demandas estão pendentes e vencem amanhã:' : 'Esta demanda está pendente e vence amanhã:'}</p>
    <div className="deadline-numbers" aria-label="Números das demandas">{demandas.map(demanda => <span key={demanda.id}>#{demanda.numero_demanda}</span>)}</div>
    <p className="deadline-dialog-note">Reserve um momento para conferir e manter seus prazos em dia.</p>
    <div className="modal-footer"><button className="primary-btn" onClick={fechar} autoFocus><Check size={17}/>Entendi</button></div>
  </dialog>;
}
