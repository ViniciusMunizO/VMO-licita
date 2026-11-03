import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  acompanhar, buscarRadarConversa, deixarDeAcompanhar, lerFiltrosRadar, linkPncp, listarAcompanhadas,
  type FiltrosRadar, type LicitacaoRadar,
} from '../utils/radar'
import { pedirLeituraEdital } from '../utils/edital'
import { listRascunhos } from '../utils/licitacoes'
import { empresaAtual } from '../utils/banco'
import {
  AJUDA, DICA_CIDADE, DICA_DATA, POR_PAGINA, REGIOES, UFS_LISTA, buscarCidade, entenderMensagem, filtroDoOnde,
  foraDaColeta, linhaPrazo, resolverPeriodo, type Cidade, type Comando, type Esperando, type Onde,
} from '../utils/conversa-radar'

// A conversa do Radar: funciona como o bot do Telegram. A pessoa toca nos botões ou escreve
// ("PR SC", "sul 15 dias", "Maringá PR", "até 20/11", "ajuda") e o Radar responde com as licitações.
// A conversa fica guardada só nesta aba do navegador (sessionStorage); os dados de verdade estão no banco.

type Acao =
  | { t: 'menuOnde' }
  | { t: 'estados' }
  | { t: 'pedirCidade' }
  | { t: 'onde'; onde: Onde }
  | { t: 'listar'; onde: Onde; chave: string; desloc: number }
  | { t: 'pedirData'; onde: Onde }
  | { t: 'comando'; c: Comando }
  | { t: 'abrirAcompanhando' }

type Botao = { texto: string; acao: Acao }

type Msg =
  | { id: number; de: 'voce'; texto: string }
  | { id: number; de: 'bot'; texto: string; botoes?: Botao[][]; tom?: 'erro' }
  | { id: number; de: 'bot'; licitacao: LicitacaoRadar }

type Ultima = { onde: Onde; chave: string; proximo: number | null }

type Guardado = { msgs: Msg[]; ultima: Ultima | null; esperando: Esperando }

const MAX_GUARDADAS = 80
const chaveGuardada = () => `radar-conversa:${empresaAtual() || 'sem-empresa'}`

function lerGuardado(): Guardado | null {
  try {
    const bruto = sessionStorage.getItem(chaveGuardada())
    return bruto ? (JSON.parse(bruto) as Guardado) : null
  } catch {
    return null
  }
}

function valorBR(v: number | null) {
  if (!v) return 'Valor não informado'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// A lista de cidades é grande: só carrega quando alguém procura uma cidade.
let cidadesCache: Cidade[] | null = null
async function carregarCidades(): Promise<Cidade[]> {
  if (!cidadesCache) {
    const m = await import('../dados/cidades.json')
    cidadesCache = (m.default as [string, string][]).map(([nome, uf]) => ({ nome, uf }))
  }
  return cidadesCache
}

function Avatar() {
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 text-sm font-semibold" style={{ backgroundColor: 'var(--color-primary)' }} aria-hidden="true">
      R
    </div>
  )
}

const MENU_FIXO: { texto: string; c: Comando }[] = [
  { texto: '📋 Licitações', c: 'licitacoes' },
  { texto: '⭐ Acompanhando', c: 'acompanhando' },
  { texto: '⚙️ Filtros', c: 'filtros' },
  { texto: '❓ Ajuda', c: 'ajuda' },
]

type Props = {
  /** Abre (e mostra) o painel de filtros e Telegram da página. */
  onAbrirFiltros: () => void
  /** Muda quando os filtros são salvos: os estados da empresa podem ter mudado. */
  versaoFiltros: number
}

