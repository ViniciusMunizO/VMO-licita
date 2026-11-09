import React, { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ConfigRadar from '../components/ConfigRadar'
import ChatRadar from '../components/ChatRadar'
import NotificacoesRadar from '../components/NotificacoesRadar'

// O Radar de Licitações dentro do site, em forma de conversa: funciona como o bot do Telegram.
// As licitações acompanhadas ficam na página Acompanhando.

export default function Radar() {
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  // Notificações ficam num painel à parte dos filtros: um abre e o outro fecha.
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false)
  const [versaoFiltros, setVersaoFiltros] = useState(0)
  const painel = useRef<HTMLDivElement>(null)

  const alternarFiltros = () => {
    setNotificacoesAbertas(false)
    setFiltrosAbertos(a => !a)
  }
  const alternarNotificacoes = () => {
    setFiltrosAbertos(false)
    setNotificacoesAbertas(a => !a)
  }

  const abrirFiltros = () => {
    setNotificacoesAbertas(false)
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
          <button type="button" className="btn btn-ghost" aria-expanded={filtrosAbertos} onClick={alternarFiltros}>
            ⚙️ {filtrosAbertos ? 'Fechar filtros' : 'Filtros e Telegram'}
          </button>
          <button type="button" className="btn btn-ghost" aria-expanded={notificacoesAbertas} onClick={alternarNotificacoes}>
            🔔 {notificacoesAbertas ? 'Fechar notificações' : 'Notificações'}
          </button>
        </div>
      </div>

      <div ref={painel}>
        {filtrosAbertos && <ConfigRadar onFiltrosSalvos={() => setVersaoFiltros(v => v + 1)} />}
        {notificacoesAbertas && <NotificacoesRadar />}
      </div>

      <ChatRadar onAbrirFiltros={abrirFiltros} versaoFiltros={versaoFiltros} />
    </div>
  )
}
