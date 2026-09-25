// Agrupa os itens por lote preservando a ordem de primeira aparição de cada
// lote na planilha — evita depender de ordenação numérica/alfabética quando
// o rótulo do lote não é necessariamente um número puro.
export function agruparPorLote(items: any[]): { lote: string | null; items: any[] }[] {
  const temLote = items.some(it => it.lote)
  if (!temLote) return [{ lote: null, items }]
  const grupos = new Map<string, any[]>()
  for (const it of items) {
    const chave = String(it.lote || 'Sem lote')
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave)!.push(it)
  }
  return Array.from(grupos.entries()).map(([lote, items]) => ({ lote, items }))
}

export function somaColuna(items: any[], key: string): number {
  return items.reduce((soma, it) => soma + (Number(it[key]) || 0), 0)
}

// Motivos padronizados de desclassificação — antes era texto livre, o que
// impedia agregar ("Documentação" e "documentação" contavam separado). Fica
// gravado em `motivoDesclassificacao` como o próprio rótulo, ou
// "Outro: <detalhe>" quando não se encaixa nas categorias fixas.
export const MOTIVOS_DESCLASSIFICACAO = ['Preço', 'Documentação', 'Prazo', 'Especificação técnica', 'Outro'] as const

export function parseMotivo(raw: string): { categoria: string; detalhe: string } {
  if (!raw) return { categoria: '', detalhe: '' }
  const categoriaExata = MOTIVOS_DESCLASSIFICACAO.find(m => (m as string) !== 'Outro' && m === raw)
  if (categoriaExata) return { categoria: categoriaExata, detalhe: '' }
  if (raw.startsWith('Outro: ')) return { categoria: 'Outro', detalhe: raw.slice('Outro: '.length) }
  // Texto livre lançado antes da padronização — entra no balde "Outro".
  return { categoria: 'Outro', detalhe: raw }
}

export function formatMotivo(categoria: string, detalhe: string): string {
  if (!categoria) return ''
  if (categoria === 'Outro') return detalhe ? `Outro: ${detalhe}` : 'Outro'
  return categoria
}
