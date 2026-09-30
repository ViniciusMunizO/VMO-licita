import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { exportElementsToPdf } from '../../utils/pdf'
import { formatDateTimeBR, formatDateBR, formatEpochBR } from '../../utils/date'
import { formatNumeric, calcTotalCusto, calcValorUnitMinimo, calcValorTotalMinimo, calcValorTotalMunicipio } from '../../utils/format'
import AttachmentsModal from '../../components/AttachmentsModal'
import AtaContratoModal, { Ata } from '../../components/AtaContratoModal'
import DeclaracoesSection from '../../components/DeclaracoesSection'
import EntregasSection from '../../components/EntregasSection'
import PrintableChecklist from '../../components/PrintableChecklist'
import PrintableProposta from '../../components/PrintableProposta'
import { setLancadoNoKralen } from '../../utils/kralen'
import { getLicitacao, updateLicitacao } from '../../utils/licitacoes'
import { listItems, updateItem } from '../../utils/items'
import { MOTIVOS_DESCLASSIFICACAO, PREFIXO_OUTRO, parseMotivo, formatMotivo } from '../../utils/itens'
import { listAttachments, getAttachmentData } from '../../utils/attachments'
import { uploadAnexo, removerDoStorage, urlAssinada } from '../../utils/arquivo'
import { listAtas, addAta, removeAta as removeAtaApi } from '../../utils/atas'
import { getEmpresaInfo } from '../../utils/empresa'
import { auditLog } from '../../utils/audit'
import { confirmarRemocao } from '../../utils/confirmar'
import { addPropostaEmitida, listPropostasEmitidas, PropostaEmitida } from '../../utils/propostas'
import StatusBadge from '../../components/StatusBadge'
import { useModalA11y } from '../../components/useModalA11y'

// Limite de caracteres do motivo de desclassificação — grande o suficiente
// pra uma explicação de verdade (o exemplo real do cliente tem ~140
// caracteres), mas evita que um texto absurdamente longo pese na gravação
// no banco, estoure a célula da tabela nos relatórios ou infle o PDF.
const MOTIVO_MAX_LENGTH = 500
// O que é gravado é "Outro: <detalhe>" — descontar o prefixo aqui evita que o
// campo deixe digitar mais do que cabe e o `saveMotivo` corte o final do
// texto em silêncio na hora de gravar.
const DETALHE_OUTRO_MAX_LENGTH = MOTIVO_MAX_LENGTH - PREFIXO_OUTRO.length

const HABILITACAO_ITEMS: { key: string; label: string }[] = [
  { key: 'habilitacaoJuridica', label: 'Habilitação Jurídica' },
  { key: 'habilitacaoFiscal', label: 'Habilitação Fiscal, Social e Trabalhista' },
  { key: 'balanco', label: 'Balanço' },
  { key: 'anvisa', label: 'Anvisa' },
  { key: 'boasPraticas', label: 'Boas Práticas' },
  { key: 'laudo', label: 'Laudo' },
  { key: 'bula', label: 'Bula' },
  { key: 'ggrem', label: 'GGREM' },
  { key: 'cti', label: 'CTI com Transportadora' },
  { key: 'outras', label: 'Outras declarações' },
]

// Abre o conteúdo (já todo em estilo inline, sem depender do CSS do app) numa
// aba nova e aciona o diálogo de impressão nativo do navegador.
function printElement(el: HTMLElement, title: string) {
  const win = window.open('', '_blank', 'width=900,height=1000')
  if (!win) return
  win.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title></head><body style="margin:0">${el.outerHTML}</body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 300)
}

const ITEM_FIELDS: { key: string; label: string; wide?: boolean }[] = [
  { key: 'lote', label: 'Lote' },
  { key: 'item', label: 'Item' },
  { key: 'codKralen', label: 'Cód. Kralen' },
  { key: 'descricao', label: 'Descrição', wide: true },
  { key: 'unidade', label: 'Uni' },
  { key: 'quantidade', label: 'Qtd' },
  { key: 'marca', label: 'Marca' },
  { key: 'origemCotacao', label: 'Origem Cotação', wide: true },
  { key: 'valorCusto', label: 'Valor Custo' },
  { key: 'totalCusto', label: 'Total Custo' },
  { key: 'valorUnitMinimo', label: 'Valor Unit. Mínimo' },
  { key: 'valorTotalMinimo', label: 'Valor Total Mínimo' },
  { key: 'valorUnitMunicipio', label: 'Valor Unit. Município' },
  { key: 'valorTotalMunicipio', label: 'Valor Total Município' },
  { key: 'status', label: 'Status' },
]

