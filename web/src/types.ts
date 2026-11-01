export type Usuario = { id: number; nome: string; email: string; papel: 'profissional' | 'admin'; bloqueado: boolean; politica_aceita: boolean; boas_vindas_vistas: boolean };
export type Assinatura = {
  status: 'teste' | 'ativa' | 'expirada' | 'gratuita';
  plano: 'mensal' | 'anual' | null;
  teste_expira_em: string;
  acesso_permanente: boolean;
  acesso_ate: string | null;
  dias_restantes: number | null;
  renovacao_status: 'sem_assinatura' | 'ativa' | 'cancelamento_solicitado' | 'cancelada';
  cancelamento_solicitado_em: string | null;
  cancelamento_confirmado_em: string | null;
};
export type Conta = { usuario: Usuario; assinatura: Assinatura; token?: string };
export type Plano = { id: 'mensal' | 'anual'; nome: string; valor_centavos: number; periodicidade: 'mes' | 'ano' };
export type Cobranca = {
  disponivel: boolean;
  pode_assinar: boolean;
  confirmacao_automatica: boolean;
  mensagem: string;
  planos: { id: string; disponivel: boolean }[];
};
export type Demanda = {
  id: number;
  numero_demanda: string;
  beneficiario: string;
  regional: string;
  assunto: string;
  data_vencimento: string;
  concluida: boolean;
};
export type NovaDemanda = Omit<Demanda, 'id'>;
export type Visao = 'dashboard' | 'demandas' | 'assinatura' | 'conta' | 'admin' | 'privacidade';
export type Politica = { versao: string; responsavel: string; contato: string; privacidade: { titulo: string; texto: string }[]; termos: { titulo: string; texto: string }[] };
export type SolicitacaoPrivacidade = { id: number; tipo: 'acesso' | 'correcao' | 'exclusao' | 'outro'; descricao: string; status: 'pendente' | 'respondida'; criado_em: string; resposta: string | null; respondido_em: string | null; nome?: string; email?: string };
export type PessoaAssinante = {
  id: number;
  nome: string;
  email: string;
  criado_em: string;
  bloqueado: boolean;
  assinatura: Assinatura;
};
export type AtivacaoAssinatura = {
  id: number;
  referencia: string;
  plano: 'mensal' | 'anual';
  valor_centavos: number;
  acesso_ate: string;
  ativado_em: string;
};
export type ResumoPessoas = { total: number; em_teste: number; ativas: number; gratuitas: number; expiradas: number; bloqueadas: number };
export const REGIONAIS = ['ABC', 'Campinas', 'Sorocaba', 'Baixada Santista', 'Americana', 'Nacional'];

export function diasAte(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number);
  const hoje = new Date();
  return Math.round((Date.UTC(ano, mes - 1, dia) - Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) / 86400000);
}

export function statusDemanda(demanda: Demanda) {
  if (demanda.concluida) return { label: 'Concluída', classe: 'done' };
  const dias = diasAte(demanda.data_vencimento);
  if (dias < 0) return { label: 'Atrasada', classe: 'late' };
  if (dias <= 3) return { label: dias === 0 ? 'Vence hoje' : 'Próxima de vencer', classe: 'pending' };
  return { label: 'Em andamento', classe: 'progress' };
}

export function dataFormatada(valor: string | null, hora = false) {
  if (!valor) return 'Sem prazo de expiração';
  const data = valor.length === 10 ? new Date(`${valor}T12:00:00`) : new Date(valor);
  return hora ? data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : data.toLocaleDateString('pt-BR');
}
