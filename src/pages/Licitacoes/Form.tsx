import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import ContractorModal from '../../components/ContractorModal'
import AttachmentsModal from '../../components/AttachmentsModal'
import ItemsImportModal from '../../components/ItemsImportModal'
import { nowInBrasilia } from '../../utils/date'
import { DateInputBR, TimeInputBR } from '../../components/DateTimeBR'
import { listContratantes } from '../../utils/contratantes'
import { getLicitacao, createLicitacao, updateLicitacao, previewNextCodigo, getRascunho, confirmarRascunho } from '../../utils/licitacoes'
import { auditLog } from '../../utils/audit'
import { replaceItems } from '../../utils/items'
import { itensDoPncp, juntarItens, lerEditalDoRascunho, pedirLeituraEdital, preencherDoEdital, type EditalDoRascunho, type ItemCadastro, type Origem } from '../../utils/edital'

type Leitura = { estado: 'lendo' | 'pronto' | 'sem_ia' | 'teto' | 'falhou' | 'erro'; avisos?: string[]; msg?: string }

const MSG_LEITURA: Record<Exclude<Leitura['estado'], 'pronto'>, string> = {
  lendo: '📄 Lendo o edital com IA (cerca de 1 minuto). Os campos se completam sozinhos; pode ir conferindo.',
  sem_ia: 'A leitura do edital com IA não está ligada por aqui. Complete os campos olhando o edital.',
  teto: 'O limite diário de leitura com IA acabou. Complete olhando o edital ou tente amanhã.',
  falhou: 'Não consegui ler este edital (arquivo ilegível ou fora do ar). Complete olhando o edital.',
  erro: 'Não consegui buscar a leitura do edital.',
}

// Cinco minutos conferindo a cada 5 s; a leitura no servidor desiste aos 4 minutos.
const MAX_CONFERENCIAS = 60

type Licitacao = {
  codigo: number
  ano: number
  contratado?: string
  numeroPregao?: string
  numeroProcesso?: string
  portal?: string
  tipoObjeto?: string
  objetoLicitacao?: string
  status?: string
  dataCredenciamento?: string
  horaCredenciamento?: string
  dataLicitacao?: string
  horaLicitacao?: string
  tipoDisputa?: string
  definJulgamento?: string
  prazoValidade?: string
  prazoEntrega?: string
  localEntrega?: string
  prazoPagamento?: string
  prazoGarantia?: string
  vigenciaContrato?: string
  habilitacao?: any
  [key: string]: any
}

