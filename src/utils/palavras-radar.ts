// Ajuda na hora de escrever as palavras do Radar (tela "Mudar filtros" e conversa do Radar).
// O banco já acha plural, singular, acento e maiúscula (migração 0017). Aqui ficam:
// - separar o texto do campo em palavras;
// - sinônimos: o jeito do dia a dia ("remédio") e o jeito que aparece nas licitações ("medicamento");
// - trocar ou adicionar uma palavra no campo sem mexer nas outras;
// - a dica da conversa quando uma palavra não acha nada.
// Tudo é sugestão: quem decide trocar ou adicionar é a pessoa.

/** O que o banco devolve para cada palavra (conferir_palavras_radar). */
export type ConferenciaPalavra = {
  palavra: string
  abertas: number
  sugestao: string | null
  abertasSugestao: number | null
}

/** Sem acento, minúsculas e espaços simples: "  Remédios " -> "remedios". */
export function normalizar(p: string): string {
  return p.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Plural simples para comparar ("remedios" e "remedio" são a mesma coisa aqui). */
function semPlural(p: string): string {
  return p.split(' ').map(w => {
    if (w.length <= 3) return w
    if (/(oes|aes)$/.test(w)) return w.slice(0, -3) + 'ao'
    if (/ais$/.test(w)) return w.slice(0, -3) + 'al'
    if (/eis$/.test(w)) return w.slice(0, -3) + 'el'
    if (/[rz]es$/.test(w)) return w.slice(0, -2)
    return w.replace(/s$/, '')
  }).join(' ')
}

/** "detergente, Material de limpeza; merenda\nDetergente" -> ['detergente', 'Material de limpeza', 'merenda']. */
export function separarPalavras(texto: string): string[] {
  const vistas = new Set<string>()
  const lista: string[] = []
  for (const bruta of texto.split(/[,;\n]/)) {
    const p = bruta.replace(/\s+/g, ' ').trim()
    const chave = normalizar(p)
    if (!p || vistas.has(chave)) continue
    vistas.add(chave)
    lista.push(p)
  }
  return lista
}

// Chave: o que a pessoa costuma escrever (sem acento e sem plural). Valor: como os órgãos escrevem.
// Lista curta de propósito: só trocas que quase sempre valem. Para aumentar, acrescente aqui e no teste.
const SINONIMOS: Record<string, string[]> = {
  'remedio': ['medicamento'],
  'carro': ['veiculo'],
  'automovel': ['veiculo'],
  'comida': ['generos alimenticios'],
  'merenda': ['alimentacao escolar', 'generos alimenticios'],
  'cesta basica': ['generos alimenticios'],
  'lanche': ['generos alimenticios'],
  'material de escritorio': ['material de expediente'],
  'gasolina': ['combustivel'],
  'diesel': ['combustivel'],
  'etanol': ['combustivel'],
  'faxina': ['limpeza'],
  'uniforme': ['fardamento'],
  'xerox': ['reprografia'],
  'epi': ['equipamento de protecao individual'],
  'seguranca': ['vigilancia'],
}

// Como mostrar na tela (o banco acha com ou sem acento; com acento fica mais fácil de ler).
const ACENTOS: Record<string, string> = {
  'veiculo': 'veículo',
  'generos alimenticios': 'gêneros alimentícios',
  'alimentacao escolar': 'alimentação escolar',
  'combustivel': 'combustível',
  'equipamento de protecao individual': 'equipamento de proteção individual',
  'vigilancia': 'vigilância',
}

export type Sinonimo = { de: string; para: string }

/** Palavras que vale acrescentar, sem repetir o que já está no campo. */
export function sugerirSinonimos(palavras: string[]): Sinonimo[] {
  const tem = new Set(palavras.map(p => semPlural(normalizar(p))))
  const jaSugeridas = new Set<string>()
  const lista: Sinonimo[] = []
  for (const p of palavras) {
    for (const alvo of SINONIMOS[semPlural(normalizar(p))] ?? []) {
      if (tem.has(semPlural(alvo)) || jaSugeridas.has(alvo)) continue
      jaSugeridas.add(alvo)
      lista.push({ de: p, para: ACENTOS[alvo] ?? alvo })
    }
  }
  return lista
}

/** Troca uma palavra do campo por outra, mantendo as demais e a ordem. */
export function trocarPalavra(texto: string, de: string, para: string): string {
  const alvo = normalizar(de)
  return separarPalavras(separarPalavras(texto).map(p => (normalizar(p) === alvo ? para : p)).join('\n')).join(', ')
}

/** Acrescenta uma palavra no fim do campo (se ainda não estiver lá). */
export function adicionarPalavra(texto: string, nova: string): string {
  return separarPalavras(`${texto}\n${nova}`).join(', ')
}

function vezes(n: number): string {
  return n === 1 ? '1 licitação aberta' : `${n} licitações abertas`
}

/** Linha da conferência para uma palavra, em português simples. */
export function frasePalavra(c: ConferenciaPalavra): string {
  if (c.abertas > 0 && !c.sugestao) return `${vezes(c.abertas)} agora`
  if (c.abertas > 0 && c.sugestao) return `${vezes(c.abertas)} agora. Mais comum: "${c.sugestao}" (${c.abertasSugestao ?? 0})`
  if (c.sugestao) return `nenhuma aberta agora. Quis dizer "${c.sugestao}" (${c.abertasSugestao ?? 0})?`
  return 'nenhuma aberta agora (pode aparecer nos próximos dias)'
}

/** Dica da conversa quando a busca volta vazia: aponta palavra com erro de escrita, se houver. */
export function dicaDeEscrita(conferencia: ConferenciaPalavra[]): string | null {
  const erradas = conferencia.filter(c => c.abertas === 0 && c.sugestao && (c.abertasSugestao ?? 0) > 0)
  if (!erradas.length) return null
  const partes = erradas.slice(0, 2).map(c => `"${c.palavra}" não aparece em nenhuma licitação aberta; "${c.sugestao}" aparece em ${c.abertasSugestao}`)
  return `Talvez seja a escrita: ${partes.join('. ')}. Dá para trocar em ⚙️ Mudar filtros.`
}
