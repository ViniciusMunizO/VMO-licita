import { supabase } from './supabaseClient'

export async function listLicitacoes(): Promise<any[]> {
  const { data, error } = await supabase.from('licitacoes').select('*').order('codigo', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getLicitacao(codigo: number | string): Promise<any | null> {
  const { data, error } = await supabase.from('licitacoes').select('*').eq('codigo', codigo).maybeSingle()
  if (error) throw error
  return data
}

// Prévia do próximo código, só pra mostrar no formulário antes de salvar —
// quem realmente define o código final é a coluna `identity` do banco, que
// nunca colide mesmo com dois cadastros simultâneos (diferente da versão
// antiga calculada só em memória no navegador).
export async function previewNextCodigo(): Promise<number> {
  const list = await listLicitacoes()
  const max = list.reduce((m, l) => Math.max(m, Number(l.codigo) || 0), 0)
  return max + 1
}

export async function createLicitacao(dados: any): Promise<any> {
  const { codigo, ...rest } = dados
  const { data, error } = await supabase.from('licitacoes').insert(rest).select().single()
  if (error) throw error
  return data
}

export async function updateLicitacao(codigo: number | string, patch: any): Promise<any> {
  const { codigo: _ignore, ...rest } = patch
  const { data, error } = await supabase.from('licitacoes').update(rest).eq('codigo', codigo).select().single()
  if (error) throw error
  return data
}
