import { supabase } from './supabaseClient'
import { paraApp, paraBanco, MAPA_ENTREGA } from './banco'

export type Entrega = {
  id: string
  itemId: string
  quantidade: number
  data?: string | null
  notaFiscal?: string | null
  observacao?: string | null
  criadoEm: number
}

// Uma chamada só com `.in()` pra todos os itens vencedores da licitação, em
// vez de uma por item — mesmo motivo de listItemsByCodigos/listAtasByCodigos.
export async function listEntregasByItemIds(itemIds: string[]): Promise<Record<string, Entrega[]>> {
  if (itemIds.length === 0) return {}
  const { data, error } = await supabase.from('entregas').select('*').in('item_id', itemIds).order('data', { ascending: true })
  if (error) throw error
  const porItem: Record<string, Entrega[]> = {}
  for (const linha of data || []) {
    const e = paraApp(MAPA_ENTREGA, linha) as Entrega
    ;(porItem[e.itemId] ||= []).push(e)
  }
  return porItem
}

// A empresa da entrega vem do item (o banco preenche sozinho).
export async function addEntrega(itemId: string, entrega: { quantidade: number; data?: string; notaFiscal?: string; observacao?: string }): Promise<Entrega> {
  const { data, error } = await supabase.from('entregas')
    .insert(paraBanco(MAPA_ENTREGA, { itemId, ...entrega, criadoEm: Date.now() })).select().single()
  if (error) throw error
  return paraApp(MAPA_ENTREGA, data)
}

export async function removeEntrega(id: string): Promise<void> {
  const { error } = await supabase.from('entregas').delete().eq('id', id)
  if (error) throw error
}
