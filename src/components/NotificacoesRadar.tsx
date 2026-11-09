import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { lerNotificacoes, salvarNotificacoes, type NotificacoesRadar as Notificacoes } from '../utils/radar'

// O que chega sozinho, separado dos filtros (migração 0020 do banco do Radar).
// Os filtros dizem QUAIS licitações interessam; aqui a empresa escolhe SE e ONDE elas chegam.
// Todos veem; só o admin muda (o banco também confere). O mesmo ajuste existe no bot: /notificacoes.

type Chave = 'avisosLigados' | 'lembretesLigados' | 'avisosNoTelegram'

const OPCOES: { chave: Chave; titulo: string; ligado: string; desligado: string }[] = [
  {
    chave: 'avisosLigados',
    titulo: '📋 Licitações novas, todo dia de manhã',
    ligado: 'Ligadas: as que batem com os filtros chegam por volta das 6h.',
    desligado: 'Pausadas: nada novo chega. Os filtros continuam guardados e a busca do Radar funciona igual.',
  },
  {
    chave: 'lembretesLigados',
    titulo: '⏰ Lembretes de prazo',
    ligado: 'Ligados: avisos de impugnação e de encerramento das licitações que você acompanha, às 7h.',
    desligado: 'Desligados: os prazos continuam na página Acompanhando, mas nenhum lembrete chega.',
  },
]

export default function NotificacoesRadar() {
  const { user } = useAuth()
  const admin = user?.role === 'admin'
  const [n, setN] = useState<Notificacoes | null | undefined>(undefined)
  const [salvando, setSalvando] = useState<Chave | null>(null)
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    lerNotificacoes().then(setN).catch(e => setErro(e?.message || 'Não foi possível ler as notificações.'))
  }, [])

  const mudar = async (chave: Chave, valor: boolean) => {
    if (!n || !admin) return
    setSalvando(chave)
    setErro('')
    setMsg('')
    try {
      await salvarNotificacoes({ [chave]: valor })
      setN({ ...n, [chave]: valor })
      setMsg('Salvo. Vale a partir do próximo envio.')
    } catch (e: any) {
      setErro(e?.code === '42501' ? 'Só o admin da empresa muda as notificações.' : (e?.message || 'Não foi possível salvar.'))
    } finally {
      setSalvando(null)
    }
  }

  if (n === undefined && !erro) return <section className="bg-white p-4 rounded shadow mb-4 text-sm text-gray-600">Carregando notificações...</section>

  return (
    <section className="bg-white p-4 rounded shadow mb-4 grid gap-3 text-sm" aria-label="Notificações do Radar">
      <div>
        <h4 className="font-semibold text-base">🔔 Notificações</h4>
        <p className="text-gray-600">
          Aqui você escolhe se as licitações chegam sozinhas e onde. Quais licitações chegam quem decide são os filtros.
          {!admin && ' Só o admin da empresa muda estas opções.'}
        </p>
      </div>

      {n === null && (
        <p className="text-gray-600">Esta opção ainda não está disponível neste ambiente. Por enquanto tudo chega ligado.</p>
      )}

      {n && (
        <>
          {OPCOES.map(o => {
            const ligado = n[o.chave]
            return (
              <div key={o.chave} className="flex flex-wrap gap-3 items-center justify-between">
                <div className="grid gap-0.5" style={{ maxWidth: '40rem' }}>
                  <p className="font-semibold">{o.titulo}</p>
                  <p className="text-gray-600">{ligado ? o.ligado : o.desligado}</p>
                </div>
                {admin && (
                  <button type="button" className={ligado ? 'btn btn-ghost' : 'btn btn-primary'}
                    disabled={salvando !== null} aria-pressed={ligado} onClick={() => mudar(o.chave, !ligado)}>
                    {salvando === o.chave ? 'Salvando...' : ligado ? '⏸️ Pausar' : '▶️ Ligar'}
                  </button>
                )}
              </div>
            )
          })}

          <fieldset className="grid gap-1">
            <legend className="font-semibold mb-1">📍 Onde chegam</legend>
            {n.telegramConectado ? (
              <>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="onde-notificacoes" checked={n.avisosNoTelegram}
                    disabled={!admin || salvando !== null} onChange={() => mudar('avisosNoTelegram', true)} />
                  No Telegram e no sino do site
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="onde-notificacoes" checked={!n.avisosNoTelegram}
                    disabled={!admin || salvando !== null} onChange={() => mudar('avisosNoTelegram', false)} />
                  Só no sino do site (o Telegram continua conectado para buscas e acompanhamentos)
                </label>
              </>
            ) : (
              <p className="text-gray-600">Só no sino do site, porque o Telegram não está conectado. Conecte em ⚙️ Filtros e Telegram.</p>
            )}
          </fieldset>
        </>
      )}

      {msg && <p role="status" className="text-gray-600">{msg}</p>}
      {erro && <p role="alert" style={{ color: 'var(--color-error-text)' }}>{erro}</p>}
    </section>
  )
}
