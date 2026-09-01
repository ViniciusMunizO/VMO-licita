import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { exportElementsToPdf } from '../../utils/pdf'
import { formatDateTimeBR, formatDateBR } from '../../utils/date'
import { formatNumeric, calcTotalCusto, calcValorUnitMinimo, calcValorTotalMinimo, calcValorTotalMunicipio } from '../../utils/format'
import AttachmentsModal from '../../components/AttachmentsModal'
import AtaContratoModal, { Ata } from '../../components/AtaContratoModal'
import DeclaracoesSection from '../../components/DeclaracoesSection'
import PrintableChecklist from '../../components/PrintableChecklist'
import PrintableProposta from '../../components/PrintableProposta'
import { setLancadoNoKralen } from '../../utils/kralen'
import { getLicitacao } from '../../utils/licitacoes'
import { listItems, updateItem } from '../../utils/items'
import { listAttachments } from '../../utils/attachments'
import { listAtas, addAta, removeAta as removeAtaApi } from '../../utils/atas'
import { getEmpresaInfo } from '../../utils/empresa'
import { auditLog } from '../../utils/audit'
import StatusBadge from '../../components/StatusBadge'

// Limite de caracteres do motivo de desclassificação — grande o suficiente
// pra uma explicação de verdade (o exemplo real do cliente tem ~140
// caracteres), mas evita que um texto absurdamente longo pese na gravação
// no banco, estoure a célula da tabela nos relatórios ou infle o PDF.
const MOTIVO_MAX_LENGTH = 500

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
  { key: 'codKralen', label: 'Cód. Kralen' },
  { key: 'descricao', label: 'Descrição', wide: true },
  { key: 'unidade', label: 'Uni' },
  { key: 'quantidade', label: 'Qtd' },
  { key: 'marca', label: 'Marca' },
  { key: 'origemCotacao', label: 'Origem Cotação', wide: true },
  { key: 'valorCusto', label: 'Valor Custo' },
  { key: 'totalCusto', label: 'Total Custo' },
  { key: 'valorUnitMinimo', label: 'Valor Unit. Mínimo' },
  { key: 'valorTotalMinimo', label: 'Valor Total Mínimo' },
  { key: 'valorUnitMunicipio', label: 'Valor Unit. Município' },
  { key: 'valorTotalMunicipio', label: 'Valor Total Município' },
  { key: 'status', label: 'Status' },
]

