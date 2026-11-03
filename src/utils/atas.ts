import { supabase } from './supabaseClient'
import { removerDoStorage } from './arquivo'
import { paraApp, paraBanco, idDoProcesso, codigosPorId, nomesDaEmpresa, MAPA_ATA } from './banco'

async function paraTela(linhas: any[], codigoDe: (linha: any) => number | string): Promise<any[]> {
  const nomes = await nomesDaEmpresa()
  return linhas.map(l => ({ ...paraApp(MAPA_ATA, l), licitacaoCodigo: codigoDe(l), criadoPor: nomes[l.criado_por] }))
}

export async function listAtas(licitacaoCodigo: number | string): Promise<any[]> {
  const processoId = await idDoProcesso(licitacaoCodigo)
  const { data, error } = await supabase.from('atas').select('*').eq('processo_id', processoId).order('criado_em', { ascending: true })
  if (error) throw error
  return paraTela(data || [], () => licitacaoCodigo)
}

// Mesma consulta que `listAtas`, mas pra várias licitações de uma vez — ver
// `listItemsByCodigos` em utils/items.ts (mesmo motivo: evitar N+1).
export async function listAtasByCodigos(licitacaoCodigos: (number | string)[]): Promise<Record<string, any[]>> {
  if (licitacaoCodigos.length === 0) return {}
  const codigoDoProcesso = await codigosPorId(licitacaoCodigos)
  const ids = Object.keys(codigoDoProcesso)
  if (ids.length === 0) return {}
  const { data, error } = await supabase.from('atas').select('*').in('processo_id', ids).order('criado_em', { ascending: true })
  if (error) throw error
  const porCodigo: Record<string, any[]> = {}
  for (const a of await paraTela(data || [], l => codigoDoProcesso[l.processo_id])) {
    ;(porCodigo[String(a.licitacaoCodigo)] ||= []).push(a)
  }
  return porCodigo
}

export async function addAta(licitacaoCodigo: number | string, ata: any): Promise<any[]> {
  const { id, ...rest } = ata // id vem do form só pra estado local — o banco gera o de verdade
  const processoId = await idDoProcesso(licitacaoCodigo)
  const { error } = await supabase.from('atas').insert({ ...paraBanco(MAPA_ATA, rest), processo_id: processoId })
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
