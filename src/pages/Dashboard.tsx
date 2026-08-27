import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { dbGet, migrateFromLocalStorage } from '../utils/db'
import { combineDateTime, formatDateTimeBR } from '../utils/date'

type Licitacao = {
  codigo: number
  ano: number
  contratado?: string
  contratante?: { codigo?: number; nome?: string }
  empresa?: { razaoSocial?: string }
  dataLicitacao?: string
  horaLicitacao?: string
  tipoObjeto?: string
  tipoDisputa?: string
  [key: string]: any
}

function contratanteNome(l: Licitacao) {
  return l.contratante?.nome || l.contratado || l.empresa?.razaoSocial || 'Sem contratante'
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-3xl font-semibold mt-1" style={{ color: 'var(--color-primary)' }}>{value}</div>
    </div>
  )
}

function BarList({ title, data }: { title: string; data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.count))
  return (
    <div className="bg-white p-4 rounded shadow">
      <h4 className="font-semibold mb-3">{title}</h4>
      {data.length === 0 ? (
        <div className="text-sm text-gray-500">Sem dados</div>
      ) : (
        <div className="space-y-2">
          {data.map(d => (
            <div key={d.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700">{d.label}</span>
                <span className="text-gray-500">{d.count}</span>
              </div>
              <div className="h-2 rounded bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{ width: `${(d.count / max) * 100}%`, backgroundColor: 'var(--color-primary)' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([])
  const [itemCounts, setItemCounts] = useState({ total: 0, vencedores: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      await migrateFromLocalStorage()
      const list = ((await dbGet('licitacoes')) || []) as Licitacao[]
      if (!mounted) return
      setLicitacoes(list)

      const itemLists = await Promise.all(list.map(l => dbGet(`items_${l.codigo}`)))
      if (!mounted) return
      let total = 0
      let vencedores = 0
      for (const items of itemLists) {
        if (!Array.isArray(items)) continue
        total += items.length
        vencedores += items.filter((it: any) => it?.vencedor).length
      }
      setItemCounts({ total, vencedores })
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [])

  const currentYear = new Date().getFullYear()
  const now = Date.now()

  const stats = useMemo(() => {
    const thisYear = licitacoes.filter(l => l.ano === currentYear).length
    const upcoming = licitacoes.filter(l => {
      const d = combineDateTime(l.dataLicitacao, l.horaLicitacao)
      return d !== null && d.getTime() >= now
    })
    return { total: licitacoes.length, thisYear, upcomingCount: upcoming.length, upcoming }
  }, [licitacoes, currentYear, now])

  const byTipoObjeto = useMemo(() => groupCount(licitacoes, l => l.tipoObjeto), [licitacoes])
  const byTipoDisputa = useMemo(() => groupCount(licitacoes, l => l.tipoDisputa), [licitacoes])

  const proximas = useMemo(() => {
    return stats.upcoming
      .slice()
      .sort((a, b) => (combineDateTime(a.dataLicitacao, a.horaLicitacao)?.getTime() || 0) - (combineDateTime(b.dataLicitacao, b.horaLicitacao)?.getTime() || 0))
      .slice(0, 5)
  }, [stats.upcoming])

  const recentes = useMemo(() => {
    return licitacoes.slice().sort((a, b) => (b.codigo || 0) - (a.codigo || 0)).slice(0, 5)
  }, [licitacoes])

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Bem-vindo, {user?.name}</h2>
        <div className="flex items-center gap-3">
          <Link to="/licitacoes/novo" className="btn btn-primary">Nova Licitação</Link>
          <Link to="/licitacoes" className="btn btn-ghost">Ver todas</Link>
          <button onClick={logout} className="btn btn-ghost text-sm">Sair</button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Carregando...</div>
      ) : licitacoes.length === 0 ? (
        <div className="bg-white p-6 rounded shadow text-center">
          <p className="text-gray-600">Nenhuma licitação cadastrada ainda.</p>
          <Link to="/licitacoes/novo" className="btn btn-primary mt-4 inline-flex">Cadastrar a primeira licitação</Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatTile label="Total de licitações" value={stats.total} />
            <StatTile label={`Cadastradas em ${currentYear}`} value={stats.thisYear} />
            <StatTile label="Próximas licitações" value={stats.upcomingCount} />
            <StatTile label="Itens cadastrados" value={itemCounts.total} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <BarList title="Por tipo de objeto" data={byTipoObjeto} />
            <BarList title="Por tipo de disputa" data={byTipoDisputa} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded shadow">
              <h4 className="font-semibold mb-3">Próximas licitações</h4>
              {proximas.length === 0 ? (
                <div className="text-sm text-gray-500">Nenhuma licitação futura agendada</div>
              ) : (
                <ul className="space-y-2">
                  {proximas.map((l, i) => (
                    <li key={`${l.codigo}-${i}`} className="flex justify-between items-center text-sm border-t pt-2 first:border-t-0 first:pt-0">
                      <div>
                        <Link to={`/licitacoes/${l.codigo}`} className="link-primary font-medium">{contratanteNome(l)}</Link>
                        <div className="text-gray-500">Código {l.codigo} • {l.tipoObjeto || 'Sem tipo'}</div>
                      </div>
                      <div className="text-gray-600">{formatDateTimeBR(l.dataLicitacao, l.horaLicitacao)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white p-4 rounded shadow">
              <h4 className="font-semibold mb-3">Últimas adicionadas</h4>
              <ul className="space-y-2">
                {recentes.map((l, i) => (
                  <li key={`${l.codigo}-${i}`} className="flex justify-between items-center text-sm border-t pt-2 first:border-t-0 first:pt-0">
                    <div>
                      <Link to={`/licitacoes/${l.codigo}`} className="link-primary font-medium">{contratanteNome(l)}</Link>
                      <div className="text-gray-500">Código {l.codigo} • Ano {l.ano}</div>
                    </div>
                    <div className="text-gray-600">{formatDateTimeBR(l.dataLicitacao, l.horaLicitacao)}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function groupCount(list: Licitacao[], pick: (l: Licitacao) => string | undefined) {
  const counts = new Map<string, number>()
  for (const l of list) {
    const key = pick(l) || 'Não informado'
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}
