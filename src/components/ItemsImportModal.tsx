import React, { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { listItems, replaceItems } from '../utils/items'

// Planilha "02. MODELO DE COTAÇÃO": tem um bloco de cabeçalho do pregão (linhas
// 1-6, tamanho pode variar um pouco de arquivo pra arquivo) antes da tabela de
// itens em si. Por isso a leitura não assume um número fixo de linha pro
// cabeçalho da tabela — ela procura a célula "COD. KRALEN" nas primeiras
// linhas e só então lê os itens a partir da linha seguinte.
//
// A partir daí a leitura é posicional (por índice de coluna), pulando as
// colunas ocultas de % (ficam "escondidas" dentro do cabeçalho mesclado de
// Valor Mínimo/Município, só ajudam quem preenche a planilha a calcular a
// margem, não guardamos elas) e parando no primeiro item sem descrição — o
// restante da planilha vem com linhas em branco do modelo, prontas pra uso
// futuro.
//
// Os índices de COL são relativos ao array que `sheet_to_json` devolve, que
// começa na primeira coluna USADA da planilha (aqui, a coluna B do Excel —
// a coluna A fica sempre em branco no modelo), não necessariamente na coluna
// A. `validarCabecalho` confere se essa suposição continua batendo antes de
// importar qualquer coisa — se o layout mudar, o import é bloqueado com um
// erro em vez de gravar valor errado em coluna errada.
const COL = {
  codKralen: 0, item: 1, descricao: 2, unidade: 3, quantidade: 4,
  marcaCotacao: 5, origemCotacao: 6, valorUnitMinimo: 7, valorTotalMinimo: 9,
  valorUnitMunicipio: 10, valorTotalMunicipio: 12, valorCusto: 13, totalCusto: 14,
  ganhador: 15, marcaVencedora: 17, valorTotalArrematado: 20,
} as const

function normalizar(v: any): string {
  return String(v ?? '').trim().toUpperCase()
}

// Confere se as colunas nas posições esperadas (COL) realmente têm o texto
// de cabeçalho que a gente espera — se o layout do arquivo mudar (coluna a
// mais/a menos, ordem diferente), isso pega o desalinhamento na hora, em vez
// de importar valor errado pra coluna errada silenciosamente.
const TEXTOS_ESPERADOS: [keyof typeof COL, string][] = [
  ['item', 'ITEM'], ['descricao', 'DESCRI'], ['unidade', 'UNID'], ['quantidade', 'QUANT'],
  ['origemCotacao', 'ORIGEM'], ['valorUnitMinimo', 'MINIMO'], ['valorTotalMinimo', 'MINIMO'],
  ['valorUnitMunicipio', 'MUNICIPIO'], ['valorTotalMunicipio', 'MUNICIPIO'],
  ['valorCusto', 'CUSTO'], ['totalCusto', 'CUSTO'], ['ganhador', 'GANHADOR'],
]

function validarCabecalho(headerRow: any[]): string[] {
  const problemas: string[] = []
  for (const [campo, esperado] of TEXTOS_ESPERADOS) {
    const texto = normalizar(headerRow[COL[campo]])
    if (!texto.includes(esperado)) problemas.push(`coluna "${campo}" esperava conter "${esperado}", achei "${headerRow[COL[campo]] || '(vazio)'}"`)
  }
  return problemas
}

function encontrarLinhaCabecalho(rows: any[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const celula = normalizar(rows[i]?.[COL.codKralen])
    if (celula.startsWith('COD') && celula.includes('KRALEN')) return i
  }
  return -1
}

function pareceGanhador(valor: any): boolean {
  if (typeof valor === 'boolean') return valor
  const texto = String(valor ?? '').trim().toLowerCase()
  return ['sim', 's', 'x', '1', 'true', 'ganhou'].includes(texto)
}

function rowToItem(row: any[]): Record<string, any> {
  const vencedor = pareceGanhador(row[COL.ganhador])
  const marcaVencedora = String(row[COL.marcaVencedora] ?? '').trim()
  return {
    codKralen: row[COL.codKralen] ?? '',
    item: row[COL.item] ?? '',
    descricao: row[COL.descricao] ?? '',
    unidade: row[COL.unidade] ?? '',
    quantidade: row[COL.quantidade] ?? '',
    marca: marcaVencedora || (row[COL.marcaCotacao] ?? ''),
    origemCotacao: row[COL.origemCotacao] ?? '',
    valorUnitMinimo: row[COL.valorUnitMinimo] ?? '',
    valorTotalMinimo: row[COL.valorTotalMinimo] ?? '',
    valorUnitMunicipio: row[COL.valorUnitMunicipio] ?? '',
    valorTotalMunicipio: row[COL.valorTotalMunicipio] ?? '',
    valorCusto: row[COL.valorCusto] ?? '',
    totalCusto: row[COL.totalCusto] ?? '',
    vencedor,
    valorGanho: vencedor ? (row[COL.valorTotalArrematado] ?? '') : '',
  }
}

export default function ItemsImportModal({ open, onClose, codigo }: { open: boolean; onClose: () => void; codigo: number }) {
  const [items, setItems] = useState<any[]>([])
  const [erro, setErro] = useState('')

  useEffect(() => {
    let mounted = true
    listItems(codigo).then(raw => { if (mounted) setItems(raw || []) })
    return () => { mounted = false }
  }, [open, codigo])

  const onFile = (f: File | null) => {
    if (!f) return
    setErro('')
    const reader = new FileReader()
    reader.onload = async (e) => {
      const data = e.target?.result
      const workbook = XLSX.read(data, { type: 'binary' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
      const headerIdx = encontrarLinhaCabecalho(rows)
      if (headerIdx === -1) {
        setErro('Não reconheci o modelo dessa planilha — a coluna "COD. KRALEN" não foi encontrada.')
        return
      }
      const problemas = validarCabecalho(rows[headerIdx])
      if (problemas.length > 0) {
        setErro('A planilha não bate com o modelo esperado, nada foi importado: ' + problemas.join('; ') + '.')
        return
      }
      const dataRows = rows.slice(headerIdx + 1)
      const parsed = dataRows
        .map(rowToItem)
        .filter(it => String(it.descricao || '').trim() !== '')
      const saved = await replaceItems(codigo, parsed)
      setItems(saved)
    }
    reader.readAsBinaryString(f)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-6 z-50">
      <div className="bg-white rounded shadow max-w-2xl w-full p-4">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold">Importar Itens — Licitação {codigo}</h4>
          <button onClick={onClose} className="text-gray-500">Fechar</button>
        </div>

        <div>
          <label className="btn btn-ghost inline-flex items-center gap-2">
            <input type="file" accept=".xls,.xlsx" onChange={e => onFile(e.target.files?.[0] || null)} className="hidden" />
            Selecionar planilha (.xls/.xlsx)
          </label>
        </div>

        {erro && <p className="text-sm mt-2" style={{ color: 'var(--color-error)' }}>{erro}</p>}

        <div className="mt-4 max-h-64 overflow-auto rounded p-2">
          {items.length === 0 && <p className="text-sm text-gray-500">Nenhum item importado.</p>}
          {items.slice(0, 50).map((it, i) => (
            <div key={i} className="text-sm border-b py-2">
              <div className="font-medium">
                {it.codKralen ? `[${it.codKralen}] ` : ''}{it.lote ? `Lote ${it.lote} — ` : ''}Item {it.item || i + 1} — {it.descricao || '-'}
              </div>
              <div className="text-xs text-gray-700 mt-1">Uni: {it.unidade || '-'} — Qtd: {it.quantidade || '-'} — Marca: {it.marca || '-'}</div>
            </div>
          ))}
          {items.length > 50 && <p className="text-xs text-gray-500 mt-2">+ {items.length - 50} itens não exibidos aqui (todos foram importados).</p>}
        </div>
      </div>
    </div>
  )
}
