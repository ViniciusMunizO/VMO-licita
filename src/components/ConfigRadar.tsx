import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  lerFiltrosRadar, salvarFiltrosRadar, gerarCodigoTelegram, desconectarTelegram, conferirPalavras, UFS, type FiltrosRadar,
} from '../utils/radar'
import {
  adicionarGrupo, adicionarPalavra, faltamDoGrupo, frasePalavra, GRUPOS, MAX_PALAVRAS, normalizar, palavrasDeProduto,
  separarPalavras, sugerirSinonimos, trocarPalavra, type ConferenciaPalavra, type Grupo,
} from '../utils/palavras-radar'

// Telegram e filtros do Radar da empresa. Todos veem; só o admin muda
// (o banco também confere: membro que tentar recebe erro).

// O bot de teste tem outro nome; cada ambiente diz qual usar no .env.
const BOT_TELEGRAM = import.meta.env.VITE_TELEGRAM_BOT || 'VMOLicitacoesBot'

type Props = {
  onCarregado?: (ufs: string[]) => void
  onFiltrosSalvos?: (ufs: string[]) => void
}

export default function ConfigRadar({ onCarregado, onFiltrosSalvos }: Props) {
  const { user } = useAuth()
  const admin = user?.role === 'admin'
  const [filtros, setFiltros] = useState<FiltrosRadar | null>(null)
  const [editando, setEditando] = useState(false)
  const [palavras, setPalavras] = useState('')
  const [ufs, setUfs] = useState<string[]>([])
  const [valorMinimo, setValorMinimo] = useState('0')
  const [codigo, setCodigo] = useState<{ texto: string; ate: number } | null>(null)
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [confirmarDesconectar, setConfirmarDesconectar] = useState(false)
  // Conferência das palavras enquanto a pessoa escreve (migração 0017). null = banco sem a conferência.
  const [conferencia, setConferencia] = useState<ConferenciaPalavra[] | null>([])
  const lista = useMemo(() => separarPalavras(palavras), [palavras])
  const sinonimos = useMemo(() => sugerirSinonimos(lista), [lista])
  const porPalavra = useMemo(
    () => new Map((conferencia || []).map(c => [normalizar(c.palavra), c])), [conferencia])
  // Palavras soltas que não acham nada e não têm erro de escrita: provavelmente nome de produto.
  const produtos = useMemo(() => palavrasDeProduto(
    lista.map(p => porPalavra.get(normalizar(p))).filter((c): c is ConferenciaPalavra => Boolean(c))), [lista, porPalavra])

  const usarGrupo = (g: Grupo) => {
    const novo = adicionarGrupo(palavras, g)
    if (separarPalavras(novo).length > MAX_PALAVRAS) {
      setErro(`Com o grupo ${g.nome} passaria de ${MAX_PALAVRAS} palavras. Tire algumas antes.`)
      return
    }
    setErro('')
    setPalavras(novo)
  }

  // Espera a pessoa parar de digitar e pergunta ao banco quantas cada palavra acha nos estados marcados.
  useEffect(() => {
    if (!editando || !lista.length || !ufs.length) return
    let cancelado = false
    const t = setTimeout(() => {
      conferirPalavras(lista, ufs)
        .then(c => { if (!cancelado) setConferencia(c) })
        // A conferência é só ajuda: se falhar, esconde as contas (não fica preso em "conferindo...").
        .catch(() => { if (!cancelado) setConferencia(null) })
    }, 700)
    return () => { cancelado = true; clearTimeout(t) }
  }, [editando, lista, ufs])

  const carregar = async () => {
    const f = await lerFiltrosRadar()
    setFiltros(f)
    onCarregado?.(f.ufs)
    return f
  }

  useEffect(() => {
    carregar().catch(e => setErro(e?.message || 'Não foi possível ler os filtros.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Enquanto o código está na tela, confere de vez em quando se o chat já conectou.
  useEffect(() => {
    if (!codigo || filtros?.telegramConectado) return
    const t = setInterval(() => {
      if (Date.now() > codigo.ate) { setCodigo(null); return }
      lerFiltrosRadar().then(f => {
        if (f.telegramConectado) { setFiltros(f); setCodigo(null); setMsg('Telegram conectado.') }
      }).catch(() => { /* tenta de novo no próximo ciclo */ })
    }, 5000)
    return () => clearInterval(t)
  }, [codigo, filtros?.telegramConectado])

  const abrirEdicao = () => {
    if (!filtros) return
    setPalavras(filtros.palavrasChave.join(', '))
    setUfs(filtros.ufs)
    setValorMinimo(String(filtros.valorMinimo || 0))
    setMsg('')
    setEditando(true)
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    const valor = Number(valorMinimo.replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(valor) || valor < 0) { setErro('Valor mínimo inválido.'); return }
    setSalvando(true)
    try {
      await salvarFiltrosRadar({
        palavrasChave: separarPalavras(palavras),
        ufs,
        valorMinimo: valor,
      })
      const f = await carregar()
      setEditando(false)
      setMsg('Filtros salvos. O bot e o Radar do site já usam os novos.')
      onFiltrosSalvos?.(f.ufs)
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível salvar os filtros.')
    } finally {
      setSalvando(false)
    }
  }

  const conectar = async () => {
    setErro('')
    setMsg('')
    try {
      const texto = await gerarCodigoTelegram()
      setCodigo({ texto, ate: Date.now() + 15 * 60_000 })
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível gerar o código.')
    }
  }

  const desconectar = async () => {
    setErro('')
    setConfirmarDesconectar(false)
    try {
      await desconectarTelegram()
      await carregar()
      setMsg('Telegram desconectado. Os avisos continuam no sino do site.')
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível desconectar.')
    }
  }

  if (!filtros) {
    return erro ? <p role="alert" className="text-sm mb-3" style={{ color: 'var(--color-error-text)' }}>{erro}</p> : null
  }

  const semFiltros = filtros.palavrasChave.length === 0 || filtros.ufs.length === 0

  return (
    <section className="bg-white p-4 rounded shadow mb-4 grid gap-3" aria-label="Configuração do Radar">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="text-sm">
          <span className="font-semibold">Telegram: </span>
          {filtros.telegramConectado
            ? <span style={{ color: 'var(--color-success-text, #15803d)' }}>conectado. Os avisos chegam no chat e aqui no sino.</span>
            : <span className="text-gray-600">não conectado. Os avisos chegam só no sino do site.</span>}
        </div>
        {admin && (filtros.telegramConectado
          ? (confirmarDesconectar ? (
            <div className="flex flex-wrap gap-2 items-center text-sm">
              <span>O chat para de receber os avisos. Desconectar?</span>
              <button type="button" className="btn btn-ghost" onClick={desconectar}>Sim, desconectar</button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmarDesconectar(false)}>Cancelar</button>
            </div>
          ) : <button type="button" className="btn btn-ghost" onClick={() => setConfirmarDesconectar(true)}>Desconectar Telegram</button>)
          : !codigo && <button type="button" className="btn btn-primary" onClick={conectar}>Conectar Telegram</button>)}
      </div>

      {codigo && (
        <div className="rounded p-3 text-sm grid gap-1" style={{ background: 'var(--color-bg-subtle, #f3f4f6)' }}>
          <p>No Telegram, abra a conversa com o bot <b>@{BOT_TELEGRAM}</b> e mande:</p>
          <p className="font-mono text-lg select-all">/vincular {codigo.texto}</p>
          <p className="text-gray-600">O código vale 15 minutos e uma vez só. Esta tela avisa quando conectar.</p>
        </div>
      )}

      {!editando ? (
        <div className="flex flex-wrap gap-3 items-start justify-between text-sm">
          <div className="grid gap-1">
            <p><span className="font-semibold">Palavras: </span>{filtros.palavrasChave.join(', ') || 'nenhuma'}</p>
            <p><span className="font-semibold">Estados: </span>{filtros.ufs.join(', ') || 'nenhum'}</p>
            <p><span className="font-semibold">Valor mínimo: </span>
              {filtros.valorMinimo ? filtros.valorMinimo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'qualquer valor'}</p>
            {semFiltros && <p className="text-gray-600">Sem palavras e estados o Radar não encontra nada. {admin ? 'Toque em Mudar filtros.' : 'Peça ao admin da empresa.'}</p>}
          </div>
          {admin && <button type="button" className="btn btn-ghost" onClick={abrirEdicao}>Mudar filtros</button>}
        </div>
      ) : (
        <form onSubmit={salvar} className="grid gap-3 text-sm">
          <div>
            <label htmlFor="radar-palavras" className="block text-gray-600 mb-1">Palavras (separe com vírgula)</label>
            <textarea id="radar-palavras" value={palavras} onChange={e => setPalavras(e.target.value)} rows={2}
              className="w-full p-2 rounded" placeholder="Ex.: detergente, material de limpeza, merenda" />
          </div>
          {lista.length > 0 && (
            <div className="rounded p-3 grid gap-2" style={{ background: 'var(--color-bg-subtle, #f3f4f6)' }}
              aria-live="polite" aria-label="O que o Radar entendeu">
              <p className="font-semibold">O Radar entendeu</p>
              {conferencia !== null && (ufs.length ? (
                <ul className="grid gap-1">
                  {lista.map(p => {
                    const c = porPalavra.get(normalizar(p))
                    const sugestao = c?.sugestao
                    return (
                      <li key={normalizar(p)} className="flex flex-wrap items-center gap-x-2">
                        <span aria-hidden="true" style={{ color: !c ? undefined : c.abertas > 0 ? 'var(--color-success-text, #15803d)' : 'var(--color-warning-text, #92400e)' }}>
                          {!c ? '…' : c.abertas > 0 ? '✓' : '⚠'}
                        </span>
                        <b>{p}</b>
                        <span className="text-gray-600">{c ? frasePalavra(c) : 'conferindo...'}</span>
                        {c && sugestao && (c.abertas === 0
                          ? <button type="button" className="btn btn-ghost" onClick={() => setPalavras(t => trocarPalavra(t, p, sugestao))}>Trocar por "{sugestao}"</button>
                          : <button type="button" className="btn btn-ghost" onClick={() => setPalavras(t => adicionarPalavra(t, sugestao))}>Adicionar "{sugestao}"</button>)}
                      </li>
                    )
                  })}
                </ul>
              ) : <p className="text-gray-600">Marque os estados para ver quantas licitações abertas cada palavra acha.</p>)}
              {conferencia !== null && ufs.length > 0 && produtos.length > 0 && (
                <p>
                  <span aria-hidden="true">💡 </span>
                  {produtos.map(p => `"${p}"`).join(', ')} não {produtos.length === 1 ? 'aparece' : 'aparecem'} no título de nenhuma licitação aberta.
                  Os órgãos costumam escrever o grupo no título (ex.: "medicamentos") e o nome do produto só nos itens.
                  Use um grupo pronto abaixo.
                </p>
              )}
              {sinonimos.length > 0 && (
                <ul className="grid gap-1">
                  {sinonimos.map(s => (
                    <li key={s.para} className="flex flex-wrap items-center gap-x-2">
                      <span aria-hidden="true">💡</span>
                      <span>Os órgãos costumam escrever <b>{s.para}</b> em vez de "{s.de}".</span>
                      <button type="button" className="btn btn-ghost" onClick={() => setPalavras(t => adicionarPalavra(t, s.para))}>Adicionar "{s.para}"</button>
                    </li>
                  ))}
                </ul>
              )}
              {/* Só com a migração 0017 no banco (sem ela a conferência volta null) isso é verdade. */}
              {conferencia !== null && <p className="text-gray-600">Plural, singular, acento e maiúscula não importam: "luvas" acha "luva" e "papel" acha "papéis".</p>}
            </div>
          )}
          <div className="grid gap-1" aria-label="Grupos prontos">
            <p className="text-gray-600">Grupos prontos: as palavras que os órgãos usam no título das licitações.</p>
            <div className="flex flex-wrap gap-2">
              {GRUPOS.map(g => {
                const faltam = faltamDoGrupo(palavras, g)
                return faltam.length
                  ? <button key={g.id} type="button" className="btn btn-ghost" onClick={() => usarGrupo(g)}
                      title={`Adiciona: ${faltam.join(', ')}`} aria-label={`Adicionar o grupo ${g.nome}: ${faltam.join(', ')}`}>+ {g.nome}</button>
                  : <span key={g.id} className="inline-flex items-center px-2 py-1 rounded border border-gray-200 text-gray-600">✓ {g.nome}</span>
              })}
            </div>
          </div>
          <fieldset>
            <legend className="text-gray-600 mb-1">Estados</legend>
            <div className="flex flex-wrap gap-2">
              {UFS.map(u => (
                <label key={u} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200">
                  <input type="checkbox" checked={ufs.includes(u)}
                    onChange={e => setUfs(s => e.target.checked ? [...s, u] : s.filter(x => x !== u))} />
                  {u}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="radar-valor" className="block text-gray-600 mb-1">Valor mínimo (R$, 0 = qualquer)</label>
            <input id="radar-valor" value={valorMinimo} onChange={e => setValorMinimo(e.target.value)} inputMode="decimal" className="p-2 rounded w-40" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar filtros'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditando(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {msg && <p role="status" className="text-sm text-gray-600">{msg}</p>}
      {erro && <p role="alert" className="text-sm" style={{ color: 'var(--color-error-text)' }}>{erro}</p>}
    </section>
  )
}
