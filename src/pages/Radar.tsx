import React, { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ConfigRadar from '../components/ConfigRadar'
import ChatRadar from '../components/ChatRadar'

// O Radar de Licitações dentro do site, em forma de conversa: funciona como o bot do Telegram.
// As licitações acompanhadas ficam na página Acompanhando.

export default function Radar() {
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [versaoFiltros, setVersaoFiltros] = useState(0)
  const painel = useRef<HTMLDivElement>(null)

  const abrirFiltros = () => {
    setFiltrosAbertos(true)
    setTimeout(() => painel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-semibold">Radar de Licitações</h3>
          <p className="text-sm text-gray-500">Converse como no bot do Telegram: toque nos botões ou escreva onde e quando.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/acompanhando" className="btn btn-ghost">⭐ Acompanhando</Link>
          <button type="button" className="btn btn-ghost" aria-expanded={filtrosAbertos} onClick={() => setFiltrosAbertos(a => !a)}>
            ⚙️ {filtrosAbertos ? 'Fechar filtros' : 'Filtros e Telegram'}
          </button>
        </div>
      </div>

      <div ref={painel}>
        {filtrosAbertos && <ConfigRadar onFiltrosSalvos={() => setVersaoFiltros(v => v + 1)} />}
      </div>

      <ChatRadar onAbrirFiltros={abrirFiltros} versaoFiltros={versaoFiltros} />
    </div>
  )
}
