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
