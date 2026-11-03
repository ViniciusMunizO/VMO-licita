import { supabase } from './supabaseClient'
import { empresaAtual, empresaGuardada, definirEmpresaAtual } from './banco'

// No banco multiempresa não existe mais `profiles`: quem é de qual empresa,
// com que papel e se está liberado fica em `membros` (uma linha por pessoa
// por empresa). O papel do banco é "admin" ou "membro"; nas telas, "membro"
// continua aparecendo como "user" pra não mexer em cada checagem de papel.
// "moderador" sobra no tipo só por compatibilidade: o banco não tem mais.
export type Profile = {
  id: string
  name: string
  role: 'admin' | 'moderador' | 'user'
  ativo: boolean
}

export type EmpresaDoUsuario = {
  id: string
  nome: string
  role: Profile['role']
  ativo: boolean
  nomeNaEmpresa: string
}

const papelNaTela = (papel: string): Profile['role'] => (papel === 'admin' ? 'admin' : 'user')

export async function minhasEmpresas(userId: string): Promise<EmpresaDoUsuario[]> {
  const { data, error } = await supabase
    .from('membros')
    .select('empresa_id, nome, papel, ativo, empresas(nome)')
    .eq('usuario_id', userId)
  if (error) throw error
  return (data || [])
    .map((m: any) => ({
      id: m.empresa_id,
      nome: m.empresas?.nome || 'Empresa',
      role: papelNaTela(m.papel),
      ativo: m.ativo,
      nomeNaEmpresa: m.nome,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

// Abre a empresa em que a pessoa estava da última vez (se ainda estiver
// liberada nela) ou a primeira liberada. Sem nenhuma liberada, cai num perfil
// desligado: nunca trava o login, mas também não libera acesso.
export async function getProfile(userId: string, fallbackName: string): Promise<{ profile: Profile; empresas: EmpresaDoUsuario[]; empresa: EmpresaDoUsuario | null }> {
  let empresas: EmpresaDoUsuario[] = []
  try { empresas = await minhasEmpresas(userId) } catch { /* sem lista, sem acesso */ }
  const liberadas = empresas.filter(e => e.ativo)
  const empresa = liberadas.find(e => e.id === empresaGuardada()) || liberadas[0] || null
  definirEmpresaAtual(empresa?.id || null)
  if (!empresa) {
    const pendente = empresas[0]
    return { profile: { id: userId, name: pendente?.nomeNaEmpresa || fallbackName, role: 'user', ativo: false }, empresas, empresa: null }
  }
  return { profile: { id: userId, name: empresa.nomeNaEmpresa, role: empresa.role, ativo: true }, empresas, empresa }
}

// Pessoas da empresa aberta.
export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('membros')
    .select('usuario_id, nome, papel, ativo')
    .eq('empresa_id', empresaAtual())
    .order('nome')
  if (error) throw error
  return (data || []).map((m: any) => ({ id: m.usuario_id, name: m.nome, role: papelNaTela(m.papel), ativo: m.ativo }))
}
