import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, Check, Download, FileText, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import { android, api, geracaoSessao } from '../api';
import { dataFormatada, type Conta, type Politica, type SolicitacaoPrivacidade } from '../types';

export function usePolitica() {
  const [politica, setPolitica] = useState<Politica | null>(null);
  const [erro, setErro] = useState('');
  const carregar = useCallback(async () => {
    setErro('');
    try { setPolitica(await api<Politica>('/privacidade/politica')); }
    catch (error) { setErro((error as Error).message); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  return { politica, erro, carregar };
}

function TextoPolitica({ politica }: { politica: Politica }) {
  return <div className="policy-copy"><p>Responsável: <strong>{politica.responsavel}</strong> · Versão {politica.versao}</p><p>Contato: <a href={`mailto:${politica.contato}`}>{politica.contato}</a></p><h3>Política de Privacidade</h3>{politica.privacidade.map((item, indice) => <section key={indice}><h4>{item.titulo}</h4><p>{item.texto}</p></section>)}<h3>Termos de Uso</h3>{politica.termos.map((item, indice) => <section key={indice}><h4>{item.titulo}</h4><p>{item.texto}</p></section>)}</div>;
}

export function PoliticaModal({ fechar, obrigatoria = false, aceita, sair, gerenciarPrivacidade }: { fechar: () => void; obrigatoria?: boolean; aceita?: () => void; sair?: () => void; gerenciarPrivacidade?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { politica, erro: erroPolitica, carregar } = usePolitica();
  const [confirmado, setConfirmado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => { const elemento = dialog.current; elemento?.showModal(); return () => elemento?.close(); }, []);
  async function aceitar() {
    if (!politica || !confirmado || ocupado) return;
    const geracao = geracaoSessao(); setOcupado(true); setErro('');
    try { await api('/privacidade/aceite', 'POST', { versao: politica.versao }); if (geracao === geracaoSessao()) aceita?.(); }
    catch (error) { if (geracao === geracaoSessao()) setErro((error as Error).message); }
    finally { setOcupado(false); }
  }
  return <dialog ref={dialog} className="demand-modal policy-modal" aria-labelledby="policy-title" onCancel={event => { event.preventDefault(); if (!obrigatoria && !ocupado) fechar(); }}><div className="modal-header"><span className="modal-icon"><ShieldCheck size={25}/></span>{!obrigatoria && <button className="icon-btn" aria-label="Fechar política" onClick={fechar}><X size={20}/></button>}</div><h2 id="policy-title">Privacidade e Termos de Uso</h2><p>{obrigatoria ? 'Revise estas informações e registre seu aceite para continuar usando sua conta.' : 'Saiba como seus dados são usados e quais condições se aplicam à sua conta.'}</p>{erroPolitica && <div className="notice notice--error" role="alert">{erroPolitica}<button className="text-link" onClick={() => void carregar()}>Tentar novamente</button></div>}{politica ? <TextoPolitica politica={politica}/> : !erroPolitica && <p role="status">Carregando os documentos...</p>}{erro && <div className="notice notice--error" role="alert">{erro}</div>}{obrigatoria && gerenciarPrivacidade && <button type="button" className="text-link privacy-without-consent" onClick={gerenciarPrivacidade}>Meus dados e privacidade</button>}{obrigatoria && <label className="checkbox-label"><input type="checkbox" checked={confirmado} onChange={event => setConfirmado(event.target.checked)} disabled={ocupado || !politica}/><span>Li e aceito os Termos de Uso e a Política de Privacidade, versão {politica?.versao || 'atual'}.</span></label>}<div className="modal-footer">{obrigatoria ? <><button className="ghost-btn" disabled={ocupado} onClick={sair}>Sair da conta</button><button className="primary-btn" disabled={!politica || !confirmado || ocupado} onClick={() => void aceitar()}>{ocupado ? 'Salvando...' : 'Aceitar e continuar'}<Check size={17}/></button></> : <button className="primary-btn" onClick={fechar}>Concluir leitura</button>}</div></dialog>;
}

const tipos = { acesso: 'Acesso aos dados', correcao: 'Correção de dados', exclusao: 'Exclusão de dados', outro: 'Outra solicitação' };

export function ExcluirContaModal({ confirmar, fechar, precisaCancelar }: { confirmar: () => Promise<void>; fechar: () => void; precisaCancelar: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const montado = useRef(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => { montado.current = true; const elemento = dialog.current; elemento?.showModal(); return () => { montado.current = false; elemento?.close(); }; }, []);
  async function excluir() {
    if (ocupado) return;
    setOcupado(true); setErro('');
    try { await confirmar(); }
    catch (error) { if (montado.current) setErro((error as Error).message); }
    finally { if (montado.current) setOcupado(false); }
  }
  return <dialog ref={dialog} className="demand-modal account-delete-modal" aria-labelledby="account-delete-title" aria-describedby="account-delete-description" onCancel={event => { event.preventDefault(); if (!ocupado) fechar(); }}>
    <div className="modal-header"><span className="modal-icon modal-icon--danger"><AlertTriangle size={25}/></span><button className="icon-btn" aria-label="Fechar confirmação" disabled={ocupado} onClick={fechar}><X size={21}/></button></div>
    <h2 id="account-delete-title">Tem certeza que quer excluir seu cadastro?</h2>
    <div id="account-delete-description" className="account-delete-description"><p>{precisaCancelar ? 'Vamos solicitar o encerramento da cobrança no PagBank. Sua conta e seus dados só serão apagados depois que o responsável confirmar esse encerramento.' : 'Sua conta, suas demandas e os dados vinculados serão apagados definitivamente.'}</p><p>A exclusão definitiva encerra seu acesso e não pode ser desfeita.</p></div>
    {erro && <div className="notice notice--error" role="alert">{erro}</div>}
    <div className="modal-footer"><button className="ghost-btn" autoFocus disabled={ocupado} onClick={fechar}>Voltar</button><button className="danger-btn" disabled={ocupado} onClick={() => void excluir()}><Trash2 size={18}/>{ocupado ? 'Processando...' : precisaCancelar ? 'Confirmar exclusão' : 'Excluir definitivamente'}</button></div>
  </dialog>;
}

export default function Privacidade({ conta, excluirConta }: { conta: Conta; excluirConta?: () => void }) {
  const admin = conta.usuario.papel === 'admin';
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoPrivacidade[]>([]);
  const [fila, setFila] = useState<SolicitacaoPrivacidade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [tipo, setTipo] = useState<keyof typeof tipos>('acesso');
  const [descricao, setDescricao] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [dadosVisiveis, setDadosVisiveis] = useState('');
  const [politicaAberta, setPoliticaAberta] = useState(false);
  const carregar = useCallback(async () => {
    const geracao = geracaoSessao(); setCarregando(true); setErro('');
    try {
      const resultados = await Promise.all([api<{ solicitacoes: SolicitacaoPrivacidade[] }>('/privacidade/solicitacoes'), admin ? api<{ solicitacoes: SolicitacaoPrivacidade[] }>('/admin/privacidade') : Promise.resolve(null)]);
      if (geracao !== geracaoSessao()) return;
      setSolicitacoes(resultados[0].solicitacoes); if (resultados[1]) setFila(resultados[1].solicitacoes);
    } catch (error) { if (geracao === geracaoSessao()) setErro((error as Error).message); }
    finally { if (geracao === geracaoSessao()) setCarregando(false); }
  }, [admin]);
  useEffect(() => { void carregar(); }, [carregar]);
  async function solicitar(event: FormEvent) {
    event.preventDefault(); if (ocupado) return;
    const geracao = geracaoSessao(); setOcupado(true); setErro(''); setAviso('');
    try {
      const resultado = await api<{ solicitacao: SolicitacaoPrivacidade }>('/privacidade/solicitacoes', 'POST', { tipo, descricao: descricao.trim() });
      if (geracao !== geracaoSessao()) return;
      setSolicitacoes(anteriores => [resultado.solicitacao, ...anteriores]); setDescricao(''); setAviso('Solicitação registrada. A resposta aparecerá nesta página.');
      if (admin) setFila(anteriores => [resultado.solicitacao, ...anteriores]);
    } catch (error) { if (geracao === geracaoSessao()) setErro((error as Error).message); }
    finally { if (geracao === geracaoSessao()) setOcupado(false); }
  }
  async function exportar() {
    if (exportando) return; const geracao = geracaoSessao(); setExportando(true); setErro('');
    try {
      const dados = await api<unknown>('/privacidade/dados'); if (geracao !== geracaoSessao()) return;
      const conteudo = JSON.stringify(dados, null, 2); setDadosVisiveis(conteudo);
      if (!android) { const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = `meus-dados-demandas-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (error) { if (geracao === geracaoSessao()) setErro((error as Error).message); }
    finally { if (geracao === geracaoSessao()) setExportando(false); }
  }
  return <div className="page privacy-page"><div className="page-header"><div><span className="eyebrow">SEUS DADOS, SEUS DIREITOS</span><h1>Privacidade</h1><p>Consulte seus dados e acompanhe suas solicitações.</p></div><button className="ghost-btn" disabled={carregando} onClick={() => void carregar()}><RefreshCw size={16} className={carregando ? 'spin' : ''}/>Atualizar</button></div>{erro && <div className="notice notice--error" role="alert">{erro}</div>}{aviso && <div className="notice admin-success" role="status">{aviso}</div>}<section className="panel privacy-actions"><div><span className="modal-icon"><ShieldCheck size={24}/></span><h2>Informações da sua conta</h2><p>A exportação reúne somente os dados vinculados à sua própria conta.</p></div><div className="privacy-buttons"><button className="ghost-btn" onClick={() => setPoliticaAberta(true)}><FileText size={17}/>Ler política e termos</button><button className="primary-btn" disabled={exportando} onClick={() => void exportar()}><Download size={17}/>{exportando ? 'Preparando...' : 'Exportar meus dados'}</button>{!admin && excluirConta && <button className="danger-btn" disabled={Boolean(conta.assinatura.exclusao_solicitada_em)} onClick={excluirConta}><Trash2 size={17}/>{conta.assinatura.exclusao_solicitada_em ? 'Exclusão em andamento' : 'Excluir cadastro'}</button>}</div></section>{dadosVisiveis && <section className="panel privacy-export"><div className="panel-head"><h2>Seus dados em JSON</h2><button className="text-link" onClick={() => setDadosVisiveis('')}>Ocultar</button></div><p>{android ? 'Você pode ler e copiar os dados abaixo.' : 'O download foi preparado. Você também pode consultar e copiar o conteúdo abaixo.'}</p><pre tabIndex={0}>{dadosVisiveis}</pre></section>}<div className="privacy-grid"><section className="panel"><div className="panel-head"><h2>Enviar uma solicitação</h2></div><p className="privacy-note">Seu pedido será analisado pelo responsável.{!admin && excluirConta && ' Para encerrar sua conta, use o botão Excluir cadastro e confirme a exclusão.'}</p><form onSubmit={solicitar} className="privacy-form"><label>Como podemos ajudar?<select value={tipo} onChange={event => setTipo(event.target.value as keyof typeof tipos)} disabled={ocupado}>{Object.entries(tipos).map(([valor, texto]) => <option value={valor} key={valor}>{texto}</option>)}</select></label><label>Descreva sua solicitação<textarea required minLength={10} maxLength={2000} rows={5} value={descricao} onChange={event => setDescricao(event.target.value)} disabled={ocupado} placeholder="Explique o que você deseja consultar ou alterar."/></label><small className="muted">De 10 a 2.000 caracteres. Evite incluir senhas ou dados desnecessários.</small><button className="primary-btn" disabled={ocupado || descricao.trim().length < 10}>{ocupado ? 'Enviando...' : 'Registrar solicitação'}</button></form></section><section className="panel"><div className="panel-head"><h2>Minhas solicitações</h2><span className="count-badge">{solicitacoes.length}</span></div>{carregando ? <p role="status">Carregando solicitações...</p> : !solicitacoes.length ? <p className="privacy-note">Você ainda não registrou solicitações.</p> : <div className="privacy-request-list">{solicitacoes.map(item => <Solicitacao key={item.id} item={item}/>)}</div>}</section></div>{admin && <section className="panel privacy-admin-queue"><div className="panel-head"><h2>Solicitações recebidas</h2><span className="count-badge">{fila.filter(item => item.status === 'pendente').length} pendentes</span></div><p className="privacy-note">Analise cada pedido e realize as providências necessárias antes de responder. Registrar uma resposta não corrige nem exclui dados automaticamente.</p>{carregando ? <p role="status">Carregando fila...</p> : !fila.length ? <p className="privacy-note">Nenhuma solicitação recebida.</p> : <div className="privacy-request-list">{fila.map(item => <RespostaSolicitacao key={item.id} item={item} atualizar={atualizada => { setFila(anteriores => anteriores.map(atual => atual.id === atualizada.id ? atualizada : atual)); setSolicitacoes(anteriores => anteriores.map(atual => atual.id === atualizada.id ? atualizada : atual)); }}/>)}</div>}</section>}{politicaAberta && <PoliticaModal fechar={() => setPoliticaAberta(false)}/>}</div>;
}

function Solicitacao({ item, children }: { item: SolicitacaoPrivacidade; children?: React.ReactNode }) {
  return <article className="privacy-request"><div className="privacy-request-heading"><strong>#{item.id} · {tipos[item.tipo]}</strong><span className={`status ${item.status === 'respondida' ? 'done' : 'pending'}`}>{item.status === 'respondida' ? 'Respondida' : 'Pendente'}</span></div>{item.nome && <p className="privacy-person">{item.nome} · {item.email}</p>}<time dateTime={item.criado_em}>{dataFormatada(item.criado_em, true)}</time><p className="privacy-description">{item.descricao}</p>{item.resposta && <div className="privacy-response"><strong>Resposta do responsável</strong><p>{item.resposta}</p>{item.respondido_em && <small>{dataFormatada(item.respondido_em, true)}</small>}</div>}{children}</article>;
}

function RespostaSolicitacao({ item, atualizar }: { item: SolicitacaoPrivacidade; atualizar: (item: SolicitacaoPrivacidade) => void }) {
  const [resposta, setResposta] = useState(''); const [ocupado, setOcupado] = useState(false); const [erro, setErro] = useState('');
  async function enviar(event: FormEvent) {
    event.preventDefault(); if (ocupado) return; const geracao = geracaoSessao(); setOcupado(true); setErro('');
    try { const resultado = await api<{ solicitacao: SolicitacaoPrivacidade }>(`/admin/privacidade/${item.id}/resposta`, 'POST', { resposta: resposta.trim() }); if (geracao === geracaoSessao()) { atualizar(resultado.solicitacao); setResposta(''); } }
    catch (error) { if (geracao === geracaoSessao()) setErro((error as Error).message); }
    finally { if (geracao === geracaoSessao()) setOcupado(false); }
  }
  return <Solicitacao item={item}>{item.status === 'pendente' && <form className="privacy-form" onSubmit={enviar}>{erro && <div className="notice notice--error" role="alert">{erro}</div>}<label>Resposta ao titular<textarea required minLength={10} maxLength={4000} rows={3} value={resposta} onChange={event => setResposta(event.target.value)} disabled={ocupado}/></label><button className="primary-btn" disabled={ocupado || resposta.trim().length < 10}>{ocupado ? 'Salvando...' : 'Registrar resposta'}</button></form>}</Solicitacao>;
}
