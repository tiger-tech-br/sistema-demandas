import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, CalendarCheck2, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { api, geracaoSessao } from '../api';
import type { Conta } from '../types';
import Brand from './Brand';
import { PoliticaModal, usePolitica } from './Privacidade';

type ModoAcesso = 'login' | 'cadastro' | 'esqueci' | 'redefinir';
const MENSAGEM_RECUPERACAO = 'Se houver uma conta com esse e-mail, você receberá as instruções para redefinir sua senha. Confira também a pasta de spam.';

export default function AuthScreen({ onDone, aviso, redefinicao }: { onDone: (conta: Conta) => Promise<void>; aviso: string; redefinicao: { presente: boolean; token: string } }) {
  const [modo, setModo] = useState<ModoAcesso>(redefinicao.presente ? 'redefinir' : 'login');
  const [token, setToken] = useState(redefinicao.token);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [visivel, setVisivel] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(redefinicao.presente && !redefinicao.token ? 'Este link de recuperação está incompleto. Solicite um novo link para continuar.' : '');
  const [mensagem, setMensagem] = useState('');
  const [aceitou, setAceitou] = useState(false);
  const [politicaAberta, setPoliticaAberta] = useState(false);
  const { politica, erro: erroPolitica, carregar: carregarPolitica } = usePolitica();
  const cadastro = modo === 'cadastro';
  const recuperando = modo === 'esqueci';
  const redefinindo = modo === 'redefinir';
  const titulos: Record<ModoAcesso, string> = { login: 'Acesse seu painel', cadastro: 'Comece sua nova rotina', esqueci: 'Recupere seu acesso', redefinir: 'Crie uma nova senha' };
  const descricoes: Record<ModoAcesso, string> = { login: 'Entre na sua conta para continuar de onde parou.', cadastro: 'Crie sua conta e experimente por 30 dias grátis.', esqueci: 'Informe o e-mail usado na sua conta. Vamos ajudar você a entrar novamente.', redefinir: 'Escolha uma senha de 10 a 128 caracteres para proteger sua conta.' };

  function limparTokenDoEndereco() {
    setToken('');
  }

  function alterarModo(proximo: ModoAcesso) {
    if (ocupado) return;
    if (modo === 'redefinir' && proximo !== 'redefinir') limparTokenDoEndereco();
    setModo(proximo); setErro(''); setMensagem(''); setSenha(''); setConfirmacao(''); setVisivel(false);
  }

  async function enviar(event: FormEvent) {
    event.preventDefault();
    if (ocupado) return;
    setErro(''); setMensagem('');
    if (redefinindo && !token) { setErro('Este link de recuperação está incompleto. Solicite um novo link para continuar.'); return; }
    if (redefinindo && senha !== confirmacao) { setErro('As senhas não são iguais. Confira a confirmação.'); return; }
    if (cadastro && (!aceitou || !politica)) { setErro('Leia e aceite os Termos de Uso e a Política de Privacidade para criar sua conta.'); return; }
    setOcupado(true);
    const geracao = geracaoSessao();
    try {
      if (recuperando) {
        await api<{ mensagem: string }>('/auth/esqueci-senha', 'POST', { email: email.trim() });
        if (geracao === geracaoSessao()) setMensagem(MENSAGEM_RECUPERACAO);
      } else if (redefinindo) {
        await api<{ mensagem: string }>('/auth/redefinir-senha', 'POST', { token, senha });
        if (geracao !== geracaoSessao()) return;
        limparTokenDoEndereco(); setModo('login'); setVisivel(false);
        setMensagem('Senha atualizada. Entre com sua nova senha para continuar.');
      } else {
        const conta = await api<Conta>(cadastro ? '/auth/cadastro' : '/auth/login', 'POST', { email: email.trim(), senha, ...(cadastro ? { nome: nome.trim(), aceite_termos: true, versao_termos: politica!.versao } : {}) });
        if (geracao !== geracaoSessao()) return;
        await onDone(conta);
      }
    } catch (error) { if (geracao === geracaoSessao()) setErro((error as Error).message); }
    finally { setOcupado(false); setSenha(''); setConfirmacao(''); }
  }

  return <main className="auth-page"><div className="auth-card">
    <header className="auth-top"><Brand/><span className="auth-safe"><ShieldCheck size={17}/> Espaço individual e seguro</span></header>
    <div className="auth-content"><section className="auth-hero">
      <span className="eyebrow"><Sparkles size={15}/> MENOS CORRERIA. MAIS CONTROLE.</span>
      <h1>Seus prazos{' '}<br/>em dia{' '}<br/><span>Sua rotina leve</span></h1>
      <p>Um lugar para organizar suas demandas e cuidar do que realmente precisa da sua atenção.</p>
      <div className="hero-preview"><div className="preview-icon"><CalendarCheck2 size={28}/></div><div><strong>Tudo no seu tempo.</strong><span>Organize. Acompanhe. Conclua.</span></div><span className="preview-check"><Check size={18}/></span></div>
      <div className="hero-benefits"><span><Check size={15}/> Demandas em um só lugar</span><span><Check size={15}/> Alertas de vencimento</span><span><Check size={15}/> Seu espaço, seus registros</span></div>
      <div className="hero-orbit" aria-hidden="true"/>
    </section><section className="auth-login" aria-labelledby="auth-heading">
      <div className="auth-form-heading"><span className="eyebrow">BEM-VINDO AO DEMANDAS</span><h2 id="auth-heading">{titulos[modo]}</h2><p>{descricoes[modo]}</p></div>
      {!recuperando && !redefinindo && <div className="auth-tabs"><button type="button" className={!cadastro ? 'selected' : ''} disabled={ocupado} onClick={() => alterarModo('login')}>Entrar</button><button type="button" className={cadastro ? 'selected' : ''} disabled={ocupado} onClick={() => alterarModo('cadastro')}>Criar conta</button></div>}
      {(erro || ((!recuperando && !redefinindo) ? aviso : '')) && <div className="notice notice--error" role="alert">{erro || aviso}</div>}
      {mensagem && <div className="notice auth-notice-success" role="status">{mensagem}</div>}
      <form onSubmit={enviar} className="auth-form">
        {cadastro && <label>Seu nome<span className="input-icon"><UserRound size={19}/><input required minLength={2} maxLength={120} autoComplete="name" placeholder="Como podemos chamar você?" value={nome} onChange={event => setNome(event.target.value)} disabled={ocupado}/></span></label>}
        {!redefinindo && <label>E-mail<span className="input-icon"><Mail size={19}/><input required type="email" maxLength={254} autoComplete="username" placeholder="seuemail@exemplo.com" value={email} onChange={event => setEmail(event.target.value)} disabled={ocupado}/></span></label>}
        {!recuperando && <label>{redefinindo ? 'Nova senha' : cadastro ? 'Crie uma senha' : 'Senha'}<span className="input-icon"><LockKeyhole size={19}/><input required type={visivel ? 'text' : 'password'} minLength={cadastro || redefinindo ? 10 : undefined} maxLength={128} autoComplete={cadastro || redefinindo ? 'new-password' : 'current-password'} placeholder={cadastro || redefinindo ? 'Pelo menos 10 caracteres' : 'Digite sua senha'} value={senha} onChange={event => setSenha(event.target.value)} disabled={ocupado}/><button className="password-toggle" type="button" aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setVisivel(!visivel)}>{visivel ? <EyeOff size={19}/> : <Eye size={19}/>}</button></span></label>}
        {redefinindo && <label>Confirme a nova senha<span className="input-icon"><LockKeyhole size={19}/><input required type={visivel ? 'text' : 'password'} minLength={10} maxLength={128} autoComplete="new-password" placeholder="Digite a nova senha novamente" value={confirmacao} onChange={event => setConfirmacao(event.target.value)} disabled={ocupado}/></span></label>}
        {modo === 'login' && <div className="auth-form-options"><button type="button" className="text-link" disabled={ocupado} onClick={() => alterarModo('esqueci')}>Esqueci minha senha</button></div>}
        {cadastro && <><label className="checkbox-label auth-consent"><input type="checkbox" required checked={aceitou} disabled={ocupado || !politica} onChange={event => setAceitou(event.target.checked)}/><span>Li e aceito os <button type="button" className="text-link" onClick={() => setPoliticaAberta(true)}>Termos de Uso</button> e a <button type="button" className="text-link" onClick={() => setPoliticaAberta(true)}>Política de Privacidade</button>.</span></label>{erroPolitica && <div className="notice notice--error" role="alert">Não foi possível carregar os termos. <button type="button" className="text-link" onClick={() => void carregarPolitica()}>Tentar novamente</button></div>}</>}
        <button className="primary-btn auth-submit" disabled={ocupado || (redefinindo && !token) || (cadastro && (!aceitou || !politica))} type="submit">{ocupado ? 'Aguarde um instante...' : recuperando ? 'Enviar instruções' : redefinindo ? 'Salvar nova senha' : cadastro ? 'Criar minha conta' : 'Entrar'}<ArrowRight size={20}/></button>
      </form>
      {(recuperando || redefinindo) && <button className="text-link auth-back" type="button" disabled={ocupado} onClick={() => alterarModo('login')}><ArrowLeft size={16}/>Voltar para entrar</button>}
      {redefinindo && <button className="text-link auth-reset-again" type="button" disabled={ocupado} onClick={() => alterarModo('esqueci')}>Solicitar um novo link</button>}
      <p className="auth-note"><ShieldCheck size={16}/>{cadastro ? 'Sem cartão de crédito durante o teste.' : recuperando || redefinindo ? 'Recuperação segura para todas as contas.' : 'Seus registros ficam protegidos na sua conta.'}</p>
      <footer className="auth-copyright"><button className="text-link" type="button" onClick={() => setPoliticaAberta(true)}>Privacidade e Termos de Uso</button><p>© {new Date().getFullYear()} Demandas. Um passo à frente dos seus prazos.</p></footer>
    </section></div>
  </div>{politicaAberta && <PoliticaModal fechar={() => setPoliticaAberta(false)}/>}</main>;
}
