import * as XLSX from 'xlsx'

// Planilha "02. MODELO DE COTAÇÃO": um bloco de cabeçalho do pregão (linhas 1-6, o tamanho
// pode variar de arquivo para arquivo) e depois a tabela de itens. A leitura não assume linha
// nem coluna fixas: procura a célula do código interno ("CÓD. INTERNO"; nos arquivos antigos,
// "COD. KRALEN") seguida de "ITEM" nas primeiras linhas (em qualquer coluna) e lê o resto em posições relativas a ela (COL_OFFSET). Isso evita quebrar quando o arquivo tem
// uma coluna a mais ou a menos no início (aconteceu com um arquivo real de cliente).
//
// A partir da âncora, a leitura pula as colunas ocultas de % (só ajudam quem preenche a calcular
// a margem; não guardamos) e ignora as linhas sem descrição.
//
// O mesmo arquivo gera a planilha para baixar (gerarPlanilhaItens): quem baixa, completa no
// Excel e importa de volta pelo "Importar Itens", sem mexer no layout.

export const COL_OFFSET = {
  codInterno: 0, item: 1, descricao: 2, unidade: 3, quantidade: 4,
  marcaCotacao: 5, origemCotacao: 6, valorUnitMinimo: 7, valorTotalMinimo: 9,
  valorUnitMunicipio: 10, valorTotalMunicipio: 12, valorCusto: 13, totalCusto: 14,
  ganhador: 15, marcaVencedora: 17, valorTotalArrematado: 20,
} as const

export type Coluna = Record<keyof typeof COL_OFFSET, number>

/** Maiúsculas e sem acento: "Mínimo" e "MINIMO" contam igual. */
export function normalizar(v: any): string {
  return String(v ?? '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
}

// Confere se as colunas nas posições esperadas têm o cabeçalho esperado: se o layout mudar de um
// jeito que a âncora não cobre, pega o desalinhamento em vez de importar valor na coluna errada.
const TEXTOS_ESPERADOS: [keyof Coluna, string][] = [
  ['item', 'ITEM'], ['descricao', 'DESCRI'], ['unidade', 'UNID'], ['quantidade', 'QUANT'],
  ['origemCotacao', 'ORIGEM'], ['valorUnitMinimo', 'MINIMO'], ['valorTotalMinimo', 'MINIMO'],
  ['valorUnitMunicipio', 'MUNICIPIO'], ['valorTotalMunicipio', 'MUNICIPIO'],
  ['valorCusto', 'CUSTO'], ['totalCusto', 'CUSTO'], ['ganhador', 'GANHADOR'],
]

export function validarCabecalho(headerRow: any[], col: Coluna): string[] {
  const problemas: string[] = []
  for (const [campo, esperado] of TEXTOS_ESPERADOS) {
    const texto = normalizar(headerRow[col[campo]])
    if (!texto.includes(esperado)) problemas.push(`coluna "${campo}" esperava conter "${esperado}", achei "${headerRow[col[campo]] || '(vazio)'}"`)
  }
  return problemas
}

/**
 * Procura, nas primeiras 20 linhas, a coluna do código interno: uma célula que começa com "COD"
 * ("CÓD. INTERNO", "COD. KRALEN" dos arquivos antigos ou o nome do sistema da empresa) e tem
 * "ITEM" logo à direita.
 */
export function encontrarAncora(rows: any[][]): { linha: number; coluna: number } | null {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i] || []
    for (let c = 0; c < row.length; c++) {
      if (normalizar(row[c]).startsWith('COD') && normalizar(row[c + COL_OFFSET.item]) === 'ITEM') return { linha: i, coluna: c }
    }
  }
  return null
}

export function colunasDaAncora(ancora: { coluna: number }): Coluna {
  return Object.fromEntries(Object.entries(COL_OFFSET).map(([campo, offset]) => [campo, ancora.coluna + offset])) as Coluna
}

function pareceGanhador(valor: any): boolean {
  if (typeof valor === 'boolean') return valor
  const texto = String(valor ?? '').trim().toLowerCase()
  return ['sim', 's', 'x', '1', 'true', 'ganhou'].includes(texto)
}

