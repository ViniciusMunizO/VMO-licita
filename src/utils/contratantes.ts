import { supabase } from './supabaseClient'
import { empresaAtual, paraApp, MAPA_ORGAO } from './banco'

// Contratantes são os órgãos da tabela `orgaos`, cada empresa com a sua lista.
export async function listContratantes(): Promise<any[]> {
  const { data, error } = await supabase.from('orgaos').select('*').eq('empresa_id', empresaAtual()).order('codigo')
  if (error) throw error
  return (data || []).map(l => paraApp(MAPA_ORGAO, l))
}

export async function addContratante(nome: string, uf: string): Promise<any[]> {
  const atual = await listContratantes()
  // Cadastro de contratante é uma ação rara (não é o fluxo de 15-20/dia),
  // então gerar o código sequencial em memória aqui é um risco aceitável —
  // diferente das licitações, cujo número o banco escolhe. Se dois cadastros
  // baterem no mesmo código, o banco recusa o segundo (código único por empresa).
  const max = atual.reduce((m, c) => Math.max(m, Number(c.codigo) || 0), 0)
  const novo = { empresa_id: empresaAtual(), codigo: String(max + 1).padStart(4, '0'), nome, uf: uf.toUpperCase() }
  const { error } = await supabase.from('orgaos').insert(novo)
  if (error) throw error
  return listContratantes()
}
