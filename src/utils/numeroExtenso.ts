const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

// Converte um grupo de 0-999 em texto (sem lidar com a escala de milhar/milhão).
function grupoPorExtenso(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100)
  const resto = n % 100
  const partes: string[] = []
  if (c > 0) partes.push(CENTENAS[c])
  if (resto > 0) {
    if (resto < 10) partes.push(UNIDADES[resto])
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10])
    else {
      const d = Math.floor(resto / 10)
      const u = resto % 10
      partes.push(u > 0 ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d])
    }
  }
  return partes.join(' e ')
}

const ESCALAS: { valor: number; singular: string; plural: string }[] = [
  { valor: 1_000_000_000, singular: 'bilhão', plural: 'bilhões' },
  { valor: 1_000_000, singular: 'milhão', plural: 'milhões' },
  { valor: 1_000, singular: 'mil', plural: 'mil' },
]

// Converte a parte inteira (0 a 999.999.999.999) para texto, encadeando os
// grupos de milhar/milhão/bilhão separados por vírgula (e "e" no último
// grupo, quando ele for menor que 100 — regra padrão do português escrito).
function inteiroPorExtenso(n: number): string {
  if (n === 0) return 'zero'
  let resto = n
  const partes: string[] = []
  for (const escala of ESCALAS) {
    const qtd = Math.floor(resto / escala.valor)
    if (qtd > 0) {
      const texto = escala.valor === 1000 && qtd === 1 ? 'mil' : `${grupoPorExtenso(qtd)} ${qtd === 1 ? escala.singular : escala.plural}`
      partes.push(texto)
      resto -= qtd * escala.valor
    }
  }
  if (resto > 0 || partes.length === 0) partes.push(grupoPorExtenso(resto))
  if (partes.length <= 1) return partes.join('')
  const ultimo = partes[partes.length - 1]
  const usaE = resto > 0 && resto < 100
  return usaE
    ? `${partes.slice(0, -1).join(', ')} e ${ultimo}`
    : partes.join(', ')
}

// Formata um valor em reais por extenso, ex.: 35750 -> "trinta e cinco mil,
// setecentos e cinquenta reais"; 1234.5 -> "mil, duzentos e trinta e quatro
// reais e cinquenta centavos".
export function valorPorExtenso(valor: number): string {
  if (!isFinite(valor) || isNaN(valor)) return ''
  const negativo = valor < 0
  const arredondado = Math.round(Math.abs(valor) * 100)
  const reais = Math.floor(arredondado / 100)
  const centavos = arredondado % 100

  const partes: string[] = []
  if (reais > 0 || centavos === 0) {
    partes.push(`${inteiroPorExtenso(reais)} ${reais === 1 ? 'real' : 'reais'}`)
  }
  if (centavos > 0) {
    partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  }
  const texto = partes.join(' e ')
  return negativo ? `menos ${texto}` : texto
}
