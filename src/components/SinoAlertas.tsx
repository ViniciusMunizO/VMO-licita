import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconSino } from './NavIcons'
import { listarAlertas, contarNaoLidos, marcarLidos, type Alerta } from '../utils/alertas'

// Sino no topo: os mesmos avisos e lembretes que o Radar manda no Telegram.
// O número conta os não lidos da empresa (vale para todos da empresa).

const MINUTO = 60_000

function quando(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / MINUTO)
  if (min < 60) return min <= 1 ? 'agora' : `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
}

export default function SinoAlertas() {
  const [naoLidos, setNaoLidos] = useState(0)
  const [aberto, setAberto] = useState(false)
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [erro, setErro] = useState('')
  const caixa = useRef<HTMLDivElement>(null)
  const nav = useNavigate()

  // O robô roda de manhã; conferir a cada 5 minutos é suficiente.
  useEffect(() => {
    const contar = () => contarNaoLidos().then(setNaoLidos).catch(() => { /* sem sino até a próxima conferência */ })
    contar()
    const t = setInterval(contar, 5 * MINUTO)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto])

  const abrir = async () => {
    if (aberto) { setAberto(false); return }
    setAberto(true)
    setErro('')
    try {
      setAlertas(await listarAlertas())
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível carregar os alertas.')
    }
  }

  const marcarTodos = async () => {
    const ids = alertas.filter(a => !a.lido).map(a => a.id)
    try {
      await marcarLidos(ids)
      setAlertas(l => l.map(a => ({ ...a, lido: true })))
      setNaoLidos(n => Math.max(0, n - ids.length))
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível marcar como lido.')
    }
  }

  const abrirAlerta = async (a: Alerta) => {
    if (!a.lido) {
      marcarLidos([a.id]).catch(() => { /* fica não lido; nada se perde */ })
      setAlertas(l => l.map(x => x.id === a.id ? { ...x, lido: true } : x))
      setNaoLidos(n => Math.max(0, n - 1))
    }
    setAberto(false)
    nav('/radar')
  }

  return (
    <div className="relative" ref={caixa}>
      <button
        type="button"
        onClick={abrir}
        className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100"
        aria-label={naoLidos ? `Alertas: ${naoLidos} não lido(s)` : 'Alertas'}
        aria-expanded={aberto}
      >
        <IconSino />
        {naoLidos > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full text-[10px] font-semibold text-white flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-accent, #dc2626)' }}>
            {naoLidos > 99 ? '99+' : naoLidos}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-gray-100 z-30">
          <div className="flex justify-between items-center px-3 py-2 border-b border-gray-100">
            <span className="font-semibold text-sm">Alertas do Radar</span>
            {alertas.some(a => !a.lido) && (
              <button type="button" onClick={marcarTodos} className="text-xs underline text-gray-600">Marcar todos como lidos</button>
            )}
          </div>
          {erro && <p role="alert" className="text-sm p-3" style={{ color: 'var(--color-error-text)' }}>{erro}</p>}
          {!erro && alertas.length === 0 && (
            <p className="text-sm text-gray-600 p-3">Nenhum alerta ainda. Avisos de licitações novas e lembretes de prazo aparecem aqui.</p>
          )}
          <ul className="max-h-[60vh] overflow-y-auto">
            {alertas.map(a => (
              <li key={a.id}>
                <button type="button" onClick={() => abrirAlerta(a)}
                  className={`w-full text-left px-3 py-2 border-b border-gray-50 hover:bg-gray-50 ${a.lido ? 'text-gray-500' : ''}`}>
                  <span className="flex justify-between gap-2 text-xs text-gray-500">
                    <span>{a.tipo === 'lembrete' ? 'Lembrete de prazo' : 'Licitação nova'}</span>
                    <span>{quando(a.criadoEm)}</span>
                  </span>
                  <span className={`block text-sm leading-snug ${a.lido ? '' : 'font-semibold'}`}>{a.titulo}</span>
                  {a.texto && <span className="block text-xs text-gray-600 whitespace-pre-line line-clamp-3">{a.texto}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
