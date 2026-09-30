import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { listLicitacoes } from '../../utils/licitacoes'
import { listItemsByCodigos } from '../../utils/items'
import { formatDateTimeBR, nowInBrasilia } from '../../utils/date'
import { DateInputBR } from '../../components/DateTimeBR'
import { formatNumeric, formatFixed } from '../../utils/format'
import { agruparPorLote, somaColuna, parseMotivo } from '../../utils/itens'
import { exportElementsToPdf } from '../../utils/pdf'
import { exportRowsToExcel } from '../../utils/excel'
import { Periodo, PERIODOS, dataDentroDoPeriodo } from '../../utils/periodo'
import { FiltroKralen, FILTROS_KRALEN, passaFiltroKralen } from '../../utils/filtroKralen'

type LicitacaoDesclassificada = {
  licitacao: any
  itensDesclassificados: any[]
}

function contratanteNome(l: any) {
  return l.contratante?.nome || l.contratado || l.empresa?.razaoSocial || 'Sem contratante'
}

function contratanteUf(l: any) {
  return l.contratante?.uf || ''
}

const COLS: { width: string }[] = [
  { width: '8%' }, { width: '10%' }, { width: '22%' }, { width: '18%' },
  { width: '32%' }, { width: '10%' },
]

function Colgroup() {
  return <colgroup>{COLS.map((c, i) => <col key={i} style={{ width: c.width }} />)}</colgroup>
}

function TotalRow({ label, itens }: { label: string; itens: any[] }) {
  const qtd = somaColuna(itens, 'quantidade')
  const custo = somaColuna(itens, 'totalCusto')
  return (
    <tr className="bg-gray-50 font-semibold">
      <td className="p-1.5 text-right" colSpan={4}>{label}</td>
      <td className="p-1.5 text-right">{formatNumeric(qtd, 0)}</td>
      <td className="p-1.5 text-right">{formatFixed(custo, 2)}</td>
    </tr>
  )
}

