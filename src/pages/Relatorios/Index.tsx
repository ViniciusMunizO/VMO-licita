import React, { useState } from 'react'
import RelatorioGanhos from './Ganhos'
import RelatorioItensPerdidos from './ItensPerdidos'
import RelatorioItensDesclassificados from './ItensDesclassificados'
import RelatorioStatusLicitacoes from './StatusLicitacoes'
import RelatorioHistoricoItem from './HistoricoItem'

type TipoRelatorio = 'status' | 'ganhos' | 'itensPerdidos' | 'desclassificadas' | 'historicoItem'

const TIPOS: { id: TipoRelatorio; label: string; disponivel: boolean }[] = [
  { id: 'status', label: 'Status das Licitações', disponivel: true },
  { id: 'ganhos', label: 'Itens Ganhos', disponivel: true },
  { id: 'itensPerdidos', label: 'Itens Perdidos', disponivel: true },
  { id: 'desclassificadas', label: 'Itens Desclassificados', disponivel: true },
  { id: 'historicoItem', label: 'Histórico de Item', disponivel: true },
]

export default function RelatoriosIndex() {
  const [tipo, setTipo] = useState<TipoRelatorio>('status')

  return (
    <div>
      <h3 className="text-xl sm:text-2xl font-semibold mb-4">Relatórios</h3>

      <div className="flex gap-2 mb-6 border-b table-scroll">
        {TIPOS.map(t => (
          <button
            key={t.id}
            type="button"
            disabled={!t.disponivel}
            onClick={() => setTipo(t.id)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px whitespace-nowrap flex-shrink-0 ${
              tipo === t.id
                ? 'border-current font-semibold'
                : 'border-transparent text-gray-500'
            } ${!t.disponivel ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-800'}`}
            style={tipo === t.id ? { color: 'var(--color-primary)' } : undefined}
            title={t.disponivel ? undefined : 'Em breve'}
          >
            {t.label}{!t.disponivel && <span className="ml-1 text-xs">(em breve)</span>}
          </button>
        ))}
      </div>

      {tipo === 'status' && <RelatorioStatusLicitacoes />}
      {tipo === 'ganhos' && <RelatorioGanhos />}
      {tipo === 'itensPerdidos' && <RelatorioItensPerdidos />}
      {tipo === 'desclassificadas' && <RelatorioItensDesclassificados />}
      {tipo === 'historicoItem' && <RelatorioHistoricoItem />}
    </div>
  )
}
