import React, { useEffect, useState } from 'react'
import { listLicitacoes } from '../../utils/licitacoes'
import { listItems } from '../../utils/items'
import { formatDateTimeBR, nowInBrasilia } from '../../utils/date'
import { DateInputBR } from '../../components/DateTimeBR'
import { formatMoneyBRL, formatFixed } from '../../utils/format'
import { somaColuna, situacaoDoItem } from '../../utils/itens'
import { exportRowsToExcel } from '../../utils/excel'
import { Periodo, PERIODOS, dataDentroDoPeriodo } from '../../utils/periodo'

type LinhaRanking = {
  orgao: string
  uf: string
  total: number
  ganhou: number
  perdeu: number
  semStatus: number
  valorGanho: number
}

function contratanteNome(l: any) {
  return l.contratante?.nome || l.contratado || l.empresa?.razaoSocial || 'Sem contratante'
}

function contratanteUf(l: any) {
  return l.contratante?.uf || ''
}

type OrdemCampo = 'total' | 'taxa' | 'valorGanho'

export default function RelatorioRankingContratantes() {
  const [loading, setLoading] = useState(true)
  const [licitacoes, setLicitacoes] = useState<any[]>([])
  const [itemsByCodigo, setItemsByCodigo] = useState<Record<string, any[]>>({})
  const [periodo, setPeriodo] = useState<Periodo>('todos')
  const [dataInicioCustom, setDataInicioCustom] = useState('')
  const [dataFimCustom, setDataFimCustom] = useState('')
  const [ordem, setOrdem] = useState<OrdemCampo>('total')
  const hoje = nowInBrasilia().date

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const list = await listLicitacoes()
      if (!mounted) return
      setLicitacoes(list)
      const entries = await Promise.all(list.map(async (l: any) => {
        const items = await listItems(l.codigo)
        return [String(l.codigo), items] as const
      }))
      if (!mounted) return
      setItemsByCodigo(Object.fromEntries(entries))
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [])

  const noPeriodo = licitacoes.filter(l => dataDentroDoPeriodo(l.dataLicitacao, periodo, hoje, dataInicioCustom, dataFimCustom))

  const porOrgao = new Map<string, LinhaRanking>()
  for (const l of noPeriodo) {
    const orgao = contratanteNome(l)
    const uf = contratanteUf(l)
    const chave = `${orgao}|${uf}`
    if (!porOrgao.has(chave)) porOrgao.set(chave, { orgao, uf, total: 0, ganhou: 0, perdeu: 0, semStatus: 0, valorGanho: 0 })
    const linha = porOrgao.get(chave)!
    linha.total++
    if (l.status === 'Ganhou') linha.ganhou++
    else if (l.status === 'Perdeu') linha.perdeu++
    else linha.semStatus++

    const items = itemsByCodigo[String(l.codigo)] || []
    for (const it of items) {
      if (situacaoDoItem(l, it) === 'Vencedor') linha.valorGanho += Number(it.valorGanho) || 0
    }
  }

  const linhas = Array.from(porOrgao.values())
    .map(l => ({ ...l, taxa: l.ganhou + l.perdeu > 0 ? (l.ganhou / (l.ganhou + l.perdeu)) * 100 : null }))
    .sort((a, b) => {
      if (ordem === 'taxa') return (b.taxa ?? -1) - (a.taxa ?? -1)
      if (ordem === 'valorGanho') return b.valorGanho - a.valorGanho
      return b.total - a.total
    })

  const totalGeral = {
    total: somaColuna(linhas, 'total'),
    ganhou: somaColuna(linhas, 'ganhou'),
    perdeu: somaColuna(linhas, 'perdeu'),
    valorGanho: somaColuna(linhas, 'valorGanho'),
  }

  const exportarExcel = () => {
    const dados = linhas.map(l => ({
      Órgão: l.orgao,
      UF: l.uf,
      'Total de Licitações': l.total,
      Ganhou: l.ganhou,
      Perdeu: l.perdeu,
      'Sem Status': l.semStatus,
      'Taxa de Sucesso %': l.taxa ?? undefined,
      'Valor Total Ganho': l.valorGanho,
    }))
    exportRowsToExcel(dados, 'ranking_contratantes.xlsx', 'Ranking de Contratantes')
  }

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-600">Ordenar por:</span>
          <select value={ordem} onChange={e => setOrdem(e.target.value as OrdemCampo)} className="p-1.5 rounded">
            <option value="total">Total de licitações</option>
            <option value="taxa">Taxa de sucesso</option>
            <option value="valorGanho">Valor ganho</option>
          </select>
        </div>
        <button onClick={exportarExcel} className="btn btn-primary">Exportar (Excel)</button>
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
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-600">De</span>
            <DateInputBR value={dataInicioCustom} onChange={setDataInicioCustom} className="p-1.5 rounded w-32" />
            <span className="text-gray-600">até</span>
            <DateInputBR value={dataFimCustom} onChange={setDataFimCustom} className="p-1.5 rounded w-32" />
          </div>
        )}
      </div>

      <div className="table-scroll">
        <div className="bg-white p-4 rounded shadow min-w-[820px]">
          <h3 className="text-xl font-bold text-center mb-1">Ranking de Contratantes</h3>
          <div className="text-center text-xs text-gray-500 mb-4">
            {PERIODOS.find(p => p.id === periodo)?.label}
            {periodo === 'custom' && (dataInicioCustom || dataFimCustom) ? ` (${dataInicioCustom ? formatDateTimeBR(dataInicioCustom) : '…'} até ${dataFimCustom ? formatDateTimeBR(dataFimCustom) : 'hoje'})` : ''}
          </div>

          {loading ? (
            <div className="text-sm text-gray-500">Carregando...</div>
          ) : linhas.length === 0 ? (
            <div className="text-sm text-gray-500">Nenhuma licitação no período selecionado.</div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="p-1.5">Órgão:</th>
                  <th className="p-1.5">UF:</th>
                  <th className="p-1.5 text-right">Total:</th>
                  <th className="p-1.5 text-right">Ganhou:</th>
                  <th className="p-1.5 text-right">Perdeu:</th>
                  <th className="p-1.5 text-right">Taxa:</th>
                  <th className="p-1.5 text-right">Valor Ganho:</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(l => (
                  <tr key={`${l.orgao}-${l.uf}`} className="border-t">
                    <td className="p-1.5">{l.orgao}</td>
                    <td className="p-1.5">{l.uf || '-'}</td>
                    <td className="p-1.5 text-right">{l.total}</td>
                    <td className="p-1.5 text-right">{l.ganhou}</td>
                    <td className="p-1.5 text-right">{l.perdeu}</td>
                    <td className="p-1.5 text-right">{l.taxa === null ? '-' : `${formatFixed(l.taxa, 0)}%`}</td>
                    <td className="p-1.5 text-right">{formatMoneyBRL(l.valorGanho)}</td>
                  </tr>
                ))}
                <tr className="border-t bg-gray-50 font-semibold">
                  <td className="p-1.5" colSpan={2}>Total Geral:</td>
                  <td className="p-1.5 text-right">{totalGeral.total}</td>
                  <td className="p-1.5 text-right">{totalGeral.ganhou}</td>
                  <td className="p-1.5 text-right">{totalGeral.perdeu}</td>
                  <td className="p-1.5 text-right">-</td>
                  <td className="p-1.5 text-right">{formatMoneyBRL(totalGeral.valorGanho)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
