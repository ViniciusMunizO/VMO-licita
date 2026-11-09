import { supabase } from './supabaseClient'
import { empresaAtual } from './banco'
import type { ConferenciaPalavra } from './palavras-radar'
import { portalDaDisputa } from './portal'

// O Radar de Licitações dentro do site (migração 0014 do banco do Radar).
// Tudo passa por funções do banco que conferem se a pessoa é da empresa:
// o site nunca lê as tabelas do bot direto.

export type LicitacaoRadar = {
  numeroControlePncp: string
  orgao: string | null
  municipio: string | null
  uf: string | null
  modalidade: string | null
  objeto: string | null
  valorEstimado: number | null
  encerramento: string | null
  link: string | null
  /** Onde é a disputa (BLL, BNC, Compras.gov.br...); null quando o PNCP não diz (aí, ver no edital). */
  portal: string | null
  acompanhada: boolean
}

export type FiltrosRadar = {
  palavrasChave: string[]
  ufs: string[]
  valorMinimo: number
  telegramConectado: boolean
}

export type BuscaRadar = { uf?: string; ateDias?: number; pagina?: number }

export const POR_PAGINA = 10

export async function buscarRadar(busca: BuscaRadar = {}): Promise<{ lista: LicitacaoRadar[]; total: number }> {
  const ate = busca.ateDias ? new Date(Date.now() + busca.ateDias * 86_400_000).toISOString() : null
  const { data, error } = await supabase.rpc('radar_licitacoes', {
    p_empresa: empresaAtual(),
    p_ufs: busca.uf ? [busca.uf] : null,
    p_ate: ate,
    p_limite: POR_PAGINA,
    p_deslocamento: (busca.pagina || 0) * POR_PAGINA,
  })
  if (error) throw error
  const linhas = (data || []) as { licitacao: any; total: number; acompanhada: boolean }[]
  return {
    total: Number(linhas[0]?.total || 0),
    lista: linhas.map(({ licitacao, acompanhada }) => paraLicitacao(licitacao, acompanhada)),
  }
}

function paraLicitacao(l: any, acompanhada: boolean): LicitacaoRadar {
  return {
    // publicado_por vem da busca (migração 0019 do Radar); a linha inteira da tabela traz dados.usuarioNome.
    portal: portalDaDisputa(l.link, l.publicado_por ?? l.dados?.usuarioNome),
    numeroControlePncp: l.numero_controle_pncp,
    orgao: l.orgao,
    municipio: l.municipio,
    uf: l.uf,
    modalidade: l.modalidade,
    objeto: l.objeto,
    valorEstimado: l.valor_estimado,
    encerramento: l.encerramento_propostas,
    link: l.link,
    acompanhada,
  }
}

export type BuscaConversa = {
  ufs: string[] | null
  municipio: string | null
  ate: Date | null
  publicadasDesde: Date | null
  deslocamento: number
  limite: number
  /** Qualquer ramo: ignora as palavras da empresa ("tudo de Maringá"). Migração 0019 do Radar. */
  todas?: boolean
}

/** A busca da conversa: lugar e período livres, do mesmo jeito que o /licitacoes do bot. */
export async function buscarRadarConversa(b: BuscaConversa): Promise<{ lista: LicitacaoRadar[]; total: number }> {
  const { data, error } = await supabase.rpc('radar_licitacoes', {
    p_empresa: empresaAtual(),
    p_ufs: b.ufs,
    p_municipio: b.municipio,
    p_ate: b.ate?.toISOString() ?? null,
    p_publicadas_desde: b.publicadasDesde?.toISOString() ?? null,
    p_limite: b.limite,
    p_deslocamento: b.deslocamento,
    // Só vai quando pedido: a busca normal continua funcionando num banco ainda sem a 0019.
    ...(b.todas ? { p_todas: true } : {}),
  })
  if (error) throw error
  const linhas = (data || []) as { licitacao: any; total: number; acompanhada: boolean }[]
  return {
    total: Number(linhas[0]?.total || 0),
    lista: linhas.filter(x => x?.licitacao).map(({ licitacao, acompanhada }) => paraLicitacao(licitacao, acompanhada)),
  }
}

export type Acompanhada = LicitacaoRadar & {
  acompanhadaEm: string
  processoId: string | null
  rascunho: boolean
  codigo: number | null
}

/** Todas as que a empresa acompanha (pelo site ou pelo bot), abertas primeiro. Migração 0016. */
export async function listarAcompanhadas(): Promise<Acompanhada[]> {
  const { data, error } = await supabase.rpc('acompanhadas_radar', { p_empresa: empresaAtual() })
  if (error) {
    if (error.code === 'PGRST202' || /could not find the function/i.test(error.message || '')) {
      throw new Error('A página Acompanhando ainda não está ativa no banco: falta rodar a migração 0016_acompanhando_no_site.sql.')
    }
    throw error
  }
  return ((data || []) as any[]).map(r => ({
    ...paraLicitacao(r.licitacao, true),
    acompanhadaEm: r.acompanhada_em,
    processoId: r.processo_id,
    rascunho: Boolean(r.rascunho),
    codigo: r.codigo ?? null,
  }))
}

