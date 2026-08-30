import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { listLicitacoes } from '../../utils/licitacoes'
import { listItems } from '../../utils/items'
import { formatDateTimeBR, splitLegacyDateTime, nowInBrasilia, addMonthsToDate } from '../../utils/date'
import { DateInputBR } from '../../components/DateTimeBR'
import { formatNumeric, formatFixed } from '../../utils/format'
import { agruparPorLote, somaColuna } from '../../utils/itens'
import { setLancadoNoKralen } from '../../utils/kralen'
import { exportElementsToPdf } from '../../utils/pdf'

type LicitacaoGanha = {
  licitacao: any
  itensVencedores: any[]
}

type Periodo = 'todos' | '1m' | '3m' | '6m' | '1a' | 'custom'

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'todos', label: 'Todo o período' },
  { id: '1m', label: 'Último mês' },
  { id: '3m', label: 'Últimos 3 meses' },
  { id: '6m', label: 'Últimos 6 meses' },
  { id: '1a', label: 'Último ano' },
  { id: 'custom', label: 'Data específica' },
]

// Início do intervalo pra cada período pré-definido, contado a partir de
// hoje — "custom" usa as datas escolhidas manualmente, tratado à parte.
function inicioParaPeriodo(periodo: Periodo, hoje: string): string {
  switch (periodo) {
    case '1m': return addMonthsToDate(hoje, -1)
    case '3m': return addMonthsToDate(hoje, -3)
    case '6m': return addMonthsToDate(hoje, -6)
    case '1a': return addMonthsToDate(hoje, -12)
    default: return ''
  }
}

function formatMoneyBRL(value: number): string {
  return `R$ ${formatFixed(value)}`
}

function contratanteNome(l: any) {
  return l.contratante?.nome || l.contratado || l.empresa?.razaoSocial || 'Sem contratante'
}

function contratanteUf(l: any) {
  return l.contratante?.uf || ''
}

// % de margem sobre o custo, na mesma fórmula do relatório real do sistema
// atual (ex.: Vlr Ganho 24.697,53 / Custo 20.280,00 → 21,78%).
function margemPercentual(valorGanho: number, custo: number): number | null {
  if (!custo) return null
  return (valorGanho / custo - 1) * 100
}

const COLS: { width: string }[] = [
  { width: '6%' }, { width: '9%' }, { width: '6%' }, { width: '19%' }, { width: '13%' },
  { width: '17%' }, { width: '7%' }, { width: '8%' }, { width: '8%' }, { width: '7%' },
]

function Colgroup() {
  return <colgroup>{COLS.map((c, i) => <col key={i} style={{ width: c.width }} />)}</colgroup>
}

function TotalRow({ label, itens }: { label: string; itens: any[] }) {
  const qtd = somaColuna(itens, 'quantidade')
  const custo = somaColuna(itens, 'totalCusto')
  const ganho = somaColuna(itens, 'valorGanho')
  const margem = margemPercentual(ganho, custo)
  return (
    <tr className="bg-gray-50 font-semibold">
      <td className="p-1.5 text-right" colSpan={6}>{label}</td>
      <td className="p-1.5 text-right">{formatNumeric(qtd, 0)}</td>
      <td className="p-1.5 text-right">{formatFixed(custo)}</td>
      <td className="p-1.5 text-right">{formatFixed(ganho)}</td>
      <td className="p-1.5 text-right">{margem === null ? '-' : `${formatFixed(margem)}%`}</td>
    </tr>
  )
}

