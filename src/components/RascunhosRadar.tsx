import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listRascunhos } from '../utils/licitacoes'
import { deixarDeAcompanhar } from '../utils/radar'
import { formatDateBR } from '../utils/date'

// Licitações que alguém marcou "Acompanhar" (no Radar do site ou no bot) e ainda
// não viraram cadastro. Continuar abre o formulário já preenchido com o que o
// PNCP tem; Remover para os lembretes e apaga o rascunho.

export default function RascunhosRadar() {
  const [lista, setLista] = useState<any[]>([])
  const [erro, setErro] = useState('')
  const [confirmar, setConfirmar] = useState<string | null>(null)

  useEffect(() => {
    listRascunhos().then(setLista).catch(e => setErro(e?.message || 'Não foi possível carregar os rascunhos.'))
  }, [])

  const remover = async (r: any) => {
    setErro('')
    try {
      await deixarDeAcompanhar(r.numeroControlePncp)
      setLista(l => l.filter(x => x.processoId !== r.processoId))
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível remover o rascunho.')
    } finally {
      setConfirmar(null)
    }
  }

  if (!lista.length && !erro) return null

  return (
    <section className="bg-white p-4 rounded shadow mb-4" aria-labelledby="rascunhos-titulo">
      <div className="flex flex-wrap justify-between items-baseline gap-2 mb-2">
        <h4 id="rascunhos-titulo" className="font-semibold">Rascunhos do Radar ({lista.length})</h4>
        <Link to="/radar" className="text-sm underline text-gray-600">Abrir o Radar</Link>
      </div>
      <p className="text-sm text-gray-500 mb-3">Licitações acompanhadas que ainda não viraram cadastro. Elas não entram no painel nem nos relatórios.</p>
      {erro && <p role="alert" className="text-sm mb-2" style={{ color: 'var(--color-error-text)' }}>{erro}</p>}
      <ul className="grid gap-2">
        {lista.map(r => (
          <li key={r.processoId} className="border border-gray-200 rounded p-3 flex flex-wrap gap-3 items-center justify-between">
            <div className="min-w-0">
              <p className="font-medium leading-snug">{r.objetoLicitacao || 'Objeto não informado'}</p>
              <p className="text-sm text-gray-600">
                {[r.contratante?.nome, r.contratante?.uf].filter(Boolean).join(' / ') || 'Órgão não informado'}
                {r.dataLicitacao ? ` · licitação em ${formatDateBR(r.dataLicitacao)}${r.horaLicitacao ? ` às ${r.horaLicitacao}` : ''}` : ''}
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <Link to={`/licitacoes/novo?rascunho=${r.processoId}`} className="btn btn-primary">Continuar cadastro</Link>
              {confirmar === r.processoId ? (
                <>
                  <button type="button" className="btn btn-ghost" onClick={() => remover(r)}>Sim, remover</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirmar(null)}>Cancelar</button>
                </>
              ) : (
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmar(r.processoId)}>Remover</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
