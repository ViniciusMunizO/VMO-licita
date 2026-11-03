import { supabase } from './supabaseClient'

// "Continuar cadastro" do Radar: o que o PNCP e a leitura do edital pela IA trazem viram
// sugestões no formulário. Nada é salvo sem a pessoa conferir e clicar em Salvar.

export type Confianca = 'alta' | 'media' | 'baixa'
type Campo = { valor: string | null; pagina: number | null; trecho: string | null; confianca: Confianca }
type ItemEdital = { numero: string | null; descricao: string; quantidade: string | null; unidade: string | null; valorUnitario: string | null }
type Documento = { descricao: string }
type Declaracao = { descricao: string }

export type ResumoEdital = Partial<Record<
  'objeto' | 'prazoImpugnacao' | 'criterioJulgamento' | 'plataforma' | 'modoDisputa' | 'validadeProposta'
  | 'prazoEntrega' | 'prazoPagamento' | 'vigencia' | 'garantia' | 'localEntrega', Campo>> & {
  documentosHabilitacao?: Documento[]
  itens?: ItemEdital[]
  declaracoes?: Declaracao[]
}

export type EditalDoRascunho = {
  numero: string | null
  pncp: { plataforma: string | null; modoDisputa: string | null; modalidade: string | null; valorEstimado: number | null } | null
  status: 'processando' | 'pronto' | 'erro' | null
  resumo: ResumoEdital | null
  avisos: string[] | null
}

/** De onde veio cada campo preenchido, para a marca "do edital, p. N" no formulário. */
export type Origem = { fonte: 'edital' | 'pncp' | 'sugestao'; pagina?: number | null; trecho?: string | null; confianca?: Confianca }

export type Preenchimento = {
  campos: Record<string, string>
  habilitacao: Record<string, boolean | string>
  itens: any[]
  origem: Record<string, Origem>
}

export async function lerEditalDoRascunho(processoId: string): Promise<EditalDoRascunho> {
  const { data, error } = await supabase.rpc('edital_do_rascunho', { p_processo: processoId })
  if (error) throw error
  return data as EditalDoRascunho
}

export type SituacaoLeitura = 'novo' | 'processando' | 'pronto' | 'sem_ia' | 'teto' | 'falhou'

/** Pede ao servidor do Radar para ler o edital (custa IA; o servidor confere login e empresa). */
export async function pedirLeituraEdital(processoId: string): Promise<SituacaoLeitura> {
  const base = import.meta.env.VITE_RADAR_API_URL
  if (!base) return 'sem_ia'
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sua sessão expirou. Entre de novo.')
  const r = await fetch(`${base.replace(/\/$/, '')}/api/site/edital`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ processo: processoId }),
  })
  const corpo = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(corpo?.erro || 'Não foi possível pedir a leitura do edital.')
  return corpo.status as SituacaoLeitura
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const curto = (t: string, max = 300) => (t.length > max ? `${t.slice(0, max - 1)}…` : t)

/** "Aberto e fechado" -> "Aberto-Fechado" (as opções do formulário). */
export function normalizarDisputa(texto?: string | null): string {
  if (!texto) return ''
  const t = semAcento(texto)
  const a = t.indexOf('aberto')
  const f = t.indexOf('fechado')
  if (a >= 0 && f >= 0) return a < f ? 'Aberto-Fechado' : 'Fechado-Aberto'
  if (a >= 0) return 'Aberto'
  if (f >= 0) return 'Fechado'
  return ''
}

/** "Menor preço por lote" -> "Lote"; "por item" -> "Item". */
export function normalizarJulgamento(texto?: string | null): string {
  if (!texto) return ''
  const t = semAcento(texto)
  if (/\b(lote|lotes|grupo|grupos|global)\b/.test(t)) return 'Lote'
  if (/\bite(m|ns)\b/.test(t)) return 'Item'
  return ''
}

