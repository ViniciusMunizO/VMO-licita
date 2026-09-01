import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { listLicitacoes } from '../../utils/licitacoes'
import { listItems } from '../../utils/items'
import { formatDateTimeBR, nowInBrasilia } from '../../utils/date'
import { DateInputBR } from '../../components/DateTimeBR'
import { formatNumeric, formatFixed } from '../../utils/format'
import { agruparPorLote, somaColuna } from '../../utils/itens'
import { exportElementsToPdf } from '../../utils/pdf'
import { Periodo, PERIODOS, dataDentroDoPeriodo } from '../../utils/periodo'
import { FiltroKralen, FILTROS_KRALEN, passaFiltroKralen } from '../../utils/filtroKralen'

type LicitacaoPerdida = {
  licitacao: any
  itensPerdidos: any[]
}

function contratanteNome(l: any) {
  return l.contratante?.nome || l.contratado || l.empresa?.razaoSocial || 'Sem contratante'
}

function contratanteUf(l: any) {
  return l.contratante?.uf || ''
}

// Uma licitação só entra no relatório depois de "decidida" — senão todo item
// ainda sem resultado definido contaria como perdido. Decidida = tem status
// geral preenchido (Ganhou/Perdeu) OU pelo menos um item já marcado vencedor
// (registro de preços onde só parte dos itens foi arrematada).
function licitacaoDecidida(licitacao: any, items: any[]): boolean {
  return !!licitacao.status || items.some((it: any) => it.vencedor)
}

const COLS: { width: string }[] = [
  { width: '7%' }, { width: '10%' }, { width: '7%' }, { width: '22%' }, { width: '15%' },
  { width: '19%' }, { width: '9%' }, { width: '11%' },
]

function Colgroup() {
  return <colgroup>{COLS.map((c, i) => <col key={i} style={{ width: c.width }} />)}</colgroup>
}

function TotalRow({ label, itens }: { label: string; itens: any[] }) {
  const qtd = somaColuna(itens, 'quantidade')
  const custo = somaColuna(itens, 'totalCusto')
  return (
    <tr className="bg-gray-50 font-semibold">
      <td className="p-1.5 text-right" colSpan={6}>{label}</td>
      <td className="p-1.5 text-right">{formatNumeric(qtd, 0)}</td>
      <td className="p-1.5 text-right">{formatFixed(custo, 4)}</td>
    </tr>
  )
}

export default function RelatorioItensPerdidos() {
  const [loading, setLoading] = useState(true)
  const [licitacoes, setLicitacoes] = useState<any[]>([])
  const [itemsByCodigo, setItemsByCodigo] = useState<Record<string, any[]>>({})
  const [busca, setBusca] = useState('')
  const [filtroKralen, setFiltroKralen] = useState<FiltroKralen>('todas')
  const [periodo, setPeriodo] = useState<Periodo>('todos')
  const [dataInicioCustom, setDataInicioCustom] = useState('')
  const [dataFimCustom, setDataFimCustom] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hoje = nowInBrasilia().date

  useEffect(() => {
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
    load()
  }, [])

  const termoBusca = busca.trim().toLowerCase()

  const perdidos: LicitacaoPerdida[] = licitacoes
    .filter(l => dataDentroDoPeriodo(l.dataLicitacao, periodo, hoje, dataInicioCustom, dataFimCustom))
    .filter(l => passaFiltroKralen(l.lancadoNoKralen, filtroKralen))
    .map(l => {
      const items = itemsByCodigo[String(l.codigo)] || []
      if (!licitacaoDecidida(l, items)) return { licitacao: l, itensPerdidos: [] }
      return { licitacao: l, itensPerdidos: items.filter((it: any) => !it.vencedor) }
    })
    .map(g => termoBusca
      ? { ...g, itensPerdidos: g.itensPerdidos.filter((it: any) => (it.descricao || '').toLowerCase().includes(termoBusca)) }
      : g
    )
    .filter(g => g.itensPerdidos.length > 0)

  const todosItensPerdidos = perdidos.flatMap(g => g.itensPerdidos)

  return (
    <div>
      <div className="flex justify-between items-center mb-4 gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar item perdido por nome/descrição..."
            className="w-full p-2 rounded text-sm"
          />
          {busca && (
            <button type="button" onClick={() => setBusca('')} className="btn btn-ghost text-sm">Limpar</button>
          )}
        </div>
        <button
          onClick={() => containerRef.current && exportElementsToPdf([containerRef.current], 'relatorio_itens_perdidos.pdf', 'Relatório Geral de Itens Perdidos', 'landscape')}
          className="btn btn-primary"
        >
          Exportar (PDF)
        </button>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <span className="text-sm text-gray-600">Kralen:</span>
        <div className="flex gap-2">
          {FILTROS_KRALEN.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltroKralen(f.id)}
              className={filtroKralen === f.id ? 'btn btn-primary text-sm' : 'btn btn-ghost text-sm'}
            >
              {f.label}
            </button>
          ))}
        </div>
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
        <h3 className="text-xl font-bold text-center mb-1">Relatório Geral de Itens Perdidos</h3>
        <div className="text-center text-xs text-gray-500 mb-4">
          {PERIODOS.find(p => p.id === periodo)?.label}
          {periodo === 'custom' && (dataInicioCustom || dataFimCustom) ? ` (${dataInicioCustom ? formatDateTimeBR(dataInicioCustom) : '…'} até ${dataFimCustom ? formatDateTimeBR(dataFimCustom) : 'hoje'})` : ''}
        </div>
        {termoBusca && (
          <div className="text-center text-xs text-gray-500 mb-4">
            Filtrando por: <strong>{busca}</strong> — {perdidos.length} licitação(ões) encontrada(s)
          </div>
        )}

        {loading ? (
          <div className="text-sm text-gray-500">Carregando...</div>
        ) : perdidos.length === 0 ? (
          <div className="text-sm text-gray-500">
            {termoBusca ? `Nenhum item perdido encontrado com "${busca}".` : 'Nenhum item perdido em licitações já decididas.'}
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
                <th className="p-1.5">Pregão:</th>
                <th className="p-1.5">Marca:</th>
                <th className="p-1.5 text-right">Qtde:</th>
                <th className="p-1.5 text-right">Custo:</th>
              </tr>
            </thead>
            <tbody>
              {perdidos.map(({ licitacao: l, itensPerdidos }) => {
                const grupos = agruparPorLote(itensPerdidos)
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
                      <td className="p-1.5 align-top" colSpan={4}>{l.numeroPregao ? `nº ${l.numeroPregao}` : '-'}</td>
                    </tr>

                    {grupos.map((grupo, gi) => (
                      <React.Fragment key={grupo.lote ?? gi}>
                        <tr>
                          <td className="p-1.5" colSpan={8}>
                            <span className="text-xs font-semibold bg-gray-100 rounded px-2 py-0.5">Lote: {grupo.lote ?? ''}</span>
                          </td>
                        </tr>
                        {grupo.items.map((it: any, i: number) => (
                          <tr key={i} className="border-t align-top">
                            <td className="p-1.5 text-gray-700" colSpan={5}>{it.descricao || '-'}</td>
                            <td className="p-1.5">Item nº {it.item ?? i + 1} - {it.marca || '-'}</td>
                            <td className="p-1.5 text-right">{formatNumeric(it.quantidade, 0)}</td>
                            <td className="p-1.5 text-right">{formatFixed(it.totalCusto, 4)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                    <TotalRow label="Subtotal da Licitação:" itens={itensPerdidos} />
                  </React.Fragment>
                )
              })}
              <TotalRow label="Total Geral:" itens={todosItensPerdidos} />
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
