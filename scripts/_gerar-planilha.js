// Gera planilhas de teste no formato "02. MODELO DE COTAÇÃO" para os testes E2E.
const XLSX = require('xlsx')

function construir({ comColunaA = false, itens = [], semCabecalho = false, cabecalhoErrado = false } = {}) {
  const wb = XLSX.utils.book_new()
  const ws = {}
  const set = (addr, v) => { ws[addr] = { t: typeof v === 'number' ? 'n' : 's', v } }

  if (comColunaA) set('A1', ' ')

  set('C2', 'PREGÃO'); set('D2', 'CIDADE/UF'); set('F2', 'DATA'); set('G2', 'HORÁRIO'); set('H2', 'PORTAL')
  set('E3', 'DISPUTA'); set('H4', 'MARGEM'); set('J4', 0.23)

  if (!semCabecalho) {
    set('B7', cabecalhoErrado ? 'COD. KRALEN' : 'COD. KRALEN')
    set('C7', cabecalhoErrado ? 'OUTRA COISA' : 'ITEM')
    set('D7', 'DESCRIÇÃO'); set('E7', 'UNID.'); set('F7', 'QUANT.')
    set('G7', 'MARCA'); set('H7', 'ORIGEM COTAÇÃO'); set('I7', 'VALOR UNIT.\r\nMINIMO'); set('K7', 'VALOR TOTAL\r\nMINIMO')
    set('L7', 'VALOR UNIT.\r\nMUNICIPIO'); set('N7', 'VALOR TOTAL\r\nMUNICIPIO'); set('O7', 'CUSTO'); set('P7', 'TOTAL CUSTO')
    set('Q7', 'GANHADOR'); set('S7', 'MARCA'); set('T7', 'VALOR'); set('U7', '%'); set('V7', 'VALOR TOTAL ARREMATADO')
  }

  let linha = 8
  for (const it of itens) {
    set(`B${linha}`, it.codKralen); set(`C${linha}`, it.item); set(`D${linha}`, it.descricao)
    set(`E${linha}`, it.unidade); set(`F${linha}`, it.quantidade); set(`G${linha}`, it.marca)
    set(`H${linha}`, it.origem); set(`I${linha}`, it.valorUnitMinimo); set(`K${linha}`, it.valorTotalMinimo)
    if (it.valorUnitMunicipio !== undefined) { set(`L${linha}`, it.valorUnitMunicipio); set(`N${linha}`, it.valorTotalMunicipio) }
    set(`O${linha}`, it.custo); set(`P${linha}`, it.totalCusto)
    if (it.ganhador) { set(`Q${linha}`, 'SIM'); set(`S${linha}`, it.marcaVencedora || it.marca); set(`T${linha}`, it.valorArrematado); set(`V${linha}`, it.valorTotalArrematado) }
    linha++
  }
  // linhas em branco do modelo (devem ser ignoradas na importação)
  for (let i = 0; i < 5; i++) { set(`C${linha}`, linha - 7); set(`I${linha}`, 0); set(`K${linha}`, 0); linha++ }

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: comColunaA ? 0 : 1 }, e: { r: linha, c: 21 } })
  XLSX.utils.book_append_sheet(wb, ws, 'COTAÇÃO')
  return wb
}

const ITENS_PADRAO = [
  { codKralen: 'KR-100', item: 1, descricao: 'SONDA URETRAL Nº 10', unidade: 'UNID.', quantidade: 5000, marca: 'POLIMAX', origem: 'Fornecedor A', valorUnitMinimo: 24.6, valorTotalMinimo: 123000, valorUnitMunicipio: 26, valorTotalMunicipio: 130000, custo: 20, totalCusto: 100000 },
  { codKralen: 'KR-200', item: 2, descricao: 'SERINGA 5ML', unidade: 'CX', quantidade: 300, marca: 'MEDIX', origem: 'Fornecedor B', valorUnitMinimo: 12.3, valorTotalMinimo: 3690, custo: 10, totalCusto: 3000, ganhador: true, marcaVencedora: 'MEDIX PLUS', valorArrematado: 11.5, valorTotalArrematado: 3450 },
  { codKralen: 'KR-300', item: 3, descricao: 'LUVA CIRÚRGICA', unidade: 'PAR', quantidade: 1000, marca: 'SUPERMAX', origem: 'Fornecedor C', valorUnitMinimo: 3.69, valorTotalMinimo: 3690, custo: 3, totalCusto: 3000 },
]

if (require.main === module) {
  const dir = __dirname
  XLSX.writeFile(construir({ itens: ITENS_PADRAO }), `${dir}/_p-normal.xlsx`)
  XLSX.writeFile(construir({ itens: ITENS_PADRAO, comColunaA: true }), `${dir}/_p-deslocada.xlsx`)
  XLSX.writeFile(construir({ itens: [], semCabecalho: true }), `${dir}/_p-sem-cabecalho.xlsx`)
  XLSX.writeFile(construir({ itens: ITENS_PADRAO, cabecalhoErrado: true }), `${dir}/_p-cabecalho-errado.xlsx`)
  XLSX.writeFile(construir({ itens: [] }), `${dir}/_p-vazia.xlsx`)
  console.log('planilhas de teste geradas')
}

module.exports = { construir, ITENS_PADRAO }
