import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { listLicitacoes } from '../../utils/licitacoes'
import { listItemsByCodigos } from '../../utils/items'
import { formatDateTimeBR, nowInBrasilia } from '../../utils/date'
import { DateInputBR } from '../../components/DateTimeBR'
import { formatNumeric, formatFixed, formatMoneyBRL, margemPercentual } from '../../utils/format'
import { agruparPorLote, somaColuna } from '../../utils/itens'
import { setLancadoNoKralen } from '../../utils/kralen'
import { exportElementsToPdf } from '../../utils/pdf'
import { exportRowsToExcel } from '../../utils/excel'
import { Periodo, PERIODOS, dataDentroDoPeriodo } from '../../utils/periodo'
import { FiltroKralen, FILTROS_KRALEN, passaFiltroKralen } from '../../utils/filtroKralen'

type LicitacaoGanha = {
  licitacao: any
  itensVencedores: any[]
}

function contratanteNome(l: any) {
  return l.contratante?.nome || l.contratado || l.empresa?.razaoSocial || 'Sem contratante'
}

function contratanteUf(l: any) {
  return l.contratante?.uf || ''
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
  const [filtro, setFiltro] = useState<FiltroKralen>('naoLancadas')
  const [busca, setBusca] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('todos')
  const [dataInicioCustom, setDataInicioCustom] = useState('')
  const [dataFimCustom, setDataFimCustom] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [erro, setErro] = useState('')
  const hoje = nowInBrasilia().date

  const load = async () => {
    const list = await listLicitacoes()
    setLicitacoes(list)
    // Uma chamada só com `.in()`, em vez de uma por licitação (N+1).
    const porCodigo = await listItemsByCodigos(list.map((l: any) => l.codigo))
    setItemsByCodigo(porCodigo)
    setLoading(false)
  }

  useEffect(() => {
    setErro('')
    load().catch(err => {
      setErro(err?.message || 'Não foi possível carregar o relatório de ganhos.')
      setLoading(false)
    })
  }, [])

  const toggleKralen = async (codigo: number, checked: boolean) => {
    const userName = localStorage.getItem('user_name') || undefined
    const list = await setLancadoNoKralen(codigo, checked, userName)
    setLicitacoes(list)
  }

  const termoBusca = busca.trim().toLowerCase()

  const ganhos: LicitacaoGanha[] = licitacoes
    .map(l => ({ licitacao: l, itensVencedores: (itemsByCodigo[String(l.codigo)] || []).filter((it: any) => it.vencedor) }))
    .map(g => termoBusca
      ? { ...g, itensVencedores: g.itensVencedores.filter((it: any) => (it.descricao || '').toLowerCase().includes(termoBusca)) }
      : g
    )
    .filter(g => g.itensVencedores.length > 0)
    .filter(g => passaFiltroKralen(g.licitacao.lancadoNoKralen, filtro))
    .filter(g => dataDentroDoPeriodo(g.licitacao.dataLicitacao, periodo, hoje, dataInicioCustom, dataFimCustom))

  const todosItensVencedores = ganhos.flatMap(g => g.itensVencedores)
  const totalCustoGeral = somaColuna(todosItensVencedores, 'totalCusto')
  const totalGanhoGeral = somaColuna(todosItensVencedores, 'valorGanho')
  const margemGeralValor = margemPercentual(totalGanhoGeral, totalCustoGeral)

  const exportarExcel = () => {
    const linhas = ganhos.flatMap(({ licitacao: l, itensVencedores }) =>
      itensVencedores.map((it: any) => ({
        Licitação: l.codigo,
        Data: formatDateTimeBR(l.dataLicitacao, l.horaLicitacao).split(' ')[0],
        Órgão: contratanteNome(l),
        UF: contratanteUf(l),
        Pregão: l.numeroPregao || '',
        Lote: it.lote || '',
        Item: it.item ?? '',
        Descrição: it.descricao || '',
        Marca: it.marca || '',
        Quantidade: Number(it.quantidade) || 0,
        Custo: Number(it.totalCusto) || 0,
        'Valor Ganho': Number(it.valorGanho) || 0,
        // `undefined` (não '') pra célula ficar realmente vazia na planilha
        // em vez de virar texto misturado com número na mesma coluna.
        'Margem %': margemPercentual(Number(it.valorGanho) || 0, Number(it.totalCusto) || 0) ?? undefined,
        Kralen: l.lancadoNoKralen ? 'Sim' : 'Não',
      }))
    )
    exportRowsToExcel(linhas, 'relatorio_itens_ganhos.xlsx', 'Itens Ganhos')
  }

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[220px] sm:max-w-sm">
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar item ganho por nome/descrição..."
            className="w-full p-2 rounded text-sm"
          />
          {busca && (
            <button type="button" onClick={() => setBusca('')} className="btn btn-ghost text-sm">Limpar</button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={exportarExcel} className="btn btn-ghost">Exportar (Excel)</button>
          <button
            onClick={() => containerRef.current && exportElementsToPdf([containerRef.current], 'relatorio_itens_ganhos.pdf', 'Relatório Geral de Itens Ganhos', 'landscape')}
            className="btn btn-primary"
          >
            Exportar (PDF)
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
        <span className="text-sm text-gray-600">Kralen:</span>
        <div className="flex flex-wrap gap-2">
          {FILTROS_KRALEN.map(f => (
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

      {/* O bloco do relatório é um documento de largura fixa, e quem rola é a
          caixa em volta dele. O motivo é o PDF: `containerRef` é o elemento
          que o html2canvas fotografa, então ele precisa ter a largura inteira
          na hora da captura. Se a rolagem ficasse nele, exportar do celular
          geraria um PDF com a tabela cortada na largura da tela. */}
      <div className="table-scroll">
      <div ref={containerRef} className="bg-white p-4 rounded shadow min-w-[980px]">
        <h3 className="text-xl font-bold text-center mb-1">Relatório Geral de Itens Ganhos</h3>
        <div className="text-center text-xs text-gray-500 mb-4">
          {PERIODOS.find(p => p.id === periodo)?.label}
          {periodo === 'custom' && (dataInicioCustom || dataFimCustom) ? ` (${dataInicioCustom ? formatDateTimeBR(dataInicioCustom) : '…'} até ${dataFimCustom ? formatDateTimeBR(dataFimCustom) : 'hoje'})` : ''}
        </div>
        {termoBusca && (
          <div className="text-center text-xs text-gray-500 mb-4">
            Filtrando por: <strong>{busca}</strong> — {ganhos.length} licitação(ões) encontrada(s)
          </div>
        )}

        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="bg-cyan-50 border border-cyan-100 rounded p-3 text-center">
            <div className="text-xs text-gray-500">Licitações no período</div>
            <div className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{ganhos.length}</div>
          </div>
          <div className="bg-cyan-50 border border-cyan-100 rounded p-3 text-center">
            <div className="text-xs text-gray-500">Valor Total Ganho</div>
            <div className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{formatMoneyBRL(totalGanhoGeral)}</div>
          </div>
          <div className="bg-cyan-50 border border-cyan-100 rounded p-3 text-center">
            <div className="text-xs text-gray-500">Custo Total</div>
            <div className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{formatMoneyBRL(totalCustoGeral)}</div>
          </div>
          <div className="bg-cyan-50 border border-cyan-100 rounded p-3 text-center">
            <div className="text-xs text-gray-500">Margem</div>
            <div className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{margemGeralValor === null ? '-' : `${formatFixed(margemGeralValor)}%`}</div>
          </div>
        </div>

        {erro && <p role="alert" className="text-sm mb-3" style={{ color: 'var(--color-error-text)' }}>{erro}</p>}
        {loading ? (
          <div className="text-sm text-gray-500">Carregando...</div>
        ) : erro ? null : ganhos.length === 0 ? (
          <div className="text-sm text-gray-500">
            {termoBusca
              ? `Nenhum item ganho encontrado com "${busca}".`
              : filtro === 'naoLancadas' ? 'Nenhum ganho pendente de lançamento no Kralen.' : 'Nenhum item vencedor cadastrado ainda.'}
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
    </div>
  )
}
