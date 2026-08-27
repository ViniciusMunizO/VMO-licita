import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { dbGet } from '../../utils/db'
import { exportElementsToPdf } from '../../utils/pdf'
import { formatDateTimeBR, formatDateBR } from '../../utils/date'
import { formatNumeric, calcCustoUnitario, calcTotalCusto } from '../../utils/format'
import AttachmentsModal from '../../components/AttachmentsModal'
import AtaContratoModal, { Ata } from '../../components/AtaContratoModal'
import DeclaracoesSection from '../../components/DeclaracoesSection'
import PrintableChecklist from '../../components/PrintableChecklist'

const HABILITACAO_ITEMS: { key: string; label: string }[] = [
  { key: 'habilitacaoJuridica', label: 'Habilitação Jurídica' },
  { key: 'habilitacaoFiscal', label: 'Habilitação Fiscal, Social e Trabalhista' },
  { key: 'balanco', label: 'Balanço' },
  { key: 'anvisa', label: 'Anvisa' },
  { key: 'boasPraticas', label: 'Boas Práticas' },
  { key: 'laudo', label: 'Laudo' },
  { key: 'bula', label: 'Bula' },
  { key: 'ggrem', label: 'GGREM' },
  { key: 'cti', label: 'CTI com Transportadora' },
  { key: 'outras', label: 'Outras declarações' },
]

// Abre o conteúdo (já todo em estilo inline, sem depender do CSS do app) numa
// aba nova e aciona o diálogo de impressão nativo do navegador.
function printElement(el: HTMLElement, title: string) {
  const win = window.open('', '_blank', 'width=900,height=1000')
  if (!win) return
  win.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title></head><body style="margin:0">${el.outerHTML}</body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 300)
}

const ITEM_FIELDS: { key: string; label: string; wide?: boolean }[] = [
  { key: 'lote', label: 'Lote' },
  { key: 'item', label: 'Item' },
  { key: 'descricao', label: 'Descrição', wide: true },
  { key: 'unidade', label: 'Uni' },
  { key: 'quantidade', label: 'Qtd' },
  { key: 'valorEdital', label: 'Valor Edital' },
  { key: 'totalEdital', label: 'Total' },
  { key: 'marca', label: 'Marca' },
  { key: 'apresentacao', label: 'Apresentação', wide: true },
  { key: 'anvisa', label: 'Nº Anvisa' },
  { key: 'valorCusto', label: 'Valor Custo' },
  { key: 'tx', label: 'TX' },
  { key: 'custoUnitario', label: 'Custo + TX (Uni)' },
  { key: 'totalCusto', label: 'Total Custo' },
  { key: 'status', label: 'Status' },
  { key: 'custoCaixa', label: 'Custo Caixa' },
]

