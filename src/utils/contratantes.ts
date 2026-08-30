import { supabase } from './supabaseClient'

export async function listContratantes(): Promise<any[]> {
  const { data, error } = await supabase.from('contratantes').select('*').order('codigo')
  if (error) throw error
  return data || []
}

export async function addContratante(nome: string, uf: string): Promise<any[]> {
  const atual = await listContratantes()
  // Cadastro de contratante é uma ação rara (não é o fluxo de 15-20/dia),
  // então gerar o código sequencial em memória aqui é um risco aceitável —
  // diferente de licitações/itens, que usam identity do Postgres pra isso.
  const max = atual.reduce((m, c) => Math.max(m, Number(c.codigo) || 0), 0)
  const novo = { codigo: String(max + 1).padStart(4, '0'), nome, uf: uf.toUpperCase() }
  const { error } = await supabase.from('contratantes').insert(novo)
  if (error) throw error
  return listContratantes()
}
