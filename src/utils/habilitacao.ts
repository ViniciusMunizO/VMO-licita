// Checklist de habilitação de cada licitação. Os itens vêm da empresa (Informações da Empresa →
// "Itens da checklist de habilitação", coluna itens_habilitacao, migração 0013); antes eram fixos
// para um cliente da área de saúde (Anvisa, Bula, GGREM...).
//
// Como fica guardado na licitação (coluna habilitacao, um objeto):
// - itens que eram fixos continuam com a chave antiga (anvisa: true), para as licitações já
//   salvas seguirem marcadas;
// - itens novos usam a chave "item:<nome do item>" (ex.: "item:Qualificação Técnica": true);
// - outras, outrasTexto e observacaoInterna continuam iguais.

import { semAcento } from './conversa-radar'

/** O mesmo padrão da coluna no banco: vale para empresa que ainda não montou a lista dela. */
export const ITENS_HABILITACAO_PADRAO = [
  'Habilitação Jurídica',
  'Habilitação Fiscal, Social e Trabalhista',
  'Qualificação Econômico-Financeira (Balanço)',
  'Qualificação Técnica',
]
export const MAX_ITENS_HABILITACAO = 60 // limite da coluna no banco

export type ItemHabilitacao = { chave: string; rotulo: string }

// Os itens que eram fixos. `nome`: um item da empresa com esse nome usa a chave antiga.
// `palavras`: o que, num documento pedido pelo edital, indica esse item (sugestão da IA).
const CATEGORIAS: { chave: string; rotulo: string; nome: RegExp; palavras: RegExp }[] = [
  { chave: 'habilitacaoJuridica', rotulo: 'Habilitação Jurídica', nome: /habilitacao juridica/,
    palavras: /ato constitutivo|contrato social|estatuto|registro comercial|empresario individual|habilitacao juridica/ },
  { chave: 'habilitacaoFiscal', rotulo: 'Habilitação Fiscal, Social e Trabalhista', nome: /habilitacao fiscal|regularidade fiscal/,
    palavras: /fiscal|cnpj|fgts|trabalhista|cndt|debitos|tributo|fazenda|inss|seguridade social/ },
  { chave: 'balanco', rotulo: 'Balanço', nome: /balanco|economico.financeira/,
    palavras: /balanco|indices|falencia|recuperacao judicial|economico-financeira|economico financeira|patrimonio liquido/ },
  { chave: 'anvisa', rotulo: 'Anvisa', nome: /anvisa/,
    palavras: /anvisa|autorizacao de funcionamento|\bafe\b|vigilancia sanitaria|licenca sanitaria|alvara sanitario|registro .{0,30}ministerio da saude/ },
  { chave: 'boasPraticas', rotulo: 'Boas Práticas', nome: /boas praticas/, palavras: /boas praticas|\bcbp/ },
  { chave: 'laudo', rotulo: 'Laudo', nome: /^laudo/, palavras: /laudo/ },
  { chave: 'bula', rotulo: 'Bula', nome: /^bula/, palavras: /\bbula/ },
  { chave: 'ggrem', rotulo: 'GGREM', nome: /ggrem/, palavras: /ggrem|cmed/ },
  { chave: 'cti', rotulo: 'CTI com Transportadora', nome: /\bcti\b/, palavras: /transportadora|\bcti\b/ },
]

// Itens comuns que não existiam na lista antiga: um item da empresa com esse nome também é
// reconhecido pelas palavras do documento, não só pelo próprio nome.
const TEMAS: { nome: RegExp; palavras: RegExp }[] = [
  { nome: /qualificacao tecnica|capacidade tecnica/, palavras: /qualificacao tecnica|capacidade tecnica|atestado|acervo tecnico/ },
]

const PREFIXO = 'item:'
const normal = (t: string) => semAcento(t).replace(/\s+/g, ' ').trim()

/** Texto do campo (um item por linha) vira lista, sem repetidos nem vazios. Vírgula não separa:
 *  "Habilitação Fiscal, Social e Trabalhista" é um item só. */