export default function RelatorioGanhos() {
  const [loading, setLoading] = useState(true)
  const [licitacoes, setLicitacoes] = useState<any[]>([])
  const [itemsByCodigo, setItemsByCodigo] = useState<Record<string, any[]>>({})
  const [filtro, setFiltro] = useState<'naoLancados' | 'todos'>('naoLancados')
  const [periodo, setPeriodo] = useState<Periodo>('todos')
  const [dataInicioCustom, setDataInicioCustom] = useState('')
  const [dataFimCustom, setDataFimCustom] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hoje = nowInBrasilia().date

  const load = async () => {
    const list = await listLicitacoes()
    setLicitacoes(list)
    const entries = await Promise.all(list.map(async (l: any) => {
      const items = await listItems(l.codigo)
      return [String(l.codigo), items] as const
    }))
    setItemsByCodigo(Object.fromEntries(entries))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggleKralen = async (codigo: number, checked: boolean) => {
    const userName = localStorage.getItem('user_name') || undefined
    const list = await setLancadoNoKralen(codigo, checked, userName)
    setLicitacoes(list)
  }

  const dentroDoPeriodo = (l: any): boolean => {
    if (periodo === 'todos') return true
    const dataLic = splitLegacyDateTime(l.dataLicitacao).date
    if (!dataLic) return false
    const inicio = periodo === 'custom' ? dataInicioCustom : inicioParaPeriodo(periodo, hoje)
    const fim = periodo === 'custom' ? (dataFimCustom || hoje) : hoje
    if (inicio && dataLic < inicio) return false
    if (fim && dataLic > fim) return false
    return true
  }

  const ganhos: LicitacaoGanha[] = licitacoes
    .map(l => ({ licitacao: l, itensVencedores: (itemsByCodigo[String(l.codigo)] || []).filter((it: any) => it.vencedor) }))
    .filter(g => g.itensVencedores.length > 0)
    .filter(g => filtro === 'todos' || !g.licitacao.lancadoNoKralen)
    .filter(g => dentroDoPeriodo(g.licitacao))

  const todosItensVencedores = ganhos.flatMap(g => g.itensVencedores)
  const totalCustoGeral = somaColuna(todosItensVencedores, 'totalCusto')
  const totalGanhoGeral = somaColuna(todosItensVencedores, 'valorGanho')
  const margemGeralValor = margemPercentual(totalGanhoGeral, totalCustoGeral)

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Mostrar:</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setFiltro('naoLancados')} className={filtro === 'naoLancados' ? 'btn btn-primary text-sm' : 'btn btn-ghost text-sm'}>
              Não lançados no Kralen
            </button>
            <button type="button" onClick={() => setFiltro('todos')} className={filtro === 'todos' ? 'btn btn-primary text-sm' : 'btn btn-ghost text-sm'}>
              Todos
            </button>
          </div>
        </div>
        <button
          onClick={() => containerRef.current && exportElementsToPdf([containerRef.current], 'relatorio_licitacoes_ganhas.pdf', 'Relatório Geral das Licitações Ganhas', 'landscape')}
          className="btn btn-primary"
        >
          Exportar (PDF)
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <span className="text-sm text-gray-600">Período:</span>
        <div className="flex flex-wrap gap-2">
          {PERIODOS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodo(p.id)}
              className={periodo === p.id ? 'btn btn-primary text-sm' : 'btn btn-ghost text-sm'}
            >
              {p.label}
            </button>
          ))}
        </div>
        {periodo === 'custom' && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">De</span>
            <DateInputBR value={dataInicioCustom} onChange={setDataInicioCustom} className="p-1.5 rounded w-32" />
            <span className="text-gray-600">até</span>
            <DateInputBR value={dataFimCustom} onChange={setDataFimCustom} className="p-1.5 rounded w-32" />
          </div>
        )}
      </div>

      <div ref={containerRef} className="bg-white p-4 rounded shadow overflow-x-auto">
        <h3 className="text-xl font-bold text-center mb-1">Relatório Geral das Licitações Ganhas</h3>
        <div className="text-center text-xs text-gray-500 mb-4">
          {PERIODOS.find(p => p.id === periodo)?.label}
          {periodo === 'custom' && (dataInicioCustom || dataFimCustom) ? ` (${dataInicioCustom ? formatDateTimeBR(dataInicioCustom) : '…'} até ${dataFimCustom ? formatDateTimeBR(dataFimCustom) : 'hoje'})` : ''}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-indigo-50 border border-indigo-100 rounded p-3 text-center">
            <div className="text-xs text-gray-500">Licitações no período</div>
            <div className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{ganhos.length}</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded p-3 text-center">
            <div className="text-xs text-gray-500">Valor Total Ganho</div>
            <div className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{formatMoneyBRL(totalGanhoGeral)}</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded p-3 text-center">
            <div className="text-xs text-gray-500">Custo Total</div>
            <div className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{formatMoneyBRL(totalCustoGeral)}</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded p-3 text-center">
            <div className="text-xs text-gray-500">Margem</div>
            <div className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{margemGeralValor === null ? '-' : `${formatFixed(margemGeralValor)}%`}</div>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500">Carregando...</div>
        ) : ganhos.length === 0 ? (
          <div className="text-sm text-gray-500">
            {filtro === 'naoLancados' ? 'Nenhum ganho pendente de lançamento no Kralen.' : 'Nenhum item vencedor cadastrado ainda.'}
          </div>
        ) : (
          <table className="w-full text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
            <Colgroup />
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="p-1.5">Licitação:</th>
                <th className="p-1.5">Data:</th>
                <th className="p-1.5">Hora:</th>
                <th className="p-1.5">Órgão:</th>
                <th className="p-1.5">Tipo:</th>
                <th className="p-1.5">Marca:</th>
                <th className="p-1.5 text-right">Qtde:</th>
                <th className="p-1.5 text-right">Custo:</th>
                <th className="p-1.5 text-right">Vlr Ganho:</th>
                <th className="p-1.5 text-right">%:</th>
              </tr>
            </thead>
            <tbody>
              {ganhos.map(({ licitacao: l, itensVencedores }) => {
                const grupos = agruparPorLote(itensVencedores)
                return (
                  <React.Fragment key={l.codigo}>
                    <tr className="border-t">
                      <td className="p-1.5 font-semibold align-top">
                        <Link to={`/licitacoes/${l.codigo}`} className="link-primary">{l.codigo}</Link>
                      </td>
                      <td className="p-1.5 whitespace-nowrap align-top">{formatDateTimeBR(l.dataLicitacao, l.horaLicitacao).split(' ')[0]}</td>
                      <td className="p-1.5 whitespace-nowrap align-top">{l.horaLicitacao || '-'}</td>
                      <td className="p-1.5 align-top truncate" title={`${contratanteNome(l)}${contratanteUf(l) ? ' / ' + contratanteUf(l) : ''}`}>
                        {contratanteNome(l)}{contratanteUf(l) ? ` / ${contratanteUf(l)}` : ''}
                      </td>
                      <td className="p-1.5 whitespace-nowrap align-top">Pregão Eletrônico{l.numeroPregao ? ` / nº ${l.numeroPregao}` : ''}</td>
                      <td className="p-1.5 align-top" colSpan={5}>
                        <label className="flex items-center justify-end gap-2 text-xs text-gray-600">
                          <input type="checkbox" checked={!!l.lancadoNoKralen} onChange={e => toggleKralen(l.codigo, e.target.checked)} />
                          Lançada no Kralen
                        </label>
                      </td>
                    </tr>

                    {grupos.map((grupo, gi) => (
                      <React.Fragment key={grupo.lote ?? gi}>
                        {grupo.lote !== null && (
                          <tr>
                            <td className="p-1.5" colSpan={10}>
                              <span className="text-xs font-semibold bg-gray-100 rounded px-2 py-0.5">Lote: {grupo.lote}</span>
                            </td>
                          </tr>
                        )}
                        {grupo.items.map((it: any, i: number) => {
                          const margem = margemPercentual(Number(it.valorGanho) || 0, Number(it.totalCusto) || 0)
                          return (
                            <tr key={i} className="border-t align-top">
                              <td className="p-1.5 text-gray-700" colSpan={5}>{it.descricao || '-'}</td>
                              <td className="p-1.5">Item nº {it.item ?? i + 1} - {it.marca || '-'}</td>
                              <td className="p-1.5 text-right">{formatNumeric(it.quantidade, 0)}</td>
                              <td className="p-1.5 text-right">{formatFixed(it.totalCusto)}</td>
                              <td className="p-1.5 text-right">{formatFixed(it.valorGanho)}</td>
                              <td className="p-1.5 text-right">{margem === null ? '-' : `${formatFixed(margem)}%`}</td>
                            </tr>
                          )
                        })}
                        <TotalRow label="SubTotal do LOTE:" itens={grupo.items} />
                      </React.Fragment>
                    ))}
                    <TotalRow label="Total do(s) LOTE(S):" itens={itensVencedores} />
                  </React.Fragment>
                )
              })}
              <TotalRow label="Total Geral:" itens={todosItensVencedores} />
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
