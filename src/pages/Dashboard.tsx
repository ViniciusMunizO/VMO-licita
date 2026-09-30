import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listLicitacoes } from '../utils/licitacoes'
import { listItemsByCodigos } from '../utils/items'
import { combineDateTime, formatDateTimeBR, nowInBrasilia, splitLegacyDateTime, diasParaVencer } from '../utils/date'
import { formatMoneyBRL, margemPercentual, formatFixed } from '../utils/format'
import { situacaoDoItem } from '../utils/itens'
import { listDocumentosEmpresa, DocumentoEmpresa } from '../utils/documentos'
import { getMeta, saveMeta, Meta } from '../utils/metas'

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

function StatTile({ label, value, destaque }: { label: string; value: number | string; destaque?: boolean }) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <div className="text-sm text-gray-500">{label}</div>
      <div
        className={destaque ? 'text-3xl font-bold mt-1' : 'text-3xl font-semibold mt-1'}
        style={{ color: destaque ? 'var(--color-accent)' : 'var(--color-primary)' }}
      >
        {value}
      </div>
    </div>
  )
}

// Últimos `meses` (incluindo o atual), mais antigo primeiro — mês sem
// nenhuma licitação decidida ainda aparece na lista, com taxa "-".
// `hojeISO` vem de `nowInBrasilia().date`: usar `new Date()` local faria o
// mês virar antes da hora perto da virada, dependendo do fuso do navegador.
function ultimosMeses(qtd: number, hojeISO: string): { chave: string; label: string }[] {
  const out: { chave: string; label: string }[] = []
  const [anoHoje, mesHoje] = hojeISO.split('-').map(Number)
  for (let i = qtd - 1; i >= 0; i--) {
    const d = new Date(anoHoje, mesHoje - 1 - i, 1)
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(d).replace(/\./g, '')
    out.push({ chave, label })
  }
  return out
}

