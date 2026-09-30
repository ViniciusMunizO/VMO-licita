import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { listLicitacoes } from '../../utils/licitacoes'
import { listItemsByCodigos } from '../../utils/items'
import { formatDateTimeBR, nowInBrasilia } from '../../utils/date'
import { DateInputBR } from '../../components/DateTimeBR'
import { formatNumeric, formatFixed } from '../../utils/format'
import { exportElementsToPdf } from '../../utils/pdf'
import { exportRowsToExcel } from '../../utils/excel'
import { Periodo, PERIODOS, dataDentroDoPeriodo } from '../../utils/periodo'
import { situacaoDoItem, SituacaoItem } from '../../utils/itens'

type Ocorrencia = {
  licitacao: any
  item: any
  situacao: SituacaoItem
}

function contratanteNome(l: any) {
  return l.contratante?.nome || l.contratado || l.empresa?.razaoSocial || 'Sem contratante'
}

function contratanteUf(l: any) {
  return l.contratante?.uf || ''
}

const COR_SITUACAO: Record<SituacaoItem, string> = {
  Vencedor: '#15803d',
  Perdido: 'var(--color-error-text)',
  Desclassificado: 'var(--color-error-text)',
  'Em aberto': '#6b7280',
}

const COLS: { width: string }[] = [
  { width: '7%' }, { width: '9%' }, { width: '20%' }, { width: '22%' }, { width: '12%' },
  { width: '7%' }, { width: '10%' }, { width: '13%' },
]

function Colgroup() {
  return <colgroup>{COLS.map((c, i) => <col key={i} style={{ width: c.width }} />)}</colgroup>
}

