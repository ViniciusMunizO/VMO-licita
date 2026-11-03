import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { buscarRadar, acompanhar, deixarDeAcompanhar, linkPncp, POR_PAGINA, type LicitacaoRadar } from '../utils/radar'
import { pedirLeituraEdital } from '../utils/edital'
import { listRascunhos } from '../utils/licitacoes'
import ConfigRadar from '../components/ConfigRadar'

// O Radar de Licitações dentro do site: as mesmas licitações que o bot manda no
// Telegram, filtradas pelas palavras e estados da empresa. "Acompanhar" cria um
// rascunho na lista de licitações (o mesmo que acontece pelo bot).

const PRAZOS = [
  { dias: 0, rotulo: 'Qualquer prazo' },
  { dias: 3, rotulo: 'Encerra em até 3 dias' },
  { dias: 7, rotulo: 'Encerra em até 7 dias' },
  { dias: 15, rotulo: 'Encerra em até 15 dias' },
]

function valorBR(v: number | null) {
  if (!v) return 'Valor não informado'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function encerramentoBR(iso: string | null) {
  if (!iso) return 'Sem data de encerramento'
  const d = new Date(iso)
  const texto = d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const dias = Math.ceil((d.getTime() - Date.now()) / 86_400_000)
  return `Encerra ${texto}${dias <= 1 ? ' (último dia)' : ` (faltam ${dias} dias)`}`
}

export default function Radar() {
  const [lista, setLista] = useState<LicitacaoRadar[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(0)
  const [uf, setUf] = useState('')
  const [ateDias, setAteDias] = useState(0)
  const [ufsDaEmpresa, setUfsDaEmpresa] = useState<string[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [rascunhoPorNumero, setRascunhoPorNumero] = useState<Record<string, string>>({})
  const [versaoFiltros, setVersaoFiltros] = useState(0)

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    setErro('')
    Promise.all([buscarRadar({ uf, ateDias, pagina }), listRascunhos()])
      .then(([r, rascunhos]) => {
        if (!vivo) return
        setLista(r.lista)
        setTotal(r.total)
        setRascunhoPorNumero(Object.fromEntries(rascunhos.map(x => [x.numeroControlePncp, x.processoId])))
      })
      .catch(e => vivo && setErro(e?.message || 'Não foi possível carregar o Radar.'))
      .finally(() => vivo && setCarregando(false))
    return () => { vivo = false }
  }, [uf, ateDias, pagina, versaoFiltros])

  const alternar = async (l: LicitacaoRadar) => {
    setOcupado(l.numeroControlePncp)
    setErro('')
    try {
      if (l.acompanhada) {
        await deixarDeAcompanhar(l.numeroControlePncp)
        setRascunhoPorNumero(m => { const n = { ...m }; delete n[l.numeroControlePncp]; return n })
      } else {
        const id = await acompanhar(l.numeroControlePncp)
        setRascunhoPorNumero(m => ({ ...m, [l.numeroControlePncp]: id }))
        // Já começa a ler o edital: quando abrir o cadastro, os campos estarão prontos.
        pedirLeituraEdital(id).catch(() => { /* o cadastro tenta de novo ao abrir */ })
      }
      setLista(ls => ls.map(x => x.numeroControlePncp === l.numeroControlePncp ? { ...x, acompanhada: !x.acompanhada } : x))
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível salvar. Tente de novo.')
    } finally {
      setOcupado(null)
    }
  }

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-semibold">Radar de Licitações</h3>
          <p className="text-sm text-gray-500">Licitações abertas no PNCP que combinam com os filtros da empresa.</p>
        </div>
      </div>

      <ConfigRadar onFiltrosSalvos={(ufs) => { setUfsDaEmpresa(ufs); setPagina(0); setVersaoFiltros(v => v + 1) }} onCarregado={setUfsDaEmpresa} />

      <div className="bg-white p-4 rounded shadow mb-4 flex flex-wrap gap-3 items-center">
        <label htmlFor="radar-uf" className="text-sm text-gray-600">Estado</label>
        <select id="radar-uf" value={uf} onChange={e => { setUf(e.target.value); setPagina(0) }} className="p-2 rounded">
          <option value="">Todos os da empresa</option>
          {ufsDaEmpresa.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <label htmlFor="radar-prazo" className="text-sm text-gray-600">Prazo</label>
        <select id="radar-prazo" value={ateDias} onChange={e => { setAteDias(Number(e.target.value)); setPagina(0) }} className="p-2 rounded">
          {PRAZOS.map(p => <option key={p.dias} value={p.dias}>{p.rotulo}</option>)}
        </select>
        <span className="text-sm text-gray-500 ml-auto">{carregando ? 'Buscando...' : `${total} licitação(ões)`}</span>
      </div>

      {erro && <p role="alert" className="text-sm mb-3" style={{ color: 'var(--color-error-text)' }}>{erro}</p>}

      {!carregando && lista.length === 0 && !erro && (
        <div className="bg-white p-6 rounded shadow text-sm text-gray-600">
          Nenhuma licitação aberta com esses filtros agora. Confira as palavras e os estados acima; o Radar é atualizado todo dia de manhã.
        </div>
      )}

      <div className="grid gap-3">
        {lista.map(l => {
          const link = linkPncp(l.numeroControlePncp) || l.link
          const rascunho = rascunhoPorNumero[l.numeroControlePncp]
          return (
            <article key={l.numeroControlePncp} className="bg-white p-4 rounded shadow grid gap-2">
              <h4 className="font-semibold leading-snug">{l.objeto || 'Objeto não informado'}</h4>
              <p className="text-sm text-gray-600">
                {valorBR(l.valorEstimado)} · {[l.municipio, l.uf].filter(Boolean).join('/') || 'Local não informado'}
                {l.modalidade ? ` · ${l.modalidade}` : ''}
              </p>
              <p className="text-sm text-gray-600">{encerramentoBR(l.encerramento)} · {l.orgao || 'Órgão não informado'}</p>
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  onClick={() => alternar(l)}
                  disabled={ocupado === l.numeroControlePncp}
                  className={l.acompanhada ? 'btn btn-ghost' : 'btn btn-primary'}
                >
                  {l.acompanhada ? 'Deixar de acompanhar' : '⭐ Acompanhar'}
                </button>
                {l.acompanhada && rascunho && (
                  <Link to={`/licitacoes/novo?rascunho=${rascunho}`} className="btn btn-ghost">Continuar cadastro</Link>
                )}
                {link && <a href={link} target="_blank" rel="noreferrer" className="text-sm underline text-gray-600">Ver no PNCP</a>}
              </div>
            </article>
          )
        })}
      </div>

      {paginas > 1 && (
        <div className="flex gap-2 justify-center items-center mt-4">
          <button type="button" className="btn btn-ghost" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</button>
          <span className="text-sm text-gray-600">Página {pagina + 1} de {paginas}</span>
          <button type="button" className="btn btn-ghost" disabled={pagina + 1 >= paginas} onClick={() => setPagina(p => p + 1)}>Próxima</button>
        </div>
      )}
    </div>
  )
}
