import { supabase } from './supabaseClient'

export type Profile = {
  id: string
  name: string
  role: 'admin' | 'moderador' | 'user'
}

// Se o profile ainda não existir por algum motivo (gatilho do banco não
// rodou a tempo), cai pra um perfil "user" com o e-mail como nome — nunca
// trava o login por causa disso.
export async function getProfile(userId: string, fallbackName: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error || !data) return { id: userId, name: fallbackName, role: 'user' }
  return { id: data.id, name: data.name, role: data.role }
}

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('name')
  if (error) throw error
  return data || []
}
