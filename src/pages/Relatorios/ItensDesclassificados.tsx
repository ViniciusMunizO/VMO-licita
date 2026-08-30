import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { listLicitacoes } from '../../utils/licitacoes'
import { listItems } from '../../utils/items'
import { formatDateTimeBR } from '../../utils/date'
import { formatNumeric, formatFixed } from '../../utils/format'
import { agruparPorLote, somaColuna } from '../../utils/itens'
import { exportElementsToPdf } from '../../utils/pdf'

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

  const desclassificados: LicitacaoDesclassificada[] = licitacoes
    .map(l => ({ licitacao: l, itensDesclassificados: (itemsByCodigo[String(l.codigo)] || []).filter((it: any) => it.desclassificado) }))
    .filter(g => g.itensDesclassificados.length > 0)

  const todosItensDesclassificados = desclassificados.flatMap(g => g.itensDesclassificados)

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => containerRef.current && exportElementsToPdf([containerRef.current], 'relatorio_itens_desclassificados.pdf', 'Relatório - Licitações/Itens Desclassificadas', 'landscape')}
          className="btn btn-primary"
        >
          Exportar (PDF)
        </button>
      </div>

      <div ref={containerRef} className="bg-white p-4 rounded shadow overflow-x-auto">
        <h3 className="text-xl font-bold text-center mb-4">Relatório - Licitações/Itens Desclassificadas - Detalhado</h3>

        {loading ? (
          <div className="text-sm text-gray-500">Carregando...</div>
        ) : desclassificados.length === 0 ? (
          <div className="text-sm text-gray-500">Nenhum item desclassificado cadastrado ainda.</div>
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
  )
}
