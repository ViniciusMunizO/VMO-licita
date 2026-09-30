import React, { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { listItems, replaceItems } from '../utils/items'
import { auditLog } from '../utils/audit'
import { useModalA11y } from './useModalA11y'

// Planilha "02. MODELO DE COTAÇÃO": tem um bloco de cabeçalho do pregão (linhas
// 1-6, tamanho pode variar um pouco de arquivo pra arquivo) antes da tabela de
// itens em si. Por isso a leitura não assume um número fixo de linha nem de
// coluna pro cabeçalho da tabela — ela procura a célula "COD. KRALEN" nas
// primeiras linhas (em qualquer coluna) e usa a posição encontrada como
// âncora: todo o resto é lido em colunas relativas a ela (COL_OFFSET), nunca
// por índice absoluto. Isso evita quebrar quando o arquivo tem uma coluna a
// mais/a menos no início (ex.: a coluna A, normalmente vazia no modelo,
// ganhar alguma formatação e passar a "contar" como coluna usada da planilha
// — foi exatamente isso que aconteceu num arquivo real de cliente).
//
// A partir da âncora, a leitura pula as colunas ocultas de % (ficam
// "escondidas" dentro do cabeçalho mesclado de Valor Mínimo/Município, só
// ajudam quem preenche a planilha a calcular a margem, não guardamos elas) e
// para no primeiro item sem descrição — o restante da planilha vem com
// linhas em branco do modelo, prontas pra uso futuro.
const COL_OFFSET = {
  codKralen: 0, item: 1, descricao: 2, unidade: 3, quantidade: 4,
  marcaCotacao: 5, origemCotacao: 6, valorUnitMinimo: 7, valorTotalMinimo: 9,
  valorUnitMunicipio: 10, valorTotalMunicipio: 12, valorCusto: 13, totalCusto: 14,
  ganhador: 15, marcaVencedora: 17, valorTotalArrematado: 20,
} as const

type Coluna = Record<keyof typeof COL_OFFSET, number>

function normalizar(v: any): string {
  return String(v ?? '').trim().toUpperCase()
}

// Confere se as colunas nas posições esperadas (relativas à âncora) realmente
// têm o texto de cabeçalho que a gente espera — se o layout do arquivo mudar
// de um jeito que a busca pela âncora não cobre (ex.: ordem diferente depois
// dela), isso pega o desalinhamento na hora, em vez de importar valor errado
// pra coluna errada silenciosamente.
const TEXTOS_ESPERADOS: [keyof Coluna, string][] = [
  ['item', 'ITEM'], ['descricao', 'DESCRI'], ['unidade', 'UNID'], ['quantidade', 'QUANT'],
  ['origemCotacao', 'ORIGEM'], ['valorUnitMinimo', 'MINIMO'], ['valorTotalMinimo', 'MINIMO'],
  ['valorUnitMunicipio', 'MUNICIPIO'], ['valorTotalMunicipio', 'MUNICIPIO'],
  ['valorCusto', 'CUSTO'], ['totalCusto', 'CUSTO'], ['ganhador', 'GANHADOR'],
]

function validarCabecalho(headerRow: any[], col: Coluna): string[] {
  const problemas: string[] = []
  for (const [campo, esperado] of TEXTOS_ESPERADOS) {
    const texto = normalizar(headerRow[col[campo]])
    if (!texto.includes(esperado)) problemas.push(`coluna "${campo}" esperava conter "${esperado}", achei "${headerRow[col[campo]] || '(vazio)'}"`)
  }
  return problemas
}

// Procura a célula "COD. KRALEN" em qualquer coluna das primeiras linhas —
// não assume que ela está sempre na primeira posição do array.
function encontrarAncora(rows: any[][]): { linha: number; coluna: number } | null {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i] || []
    for (let c = 0; c < row.length; c++) {
      const texto = normalizar(row[c])
      if (texto.startsWith('COD') && texto.includes('KRALEN')) return { linha: i, coluna: c }
    }
  }
  return null
}

function pareceGanhador(valor: any): boolean {
  if (typeof valor === 'boolean') return valor
  const texto = String(valor ?? '').trim().toLowerCase()
  return ['sim', 's', 'x', '1', 'true', 'ganhou'].includes(texto)
}

