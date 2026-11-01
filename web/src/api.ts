import type { Assinatura, Conta } from './types';

type SessaoPlugin = {
  obter(): Promise<{ token?: string }>;
  salvar(dados: { token: string }): Promise<unknown>;
  limpar(): Promise<unknown>;
};
type CapacitorRuntime = {
  isPluginAvailable?(nome: string): boolean;
  registerPlugin?(nome: string): SessaoPlugin;
  Plugins?: { Sessao?: SessaoPlugin };
};
declare global { interface Window { Capacitor?: CapacitorRuntime } }

const TOKEN_KEY = 'demandas-sessao-android';
export const android = Boolean(window.Capacitor) || location.protocol === 'capacitor:';
const BASE = android ? (import.meta.env.VITE_API_BASE_URL || 'https://sistema-demandas-production.up.railway.app').replace(/\/$/, '') : '';
let token: string | null = null;
let usuarioId: number | null = null;
let versao = 0;
let plugin: SessaoPlugin | null = null;

export function geracaoSessao() { return versao; }
export function redefinirSessao() { versao++; usuarioId = null; token = null; }

export async function iniciarCliente() {
  if (!android) return;
  if ('serviceWorker' in navigator) {
    const registros = await navigator.serviceWorker.getRegistrations().catch(() => []);
    await Promise.all(registros.map(registro => registro.unregister()));
  }
  const capacitor = window.Capacitor;
  if (capacitor?.isPluginAvailable?.('Sessao')) plugin = capacitor.registerPlugin?.('Sessao') || capacitor.Plugins?.Sessao || null;
  try { token = plugin ? (await plugin.obter()).token || null : sessionStorage.getItem(TOKEN_KEY); } catch { token = null; }
}

export async function definirConta(conta: Conta) {
  versao++;
  usuarioId = conta.usuario.id;
  if (android && conta.token) {
    token = conta.token;
    try { if (plugin) await plugin.salvar({ token }); else sessionStorage.setItem(TOKEN_KEY, token); } catch { /* A sessao permanece valida nesta abertura. */ }
  }
}

export async function limparSessaoLocal() {
  redefinirSessao();
  if (!android) return;
  try { sessionStorage.removeItem(TOKEN_KEY); await plugin?.limpar(); } catch { /* O token ja foi removido da memoria. */ }
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public codigo?: string, public assinatura?: Assinatura) { super(message); }
}

export async function api<T>(caminho: string, method = 'GET', dados?: unknown): Promise<T> {
  const geracao = versao;
  const headers: Record<string, string> = {};
  if (dados !== undefined) headers['Content-Type'] = 'application/json';
  if (android) headers['X-App-Client'] = 'android';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (usuarioId && !['/auth/login', '/auth/cadastro', '/auth/me'].includes(caminho)) headers['X-Usuario-Id'] = String(usuarioId);
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}${caminho}`, { method, headers, credentials: android ? 'omit' : 'same-origin', cache: 'no-store', ...(dados !== undefined ? { body: JSON.stringify(dados) } : {}) });
  } catch { throw new ApiError('Não foi possível conectar. Confira sua internet e tente novamente.', 0); }
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const erro = new ApiError(corpo.mensagem || 'Não foi possível concluir. Tente novamente.', resposta.status, corpo.codigo, corpo.assinatura);
    if (geracao === versao && !['/auth/login', '/auth/cadastro'].includes(caminho)) {
      if (resposta.status === 401) window.dispatchEvent(new CustomEvent('demandas:sem-sessao', { detail: erro.message }));
      if (resposta.status === 402 && corpo.assinatura) window.dispatchEvent(new CustomEvent('demandas:assinatura', { detail: corpo.assinatura }));
      if (resposta.status === 403 && corpo.codigo === 'ACESSO_BLOQUEADO') window.dispatchEvent(new CustomEvent('demandas:acesso-bloqueado', { detail: erro.message }));
    }
    throw erro;
  }
  return corpo as T;
}
