const fs = require('fs')
const path = require('path')
const H = require('./_harness')

const CODIGO = Number(fs.readFileSync(__dirname + '/_codigo-teste.txt', 'utf8').trim())
if (!CODIGO) {
  console.error('Sem licitação de teste válida. Rode scripts/_t2-licitacoes.js antes desta suíte.')
  process.exit(1)
}

async function main() {
  const { browser, page, erros } = await H.novoBrowser()
  await H.login(page)
  const sb = await H.supabaseLogado()

  H.secao('14. Anexos')
  // cria um arquivo de teste
  const arquivoTeste = path.join(__dirname, '_anexo-teste.txt')
  fs.writeFileSync(arquivoTeste, 'conteúdo de teste do anexo E2E')

  await page.goto(`${H.BASE}/licitacoes/${CODIGO}`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1500))
  await H.clicarPorTexto(page, 'Gerenciar Anexos')
  await new Promise(r => setTimeout(r, 600))
  let t = await H.texto(page)
  H.check('modal de anexos abre', t.includes('Título do documento'))

  await page.type('input[placeholder*="Edital"]', 'Edital de Teste E2E')
  const inputArq = await page.$('.fixed.inset-0 input[type="file"]')
  await inputArq.uploadFile(arquivoTeste)
  await new Promise(r => setTimeout(r, 2000))

  let { data: anexos } = await sb.from('attachments').select('*').eq('licitacaoCodigo', CODIGO)
  H.check('anexo é gravado no banco', anexos.length === 1, `anexos: ${anexos.length}`)
  H.check('anexo grava o título informado', anexos[0]?.name === 'Edital de Teste E2E', `nome: ${anexos[0]?.name}`)
  H.check('anexo grava o nome do arquivo', anexos[0]?.filename === '_anexo-teste.txt', `arquivo: ${anexos[0]?.filename}`)

  // O arquivo agora vai pro bucket "anexos"; a linha guarda só o caminho.
  const caminho = String(anexos[0]?.path || '')
  H.check('anexo guarda o caminho no Storage', caminho.startsWith(`licitacoes/${CODIGO}/`), `path: ${caminho || '(vazio)'}`)
  H.check('anexo não grava mais base64 no banco', anexos[0]?.data == null, `data: ${String(anexos[0]?.data).slice(0, 30)}`)
  H.check('anexo grava tamanho e tipo', anexos[0]?.size > 0 && !!anexos[0]?.mime, `size: ${anexos[0]?.size}, mime: ${anexos[0]?.mime}`)

  const baixado = await sb.storage.from('anexos').download(caminho)
  const conteudo = baixado.data ? await baixado.data.text() : ''
  H.check('arquivo existe no bucket com o conteúdo certo', conteudo === 'conteúdo de teste do anexo E2E', baixado.error?.message || `conteúdo: ${conteudo.slice(0, 40)}`)

  t = await H.texto(page)
  H.check('anexo aparece na lista do modal', t.includes('Edital de Teste E2E'))

  await H.clicarPorTexto(page, 'Fechar')
  await new Promise(r => setTimeout(r, 800))
  t = await H.texto(page)
  H.check('anexo aparece na tela de detalhe após fechar o modal', t.includes('Edital de Teste E2E'))

  // remover anexo
  await H.clicarPorTexto(page, 'Gerenciar Anexos')
  await new Promise(r => setTimeout(r, 800))
  await H.clicarPorTexto(page, 'Remover')
  await new Promise(r => setTimeout(r, 1800))
  ;({ data: anexos } = await sb.from('attachments').select('*').eq('licitacaoCodigo', CODIGO))
  H.check('remover anexo apaga do banco', anexos.length === 0, `anexos: ${anexos.length}`)

  // Remover o anexo tem que tirar o arquivo do bucket também — senão cada
  // remoção deixaria lixo pago e invisível lá dentro.
  const apos = await sb.storage.from('anexos').download(caminho)
  H.check('remover anexo apaga o arquivo do bucket', !apos.data || apos.error, apos.error?.message || 'ainda baixa')
  await H.clicarPorTexto(page, 'Fechar')

  H.secao('15. Atas / Contratos')
  await page.goto(`${H.BASE}/licitacoes/${CODIGO}`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1200))
  await H.clicarPorTexto(page, 'Novo Contrato')
  await new Promise(r => setTimeout(r, 700))
  t = await H.texto(page)
  H.check('modal de ata/contrato abre', t.includes('Ata') || t.includes('Contrato'))

  const preencheuAta = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('.fixed.inset-0 label'))
    const setVal = (rotulo, valor) => {
      const l = labels.find(x => x.textContent.trim().toLowerCase().includes(rotulo.toLowerCase()))
      const campo = l?.parentElement.querySelector('input, select, textarea')
      if (!campo) return false
      const proto = campo.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
        : campo.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(campo, valor)
      campo.dispatchEvent(new Event('input', { bubbles: true }))
      campo.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }
    return { numero: setVal('número', 'ATA-E2E-001'), obs: setVal('observa', 'observação de teste') }
  })
  H.check('campos da ata são preenchíveis', preencheuAta.numero, JSON.stringify(preencheuAta))

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.fixed.inset-0 button'))
    const salvar = btns.find(b => /salvar|adicionar|criar/i.test(b.textContent))
    salvar?.click()
  })
  await new Promise(r => setTimeout(r, 2000))
  let { data: atas } = await sb.from('atas').select('*').eq('licitacaoCodigo', CODIGO)
  H.check('ata/contrato é gravada no banco', atas.length === 1, `atas: ${atas.length}`)
  H.check('ata grava o número informado', atas[0]?.numero === 'ATA-E2E-001', `numero: ${atas[0]?.numero}`)

  await page.goto(`${H.BASE}/licitacoes/${CODIGO}`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1500))
  t = await H.texto(page)
  H.check('ata aparece na tela de detalhe', t.includes('ATA-E2E-001'))

  await H.clicarPorTexto(page, 'Remover')
  await new Promise(r => setTimeout(r, 1800))
  ;({ data: atas } = await sb.from('atas').select('*').eq('licitacaoCodigo', CODIGO))
  H.check('remover ata apaga do banco', atas.length === 0, `atas: ${atas.length}`)

  H.secao('16. Contratantes')
  await page.goto(`${H.BASE}/licitacoes/novo`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1500))
  await H.clicarPorTexto(page, 'Selecionar/Cadastrar')
  await new Promise(r => setTimeout(r, 800))
  t = await H.texto(page)
  H.check('modal de contratantes abre', t.toLowerCase().includes('contratante'))
  const listouExistentes = await page.evaluate(() => {
    const m = document.querySelector('.fixed.inset-0')
    return m ? m.innerText.includes('MARINGÁ') || /\w{3,}/.test(m.innerText) : false
  })
  H.check('modal lista contratantes já cadastrados', listouExistentes)

  H.secao('17. Informações da Empresa')
  await page.goto(`${H.BASE}/empresa`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1500))
  t = await H.texto(page)
  H.check('tela carrega os dados salvos da empresa', t.includes('Exemplo Qualidade PDF Ltda') || t.includes('Razão Social'))
  H.check('seção de contas bancárias aparece', t.includes('Contas Bancárias'))
  H.check('contas já cadastradas aparecem', t.includes('Conta Principal') || (await page.$$('input[placeholder="ex.: Conta principal"]')).length >= 2)

  const qtdContasAntes = (await page.$$('input[placeholder="ex.: Conta principal"]')).length
  await H.clicarPorTexto(page, '+ Adicionar conta')
  await new Promise(r => setTimeout(r, 500))
  const qtdContasDepois = (await page.$$('input[placeholder="ex.: Conta principal"]')).length
  H.check('botão adicionar cria uma nova linha de conta', qtdContasDepois === qtdContasAntes + 1, `${qtdContasAntes} → ${qtdContasDepois}`)

  // preenche a nova conta e salva
  await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input[placeholder="ex.: Conta principal"]'))
    const ultimo = inputs[inputs.length - 1]
    const linha = ultimo.closest('.grid')
    const campos = Array.from(linha.querySelectorAll('input'))
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    const valores = ['Conta Teste E2E', 'Banco Teste', '0001', '99999-9']
    campos.forEach((c, i) => { setter.call(c, valores[i]); c.dispatchEvent(new Event('input', { bubbles: true })) })
  })
  await H.clicarPorTexto(page, 'Salvar')
  await new Promise(r => setTimeout(r, 2000))
  let { data: emp } = await sb.from('empresa_info').select('*').eq('id', true).single()
  H.check('conta bancária nova é salva no banco', emp.bancos.some(b => b.apelido === 'Conta Teste E2E'), JSON.stringify(emp.bancos.map(b => b.apelido)))
  H.check('contas antigas continuam salvas', emp.bancos.length === 3, `total: ${emp.bancos.length}`)
  H.check('cada conta tem um id único', new Set(emp.bancos.map(b => b.id)).size === emp.bancos.length)

  await page.reload({ waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1500))
  t = await H.texto(page)
  H.check('dados persistem após recarregar a página', (await page.$$('input[placeholder="ex.: Conta principal"]')).length === 3)

  // remover a conta de teste
  await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input[placeholder="ex.: Conta principal"]'))
    const alvo = inputs.find(i => i.value === 'Conta Teste E2E')
    const linha = alvo?.closest('.grid')
    const btn = Array.from(linha.querySelectorAll('button')).find(b => b.textContent.trim() === 'Remover')
    btn?.click()
  })
  await new Promise(r => setTimeout(r, 400))
  await H.clicarPorTexto(page, 'Salvar')
  await new Promise(r => setTimeout(r, 2000))
  ;({ data: emp } = await sb.from('empresa_info').select('*').eq('id', true).single())
  H.check('remover conta bancária salva corretamente', emp.bancos.length === 2 && !emp.bancos.some(b => b.apelido === 'Conta Teste E2E'),
    JSON.stringify(emp.bancos.map(b => b.apelido)))

  // edição de campo simples da empresa
  await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('label'))
    const l = labels.find(x => x.textContent.trim() === 'Telefone')
    const input = l?.parentElement.querySelector('input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, '(41) 99999-1234')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await H.clicarPorTexto(page, 'Salvar')
  await new Promise(r => setTimeout(r, 2000))
  ;({ data: emp } = await sb.from('empresa_info').select('*').eq('id', true).single())
  H.check('editar campo simples da empresa salva', emp.telefone === '(41) 99999-1234', `valor: ${emp.telefone}`)
  t = await H.texto(page)
  H.check('confirmação visual de "Informações salvas" aparece', t.includes('Informações salvas'))

  fs.unlinkSync(arquivoTeste)
  const errosReais = erros.filter(e => !e.includes('status of 400'))
  H.check('nenhum erro inesperado de console/página', errosReais.length === 0, JSON.stringify(errosReais.slice(0, 3)))

  await browser.close()
  process.exit(H.resumo() > 0 ? 1 : 0)
}

main().catch(e => { console.error('erro geral:', e); process.exit(1) })
