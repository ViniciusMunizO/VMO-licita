// O "cérebro" da conversa do Radar: entende o que a pessoa escreve, do mesmo jeito que o bot
// do Telegram entende (src/bot/periodo.ts, cadastro.ts e comandos.ts no repositório do Radar).
// Aqui não tem tela nem banco: só regras, para dar para testar tudo com o vitest.

export const POR_PAGINA = 5
export const MAX_DIAS_A_FRENTE = 366

export const UFS_LISTA = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')
const UFS_VALIDAS = new Set(UFS_LISTA)

export const REGIOES: { id: string; nome: string; ufs: string[] }[] = [
  { id: 'sul', nome: 'Sul', ufs: ['PR', 'SC', 'RS'] },
  { id: 'sudeste', nome: 'Sudeste', ufs: ['SP', 'RJ', 'MG', 'ES'] },
  { id: 'centrooeste', nome: 'Centro-Oeste', ufs: ['GO', 'MT', 'MS', 'DF'] },
  { id: 'nordeste', nome: 'Nordeste', ufs: ['MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA'] },
  { id: 'norte', nome: 'Norte', ufs: ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'] },
]

// Nomes por extenso (sem acento). "Pará" fica de fora: "para" é uma palavra comum.
const NOMES_DOS_ESTADOS: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF',
  'espirito santo': 'ES', goias: 'GO', maranhao: 'MA', 'mato grosso do sul': 'MS', 'mato grosso': 'MT',
  'minas gerais': 'MG', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR', 'santa catarina': 'SC',
  'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
}
const REGEX_NOMES = new RegExp(
  `\\b(${Object.keys(NOMES_DOS_ESTADOS).sort((a, b) => b.length - a.length).join('|')})\\b`,
  'gi',
)
const PALAVRAS_TODOS = new Set(['todos', 'todas', 'brasil', 'pais', 'nacional'])
// Palavras que não mudam o sentido ("licitações no PR", "quero ver em SC e SP").
const PALAVRAS_DE_LIGACAO = new Set([
  'e', 'ou', 'de', 'do', 'da', 'dos', 'das', 'o', 'a', 'os', 'as', 'em', 'no', 'na', 'estado', 'estados',
  'regiao', 'regioes', 'todo', 'toda', 'inteiro', 'tambem', 'mais', 'apenas', 'so', 'somente',
  'licitacao', 'licitacoes', 'ver', 'quero', 'mostrar', 'mostra', 'buscar', 'busca', 'procurar', 'pra', 'para',
])

/** Sem acento e em minúsculas. */
export function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// ---------------------------------------------------------------------------
// Datas (sempre no calendário de Brasília, que não tem horário de verão desde 2019)
// ---------------------------------------------------------------------------

const OFFSET_BRASILIA = '-03:00'
export const hojeEmBrasilia = (agora: Date) => new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)