export default function DetailLicitacao() {
  const { codigo } = useParams()
  const nav = useNavigate()
  const [model, setModel] = useState<any>(null)
  const [attachments, setAttachments] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [atas, setAtas] = useState<Ata[]>([])
  const [empresa, setEmpresa] = useState<any>(null)
  const printRef = useRef<HTMLDivElement | null>(null)
  const itemsRef = useRef<HTMLDivElement | null>(null)
  const propostaRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const found = await getLicitacao(codigo!)
      if (!mounted) return
      setModel(found || null)
      // load attachments, items and atas/contratos
      try {
        const [rawAt, rawIt, rawAtas, rawEmpresa] = await Promise.all([
          listAttachments(codigo!),
          listItems(codigo!),
          listAtas(codigo!),
          getEmpresaInfo(),
        ])
        if (mounted) {
          setAttachments(rawAt)
          setItems(rawIt)
          setAtas(rawAtas)
          setEmpresa(rawEmpresa)
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
    const updated = await addAta(codigo!, ata)
    setAtas(updated)
    try {
      const auditUser = localStorage.getItem('user_name') || undefined
      await auditLog('ata_create', { codigo, tipo: ata.tipo, numero: ata.numero }, auditUser)
    } catch (err) { /* ignore */ }
  }

  const removeAta = async (id: string) => {
    const list = await removeAtaApi(id, codigo!)
    setAtas(list)
  }
  const toggleKralen = async (checked: boolean) => {
    const userName = localStorage.getItem('user_name') || undefined
    const list = await setLancadoNoKralen(model.codigo, checked, userName)
    const found = list.find((x: any) => String(x.codigo) === String(model.codigo))
    if (found) setModel(found)
  }

  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null)
  const [editItemDraft, setEditItemDraft] = useState<any>(null)
  const [valorGanhoDraft, setValorGanhoDraft] = useState<Record<number, string>>({})
  const [editingValorGanhoIdx, setEditingValorGanhoIdx] = useState<number | null>(null)

  const saveValorGanho = async (idx: number, valor: string) => {
    const atualizado = await updateItem(items[idx].id, { valorGanho: valor })
    const list = [...items]; list[idx] = atualizado
    setItems(list)
    setValorGanhoDraft(d => { const next = { ...d }; delete next[idx]; return next })
    // sai do modo de edição — o valor salvo aparece como texto fixo, o que
    // deixa claro pra quem usa que o "OK" realmente gravou algo.
    setEditingValorGanhoIdx(current => (current === idx ? null : current))
    try {
      const user = localStorage.getItem('user_name') || undefined
      await auditLog('item_valor_ganho', { codigo: model.codigo, itemIndex: idx, valorGanho: valor, descricao: list[idx].descricao }, user)
    } catch (err) { /* ignore */ }
  }

  const [motivoDraft, setMotivoDraft] = useState<Record<number, string>>({})
  const [editingMotivoIdx, setEditingMotivoIdx] = useState<number | null>(null)

  // Desclassificar e Vencedor são mutuamente exclusivos — um item desclassificado
  // nunca chegou a disputar, então marcar um limpa o outro.
  const marcarDesclassificado = async (idx: number) => {
    const atualizado = await updateItem(items[idx].id, { desclassificado: true, vencedor: false })
    const list = [...items]; list[idx] = atualizado
    setItems(list)
    setEditingMotivoIdx(idx)
    try {
      const user = localStorage.getItem('user_name') || undefined
      await auditLog('item_desclassificar', { codigo: model.codigo, itemIndex: idx, descricao: list[idx].descricao }, user)
    } catch (err) { /* ignore */ }
  }

  const reverterDesclassificacao = async (idx: number) => {
    const atualizado = await updateItem(items[idx].id, { desclassificado: false })
    const list = [...items]; list[idx] = atualizado
    setItems(list)
  }

  const saveMotivo = async (idx: number, motivo: string) => {
    const motivoLimitado = motivo.slice(0, MOTIVO_MAX_LENGTH)
    const atualizado = await updateItem(items[idx].id, { motivoDesclassificacao: motivoLimitado })
    const list = [...items]; list[idx] = atualizado
    setItems(list)
    setMotivoDraft(d => { const next = { ...d }; delete next[idx]; return next })
    setEditingMotivoIdx(current => (current === idx ? null : current))
    try {
      const user = localStorage.getItem('user_name') || undefined
      await auditLog('item_motivo_desclassificacao', { codigo: model.codigo, itemIndex: idx, motivo: motivoLimitado, descricao: list[idx].descricao }, user)
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
    const atualizado = await updateItem(items[idx].id, editItemDraft)
    const list = [...items]; list[idx] = atualizado
    setItems(list)
    setEditingItemIndex(null)
    setEditItemDraft(null)
    try {
      const auditUser = localStorage.getItem('user_name') || undefined
      await auditLog('item_edit', { codigo: model.codigo, itemIndex: idx, descricao: list[idx].descricao }, auditUser)
    } catch (err) { /* ignore */ }
  }

  const hasLotes = items.some(it => it.lote)

  if (!model) return (
    <div className="bg-white p-6 rounded shadow max-w-5xl mx-auto">
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
          <StatusBadge status={model.status} />
          <label className="flex items-center gap-2 text-sm font-normal text-gray-600">
            <input type="checkbox" checked={!!model.lancadoNoKralen} onChange={e => toggleKralen(e.target.checked)} />
            Lançada no Kralen
          </label>
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
                  <th className="p-2">Cód. Kralen</th>
                  <th className="p-2">Marca</th>
                  <th className="p-2">Origem Cotação</th>
                  <th className="p-2">Valor Custo</th>
                  <th className="p-2">Total Custo</th>
                  <th className="p-2">Valor Mínimo</th>
                  <th className="p-2">Total Mínimo</th>
                  <th className="p-2">Valor Município</th>
                  <th className="p-2">Total Município</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Resultado</th>
                  <th className="p-2">Valor Ganho / Motivo</th>
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
                        <td className="p-2">{it.codKralen || '-'}</td>
                        <td className="p-2">{it.marca || '-'}</td>
                        <td className="p-2">{it.origemCotacao || '-'}</td>
                        <td className="p-2">{formatNumeric(it.valorCusto)}</td>
                        <td className="p-2">{formatNumeric(it.totalCusto)}</td>
                        <td className="p-2">{formatNumeric(it.valorUnitMinimo)}</td>
                        <td className="p-2">{formatNumeric(it.valorTotalMinimo)}</td>
                        <td className="p-2">{formatNumeric(it.valorUnitMunicipio)}</td>
                        <td className="p-2">{formatNumeric(it.valorTotalMunicipio)}</td>
                        <td className="p-2">{it.status || '-'}</td>
                        <td className="p-2" onClick={e => e.stopPropagation()}>
                          {it.desclassificado ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-white px-2 py-1 rounded-full" style={{ backgroundColor: 'var(--color-error)' }}>✕ Desclassificado</span>
                              <button
                                onClick={() => reverterDesclassificacao(idx)}
                                className="text-xs text-gray-400 hover:text-gray-600 underline"
                              >
                                desmarcar
                              </button>
                            </div>
                          ) : it.vencedor ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-white px-2 py-1 rounded-full" style={{ backgroundColor: '#15803d' }}>✓ Vencedor</span>
                              <button
                                onClick={async () => {
                                  const atualizado = await updateItem(items[idx].id, { vencedor: false })
                                  const list = [...items]; list[idx] = atualizado
                                  setItems(list)
                                  try {
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
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  const atualizado = await updateItem(items[idx].id, { vencedor: true })
                                  const list = [...items]; list[idx] = atualizado
                                  setItems(list)
                                  setEditingValorGanhoIdx(idx)
                                  try {
                                    const user = localStorage.getItem('user_name') || undefined
                                    await auditLog('item_mark_winner', { codigo: model.codigo, itemIndex: idx, vencedor: true, descricao: list[idx].descricao }, user)
                                  } catch (err) { /* ignore */ }
                                }}
                                className="btn btn-ghost text-xs px-3 py-1.5 font-medium"
                              >
                                Venceu
                              </button>
                              <button
                                onClick={() => marcarDesclassificado(idx)}
                                className="btn btn-ghost text-xs px-3 py-1.5 font-medium"
                                style={{ color: 'var(--color-error)' }}
                              >
                                Desclassificar
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="p-2" onClick={e => e.stopPropagation()}>
                          {it.desclassificado ? (
                            editingMotivoIdx === idx || !it.motivoDesclassificacao ? (
                              <div className="flex items-center gap-1">
                                <div className="flex flex-col">
                                  <input
                                    type="text"
                                    placeholder="Motivo da desclassificação"
                                    autoFocus={editingMotivoIdx === idx}
                                    maxLength={MOTIVO_MAX_LENGTH}
                                    value={motivoDraft[idx] ?? it.motivoDesclassificacao ?? ''}
                                    onChange={e => setMotivoDraft(d => ({ ...d, [idx]: e.target.value }))}
                                    onKeyDown={e => { if (e.key === 'Enter') saveMotivo(idx, (e.target as HTMLInputElement).value) }}
                                    className="w-48 p-1 rounded text-sm"
                                  />
                                  <span className="text-[10px] text-gray-400 mt-0.5">
                                    {(motivoDraft[idx] ?? it.motivoDesclassificacao ?? '').length}/{MOTIVO_MAX_LENGTH}
                                  </span>
                                </div>
                                <button
                                  onClick={() => saveMotivo(idx, motivoDraft[idx] ?? it.motivoDesclassificacao ?? '')}
                                  className="btn btn-primary text-xs px-2 py-1"
                                >
                                  OK
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-800 break-words" title={it.motivoDesclassificacao}>
                                  {it.motivoDesclassificacao.length > 40 ? it.motivoDesclassificacao.slice(0, 40) + '…' : it.motivoDesclassificacao}
                                </span>
                                <button
                                  onClick={() => setEditingMotivoIdx(idx)}
                                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                                >
                                  editar
                                </button>
                              </div>
                            )
                          ) : !it.vencedor ? (
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
                                          // Total Custo, Valor Unit. Mínimo (sugerido a partir do Custo +
                                          // margem padrão) e os totais de Mínimo/Município são recalculados
                                          // em cascata, mas continuam campos normais — dá pra sobrescrever
                                          // manualmente depois.
                                          if (f.key === 'valorCusto' || f.key === 'quantidade') {
                                            const totalCusto = calcTotalCusto(next.valorCusto, next.quantidade)
                                            if (totalCusto !== '') next.totalCusto = totalCusto
                                            const valorUnitMinimo = calcValorUnitMinimo(next.valorCusto)
                                            if (valorUnitMinimo !== '') next.valorUnitMinimo = valorUnitMinimo
                                          }
                                          if (f.key === 'valorCusto' || f.key === 'quantidade' || f.key === 'valorUnitMinimo') {
                                            const valorTotalMinimo = calcValorTotalMinimo(next.valorUnitMinimo, next.quantidade)
                                            if (valorTotalMinimo !== '') next.valorTotalMinimo = valorTotalMinimo
                                          }
                                          if (f.key === 'valorUnitMunicipio' || f.key === 'quantidade') {
                                            const valorTotalMunicipio = calcValorTotalMunicipio(next.valorUnitMunicipio, next.quantidade)
                                            if (valorTotalMunicipio !== '') next.valorTotalMunicipio = valorTotalMunicipio
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
          await exportElementsToPdf([itemsRef.current], `itens_${model.codigo}.pdf`, 'Itens', 'landscape')
        }} className="btn btn-primary">Exportar Itens (PDF)</button>
        <button onClick={async () => {
          if (!propostaRef.current) return
          await exportElementsToPdf([propostaRef.current], `proposta_${model.codigo}.pdf`, 'Proposta de Preços')
          try {
            const userName = localStorage.getItem('user_name') || undefined
            await auditLog('proposta_emitida', { codigo: model.codigo }, userName)
          } catch (err) { /* ignore */ }
        }} className="btn btn-primary">Emitir Proposta (PDF)</button>
      </div>

      {/* hidden printable DOM */}
      <div style={{ position: 'absolute', left: -9999 }} aria-hidden>
        <PrintableChecklist modelo={model} codigo={model.codigo} user={user} habilitacao={model.habilitacao} page1Ref={printRef} page2Ref={itemsRef} items={items} attachments={attachments} />
        <PrintableProposta modelo={model} items={items} empresa={empresa} pageRef={propostaRef} />
      </div>

      <AttachmentsModal open={openAttachments} onClose={async () => {
        setOpenAttachments(false)
        try {
          const rawAt = await listAttachments(model.codigo)
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