function EvolucaoMensal({ licitacoes, hoje }: { licitacoes: Licitacao[]; hoje: string }) {
  const meses = useMemo(() => {
    const janelas = ultimosMeses(6, hoje)
    const porChave = new Map<string, { ganhou: number; perdeu: number }>()
    for (const l of licitacoes) {
      if (l.status !== 'Ganhou' && l.status !== 'Perdeu') continue
      const { date } = splitLegacyDateTime(l.dataLicitacao)
      if (!date) continue
      const chave = date.slice(0, 7)
      if (!porChave.has(chave)) porChave.set(chave, { ganhou: 0, perdeu: 0 })
      const c = porChave.get(chave)!
      if (l.status === 'Ganhou') c.ganhou++
      else c.perdeu++
    }
    return janelas.map(j => {
      const c = porChave.get(j.chave) || { ganhou: 0, perdeu: 0 }
      const total = c.ganhou + c.perdeu
      const taxa = total > 0 ? (c.ganhou / total) * 100 : null
      return { ...j, ...c, total, taxa }
    })
  }, [licitacoes, hoje])

  const maxTotal = Math.max(1, ...meses.map(m => m.total))

  return (
    <div className="bg-white p-4 rounded shadow">
      <h4 className="font-semibold mb-3">Evolução mensal (Ganhou x Perdeu)</h4>
      {meses.every(m => m.total === 0) ? (
        <div className="text-sm text-gray-500">Nenhuma licitação decidida nos últimos 6 meses.</div>
      ) : (
        <div className="space-y-2">
          {meses.map(m => (
            <div key={m.chave}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700 capitalize">{m.label}</span>
                <span className="text-gray-500">
                  {m.total === 0 ? 'sem dados' : `${m.ganhou}G / ${m.perdeu}P — ${formatFixed(m.taxa!, 0)}%`}
                </span>
              </div>
              <div className="h-2 rounded bg-gray-100 overflow-hidden flex">
                {m.total > 0 && (
                  <>
                    <div className="h-full" style={{ width: `${(m.ganhou / maxTotal) * 100}%`, backgroundColor: '#15803d' }} />
                    <div className="h-full" style={{ width: `${(m.perdeu / maxTotal) * 100}%`, backgroundColor: 'var(--color-error)' }} />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MetaDoMesCard({ periodo, ganhoRealizado, taxaRealizada, isAdmin }: {
  periodo: string
  ganhoRealizado: number
  taxaRealizada: number | null
  isAdmin: boolean
}) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [valorAlvo, setValorAlvo] = useState('')
  const [taxaAlvo, setTaxaAlvo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let mounted = true
    setLoading(true)
    getMeta(periodo).then(m => {
      if (!mounted) return
      setMeta(m)
      setValorAlvo(m?.valorAlvoGanho != null ? String(m.valorAlvoGanho) : '')
      setTaxaAlvo(m?.taxaAlvoSucesso != null ? String(m.taxaAlvoSucesso) : '')
      setLoading(false)
    }).catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [periodo])

  // Abre o formulário sempre a partir do valor real salvo — sem isto, um
  // rascunho digitado e depois descartado com "Cancelar" ficava preso em
  // `valorAlvo`/`taxaAlvo` (só são sincronizados com `meta` no mount) e
  // reaparecia da próxima vez que o admin clicasse em "Editar", parecendo
  // que a meta salva não avançou ou até sobrescrevendo-a por engano.
  const abrirEdicao = () => {
    setValorAlvo(meta?.valorAlvoGanho != null ? String(meta.valorAlvoGanho) : '')
    setTaxaAlvo(meta?.taxaAlvoSucesso != null ? String(meta.taxaAlvoSucesso) : '')
    setErro('')
    setEditando(true)
  }

  const salvar = async () => {
    setSalvando(true)
    setErro('')
    try {
      const v = valorAlvo.trim() === '' ? null : Number(valorAlvo.replace(',', '.'))
      const t = taxaAlvo.trim() === '' ? null : Number(taxaAlvo.replace(',', '.'))
      if ((v !== null && !Number.isFinite(v)) || (t !== null && !Number.isFinite(t))) {
        setErro('Valor inválido.')
        return
      }
      const saved = await saveMeta(periodo, v, t)
      setMeta(saved)
      setEditando(false)
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível salvar a meta.')
    } finally {
      setSalvando(false)
    }
  }

  // Card silencioso enquanto carrega — o Dashboard já tem "Carregando..."
  // pro resto da tela, duplicar o aviso aqui só polui.
  if (loading) return null

  const semMeta = !meta || (meta.valorAlvoGanho == null && meta.taxaAlvoSucesso == null)

  return (
    <div className="bg-white p-4 rounded shadow">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="font-semibold">Meta do mês</h4>
        {isAdmin && !editando && (
          <button type="button" onClick={abrirEdicao} className="text-xs link-primary">
            {semMeta ? 'Definir meta' : 'Editar'}
          </button>
        )}
      </div>

      {editando ? (
        <div className="space-y-2">
          <div>
            <label htmlFor="meta-valor" className="block text-xs text-gray-600">Valor a ganhar (R$)</label>
            <input id="meta-valor" value={valorAlvo} onChange={e => setValorAlvo(e.target.value)} className="w-full p-2 rounded text-sm" placeholder="ex.: 50000" />
          </div>
          <div>
            <label htmlFor="meta-taxa" className="block text-xs text-gray-600">Taxa de sucesso (%)</label>
            <input id="meta-taxa" value={taxaAlvo} onChange={e => setTaxaAlvo(e.target.value)} className="w-full p-2 rounded text-sm" placeholder="ex.: 60" />
          </div>
          {erro && <p role="alert" className="text-xs" style={{ color: 'var(--color-error-text)' }}>{erro}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={salvar} disabled={salvando} className="btn btn-primary text-xs disabled:opacity-50">{salvando ? 'Salvando...' : 'Salvar'}</button>
            <button type="button" onClick={() => setEditando(false)} className="btn btn-ghost text-xs">Cancelar</button>
          </div>
        </div>
      ) : semMeta ? (
        <div className="text-sm text-gray-500">Nenhuma meta definida para este mês.</div>
      ) : (
        <div className="space-y-3">
          {meta!.valorAlvoGanho != null && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700">Valor ganho</span>
                <span className="text-gray-500">{formatMoneyBRL(ganhoRealizado)} / {formatMoneyBRL(meta!.valorAlvoGanho)}</span>
              </div>
              <div className="h-2 rounded bg-gray-100 overflow-hidden">
                <div className="h-full rounded" style={{ width: `${Math.min(100, (ganhoRealizado / meta!.valorAlvoGanho) * 100)}%`, backgroundColor: 'var(--color-accent)' }} />
              </div>
            </div>
          )}
          {meta!.taxaAlvoSucesso != null && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700">Taxa de sucesso</span>
                <span className="text-gray-500">{taxaRealizada === null ? '-' : `${formatFixed(taxaRealizada, 0)}%`} / {formatFixed(meta!.taxaAlvoSucesso, 0)}%</span>
              </div>
              <div className="h-2 rounded bg-gray-100 overflow-hidden">
                <div className="h-full rounded" style={{ width: `${Math.min(100, ((taxaRealizada || 0) / meta!.taxaAlvoSucesso) * 100)}%`, backgroundColor: 'var(--color-accent)' }} />
              </div>
            </div>
          )}
        </div>
      )}
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
  const [financeiro, setFinanceiro] = useState({ totalGanho: 0, totalCustoGanho: 0, totalEmAberto: 0, ganhoMesAtual: 0 })
  const [documentosVencendo, setDocumentosVencendo] = useState<DocumentoEmpresa[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const list = (await listLicitacoes()) as Licitacao[]
      if (!mounted) return
      setLicitacoes(list)

      // Uma chamada só com `.in()` pra todos os itens de todas as licitações,
      // em vez de uma chamada por licitação (N+1) — ver listItemsByCodigos.
      const itemsPorCodigo = await listItemsByCodigos(list.map(l => l.codigo))
      if (!mounted) return
      let total = 0
      let vencedores = 0
      let totalGanho = 0
      let totalCustoGanho = 0
      let totalEmAberto = 0
      let ganhoMesAtual = 0
      const mesAtual = nowInBrasilia().date.slice(0, 7)
      for (const l of list) {
        const items = itemsPorCodigo[String(l.codigo)] || []
        total += items.length
        const mesLicitacao = splitLegacyDateTime(l.dataLicitacao).date.slice(0, 7)
        for (const it of items) {
          const situacao = situacaoDoItem(l, it)
          if (situacao === 'Vencedor') {
            vencedores++
            totalGanho += Number(it.valorGanho) || 0
            totalCustoGanho += Number(it.totalCusto) || 0
            if (mesLicitacao === mesAtual) ganhoMesAtual += Number(it.valorGanho) || 0
          } else if (situacao === 'Em aberto') {
            // Licitação ainda sem resultado: o mínimo cotado é o valor "em
            // jogo" nesse item até sair o resultado.
            totalEmAberto += Number(it.valorTotalMinimo) || 0
          }
        }
      }
      setItemCounts({ total, vencedores })
      setFinanceiro({ totalGanho, totalCustoGanho, totalEmAberto, ganhoMesAtual })
      setLoading(false)
    }
    load().catch(err => {
      if (!mounted) return
      setErro(err?.message || 'Não foi possível carregar o painel.')
      setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    const hoje = nowInBrasilia().date
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
  const hoje = nowInBrasilia().date

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

    const ganhou = licitacoes.filter(l => l.status === 'Ganhou').length
    const perdeu = licitacoes.filter(l => l.status === 'Perdeu').length
    const decididas = ganhou + perdeu
    const taxaSucesso = decididas > 0 ? (ganhou / decididas) * 100 : null

    return { total: licitacoes.length, thisYear, proximas, aguardandoResultado, taxaSucesso, decididas }
  }, [licitacoes, currentYear, now])

  // Taxa de sucesso só das licitações decididas dentro do mês corrente —
  // usada pra comparar com a meta do mês, separado da taxa geral (`stats`,
  // que soma o histórico inteiro).
  const statsMesAtual = useMemo(() => {
    const doMes = licitacoes.filter(l => splitLegacyDateTime(l.dataLicitacao).date.slice(0, 7) === hoje.slice(0, 7))
    const ganhou = doMes.filter(l => l.status === 'Ganhou').length
    const perdeu = doMes.filter(l => l.status === 'Perdeu').length
    const decididas = ganhou + perdeu
    return { taxaSucesso: decididas > 0 ? (ganhou / decididas) * 100 : null, decididas }
  }, [licitacoes, hoje])

  // Prazos de recurso/impugnação que vencem nos próximos 10 dias, ou já
  // vencidos — a licitação só some daqui quando o campo é limpo no
  // cadastro (não some sozinho por já ter status Ganhou/Perdeu, porque o
  // prazo pode ter passado antes do resultado sair).
  const prazosProximos = useMemo(() => {
    const out: { codigo: number; contratante: string; tipo: string; dias: number }[] = []
    for (const l of licitacoes) {
      for (const [campo, tipo] of [['dataLimiteRecurso', 'Recurso'], ['dataLimiteImpugnacao', 'Impugnação']] as const) {
        const dias = diasParaVencer(l[campo], hoje)
        if (dias !== null && dias <= 10) out.push({ codigo: l.codigo, contratante: contratanteNome(l), tipo, dias })
      }
    }
    return out.sort((a, b) => a.dias - b.dias)
  }, [licitacoes, hoje])

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
              style={{ backgroundColor: 'var(--color-error-text)' }}
            >
              {documentosVencendo.length}
            </span>
          </div>
          <ul className="space-y-2">
            {documentosVencendo.map(d => {
              const dias = diasParaVencer(d.dataValidade, hoje)!
              return (
                <li key={d.id} className="flex justify-between items-center gap-3 text-sm border-t pt-2 first:border-t-0 first:pt-0">
                  <span className="text-gray-700">{d.tipo}{d.numero ? ` — ${d.numero}` : ''}</span>
                  <span className="text-xs font-medium flex-shrink-0" style={{ color: dias < 0 ? 'var(--color-error-text)' : '#b45309' }}>
                    {dias < 0 ? `Venceu há ${Math.abs(dias)} dia(s)` : dias === 0 ? 'Vence hoje' : `Vence em ${dias} dia(s)`}
                  </span>
                </li>
              )
            })}
          </ul>
          <Link to="/empresa" className="text-xs link-primary mt-3 inline-block">Ver documentos da empresa</Link>
        </div>
      )}

      {prazosProximos.length > 0 && (
        <div className="bg-white p-4 rounded shadow mb-6 border-l-4" style={{ borderColor: 'var(--color-error)' }}>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="font-semibold">Prazos de recurso/impugnação</h4>
            <span
              className="text-xs font-semibold text-white px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--color-error-text)' }}
            >
              {prazosProximos.length}
            </span>
          </div>
          <ul className="space-y-2">
            {prazosProximos.map((p, i) => (
              <li key={`${p.codigo}-${p.tipo}-${i}`} className="flex justify-between items-center gap-3 text-sm border-t pt-2 first:border-t-0 first:pt-0">
                <Link to={`/licitacoes/${p.codigo}`} className="link-primary">
                  {p.tipo} — {p.contratante} <span className="text-gray-500">(código {p.codigo})</span>
                </Link>
                <span className="text-xs font-medium flex-shrink-0" style={{ color: p.dias < 0 ? 'var(--color-error-text)' : '#b45309' }}>
                  {p.dias < 0 ? `Venceu há ${Math.abs(p.dias)} dia(s)` : p.dias === 0 ? 'Vence hoje' : `Vence em ${p.dias} dia(s)`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {erro && <p role="alert" className="text-sm mb-3" style={{ color: 'var(--color-error-text)' }}>{erro}</p>}

      {loading ? (
        <div className="text-sm text-gray-500">Carregando...</div>
      ) : erro ? null : licitacoes.length === 0 ? (
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
            <StatTile label="Valor total ganho" value={formatMoneyBRL(financeiro.totalGanho)} destaque />
            <StatTile label="Custo dos ganhos" value={formatMoneyBRL(financeiro.totalCustoGanho)} />
            <StatTile
              label="Margem dos ganhos"
              value={(() => {
                const m = margemPercentual(financeiro.totalGanho, financeiro.totalCustoGanho)
                return m === null ? '-' : `${formatFixed(m)}%`
              })()}
            />
            <StatTile label="Em jogo (aguardando resultado)" value={formatMoneyBRL(financeiro.totalEmAberto)} destaque />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <StatTile label="Taxa de sucesso" value={stats.taxaSucesso === null ? '-' : `${formatFixed(stats.taxaSucesso, 0)}%`} />
            <StatTile label="Licitações decididas" value={stats.decididas} />
          </div>

          <div className="grid grid-cols-1 gap-4 mb-6">
            <MetaDoMesCard
              periodo={hoje.slice(0, 7)}
              ganhoRealizado={financeiro.ganhoMesAtual}
              taxaRealizada={statsMesAtual.taxaSucesso}
              isAdmin={user?.role === 'admin'}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <BarList title="Por tipo de objeto" data={byTipoObjeto} />
            <BarList title="Por tipo de disputa" data={byTipoDisputa} />
          </div>

          <div className="grid grid-cols-1 gap-4 mb-6">
            <EvolucaoMensal licitacoes={licitacoes} hoje={hoje} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded shadow">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="font-semibold">Aguardando resultado</h4>
                {stats.aguardandoResultado.length > 0 && (
                  <span
                    className="text-xs font-semibold text-white px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--color-error-text)' }}
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
                          <div className="text-xs font-medium" style={{ color: 'var(--color-error-text)' }}>
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
