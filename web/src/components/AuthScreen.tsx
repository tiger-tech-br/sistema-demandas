import { useState, type FormEvent } from 'react';
import { ArrowRight, CalendarCheck2, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { api, geracaoSessao } from '../api';
import type { Conta } from '../types';
import Brand from './Brand';

export default function AuthScreen({ onDone, aviso }: { onDone: (conta: Conta) => Promise<void>; aviso: string }) {
  const [cadastro, setCadastro] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [visivel, setVisivel] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  async function enviar(event: FormEvent) {
    event.preventDefault();
    if (ocupado) return;
    setOcupado(true); setErro('');
    const geracao = geracaoSessao();
    try {
      const conta = await api<Conta>(cadastro ? '/auth/cadastro' : '/auth/login', 'POST', { email: email.trim(), senha, ...(cadastro ? { nome: nome.trim() } : {}) });
      if (geracao !== geracaoSessao()) return;
      await onDone(conta);
    } catch (error) { setErro((error as Error).message); }
    finally { setOcupado(false); setSenha(''); }
  }

  return <main className="auth-page"><div className="auth-card">
    <header className="auth-top"><Brand/><span className="auth-safe"><ShieldCheck size={17}/> Espaço individual e seguro</span></header>
    <div className="auth-content"><section className="auth-hero">
      <span className="eyebrow"><Sparkles size={15}/> MENOS CORRERIA. MAIS CONTROLE.</span>
      <h1>Seus prazos{' '}<br/>em dia.{' '}<br/><span>Sua rotina leve.</span></h1>
      <p>Um lugar para organizar suas demandas e cuidar do que realmente precisa da sua atenção.</p>
      <div className="hero-preview"><div className="preview-icon"><CalendarCheck2 size={28}/></div><div><strong>Tudo no seu tempo.</strong><span>Organize. Acompanhe. Conclua.</span></div><span className="preview-check"><Check size={18}/></span></div>
      <div className="hero-benefits"><span><Check size={15}/> Demandas em um só lugar</span><span><Check size={15}/> Alertas de vencimento</span><span><Check size={15}/> Seu espaço, seus registros</span></div>
      <div className="hero-orbit" aria-hidden="true"/>
    </section><section className="auth-login" aria-labelledby="auth-heading">
      <div className="auth-form-heading"><span className="eyebrow">BEM-VINDO AO DEMANDAS</span><h2 id="auth-heading">{cadastro ? 'Comece sua nova rotina' : 'Acesse seu painel'}</h2><p>{cadastro ? 'Crie sua conta e experimente por 30 dias grátis.' : 'Entre na sua conta para continuar de onde parou.'}</p></div>
      <div className="auth-tabs"><button type="button" className={!cadastro ? 'selected' : ''} disabled={ocupado} onClick={() => { setCadastro(false); setErro(''); }}>Entrar</button><button type="button" className={cadastro ? 'selected' : ''} disabled={ocupado} onClick={() => { setCadastro(true); setErro(''); }}>Criar conta</button></div>
      {(erro || aviso) && <div className="notice notice--error" role="alert">{erro || aviso}</div>}
      <form onSubmit={enviar} className="auth-form">
        {cadastro && <label>Seu nome<span className="input-icon"><UserRound size={19}/><input required minLength={2} maxLength={120} autoComplete="name" placeholder="Como podemos chamar você?" value={nome} onChange={event => setNome(event.target.value)} disabled={ocupado}/></span></label>}
        <label>E-mail<span className="input-icon"><Mail size={19}/><input required type="email" maxLength={254} autoComplete="username" placeholder="seuemail@exemplo.com" value={email} onChange={event => setEmail(event.target.value)} disabled={ocupado}/></span></label>
        <label>{cadastro ? 'Crie uma senha' : 'Senha'}<span className="input-icon"><LockKeyhole size={19}/><input required type={visivel ? 'text' : 'password'} minLength={cadastro ? 10 : undefined} maxLength={128} autoComplete={cadastro ? 'new-password' : 'current-password'} placeholder={cadastro ? 'Pelo menos 10 caracteres' : 'Digite sua senha'} value={senha} onChange={event => setSenha(event.target.value)} disabled={ocupado}/><button className="password-toggle" type="button" aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setVisivel(!visivel)}>{visivel ? <EyeOff size={19}/> : <Eye size={19}/>}</button></span></label>
        <button className="primary-btn auth-submit" disabled={ocupado} type="submit">{ocupado ? 'Aguarde um instante...' : cadastro ? 'Começar meus 30 dias grátis' : 'Entrar na minha conta'}<ArrowRight size={20}/></button>
      </form>
      <p className="auth-note"><ShieldCheck size={16}/>{cadastro ? 'Sem cartão de crédito durante o teste.' : 'Seus registros ficam protegidos na sua conta.'}</p>
      <footer className="auth-copyright">© {new Date().getFullYear()} Demandas. Um passo à frente dos seus prazos.</footer>
    </section></div>
  </div></main>;
}