/** Primeira data dd/mm/aaaa do texto, no formato do formulário (aaaa-mm-dd). */
export function primeiraData(texto?: string | null): string {
  const m = texto?.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
  if (!m) return ''
  const [, d, mes, a] = m
  const dia = Number(d), mm = Number(mes)
  if (dia < 1 || dia > 31 || mm < 1 || mm > 12) return ''
  return `${a}-${String(mm).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** "1.234,5" ou "1234.5" -> 1234.5; vazio ou estranho -> null. */
export function numeroBR(texto?: string | null): number | null {
  if (!texto) return null
  const limpo = texto.replace(/[^\d,.-]/g, '')
  if (!limpo) return null
  // Sem vírgula, "1.000" é mil (ponto de milhar), mas "2.5" é dois e meio.
  const milhar = /^-?\d{1,3}(\.\d{3})+$/.test(limpo)
  const n = limpo.includes(',') || milhar ? Number(limpo.replace(/\./g, '').replace(',', '.')) : Number(limpo)
  return Number.isFinite(n) ? n : null
}

const MEDICAMENTO = /medicament|farmac|remedio|comprimido|injetave|ampola|capsula|xarope|antibiotic/
const MATERIAL = /material|materiais|insumo|limpeza|hospitalar|descartave|saneante|higiene|detergente|luva|seringa|gaze|alimenta|merenda|generos/

/** Medicamentos, Materiais ou Misto, pelo objeto e pelos itens. Só uma sugestão. */
export function sugerirTipoObjeto(textos: string[]): string {
  const t = semAcento(textos.join(' '))
  const med = MEDICAMENTO.test(t)
  const mat = MATERIAL.test(t.replace(/material hospitalar e medicament\w*/g, 'material hospitalar'))
  if (med && mat) return 'Misto'
  if (med) return 'Medicamentos'
  if (mat) return 'Materiais'
  return ''
}

// Cada caixa do checklist de habilitação e as palavras que a marcam.
const HABILITACAO: [string, RegExp][] = [
  ['habilitacaoJuridica', /ato constitutivo|contrato social|estatuto|registro comercial|empresario individual|habilitacao juridica/],
  ['habilitacaoFiscal', /fiscal|cnpj|fgts|trabalhista|cndt|debitos|tributo|fazenda|inss|seguridade social/],
  ['balanco', /balanco|indices|falencia|recuperacao judicial|economico-financeira|economico financeira|patrimonio liquido/],
  ['anvisa', /anvisa|autorizacao de funcionamento|\bafe\b|vigilancia sanitaria|licenca sanitaria|alvara sanitario|registro .{0,30}ministerio da saude/],
  ['boasPraticas', /boas praticas|\bcbp/],
  ['laudo', /laudo/],
  ['bula', /\bbula/],
  ['ggrem', /ggrem|cmed/],
  ['cti', /transportadora|\bcti\b/],
]

/** Transforma o que veio do banco em valores para o formulário, com a origem de cada um. */
export function preencherDoEdital(e: EditalDoRascunho): Preenchimento {
  const campos: Record<string, string> = {}
  const origem: Record<string, Origem> = {}
  const habilitacao: Record<string, boolean | string> = {}
  const r = e.resumo || {}

  const doEdital = (campo: string, c: Campo | undefined, valor?: string) => {
    const v = valor ?? (c?.valor ? curto(c.valor.trim()) : '')
    if (!v || !c) return false
    campos[campo] = v
    origem[campo] = { fonte: 'edital', pagina: c.pagina, trecho: c.trecho, confianca: c.confianca }
    return true
  }

  if (!doEdital('portal', r.plataforma) && e.pncp?.plataforma) {
    campos.portal = curto(e.pncp.plataforma)
    origem.portal = { fonte: 'pncp' }
  }
  const disputa = normalizarDisputa(r.modoDisputa?.valor)
  if (!doEdital('tipoDisputa', r.modoDisputa, disputa)) {
    const doPncp = normalizarDisputa(e.pncp?.modoDisputa)
    if (doPncp) { campos.tipoDisputa = doPncp; origem.tipoDisputa = { fonte: 'pncp' } }
  }
  doEdital('definJulgamento', r.criterioJulgamento, normalizarJulgamento(r.criterioJulgamento?.valor))
  doEdital('dataLimiteImpugnacao', r.prazoImpugnacao, primeiraData(r.prazoImpugnacao?.valor))
  doEdital('prazoValidade', r.validadeProposta)
  doEdital('prazoEntrega', r.prazoEntrega)
  doEdital('localEntrega', r.localEntrega)
  doEdital('prazoPagamento', r.prazoPagamento)
  doEdital('prazoGarantia', r.garantia)
  doEdital('vigenciaContrato', r.vigencia)

  const itensEdital = (r.itens || []).filter(i => i?.descricao?.trim())
  const tipo = sugerirTipoObjeto([r.objeto?.valor || '', ...itensEdital.map(i => i.descricao)])
  if (tipo) { campos.tipoObjeto = tipo; origem.tipoObjeto = { fonte: 'sugestao' } }

  const outras: string[] = []
  for (const d of r.documentosHabilitacao || []) {
    const t = semAcento(d.descricao || '')
    const caixas = HABILITACAO.filter(([, re]) => re.test(t)).map(([nome]) => nome)
    caixas.forEach(nome => { habilitacao[nome] = true })
    if (!caixas.length && d.descricao?.trim()) outras.push(curto(d.descricao.trim(), 200))
  }
  for (const d of r.declaracoes || []) if (d.descricao?.trim()) outras.push(`Declaração: ${curto(d.descricao.trim(), 200)}`)
  if (outras.length) {
    habilitacao.outras = true
    habilitacao.outrasTexto = [...new Set(outras)].join('\n')
  }
  if (Object.keys(habilitacao).length) origem.habilitacao = { fonte: 'edital' }

  const itens = itensEdital.map((i, n) => {
    const quantidade = numeroBR(i.quantidade)
    const unitario = numeroBR(i.valorUnitario)
    return {
      item: i.numero?.trim() || String(n + 1),
      descricao: curto(i.descricao.trim(), 2000),
      unidade: i.unidade?.trim() || '',
      quantidade,
      valorUnitMunicipio: unitario,
      valorTotalMunicipio: quantidade != null && unitario != null ? Math.round(quantidade * unitario * 100) / 100 : null,
    }
  })

  return { campos, habilitacao, itens, origem }
}
