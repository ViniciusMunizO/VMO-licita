const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const H = require('./_harness')

// Conexão isolada, só pra conferir se o arquivo sumiu do bucket depois de
// remover. Reaproveitar o `sb` que já baixou esse mesmo caminho antes (pra
// checar o conteúdo) fazia a checagem de "sumiu" voltar um positivo antigo
// em cache, mesmo com o objeto já de fato apagado no servidor.
async function novoClienteStorage() {
  const sbNovo = createClient(H.env.VITE_SUPABASE_URL, H.env.VITE_SUPABASE_ANON_KEY)
  await sbNovo.auth.signInWithPassword({ email: H.LOGIN, password: H.SENHA })
  return sbNovo
}

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
  // remoção deixaria lixo pago e invisível lá dentro. Client novo (ver
  // `novoClienteStorage`) pra não repetir download no mesmo `caminho` do
  // client que já baixou esse arquivo pra conferir o conteúdo, acima.
  const sbVerifica = await novoClienteStorage()
  const apos = await sbVerifica.storage.from('anexos').download(caminho)
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
  const qtdContasAntes = (await page.$$('input[placeholder="ex.: Conta principal"]')).length
  H.check('contas já cadastradas aparecem', qtdContasAntes >= 1, `contas: ${qtdContasAntes}`)

  await H.clicarPorTexto(page, '+ Adicionar conta')
  await new Promise(r => setTimeout(r, 500))
  const qtdContasDepois = (await page.$$('input[placeholder="ex.: Conta principal"]')).length
  H.check('botão adicionar cria uma nova linha de conta', qtdContasDepois === qtdContasAntes + 1, `${qtdContasAntes} → ${qtdContasDepois}`)

  // Nome único por execução: um nome fixo ("Conta Teste E2E") corre o risco
  // de bater com uma conta fixture de outra suíte (foi exatamente isso que
  // aconteceu — rodar esta suíte várias vezes comeu a segunda conta que a
  // _t8-proposta-banco.js precisa pra testar a escolha entre contas).
  const NOME_CONTA_TESTE = `Conta Teste E2E ${Date.now()}`

  // preenche a nova conta e salva
  await page.evaluate((nome) => {
    const inputs = Array.from(document.querySelectorAll('input[placeholder="ex.: Conta principal"]'))
    const ultimo = inputs[inputs.length - 1]
    const linha = ultimo.closest('.grid')
    const campos = Array.from(linha.querySelectorAll('input'))
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    const valores = [nome, 'Banco Teste', '0001', '99999-9']
    campos.forEach((c, i) => { setter.call(c, valores[i]); c.dispatchEvent(new Event('input', { bubbles: true })) })
  }, NOME_CONTA_TESTE)
  await H.clicarPorTexto(page, 'Salvar')
  await new Promise(r => setTimeout(r, 2000))
  let { data: emp } = await sb.from('empresa_info').select('*').eq('id', true).single()
  H.check('conta bancária nova é salva no banco', emp.bancos.some(b => b.apelido === NOME_CONTA_TESTE), JSON.stringify(emp.bancos.map(b => b.apelido)))
  H.check('contas antigas continuam salvas', emp.bancos.length === qtdContasAntes + 1, `esperado: ${qtdContasAntes + 1}, total: ${emp.bancos.length}`)
  H.check('cada conta tem um id único', new Set(emp.bancos.map(b => b.id)).size === emp.bancos.length)

  await page.reload({ waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1500))
  t = await H.texto(page)
  H.check('dados persistem após recarregar a página', (await page.$$('input[placeholder="ex.: Conta principal"]')).length === qtdContasAntes + 1)

  // remover a conta de teste
  await page.evaluate((nome) => {
    const inputs = Array.from(document.querySelectorAll('input[placeholder="ex.: Conta principal"]'))
    const alvo = inputs.find(i => i.value === nome)
    const linha = alvo?.closest('.grid')
    const btn = Array.from(linha.querySelectorAll('button')).find(b => b.textContent.trim() === 'Remover')
    btn?.click()
  }, NOME_CONTA_TESTE)
  await new Promise(r => setTimeout(r, 400))
  await H.clicarPorTexto(page, 'Salvar')
  await new Promise(r => setTimeout(r, 2000))
  ;({ data: emp } = await sb.from('empresa_info').select('*').eq('id', true).single())
  H.check('remover conta bancária salva corretamente', emp.bancos.length === qtdContasAntes && !emp.bancos.some(b => b.apelido === NOME_CONTA_TESTE),
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

  H.secao('17b. Documentos da Empresa')
  const NOME_DOC_TESTE = `Documento Teste E2E ${Date.now()}`
  const arquivoDoc = path.join(__dirname, '_doc-empresa-teste.txt')
  fs.writeFileSync(arquivoDoc, 'conteudo do documento de teste')

  await page.evaluate((tipo) => {
    const labels = Array.from(document.querySelectorAll('label'))
    const lTipo = labels.find(l => l.textContent.trim() === 'Tipo')
    const inputTipo = lTipo?.parentElement.querySelector('input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inputTipo, tipo)
    inputTipo.dispatchEvent(new Event('input', { bubbles: true }))
  }, NOME_DOC_TESTE)
  const inputArqDoc = await page.$('input[type="file"]')
  await inputArqDoc.uploadFile(arquivoDoc)
  await new Promise(r => setTimeout(r, 400))
  await H.clicarPorTexto(page, 'Adicionar')
  await new Promise(r => setTimeout(r, 1500))

  let { data: docs } = await sb.from('documentos_empresa').select('*').eq('tipo', NOME_DOC_TESTE)
  H.check('documento da empresa é gravado no banco', docs.length === 1, JSON.stringify(docs.map(d => d.tipo)))
  const doc = docs[0]
  H.check('documento guarda o caminho no Storage', !!doc?.path)
  H.check('documento nasce reutilizável por padrão', doc?.reutilizavel === true)

  t = await H.texto(page)
  H.check('documento aparece na lista da tela', t.includes(NOME_DOC_TESTE))

  // alterna reutilizável (desmarca e marca de novo) — só a mudança precisa persistir
  const alternarReutilizavelNaTela = () => page.evaluate((tipo) => {
    const linhas = Array.from(document.querySelectorAll('div'))
    const linha = linhas.find(d => d.className.includes('justify-between') && d.textContent.includes(tipo) && d.querySelector('input[type="checkbox"]'))
    const checkbox = linha?.querySelector('input[type="checkbox"]')
    checkbox?.click()
  }, NOME_DOC_TESTE)

  await alternarReutilizavelNaTela()
  await new Promise(r => setTimeout(r, 1000))
  ;({ data: docs } = await sb.from('documentos_empresa').select('*').eq('tipo', NOME_DOC_TESTE))
  H.check('alternar reutilizável salva no banco', docs[0]?.reutilizavel === false, `reutilizavel: ${docs[0]?.reutilizavel}`)

  // religa reutilizável — precisa disso pra poder testar "Anexar da empresa"
  await alternarReutilizavelNaTela()
  await new Promise(r => setTimeout(r, 1000))

  // "Anexar da empresa" na licitação de teste
  await page.goto(`${H.BASE}/licitacoes/${CODIGO}`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1500))
  await H.clicarPorTexto(page, 'Gerenciar Anexos')
  await new Promise(r => setTimeout(r, 800))
  const opcoesAnexarEmpresa = await page.evaluate(() => {
    const sel = Array.from(document.querySelectorAll('.fixed.inset-0 select')).find(s => s.textContent.includes('Anexar da empresa'))
    return sel ? Array.from(sel.options).map(o => o.text) : []
  })
  H.check('documento reutilizável aparece no seletor "Anexar da empresa"', opcoesAnexarEmpresa.some(o => o.includes(NOME_DOC_TESTE)), JSON.stringify(opcoesAnexarEmpresa))

  await page.evaluate((tipo) => {
    const sel = Array.from(document.querySelectorAll('.fixed.inset-0 select')).find(s => s.textContent.includes('Anexar da empresa'))
    const opt = Array.from(sel.options).find(o => o.text.includes(tipo))
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    setter.call(sel, opt.value)
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  }, NOME_DOC_TESTE)
  await new Promise(r => setTimeout(r, 1500))

  const { data: anexosLicitacao } = await sb.from('attachments').select('*').eq('licitacaoCodigo', CODIGO)
  const anexoDaEmpresa = anexosLicitacao.find(a => a.name === NOME_DOC_TESTE)
  H.check('"Anexar da empresa" cria um anexo na licitação', !!anexoDaEmpresa, JSON.stringify(anexosLicitacao.map(a => a.name)))
  H.check('o anexo copiado tem caminho PRÓPRIO no Storage (não o mesmo do documento original)',
    !!anexoDaEmpresa?.path && anexoDaEmpresa.path !== doc.path, `original: ${doc.path} / cópia: ${anexoDaEmpresa?.path}`)

  // remove o documento da empresa e confirma que a cópia já anexada na
  // licitação sobrevive — é exatamente o que `copiarNoStorage` existe pra
  // garantir (ver src/utils/arquivo.ts).
  await page.goto(`${H.BASE}/empresa`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1500))
  await page.evaluate((tipo) => {
    const linhas = Array.from(document.querySelectorAll('div'))
    const linha = linhas.find(d => d.className.includes('justify-between') && d.textContent.includes(tipo) && d.querySelector('input[type="checkbox"]'))
    const btn = Array.from(linha.querySelectorAll('button')).find(b => b.textContent.trim() === 'Remover')
    btn?.click()
  }, NOME_DOC_TESTE)
  await new Promise(r => setTimeout(r, 1000))
  ;({ data: docs } = await sb.from('documentos_empresa').select('*').eq('tipo', NOME_DOC_TESTE))
  H.check('remover documento da empresa apaga do banco', docs.length === 0)

  const sbVerificaDoc = await novoClienteStorage()
  const baixouCopia = await sbVerificaDoc.storage.from('anexos').download(anexoDaEmpresa.path)
  H.check('cópia anexada na licitação continua intacta depois de remover o documento original', !!baixouCopia.data)

  // limpa a cópia — apagar a licitação de teste no fim da suíte (_limpar-teste.js)
  // cascade-deleta a linha de `attachments`, mas não o objeto no Storage.
  await sbVerificaDoc.storage.from('anexos').remove([anexoDaEmpresa.path]).catch(() => {})
  fs.unlinkSync(arquivoDoc)

  fs.unlinkSync(arquivoTeste)
  const errosReais = erros.filter(e => !e.includes('status of 400'))
  H.check('nenhum erro inesperado de console/página', errosReais.length === 0, JSON.stringify(errosReais.slice(0, 3)))

  await browser.close()
  process.exit(H.resumo() > 0 ? 1 : 0)
}

main().catch(e => { console.error('erro geral:', e); process.exit(1) })