function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const fimDoDia = (dia: string) => new Date(`${dia}T23:59:59.999${OFFSET_BRASILIA}`)
const inicioDoDia = (dia: string) => new Date(`${dia}T00:00:00.000${OFFSET_BRASILIA}`)
const dataCurta = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`
const dataLonga = (dia: string) => `${dataCurta(dia)}/${dia.slice(0, 4)}`

function diaValido(ano: number, mes: number, dia: number): string | null {
  if (ano < 2000 || ano > 2100 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null // 31/02
  return d.toISOString().slice(0, 10)
}

export type Periodo = { chave: string; titulo: string; ate: Date | null; publicadasDesde: Date | null }

/** "7", "15", "30", "hoje" ou "d20261120" -> o período. "passou" = data que já ficou para trás. */
export function resolverPeriodo(chave: string, agora: Date = new Date()): Periodo | 'passou' | null {
  const hoje = hojeEmBrasilia(agora)
  if (chave === 'hoje') {
    return { chave, titulo: `Publicadas hoje (${dataCurta(hoje)})`, ate: null, publicadasDesde: inicioDoDia(hoje) }
  }
  if (chave === '7' || chave === '15' || chave === '30') {
    const dia = somarDias(hoje, Number(chave))
    return { chave, titulo: `Encerram até ${dataCurta(dia)} (${chave} dias)`, ate: fimDoDia(dia), publicadasDesde: null }
  }
  const m = chave.match(/^d(\d{4})(\d{2})(\d{2})$/)
  if (!m) return null
  const dia = diaValido(Number(m[1]), Number(m[2]), Number(m[3]))
  if (!dia) return null
  if (dia < hoje) return 'passou'
  const titulo = dia.slice(0, 4) === hoje.slice(0, 4) ? dataCurta(dia) : dataLonga(dia)
  return { chave, titulo: `Encerram até ${titulo}`, ate: fimDoDia(dia), publicadasDesde: null }
}

export const DICA_DATA = 'Escreva o dia e o mês, como "até 20/11", ou com o ano, como "20/11/2026".'
export const DICA_CIDADE = 'Escreva o nome e o estado, por exemplo: Maringá PR'

/**
 * Entende uma data digitada ("até 20/11", "20/11/2026", "20/11/26", "dia 20/11").
 * null = não parece data; {erro} = parece mas não vale; {chave} = certa.
 */
export function interpretarData(texto: string, agora: Date = new Date()): { chave: string } | { erro: string } | null {
  const t = semAcento(texto.trim())
  if (!/^(ate\s+)?((o\s+)?dia\s+)?\d{1,2}\s*\/\s*\d{1,2}/.test(t) && !/^ate\s+((o\s+)?dia\s+)?\d/.test(t)) return null

  const citado = texto.trim().slice(0, 20)
  const m = t.match(/^(?:ate\s+)?(?:(?:o\s+)?dia\s+)?(\d{1,2})\s*[/-]\s*(\d{1,2})(?:\s*[/-]\s*(\d{4}|\d{2}))?$/)
  if (!m) return { erro: `Não entendi a data "${citado}". ${DICA_DATA}` }

  const hoje = hojeEmBrasilia(agora)
  const ano = m[3] === undefined ? Number(hoje.slice(0, 4)) : m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  const dia = diaValido(ano, Number(m[2]), Number(m[1]))
  if (!dia) return { erro: `"${citado}" não é uma data que existe. ${DICA_DATA}` }
  if (dia < hoje) {
    const dica = m[3] === undefined ? ' Se for do ano que vem, inclua o ano, como 15/01/2027.' : ''
    return { erro: `A data ${dataLonga(dia)} já passou (hoje é ${dataLonga(hoje)}). Escreva uma data a partir de hoje.${dica}` }
  }
  const limite = somarDias(hoje, MAX_DIAS_A_FRENTE)
  if (dia > limite) return { erro: `Essa data fica longe demais. Escreva uma data até ${dataLonga(limite)}.` }
  return { chave: `d${dia.replace(/-/g, '')}` }
}

// ---------------------------------------------------------------------------
// Onde
// ---------------------------------------------------------------------------

export type Onde =
  | { tipo: 'meus' }
  | { tipo: 'uf'; uf: string }
  | { tipo: 'regiao'; id: string }
  | { tipo: 'ufs'; ufs: string[] }
  | { tipo: 'cidade'; nome: string; uf: string }

export type Filtro = { ufs: string[] | null; municipio: string | null; titulo: string }

export function filtroDoOnde(o: Onde, ufsDaEmpresa: string[]): Filtro {
  if (o.tipo === 'uf') return { ufs: [o.uf], municipio: null, titulo: o.uf }
  if (o.tipo === 'ufs') return { ufs: o.ufs, municipio: null, titulo: o.ufs.length === UFS_LISTA.length ? 'Todos os estados' : o.ufs.join(', ') }
  if (o.tipo === 'regiao') {
    const r = REGIOES.find(x => x.id === o.id)!
    return { ufs: r.ufs, municipio: null, titulo: `Região ${r.nome}` }
  }
  if (o.tipo === 'cidade') return { ufs: [o.uf], municipio: o.nome, titulo: `${o.nome} (${o.uf})` }
  return { ufs: null, municipio: null, titulo: ufsDaEmpresa.length ? `Seus estados (${ufsDaEmpresa.join(', ')})` : 'Seus estados' }
}

/** Estados escolhidos que ficam fora da coleta (o robô só busca os estados dos filtros). */
export function foraDaColeta(filtro: Filtro, ufsDaEmpresa: string[]): string | null {
  const fora = (filtro.ufs ?? []).filter(u => !ufsDaEmpresa.includes(u))
  if (!fora.length) return null
  return `Só busco licitações dos estados dos seus filtros (${ufsDaEmpresa.join(', ') || 'nenhum'}). Para incluir ${fora.join(', ')}, abra "Filtros": entra na coleta de amanhã cedo.`
}

/**
 * Lê estados em texto livre: siglas ("PR SC"), regiões ("sul", "centro-oeste"), nomes por extenso
 * ("santa catarina") e "todos", em qualquer mistura ("sul e SP"). O que não reconhece volta em "invalidas".
 */
export function analisarUfs(texto: string): { validas: string[]; invalidas: string[] } {
  const normalizado = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/centro[\s-]*oeste/gi, 'centrooeste')
    .replace(REGEX_NOMES, nome => ` ${NOMES_DOS_ESTADOS[nome.toLowerCase()]} `)
  const marcadas = new Set<string>()
  const invalidas: string[] = []
  for (const pedaco of normalizado.split(/[\s,;+/.!?]+/).filter(Boolean)) {
    const minusculo = pedaco.toLowerCase()
    if (PALAVRAS_TODOS.has(minusculo)) return { validas: [...UFS_LISTA], invalidas: [] }
    if (PALAVRAS_DE_LIGACAO.has(minusculo)) continue
    const regiao = REGIOES.find(r => r.id === minusculo)
    if (regiao) regiao.ufs.forEach(u => marcadas.add(u))
    else if (UFS_VALIDAS.has(pedaco.toUpperCase())) marcadas.add(pedaco.toUpperCase())
    else if (!invalidas.includes(pedaco.slice(0, 10))) invalidas.push(pedaco.slice(0, 10))
  }
  return { validas: UFS_LISTA.filter(u => marcadas.has(u)), invalidas }
}

/** Estados viram o "onde" mais curto: um estado, uma região exata ou a lista. */
export function ondeDasUfs(ufs: string[]): Onde {
  if (ufs.length === 1) return { tipo: 'uf', uf: ufs[0] }
  const regiao = REGIOES.find(r => r.ufs.length === ufs.length && r.ufs.every(u => ufs.includes(u)))
  if (regiao) return { tipo: 'regiao', id: regiao.id }
  return { tipo: 'ufs', ufs }
}

// ---------------------------------------------------------------------------
// Cidades (a lista vem de src/dados/cidades.json, carregada só quando precisa)
// ---------------------------------------------------------------------------

export type Cidade = { nome: string; uf: string }
export type BuscaCidade = { tipo: 'achou'; cidade: Cidade } | { tipo: 'varias'; opcoes: Cidade[] } | { tipo: 'nenhuma' }

/** Sem acento, minúsculas, sem pontuação e com "d'Oeste" = "doeste". */
export function normalizarCidade(s: string): string {
  return semAcento(s).replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

/** "Maringá PR", "maringa - pr", "Maringá/PR" ou só "Maringá" (se o nome só existe num estado). */
export function buscarCidade(texto: string, cidades: Cidade[]): BuscaCidade {
  const partes = normalizarCidade(texto).split(' ').filter(Boolean)
  if (!partes.length) return { tipo: 'nenhuma' }
  const ultima = partes[partes.length - 1].toUpperCase()
  const temUf = partes.length > 1 && UFS_VALIDAS.has(ultima)
  const nome = (temUf ? partes.slice(0, -1) : partes).join(' ')
  const doEstado = (c: Cidade) => !temUf || c.uf === ultima
  const exatas = cidades.filter(c => normalizarCidade(c.nome) === nome && doEstado(c))
  if (exatas.length === 1) return { tipo: 'achou', cidade: exatas[0] }
  if (exatas.length > 1) return { tipo: 'varias', opcoes: exatas }
  // Sem acerto exato: as que começam com o que foi escrito ("sao jose dos" -> várias).
  if (nome.length < 3) return { tipo: 'nenhuma' }
  const prefixo = cidades.filter(c => normalizarCidade(c.nome).startsWith(nome) && doEstado(c))
  if (prefixo.length === 1) return { tipo: 'achou', cidade: prefixo[0] }
  if (prefixo.length > 1 && prefixo.length <= 8) return { tipo: 'varias', opcoes: prefixo }
  return { tipo: 'nenhuma' }
}

// ---------------------------------------------------------------------------
// O que a pessoa escreveu
// ---------------------------------------------------------------------------

export type Comando = 'licitacoes' | 'acompanhando' | 'prazos' | 'filtros' | 'ajuda' | 'mais' | 'limpar' | 'origem' | 'apagar'

const PALAVRAS: Record<string, Comando> = {
  licitacoes: 'licitacoes', licitacao: 'licitacoes', buscar: 'licitacoes', pesquisar: 'licitacoes', inicio: 'licitacoes',
  acompanhando: 'acompanhando', acompanhadas: 'acompanhando', acompanhada: 'acompanhando', favoritas: 'acompanhando',
  prazos: 'prazos', prazo: 'prazos', agenda: 'prazos',
  filtros: 'filtros', filtro: 'filtros', menu: 'filtros', editar: 'filtros', telegram: 'filtros',
  ajuda: 'ajuda', help: 'ajuda', oi: 'ajuda', ola: 'ajuda',
  mais: 'mais', 'ver mais': 'mais', proximas: 'mais',
  limpar: 'limpar', limpa: 'limpar',
  origem: 'origem', apagar: 'apagar',
}

/** "📋 Licitações", "licitacoes", "AJUDA!", "/filtros" -> o comando. Só vale se o texto inteiro for a palavra. */
export function comandoDoTexto(texto: string): Comando | null {
  const limpo = semAcento(texto).replace(/^[^a-z]+|[^a-z]+$/g, '').replace(/\s+/g, ' ')
  return /^[a-z ]+$/.test(limpo) ? (PALAVRAS[limpo] ?? null) : null
}

/** Período escrito em palavras: "7 dias", "em até 15 dias", "30", "hoje", "publicadas hoje". */
function periodoDoTexto(t: string): string | null {
  const s = semAcento(t).trim().replace(/[.!?]+$/, '')
  if (/^(publicadas?\s+)?(de\s+)?hoje$/.test(s)) return 'hoje'
  const m = s.match(/^(?:(?:que\s+)?encerram\s+)?(?:em\s+)?(?:ate\s+)?(?:os\s+)?(?:proximos\s+)?(7|15|30)(?:\s*dias?)?$/)
  return m ? m[1] : null
}

/** Separa um período no fim da frase: "sul 15 dias" -> ["sul", "15"]; "SC até 20/11" -> ["SC", data]. */
function separarPeriodo(texto: string, agora: Date): { resto: string; chave: string } | { erro: string } | null {
  const palavras = texto.trim().split(/\s+/)
  // Tenta os últimos 1 a 5 pedaços como período ou data ("em até 15 dias", "até o dia 20/11/2026").
  for (let n = Math.min(5, palavras.length - 1); n >= 1; n--) {
    const fim = palavras.slice(-n).join(' ')
    const resto = palavras.slice(0, -n).join(' ')
    const p = periodoDoTexto(fim)
    if (p) return { resto, chave: p }
    const d = interpretarData(fim, agora)
    if (d) return 'erro' in d ? d : { resto, chave: d.chave }
  }
  return null
}

export type Esperando = null | 'cidade' | { data: Onde }

export type Intencao =
  | { tipo: 'vazio' }
  | { tipo: 'comando'; comando: Comando }
  | { tipo: 'periodo'; chave: string }
  | { tipo: 'erro'; texto: string }
  | { tipo: 'onde'; onde: Onde; chave: string | null }
  // Talvez uma cidade: a tela procura na lista de cidades (que é grande e só carrega quando precisa).
  | { tipo: 'livre'; texto: string; chave: string | null }

/**
 * Traduz o que a pessoa escreveu. `esperando` diz se a conversa pediu uma cidade ou uma data
 * (aí a resposta tem prioridade sobre o resto, como no bot).
 */
export function entenderMensagem(texto: string, esperando: Esperando = null, agora: Date = new Date()): Intencao {
  const t = texto.trim().slice(0, 200)
  if (!t) return { tipo: 'vazio' }

  const comando = comandoDoTexto(t.replace(/^\//, ''))
  if (comando && esperando !== 'cidade') return { tipo: 'comando', comando }
  if (esperando === 'cidade') return comando ? { tipo: 'comando', comando } : { tipo: 'livre', texto: t, chave: null }

  const data = interpretarData(t, agora)
  if (data) return 'erro' in data ? { tipo: 'erro', texto: data.erro } : { tipo: 'periodo', chave: data.chave }
  if (esperando && typeof esperando === 'object') return { tipo: 'erro', texto: `Até que dia? ${DICA_DATA}` }

  const periodo = periodoDoTexto(t)
  if (periodo) return { tipo: 'periodo', chave: periodo }

  // Lugar, com ou sem período no fim ("PR SC", "sul e SP 15 dias", "Maringá PR até 20/11").
  const separado = separarPeriodo(t, agora)
  if (separado && 'erro' in separado) return { tipo: 'erro', texto: separado.erro }
  const lugar = separado ? separado.resto : t
  const chave = separado ? separado.chave : null
  // "cidade São Paulo": sem isso, "São Paulo" seria lido como o estado.
  const cidade = lugar.match(/^\s*cidade\s+(?:de\s+)?(.+)$/i)
  if (cidade) return { tipo: 'livre', texto: cidade[1].trim(), chave }
  const ufs = analisarUfs(lugar)
  if (ufs.validas.length && !ufs.invalidas.length) return { tipo: 'onde', onde: ondeDasUfs(ufs.validas), chave }
  // Tira o "licitações em" da frente antes de procurar a cidade.
  const limpo = lugar.replace(/^\s*(?:quero\s+)?(?:ver\s+)?(?:as\s+)?(?:licita[cç](?:õ|o)es|licita[cç][aã]o)?\s*(?:em|no|na|de)?\s+/i, '').trim()
  return { tipo: 'livre', texto: limpo || lugar, chave }
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

export const AJUDA = [
  'Eu sou o Radar. Posso ajudar com isto:',
  '',
  '• licitações – escolher onde (seus estados, um estado, uma região ou uma cidade) e quando (7, 15, 30 dias, hoje ou até uma data)',
  '• acompanhando – ver as que você marcou (página Acompanhando)',
  '• prazos – a agenda das acompanhadas, da que encerra primeiro',
  '• filtros – ver e mudar ramos, estados, valor e o Telegram',
  '• mais – ver as próximas da última busca',
  '• limpar – limpar a conversa (seus filtros e as acompanhadas ficam)',
  '',
  'Também entendo frases curtas: "PR SC", "sul e SP", "todos", "Maringá PR", "cidade São Paulo", "até 20/11", "SC 15 dias".',
  'Sou uma ferramenta de apoio: confira sempre os detalhes no edital oficial.',
].join('\n')

export function linhaPrazo(iso: string | null, agora: Date = new Date()): string {
  if (!iso) return 'Sem data de encerramento'
  const d = new Date(iso)
  const texto = d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const ms = d.getTime() - agora.getTime()
  if (ms < 0) return `Encerrou ${texto}`
  const dias = Math.ceil(ms / 86_400_000)
  return `Encerra ${texto}${dias <= 1 ? ' (último dia)' : ` (faltam ${dias} dias)`}`
}