export default function DetailLicitacao() {
  const { codigo } = useParams()
  const nav = useNavigate()
  const [model, setModel] = useState<any>(null)
  const [attachments, setAttachments] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [atas, setAtas] = useState<Ata[]>([])
  const printRef = useRef<HTMLDivElement | null>(null)
  const itemsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const { dbGet, migrateFromLocalStorage } = await import('../../utils/db')
      // Garante que qualquer dado antigo ainda só em localStorage (de antes da
      // migração para IndexedDB) seja copiado pro banco antes de ler — assim
      // a leitura abaixo sempre reflete o banco, nunca depende de fallback.
      await migrateFromLocalStorage()
      const list = (await dbGet('licitacoes')) || []
      const found = list.find((x: any) => String(x.codigo) === String(codigo))
      if (!mounted) return
      setModel(found || null)
      // load attachments, items and atas/contratos
      try {
        const rawAt = (await dbGet(`attachments_${codigo}`)) || []
        const rawIt = (await dbGet(`items_${codigo}`)) || []
        const rawAtas = (await dbGet(`atas_${codigo}`)) || []
        if (mounted) {
          setAttachments(rawAt)
          setItems(rawIt)
          setAtas(rawAtas)
        }
      } catch (err) {
        // ignore
      }
    }
    load()
    return () => { mounted = false }
  }, [codigo])

  const { user } = useAuth()
  const [openAttachments, setOpenAttachments] = useState(false)
  const [showAtaModal, setShowAtaModal] = useState(false)

  const saveAta = async (ata: Ata) => {
    const key = `atas_${codigo}`
    const { dbUpdate } = await import('../../utils/db')
    const updated = await dbUpdate<Ata[]>(key, (current) => [...(current || []), ata])
    setAtas(updated)
    try {
      const { auditLog } = await import('../../utils/audit')
      const auditUser = localStorage.getItem('user_name') || undefined
      await auditLog('ata_create', { codigo, tipo: ata.tipo, numero: ata.numero }, auditUser)
    } catch (err) { /* ignore */ }
  }

  const removeAta = async (id: string) => {
    const key = `atas_${codigo}`
    const { dbUpdate } = await import('../../utils/db')
    const list = await dbUpdate<Ata[]>(key, (current) => (current || []).filter((a: Ata) => a.id !== id))
    setAtas(list)
  }
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null)
  const [editItemDraft, setEditItemDraft] = useState<any>(null)
  const [valorGanhoDraft, setValorGanhoDraft] = useState<Record<number, string>>({})
  const [editingValorGanhoIdx, setEditingValorGanhoIdx] = useState<number | null>(null)

  const saveValorGanho = async (idx: number, valor: string) => {
    const key = `items_${model.codigo}`
    const { dbUpdate } = await import('../../utils/db')
    const list = await dbUpdate<any[]>(key, (current) => {
      const next = [...(current || [])]
      next[idx] = { ...(next[idx] || {}), valorGanho: valor }
      return next
    })
    setItems(list)
    setValorGanhoDraft(d => { const next = { ...d }; delete next[idx]; return next })
    // sai do modo de edição — o valor salvo aparece como texto fixo, o que
    // deixa claro pra quem usa que o "OK" realmente gravou algo.
    setEditingValorGanhoIdx(current => (current === idx ? null : current))
    try {
      const { auditLog } = await import('../../utils/audit')
      const user = localStorage.getItem('user_name') || undefined
      await auditLog('item_valor_ganho', { codigo: model.codigo, itemIndex: idx, valorGanho: valor, descricao: list[idx].descricao }, user)
    } catch (err) { /* ignore */ }
  }

  const startEditItem = (idx: number) => {
    setEditingItemIndex(idx)
    setEditItemDraft({ ...items[idx] })
  }

  const cancelEditItem = () => {
    setEditingItemIndex(null)
    setEditItemDraft(null)
  }

  const saveEditItem = async (idx: number) => {
    const key = `items_${model.codigo}`
    const { dbUpdate } = await import('../../utils/db')
    const list = await dbUpdate<any[]>(key, (current) => {
      const next = [...(current || [])]
      next[idx] = { ...(next[idx] || {}), ...editItemDraft }
      return next
    })
    setItems(list)
    setEditingItemIndex(null)
    setEditItemDraft(null)
    try {
      const { auditLog } = await import('../../utils/audit')
      const auditUser = localStorage.getItem('user_name') || undefined
      await auditLog('item_edit', { codigo: model.codigo, itemIndex: idx, descricao: list[idx].descricao }, auditUser)
    } catch (err) { /* ignore */ }
  }

  const hasLotes = items.some(it => it.lote)

  if (!model) return (
    <div className="bg-white p-6 rounded shadow max-w-3xl mx-auto">
      <p className="text-sm text-gray-600">Licitação não encontrada.</p>
      <div className="mt-4">
        <button onClick={() => nav('/licitacoes')} className="btn btn-ghost">Voltar</button>
      </div>
    </div>
  )

  return (
    <div className="bg-white p-6 rounded shadow">
      <div className="flex justify-between items-start">
        <h3 className="text-xl font-semibold flex items-center gap-3">
          Licitação {model.codigo} — {model.ano}
          <span
            className="text-xs font-medium px-2 py-1 rounded-full"
            style={
              model.status === 'Ganhou' ? { backgroundColor: '#dcfce7', color: '#15803d' }
                : model.status === 'Perdeu' ? { backgroundColor: '#fee2e2', color: 'var(--color-error)' }
                : { backgroundColor: '#f3f4f6', color: '#6b7280' }
            }
          >
            {model.status || 'Sem status'}
          </span>
        </h3>
        <div className="flex gap-2">
          <button onClick={() => setShowAtaModal(true)} className="btn btn-primary">Novo Contrato</button>
          <Link to={`/licitacoes/novo?edit=${model.codigo}`} className="btn btn-primary">Editar</Link>
          <button onClick={() => nav('/licitacoes')} className="btn btn-ghost">Voltar</button>
        </div>
      </div>

      <div className="mt-4">
        <h4 className="font-semibold mb-2">Atas / Contratos</h4>
        {atas.length === 0 ? (
          <div className="text-sm text-gray-500">Nenhuma ata/contrato cadastrado ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 whitespace-nowrap">
                  <th className="p-2">Tipo</th>
                  <th className="p-2">Número</th>
                  <th className="p-2">Início da Vigência</th>
                  <th className="p-2">Fim da Vigência</th>
                  <th className="p-2">Observações</th>
                  <th className="p-2">Anexo</th>
                  <th className="p-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {atas.map(a => (
                  <tr key={a.id} className="border-t">
                    <td className="p-2">{a.tipo}</td>
                    <td className="p-2">{a.numero}</td>
                    <td className="p-2">{formatDateBR(a.inicioVigencia)}</td>
                    <td className="p-2">{formatDateBR(a.fimVigencia)}</td>
                    <td className="p-2">{a.observacoes || '-'}</td>
                    <td className="p-2">
                      {a.anexo ? <a href={a.anexo.data} target="_blank" rel="noreferrer" className="link-primary">{a.anexo.name}</a> : '-'}
                    </td>
                    <td className="p-2">
                      <button onClick={() => removeAta(a.id)} className="btn text-xs" style={{ backgroundColor: 'var(--color-error)', color: '#fff' }}>Remover</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <strong>Contratante</strong>
          <div className="mt-1">{model.contratante?.nome || model.contratado || model.empresa?.razaoSocial || '-'}</div>
        </div>
        <div>
          <strong>Número do Pregão</strong>
          <div className="mt-1">{model.numeroPregao || '-'}</div>
        </div>
        <div>
          <strong>Número do Processo</strong>
          <div className="mt-1">{model.numeroProcesso || '-'}</div>
        </div>
        <div>
          <strong>Portal</strong>
          <div className="mt-1">{model.portal || '-'}</div>
        </div>
        <div>
          <strong>Data de Credenciamento</strong>
          <div className="mt-1">{formatDateTimeBR(model.dataCredenciamento, model.horaCredenciamento)}</div>
        </div>
        <div>
          <strong>Data da Licitação</strong>
          <div className="mt-1">{formatDateTimeBR(model.dataLicitacao, model.horaLicitacao)}</div>
        </div>
        <div>
          <strong>Tipo Objeto</strong>
          <div className="mt-1">{model.tipoObjeto || '-'}</div>
        </div>
      </div>

      <div className="mt-4">
        <strong>Objeto Licitação</strong>
        <div className="mt-1 whitespace-pre-wrap">{model.objetoLicitacao || '-'}</div>
      </div>

      <div className="mt-6">
        <h4 className="font-semibold">Habilitação (Checklist)</h4>
        {model.habilitacao ? (
          <>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2">
              {HABILITACAO_ITEMS.map(({ key, label }) => {
                const checked = !!model.habilitacao[key]
                return (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <span className={checked ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                      {checked ? '✓' : '—'}
                    </span>
                    <span className={checked ? 'text-gray-800' : 'text-gray-500'}>{label}</span>
                  </div>
                )
              })}
            </div>
            {model.habilitacao.outras && model.habilitacao.outrasTexto && (
              <div className="mt-3 text-sm">
                <strong className="text-gray-700">Outras declarações: </strong>
                <span className="text-gray-700">{model.habilitacao.outrasTexto}</span>
              </div>
            )}
            {model.habilitacao.observacaoInterna && (
              <div className="mt-2 text-sm">
                <strong className="text-gray-700">Observação interna: </strong>
                <span className="text-gray-700">{model.habilitacao.observacaoInterna}</span>
              </div>
            )}
          </>
        ) : <div className="text-sm text-gray-500 mt-2">Sem dados de habilitação</div>}
      </div>

      <div className="mt-6">
        <h4 className="font-semibold">Proposta</h4>
        <div className="mt-2 grid grid-cols-3 gap-4">
          <div>
            <strong>Validade da Proposta</strong>
            <div className="mt-1">{model.prazoValidade || '-'}</div>
          </div>
          <div>
            <strong>Prazo de Entrega</strong>
            <div className="mt-1">{model.prazoEntrega || '-'}</div>
          </div>
          <div>
            <strong>Local de Entrega</strong>
            <div className="mt-1">{model.localEntrega || '-'}</div>
          </div>
          <div>
            <strong>Prazo de Pagamento</strong>
            <div className="mt-1">{model.prazoPagamento || '-'}</div>
          </div>
          <div>
            <strong>Prazo de Garantia</strong>
            <div className="mt-1">{model.prazoGarantia || 'Conforme Edital'}</div>
          </div>
          <div>
            <strong>Vigência do Contrato</strong>
            <div className="mt-1">{model.vigenciaContrato || '12 (doze) meses'}</div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h4 className="font-semibold">Itens</h4>
        {items.length === 0 ? (
          <div className="text-sm text-gray-500 mt-2">Nenhum item importado</div>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 whitespace-nowrap">
                  {hasLotes && <th className="p-2">Lote</th>}
                  <th className="p-2">Item</th>
                  <th className="p-2">Descrição</th>
                  <th className="p-2">Uni</th>
                  <th className="p-2">Qtd</th>
                  <th className="p-2">Valor Edital</th>
                  <th className="p-2">Total</th>
                  <th className="p-2">Marca</th>
                  <th className="p-2">Apresentação</th>
                  <th className="p-2">Nº Anvisa</th>
                  <th className="p-2">Valor Custo</th>
                  <th className="p-2">TX</th>
                  <th className="p-2">Custo + TX (Uni)</th>
                  <th className="p-2">Total Custo</th>
                  <th className="p-2">Custo Caixa</th>
                  <th className="p-2">Vencedor</th>
                  <th className="p-2">Valor Ganho</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const isEditing = editingItemIndex === idx
                  return (
                    <React.Fragment key={idx}>
                      <tr
                        className={`border-t whitespace-nowrap cursor-pointer hover:bg-gray-50 ${isEditing ? 'bg-indigo-50' : ''}`}
                        onClick={() => { if (!isEditing) startEditItem(idx) }}
                        title="Clique para editar este item"
                      >
                        {hasLotes && <td className="p-2">{it.lote || '-'}</td>}
                        <td className="p-2">{it.item ?? idx + 1}</td>
                        <td className="p-2 whitespace-normal">
                          {(() => {
                            const desc = it.descricao || it.description || '-'
                            return desc === '-' || desc.length <= 30 ? desc : desc.slice(0, 30) + '…'
                          })()}
                        </td>
                        <td className="p-2">{it.unidade || '-'}</td>
                        <td className="p-2">{formatNumeric(it.quantidade ?? it.qty)}</td>
                        <td className="p-2">{formatNumeric(it.valorEdital)}</td>
                        <td className="p-2">{formatNumeric(it.totalEdital)}</td>
                        <td className="p-2">{it.marca || '-'}</td>
                        <td className="p-2">{it.apresentacao || '-'}</td>
                        <td className="p-2">{it.anvisa || '-'}</td>
                        <td className="p-2">{formatNumeric(it.valorCusto)}</td>
                        <td className="p-2">{formatNumeric(it.tx)}</td>
                        <td className="p-2">{formatNumeric(it.custoUnitario)}</td>
                        <td className="p-2">{formatNumeric(it.totalCusto)}</td>
                        <td className="p-2">{formatNumeric(it.custoCaixa)}</td>
                        <td className="p-2" onClick={e => e.stopPropagation()}>
                          {it.vencedor ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-white px-2 py-1 rounded-full" style={{ backgroundColor: '#15803d' }}>✓ Vencedor</span>
                              <button
                                onClick={async () => {
                                  const key = `items_${model.codigo}`
                                  const { dbUpdate } = await import('../../utils/db')
                                  const list = await dbUpdate<any[]>(key, (current) => {
                                    const next = [...(current || [])]
                                    next[idx] = { ...(next[idx] || {}), vencedor: false }
                                    return next
                                  })
                                  setItems(list)
                                  try {
                                    const { auditLog } = await import('../../utils/audit')
                                    const user = localStorage.getItem('user_name') || undefined
                                    await auditLog('item_mark_winner', { codigo: model.codigo, itemIndex: idx, vencedor: false, descricao: list[idx].descricao }, user)
                                  } catch (err) { /* ignore */ }
                                }}
                                className="text-xs text-gray-400 hover:text-gray-600 underline"
                              >
                                desmarcar
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={async () => {
                                const key = `items_${model.codigo}`
                                const { dbUpdate } = await import('../../utils/db')
                                const list = await dbUpdate<any[]>(key, (current) => {
                                  const next = [...(current || [])]
                                  next[idx] = { ...(next[idx] || {}), vencedor: true }
                                  return next
                                })
                                setItems(list)
                                setEditingValorGanhoIdx(idx)
                                try {
                                  const { auditLog } = await import('../../utils/audit')
                                  const user = localStorage.getItem('user_name') || undefined
                                  await auditLog('item_mark_winner', { codigo: model.codigo, itemIndex: idx, vencedor: true, descricao: list[idx].descricao }, user)
                                } catch (err) { /* ignore */ }
                              }}
                              className="btn btn-ghost text-xs px-3 py-1.5 font-medium"
                            >
                              Venceu
                            </button>
                          )}
                        </td>
                        <td className="p-2" onClick={e => e.stopPropagation()}>
                          {!it.vencedor ? (
                            <span className="text-sm text-gray-400">—</span>
                          ) : editingValorGanhoIdx === idx || !it.valorGanho ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="0,00"
                                autoFocus={editingValorGanhoIdx === idx}
                                value={valorGanhoDraft[idx] ?? it.valorGanho ?? ''}
                                onChange={e => setValorGanhoDraft(d => ({ ...d, [idx]: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') saveValorGanho(idx, (e.target as HTMLInputElement).value) }}
                                className="w-24 p-1 rounded text-sm"
                              />
                              <button
                                onClick={() => saveValorGanho(idx, valorGanhoDraft[idx] ?? it.valorGanho ?? '')}
                                className="btn btn-primary text-xs px-2 py-1"
                              >
                                OK
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-800">{it.valorGanho}</span>
                              <button
                                onClick={() => setEditingValorGanhoIdx(idx)}
                                className="text-xs text-gray-400 hover:text-gray-600 underline"
                              >
                                editar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {isEditing && (
                        <tr className="bg-indigo-50/40 border-t">
                          <td colSpan={hasLotes ? 17 : 16} className="p-4" onClick={e => e.stopPropagation()}>
                            <div className="grid grid-cols-4 gap-3">
                              {ITEM_FIELDS.map(f => (
                                <div key={f.key} className={f.wide ? 'col-span-2' : ''}>
                                  <label className="block text-xs text-gray-600">{f.label}</label>
                                  {f.key === 'descricao' ? (
                                    <textarea
                                      value={editItemDraft?.[f.key] ?? ''}
                                      onChange={e => setEditItemDraft((d: any) => ({ ...d, [f.key]: e.target.value }))}
                                      className="w-full p-1.5 rounded text-sm"
                                      rows={2}
                                    />
                                  ) : (
                                    <input
                                      value={editItemDraft?.[f.key] ?? ''}
                                      onChange={e => {
                                        const val = e.target.value
                                        setEditItemDraft((d: any) => {
                                          const next = { ...d, [f.key]: val }
                                          // Custo + TX (Uni) e Total Custo são recalculados em cascata ao
                                          // mudar Valor Custo/TX/Qtd, mas continuam campos normais — dá pra
                                          // sobrescrever manualmente depois.
                                          if (f.key === 'valorCusto' || f.key === 'tx') {
                                            const calculado = calcCustoUnitario(next.valorCusto, next.tx)
                                            if (calculado !== '') next.custoUnitario = calculado
                                          }
                                          if (f.key === 'valorCusto' || f.key === 'tx' || f.key === 'quantidade' || f.key === 'custoUnitario') {
                                            const calculadoTotal = calcTotalCusto(next.custoUnitario, next.quantidade)
                                            if (calculadoTotal !== '') next.totalCusto = calculadoTotal
                                          }
                                          return next
                                        })
                                      }}
                                      className="w-full p-1.5 rounded text-sm"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 flex gap-2">
                              <button onClick={() => saveEditItem(idx)} className="btn btn-primary text-sm">Salvar</button>
                              <button onClick={cancelEditItem} className="btn btn-ghost text-sm">Cancelar</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DeclaracoesSection modelo={model} />

      <div className="mt-6">
        <h4 className="font-semibold">Anexos</h4>
        <div className="mt-2">
          <button onClick={() => setOpenAttachments(true)} className="btn btn-ghost">Gerenciar Anexos</button>
        </div>
        {attachments.length === 0 ? (
          <div className="text-sm text-gray-500 mt-2">Nenhum anexo</div>
        ) : (
          <ul className="mt-2 list-disc ml-5">
            {attachments.map((a, i) => (
              <li key={i} className="text-sm">
                {a.name || `anexo-${i}`}
                {a.data && <a className="ml-2 link-primary" href={a.data} target="_blank" rel="noreferrer">Abrir</a>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 flex gap-2">
        <button onClick={() => {
          if (!printRef.current) return
          printElement(printRef.current, `Checklist — Licitação ${model.codigo}`)
        }} className="btn btn-primary">Imprimir Checklist</button>
        <button onClick={async () => {
          if (!itemsRef.current) return
          await exportElementsToPdf([itemsRef.current], `itens_${model.codigo}.pdf`, 'Itens')
        }} className="btn btn-primary">Exportar Itens (PDF)</button>
      </div>

      {/* hidden printable DOM */}
      <div style={{ position: 'absolute', left: -9999 }} aria-hidden>
        <PrintableChecklist modelo={model} codigo={model.codigo} user={user} habilitacao={model.habilitacao} page1Ref={printRef} page2Ref={itemsRef} items={items} attachments={attachments} />
      </div>

      <AttachmentsModal open={openAttachments} onClose={async () => {
        setOpenAttachments(false)
        try {
          const { dbGet } = await import('../../utils/db')
          const rawAt = (await dbGet(`attachments_${model.codigo}`)) || []
          setAttachments(rawAt)
        } catch (err) { /* ignore */ }
      }} codigo={Number(model.codigo)} />

      <AtaContratoModal
        open={showAtaModal}
        onClose={() => setShowAtaModal(false)}
        onSave={saveAta}
        criadoPor={user?.name}
      />
    </div>
  )
}
