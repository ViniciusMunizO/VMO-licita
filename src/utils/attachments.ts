import { supabase } from './supabaseClient'

export async function listAttachments(licitacaoCodigo: number | string): Promise<any[]> {
  const { data, error } = await supabase.from('attachments').select('*').eq('licitacaoCodigo', licitacaoCodigo).order('date', { ascending: true })
  if (error) throw error
  return data || []
}

export async function addAttachment(licitacaoCodigo: number | string, att: { name: string; filename: string; data: string }): Promise<any[]> {
  const { error } = await supabase.from('attachments').insert({ licitacaoCodigo, ...att })
  if (error) throw error
  return listAttachments(licitacaoCodigo)
}

export async function removeAttachment(id: string, licitacaoCodigo: number | string): Promise<any[]> {
  const { error } = await supabase.from('attachments').delete().eq('id', id)
  if (error) throw error
  return listAttachments(licitacaoCodigo)
}
