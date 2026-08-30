import { supabase } from './supabaseClient'

export async function getEmpresaInfo(): Promise<any | null> {
  const { data, error } = await supabase.from('empresa_info').select('*').eq('id', true).maybeSingle()
  if (error) throw error
  return data
}

export async function saveEmpresaInfo(form: any): Promise<any> {
  const { data, error } = await supabase.from('empresa_info').upsert({ id: true, ...form }).select().single()
  if (error) throw error
  return data
}