export default function DetailLicitacao() {
  const { codigo } = useParams()
  const nav = useNavigate()
  const [model, setModel] = useState<any>(null)
  const [attachments, setAttachments] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [atas, setAtas] = useState<Ata[]>([])
  const [empresa, setEmpresa] = useState<any>(null)
  const [propostasEmitidas, setPropostasEmitidas] = useState<PropostaEmitida[]>([])
  // Itens/anexos/atas/empresa chegam depois da licitação. Sem essa flag dava
  // pra clicar em "Emitir Proposta" nesse intervalo e sair um PDF sem CNPJ,
  // endereço nem conta bancária — e sem sequer perguntar qual conta usar.
  const [carregandoDados, setCarregandoDados] = useState(true)
  // Erro de leitura precisa aparecer: engolido, ele virava "Nenhum anexo" /
  // "Nenhuma ata" na tela — indistinguível de uma licitação que de fato não
  // tem nada cadastrado.
  const [erroDados, setErroDados] = useState('')
  const printRef = useRef<HTMLDivElement | null>(null)
  const itemsRef = useRef<HTMLDivElement | null>(null)
  const propostaRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const found = await getLicitacao(codigo!)
        if (!mounted) return
        setModel(found || null)
      } catch (err: any) {
        // Sem a licitação a tela não tem o que desenhar, mas travar em
        // "Carregando..." pra sempre é pior do que dizer o que houve.
        if (mounted) {
          setErroDados(`Não consegui carregar esta licitação. ${err?.message || ''}`.trim())
          setCarregandoDados(false)
        }
        return
      }
      // `allSettled`, nunca `all`: são quatro leituras independentes, e com
      // `Promise.all` a primeira que falhasse descartava as outras três já
      // prontas. Foi o que aconteceu quando o banco ficou sem as colunas
      // novas de `attachments` — a licitação aparecia sem NENHUM item, apesar
      // de os itens terem sido lidos sem erro, porque a falha dos anexos
      // derrubava o lote inteiro antes do `setItems`.
      //
      // Cada bloco agora entra na tela por conta própria e o aviso diz qual
      // parte faltou, em vez de culpar as quatro.
      const [resAt, resIt, resAtas, resEmpresa, resPropostas] = await Promise.allSettled([
        listAttachments(codigo!),
        listItems(codigo!),
        listAtas(codigo!),
        getEmpresaInfo(),
        listPropostasEmitidas(Number(codigo)),
      ])
      if (mounted) {
        if (resAt.status === 'fulfilled') setAttachments(resAt.value)
        if (resIt.status === 'fulfilled') setItems(resIt.value)
        if (resAtas.status === 'fulfilled') setAtas(resAtas.value)
        if (resEmpresa.status === 'fulfilled') setEmpresa(resEmpresa.value)
        if (resPropostas.status === 'fulfilled') setPropostasEmitidas(resPropostas.value)

        const falhas = [
          resAt.status === 'rejected' && 'anexos',
          resIt.status === 'rejected' && 'itens',
          resAtas.status === 'rejected' && 'atas/contratos',
          resEmpresa.status === 'rejected' && 'dados da empresa',
          resPropostas.status === 'rejected' && 'histórico de propostas emitidas',
        ].filter(Boolean) as string[]
        if (falhas.length > 0) {
          const detalhe = [resAt, resIt, resAtas, resEmpresa, resPropostas]
            .find(r => r.status === 'rejected') as PromiseRejectedResult | undefined
          setErroDados(`Não consegui carregar: ${falhas.join(', ')}. O resto da licitação está na tela. ${detalhe?.reason?.message || ''}`.trim())
        }
      }
      if (mounted) setCarregandoDados(false)
    }
    load()
    return () => { mounted = false }
  }, [codigo])

  const { user } = useAuth()
  const [openAttachments, setOpenAttachments] = useState(false)
  const [showAtaModal, setShowAtaModal] = useState(false)

  // Deixa o erro subir de propósito: quem trata é o AtaContratoModal, que só
  // fecha e limpa o formulário depois que a gravação confirma.
  const saveAta = async (ata: Ata) => {
    const { arquivo, ...resto } = ata
    let anexo: Ata['anexo'] = null
    if (arquivo) {
      const enviado = await uploadAnexo(arquivo, `atas/${codigo}`)
      anexo = { name: enviado.filename, path: enviado.path, mime: enviado.mime, size: enviado.size }
    }
    let updated: Ata[]
    try {
      updated = await addAta(codigo!, { ...resto, anexo })
    } catch (err) {
      // O arquivo já subiu; sem a linha da ata ninguém mais chegaria nele.
      if (anexo?.path) await removerDoStorage([anexo.path]).catch(() => { /* o erro do insert é o que importa */ })
      throw err
    }
    setAtas(updated)
    try {
      const auditUser = localStorage.getItem('user_name') || undefined
      await auditLog('ata_create', { codigo, tipo: ata.tipo, numero: ata.numero }, auditUser)
    } catch { /* ignore */ }
  }

  // O link do arquivo é gerado no clique: o bucket é privado, então a URL é
  // assinada e de curta duração (e anexo antigo, anterior ao Storage, ainda
  // vem como base64 do banco). A aba é aberta antes do await de propósito:
  // abrir depois de uma operação assíncrona é o que os bloqueadores de pop-up
  // barram.
  const abrirEm = async (obter: () => Promise<string | null>) => {
    const aba = window.open('', '_blank')
    try {
      const url = await obter()
      if (!url) {
        aba?.close()
        setErroDados('O conteúdo deste anexo não está disponível.')
        return
      }
      if (aba) aba.location.href = url
    } catch (err: any) {
      aba?.close()
      setErroDados(err?.message || 'Não consegui abrir o anexo.')
    }
  }

  const abrirAnexo = (att: any) => abrirEm(() => att.path ? urlAssinada(att.path) : getAttachmentData(att.id))

  const abrirAnexoAta = (ata: any) => abrirEm(async () => ata.anexo?.path ? urlAssinada(ata.anexo.path) : (ata.anexo?.data || null))

  const removeAta = async (id: string) => {
    if (!confirmarRemocao('esta ata/contrato')) return
    try {
      const list = await removeAtaApi(id, codigo!)
      setAtas(list)
    } catch (err: any) {
      setErroDados(err?.message || 'Não consegui remover a ata/contrato.')
    }
  }
  const [showPropostaModal, setShowPropostaModal] = useState(false)
  const [bancoProposta, setBancoProposta] = useState('')
  const propostaModalRef = useModalA11y(showPropostaModal, () => setShowPropostaModal(false))

  const gerarPropostaPdf = async (bancoId?: string) => {
    if (!propostaRef.current) return
    await exportElementsToPdf([propostaRef.current], `proposta_${model.codigo}.pdf`, 'Proposta de Preços')
    try {
      const userName = localStorage.getItem('user_name') || undefined
      await auditLog('proposta_emitida', { codigo: model.codigo, bancoId: bancoId ?? model.bancoId }, userName)
    } catch { /* ignore */ }
    try {
      // Retrato do que foi de fato impresso no PDF — se um item mudar de
      // valor depois, este registro continua mostrando o que foi enviado.
      const banco = (empresa?.bancos || []).find((b: any) => b.id === (bancoId ?? model.bancoId))
      await addPropostaEmitida(model.codigo, {
        numeroPregao: model.numeroPregao,
        numeroProcesso: model.numeroProcesso,
        contratante: model.contratante?.nome || model.contratado || '',
        objetoLicitacao: model.objetoLicitacao,
        banco: banco ? { apelido: banco.apelido, banco: banco.banco, agencia: banco.agencia, conta: banco.conta } : null,
        items: items.map((it: any) => ({
          item: it.item, lote: it.lote, marca: it.marca, descricao: it.descricao,
          quantidade: it.quantidade, unidade: it.unidade,
          valorUnitMinimo: it.valorUnitMinimo, valorTotalMinimo: it.valorTotalMinimo,
        })),
      })
      setPropostasEmitidas(await listPropostasEmitidas(model.codigo))
    } catch { /* snapshot é um registro a mais, nunca deve travar a emissão do PDF em si */ }
  }

  // Com mais de uma conta cadastrada, pergunta qual entra na proposta antes de
  // gerar o PDF; com uma só (ou nenhuma) não há o que escolher, gera direto.
  const emitirProposta = async () => {
    const bancos = empresa?.bancos || []
    if (bancos.length <= 1) { await gerarPropostaPdf(); return }
    setBancoProposta(model.bancoId || bancos[0].id)
    setShowPropostaModal(true)
  }

  const confirmarEmissaoProposta = async () => {
    // A conta escolhida fica gravada na licitação: vira o padrão da próxima
    // emissão e também é a que as declarações usam.
    if (bancoProposta !== model.bancoId) {
      const atualizado = await updateLicitacao(model.codigo, { bancoId: bancoProposta || null })
      setModel(atualizado)
      // espera o PDF (renderizado fora da tela) se atualizar com a conta nova
      // antes de virar imagem
      await new Promise(r => setTimeout(r, 200))
    }
    setShowPropostaModal(false)
    await gerarPropostaPdf(bancoProposta)
  }

  const toggleKralen = async (checked: boolean) => {
    const userName = localStorage.getItem('user_name') || undefined
    const list = await setLancadoNoKralen(model.codigo, checked, userName)
    const found = list.find((x: any) => String(x.codigo) === String(model.codigo))
    if (found) setModel(found)
  }

  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null)
  const [editItemDraft, setEditItemDraft] = useState<any>(null)
  const [valorGanhoDraft, setValorGanhoDraft] = useState<Record<number, string>>({})
  const [editingValorGanhoIdx, setEditingValorGanhoIdx] = useState<number | null>(null)

  const saveValorGanho = async (idx: number, valor: string) => {
    const atualizado = await updateItem(items[idx].id, { valorGanho: valor })
    const list = [...items]; list[idx] = atualizado
    setItems(list)
    setValorGanhoDraft(d => { const next = { ...d }; delete next[idx]; return next })
    // sai do modo de edição — o valor salvo aparece como texto fixo, o que
    // deixa claro pra quem usa que o "OK" realmente gravou algo.
    setEditingValorGanhoIdx(current => (current === idx ? null : current))
    try {
      const user = localStorage.getItem('user_name') || undefined
      await auditLog('item_valor_ganho', { codigo: model.codigo, itemIndex: idx, valorGanho: valor, descricao: list[idx].descricao }, user)
    } catch { /* ignore */ }
  }

  const [motivoDraft, setMotivoDraft] = useState<Record<number, { categoria: string; detalhe: string }>>({})
  const [editingMotivoIdx, setEditingMotivoIdx] = useState<number | null>(null)

  // Desclassificar e Vencedor são mutuamente exclusivos — um item desclassificado
  // nunca chegou a disputar, então marcar um limpa o outro.
  const marcarDesclassificado = async (idx: number) => {
    const atualizado = await updateItem(items[idx].id, { desclassificado: true, vencedor: false })
    const list = [...items]; list[idx] = atualizado
    setItems(list)
    setEditingMotivoIdx(idx)
    try {
      const user = localStorage.getItem('user_name') || undefined
      await auditLog('item_desclassificar', { codigo: model.codigo, itemIndex: idx, descricao: list[idx].descricao }, user)
    } catch { /* ignore */ }
  }

  const reverterDesclassificacao = async (idx: number) => {
    const atualizado = await updateItem(items[idx].id, { desclassificado: false })
    const list = [...items]; list[idx] = atualizado
    setItems(list)
  }

  const saveMotivo = async (idx: number) => {
    const draft = motivoDraft[idx] ?? parseMotivo(items[idx].motivoDesclassificacao || '')
    const motivoLimitado = formatMotivo(draft.categoria, draft.detalhe).slice(0, MOTIVO_MAX_LENGTH)
    const atualizado = await updateItem(items[idx].id, { motivoDesclassificacao: motivoLimitado })
    const list = [...items]; list[idx] = atualizado
    setItems(list)
    setMotivoDraft(d => { const next = { ...d }; delete next[idx]; return next })
    setEditingMotivoIdx(current => (current === idx ? null : current))
    try {
      const user = localStorage.getItem('user_name') || undefined
      await auditLog('item_motivo_desclassificacao', { codigo: model.codigo, itemIndex: idx, motivo: motivoLimitado, descricao: list[idx].descricao }, user)
    } catch { /* ignore */ }
  }

  const startEditItem = (idx: number) => {
    setEditingItemIndex(idx)
    setEditItemDraft({ ...items[idx] })
  }

  const cancelEditItem = () => {
    setEditingItemIndex(null)
    setEditItemDraft(null)
  }

  const saveEditItem = async (idx: number) => {
    const atualizado = await updateItem(items[idx].id, editItemDraft)
    const list = [...items]; list[idx] = atualizado
    setItems(list)
    setEditingItemIndex(null)
    setEditItemDraft(null)
    try {
      const auditUser = localStorage.getItem('user_name') || undefined
      await auditLog('item_edit', { codigo: model.codigo, itemIndex: idx, descricao: list[idx].descricao }, auditUser)
    } catch { /* ignore */ }
  }

  const hasLotes = items.some(it => it.lote)

  if (!model) return (
    <div className="bg-white p-4 sm:p-6 rounded shadow max-w-5xl mx-auto">
      <p className="text-sm text-gray-600">Licitação não encontrada.</p>
      <div className="mt-4">
        <button onClick={() => nav('/licitacoes')} className="btn btn-ghost">Voltar</button>
      </div>
    </div>
  )

  return (
    <div className="bg-white p-4 sm:p-6 rounded shadow">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <h3 className="text-lg sm:text-xl font-semibold flex flex-wrap items-center gap-x-3 gap-y-2">
          Licitação {model.codigo} — {model.ano}
          <StatusBadge status={model.status} />
          <label className="flex items-center gap-2 text-sm font-normal text-gray-600">
            <input type="checkbox" checked={!!model.lancadoNoKralen} onChange={e => toggleKralen(e.target.checked)} />
            Lançada no Kralen
          </label>
        </h3>
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          <button onClick={() => setShowAtaModal(true)} className="btn btn-primary">Novo Contrato</button>
          <Link to={`/licitacoes/novo?edit=${model.codigo}`} className="btn btn-primary">Editar</Link>
          <button onClick={() => nav('/licitacoes')} className="btn btn-ghost">Voltar</button>
        </div>
      </div>

      {erroDados && (
        <div role="alert" className="mt-4 p-3 rounded text-sm" style={{ backgroundColor: 'var(--color-error-text)', color: '#fff' }}>
          {erroDados}
        </div>
      )}

      <div className="mt-4">
        <h4 className="font-semibold mb-2">Atas / Contratos</h4>
        {atas.length === 0 ? (
          <div className="text-sm text-gray-500">Nenhuma ata/contrato cadastrado ainda.</div>
        ) : (
          <div className="table-scroll">
            <table className="w-full table-auto text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 whitespace-nowrap">
                  <th className="p-2">Tipo</th>
                  <th className="p-2">Número</th>
                  <th className="p-2">Início da Vigência</th>
                  <th className="p-2">Fim da Vigência</th>
                  <th className="p-2">Observações</th>
                  <th className="p-2">Anexo</th>
                  <th className="p-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {atas.map(a => (
                  <tr key={a.id} className="border-t">
                    <td className="p-2">{a.tipo}</td>
                    <td className="p-2">{a.numero}</td>
                    <td className="p-2">{formatDateBR(a.inicioVigencia)}</td>
                    <td className="p-2">{formatDateBR(a.fimVigencia)}</td>
                    <td className="p-2">{a.observacoes || '-'}</td>
                    <td className="p-2">
                      {a.anexo ? <button onClick={() => abrirAnexoAta(a)} className="link-primary">{a.anexo.name}</button> : '-'}
                    </td>
                    <td className="p-2">
                      <button onClick={() => removeAta(a.id)} className="btn text-xs" style={{ backgroundColor: 'var(--color-error-text)', color: '#fff' }}>Remover</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <strong>Contratante</strong>
          <div className="mt-1">{model.contratante?.nome || model.contratado || model.empresa?.razaoSocial || '-'}</div>
        </div>
        <div>
          <strong>Número do Pregão</strong>
          <div className="mt-1">{model.numeroPregao || '-'}</div>
        </div>
        <div>
          <strong>Número do Processo</strong>
          <div className="mt-1">{model.numeroProcesso || '-'}</div>
        </div>
        <div>
          <strong>Portal</strong>
          <div className="mt-1">{model.portal || '-'}</div>
        </div>
        <div>
          <strong>Data de Credenciamento</strong>
          <div className="mt-1">{formatDateTimeBR(model.dataCredenciamento, model.horaCredenciamento)}</div>
        </div>
        <div>
          <strong>Data da Licitação</strong>
          <div className="mt-1">{formatDateTimeBR(model.dataLicitacao, model.horaLicitacao)}</div>
        </div>
        <div>
          <strong>Tipo Objeto</strong>
          <div className="mt-1">{model.tipoObjeto || '-'}</div>
        </div>
      </div>

      <div className="mt-4">
        <strong>Objeto Licitação</strong>
        <div className="mt-1 whitespace-pre-wrap">{model.objetoLicitacao || '-'}</div>
      </div>

      <div className="mt-6">
        <h4 className="font-semibold">Habilitação (Checklist)</h4>
        {model.habilitacao ? (
          <>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {HABILITACAO_ITEMS.map(({ key, label }) => {
                const checked = !!model.habilitacao[key]
                return (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <span className={checked ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                      {checked ? '✓' : '—'}
                    </span>
                    <span className={checked ? 'text-gray-800' : 'text-gray-500'}>{label}</span>
                  </div>
                )
              })}
            </div>
            {model.habilitacao.outras && model.habilitacao.outrasTexto && (
              <div className="mt-3 text-sm">
                <strong className="text-gray-700">Outras declarações: </strong>
                <span className="text-gray-700">{model.habilitacao.outrasTexto}</span>
              </div>
            )}
            {model.habilitacao.observacaoInterna && (
              <div className="mt-2 text-sm">
                <strong className="text-gray-700">Observação interna: </strong>
                <span className="text-gray-700">{model.habilitacao.observacaoInterna}</span>
              </div>
            )}
          </>
        ) : <div className="text-sm text-gray-500 mt-2">Sem dados de habilitação</div>}
      </div>

      <div className="mt-6">
        <h4 className="font-semibold">Proposta</h4>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <strong>Validade da Proposta</strong>
            <div className="mt-1">{model.prazoValidade || '-'}</div>
          </div>
          <div>
            <strong>Prazo de Entrega</strong>
            <div className="mt-1">{model.prazoEntrega || '-'}</div>
          </div>
          <div>
            <strong>Local de Entrega</strong>
            <div className="mt-1">{model.localEntrega || '-'}</div>
          </div>
          <div>
            <strong>Prazo de Pagamento</strong>
            <div className="mt-1">{model.prazoPagamento || '-'}</div>
          </div>
          <div>
            <strong>Prazo de Garantia</strong>
            <div className="mt-1">{model.prazoGarantia || 'Conforme Edital'}</div>
          </div>
          <div>
            <strong>Vigência do Contrato</strong>
            <div className="mt-1">{model.vigenciaContrato || '12 (doze) meses'}</div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h4 className="font-semibold">Itens</h4>
        {items.length === 0 ? (
          <div className="text-sm text-gray-500 mt-2">Nenhum item importado</div>
        ) : (
          <div className="mt-2 table-scroll">
            <table className="w-full table-auto text-sm min-w-[1100px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 whitespace-nowrap">
                  {hasLotes && <th className="p-2">Lote</th>}
                  <th className="p-2">Item</th>
                  <th className="p-2">Descrição</th>
                  <th className="p-2">Uni</th>
                  <th className="p-2">Qtd</th>
                  <th className="p-2">Cód. Kralen</th>
                  <th className="p-2">Marca</th>
                  <th className="p-2">Origem Cotação</th>
                  <th className="p-2">Valor Custo</th>
                  <th className="p-2">Total Custo</th>
                  <th className="p-2">Valor Mínimo</th>
                  <th className="p-2">Total Mínimo</th>
                  <th className="p-2">Valor Município</th>
                  <th className="p-2">Total Município</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Resultado</th>
                  <th className="p-2">Valor Ganho / Motivo</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const isEditing = editingItemIndex === idx
                  return (
                    <React.Fragment key={idx}>
                      <tr
                        className={`border-t whitespace-nowrap cursor-pointer hover:bg-gray-50 ${isEditing ? 'bg-cyan-50' : ''}`}
                        onClick={() => { if (!isEditing) startEditItem(idx) }}
                        title="Clique para editar este item"
                      >
                        {hasLotes && <td className="p-2">{it.lote || '-'}</td>}
                        <td className="p-2">{it.item ?? idx + 1}</td>
                        <td className="p-2 whitespace-normal">
                          {(() => {
                            const desc = it.descricao || it.description || '-'
                            return desc === '-' || desc.length <= 30 ? desc : desc.slice(0, 30) + '…'
                          })()}
                        </td>
                        <td className="p-2">{it.unidade || '-'}</td>
                        <td className="p-2">{formatNumeric(it.quantidade ?? it.qty)}</td>
                        <td className="p-2">{it.codKralen || '-'}</td>
                        <td className="p-2">{it.marca || '-'}</td>
                        <td className="p-2">{it.origemCotacao || '-'}</td>
                        <td className="p-2">{formatNumeric(it.valorCusto)}</td>
                        <td className="p-2">{formatNumeric(it.totalCusto)}</td>
                        <td className="p-2">{formatNumeric(it.valorUnitMinimo)}</td>
                        <td className="p-2">{formatNumeric(it.valorTotalMinimo)}</td>
                        <td className="p-2">{formatNumeric(it.valorUnitMunicipio)}</td>
                        <td className="p-2">{formatNumeric(it.valorTotalMunicipio)}</td>
                        <td className="p-2">{it.status || '-'}</td>
                        <td className="p-2" onClick={e => e.stopPropagation()}>
                          {it.desclassificado ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-white px-2 py-1 rounded-full" style={{ backgroundColor: 'var(--color-error-text)' }}>✕ Desclassificado</span>
                              <button
                                onClick={() => reverterDesclassificacao(idx)}
                                className="text-xs text-gray-400 hover:text-gray-600 underline"
                              >
                                desmarcar
                              </button>
                            </div>
                          ) : it.vencedor ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-white px-2 py-1 rounded-full" style={{ backgroundColor: '#15803d' }}>✓ Vencedor</span>
                              <button
                                onClick={async () => {
                                  const atualizado = await updateItem(items[idx].id, { vencedor: false })
                                  const list = [...items]; list[idx] = atualizado
                                  setItems(list)
                                  try {
                                    const user = localStorage.getItem('user_name') || undefined
                                    await auditLog('item_mark_winner', { codigo: model.codigo, itemIndex: idx, vencedor: false, descricao: list[idx].descricao }, user)
                                  } catch { /* ignore */ }
                                }}
                                className="text-xs text-gray-400 hover:text-gray-600 underline"
                              >
                                desmarcar
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  const atualizado = await updateItem(items[idx].id, { vencedor: true })
                                  const list = [...items]; list[idx] = atualizado
                                  setItems(list)
                                  setEditingValorGanhoIdx(idx)
                                  try {
                                    const user = localStorage.getItem('user_name') || undefined
                                    await auditLog('item_mark_winner', { codigo: model.codigo, itemIndex: idx, vencedor: true, descricao: list[idx].descricao }, user)
                                  } catch { /* ignore */ }
                                }}
                                className="btn btn-ghost text-xs px-3 py-1.5 font-medium"
                              >
                                Venceu
                              </button>
                              <button
                                onClick={() => marcarDesclassificado(idx)}
                                className="btn btn-ghost text-xs px-3 py-1.5 font-medium"
                                style={{ color: 'var(--color-error-text)' }}
                              >
                                Desclassificar
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="p-2" onClick={e => e.stopPropagation()}>
                          {it.desclassificado ? (
                            editingMotivoIdx === idx || !it.motivoDesclassificacao ? (() => {
                              const motivoAtual = motivoDraft[idx] ?? parseMotivo(it.motivoDesclassificacao || '')
                              return (
                                <div className="flex items-start gap-1">
                                  <div className="flex flex-col gap-1">
                                    <select
                                      autoFocus={editingMotivoIdx === idx}
                                      value={motivoAtual.categoria}
                                      onChange={e => setMotivoDraft(d => ({ ...d, [idx]: { categoria: e.target.value, detalhe: motivoAtual.detalhe } }))}
                                      className="w-48 p-1 rounded text-sm"
                                    >
                                      <option value="" disabled>Selecione o motivo</option>
                                      {MOTIVOS_DESCLASSIFICACAO.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    {motivoAtual.categoria === 'Outro' && (
                                      <div className="flex flex-col">
                                        <input
                                          type="text"
                                          placeholder="Detalhar o motivo"
                                          maxLength={DETALHE_OUTRO_MAX_LENGTH}
                                          value={motivoAtual.detalhe}
                                          onChange={e => setMotivoDraft(d => ({ ...d, [idx]: { categoria: 'Outro', detalhe: e.target.value } }))}
                                          onKeyDown={e => { if (e.key === 'Enter') saveMotivo(idx) }}
                                          className="w-48 p-1 rounded text-sm"
                                        />
                                        <span className="text-[10px] text-gray-400 mt-0.5">
                                          {motivoAtual.detalhe.length}/{DETALHE_OUTRO_MAX_LENGTH}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => saveMotivo(idx)}
                                    disabled={!motivoAtual.categoria}
                                    className="btn btn-primary text-xs px-2 py-1 disabled:opacity-50"
                                  >
                                    OK
                                  </button>
                                </div>
                              )
                            })() : (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-800 break-words" title={it.motivoDesclassificacao}>
                                  {it.motivoDesclassificacao.length > 40 ? it.motivoDesclassificacao.slice(0, 40) + '…' : it.motivoDesclassificacao}
                                </span>
                                <button
                                  onClick={() => setEditingMotivoIdx(idx)}
                                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                                >
                                  editar
                                </button>
                              </div>
                            )
                          ) : !it.vencedor ? (
                            <span className="text-sm text-gray-400">—</span>
                          ) : editingValorGanhoIdx === idx || !it.valorGanho ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="0,00"
                                autoFocus={editingValorGanhoIdx === idx}
                                value={valorGanhoDraft[idx] ?? it.valorGanho ?? ''}
                                onChange={e => setValorGanhoDraft(d => ({ ...d, [idx]: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') saveValorGanho(idx, (e.target as HTMLInputElement).value) }}
                                className="w-24 p-1 rounded text-sm"
                              />
                              <button
                                onClick={() => saveValorGanho(idx, valorGanhoDraft[idx] ?? it.valorGanho ?? '')}
                                className="btn btn-primary text-xs px-2 py-1"
                              >
                                OK
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-800">{it.valorGanho}</span>
                              <button
                                onClick={() => setEditingValorGanhoIdx(idx)}
                                className="text-xs text-gray-400 hover:text-gray-600 underline"
                              >
                                editar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {isEditing && (
                        <tr className="bg-cyan-50/40 border-t">
                          <td colSpan={hasLotes ? 17 : 16} className="p-4" onClick={e => e.stopPropagation()}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                              {ITEM_FIELDS.map(f => (
                                <div key={f.key} className={f.wide ? 'sm:col-span-2' : ''}>
                                  <label className="block text-xs text-gray-600">{f.label}</label>
                                  {f.key === 'descricao' ? (
                                    <textarea
                                      value={editItemDraft?.[f.key] ?? ''}
                                      onChange={e => setEditItemDraft((d: any) => ({ ...d, [f.key]: e.target.value }))}
                                      className="w-full p-1.5 rounded text-sm"
                                      rows={2}
                                    />
                                  ) : (
                                    <input
                                      value={editItemDraft?.[f.key] ?? ''}
                                      onChange={e => {
                                        const val = e.target.value
                                        setEditItemDraft((d: any) => {
                                          const next = { ...d, [f.key]: val }
                                          // Total Custo, Valor Unit. Mínimo (sugerido a partir do Custo +
                                          // margem padrão) e os totais de Mínimo/Município são recalculados
                                          // em cascata, mas continuam campos normais — dá pra sobrescrever
                                          // manualmente depois.
                                          if (f.key === 'valorCusto' || f.key === 'quantidade') {
                                            const totalCusto = calcTotalCusto(next.valorCusto, next.quantidade)
                                            if (totalCusto !== '') next.totalCusto = totalCusto
                                            const valorUnitMinimo = calcValorUnitMinimo(next.valorCusto)
                                            if (valorUnitMinimo !== '') next.valorUnitMinimo = valorUnitMinimo
                                          }
                                          if (f.key === 'valorCusto' || f.key === 'quantidade' || f.key === 'valorUnitMinimo') {
                                            const valorTotalMinimo = calcValorTotalMinimo(next.valorUnitMinimo, next.quantidade)
                                            if (valorTotalMinimo !== '') next.valorTotalMinimo = valorTotalMinimo
                                          }
                                          if (f.key === 'valorUnitMunicipio' || f.key === 'quantidade') {
                                            const valorTotalMunicipio = calcValorTotalMunicipio(next.valorUnitMunicipio, next.quantidade)
                                            if (valorTotalMunicipio !== '') next.valorTotalMunicipio = valorTotalMunicipio
                                          }
                                          return next
                                        })
                                      }}
                                      className="w-full p-1.5 rounded text-sm"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 flex gap-2">
                              <button onClick={() => saveEditItem(idx)} className="btn btn-primary text-sm">Salvar</button>
                              <button onClick={cancelEditItem} className="btn btn-ghost text-sm">Cancelar</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EntregasSection itensVencedores={items.filter((it: any) => it.vencedor)} />

      <DeclaracoesSection modelo={model} />

      <div className="mt-6">
        <h4 className="font-semibold">Anexos</h4>
        <div className="mt-2">
          <button onClick={() => setOpenAttachments(true)} className="btn btn-ghost">Gerenciar Anexos</button>
        </div>
        {attachments.length === 0 ? (
          <div className="text-sm text-gray-500 mt-2">Nenhum anexo</div>
        ) : (
          <ul className="mt-2 list-disc ml-5">
            {attachments.map((a, i) => (
              <li key={i} className="text-sm">
                {a.name || `anexo-${i}`}
                <button onClick={() => abrirAnexo(a)} className="ml-2 link-primary">Abrir</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2 items-center">
        <button disabled={carregandoDados} onClick={() => {
          if (!printRef.current) return
          printElement(printRef.current, `Checklist — Licitação ${model.codigo}`)
        }} className="btn btn-primary disabled:opacity-50">Imprimir Checklist</button>
        <button disabled={carregandoDados} onClick={async () => {
          if (!itemsRef.current) return
          await exportElementsToPdf([itemsRef.current], `itens_${model.codigo}.pdf`, 'Itens', 'landscape')
        }} className="btn btn-primary disabled:opacity-50">Exportar Itens (PDF)</button>
        <button disabled={carregandoDados} onClick={emitirProposta} className="btn btn-primary disabled:opacity-50">Emitir Proposta (PDF)</button>
        {carregandoDados && <span className="text-sm text-gray-500">Carregando dados...</span>}
      </div>

      {propostasEmitidas.length > 0 && (
        <div className="mt-3 text-xs text-gray-500">
          <details>
            <summary className="cursor-pointer select-none">Histórico de propostas emitidas ({propostasEmitidas.length})</summary>
            <ul className="mt-2 space-y-1">
              {propostasEmitidas.map(p => (
                <li key={p.id} className="border-t pt-1 first:border-t-0 first:pt-0">
                  {formatEpochBR(p.emitidoEm)} — {p.emitidoPor || 'usuário removido'}
                  {p.snapshot?.banco?.apelido ? ` — conta "${p.snapshot.banco.apelido}"` : ''}
                  {' — '}{(p.snapshot?.items || []).length} item(ns)
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {showPropostaModal && (
        <div ref={propostaModalRef} className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 sm:p-6 z-50 overflow-y-auto">
          <div className="bg-white rounded shadow max-w-lg w-full p-4 my-auto">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold">Emitir Proposta — Licitação {model.codigo}</h4>
              <button onClick={() => setShowPropostaModal(false)} className="text-gray-500">Fechar</button>
            </div>

            <label htmlFor="proposta-banco" className="block text-sm text-gray-600 mb-1">Conta bancária que vai aparecer na proposta</label>
            <select
              id="proposta-banco"
              value={bancoProposta}
              onChange={e => setBancoProposta(e.target.value)}
              className="w-full p-2 rounded"
            >
              {(empresa?.bancos || []).map((b: any) => (
                <option key={b.id} value={b.id}>
                  {[b.apelido || b.banco || 'Conta sem apelido', b.agencia && `Ag. ${b.agencia}`, b.conta && `C/C ${b.conta}`].filter(Boolean).join(' — ')}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              A conta escolhida também passa a ser usada nas declarações desta licitação.
            </p>

            <div className="mt-4 flex gap-2">
              <button onClick={confirmarEmissaoProposta} className="btn btn-primary">Gerar PDF</button>
              <button onClick={() => setShowPropostaModal(false)} className="btn btn-ghost">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* hidden printable DOM */}
      <div style={{ position: 'absolute', left: -9999 }} aria-hidden>
        <PrintableChecklist modelo={model} codigo={model.codigo} user={user} habilitacao={model.habilitacao} page1Ref={printRef} page2Ref={itemsRef} items={items} attachments={attachments} />
        <PrintableProposta modelo={model} items={items} empresa={empresa} pageRef={propostaRef} />
      </div>

      <AttachmentsModal open={openAttachments} onClose={async () => {
        setOpenAttachments(false)
        try {
          const rawAt = await listAttachments(model.codigo)
          setAttachments(rawAt)
        } catch { /* ignore */ }
      }} codigo={Number(model.codigo)} />

      <AtaContratoModal
        open={showAtaModal}
        onClose={() => setShowAtaModal(false)}
        onSave={saveAta}
        criadoPor={user?.name}
      />
    </div>
  )
}
