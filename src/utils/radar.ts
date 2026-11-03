import { supabase } from './supabaseClient'
import { empresaAtual } from './banco'

// O Radar de Licitações dentro do site (migração 0014 do banco do Radar).
// Tudo passa por funções do banco que conferem se a pessoa é da empresa:
// o site nunca lê as tabelas do bot direto.

export type LicitacaoRadar = {
  numeroControlePncp: string
  orgao: string | null
  municipio: string | null
  uf: string | null
  modalidade: string | null
  objeto: string | null
  valorEstimado: number | null
  encerramento: string | null
  link: string | null
  acompanhada: boolean
}

export type FiltrosRadar = {
  palavrasChave: string[]
  ufs: string[]
  valorMinimo: number
  telegramConectado: boolean
}

export type BuscaRadar = { uf?: string; ateDias?: number; pagina?: number }

export const POR_PAGINA = 10

export async function buscarRadar(busca: BuscaRadar = {}): Promise<{ lista: LicitacaoRadar[]; total: number }> {
  const ate = busca.ateDias ? new Date(Date.now() + busca.ateDias * 86_400_000).toISOString() : null
  const { data, error } = await supabase.rpc('radar_licitacoes', {
    p_empresa: empresaAtual(),
    p_ufs: busca.uf ? [busca.uf] : null,
    p_ate: ate,
    p_limite: POR_PAGINA,
    p_deslocamento: (busca.pagina || 0) * POR_PAGINA,
  })
  if (error) throw error
  const linhas = (data || []) as { licitacao: any; total: number; acompanhada: boolean }[]
  return {
    total: Number(linhas[0]?.total || 0),
    lista: linhas.map(({ licitacao: l, acompanhada }) => ({
      numeroControlePncp: l.numero_controle_pncp,
      orgao: l.orgao,
      municipio: l.municipio,
      uf: l.uf,
      modalidade: l.modalidade,
      objeto: l.objeto,
      valorEstimado: l.valor_estimado,
      encerramento: l.encerramento_propostas,
      link: l.link,
      acompanhada,
    })),
  }
}

/** Marca para acompanhar (lembretes) e cria o rascunho do processo. Devolve o id do rascunho. */
export async function acompanhar(numeroControlePncp: string): Promise<string> {
  const { data, error } = await supabase.rpc('acompanhar_licitacao', {
    p_empresa: empresaAtual(), p_numero: numeroControlePncp,
  })
  if (error) throw error
  return data as string
}

/** Para de acompanhar e apaga o rascunho (processo já confirmado não é apagado). */
export async function deixarDeAcompanhar(numeroControlePncp: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('deixar_de_acompanhar', {
    p_empresa: empresaAtual(), p_numero: numeroControlePncp,
  })
  if (error) throw error
  return Boolean(data)
}

export async function lerFiltrosRadar(): Promise<FiltrosRadar> {
  const { data, error } = await supabase.rpc('filtros_radar', { p_empresa: empresaAtual() })
  if (error) throw error
  const f = (data || {}) as any
  return {
    palavrasChave: f.palavras_chave || [],
    ufs: f.ufs || [],
    valorMinimo: Number(f.valor_minimo || 0),
    telegramConectado: Boolean(f.telegram_conectado),
  }
}

/** Só o admin da empresa (o banco recusa os outros). */
export async function salvarFiltrosRadar(f: Pick<FiltrosRadar, 'palavrasChave' | 'ufs' | 'valorMinimo'>): Promise<void> {
  const { error } = await supabase.rpc('salvar_filtros_radar', {
    p_empresa: empresaAtual(), p_palavras: f.palavrasChave, p_ufs: f.ufs, p_valor_minimo: f.valorMinimo,
  })
  if (error) throw error
}

/** Código de 8 letras/números para mandar no Telegram: /vincular CODIGO. Vale 15 minutos. */
export async function gerarCodigoTelegram(): Promise<string> {
  const { data, error } = await supabase.rpc('gerar_codigo_telegram', { p_empresa: empresaAtual() })
  if (error) throw error
  return data as string
}

export async function desconectarTelegram(): Promise<void> {
  const { error } = await supabase.rpc('desconectar_telegram', { p_empresa: empresaAtual() })
  if (error) throw error
}

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

export function linkPncp(numeroControlePncp: string): string | null {
  // "CNPJ-1-SEQUENCIAL/ANO" -> página da compra no PNCP (mesma regra do bot).
  const m = numeroControlePncp.match(/^(\d+)-\d+-(\d+)\/(\d{4})$/)
  return m ? `https://pncp.gov.br/app/editais/${m[1]}/${m[3]}/${Number(m[2])}` : null
}
