import { supabase } from './supabaseClient'
import { empresaAtual } from './banco'

// Alertas do sino: os mesmos avisos e lembretes que o Radar manda no Telegram.
// Quem grava é o robô do Radar; o site só lê e marca como lido (migração 0014).

export type Alerta = {
  id: string
  tipo: 'licitacao_nova' | 'lembrete'
  numeroControlePncp: string | null
  titulo: string
  texto: string | null
  criadoEm: string
  lido: boolean
}

export async function listarAlertas(limite = 30): Promise<Alerta[]> {
  const { data, error } = await supabase.from('alertas')
    .select('id, tipo, numero_controle_pncp, titulo, texto, criado_em, lido_em')
    .eq('empresa_id', empresaAtual()).order('criado_em', { ascending: false }).limit(limite)
  if (error) throw error
  return (data || []).map((a: any) => ({
    id: a.id,
    tipo: a.tipo,
    numeroControlePncp: a.numero_controle_pncp,
    titulo: a.titulo,
    texto: a.texto,
    criadoEm: a.criado_em,
    lido: a.lido_em !== null,
  }))
}

export async function contarNaoLidos(): Promise<number> {
  const { count, error } = await supabase.from('alertas').select('id', { count: 'exact', head: true })
    .eq('empresa_id', empresaAtual()).is('lido_em', null)
  if (error) throw error
  return count || 0
}

export async function marcarLidos(ids: string[]): Promise<void> {
  if (!ids.length) return
  const { error } = await supabase.from('alertas').update({ lido_em: new Date().toISOString() })
    .eq('empresa_id', empresaAtual()).in('id', ids).is('lido_em', null)
  if (error) throw error
}