export function rowToItem(row: any[], col: Coluna): Record<string, any> {
  const vencedor = pareceGanhador(row[col.ganhador])
  const marcaVencedora = String(row[col.marcaVencedora] ?? '').trim()
  return {
    codInterno: row[col.codInterno] ?? '',
    item: row[col.item] ?? '',
    descricao: row[col.descricao] ?? '',
    unidade: row[col.unidade] ?? '',
    quantidade: row[col.quantidade] ?? '',
    marca: marcaVencedora || (row[col.marcaCotacao] ?? ''),
    origemCotacao: row[col.origemCotacao] ?? '',
    valorUnitMinimo: row[col.valorUnitMinimo] ?? '',
    valorTotalMinimo: row[col.valorTotalMinimo] ?? '',
    valorUnitMunicipio: row[col.valorUnitMunicipio] ?? '',
    valorTotalMunicipio: row[col.valorTotalMunicipio] ?? '',
    valorCusto: row[col.valorCusto] ?? '',
    totalCusto: row[col.totalCusto] ?? '',
    vencedor,
    valorGanho: vencedor ? (row[col.valorTotalArrematado] ?? '') : '',
  }
}

/** Lê a planilha inteira (linhas como listas) e devolve os itens, ou o erro pronto para mostrar. */
export function itensDaPlanilha(rows: any[][]): { itens: Record<string, any>[] } | { erro: string } {
  const ancora = encontrarAncora(rows)
  if (!ancora) return { erro: 'Não reconheci o modelo dessa planilha — a coluna "CÓD. INTERNO" seguida de "ITEM" não foi encontrada. Baixe a planilha modelo e use as mesmas colunas.' }
  const col = colunasDaAncora(ancora)
  const problemas = validarCabecalho(rows[ancora.linha], col)
  if (problemas.length) return { erro: 'A planilha não bate com o modelo esperado, nada foi importado: ' + problemas.join('; ') + '.' }
  const itens = rows.slice(ancora.linha + 1)
    .map(row => rowToItem(row, col))
    .filter(it => String(it.descricao || '').trim() !== '')
  return { itens }
}

// ---------------------------------------------------------------------------
// Gerar a planilha para baixar
// ---------------------------------------------------------------------------

/** Cabeçalho da tabela, na ordem de COL_OFFSET (as colunas 8, 11, 16, 18 e 19 são de apoio). */
export const CABECALHO = [
  'CÓD. INTERNO', 'ITEM', 'DESCRIÇÃO', 'UNID.', 'QUANT.', 'MARCA', 'ORIGEM COTAÇÃO',
  'VALOR UNIT. MÍNIMO', '% MÍNIMO', 'VALOR TOTAL MÍNIMO', 'VALOR UNIT. MUNICÍPIO', '% MUNICÍPIO', 'VALOR TOTAL MUNICÍPIO',
  'VALOR CUSTO', 'TOTAL CUSTO', 'GANHADOR', 'EMPRESA GANHADORA', 'MARCA VENCEDORA',
  'VALOR UNIT. ARREMATADO', '% ARREMATADO', 'VALOR TOTAL ARREMATADO',
]

export type CabecalhoPregao = {
  orgao?: string | null
  pregao?: string | null
  processo?: string | null
  objeto?: string | null
  data?: string | null
}

const COLUNA_INICIAL = 1 // a coluna A fica vazia, como no modelo

const num = (v: any): number | '' => {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'number') return Number.isFinite(v) ? v : ''
  const s = String(v).trim().replace(/[^\d.,-]/g, '')
  // "1.234,56" e "0,31" (jeito brasileiro); "5.000" é cinco mil; "0.31" é número normal.
  const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.'))
    : /^\d{1,3}(\.\d{3})+$/.test(s) ? Number(s.replace(/\./g, ''))
    : Number(s)
  return s && Number.isFinite(n) ? n : ''
}

