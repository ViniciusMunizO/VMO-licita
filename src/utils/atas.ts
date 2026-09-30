import { supabase } from './supabaseClient'
import { removerDoStorage } from './arquivo'

export async function listAtas(licitacaoCodigo: number | string): Promise<any[]> {
  const { data, error } = await supabase.from('atas').select('*').eq('licitacaoCodigo', licitacaoCodigo).order('criadoEm', { ascending: true })
  if (error) throw error
  return data || []
}

// Mesma consulta que `listAtas`, mas pra várias licitações de uma vez — ver
// `listItemsByCodigos` em utils/items.ts (mesmo motivo: evitar N+1).
export async function listAtasByCodigos(licitacaoCodigos: (number | string)[]): Promise<Record<string, any[]>> {
  if (licitacaoCodigos.length === 0) return {}
  const { data, error } = await supabase.from('atas').select('*').in('licitacaoCodigo', licitacaoCodigos).order('criadoEm', { ascending: true })
  if (error) throw error
  const porCodigo: Record<string, any[]> = {}
  for (const a of data || []) {
    const k = String(a.licitacaoCodigo)
    ;(porCodigo[k] ||= []).push(a)
  }
  return porCodigo
}

export async function addAta(licitacaoCodigo: number | string, ata: any): Promise<any[]> {
  const { id, ...rest } = ata // id vem do form só pra estado local — o banco gera o de verdade
  const { error } = await supabase.from('atas').insert({ licitacaoCodigo, ...rest })
  if (error) throw error
  return listAtas(licitacaoCodigo)
}

export async function removeAta(id: string, licitacaoCodigo: number | string): Promise<any[]> {
  const { data: row } = await supabase.from('atas').select('anexo').eq('id', id).maybeSingle()
  const { error } = await supabase.from('atas').delete().eq('id', id)
  if (error) throw error
  // Mesma ordem usada nos anexos de licitação: linha primeiro, arquivo depois.
  const path = row?.anexo?.path
  if (path) await removerDoStorage([path]).catch(() => { /* ata já saiu da lista */ })
  return listAtas(licitacaoCodigo)
}
