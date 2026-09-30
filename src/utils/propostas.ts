import { supabase } from './supabaseClient'

export type PropostaEmitida = {
  id: string
  snapshot: any
  emitidoEm: number
  emitidoPor?: string
}

// Retrato automático dos itens/valores/conta bancária no momento exato da
// emissão — a proposta em PDF é sempre gerada a partir do dado ATUAL, então
// sem isto não sobraria nenhum registro do que foi de fato enviado ao órgão
// se um item mudasse de valor depois.
export async function addPropostaEmitida(licitacaoCodigo: number, snapshot: any): Promise<void> {
  const { error } = await supabase.from('propostas_emitidas').insert({
    licitacaoCodigo,
    snapshot,
    emitidoEm: Date.now(),
  })
  if (error) throw error
}

export async function listPropostasEmitidas(licitacaoCodigo: number): Promise<PropostaEmitida[]> {
  const { data, error } = await supabase
    .from('propostas_emitidas')
    .select('id, snapshot, emitidoEm, profiles(name)')
    .eq('licitacaoCodigo', licitacaoCodigo)
    .order('emitidoEm', { ascending: false })
  if (error) throw error
  return (data || []).map((row: any) => ({
    id: row.id,
    snapshot: row.snapshot,
    emitidoEm: row.emitidoEm,
    emitidoPor: row.profiles?.name || undefined,
  }))
}