/** Marca para acompanhar (lembretes) e cria o rascunho do processo. Devolve o id do rascunho. */
export async function acompanhar(numeroControlePncp: string): Promise<string> {
  const { data, error } = await supabase.rpc('acompanhar_licitacao', {
    p_empresa: empresaAtual(), p_numero: numeroControlePncp,
  })
  if (error) throw error
  return data as string
}

/** Para de acompanhar e apaga o rascunho (processo já confirmado não é apagado). */
export async function deixarDeAcompanhar(numeroControlePncp: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('deixar_de_acompanhar', {
    p_empresa: empresaAtual(), p_numero: numeroControlePncp,
  })
  if (error) throw error
  return Boolean(data)
}

export async function lerFiltrosRadar(): Promise<FiltrosRadar> {
  const { data, error } = await supabase.rpc('filtros_radar', { p_empresa: empresaAtual() })
  if (error) throw error
  const f = (data || {}) as any
  return {
    palavrasChave: f.palavras_chave || [],
    ufs: f.ufs || [],
    valorMinimo: Number(f.valor_minimo || 0),
    telegramConectado: Boolean(f.telegram_conectado),
  }
}

/** Só o admin da empresa (o banco recusa os outros). */
export async function salvarFiltrosRadar(f: Pick<FiltrosRadar, 'palavrasChave' | 'ufs' | 'valorMinimo'>): Promise<void> {
  const { error } = await supabase.rpc('salvar_filtros_radar', {
    p_empresa: empresaAtual(), p_palavras: f.palavrasChave, p_ufs: f.ufs, p_valor_minimo: f.valorMinimo,
  })
  if (error) throw error
}

/**
 * Quantas licitações abertas cada palavra acha agora e, se achar pouca, a palavra parecida que aparece
 * nas licitações (migração 0017). Sem estados: usa os salvos. Devolve null se o banco ainda não tem a
 * migração: a tela só não mostra a conferência.
 */
export async function conferirPalavras(palavras: string[], ufs: string[] | null): Promise<ConferenciaPalavra[] | null> {
  if (!palavras.length) return []
  const { data, error } = await supabase.rpc('conferir_palavras_radar', {
    p_empresa: empresaAtual(), p_palavras: palavras.slice(0, 40), p_ufs: ufs?.length ? ufs : null,
  })
  if (error) {
    if (error.code === 'PGRST202' || /could not find the function/i.test(error.message || '')) return null
    throw error
  }
  return ((data || []) as any[]).map(r => ({
    palavra: r.palavra,
    abertas: Number(r.abertas || 0),
    sugestao: r.sugestao ?? null,
    abertasSugestao: r.abertas_sugestao == null ? null : Number(r.abertas_sugestao),
  }))
}

/** Código de 8 letras/números para mandar no Telegram: /vincular CODIGO. Vale 15 minutos. */
export async function gerarCodigoTelegram(): Promise<string> {
  const { data, error } = await supabase.rpc('gerar_codigo_telegram', { p_empresa: empresaAtual() })
  if (error) throw error
  return data as string
}

export async function desconectarTelegram(): Promise<void> {
  const { error } = await supabase.rpc('desconectar_telegram', { p_empresa: empresaAtual() })
  if (error) throw error
}

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

export function linkPncp(numeroControlePncp: string): string | null {
  // "CNPJ-1-SEQUENCIAL/ANO" -> página da compra no PNCP (mesma regra do bot).
  const m = numeroControlePncp.match(/^(\d+)-\d+-(\d+)\/(\d{4})$/)
  return m ? `https://pncp.gov.br/app/editais/${m[1]}/${m[3]}/${Number(m[2])}` : null
}

// Notificações da empresa (migração 0020): SE e ONDE as licitações novas e os lembretes chegam.
// Os filtros (acima) dizem QUAIS licitações interessam; aqui é só ligar, pausar e escolher o canal.
// O mesmo ajuste existe no bot: /notificacoes.
export type NotificacoesRadar = {
  avisosLigados: boolean
  lembretesLigados: boolean
  /** false = chegam só no sino do site, sem mensagem no Telegram. */
  avisosNoTelegram: boolean
  telegramConectado: boolean
}

/** null = o banco ainda não tem a migração 0020: a tela explica em vez de quebrar. */
export async function lerNotificacoes(): Promise<NotificacoesRadar | null> {
  const { data, error } = await supabase.rpc('notificacoes_radar', { p_empresa: empresaAtual() })
  if (error) {
    if (error.code === 'PGRST202' || /could not find the function/i.test(error.message || '')) return null
    throw error
  }
  const n = (data || {}) as any
  return {
    avisosLigados: n.avisos_ligados !== false,
    lembretesLigados: n.lembretes_ligados !== false,
    avisosNoTelegram: n.avisos_no_telegram !== false,
    telegramConectado: Boolean(n.telegram_conectado),
  }
}

/** Muda só o que vier preenchido. Só o admin da empresa (o banco recusa os outros com 42501). */
export async function salvarNotificacoes(
  mudanca: Partial<Pick<NotificacoesRadar, 'avisosLigados' | 'lembretesLigados' | 'avisosNoTelegram'>>,
): Promise<void> {
  const { error } = await supabase.rpc('salvar_notificacoes_radar', {
    p_empresa: empresaAtual(),
    p_avisos: mudanca.avisosLigados ?? null,
    p_lembretes: mudanca.lembretesLigados ?? null,
    p_no_telegram: mudanca.avisosNoTelegram ?? null,
  })
  if (error) throw error
}
