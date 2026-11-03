// Marcador de valor que não dá pra interpretar como número — diferente de
// null (vazio, que é gravável). Quem chama decide o que fazer: a importação
// aborta antes de escrever qualquer coisa, a edição inline reclama do campo.
export const INVALIDO = Symbol('numero invalido')

// Converte o que chega da planilha ou do input de texto pra número.
//
// O caso silenciosamente perigoso é "1.000": `Number()` devolve 1, e o
// sistema gravava mil como um sem ninguém perceber. Por isso o ponto não é
// tratado como decimal quando o texto tem cara de separador de milhar
// (grupos de exatamente 3 dígitos). Quando aparecem os dois separadores, o
// último a aparecer é o decimal — cobre tanto "1.200,50" (pt-BR) quanto
// "1,200.50", que às vezes escapa de planilha configurada em inglês.
export function paraNumero(valor: any): number | null | typeof INVALIDO {
  if (valor === null || valor === undefined) return null
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : INVALIDO
  if (typeof valor !== 'string') return INVALIDO

  //   = espaço não-separável, comum em valor copiado de portal/planilha.
  const texto = valor.replace(/ /g, ' ').replace(/R\$/gi, '').replace(/\s/g, '').trim()
  if (texto === '') return null
  if (!/^-?[\d.,]+$/.test(texto)) return INVALIDO

  const temVirgula = texto.includes(',')
  const temPonto = texto.includes('.')
  let normalizado: string
  if (temVirgula && temPonto) {
    const decimal = texto.lastIndexOf(',') > texto.lastIndexOf('.') ? ',' : '.'
    const milhar = decimal === ',' ? '.' : ','
    normalizado = texto.split(milhar).join('').replace(decimal, '.')
  } else if (temVirgula) {
    normalizado = texto.replace(',', '.')
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(texto)) {
    normalizado = texto.split('.').join('')
  } else {
    normalizado = texto
  }

  const num = Number(normalizado)
  return Number.isFinite(num) ? num : INVALIDO
}
