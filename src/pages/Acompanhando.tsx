import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deixarDeAcompanhar, linkPncp, listarAcompanhadas, type Acompanhada } from '../utils/radar'
import { linhaPrazo } from '../utils/conversa-radar'

// Só as licitações que a empresa acompanha (marcadas no Radar do site ou no bot do Telegram).
// Rascunho = ainda não virou cadastro; cadastrada = já tem código na lista de licitações.

type Aba = 'abertas' | 'encerradas'

function valorBR(v: number | null) {
  if (!v) return 'Valor não informado'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const aberta = (a: Acompanhada) => Boolean(a.encerramento && new Date(a.encerramento).getTime() > Date.now())

export default function Acompanhando() {
  const [lista, setLista] = useState<Acompanhada[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState<Aba>('abertas')
  const [confirmar, setConfirmar] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  useEffect(() => {
    listarAcompanhadas()
      .then(setLista)
      .catch(e => setErro(e?.message || 'Não foi possível carregar as acompanhadas.'))
      .finally(() => setCarregando(false))
  }, [])

  const deixar = async (a: Acompanhada) => {
    setOcupado(a.numeroControlePncp)
    setErro('')
    try {
      await deixarDeAcompanhar(a.numeroControlePncp)
      setLista(l => l.filter(x => x.numeroControlePncp !== a.numeroControlePncp))
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível salvar. Tente de novo.')
    } finally {
      setOcupado(null)
      setConfirmar(null)
    }
  }

  const abertas = lista.filter(aberta)
  const encerradas = lista.filter(a => !aberta(a))
  const mostradas = aba === 'abertas' ? abertas : encerradas

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-semibold">Acompanhando</h3>
          <p className="text-sm text-gray-500">As licitações que você marcou no Radar ou no Telegram, da que encerra primeiro para a que encerra depois.</p>
        </div>
        <Link to="/radar" className="btn btn-ghost">📋 Buscar no Radar</Link>
      </div>

      <div className="flex gap-2 mb-4" role="tablist" aria-label="Situação">
        {([['abertas', `Abertas (${abertas.length})`], ['encerradas', `Encerradas (${encerradas.length})`]] as [Aba, string][]).map(([id, rotulo]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)} className={aba === id ? 'btn btn-primary' : 'btn btn-ghost'}>
            {rotulo}
          </button>
        ))}
      </div>

      {erro && <p role="alert" className="text-sm mb-3" style={{ color: 'var(--color-error-text)' }}>{erro}</p>}
      {carregando && <p className="text-sm text-gray-500">Carregando…</p>}

      {!carregando && !erro && mostradas.length === 0 && (
        <div className="bg-white p-6 rounded shadow text-sm text-gray-600">
          {aba === 'abertas'
            ? <>Nenhuma licitação aberta sendo acompanhada. No <Link to="/radar" className="underline">Radar</Link>, toque em ⭐ Acompanhar para guardar aqui e receber os lembretes.</>
            : 'Nenhuma acompanhada encerrou ainda.'}
        </div>
      )}

      <div className="grid gap-3">
        {mostradas.map(a => {
          const n = a.numeroControlePncp
          const link = linkPncp(n) || a.link
          const local = [a.municipio, a.uf].filter(Boolean).join('/')
          return (
            <article key={n} className="bg-white p-4 rounded shadow grid gap-2" style={{ borderLeft: `4px solid ${a.codigo ? 'var(--color-accent)' : 'var(--color-primary)'}` }}>
              <div className="flex flex-wrap gap-2 items-start justify-between">
                <h4 className="font-semibold leading-snug min-w-0 flex-1">{a.objeto || 'Objeto não informado'}</h4>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 whitespace-nowrap">
                  {a.codigo ? `Cadastrada nº ${a.codigo}` : 'Rascunho'}
                </span>
              </div>
              <p className="text-sm text-gray-600">💰 {valorBR(a.valorEstimado)}{local ? ` · 📍 ${local}` : ''}{a.modalidade ? ` · ${a.modalidade}` : ''}</p>
              <p className="text-sm text-gray-600">⏰ {linhaPrazo(a.encerramento)} · 🏛️ {a.orgao || 'Órgão não informado'}</p>
              <div className="flex flex-wrap gap-2 items-center">
                {a.codigo ? (
                  <Link to={`/licitacoes/${a.codigo}`} className="btn btn-primary">Abrir licitação</Link>
                ) : a.processoId ? (
                  <Link to={`/licitacoes/novo?rascunho=${a.processoId}`} className="btn btn-primary">Continuar cadastro</Link>
                ) : null}
                {confirmar === n ? (
                  <>
                    <span className="text-sm text-gray-600">
                      {a.codigo ? 'Os lembretes param; o cadastro fica.' : 'Os lembretes param e o rascunho é apagado.'} Deixar de acompanhar?
                    </span>
                    <button type="button" className="btn btn-ghost" disabled={ocupado === n} onClick={() => deixar(a)}>Sim</button>
                    <button type="button" className="btn btn-ghost" onClick={() => setConfirmar(null)}>Cancelar</button>
                  </>
                ) : (
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirmar(n)}>Deixar de acompanhar</button>
                )}
                {link && <a href={link} target="_blank" rel="noreferrer" className="text-sm underline text-gray-600">Ver no PNCP</a>}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
