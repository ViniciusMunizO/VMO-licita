import { supabase } from './supabaseClient'

export async function listAtas(licitacaoCodigo: number | string): Promise<any[]> {
  const { data, error } = await supabase.from('atas').select('*').eq('licitacaoCodigo', licitacaoCodigo)
  if (error) throw error
  return data || []
}

export async function addAta(licitacaoCodigo: number | string, ata: any): Promise<any[]> {
  const { id, ...rest } = ata // id vem do form só pra estado local — o banco gera o de verdade
  const { error } = await supabase.from('atas').insert({ licitacaoCodigo, ...rest })
  if (error) throw error
  return listAtas(licitacaoCodigo)
}

export async function removeAta(id: string, licitacaoCodigo: number | string): Promise<any[]> {
  const { error } = await supabase.from('atas').delete().eq('id', id)
  if (error) throw error
  return listAtas(licitacaoCodigo)
}