export default function RelatorioHistoricoItem() {
  // Carrega licitações/itens só quando a busca vira válida (2+ caracteres),
  // não no mount: a tela já exige uma busca pra mostrar qualquer resultado,
  // então buscar tudo de cara faria uma leitura cara (todas as licitações +
  // todos os itens) na maioria das vezes à toa.
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [licitacoes, setLicitacoes] = useState<any[]>([])
  const [itemsByCodigo, setItemsByCodigo] = useState<Record<string, any[]>>({})
  const [busca, setBusca] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('todos')
  const [dataInicioCustom, setDataInicioCustom] = useState('')
  const [dataFimCustom, setDataFimCustom] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [erro, setErro] = useState('')
  const hoje = nowInBrasilia().date

  const termoBusca = busca.trim().toLowerCase()
  const buscaValida = termoBusca.length >= 2

  useEffect(() => {
    if (!buscaValida || loaded) {
      // Busca apagada antes do fetch anterior terminar: sem isto o
      // `loading` ficava travado em `true` pra sempre, porque o fetch em
      // andamento vai descobrir `mounted = false` e nunca chega a desligá-lo.
      setLoading(false)
      return
    }
    let mounted = true
    setLoading(true)
    setErro('')
    const load = async () => {
      const list = await listLicitacoes()
      if (!mounted) return
      setLicitacoes(list)
      // Uma chamada só com `.in()`, em vez de uma por licitação (N+1).
      const porCodigo = await listItemsByCodigos(list.map((l: any) => l.codigo))
      if (!mounted) return
      setItemsByCodigo(porCodigo)
      setLoaded(true)
      setLoading(false)
    }
    load().catch(err => {
      if (!mounted) return
      setErro(err?.message || 'Não foi possível carregar o histórico de itens.')
      setLoading(false)
    })
    return () => { mounted = false }
  }, [buscaValida, loaded])

  const ocorrencias: Ocorrencia[] = !buscaValida ? [] : licitacoes
    .filter(l => dataDentroDoPeriodo(l.dataLicitacao, periodo, hoje, dataInicioCustom, dataFimCustom))
    .flatMap(l => {
      const items = itemsByCodigo[String(l.codigo)] || []
      return items
        .filter((it: any) => (it.descricao || '').toLowerCase().includes(termoBusca) || (it.marca || '').toLowerCase().includes(termoBusca))
        .map((it: any) => ({ licitacao: l, item: it, situacao: situacaoDoItem(l, it) }))
    })
    .sort((a, b) => (b.licitacao.dataLicitacao || '').localeCompare(a.licitacao.dataLicitacao || ''))

  const exportarExcel = () => {
    const linhas = ocorrencias.map(({ licitacao: l, item: it, situacao }) => ({
      Licitação: l.codigo,
      Data: formatDateTimeBR(l.dataLicitacao, l.horaLicitacao).split(' ')[0],
      Órgão: contratanteNome(l),
      UF: contratanteUf(l),
      Descrição: it.descricao || '',
      Marca: it.marca || '',
      Quantidade: Number(it.quantidade) || 0,
      'Custo Unit.': Number(it.valorCusto) || 0,
      'Custo Total': Number(it.totalCusto) || 0,
      Situação: situacao,
      // `undefined` (não '') pra célula ficar realmente vazia na planilha
      // em vez de virar texto misturado com número na mesma coluna.
      'Valor Ganho': it.vencedor ? Number(it.valorGanho) || 0 : undefined,
    }))
    exportRowsToExcel(linhas, 'historico_item.xlsx', 'Histórico de Item')
  }

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[220px] sm:max-w-sm">
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por descrição ou marca do item..."
            className="w-full p-2 rounded text-sm"
          />
          {busca && (
            <button type="button" onClick={() => setBusca('')} className="btn btn-ghost text-sm">Limpar</button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={exportarExcel} disabled={ocorrencias.length === 0} className="btn btn-ghost disabled:opacity-50">Exportar (Excel)</button>
          <button
            onClick={() => containerRef.current && exportElementsToPdf([containerRef.current], 'historico_item.pdf', 'Histórico de Item/Produto', 'landscape')}
            disabled={ocorrencias.length === 0}
            className="btn btn-primary disabled:opacity-50"
          >
            Exportar (PDF)
          </button>
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

      <div className="table-scroll">
      <div ref={containerRef} className="bg-white p-4 rounded shadow min-w-[980px]">
        <h3 className="text-xl font-bold text-center mb-1">Histórico de Item/Produto</h3>
        <div className="text-center text-xs text-gray-500 mb-4">
          {PERIODOS.find(p => p.id === periodo)?.label}
          {periodo === 'custom' && (dataInicioCustom || dataFimCustom) ? ` (${dataInicioCustom ? formatDateTimeBR(dataInicioCustom) : '…'} até ${dataFimCustom ? formatDateTimeBR(dataFimCustom) : 'hoje'})` : ''}
        </div>

        {erro && <p role="alert" className="text-sm mb-3" style={{ color: 'var(--color-error-text)' }}>{erro}</p>}
        {loading ? (
          <div className="text-sm text-gray-500">Carregando...</div>
        ) : erro ? null : !buscaValida ? (
          <div className="text-sm text-gray-500">
            Digite ao menos 2 caracteres do nome ou marca do item pra ver o histórico de cotações anteriores.
          </div>
        ) : ocorrencias.length === 0 ? (
          <div className="text-sm text-gray-500">Nenhuma ocorrência encontrada com "{busca}".</div>
        ) : (
          <>
            <div className="text-center text-xs text-gray-500 mb-4">
              {ocorrencias.length} ocorrência(s) encontrada(s) pra "{busca}"
            </div>
            <table className="w-full text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
              <Colgroup />
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="p-1.5">Licitação:</th>
                  <th className="p-1.5">Data:</th>
                  <th className="p-1.5">Órgão:</th>
                  <th className="p-1.5">Descrição:</th>
                  <th className="p-1.5">Marca:</th>
                  <th className="p-1.5 text-right">Qtde:</th>
                  <th className="p-1.5 text-right">Custo Unit.:</th>
                  <th className="p-1.5">Situação:</th>
                </tr>
              </thead>
              <tbody>
                {ocorrencias.map(({ licitacao: l, item: it, situacao }, i) => (
                  <tr key={`${l.codigo}-${i}`} className="border-t align-top">
                    <td className="p-1.5 font-semibold">
                      <Link to={`/licitacoes/${l.codigo}`} className="link-primary">{l.codigo}</Link>
                    </td>
                    <td className="p-1.5 whitespace-nowrap">{formatDateTimeBR(l.dataLicitacao, l.horaLicitacao).split(' ')[0]}</td>
                    <td className="p-1.5 truncate" title={`${contratanteNome(l)}${contratanteUf(l) ? ' / ' + contratanteUf(l) : ''}`}>
                      {contratanteNome(l)}{contratanteUf(l) ? ` / ${contratanteUf(l)}` : ''}
                    </td>
                    <td className="p-1.5">{it.descricao || '-'}</td>
                    <td className="p-1.5">{it.marca || '-'}</td>
                    <td className="p-1.5 text-right">{formatNumeric(it.quantidade, 0)}</td>
                    <td className="p-1.5 text-right">{formatFixed(it.valorCusto, 4)}</td>
                    <td className="p-1.5">
                      <span className="text-xs font-semibold" style={{ color: COR_SITUACAO[situacao] }}>
                        {situacao}{situacao === 'Vencedor' && it.valorGanho !== null && it.valorGanho !== undefined && it.valorGanho !== '' ? ` — ${formatFixed(it.valorGanho)}` : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
      </div>
    </div>
  )
}
