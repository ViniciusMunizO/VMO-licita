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

// Única conta que o sistema tem permissão de fazer sobre os itens importados
// (todo o resto só é transferido da planilha, sem cálculo): "Custo + TX (Uni)"
// = Valor Custo acrescido do percentual de TX daquela linha, confirmado com a
// fórmula da própria planilha de origem (=VALOR_CUSTO*(1+TX/100)).
export function calcCustoUnitario(valorCusto: any, tx: any): number | '' {
  const vc = Number(valorCusto)
  const t = Number(tx)
  if (valorCusto === undefined || valorCusto === null || valorCusto === '' || isNaN(vc)) return ''
  if (tx === undefined || tx === null || tx === '' || isNaN(t)) return ''
  return Number((vc * (1 + t / 100)).toFixed(4))
}

// Segunda conta liberada pelo cliente: Total Custo = Custo + TX (Uni) × Quantidade,
// recalculado sempre que um dos dois muda (mesmo padrão do custoUnitario acima).
export function calcTotalCusto(custoUnitario: any, quantidade: any): number | '' {
  const cu = Number(custoUnitario)
  const q = Number(quantidade)
  if (custoUnitario === undefined || custoUnitario === null || custoUnitario === '' || isNaN(cu)) return ''
  if (quantidade === undefined || quantidade === null || quantidade === '' || isNaN(q)) return ''
  return Number((cu * q).toFixed(4))
}

// Registro ANVISA tem 13 dígitos; a exibição é limitada a isso pra não
// estourar a coluna quando o dado vier formatado ou com caracteres a mais.
export function formatAnvisa(value: any): string {
  if (value === undefined || value === null || value === '') return '-'
  const digits = String(value).replace(/\D/g, '')
  return (digits || String(value)).slice(0, 13)
}
