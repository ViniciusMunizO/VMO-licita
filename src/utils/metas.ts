import { supabase } from './supabaseClient'

export type Meta = {
  periodo: string
  valorAlvoGanho: number | null
  taxaAlvoSucesso: number | null
}

export async function getMeta(periodo: string): Promise<Meta | null> {
  const { data, error } = await supabase
    .from('metas')
    .select('periodo, valorAlvoGanho, taxaAlvoSucesso')
    .eq('periodo', periodo)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function saveMeta(periodo: string, valorAlvoGanho: number | null, taxaAlvoSucesso: number | null): Promise<Meta> {
  const { data, error } = await supabase
    .from('metas')
    .upsert({ periodo, valorAlvoGanho, taxaAlvoSucesso, atualizadoEm: Date.now() }, { onConflict: 'periodo' })
    .select('periodo, valorAlvoGanho, taxaAlvoSucesso')
    .single()
  if (error) throw error
  return data
}
