import { supabase } from './supabaseClient'
import { paraApp, idDoProcesso, nomesDaEmpresa, MAPA_PROPOSTA } from './banco'

export type PropostaEmitida = {
  id: string
  snapshot: any
  emitidoEm: number
  emitidoPor?: string
}

// Retrato automático dos itens/valores/conta bancária no momento exato da
// emissão — a proposta em PDF é sempre gerada a partir do dado ATUAL, então
// sem isto não sobraria nenhum registro do que foi de fato enviado ao órgão
// se um item mudasse de valor depois. Quem emitiu e quando o banco grava sozinho.
export async function addPropostaEmitida(licitacaoCodigo: number, snapshot: any): Promise<void> {
  const processoId = await idDoProcesso(licitacaoCodigo)
  const { error } = await supabase.from('propostas_emitidas').insert({ processo_id: processoId, retrato: snapshot })
  if (error) throw error
}

export async function listPropostasEmitidas(licitacaoCodigo: number): Promise<PropostaEmitida[]> {
  const processoId = await idDoProcesso(licitacaoCodigo)
  const { data, error } = await supabase
    .from('propostas_emitidas')
    .select('*')
    .eq('processo_id', processoId)
    .order('emitido_em', { ascending: false })
  if (error) throw error
  const nomes = await nomesDaEmpresa()
  return (data || []).map((row: any) => ({ ...paraApp(MAPA_PROPOSTA, row), emitidoPor: nomes[row.emitido_por] || undefined }))
}