export default function RelatorioItensDesclassificados() {
  const [loading, setLoading] = useState(true)
  const [licitacoes, setLicitacoes] = useState<any[]>([])
  const [itemsByCodigo, setItemsByCodigo] = useState<Record<string, any[]>>({})
  const [busca, setBusca] = useState('')
  const [filtroKralen, setFiltroKralen] = useState<FiltroKralen>('todas')
  const [periodo, setPeriodo] = useState<Periodo>('todos')
  const [dataInicioCustom, setDataInicioCustom] = useState('')
  const [dataFimCustom, setDataFimCustom] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [erro, setErro] = useState('')
  const hoje = nowInBrasilia().date

  useEffect(() => {
    const load = async () => {
      const list = await listLicitacoes()
      setLicitacoes(list)
      // Uma chamada só com `.in()`, em vez de uma por licitação (N+1).
      const porCodigo = await listItemsByCodigos(list.map((l: any) => l.codigo))
      setItemsByCodigo(porCodigo)
      setLoading(false)
    }
    setErro('')
    load().catch(err => {
      setErro(err?.message || 'Não foi possível carregar o relatório de itens desclassificados.')
      setLoading(false)
    })
  }, [])

  const termoBusca = busca.trim().toLowerCase()

  const desclassificados: LicitacaoDesclassificada[] = licitacoes
    .filter(l => dataDentroDoPeriodo(l.dataLicitacao, periodo, hoje, dataInicioCustom, dataFimCustom))
    .filter(l => passaFiltroKralen(l.lancadoNoKralen, filtroKralen))
    .map(l => ({ licitacao: l, itensDesclassificados: (itemsByCodigo[String(l.codigo)] || []).filter((it: any) => it.desclassificado) }))
    .map(g => termoBusca
      ? { ...g, itensDesclassificados: g.itensDesclassificados.filter((it: any) => (it.descricao || '').toLowerCase().includes(termoBusca)) }
      : g
    )
    .filter(g => g.itensDesclassificados.length > 0)

  const todosItensDesclassificados = desclassificados.flatMap(g => g.itensDesclassificados)

  // Resumo por categoria de motivo — sem padronizar o campo isso contava
  // "Documentação" e "documentação" como coisas diferentes.
  const resumoPorMotivo = React.useMemo(() => {
    const contagem = new Map<string, number>()
    for (const it of todosItensDesclassificados) {
      const { categoria } = parseMotivo(it.motivoDesclassificacao || '')
      const chave = categoria || 'Sem motivo'
      contagem.set(chave, (contagem.get(chave) || 0) + 1)
    }
    return Array.from(contagem.entries()).sort((a, b) => b[1] - a[1])
  }, [todosItensDesclassificados])

  const exportarExcel = () => {
    const linhas = desclassificados.flatMap(({ licitacao: l, itensDesclassificados }) =>
      itensDesclassificados.map((it: any) => ({
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
        Motivo: it.motivoDesclassificacao || '',
        Kralen: l.lancadoNoKralen ? 'Sim' : 'Não',
      }))
    )
    exportRowsToExcel(linhas, 'relatorio_itens_desclassificados.xlsx', 'Desclassificados')
  }

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[220px] sm:max-w-sm">
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar item desclassificado por nome/descrição..."
            className="w-full p-2 rounded text-sm"
          />
          {busca && (
            <button type="button" onClick={() => setBusca('')} className="btn btn-ghost text-sm">Limpar</button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={exportarExcel} className="btn btn-ghost">Exportar (Excel)</button>
          <button
            onClick={() => containerRef.current && exportElementsToPdf([containerRef.current], 'relatorio_itens_desclassificados.pdf', 'Relatório - Licitações/Itens Desclassificadas', 'landscape')}
            className="btn btn-primary"
          >
            Exportar (PDF)
          </button>
        </div>
      </div>

      {resumoPorMotivo.length > 0 && (
        <div className="bg-white p-4 rounded shadow mb-4">
          <h4 className="font-semibold mb-3 text-sm">Motivos mais comuns</h4>
          <div className="space-y-2">
            {resumoPorMotivo.map(([motivo, count]) => {
              const max = resumoPorMotivo[0][1]
              return (
                <div key={motivo}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{motivo}</span>
                    <span className="text-gray-500">{count}</span>
                  </div>
                  <div className="h-2 rounded bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{ width: `${(count / max) * 100}%`, backgroundColor: 'var(--color-accent)' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
        <span className="text-sm text-gray-600">Kralen:</span>
        <div className="flex flex-wrap gap-2">
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
        <h3 className="text-xl font-bold text-center mb-1">Relatório - Licitações/Itens Desclassificadas - Detalhado</h3>
        <div className="text-center text-xs text-gray-500 mb-4">
          {PERIODOS.find(p => p.id === periodo)?.label}
          {periodo === 'custom' && (dataInicioCustom || dataFimCustom) ? ` (${dataInicioCustom ? formatDateTimeBR(dataInicioCustom) : '…'} até ${dataFimCustom ? formatDateTimeBR(dataFimCustom) : 'hoje'})` : ''}
        </div>
        {termoBusca && (
          <div className="text-center text-xs text-gray-500 mb-4">
            Filtrando por: <strong>{busca}</strong> — {desclassificados.length} licitação(ões) encontrada(s)
          </div>
        )}

        {erro && <p role="alert" className="text-sm mb-3" style={{ color: 'var(--color-error-text)' }}>{erro}</p>}
        {loading ? (
          <div className="text-sm text-gray-500">Carregando...</div>
        ) : erro ? null : desclassificados.length === 0 ? (
          <div className="text-sm text-gray-500">
            {termoBusca ? `Nenhum item desclassificado encontrado com "${busca}".` : 'Nenhum item desclassificado cadastrado ainda.'}
          </div>
        ) : (
          <table className="w-full text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
            <Colgroup />
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="p-1.5">Licitação:</th>
                <th className="p-1.5">Data:</th>
                <th className="p-1.5">Órgão:</th>
                <th className="p-1.5">Tipo:</th>
                <th className="p-1.5">Item / Motivo:</th>
                <th className="p-1.5 text-right">Qtde / Custo:</th>
              </tr>
            </thead>
            <tbody>
              {desclassificados.map(({ licitacao: l, itensDesclassificados }) => {
                const grupos = agruparPorLote(itensDesclassificados)
                return (
                  <React.Fragment key={l.codigo}>
                    <tr className="border-t">
                      <td className="p-1.5 font-semibold align-top">
                        <Link to={`/licitacoes/${l.codigo}`} className="link-primary">{l.codigo}</Link>
                      </td>
                      <td className="p-1.5 whitespace-nowrap align-top">{formatDateTimeBR(l.dataLicitacao, l.horaLicitacao).split(' ')[0]}</td>
                      <td className="p-1.5 align-top truncate" title={`${contratanteNome(l)}${contratanteUf(l) ? ' / ' + contratanteUf(l) : ''}`}>
                        {contratanteNome(l)}{contratanteUf(l) ? ` / ${contratanteUf(l)}` : ''}
                      </td>
                      <td className="p-1.5 align-top" colSpan={3}>Pregão Eletrônico{l.numeroPregao ? ` / nº ${l.numeroPregao}` : ''}</td>
                    </tr>

                    {grupos.map((grupo, gi) => (
                      <React.Fragment key={grupo.lote ?? gi}>
                        <tr>
                          <td className="p-1.5" colSpan={6}>
                            <span className="text-xs font-semibold bg-gray-100 rounded px-2 py-0.5">Lote: {grupo.lote ?? ''}</span>
                          </td>
                        </tr>
                        {grupo.items.map((it: any, i: number) => (
                          <React.Fragment key={i}>
                            <tr className="border-t align-top">
                              <td className="p-1.5 text-gray-700" colSpan={4}>
                                Item nº {it.item ?? i + 1} - {it.marca || '-'} / {it.descricao || '-'}
                              </td>
                              <td className="p-1.5 text-right">{formatNumeric(it.quantidade, 0)}</td>
                              <td className="p-1.5 text-right">{formatFixed(it.totalCusto, 2)}</td>
                            </tr>
                            <tr>
                              <td className="p-1.5 text-gray-600 break-words" colSpan={6}>
                                <strong>MOTIVO:</strong> {it.motivoDesclassificacao || '-'}
                              </td>
                            </tr>
                          </React.Fragment>
                        ))}
                      </React.Fragment>
                    ))}
                    <TotalRow label="Subtotal da Licitação:" itens={itensDesclassificados} />
                  </React.Fragment>
                )
              })}
              <TotalRow label="Total Geral:" itens={todosItensDesclassificados} />
            </tbody>
          </table>
        )}
      </div>
      </div>
    </div>
  )
}