export default function ChatRadar({ onAbrirFiltros, versaoFiltros }: Props) {
  const navigate = useNavigate()
  const guardado = useRef(lerGuardado()).current
  const [msgs, setMsgs] = useState<Msg[]>(guardado?.msgs ?? [])
  const [ultima, setUltima] = useState<Ultima | null>(guardado?.ultima ?? null)
  const [esperando, setEsperando] = useState<Esperando>(guardado?.esperando ?? null)
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [marcadas, setMarcadas] = useState<Record<string, boolean>>({})
  const [rascunhoPorNumero, setRascunhoPorNumero] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState<string | null>(null)
  const proximoId = useRef(Date.now())
  const fim = useRef<HTMLDivElement>(null)
  const ufsRef = useRef<string[]>([])
  const palavrasRef = useRef<string[]>([])
  const [filtros, setFiltros] = useState<FiltrosRadar | null>(null)

  // Estados e ramos da empresa (para "Meus estados", a faixa do topo e os avisos) e rascunhos.
  // Primeira visita: espera os filtros, cumprimenta e já pergunta onde (como o /licitacoes).
  const cumprimentou = useRef(Boolean(guardado?.msgs.length))
  useEffect(() => {
    lerFiltrosRadar()
      .then(f => { ufsRef.current = f.ufs; palavrasRef.current = f.palavrasChave; setFiltros(f) })
      .catch(() => {})
      .finally(() => {
        if (cumprimentou.current) return
        cumprimentou.current = true
        bot('Olá! Eu sou o Radar, o mesmo do Telegram. Toque nos botões ou escreva, por exemplo: "PR SC", "sul 15 dias", "Maringá PR" ou "até 20/11".')
        mostrarMenuOnde()
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versaoFiltros])
  useEffect(() => {
    listRascunhos()
      .then(rs => setRascunhoPorNumero(Object.fromEntries(rs.map((x: any) => [x.numeroControlePncp, x.processoId]))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(chaveGuardada(), JSON.stringify({ msgs: msgs.slice(-MAX_GUARDADAS), ultima, esperando }))
    } catch { /* sem armazenamento: a conversa só não sobrevive ao recarregar */ }
    fim.current?.scrollIntoView({ block: 'end' })
  }, [msgs, ultima, esperando, pensando])

  // ---------------------------------------------------------------------------
  // Mensagens
  // ---------------------------------------------------------------------------

  const novoId = () => ++proximoId.current
  const bot = (t: string, botoes?: Botao[][], tom?: 'erro') =>
    setMsgs(m => [...m, { id: novoId(), de: 'bot', texto: t, botoes, tom }])
  const voce = (t: string) => setMsgs(m => [...m, { id: novoId(), de: 'voce', texto: t }])
  // "Ver mais" some depois do toque, para um segundo toque não repetir a mesma página (igual ao bot).
  const tirarBotoes = (id: number) =>
    setMsgs(m => m.map(x => (x.id === id && 'botoes' in x ? { ...x, botoes: undefined } : x)))

  const titulo = (o: Onde) => filtroDoOnde(o, ufsRef.current).titulo
  // "medicamento" ou "medicamento, dipirona e mais 3": diz por que a busca deixou algo de fora.
  const ramosCurtos = () => {
    const p = palavrasRef.current
    if (!p.length) return 'nenhum ramo (os filtros estão vazios)'
    return p.length <= 3 ? `"${p.join('", "')}"` : `"${p.slice(0, 2).join('", "')}" e mais ${p.length - 2}`
  }

  function mostrarMenuOnde() {
    const ufs = ufsRef.current
    const meus = ufs.length && ufs.length <= 6 ? ` (${ufs.join(', ')})` : ufs.length ? ` (${ufs.length} estados)` : ''
    const regiao = (id: string): Botao => ({ texto: REGIOES.find(r => r.id === id)!.nome, acao: { t: 'onde', onde: { tipo: 'regiao', id } } })
    bot('📍 Onde você quer ver as licitações?', [
      [{ texto: `⭐ Meus estados${meus}`, acao: { t: 'onde', onde: { tipo: 'meus' } } }],
      [{ texto: '🔎 Uma cidade', acao: { t: 'pedirCidade' } }, { texto: 'Um estado', acao: { t: 'estados' } }],
      [regiao('sul'), regiao('sudeste'), regiao('centrooeste')],
      [regiao('nordeste'), regiao('norte')],
    ])
  }

  function tecladoQuando(onde: Onde): Botao[][] {
    const listar = (chave: string): Acao => ({ t: 'listar', onde, chave, desloc: 0 })
    return [
      [{ texto: 'Encerram em até 7 dias', acao: listar('7') }],
      [{ texto: 'Até 15 dias', acao: listar('15') }, { texto: 'Até 30 dias', acao: listar('30') }],
      [{ texto: 'Publicadas hoje', acao: listar('hoje') }, { texto: 'Até uma data', acao: { t: 'pedirData', onde } }],
      [{ texto: '‹ Mudar o lugar', acao: { t: 'menuOnde' } }],
    ]
  }

  function mostrarMenuQuando(onde: Onde) {
    bot(`📍 ${titulo(onde)}\n📅 Quando? Mostro as dos seus ramos, das que encerram primeiro para as que encerram depois.`, tecladoQuando(onde))
  }

  async function listar(onde: Onde, chave: string, desloc: number) {
    const periodo = resolverPeriodo(chave)
    if (periodo === 'passou' || !periodo) {
      bot(periodo === 'passou' ? 'Essa data já passou. Escolha outro período:' : 'Não entendi esse período. Escolha de novo:', tecladoQuando(onde))
      return
    }
    const filtro = filtroDoOnde(onde, ufsRef.current)
    const outroPeriodo: Botao = { texto: 'Outro período', acao: { t: 'onde', onde } }
    const outroLugar: Botao = { texto: 'Outro lugar', acao: { t: 'menuOnde' } }
    const cabecalho = `📍 ${filtro.titulo} · ${periodo.titulo}`

    const { lista, total: totalBanco } = await buscarRadarConversa({
      ufs: filtro.ufs, municipio: filtro.municipio, ate: periodo.ate, publicadasDesde: periodo.publicadasDesde,
      deslocamento: desloc, limite: POR_PAGINA,
    })
    if (!lista.length) {
      setUltima({ onde, chave, proximo: null })
      if (desloc > 0) { bot('Não há mais licitações aqui.', [[outroPeriodo, outroLugar]]); return }
      const dica = foraDaColeta(filtro, ufsRef.current) ?? 'Tente um período maior, outro lugar ou mude os filtros.'
      bot(`${cabecalho}\nNão achei licitação de ${ramosCurtos()} aqui.\n${dica}`, [
        [outroPeriodo, outroLugar],
        [{ texto: '⚙️ Mudar filtros', acao: { t: 'comando', c: 'filtros' } }],
      ])
      return
    }
    const total = Math.max(totalBanco, desloc + lista.length)
    const ate = desloc + lista.length
    setMarcadas(m => ({ ...Object.fromEntries(lista.map(l => [l.numeroControlePncp, l.acompanhada])), ...m }))
    setMsgs(m => [
      ...m,
      { id: novoId(), de: 'bot', texto: `${cabecalho}\n${total === 1 ? '1 licitação' : `${total} licitações`} · mostrando ${desloc + 1} a ${ate}` },
      ...lista.map(l => ({ id: novoId(), de: 'bot' as const, licitacao: l })),
    ])
    if (ate < total) {
      setUltima({ onde, chave, proximo: ate })
      const faltam = total - ate
      bot(faltam === 1 ? 'Falta 1.' : `Faltam ${faltam}.`, [[{ texto: 'Ver mais', acao: { t: 'listar', onde, chave, desloc: ate } }]])
    } else {
      setUltima({ onde, chave, proximo: null })
      bot('Isso é tudo.', [[outroPeriodo, outroLugar]])
    }
  }

  async function mostrarAcompanhando(prazos: boolean) {
    const lista = await listarAcompanhadas()
    const abrir: Botao[][] = [[{ texto: '⭐ Abrir Acompanhando', acao: { t: 'abrirAcompanhando' } }]]
    if (!lista.length) {
      bot('Você ainda não acompanha nenhuma licitação. Toque em ⭐ Acompanhar num resultado para guardar aqui e receber os lembretes.', [[{ texto: '📋 Buscar licitações', acao: { t: 'menuOnde' } }]])
      return
    }
    const abertas = lista.filter(l => l.encerramento && new Date(l.encerramento).getTime() > Date.now())
    const linhas = (prazos ? abertas : lista).slice(0, 5).map(l => `• ${linhaPrazo(l.encerramento)} – ${(l.objeto || 'Objeto não informado').slice(0, 70)}`)
    const cab = prazos
      ? abertas.length ? `📅 Prazos das acompanhadas (${abertas.length} abertas):` : 'Nenhuma acompanhada está aberta agora.'
      : `⭐ Você acompanha ${lista.length === 1 ? '1 licitação' : `${lista.length} licitações`} (${abertas.length} abertas). As próximas:`
    bot([cab, ...linhas].join('\n'), abrir)
  }

  async function comando(c: Comando) {
    if (c === 'licitacoes') return mostrarMenuOnde()
    if (c === 'ajuda') return bot(AJUDA, [[{ texto: '📋 Licitações', acao: { t: 'menuOnde' } }, { texto: '⭐ Acompanhando', acao: { t: 'comando', c: 'acompanhando' } }]])
    if (c === 'acompanhando' || c === 'prazos') return mostrarAcompanhando(c === 'prazos')
    if (c === 'filtros') {
      onAbrirFiltros()
      const f = await lerFiltrosRadar()
      const palavras = f.palavrasChave.length ? `${f.palavrasChave.length} palavras (${f.palavrasChave.slice(0, 5).join(', ')}${f.palavrasChave.length > 5 ? '…' : ''})` : 'nenhuma palavra'
      return bot(`⚙️ O que eu procuro: ${palavras}\n📍 Estados: ${f.ufs.join(', ') || 'nenhum'}\n💰 Valor mínimo: ${f.valorMinimo ? valorBR(f.valorMinimo) : 'qualquer'}\n\nAbri os filtros no topo da página para você mudar.`)
    }
    if (c === 'mais') {
      if (ultima?.proximo != null) return listar(ultima.onde, ultima.chave, ultima.proximo)
      return bot(ultima ? 'Já mostrei todas da última busca.' : 'Faça uma busca primeiro.', [[{ texto: '📋 Licitações', acao: { t: 'menuOnde' } }]])
    }
    if (c === 'limpar') {
      setMsgs([]); setUltima(null); setEsperando(null)
      bot('🧹 Conversa limpa. Seus filtros e as licitações acompanhadas continuam salvos.')
      return mostrarMenuOnde()
    }
    if (c === 'origem') return bot('A cidade de onde você envia os produtos (para o frete da cotação) ainda se muda só no Telegram: mande /origem para o bot.')
    if (c === 'apagar') return bot('Pelo site eu não apago dados. Para apagar os dados do bot, mande /apagar no Telegram; para os dados do LicitaVMO, fale com o administrador da empresa.')
  }

  // ---------------------------------------------------------------------------
  // Toques e mensagens digitadas
  // ---------------------------------------------------------------------------

  async function executar(acao: Acao) {
    if (acao.t === 'menuOnde') { setEsperando(null); return mostrarMenuOnde() }
    if (acao.t === 'estados') {
      const linhas: Botao[][] = []
      for (let i = 0; i < UFS_LISTA.length; i += 6) {
        linhas.push(UFS_LISTA.slice(i, i + 6).map(uf => ({ texto: uf, acao: { t: 'onde', onde: { tipo: 'uf', uf } } })))
      }
      linhas.push([{ texto: '‹ Voltar', acao: { t: 'menuOnde' } }])
      return bot('📍 Qual estado?', linhas)
    }
    if (acao.t === 'pedirCidade') { setEsperando('cidade'); return bot(`🔎 Qual cidade? ${DICA_CIDADE}`) }
    if (acao.t === 'onde') { setEsperando(null); return mostrarMenuQuando(acao.onde) }
    if (acao.t === 'pedirData') { setEsperando({ data: acao.onde }); return bot(`Até que dia você quer ver? ${DICA_DATA}`) }
    if (acao.t === 'listar') { setEsperando(null); return listar(acao.onde, acao.chave, acao.desloc) }
    if (acao.t === 'comando') return comando(acao.c)
    if (acao.t === 'abrirAcompanhando') return navigate('/acompanhando')
  }

  async function comCuidado(fazer: () => Promise<void> | void, repetir?: Acao) {
    setPensando(true)
    try {
      await fazer()
    } catch (e: any) {
      bot(`Não consegui agora: ${e?.message || 'erro desconhecido'}. Tente de novo.`, repetir ? [[{ texto: 'Tentar de novo', acao: repetir }]] : undefined, 'erro')
    } finally {
      setPensando(false)
    }
  }

  function tocar(msgId: number, b: Botao) {
    if (pensando) return
    voce(b.texto)
    if (b.acao.t === 'listar' && b.acao.desloc > 0) tirarBotoes(msgId)
    comCuidado(() => executar(b.acao), b.acao)
  }

  async function entender(t: string) {
    const i = entenderMensagem(t, esperando)
    if (i.tipo === 'vazio') return
    if (i.tipo === 'comando') { setEsperando(null); return comando(i.comando) }
    if (i.tipo === 'erro') return bot(i.texto, esperando && typeof esperando === 'object' ? tecladoQuando(esperando.data) : undefined)
    if (i.tipo === 'periodo') {
      // Data ou período sem lugar: usa o lugar que estava esperando a data, o da última busca ou "meus estados".
      const onde = esperando && typeof esperando === 'object' ? esperando.data : ultima?.onde ?? { tipo: 'meus' as const }
      setEsperando(null)
      return listar(onde, i.chave, 0)
    }
    if (i.tipo === 'onde') {
      setEsperando(null)
      return i.chave ? listar(i.onde, i.chave, 0) : mostrarMenuQuando(i.onde)
    }
    // Texto livre: tenta como cidade.
    const r = buscarCidade(i.texto, await carregarCidades())
    if (r.tipo === 'achou') {
      setEsperando(null)
      const onde: Onde = { tipo: 'cidade', nome: r.cidade.nome, uf: r.cidade.uf }
      return i.chave ? listar(onde, i.chave, 0) : mostrarMenuQuando(onde)
    }
    if (r.tipo === 'varias') {
      return bot('Achei mais de uma cidade com esse nome. Qual delas?',
        r.opcoes.slice(0, 8).map(c => [{ texto: `${c.nome} (${c.uf})`, acao: { t: 'onde', onde: { tipo: 'cidade', nome: c.nome, uf: c.uf } } }]))
    }
    if (esperando === 'cidade') return bot(`Não achei essa cidade. ${DICA_CIDADE}`)
    bot(`Não entendi "${i.texto.slice(0, 40)}". Escreva um estado ("PR SC"), uma região ("sul"), uma cidade ("Maringá PR"), um prazo ("15 dias", "até 20/11") ou "ajuda".`,
      [[{ texto: '📋 Licitações', acao: { t: 'menuOnde' } }, { texto: '❓ Ajuda', acao: { t: 'comando', c: 'ajuda' } }]])
  }

  function enviar(e?: React.FormEvent) {
    e?.preventDefault()
    const t = texto.trim()
    if (!t || pensando) return
    setTexto('')
    voce(t)
    comCuidado(() => entender(t))
  }

  function menuFixo(c: Comando, rotulo: string) {
    if (pensando) return
    voce(rotulo)
    setEsperando(null)
    comCuidado(() => comando(c), { t: 'comando', c })
  }

  // ---------------------------------------------------------------------------
  // Acompanhar pelo cartão
  // ---------------------------------------------------------------------------

  async function alternar(l: LicitacaoRadar) {
    const n = l.numeroControlePncp
    const estava = marcadas[n] ?? l.acompanhada
    setOcupado(n)
    try {
      if (estava) {
        await deixarDeAcompanhar(n)
        setRascunhoPorNumero(m => { const x = { ...m }; delete x[n]; return x })
      } else {
        const id = await acompanhar(n)
        // Se a licitação já tinha virado cadastro, o banco devolve esse processo: aí não é rascunho
        // e não cabe "Continuar cadastro". A lista de rascunhos diz qual é o caso.
        const rs = await listRascunhos().catch(() => [] as any[])
        setRascunhoPorNumero(Object.fromEntries(rs.map((x: any) => [x.numeroControlePncp, x.processoId])))
        // Já começa a ler o edital: quando abrir o cadastro, os campos estarão prontos.
        if (rs.some((x: any) => x.processoId === id)) pedirLeituraEdital(id).catch(() => { /* o cadastro tenta de novo ao abrir */ })
      }
      setMarcadas(m => ({ ...m, [n]: !estava }))
    } catch (e: any) {
      bot(`Não consegui salvar: ${e?.message || 'tente de novo.'}`, undefined, 'erro')
    } finally {
      setOcupado(null)
    }
  }

  function cartao(l: LicitacaoRadar, key: number) {
    const n = l.numeroControlePncp
    const acompanhada = marcadas[n] ?? l.acompanhada
    const link = linkPncp(n) || l.link
    const rascunho = rascunhoPorNumero[n]
    const local = [l.municipio, l.uf].filter(Boolean).join('/')
    return (
      <article
        key={key}
        className="ml-10 bg-white border border-gray-200 rounded-lg p-3 grid gap-1.5 text-sm max-w-xl shadow-sm"
        style={{ borderLeft: `4px solid ${acompanhada ? 'var(--color-accent)' : 'var(--color-primary)'}` }}
      >
        <div className="flex gap-2 items-start justify-between">
          <h4 className="font-semibold leading-snug text-[15px]">{l.objeto || 'Objeto não informado'}</h4>
          {acompanhada && <span className="text-xs whitespace-nowrap px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">⭐ Acompanhando</span>}
        </div>
        <p className="text-gray-700 font-medium">💰 {valorBR(l.valorEstimado)}</p>
        <p className="text-gray-600">📍 {local || 'Local não informado'}{l.modalidade ? ` · ${l.modalidade}` : ''}</p>
        <p className="text-gray-600">⏰ {linhaPrazo(l.encerramento)}</p>
        <p className="text-gray-600">🏛️ {l.orgao || 'Órgão não informado'}</p>
        <div className="flex flex-wrap gap-2 items-center mt-1 pt-2 border-t border-gray-100">
          <button type="button" onClick={() => alternar(l)} disabled={ocupado === n} className={acompanhada ? 'btn btn-ghost' : 'btn btn-primary'}>
            {acompanhada ? 'Deixar de acompanhar' : '⭐ Acompanhar'}
          </button>
          {acompanhada && rascunho && (
            <Link to={`/licitacoes/novo?rascunho=${rascunho}`} className="btn btn-primary">Continuar cadastro</Link>
          )}
          {link && <a href={link} target="_blank" rel="noreferrer" className="text-sm underline text-gray-600 ml-auto">Ver no PNCP ↗</a>}
        </div>
      </article>
    )
  }

  // ---------------------------------------------------------------------------
  // Tela
  // ---------------------------------------------------------------------------

  // Só os botões da última pergunta ficam com cara de ativos; os antigos continuam funcionando, mais apagados.
  const ultimaComBotoes = [...msgs].reverse().find(m => 'botoes' in m && m.botoes)?.id

  return (
    <section className="bg-white rounded-lg shadow flex flex-col overflow-hidden" aria-label="Conversa com o Radar">
      {/* O que o Radar procura: deixa claro por que algo não aparece. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 border-b border-gray-100 text-sm">
        <span className="flex items-center gap-2 font-semibold">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }} aria-hidden="true" /> Radar
        </span>
        {filtros && (
          <span className="text-gray-600 min-w-0 truncate">
            Procuro: {filtros.palavrasChave.length ? filtros.palavrasChave.slice(0, 4).join(', ') + (filtros.palavrasChave.length > 4 ? ` +${filtros.palavrasChave.length - 4}` : '') : 'nenhum ramo'}
            {' · '}Estados: {filtros.ufs.join(', ') || 'nenhum'}
          </span>
        )}
        <button type="button" className="text-sm underline text-gray-600 ml-auto" onClick={onAbrirFiltros}>Mudar</button>
      </div>

      <div className="overflow-y-auto p-3 sm:p-4 flex flex-col gap-3 bg-gray-50" style={{ height: 'min(62vh, 620px)', minHeight: 360 }} aria-live="polite">
        {msgs.map((m, i) => {
          if (m.de === 'voce') {
            return (
              <div key={m.id} className="self-end max-w-[80%] rounded-2xl rounded-br-sm px-3 py-2 text-sm text-white whitespace-pre-line shadow-sm" style={{ backgroundColor: 'var(--color-primary)' }}>
                {m.texto}
              </div>
            )
          }
          if ('licitacao' in m) return cartao(m.licitacao, m.id)
          // O avatar aparece só na primeira mensagem de uma sequência do Radar.
          const anterior = msgs[i - 1]
          const abreSequencia = !anterior || anterior.de === 'voce'
          const ativa = m.id === ultimaComBotoes
          return (
            <div key={m.id} className="self-start flex gap-2 max-w-[92%]">
              {abreSequencia ? <Avatar /> : <div className="w-8 flex-shrink-0" />}
              <div className="grid gap-2 min-w-0">
                <div
                  className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-3 py-2 text-sm whitespace-pre-line shadow-sm"
                  style={{ borderColor: m.tom === 'erro' ? 'var(--color-error)' : undefined, color: m.tom === 'erro' ? 'var(--color-error-text)' : undefined }}
                >
                  {m.texto}
                </div>
                {m.botoes && (
                  <div className={`flex flex-wrap gap-1.5 ${ativa ? '' : 'opacity-50 hover:opacity-100 transition-opacity'}`}>
                    {m.botoes.flat().map((b, j) => (
                      <button
                        key={j}
                        type="button"
                        disabled={pensando}
                        onClick={() => tocar(m.id, b)}
                        className="px-3 py-1.5 rounded-full text-sm bg-white border shadow-sm hover:bg-gray-50 disabled:opacity-50"
                        style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                      >
                        {b.texto}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {pensando && (
          <div className="self-start flex gap-2 items-center text-sm text-gray-500">
            <Avatar /> procurando…
          </div>
        )}
        <div ref={fim} />
      </div>

      <div className="border-t border-gray-100 p-3 grid gap-2">
        <div className="flex flex-wrap gap-1.5">
          {MENU_FIXO.map(b => (
            <button key={b.c} type="button" className="btn btn-ghost" disabled={pensando} onClick={() => menuFixo(b.c, b.texto)}>{b.texto}</button>
          ))}
        </div>
        <form onSubmit={enviar} className="flex gap-2">
          <label htmlFor="radar-mensagem" className="sr-only">Mensagem para o Radar</label>
          <input
            id="radar-mensagem"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            maxLength={200}
            autoComplete="off"
            placeholder={esperando === 'cidade' ? 'Ex.: Maringá PR' : esperando ? 'Ex.: até 20/11' : 'Escreva: PR SC, sul 15 dias, Maringá PR, ajuda...'}
            className="flex-1 min-w-0 p-2 rounded border border-gray-300"
          />
          <button type="submit" className="btn btn-primary" disabled={pensando || !texto.trim()}>Enviar</button>
        </form>
      </div>
    </section>
  )
}
