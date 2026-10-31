export type Usuario = { id: number; nome: string; email: string };
export type Assinatura = {
  status: 'teste' | 'ativa' | 'expirada';
  plano: 'mensal' | 'anual' | null;
  teste_expira_em: string;
  acesso_ate: string;
  dias_restantes: number;
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
export type Visao = 'dashboard' | 'demandas' | 'assinatura' | 'conta';
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

export function dataFormatada(valor: string, hora = false) {
  const data = valor.length === 10 ? new Date(`${valor}T12:00:00`) : new Date(valor);
  return hora ? data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : data.toLocaleDateString('pt-BR');
}
