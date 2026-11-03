import { supabase } from './supabaseClient'
import { empresaAtual, paraApp, paraBanco, MAPA_META } from './banco'

export type Meta = {
  periodo: string
  valorAlvoGanho: number | null
  taxaAlvoSucesso: number | null
}

const COLUNAS = 'periodo, valor_alvo_ganho, taxa_alvo_sucesso'

export async function getMeta(periodo: string): Promise<Meta | null> {
  const { data, error } = await supabase
    .from('metas')
    .select(COLUNAS)
    .eq('empresa_id', empresaAtual())
    .eq('periodo', periodo)
    .maybeSingle()
  if (error) throw error
  return data ? paraApp(MAPA_META, data) : null
}

export async function saveMeta(periodo: string, valorAlvoGanho: number | null, taxaAlvoSucesso: number | null): Promise<Meta> {
  const { data, error } = await supabase
    .from('metas')
    .upsert(
      { ...paraBanco(MAPA_META, { periodo, valorAlvoGanho, taxaAlvoSucesso, atualizadoEm: Date.now() }), empresa_id: empresaAtual() },
      { onConflict: 'empresa_id,periodo' },
    )
    .select(COLUNAS)
    .single()
  if (error) throw error
  return paraApp(MAPA_META, data)
}
