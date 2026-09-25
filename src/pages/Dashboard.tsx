import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listLicitacoes } from '../utils/licitacoes'
import { listItems } from '../utils/items'
import { combineDateTime, formatDateTimeBR } from '../utils/date'
import { formatMoneyBRL, margemPercentual, formatFixed } from '../utils/format'
import { listDocumentosEmpresa, diasParaVencer, DocumentoEmpresa } from '../utils/documentos'

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

// Há quanto tempo a licitação já passou da data, em linguagem do dia a dia —
// ajuda a priorizar o que está parado há mais tempo.
function haQuantoTempo(l: Licitacao, agora: number): string {
  const d = combineDateTime(l.dataLicitacao, l.horaLicitacao)
  if (!d) return ''
  const dias = Math.floor((agora - d.getTime()) / (1000 * 60 * 60 * 24))
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'há 1 dia'
  return `há ${dias} dias`
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
                  style={{ width: `${(d.count / max) * 100}%`, backgroundColor: 'var(--color-accent)' }}
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
  const [financeiro, setFinanceiro] = useState({ totalGanho: 0, totalCustoGanho: 0, totalEmAberto: 0 })
  const [documentosVencendo, setDocumentosVencendo] = useState<DocumentoEmpresa[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const list = (await listLicitacoes()) as Licitacao[]
      if (!mounted) return
      setLicitacoes(list)

      const itemLists = await Promise.all(list.map(l => listItems(l.codigo)))
      if (!mounted) return
      let total = 0
      let vencedores = 0
      let totalGanho = 0
      let totalCustoGanho = 0
      let totalEmAberto = 0
      list.forEach((l, i) => {
        const items = itemLists[i]
        if (!Array.isArray(items)) return
        total += items.length
        for (const it of items) {
          if (it?.vencedor) {
            vencedores++
            totalGanho += Number(it.valorGanho) || 0
            totalCustoGanho += Number(it.totalCusto) || 0
          } else if (!l.status) {
            // Licitação ainda sem resultado: o mínimo cotado é o valor "em
            // jogo" nesses itens até sair o resultado.
            totalEmAberto += Number(it.valorTotalMinimo) || 0
          }
        }
      })
      setItemCounts({ total, vencedores })
      setFinanceiro({ totalGanho, totalCustoGanho, totalEmAberto })
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    const hoje = new Date().toISOString().slice(0, 10)
    listDocumentosEmpresa().then(docs => {
      if (!mounted) return
      const vencendo = docs
        .filter(d => d.dataValidade)
        .map(d => ({ doc: d, dias: diasParaVencer(d.dataValidade, hoje) }))
        .filter((x): x is { doc: DocumentoEmpresa; dias: number } => x.dias !== null && x.dias <= 30)
        .sort((a, b) => a.dias - b.dias)
        .map(x => x.doc)
      setDocumentosVencendo(vencendo)
    }).catch(() => { /* card de documentos é informativo, não trava o resto do Dashboard */ })
    return () => { mounted = false }
  }, [])

  const currentYear = new Date().getFullYear()
  const now = Date.now()

  // "Em aberto" = ainda sem resultado lançado. Uma licitação já marcada como
  // Ganhou/Perdeu está encerrada e não é nem agenda nem pendência.
  const stats = useMemo(() => {
    const thisYear = licitacoes.filter(l => l.ano === currentYear).length
    const emAberto = licitacoes.filter(l => !l.status)
    const quando = (l: Licitacao) => combineDateTime(l.dataLicitacao, l.horaLicitacao)

    const proximas = emAberto.filter(l => {
      const d = quando(l)
      return d !== null && d.getTime() >= now
    })
    // Já passou da data e ninguém registrou o resultado: enquanto ficar
    // assim, a licitação não entra nos relatórios de ganhos/perdidos e
    // distorce a taxa de sucesso, sem nada quebrar pra avisar.
    const aguardandoResultado = emAberto.filter(l => {
      const d = quando(l)
      return d !== null && d.getTime() < now
    })

    return { total: licitacoes.length, thisYear, proximas, aguardandoResultado }
  }, [licitacoes, currentYear, now])

  const byTipoObjeto = useMemo(() => groupCount(licitacoes, l => l.tipoObjeto), [licitacoes])
  const byTipoDisputa = useMemo(() => groupCount(licitacoes, l => l.tipoDisputa), [licitacoes])

  const porData = (a: Licitacao, b: Licitacao) =>
    (combineDateTime(a.dataLicitacao, a.horaLicitacao)?.getTime() || 0) -
    (combineDateTime(b.dataLicitacao, b.horaLicitacao)?.getTime() || 0)

  // as mais próximas primeiro
  const proximas = useMemo(() => stats.proximas.slice().sort(porData).slice(0, 5), [stats.proximas])
  // as mais atrasadas primeiro
  const aguardando = useMemo(() => stats.aguardandoResultado.slice().sort(porData).slice(0, 5), [stats.aguardandoResultado])

  const recentes = useMemo(() => {
    return licitacoes.slice().sort((a, b) => (b.codigo || 0) - (a.codigo || 0)).slice(0, 5)
  }, [licitacoes])

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h2 className="text-xl sm:text-2xl font-semibold">Bem-vindo, {user?.name}</h2>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link to="/licitacoes/novo" className="btn btn-primary">Nova Licitação</Link>
          <Link to="/licitacoes" className="btn btn-ghost">Ver todas</Link>
          <button onClick={logout} className="btn btn-ghost text-sm">Sair</button>
        </div>
      </div>

      {documentosVencendo.length > 0 && (
        <div className="bg-white p-4 rounded shadow mb-6 border-l-4" style={{ borderColor: 'var(--color-error)' }}>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="font-semibold">Documentos vencendo</h4>
            <span
              className="text-xs font-semibold text-white px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--color-error)' }}
            >
              {documentosVencendo.length}
            </span>
          </div>
          <ul className="space-y-2">
            {documentosVencendo.map(d => {
              const dias = diasParaVencer(d.dataValidade, new Date().toISOString().slice(0, 10))!
              return (
                <li key={d.id} className="flex justify-between items-center gap-3 text-sm border-t pt-2 first:border-t-0 first:pt-0">
                  <span className="text-gray-700">{d.tipo}{d.numero ? ` — ${d.numero}` : ''}</span>
                  <span className="text-xs font-medium flex-shrink-0" style={{ color: dias < 0 ? 'var(--color-error)' : '#b45309' }}>
                    {dias < 0 ? `Venceu há ${Math.abs(dias)} dia(s)` : dias === 0 ? 'Vence hoje' : `Vence em ${dias} dia(s)`}
                  </span>
                </li>
              )
            })}
          </ul>
          <Link to="/empresa" className="text-xs link-primary mt-3 inline-block">Ver documentos da empresa</Link>
        </div>
      )}

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
            <StatTile label="Próximas licitações" value={stats.proximas.length} />
            <StatTile label="Itens cadastrados" value={itemCounts.total} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatTile label="Valor total ganho" value={formatMoneyBRL(financeiro.totalGanho)} />
            <StatTile label="Custo dos ganhos" value={formatMoneyBRL(financeiro.totalCustoGanho)} />
            <StatTile
              label="Margem dos ganhos"
              value={(() => {
                const m = margemPercentual(financeiro.totalGanho, financeiro.totalCustoGanho)
                return m === null ? '-' : `${formatFixed(m)}%`
              })()}
            />
            <StatTile label="Em jogo (aguardando resultado)" value={formatMoneyBRL(financeiro.totalEmAberto)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <BarList title="Por tipo de objeto" data={byTipoObjeto} />
            <BarList title="Por tipo de disputa" data={byTipoDisputa} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded shadow">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="font-semibold">Aguardando resultado</h4>
                {stats.aguardandoResultado.length > 0 && (
                  <span
                    className="text-xs font-semibold text-white px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--color-error)' }}
                  >
                    {stats.aguardandoResultado.length}
                  </span>
                )}
              </div>
              {aguardando.length === 0 ? (
                <div className="text-sm text-gray-500">Nenhuma licitação esperando resultado. Tudo em dia.</div>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-2">
                    Já passaram da data e ainda não têm Ganhou/Perdeu — até serem lançadas, ficam fora dos relatórios.
                  </p>
                  <ul className="space-y-2">
                    {aguardando.map((l, i) => (
                      <li key={`${l.codigo}-${i}`} className="flex justify-between items-center gap-3 text-sm border-t pt-2 first:border-t-0 first:pt-0">
                        <div className="min-w-0">
                          <Link to={`/licitacoes/${l.codigo}`} className="link-primary font-medium">{contratanteNome(l)}</Link>
                          <div className="text-gray-500">Código {l.codigo} • {l.tipoObjeto || 'Sem tipo'}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-gray-600">{formatDateTimeBR(l.dataLicitacao, l.horaLicitacao)}</div>
                          <div className="text-xs font-medium" style={{ color: 'var(--color-error)' }}>
                            {haQuantoTempo(l, now)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {stats.aguardandoResultado.length > aguardando.length && (
                    <p className="text-xs text-gray-500 mt-2">
                      + {stats.aguardandoResultado.length - aguardando.length} não exibida(s) aqui.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="bg-white p-4 rounded shadow">
              <h4 className="font-semibold mb-3">Próximas licitações</h4>
              {proximas.length === 0 ? (
                <div className="text-sm text-gray-500">Nenhuma licitação futura agendada</div>
              ) : (
                <ul className="space-y-2">
                  {proximas.map((l, i) => (
                    <li key={`${l.codigo}-${i}`} className="flex justify-between items-center gap-3 text-sm border-t pt-2 first:border-t-0 first:pt-0">
                      <div className="min-w-0">
                        <Link to={`/licitacoes/${l.codigo}`} className="link-primary font-medium">{contratanteNome(l)}</Link>
                        <div className="text-gray-500">Código {l.codigo} • {l.tipoObjeto || 'Sem tipo'}</div>
                      </div>
                      <div className="text-gray-600 flex-shrink-0">{formatDateTimeBR(l.dataLicitacao, l.horaLicitacao)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white p-4 rounded shadow">
              <h4 className="font-semibold mb-3">Últimas adicionadas</h4>
              <ul className="space-y-2">
                {recentes.map((l, i) => (
                  <li key={`${l.codigo}-${i}`} className="flex justify-between items-center gap-3 text-sm border-t pt-2 first:border-t-0 first:pt-0">
                    <div className="min-w-0">
                      <Link to={`/licitacoes/${l.codigo}`} className="link-primary font-medium">{contratanteNome(l)}</Link>
                      <div className="text-gray-500">Código {l.codigo} • Ano {l.ano}</div>
                    </div>
                    <div className="text-gray-600 flex-shrink-0">{formatDateTimeBR(l.dataLicitacao, l.horaLicitacao)}</div>
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