/** As linhas da planilha (bloco do pregão + tabela), no layout que o "Importar Itens" lê. */
export function linhasDaPlanilha(itens: Record<string, any>[], cab: CabecalhoPregao = {}): { linhas: any[][]; linhaCabecalho: number } {
  const vazio = Array(COLUNA_INICIAL).fill('')
  const bloco = [
    [...vazio, '02. MODELO DE COTAÇÃO'],
    [...vazio, 'Órgão:', cab.orgao || ''],
    [...vazio, 'Pregão:', cab.pregao || '', 'Processo:', cab.processo || ''],
    [...vazio, 'Objeto:', cab.objeto || ''],
    [...vazio, 'Data da licitação:', cab.data || ''],
    [],
  ]
  const tabela = itens.map(it => {
    const linha: any[] = Array(CABECALHO.length).fill('')
    linha[COL_OFFSET.codInterno] = it.codInterno ?? ''
    linha[COL_OFFSET.item] = it.item ?? ''
    linha[COL_OFFSET.descricao] = it.descricao ?? ''
    linha[COL_OFFSET.unidade] = it.unidade ?? ''
    linha[COL_OFFSET.quantidade] = num(it.quantidade)
    linha[COL_OFFSET.marcaCotacao] = it.marca ?? ''
    linha[COL_OFFSET.origemCotacao] = it.origemCotacao ?? ''
    linha[COL_OFFSET.valorUnitMinimo] = num(it.valorUnitMinimo)
    linha[COL_OFFSET.valorTotalMinimo] = num(it.valorTotalMinimo)
    linha[COL_OFFSET.valorUnitMunicipio] = num(it.valorUnitMunicipio)
    linha[COL_OFFSET.valorTotalMunicipio] = num(it.valorTotalMunicipio)
    linha[COL_OFFSET.valorCusto] = num(it.valorCusto)
    linha[COL_OFFSET.totalCusto] = num(it.totalCusto)
    linha[COL_OFFSET.ganhador] = it.vencedor ? 'SIM' : ''
    linha[COL_OFFSET.valorTotalArrematado] = it.vencedor ? num(it.valorGanho) : ''
    return [...vazio, ...linha]
  })
  return { linhas: [...bloco, [...vazio, ...CABECALHO], ...tabela], linhaCabecalho: bloco.length }
}

/** Monta o arquivo .xlsx: totais com fórmula (quantidade × unitário), colunas de % escondidas. */
export function gerarPlanilhaItens(itens: Record<string, any>[], cab: CabecalhoPregao = {}): XLSX.WorkBook {
  const { linhas, linhaCabecalho } = linhasDaPlanilha(itens, cab)
  const ws = XLSX.utils.aoa_to_sheet(linhas)
  const letra = (offset: number) => XLSX.utils.encode_col(COLUNA_INICIAL + offset)
  const qtd = letra(COL_OFFSET.quantidade)
  // Total = quantidade × unitário, com o valor já calculado (vale mesmo sem abrir no Excel).
  const pares: [number, number][] = [
    [COL_OFFSET.valorUnitMinimo, COL_OFFSET.valorTotalMinimo],
    [COL_OFFSET.valorUnitMunicipio, COL_OFFSET.valorTotalMunicipio],
    [COL_OFFSET.valorCusto, COL_OFFSET.totalCusto],
  ]
  for (let i = 0; i < itens.length; i++) {
    const r = linhaCabecalho + 2 + i // linha do Excel (começa em 1, depois do cabeçalho)
    for (const [unit, total] of pares) {
      const q = num(itens[i].quantidade)
      const u = ws[`${letra(unit)}${r}`]?.v
      const ref = `${letra(total)}${r}`
      const v = typeof q === 'number' && typeof u === 'number' ? Math.round(q * u * 100) / 100 : ws[ref]?.v
      ws[ref] = { t: typeof v === 'number' ? 'n' : 's', v: v ?? '', f: `IF(OR(${qtd}${r}="",${letra(unit)}${r}=""),"",${qtd}${r}*${letra(unit)}${r})` }
    }
  }
  const largura: Record<number, number> = { [COL_OFFSET.descricao]: 60, [COL_OFFSET.origemCotacao]: 18, [COL_OFFSET.marcaCotacao]: 16, [COL_OFFSET.marcaVencedora]: 16 }
  const escondidas = new Set([8, 11, 19])
  ws['!cols'] = [{ wch: 2 }, ...CABECALHO.map((_, i) => ({ wch: largura[i] ?? 14, hidden: escondidas.has(i) }))]
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: linhaCabecalho, c: COLUNA_INICIAL }, e: { r: linhaCabecalho + Math.max(itens.length, 1), c: COLUNA_INICIAL + CABECALHO.length - 1 } }) }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Cotação')
  return wb
}

/** "Pregão 185/2026 - UEL" -> "itens-pregao-185-2026.xlsx". */
export function nomeDoArquivo(pregao?: string | null): string {
  const base = (pregao || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
  return `itens-${base ? `pregao-${base}` : 'licitacao'}.xlsx`
}

export function baixarPlanilhaItens(itens: Record<string, any>[], cab: CabecalhoPregao = {}) {
  XLSX.writeFile(gerarPlanilhaItens(itens, cab), nomeDoArquivo(cab.pregao))
}