export function itensDeTexto(texto: string): string[] {
  const vistos = new Set<string>()
  return texto.split('\n').map(t => t.replace(/\s+/g, ' ').trim()).filter(t => {
    const chave = normal(t)
    if (!t || vistos.has(chave)) return false
    vistos.add(chave)
    return true
  }).slice(0, MAX_ITENS_HABILITACAO)
}

/** Lista da empresa (ou o padrão, se ela não tem). */
export function itensDaEmpresa(info: Record<string, any> | null | undefined): string[] {
  const lista = Array.isArray(info?.itensHabilitacao) ? itensDeTexto(info!.itensHabilitacao.map(String).join('\n')) : []
  return lista.length ? lista : ITENS_HABILITACAO_PADRAO
}

/** Cada item da empresa com a chave em que fica guardado. */
export function itensComChave(rotulos: string[]): ItemHabilitacao[] {
  const usadas = new Set<string>()
  const itens: ItemHabilitacao[] = []
  for (const rotulo of rotulos) {
    const n = normal(rotulo)
    if (!n) continue
    const categoria = CATEGORIAS.find(c => c.nome.test(n) && !usadas.has(c.chave))
    const chave = categoria ? categoria.chave : PREFIXO + rotulo.trim()
    if (usadas.has(chave)) continue
    usadas.add(chave)
    itens.push({ chave, rotulo: rotulo.trim() })
  }
  return itens
}

/**
 * Itens que aparecem numa licitação: os da empresa e, depois, os que estão marcados nela mas
 * saíram da lista (ex.: "Anvisa" numa licitação antiga), para nada marcado sumir da tela.
 */
export function itensDaLicitacao(rotulos: string[], habilitacao: Record<string, any> | null | undefined): ItemHabilitacao[] {
  const h = habilitacao || {}
  const itens = itensComChave(rotulos).map(item => {
    // Item novo com a mesma escrita sem acento/maiúscula de um já marcado: usa a chave já gravada.
    if (!item.chave.startsWith(PREFIXO) || item.chave in h) return item
    const existente = Object.keys(h).find(k => k.startsWith(PREFIXO) && normal(k.slice(PREFIXO.length)) === normal(item.rotulo))
    return existente ? { ...item, chave: existente } : item
  })
  const chaves = new Set(itens.map(i => i.chave))
  for (const c of CATEGORIAS) {
    if (h[c.chave] === true && !chaves.has(c.chave)) { itens.push({ chave: c.chave, rotulo: c.rotulo }); chaves.add(c.chave) }
  }
  for (const [chave, valor] of Object.entries(h)) {
    if (chave.startsWith(PREFIXO) && valor === true && !chaves.has(chave)) {
      itens.push({ chave, rotulo: chave.slice(PREFIXO.length) })
      chaves.add(chave)
    }
  }
  return itens
}

/**
 * Sugestão a partir dos documentos que o edital pede: marca o item da empresa que corresponde a
 * cada documento. O que não corresponde a nenhum item volta em `sobras` (vai para "Outras").
 */
export function marcarPeloEdital(rotulos: string[], documentos: string[]): { marcados: Record<string, true>; sobras: string[] } {
  const itens = itensComChave(rotulos)
  const marcados: Record<string, true> = {}
  const sobras: string[] = []
  for (const doc of documentos) {
    const t = normal(doc)
    if (!t) continue
    const categorias = new Set(CATEGORIAS.filter(c => c.palavras.test(t)).map(c => c.chave))
    const achados = itens.filter(i => {
      if (categorias.has(i.chave)) return true
      if (!i.chave.startsWith(PREFIXO)) return false
      const rotulo = normal(i.rotulo)
      return t.includes(rotulo) || TEMAS.some(tema => tema.nome.test(rotulo) && tema.palavras.test(t))
    })
    achados.forEach(i => { marcados[i.chave] = true })
    if (!achados.length) sobras.push(doc.trim())
  }
  return { marcados, sobras }
}
