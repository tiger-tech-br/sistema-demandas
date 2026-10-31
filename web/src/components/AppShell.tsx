import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, Bell, ChevronDown, CircleHelp, CreditCard, LayoutDashboard, ListChecks, LogOut, Menu, ShieldCheck, UserRound, X } from 'lucide-react';
import type { Conta, Visao } from '../types';
import Brand from './Brand';

type Props = { conta: Conta; visao: Visao; navegar: (visao: Visao) => void; sair: () => void; saindo: boolean; pendentes: number; children: ReactNode };
const links = [{ id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard }, { id: 'demandas', label: 'Minhas demandas', icon: ListChecks }, { id: 'assinatura', label: 'Plano e assinatura', icon: CreditCard }, { id: 'conta', label: 'Minha conta', icon: UserRound }] as const;

export default function AppShell({ conta, visao, navegar, sair, saindo, pendentes, children }: Props) {
  const [aberto, setAberto] = useState(false);
  useEffect(() => { if (!aberto) return; const fechar = (event: KeyboardEvent) => { if (event.key === 'Escape') setAberto(false); }; window.addEventListener('keydown', fechar); return () => window.removeEventListener('keydown', fechar); }, [aberto]);
  function ir(destino: Visao) { navegar(destino); setAberto(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  const iniciais = conta.usuario.nome.split(' ').filter(Boolean).slice(0, 2).map(parte => parte[0]).join('').toUpperCase();
  return <div className="app-shell">
    {aberto && <button className="sidebar-shade" aria-label="Fechar menu" onClick={() => setAberto(false)}/>}
    <aside className={`sidebar ${aberto ? 'open' : ''}`}><div className="sidebar-brand"><Brand inverse/><button className="close-menu icon-btn" aria-label="Fechar menu" onClick={() => setAberto(false)}><X size={21}/></button></div>
      <p className="nav-caption">SEU ESPAÇO DE TRABALHO</p><nav aria-label="Menu principal">{links.map(link => <button key={link.id} className={`nav-item ${visao === link.id ? 'active' : ''}`} aria-current={visao === link.id ? 'page' : undefined} onClick={() => ir(link.id)}><link.icon size={21}/><span>{link.label}</span>{link.id === 'demandas' && pendentes > 0 && <small className="nav-count">{pendentes}</small>}</button>)}</nav>
      <div className="sidebar-tip"><span className="tip-icon"><ShieldCheck size={22}/></span><strong>{conta.assinatura.status === 'teste' ? 'Sua rotina, mais leve' : 'Um espaço só seu'}</strong><p>{conta.assinatura.status === 'teste' ? `${conta.assinatura.dias_restantes} dias para descobrir uma nova forma de organizar seus prazos.` : 'Suas demandas organizadas e disponíveis quando você precisar.'}</p><button onClick={() => ir('assinatura')}>Ver meu acesso <ArrowUpRight size={16}/></button></div>
      <div className="sidebar-footer"><div className="sidebar-profile"><span className="avatar">{iniciais}</span><div><strong>{conta.usuario.nome}</strong><small>Conta individual</small></div></div><button className="nav-item" onClick={sair} disabled={saindo}><LogOut size={20}/>{saindo ? 'Saindo...' : 'Sair da conta'}</button></div>
    </aside>
    <div className="main-content"><header className="topbar"><div className="mobile-brand"><Brand/></div><div className="workspace-name"><span className="workspace-icon"><ListChecks size={20}/></span><span>Meu espaço de trabalho<small>Organização que acompanha você</small></span></div><div className="top-actions"><button className="icon-btn notification-btn" title="Ver demandas próximas do vencimento" aria-label="Ver demandas próximas do vencimento" onClick={() => ir('demandas')}><Bell size={21}/>{pendentes > 0 && <i/>}</button><span className="top-divider"/><button className="top-profile" onClick={() => ir('conta')}><span className="avatar">{iniciais}</span><span><strong>{conta.usuario.nome.split(' ')[0]}</strong><small>Conta individual</small></span><ChevronDown size={15}/></button><button className="icon-btn mobile-menu" onClick={() => setAberto(true)} aria-label="Abrir menu" aria-expanded={aberto}><Menu size={23}/></button></div></header><main className="content-wrap" id="conteudo">{children}</main><footer className="workspace-footer"><ShieldCheck size={13}/> Seus dados pertencem à sua conta.<span>Demandas • Simples. No prazo.</span></footer></div>
    <nav className="mobile-bottom-nav" aria-label="Navegação no celular">{links.map(link => <button key={link.id} className={visao === link.id ? 'active' : ''} onClick={() => ir(link.id)}><link.icon size={21}/><span>{link.id === 'dashboard' ? 'Início' : link.id === 'demandas' ? 'Demandas' : link.id === 'assinatura' ? 'Assinatura' : 'Conta'}</span></button>)}</nav>
  </div>;
}
