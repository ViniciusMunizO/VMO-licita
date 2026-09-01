// Números vindos de planilha (via fórmulas de Excel) costumam chegar com erro
// de ponto flutuante, ex: 0.58 * 1.15 vira 0.6699999999999999. Formata para
// no máximo `maxDecimals` casas decimais, sem casas extras quando o valor é
// exato, e no padrão brasileiro (separador de milhar "." e decimal ","):
// 57500 → "57.500", 0.2875 → "0,2875".
export function formatNumeric(value: any, maxDecimals = 4): string {
  if (value === undefined || value === null || value === '') return '-'
  const num = typeof value === 'number' ? value : Number(value)
  if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '' || isNaN(num))) {
    return String(value)
  }
  if (isNaN(num)) return String(value)
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals }).format(num)
}

function multiplicar(unitario: any, quantidade: any): number | '' {
  const u = Number(unitario)
  const q = Number(quantidade)
  if (unitario === undefined || unitario === null || unitario === '' || isNaN(u)) return ''
  if (quantidade === undefined || quantidade === null || quantidade === '' || isNaN(q)) return ''
  return Number((u * q).toFixed(4))
}

// Margem padrão usada pra sugerir o Valor Unit. Mínimo a partir do Custo,
// igual à fórmula da planilha de cotação do cliente (Custo + 23%). O valor
// calculado é só uma sugestão — dá pra sobrescrever manualmente por item.
export const MARGEM_MINIMO_PADRAO = 23

export function calcValorUnitMinimo(valorCusto: any, margemPercent: number = MARGEM_MINIMO_PADRAO): number | '' {
  const vc = Number(valorCusto)
  if (valorCusto === undefined || valorCusto === null || valorCusto === '' || isNaN(vc)) return ''
  return Number((vc * (1 + margemPercent / 100)).toFixed(4))
}

// Custo/Mínimo/Município têm todos a mesma conta pra chegar no total da
// linha: valor unitário × quantidade.
export function calcTotalCusto(valorCusto: any, quantidade: any): number | '' {
  return multiplicar(valorCusto, quantidade)
}

export function calcValorTotalMinimo(valorUnitMinimo: any, quantidade: any): number | '' {
  return multiplicar(valorUnitMinimo, quantidade)
}

export function calcValorTotalMunicipio(valorUnitMunicipio: any, quantidade: any): number | '' {
  return multiplicar(valorUnitMunicipio, quantidade)
}

// Formata sempre com um número fixo de casas decimais, diferente de
// `formatNumeric` que omite decimais quando o valor é exato — cada relatório
// do sistema atual usa uma precisão diferente pra "Custo": o Relatório de
// Ganhos mostra valores financeiros fechados em 2 casas (ex.: "20.280,00"),
// já o Relatório de Itens Perdidos mostra o custo com 4 casas, a mesma
// precisão usada internamente nos cálculos de custo (ex.: "148,2600").
export function formatFixed(value: any, decimals = 2): string {
  if (value === undefined || value === null || value === '') return '-'
  const num = typeof value === 'number' ? value : Number(value)
  if (isNaN(num)) return String(value)
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num)
}