export default function FormLicitacao() {
  const { user } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const [modelo, setModelo] = useState<Licitacao>({ codigo: 0, ano: new Date().getFullYear() })
  const [isEditing, setIsEditing] = useState(false)
  // Rascunho do Radar sendo completado: o id do processo (ainda sem código).
  const [rascunhoId, setRascunhoId] = useState<string | null>(null)
  // O que veio do edital (IA) e do PNCP: sugestões marcadas no formulário para conferir.
  const [leitura, setLeitura] = useState<Leitura | null>(null)
  const [origem, setOrigem] = useState<Record<string, Origem>>({})
  // Itens: a lista oficial do PNCP manda; os lidos pela IA só completam descrições
  // (ou valem sozinhos quando o PNCP não traz lista).
  const [numeroPncp, setNumeroPncp] = useState<string | null>(null)
  const [itensPncp, setItensPncp] = useState<ItemCadastro[] | null>(null)
  const [itensIa, setItensIa] = useState<ItemCadastro[]>([])
  const [salvarItens, setSalvarItens] = useState(true)
  const [tentativa, setTentativa] = useState(0)
  const [selectedContratante, setSelectedContratante] = useState<any>(null)
  const [contratanteFocused, setContratanteFocused] = useState(false)
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false)
  const [showItemsImportModal, setShowItemsImportModal] = useState(false)
  const [showContractorModal, setShowContractorModal] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState('')
  const [contratantes, setContratantes] = useState<any[]>([])
  const [habilitacao, setHabilitacao] = useState<any>({
    habilitacaoJuridica: false,
    habilitacaoFiscal: false,
    balanco: false,
    anvisa: false,
    boasPraticas: false,
    laudo: false,
    bula: false,
    ggrem: false,
    cti: false,
    outras: false,
    outrasTexto: '',
    observacaoInterna: ''
  })

  useEffect(() => {
    let mounted = true
    const init = async () => {
      const params = new URLSearchParams(location.search)
      const edit = params.get('edit')
      const rascunho = params.get('rascunho')
      // load contratantes
      try {
        const cs = await listContratantes()
        if (mounted) setContratantes(cs)
      } catch { /* ignore */ }
      if (!mounted) return
      if (edit) {
        const found = await getLicitacao(edit)
        if (found) {
          setModelo(found)
          setHabilitacao(found.habilitacao || ({} as any))
          setIsEditing(true)
          return
        }
      }
      const { date, time } = nowInBrasilia()
      const codigo = await previewNextCodigo()
      if (!mounted) return
      if (rascunho) {
        // Vem preenchido com o que o PNCP tem (objeto, órgão, número, data);
        // a pessoa completa o resto e o código só sai ao salvar.
        const found = await getRascunho(rascunho)
        if (!mounted) return
        if (found) {
          setModelo({ ...found, codigo, ano: found.ano || new Date().getFullYear(), contratado: found.contratante?.nome || '', dataCredenciamento: date, horaCredenciamento: time })
          if (found.contratante?.nome) setSelectedContratante(found.contratante)
          setRascunhoId(rascunho)
          return
        }
        setErroSalvar('Esse rascunho não existe mais (já foi cadastrado ou removido).')
      }
      setModelo(m => ({ ...m, codigo, dataCredenciamento: date, horaCredenciamento: time }))
    }
    init()
    return () => { mounted = false }
  }, [])

  // Só preenche o que está vazio: nunca apaga o que a pessoa já digitou.
  const aplicarEdital = (e: EditalDoRascunho) => {
    const p = preencherDoEdital(e)
    setModelo(m => {
      const n: any = { ...m }
      for (const [campo, valor] of Object.entries(p.campos)) if (!n[campo]) n[campo] = valor
      return n
    })
    setHabilitacao((h: any) => {
      const n = { ...h }
      for (const [campo, valor] of Object.entries(p.habilitacao)) {
        if (valor === true) n[campo] = true
        else if (typeof valor === 'string' && !n[campo]) n[campo] = valor
      }
      return n
    })
    setOrigem(o => ({ ...p.origem, ...o }))
    if (p.itens.length) setItensIa(p.itens)
    if (e.numero) setNumeroPncp(e.numero)
  }

  // Lista oficial dos itens no PNCP (completa, ao contrário da leitura da IA em tabelas longas).
  useEffect(() => {
    if (!numeroPncp) return
    let vivo = true
    itensDoPncp(numeroPncp)
      .then(l => { if (vivo) setItensPncp(l) })
      .catch(() => { if (vivo) setItensPncp([]) })
    return () => { vivo = false }
  }, [numeroPncp])

  const itensDoPncpValem = Boolean(itensPncp && itensPncp.length)
  const itensEdital = useMemo(
    () => (itensDoPncpValem ? juntarItens(itensPncp!, itensIa) : itensIa),
    [itensPncp, itensIa, itensDoPncpValem],
  )

  // Rascunho aberto: busca a leitura do edital; se ninguém pediu ainda, pede e vai conferindo.
  useEffect(() => {
    if (!rascunhoId) return
    let vivo = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let conferencias = 0
    const conferir = async (jaPediu: boolean) => {
      try {
        const e = await lerEditalDoRascunho(rascunhoId)
        if (!vivo) return
        if (conferencias === 0 || e.status === 'pronto') aplicarEdital(e)
        conferencias++
        if (e.status === 'pronto') { setLeitura({ estado: 'pronto', avisos: e.avisos || [] }); return }
        if (e.status === 'processando' || (jaPediu && e.status === null)) {
          if (conferencias > MAX_CONFERENCIAS) { setLeitura({ estado: 'falhou' }); return }
          setLeitura({ estado: 'lendo' })
          timer = setTimeout(() => conferir(true), 5000)
          return
        }
        if (jaPediu) { setLeitura({ estado: 'falhou' }); return }
        // Nunca lido (ou a última leitura falhou): pede ao servidor do Radar.
        const s = await pedirLeituraEdital(rascunhoId)
        if (!vivo) return
        if (s === 'novo' || s === 'processando' || s === 'pronto') {
          setLeitura({ estado: 'lendo' })
          timer = setTimeout(() => conferir(true), s === 'pronto' ? 0 : 5000)
        } else {
          setLeitura({ estado: s })
        }
      } catch (err: any) {
        if (vivo) setLeitura({ estado: 'erro', msg: err?.message })
      }
    }
    conferir(false)
    return () => { vivo = false; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rascunhoId, tentativa])

  // Marca embaixo do campo dizendo de onde veio a sugestão.
  const marca = (campo: string) => {
    const o = origem[campo]
    if (!o) return null
    const texto = o.fonte === 'pncp' ? 'do PNCP, confira'
      : o.fonte === 'sugestao' ? 'sugestão pelos itens, confira'
      : `do edital${o.pagina ? `, p. ${o.pagina}` : ''}${o.confianca === 'baixa' ? ' ⚠ confira com atenção' : ', confira'}`
    return <span className="block text-xs mt-0.5" style={{ color: 'var(--color-accent, #b45309)' }} title={o.trecho || undefined}>📄 {texto}</span>
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setErroSalvar('')
    setSalvando(true)
    const record: any = { ...modelo, criadoPor: user?.name, contratante: selectedContratante || { nome: modelo.contratado }, habilitacao }
    // O código final quem define é a coluna identity do Postgres (nunca
    // colide, mesmo com dois cadastros simultâneos) — o `codigo` calculado
    // em memória (previewNextCodigo) era só uma prévia pra exibir na tela.
    //
    // O erro do banco vira aviso na tela em vez de promise rejeitada sem dono:
    // sem isto, salvar com o Supabase fora do ar não navegava e não dizia nada,
    // e o usuário ficava clicando em Salvar achando que o botão travou.
    try {
      const saved = isEditing ? await updateLicitacao(modelo.codigo, record)
        : rascunhoId ? await confirmarRascunho(rascunhoId, record)
        : await createLicitacao(record)
      if (rascunhoId && salvarItens && itensEdital.length) {
        try {
          await replaceItems(saved.codigo, itensEdital)
        } catch (err: any) {
          // A licitação já está salva; só os itens ficaram de fora.
          window.alert(`Licitação ${saved.codigo} salva, mas os itens do edital não foram gravados: ${err?.message || 'erro desconhecido'}. Use "Importar Itens" na licitação.`)
        }
      }
      try {
        const userName = localStorage.getItem('user_name') || undefined
        await auditLog(isEditing ? 'licitacao_update' : 'licitacao_create', { codigo: saved.codigo, ...(rascunhoId ? { doRadar: true } : {}) }, userName)
      } catch { /* auditoria nunca trava o salvamento */ }
      nav('/licitacoes')
    } catch (err: any) {
      setErroSalvar(err?.message || 'Não foi possível salvar a licitação.')
      setSalvando(false)
    }
  }

  // audit on save
  useEffect(() => {
    return () => {
      // noop
    }
  }, [])

  return (
    <div className="bg-white p-4 sm:p-6 rounded shadow max-w-5xl mx-auto">
      <h3 className="text-xl font-semibold mb-4">{isEditing ? `Editar Licitação ${modelo.codigo}` : rascunhoId ? 'Cadastrar licitação do Radar' : 'Nova Licitação'}</h3>
      {rascunhoId && (
        <p className="text-sm text-gray-600 -mt-2 mb-4">Já vem com o que o PNCP informa e com a leitura do edital pela IA. Confira cada campo marcado com 📄, complete o resto e salve: a licitação ganha o próximo código da empresa e sai dos rascunhos.</p>
      )}
      {rascunhoId && leitura && (
        <div role="status" className="text-sm rounded p-3 mb-4" style={{ background: 'var(--color-bg-subtle, #f3f4f6)' }}>
          {leitura.estado === 'pronto'
            ? <p>📄 Campos preenchidos com a leitura do edital pela IA. A IA pode errar: confira no edital antes de salvar.</p>
            : <p>{MSG_LEITURA[leitura.estado]}{leitura.msg ? ` (${leitura.msg})` : ''}</p>}
          {leitura.avisos?.map((a, i) => <p key={i} className="text-gray-600 mt-1">{a}</p>)}
          {(leitura.estado === 'falhou' || leitura.estado === 'erro') && (
            <button type="button" className="btn btn-ghost mt-2" onClick={() => setTentativa(t => t + 1)}>Tentar ler de novo</button>
          )}
        </div>
      )}
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="f-codigo" className="block text-sm text-gray-600">Código</label>
            <input id="f-codigo" value={modelo.codigo} readOnly className="w-full p-2 bg-gray-100 rounded readonly-field" />
          </div>
          <div>
            <label htmlFor="f-ano" className="block text-sm text-gray-600">Ano</label>
            <input id="f-ano" type="number" value={modelo.ano} onChange={e => setModelo({ ...modelo, ano: Number(e.target.value) })} className="w-full p-2 rounded" />
          </div>
          <div>
            <label htmlFor="f-criadopor" className="block text-sm text-gray-600">Criado por</label>
            <input id="f-criadopor" value={user?.name || ''} readOnly className="w-full p-2 bg-gray-100 rounded readonly-field" />
          </div>
        </div>

        <div>
          <label htmlFor="f-contratante" className="block text-sm text-gray-600">Contratante</label>
          {/* Input e botão lado a lado, não sobrepostos. O botão ficava
              posicionado por cima do campo, e o nome do município digitado
              passava por baixo dele — no celular sobrava menos da metade do
              campo visível. Abaixo de 640px ele desce pra linha de baixo. */}
          <div className="relative">
            <div className="flex flex-col sm:flex-row gap-2">
              <input id="f-contratante" placeholder="Município" value={selectedContratante ? `${selectedContratante.nome} / ${selectedContratante.uf}` : (modelo.contratado || '')} onChange={e => {
                setModelo({ ...modelo, contratado: e.target.value })
                setSelectedContratante(null)
              }} className="w-full p-2 rounded" onFocus={() => setContratanteFocused(true)} onBlur={() => setContratanteFocused(false)} />
              <button type="button" onClick={() => setShowContractorModal(true)} className="btn btn-ghost flex-shrink-0 justify-center whitespace-nowrap">Selecionar/Cadastrar</button>
            </div>
              {/* suggestions */}
              {contratanteFocused && !selectedContratante && String(modelo.contratado || '').trim().length > 0 && (
                (() => {
                  const q = String(modelo.contratado || '').toLowerCase()
                  const matches = contratantes.filter(c => c.nome.toLowerCase().includes(q) || c.uf.toLowerCase().includes(q)).slice(0, 20)
                  return (
                    <div className="absolute left-0 right-0 bg-white border rounded mt-1 max-h-40 overflow-auto z-20">
                      {matches.length > 0 ? matches.map((c) => (
                        <div key={c.codigo} className="px-3 py-2 hover:bg-gray-50 cursor-pointer" onMouseDown={() => {
                          setSelectedContratante(c)
                          setModelo({ ...modelo, contratado: c.nome })
                        }}>{c.codigo} — {c.nome} / {c.uf}</div>
                      )) : (
                        <div className="p-3 text-sm text-gray-500 flex justify-between items-center">
                          <span>Nenhuma sugestão</span>
                          <button type="button" onMouseDown={() => setShowContractorModal(true)} className="text-sm link-primary">Cadastrar</button>
                        </div>
                      )}
                    </div>
                  )
                })()
              )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="f-numeroPregao" className="block text-sm text-gray-600">Número do Pregão</label>
            <input id="f-numeroPregao" value={(modelo as any).numeroPregao || ''} onChange={e => setModelo({ ...modelo, numeroPregao: e.target.value })} className="w-full p-2 rounded" />
          </div>
          <div>
            <label htmlFor="f-numeroProcesso" className="block text-sm text-gray-600">Número do Processo</label>
            <input id="f-numeroProcesso" value={(modelo as any).numeroProcesso || ''} onChange={e => setModelo({ ...modelo, numeroProcesso: e.target.value })} className="w-full p-2 rounded" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="f-portal" className="block text-sm text-gray-600">Portal Eletrônico</label>
            <input id="f-portal" value={(modelo as any).portal || ''} onChange={e => setModelo({ ...modelo, portal: e.target.value })} className="w-full p-2 rounded" />
            {marca('portal')}
          </div>
          <div>
            <label htmlFor="f-tipoObjeto" className="block text-sm text-gray-600">Tipo Objeto</label>
            <select id="f-tipoObjeto" value={(modelo as any).tipoObjeto || ''} onChange={e => setModelo({ ...modelo, tipoObjeto: e.target.value })} className="w-full p-2 rounded">
              <option value="">— selecione —</option>
              <option>Medicamentos</option>
              <option>Materiais</option>
              <option>Misto</option>
            </select>
            {marca('tipoObjeto')}
          </div>
        </div>

        <div>
          <label htmlFor="f-objetoLicitacao" className="block text-sm text-gray-600">Objeto Licitação</label>
          <textarea id="f-objetoLicitacao" value={(modelo as any).objetoLicitacao || ''} onChange={e => setModelo({ ...modelo, objetoLicitacao: e.target.value })} className="w-full p-2 rounded" rows={3} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="f-dataCredenciamento" className="block text-sm text-gray-600">Data de Credenciamento</label>
            <DateInputBR id="f-dataCredenciamento" value={(modelo as any).dataCredenciamento || ''} readOnly className="w-full p-2 rounded readonly-field" />
          </div>
          <div>
            <label htmlFor="f-horaCredenciamento" className="block text-sm text-gray-600">Horário de Credenciamento</label>
            <TimeInputBR id="f-horaCredenciamento" value={(modelo as any).horaCredenciamento || ''} readOnly className="w-full p-2 rounded readonly-field" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="f-dataLicitacao" className="block text-sm text-gray-600">Data da Licitação</label>
            <DateInputBR id="f-dataLicitacao" value={(modelo as any).dataLicitacao || ''} onChange={v => setModelo({ ...modelo, dataLicitacao: v })} className="w-full p-2 rounded" />
          </div>
          <div>
            <label htmlFor="f-horaLicitacao" className="block text-sm text-gray-600">Horário da Licitação</label>
            <TimeInputBR id="f-horaLicitacao" value={(modelo as any).horaLicitacao || ''} onChange={v => setModelo({ ...modelo, horaLicitacao: v })} className="w-full p-2 rounded" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="f-tipoDisputa" className="block text-sm text-gray-600">Tipo de disputa</label>
            <select id="f-tipoDisputa" value={(modelo as any).tipoDisputa || ''} onChange={e => setModelo({ ...modelo, tipoDisputa: e.target.value })} className="w-full p-2 rounded">
              <option value="">— selecione —</option>
              <option>Aberto</option>
              <option>Fechado</option>
              <option>Aberto-Fechado</option>
              <option>Fechado-Aberto</option>
            </select>
            {marca('tipoDisputa')}
          </div>
          <div>
            <label htmlFor="f-definJulgamento" className="block text-sm text-gray-600">Definição de Julgamento</label>
            <select id="f-definJulgamento" value={(modelo as any).definJulgamento || ''} onChange={e => setModelo({ ...modelo, definJulgamento: e.target.value })} className="w-full p-2 rounded">
              <option value="">— selecione —</option>
              <option>Item</option>
              <option>Lote</option>
            </select>
            {marca('definJulgamento')}
          </div>
        </div>

        <div className="mt-2 bg-white border rounded p-4">
          <h4 className="font-semibold mb-1">Prazos</h4>
          <p className="text-sm text-gray-500 mb-3">Deixe em branco quando não se aplicar. Preenchidos, aparecem no alerta de prazos do Dashboard.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="f-dataLimiteRecurso" className="block text-sm text-gray-600">Data-limite pra Recurso</label>
              <DateInputBR id="f-dataLimiteRecurso" value={(modelo as any).dataLimiteRecurso || ''} onChange={v => setModelo({ ...modelo, dataLimiteRecurso: v })} className="w-full p-2 rounded" />
            </div>
            <div>
              <label htmlFor="f-dataLimiteImpugnacao" className="block text-sm text-gray-600">Data-limite pra Impugnação</label>
              <DateInputBR id="f-dataLimiteImpugnacao" value={(modelo as any).dataLimiteImpugnacao || ''} onChange={v => setModelo({ ...modelo, dataLimiteImpugnacao: v })} className="w-full p-2 rounded" />
              {marca('dataLimiteImpugnacao')}
            </div>
          </div>
        </div>

        <div className="mt-2 bg-white border rounded p-4">
          <h4 className="font-semibold mb-3">Proposta</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="f-prazoValidade" className="block text-sm text-gray-600">Validade da Proposta</label>
              <input id="f-prazoValidade" value={(modelo as any).prazoValidade || ''} onChange={e => setModelo({ ...modelo, prazoValidade: e.target.value })} className="w-full p-2 rounded" />
              {marca('prazoValidade')}
            </div>
            <div>
              <label htmlFor="f-prazoEntrega" className="block text-sm text-gray-600">Prazo de Entrega</label>
              <input id="f-prazoEntrega" value={(modelo as any).prazoEntrega || ''} onChange={e => setModelo({ ...modelo, prazoEntrega: e.target.value })} className="w-full p-2 rounded" />
              {marca('prazoEntrega')}
            </div>
            <div>
              <label htmlFor="f-localEntrega" className="block text-sm text-gray-600">Local de Entrega</label>
              <input id="f-localEntrega" value={(modelo as any).localEntrega || ''} onChange={e => setModelo({ ...modelo, localEntrega: e.target.value })} className="w-full p-2 rounded" />
              {marca('localEntrega')}
            </div>
            <div>
              <label htmlFor="f-prazoPagamento" className="block text-sm text-gray-600">Prazo de Pagamento</label>
              <input id="f-prazoPagamento" value={(modelo as any).prazoPagamento || ''} onChange={e => setModelo({ ...modelo, prazoPagamento: e.target.value })} className="w-full p-2 rounded" />
              {marca('prazoPagamento')}
            </div>
            <div>
              <label htmlFor="f-prazoGarantia" className="block text-sm text-gray-600">Prazo de Garantia</label>
              <input id="f-prazoGarantia" value={(modelo as any).prazoGarantia || 'Conforme Edital'} onChange={e => setModelo({ ...modelo, prazoGarantia: e.target.value })} className="w-full p-2 rounded" />
              {marca('prazoGarantia')}
            </div>
            <div>
              <label htmlFor="f-vigenciaContrato" className="block text-sm text-gray-600">Vigência do Contrato</label>
              <input id="f-vigenciaContrato" value={(modelo as any).vigenciaContrato || '12 (doze) meses'} onChange={e => setModelo({ ...modelo, vigenciaContrato: e.target.value })} className="w-full p-2 rounded" />
              {marca('vigenciaContrato')}
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white border rounded p-4">
          <h4 className="font-semibold mb-2">Habilitação (Checklist)</h4>
          {origem.habilitacao && <p className="mb-2">{marca('habilitacao')}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex items-center gap-2"><input type="checkbox" checked={habilitacao.habilitacaoJuridica} onChange={e => setHabilitacao({ ...habilitacao, habilitacaoJuridica: e.target.checked })} /> Habilitação Jurídica</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={habilitacao.habilitacaoFiscal} onChange={e => setHabilitacao({ ...habilitacao, habilitacaoFiscal: e.target.checked })} /> Habilitação Fiscal, Social e Trabalhista</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={habilitacao.balanco} onChange={e => setHabilitacao({ ...habilitacao, balanco: e.target.checked })} /> Balanço</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={habilitacao.anvisa} onChange={e => setHabilitacao({ ...habilitacao, anvisa: e.target.checked })} /> Anvisa</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={habilitacao.boasPraticas} onChange={e => setHabilitacao({ ...habilitacao, boasPraticas: e.target.checked })} /> Boas Práticas</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={habilitacao.laudo} onChange={e => setHabilitacao({ ...habilitacao, laudo: e.target.checked })} /> Laudo</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={habilitacao.bula} onChange={e => setHabilitacao({ ...habilitacao, bula: e.target.checked })} /> Bula</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={habilitacao.ggrem} onChange={e => setHabilitacao({ ...habilitacao, ggrem: e.target.checked })} /> GGREM</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={habilitacao.cti} onChange={e => setHabilitacao({ ...habilitacao, cti: e.target.checked })} /> CTI com Transportadora</label>
            <div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={habilitacao.outras} onChange={e => setHabilitacao({ ...habilitacao, outras: e.target.checked })} /> Outras declarações</label>
              {habilitacao.outras && <textarea value={habilitacao.outrasTexto} onChange={e => setHabilitacao({ ...habilitacao, outrasTexto: e.target.value })} className="w-full p-2 rounded mt-2" placeholder="Descrever outras declarações" />}
            </div>
          </div>

          <div className="mt-3">
            <label htmlFor="f-observacaoInterna" className="block text-sm text-gray-600">Observação interna</label>
            <textarea id="f-observacaoInterna" value={habilitacao.observacaoInterna} onChange={e => setHabilitacao({ ...habilitacao, observacaoInterna: e.target.value })} className="w-full p-2 rounded" />
          </div>
        </div>

        {rascunhoId && itensEdital.length > 0 && (
          <div className="mt-6 bg-white border rounded p-4">
            <h4 className="font-semibold mb-1">{itensDoPncpValem ? 'Itens da licitação' : 'Itens do edital'} ({itensEdital.length})</h4>
            <p className="text-xs mb-2" style={{ color: 'var(--color-accent, #b45309)' }}>{itensDoPncpValem
              ? '📋 Lista oficial do PNCP: número, quantidade, unidade e valor de referência. Quando a IA leu o mesmo item no edital com mais detalhe, a descrição vem do edital.'
              : '📄 Lidos do edital pela IA (o PNCP não trouxe a lista): em tabelas longas ela pode pular itens, confira com o edital.'}
            {' '}O valor de referência entra na coluna Município.</p>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-600"><th className="p-1">Item</th><th className="p-1">Descrição</th><th className="p-1">Unid.</th><th className="p-1">Qtd.</th><th className="p-1">Valor ref.</th></tr></thead>
                <tbody>
                  {itensEdital.map((it, i) => (
                    <tr key={i} className="border-t border-gray-100 align-top">
                      <td className="p-1">{it.item}</td>
                      <td className="p-1">{it.descricao}</td>
                      <td className="p-1">{it.unidade}</td>
                      <td className="p-1">{it.quantidade ?? '—'}</td>
                      <td className="p-1">{it.valorUnitMunicipio != null ? it.valorUnitMunicipio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="flex items-center gap-2 mt-2 text-sm">
              <input type="checkbox" checked={salvarItens} onChange={e => setSalvarItens(e.target.checked)} /> Salvar estes itens junto com a licitação
            </label>
          </div>
        )}

        {erroSalvar && (
          <div role="alert" className="p-3 rounded text-sm" style={{ backgroundColor: 'var(--color-error-text)', color: '#fff' }}>
            {erroSalvar}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary disabled:opacity-50" type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" onClick={() => setShowAttachmentsModal(true)} className="btn btn-ghost">Anexos</button>
          <button type="button" onClick={() => setShowItemsImportModal(true)} className="btn btn-ghost">Importar Itens</button>
        </div>
      </form>
      <AttachmentsModal open={showAttachmentsModal} onClose={() => setShowAttachmentsModal(false)} codigo={modelo.codigo} />
      <ItemsImportModal open={showItemsImportModal} onClose={() => setShowItemsImportModal(false)} codigo={modelo.codigo} />
      <ContractorModal open={showContractorModal} onClose={async () => {
        setShowContractorModal(false)
        try {
          const cs = await listContratantes()
          setContratantes(cs)
        } catch { /* ignore */ }
      }} onSelect={(c) => { setSelectedContratante(c); setModelo(m => ({ ...m, contratado: c.nome })) }} />
    </div>
  )
}