function rowToItem(row: any[], col: Coluna): Record<string, any> {
  const vencedor = pareceGanhador(row[col.ganhador])
  const marcaVencedora = String(row[col.marcaVencedora] ?? '').trim()
  return {
    codKralen: row[col.codKralen] ?? '',
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

// FileReader é callback; encapsular numa promessa deixa o onFile ser um
// async/await só, com um try/catch que pega tanto erro de leitura quanto
// erro de gravação (antes, o erro do await morria dentro do onload).
function lerPlanilha(f: File): Promise<any[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não consegui ler o arquivo selecionado.'))
    reader.onload = e => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'binary' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        resolve(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }))
      } catch {
        reject(new Error('Arquivo inválido ou corrompido — não consegui abrir como planilha.'))
      }
    }
    reader.readAsBinaryString(f)
  })
}

export default function ItemsImportModal({ open, onClose, codigo }: { open: boolean; onClose: () => void; codigo: number }) {
  const [items, setItems] = useState<any[]>([])
  const [erro, setErro] = useState('')
  const [importando, setImportando] = useState(false)

  useEffect(() => {
    if (!open) return
    let mounted = true
    setErro('')
    listItems(codigo).then(raw => {
      if (mounted) setItems(raw || [])
    }).catch(err => {
      if (mounted) setErro(err?.message || 'Não foi possível carregar os itens já importados.')
    })
    return () => { mounted = false }
  }, [open, codigo])

  const onFile = async (f: File | null) => {
    if (!f) return
    setErro('')
    setImportando(true)
    try {
      const rows = await lerPlanilha(f)
      const ancora = encontrarAncora(rows)
      if (!ancora) {
        setErro('Não reconheci o modelo dessa planilha — a coluna "COD. KRALEN" não foi encontrada.')
        return
      }
      const col = Object.fromEntries(
        Object.entries(COL_OFFSET).map(([campo, offset]) => [campo, ancora.coluna + offset])
      ) as Coluna
      const problemas = validarCabecalho(rows[ancora.linha], col)
      if (problemas.length > 0) {
        setErro('A planilha não bate com o modelo esperado, nada foi importado: ' + problemas.join('; ') + '.')
        return
      }
      const dataRows = rows.slice(ancora.linha + 1)
      const parsed = dataRows
        .map(row => rowToItem(row, col))
        .filter(it => String(it.descricao || '').trim() !== '')
      const saved = await replaceItems(codigo, parsed)
      setItems(saved)
      try {
        const user = localStorage.getItem('user_name') || undefined
        await auditLog('items_import', { codigo, arquivo: f.name, quantidade: saved.length }, user)
      } catch { /* ignore */ }
    } catch (err: any) {
      // Importar é a operação mais destrutiva do sistema (troca a lista
      // inteira de itens): falhar calado deixava o usuário achando que tinha
      // importado. `replaceItems` só chega a escrever depois de validar tudo,
      // então quando cai aqui a lista antiga continua intacta.
      setErro(err?.message || 'Não consegui importar a planilha. A lista de itens anterior foi mantida.')
    } finally {
      setImportando(false)
    }
  }

  const modalRef = useModalA11y(open, onClose)

  if (!open) return null

  return (
    <div ref={modalRef} className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 sm:p-6 z-50 overflow-y-auto">
      <div className="bg-white rounded shadow max-w-2xl w-full p-4">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold">Importar Itens — Licitação {codigo}</h4>
          <button onClick={onClose} className="text-gray-500">Fechar</button>
        </div>

        <div>
          <label className={`btn btn-ghost inline-flex items-center gap-2 ${importando ? 'opacity-50 pointer-events-none' : ''}`}>
            <input
              type="file"
              accept=".xls,.xlsx"
              disabled={importando}
              // Limpar o value deixa o onChange disparar de novo quando o
              // usuário escolhe o mesmo arquivo duas vezes seguidas (corrigir
              // a planilha e reimportar é exatamente o caso comum aqui).
              onChange={e => { const f = e.target.files?.[0] || null; e.target.value = ''; void onFile(f) }}
              className="hidden"
            />
            {importando ? 'Importando...' : 'Selecionar planilha (.xls/.xlsx)'}
          </label>
        </div>

        {erro && <p role="alert" className="text-sm mt-2" style={{ color: 'var(--color-error-text)' }}>{erro}</p>}

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
