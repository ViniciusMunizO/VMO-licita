import { supabase } from './supabaseClient'
import { empresaAtual } from './banco'

// Códigos de convite (migração 0021 do banco do Radar).
// - Criar conta com código: o servidor do Radar cria a conta (já confirmada) e põe a pessoa
//   na empresa. O site não cria conta sozinho, então não depende de e-mail chegar.
// - Quem já tem login e está sem empresa usa o código direto no banco (usar_meu_convite).
// - O admin gera código para alguém da equipe (criar_convite_equipe).

/** "abcde fgh23" ou "ABCDEFGH23" -> "ABCDE-FGH23". Deixa como está se não tiver 10 letras/números. */
export function normalizarCodigo(texto: string): string {
  const limpo = (texto || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return limpo.length === 10 ? `${limpo.slice(0, 5)}-${limpo.slice(5)}` : limpo
}

export function codigoCompleto(texto: string): boolean {
  return /^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(normalizarCodigo(texto))
}

/** Link pronto para mandar: abre a página Criar conta com o código preenchido. */
export function linkDoConvite(codigo: string, origem = window.location.origin): string {
  return `${origem}${import.meta.env.BASE_URL}criar-conta?codigo=${encodeURIComponent(codigo)}`
}

export type Conferencia = { valido: false } | { valido: true; empresaNova: boolean; empresaNome: string | null }

function urlCadastro(): string {
  const base = import.meta.env.VITE_RADAR_API_URL
  if (!base) throw new Error('O cadastro por convite não está ligado neste ambiente.')
  return `${base.replace(/\/$/, '')}/api/site/cadastro`
}

async function chamarCadastro(corpo: object): Promise<any> {
  let r: Response
  try {
    r = await fetch(urlCadastro(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
    })
  } catch {
    throw new Error('Sem conexão com o servidor. Confira a internet e tente de novo.')
  }
  const resposta = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(resposta?.erro || 'Não foi possível criar a conta agora.')
  return resposta
}

/** Sem login: o que o código faz (criar empresa ou entrar em uma), sem gastar o convite. */
export async function conferirConvite(codigo: string): Promise<Conferencia> {
  return chamarCadastro({ acao: 'conferir', codigo: normalizarCodigo(codigo) })
}

export type NovaConta = { codigo: string; nome: string; email: string; senha: string; empresa?: string }

/** Sem login: cria a conta e entra na empresa. Depois disso é só fazer login com e-mail e senha. */
export async function criarContaComConvite(c: NovaConta): Promise<{ empresaNome: string | null }> {
  const r = await chamarCadastro({ acao: 'criar', ...c, codigo: normalizarCodigo(c.codigo) })
  return { empresaNome: r.empresaNome ?? null }
}

/** Com login: o que o código faz. */
export async function conferirConviteLogado(codigo: string): Promise<Conferencia> {
  const { data, error } = await supabase.rpc('conferir_convite', { p_codigo: normalizarCodigo(codigo) })
  if (error) throw error
  const c = (data || {}) as any
  return c.valido ? { valido: true, empresaNova: Boolean(c.empresa_nova), empresaNome: c.empresa_nome ?? null } : { valido: false }
}

const ERRO_CODIGO = 'Código de convite inválido, já usado ou vencido. Confira com quem te convidou.'

/** Com login: gasta o convite e entra na empresa (ou cria a empresa, se o convite for de empresa nova). */
export async function usarMeuConvite(codigo: string, nomeEmpresa?: string): Promise<{ empresaId: string; empresaNome: string }> {
  const { data, error } = await supabase.rpc('usar_meu_convite', {
    p_codigo: normalizarCodigo(codigo),
    p_nome_empresa: nomeEmpresa?.trim() || null,
  })
  if (error) {
    if (error.code === 'P0002') throw new Error(ERRO_CODIGO)
    if (error.code === '23514') throw new Error('A empresa já tem 4 pessoas ativas. Peça ao admin para liberar uma vaga.')
    throw new Error(error.message || 'Não foi possível usar o convite.')
  }
  const r = (data || {}) as any
  return { empresaId: r.empresa_id, empresaNome: r.empresa_nome }
}

/** Admin: código para alguém da equipe entrar na empresa aberta. Vale uma vez e por 7 dias. */
export async function gerarConviteEquipe(papel: 'admin' | 'membro' = 'membro'): Promise<string> {
  const { data, error } = await supabase.rpc('criar_convite_equipe', { p_empresa: empresaAtual(), p_papel: papel, p_dias: 7 })
  if (error) {
    if (error.code === '42501') throw new Error('Só o admin da empresa gera convites.')
    throw new Error(error.message || 'Não foi possível gerar o convite.')
  }
  return data as string
}
