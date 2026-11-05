import React, { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { listItems, replaceItems } from '../utils/items'
import { auditLog } from '../utils/audit'
import { useModalA11y } from './useModalA11y'
import { baixarPlanilhaItens, itensDaPlanilha, type CabecalhoPregao } from '../utils/modelo-cotacao'

// Lê a planilha no layout do modelo de cotação (regras em utils/modelo-cotacao.ts).

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

export default function ItemsImportModal({ open, onClose, codigo, cabecalho }: { open: boolean; onClose: () => void; codigo: number; cabecalho?: CabecalhoPregao }) {
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
      const lido = itensDaPlanilha(rows)
      if ('erro' in lido) { setErro(lido.erro); return }
      const parsed = lido.itens
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
          <button type="button" className="btn btn-ghost ml-2" onClick={() => baixarPlanilhaItens(items, cabecalho)}>
            ⬇ {items.length ? 'Baixar planilha com estes itens' : 'Baixar planilha modelo'}
          </button>
          <p className="text-xs text-gray-500 mt-2">Baixe, complete no Excel (marca, valores, custo) sem mudar as colunas e importe de volta aqui.</p>
        </div>

        {erro && <p role="alert" className="text-sm mt-2" style={{ color: 'var(--color-error-text)' }}>{erro}</p>}

        <div className="mt-4 max-h-64 overflow-auto rounded p-2">
          {items.length === 0 && <p className="text-sm text-gray-500">Nenhum item importado.</p>}
          {items.slice(0, 50).map((it, i) => (
            <div key={i} className="text-sm border-b py-2">
              <div className="font-medium">
                {it.codInterno ? `[${it.codInterno}] ` : ''}{it.lote ? `Lote ${it.lote} — ` : ''}Item {it.item || i + 1} — {it.descricao || '-'}
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
