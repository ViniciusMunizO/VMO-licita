import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { listLicitacoes } from '../../utils/licitacoes'
import { listItems } from '../../utils/items'
import { formatDateTimeBR } from '../../utils/date'
import { formatNumeric, formatFixed } from '../../utils/format'
import { agruparPorLote, somaColuna } from '../../utils/itens'
import { exportElementsToPdf } from '../../utils/pdf'

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
  const containerRef = useRef<HTMLDivElement | null>(null)

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

      <div ref={containerRef} className="bg-white p-4 rounded shadow overflow-x-auto">
        <h3 className="text-xl font-bold text-center mb-4">Relatório Geral de Itens Perdidos</h3>
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
