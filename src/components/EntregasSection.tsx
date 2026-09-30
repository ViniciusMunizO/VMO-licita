import React, { useEffect, useState } from 'react'
import { listEntregasByItemIds, addEntrega, removeEntrega, Entrega } from '../utils/entregas'
import { formatNumeric } from '../utils/format'
import { DateInputBR } from './DateTimeBR'
import { confirmarRemocao } from '../utils/confirmar'

const FORM_VAZIO = { quantidade: '', data: '', notaFiscal: '' }

// Só itens vencedores entram aqui — antes de ganhar não existe "entrega" pra
// controlar, e um item perdido/desclassificado nunca vira remessa.
export default function EntregasSection({ itensVencedores }: { itensVencedores: any[] }) {
  const [entregasPorItem, setEntregasPorItem] = useState<Record<string, Entrega[]>>({})
  const [abertoItemId, setAbertoItemId] = useState<string | null>(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const ids = itensVencedores.map(it => it.id)
  const idsKey = ids.join(',')

  useEffect(() => {
    if (ids.length === 0) { setEntregasPorItem({}); return }
    let mounted = true
    listEntregasByItemIds(ids).then(m => {
      if (mounted) setEntregasPorItem(m)
    }).catch(() => {
      if (mounted) setErro('Não consegui carregar as entregas registradas.')
    })
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  if (itensVencedores.length === 0) return null

  const abrirForm = (itemId: string) => {
    setAbertoItemId(itemId)
    setForm(FORM_VAZIO)
    setErro('')
  }

  const salvar = async (e: React.FormEvent, itemId: string) => {
    e.preventDefault()
    const qtd = Number(form.quantidade.replace(',', '.'))
    if (!form.quantidade || !Number.isFinite(qtd) || qtd <= 0) {
      setErro('Informe uma quantidade válida.')
      return
    }
    setErro('')
    setSalvando(true)
    try {
      await addEntrega(itemId, {
        quantidade: qtd,
        data: form.data || undefined,
        notaFiscal: form.notaFiscal || undefined,
      })
      setEntregasPorItem(await listEntregasByItemIds(ids))
      setAbertoItemId(null)
    } catch (err: any) {
      setErro(err?.message || 'Não consegui registrar a entrega.')
    } finally {
      setSalvando(false)
    }
  }

  const remover = async (entregaId: string) => {
    if (!confirmarRemocao('este registro de entrega')) return
    setErro('')
    try {
      await removeEntrega(entregaId)
      setEntregasPorItem(await listEntregasByItemIds(ids))
    } catch (err: any) {
      setErro(err?.message || 'Não consegui remover o registro de entrega.')
    }
  }

  return (
    <div className="mt-6 bg-white border rounded p-4">
      <h4 className="font-semibold mb-1">Entregas</h4>
      <p className="text-sm text-gray-500 mb-4">Controle do que já foi entregue de cada item vencedor, comparado com a quantidade contratada.</p>
      {erro && <p role="alert" className="text-sm mb-3" style={{ color: 'var(--color-error-text)' }}>{erro}</p>}

      <div className="space-y-3">
        {itensVencedores.map(it => {
          const entregas = entregasPorItem[it.id] || []
          const entregue = entregas.reduce((s, e) => s + (Number(e.quantidade) || 0), 0)
          const contratado = Number(it.quantidade) || 0
          const completo = contratado > 0 && entregue >= contratado

          return (
            <div key={it.id} className="border-t pt-3 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{it.descricao || 'Item sem descrição'}</div>
                  <div className="text-xs font-medium" style={{ color: completo ? '#15803d' : '#b45309' }}>
                    Entregue: {formatNumeric(entregue, 0)} de {formatNumeric(contratado, 0)} {it.unidade || ''}
                  </div>
                </div>
                <button type="button" onClick={() => abrirForm(it.id)} className="btn btn-ghost text-xs">+ Registrar entrega</button>
              </div>

              {entregas.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {entregas.map(e => (
                    <li key={e.id} className="flex justify-between items-center gap-2 text-xs text-gray-600">
                      <span>
                        {formatNumeric(e.quantidade, 0)} {it.unidade || ''}
                        {e.data ? ` em ${e.data.split('-').reverse().join('/')}` : ''}
                        {e.notaFiscal ? ` — NF ${e.notaFiscal}` : ''}
                      </span>
                      <button type="button" onClick={() => remover(e.id)} className="text-gray-400 hover:text-gray-600 underline flex-shrink-0">remover</button>
                    </li>
                  ))}
                </ul>
              )}

              {abertoItemId === it.id && (
                <form onSubmit={e => salvar(e, it.id)} className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 items-end bg-gray-50 p-2 rounded">
                  <div>
                    <label htmlFor={`entrega-qtd-${it.id}`} className="block text-xs text-gray-600">Quantidade</label>
                    <input id={`entrega-qtd-${it.id}`} value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} className="w-full p-1.5 rounded text-sm" />
                  </div>
                  <div>
                    <label htmlFor={`entrega-data-${it.id}`} className="block text-xs text-gray-600">Data</label>
                    <DateInputBR id={`entrega-data-${it.id}`} value={form.data} onChange={v => setForm(f => ({ ...f, data: v }))} className="w-full p-1.5 rounded text-sm" />
                  </div>
                  <div>
                    <label htmlFor={`entrega-nf-${it.id}`} className="block text-xs text-gray-600">Nota Fiscal</label>
                    <input id={`entrega-nf-${it.id}`} value={form.notaFiscal} onChange={e => setForm(f => ({ ...f, notaFiscal: e.target.value }))} className="w-full p-1.5 rounded text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={salvando} className="btn btn-primary text-xs disabled:opacity-50">{salvando ? 'Salvando...' : 'Salvar'}</button>
                    <button type="button" onClick={() => setAbertoItemId(null)} className="btn btn-ghost text-xs">Cancelar</button>
                  </div>
                </form>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
