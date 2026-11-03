import { supabase } from './supabaseClient'
import { empresaAtual, paraApp, paraBanco, MAPA_EMPRESA } from './banco'

// Dados cadastrais e configurações da empresa aberta (tabela `empresa_dados`,
// uma linha por empresa). Membro lê, só admin grava (regra do banco).
export async function getEmpresaInfo(): Promise<any | null> {
  const { data, error } = await supabase.from('empresa_dados').select('*').eq('empresa_id', empresaAtual()).maybeSingle()
  if (error) throw error
  return data ? paraApp(MAPA_EMPRESA, data) : null
}

export async function saveEmpresaInfo(form: any): Promise<any> {
  const { data, error } = await supabase.from('empresa_dados')
    .upsert({ ...paraBanco(MAPA_EMPRESA, form), empresa_id: empresaAtual() }, { onConflict: 'empresa_id' })
    .select().single()
  if (error) throw error
  return paraApp(MAPA_EMPRESA, data)
}
