import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { listLicitacoes } from '../../utils/licitacoes'
import { formatDateTimeBR, nowInBrasilia } from '../../utils/date'
import { DateInputBR } from '../../components/DateTimeBR'
import { formatFixed } from '../../utils/format'
import { exportElementsToPdf } from '../../utils/pdf'
import { Periodo, PERIODOS, dataDentroDoPeriodo } from '../../utils/periodo'
import StatusBadge from '../../components/StatusBadge'

type Filtro = 'todas' | 'Ganhou' | 'Perdeu' | 'semStatus'
type FiltroKralen = 'todas' | 'lancadas' | 'naoLancadas'

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'Ganhou', label: 'Ganhou' },
  { id: 'Perdeu', label: 'Perdeu' },
  { id: 'semStatus', label: 'Sem status' },
]

const FILTROS_KRALEN: { id: FiltroKralen; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'lancadas', label: 'Lançadas no Kralen' },
  { id: 'naoLancadas', label: 'Não lançadas no Kralen' },
]

function contratanteNome(l: any) {
  return l.contratante?.nome || l.contratado || l.empresa?.razaoSocial || 'Sem contratante'
}

function contratanteUf(l: any) {
  return l.contratante?.uf || ''
}

export default function RelatorioStatusLicitacoes() {
  const [loading, setLoading] = useState(true)
  const [licitacoes, setLicitacoes] = useState<any[]>([])
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [filtroKralen, setFiltroKralen] = useState<FiltroKralen>('todas')
  const [periodo, setPeriodo] = useState<Periodo>('todos')
  const [dataInicioCustom, setDataInicioCustom] = useState('')
  const [dataFimCustom, setDataFimCustom] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hoje = nowInBrasilia().date

  useEffect(() => {
    listLicitacoes().then(list => { setLicitacoes(list); setLoading(false) })
  }, [])

  const noPeriodo = licitacoes.filter(l => dataDentroDoPeriodo(l.dataLicitacao, periodo, hoje, dataInicioCustom, dataFimCustom))

  const ganhouCount = noPeriodo.filter(l => l.status === 'Ganhou').length
  const perdeuCount = noPeriodo.filter(l => l.status === 'Perdeu').length
  const semStatusCount = noPeriodo.filter(l => !l.status).length
  const decididas = ganhouCount + perdeuCount
  const taxaSucesso = decididas > 0 ? (ganhouCount / decididas) * 100 : null

  const listaFiltrada = noPeriodo
    .filter(l => {
      if (filtro === 'todas') return true
      if (filtro === 'semStatus') return !l.status
      return l.status === filtro
    })
    .filter(l => {
      if (filtroKralen === 'todas') return true
      if (filtroKralen === 'lancadas') return !!l.lancadoNoKralen
      return !l.lancadoNoKralen
    })

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Mostrar:</span>
          <div className="flex gap-2">
            {FILTROS.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltro(f.id)}
                className={filtro === f.id ? 'btn btn-primary text-sm' : 'btn btn-ghost text-sm'}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => containerRef.current && exportElementsToPdf([containerRef.current], 'relatorio_status_licitacoes.pdf', 'Relatório de Status das Licitações', 'landscape')}
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
        <h3 className="text-xl font-bold text-center mb-1">Relatório de Status das Licitações</h3>
        <div className="text-center text-xs text-gray-500 mb-4">
          {PERIODOS.find(p => p.id === periodo)?.label}
          {periodo === 'custom' && (dataInicioCustom || dataFimCustom) ? ` (${dataInicioCustom ? formatDateTimeBR(dataInicioCustom) : '…'} até ${dataFimCustom ? formatDateTimeBR(dataFimCustom) : 'hoje'})` : ''}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-green-50 border border-green-100 rounded p-3 text-center">
            <div className="text-xs text-gray-500">Ganhou</div>
            <div className="text-lg font-bold" style={{ color: '#15803d' }}>{ganhouCount}</div>
          </div>
          <div className="bg-red-50 border border-red-100 rounded p-3 text-center">
            <div className="text-xs text-gray-500">Perdeu</div>
            <div className="text-lg font-bold" style={{ color: 'var(--color-error)' }}>{perdeuCount}</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded p-3 text-center">
            <div className="text-xs text-gray-500">Sem status</div>
            <div className="text-lg font-bold text-gray-600">{semStatusCount}</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded p-3 text-center">
            <div className="text-xs text-gray-500">Taxa de sucesso</div>
            <div className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
              {taxaSucesso === null ? '-' : `${formatFixed(taxaSucesso)}%`}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500">Carregando...</div>
        ) : listaFiltrada.length === 0 ? (
          <div className="text-sm text-gray-500">Nenhuma licitação encontrada com esse filtro.</div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="p-1.5">Licitação:</th>
                <th className="p-1.5">Ano:</th>
                <th className="p-1.5">Data:</th>
                <th className="p-1.5">Órgão:</th>
                <th className="p-1.5">Pregão:</th>
                <th className="p-1.5">Status:</th>
                <th className="p-1.5">Kralen:</th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map(l => (
                <tr key={l.codigo} className="border-t align-top">
                  <td className="p-1.5 font-semibold">
                    <Link to={`/licitacoes/${l.codigo}`} className="link-primary">{l.codigo}</Link>
                  </td>
                  <td className="p-1.5">{l.ano || '-'}</td>
                  <td className="p-1.5 whitespace-nowrap">{formatDateTimeBR(l.dataLicitacao, l.horaLicitacao).split(' ')[0]}</td>
                  <td className="p-1.5" title={`${contratanteNome(l)}${contratanteUf(l) ? ' / ' + contratanteUf(l) : ''}`}>
                    {contratanteNome(l)}{contratanteUf(l) ? ` / ${contratanteUf(l)}` : ''}
                  </td>
                  <td className="p-1.5">{l.numeroPregao ? `nº ${l.numeroPregao}` : '-'}</td>
                  <td className="p-1.5"><StatusBadge status={l.status} /></td>
                  <td className="p-1.5 text-gray-600">{l.lancadoNoKralen ? 'Sim' : 'Não'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
