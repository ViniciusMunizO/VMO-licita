// Migra os anexos que estão em base64 dentro do banco para o bucket "anexos"
// do Supabase Storage.
//
// Antes: `attachments.data` (e `atas.anexo.data`) guardavam o arquivo inteiro
// como data URI na própria linha. Agora o arquivo vive no Storage e a linha
// guarda só o caminho (`attachments.path`, `atas.anexo.path`).
//
// O script é idempotente: processa apenas linha que ainda tem `data` e não tem
// `path`, então pode ser rodado de novo depois de uma interrupção. Por padrão
// ele só mostra o que faria — para gravar de verdade, passe `--aplicar`.
//
// Antes de rodar, aplique o schema atualizado (supabase/schema.sql) no projeto:
// é ele que cria o bucket, as políticas e as colunas path/mime/size.
//
// Uso (PowerShell):
//   $env:MIGRACAO_LOGIN="admin@empresa.com"
//   $env:MIGRACAO_SENHA="..."
//   node scripts/migrar-anexos-storage.js            # simulação (não grava)
//   node scripts/migrar-anexos-storage.js --aplicar  # migra de verdade
//
// A conta usada precisa ser um membro ativo (profiles.ativo = true) — é o que
// as políticas de RLS e do bucket exigem. Não é preciso service role.

const fs = require('fs')
const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')

const envRaw = fs.readFileSync(__dirname + '/../.env', 'utf8')
const env = Object.fromEntries(envRaw.split('\n').filter(Boolean).map(l => {
  const i = l.indexOf('=')
  return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
}))

const APLICAR = process.argv.includes('--aplicar')
const LOGIN = process.env.MIGRACAO_LOGIN
const SENHA = process.env.MIGRACAO_SENHA
const BUCKET = 'anexos'

if (!LOGIN || !SENHA) {
  console.error(`
Faltam as credenciais. Rode assim (PowerShell):

  $env:MIGRACAO_LOGIN="admin@empresa.com"; $env:MIGRACAO_SENHA="..."; node scripts/migrar-anexos-storage.js

Sem --aplicar o script só simula. A conta precisa ser um membro ativo.
`)
  process.exit(1)
}

// Mesma regra de nome usada pelo app (src/utils/arquivo.ts): a chave do objeto
// não leva acento nem espaço; o nome original continua na coluna `filename`.
function sanitizarNome(nome) {
  return nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-80) || 'arquivo'
}

function decodificarDataURI(data) {
  if (typeof data !== 'string' || !data.startsWith('data:')) return null
  const virgula = data.indexOf(',')
  if (virgula < 0) return null
  const cabecalho = data.slice(5, virgula)
  const base64 = data.slice(virgula + 1)
  if (!base64) return null
  const buffer = Buffer.from(base64, 'base64')
  if (buffer.length === 0) return null
  return { mime: cabecalho.split(';')[0] || 'application/octet-stream', buffer }
}

async function enviar(sb, path, mime, buffer) {
  const { error } = await sb.storage.from(BUCKET).upload(path, buffer, { contentType: mime, upsert: false })
  if (error) throw new Error(`upload falhou: ${error.message}`)
}

async function migrarAttachments(sb) {
  // Busca só os identificadores primeiro: `data` pode ter dezenas de MB e não
  // faz sentido trazer a tabela inteira pra memória de uma vez.
  const { data: pendentes, error } = await sb
    .from('attachments')
    .select('id,licitacaoCodigo,filename,name')
    .is('path', null)
    .not('data', 'is', null)
    .order('date', { ascending: true })
  if (error) throw error

  console.log(`\nattachments: ${pendentes.length} anexo(s) para migrar`)
  let ok = 0
  const falhas = []

  for (const row of pendentes) {
    const rotulo = `attachments/${row.id} (${row.filename || row.name || 'sem nome'})`
    try {
      const { data: completo, error: e1 } = await sb.from('attachments').select('data').eq('id', row.id).single()
      if (e1) throw e1
      const arquivo = decodificarDataURI(completo.data)
      if (!arquivo) throw new Error('conteúdo não é um data URI válido')

      const path = `licitacoes/${row.licitacaoCodigo}/${crypto.randomUUID()}-${sanitizarNome(row.filename || row.name || 'arquivo')}`
      const tamanho = (arquivo.buffer.length / 1024).toFixed(0)
      if (!APLICAR) {
        console.log(`  [simulação] ${rotulo} -> ${path} (${tamanho} KB, ${arquivo.mime})`)
        ok++
        continue
      }

      await enviar(sb, path, arquivo.mime, arquivo.buffer)
      // `data: null` na mesma atualização: é o que faz a linha parar de contar
      // como pendente numa próxima execução.
      const { error: e2 } = await sb.from('attachments')
        .update({ path, mime: arquivo.mime, size: arquivo.buffer.length, data: null })
        .eq('id', row.id)
      if (e2) {
        await sb.storage.from(BUCKET).remove([path]) // não deixa objeto órfão
        throw e2
      }
      console.log(`  migrado ${rotulo} -> ${path} (${tamanho} KB)`)
      ok++
    } catch (err) {
      console.log(`  FALHA  ${rotulo}: ${err.message}`)
      falhas.push(rotulo)
    }
  }
  return { total: pendentes.length, ok, falhas }
}

async function migrarAtas(sb) {
  const { data: todas, error } = await sb.from('atas').select('id,licitacaoCodigo,numero,anexo')
  if (error) throw error
  const pendentes = (todas || []).filter(a => a.anexo && a.anexo.data && !a.anexo.path)

  console.log(`\natas: ${pendentes.length} anexo(s) para migrar`)
  let ok = 0
  const falhas = []

  for (const row of pendentes) {
    const rotulo = `atas/${row.id} (${row.anexo.name || row.numero || 'sem nome'})`
    try {
      const arquivo = decodificarDataURI(row.anexo.data)
      if (!arquivo) throw new Error('conteúdo não é um data URI válido')

      const path = `atas/${row.licitacaoCodigo}/${crypto.randomUUID()}-${sanitizarNome(row.anexo.name || 'arquivo')}`
      const tamanho = (arquivo.buffer.length / 1024).toFixed(0)
      if (!APLICAR) {
        console.log(`  [simulação] ${rotulo} -> ${path} (${tamanho} KB, ${arquivo.mime})`)
        ok++
        continue
      }

      await enviar(sb, path, arquivo.mime, arquivo.buffer)
      const anexo = { name: row.anexo.name, path, mime: arquivo.mime, size: arquivo.buffer.length }
      const { error: e2 } = await sb.from('atas').update({ anexo }).eq('id', row.id)
      if (e2) {
        await sb.storage.from(BUCKET).remove([path])
        throw e2
      }
      console.log(`  migrado ${rotulo} -> ${path} (${tamanho} KB)`)
      ok++
    } catch (err) {
      console.log(`  FALHA  ${rotulo}: ${err.message}`)
      falhas.push(rotulo)
    }
  }
  return { total: pendentes.length, ok, falhas }
}

async function main() {
  const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  const { error: erroLogin } = await sb.auth.signInWithPassword({ email: LOGIN, password: SENHA })
  if (erroLogin) {
    console.error(`Não consegui entrar com ${LOGIN}: ${erroLogin.message}`)
    process.exit(1)
  }

  // Sem o bucket, todo upload falharia um por um — melhor parar aqui com a
  // instrução certa.
  const { error: erroBucket } = await sb.storage.getBucket(BUCKET)
  if (erroBucket) {
    console.error(`
O bucket "${BUCKET}" não existe (ou esta conta não enxerga ele): ${erroBucket.message}

Aplique o supabase/schema.sql atualizado no projeto (Dashboard -> SQL Editor)
antes de rodar a migração — é ele que cria o bucket e as políticas.
`)
    process.exit(1)
  }

  console.log(APLICAR
    ? `Migrando anexos para o bucket "${BUCKET}" em ${env.VITE_SUPABASE_URL}`
    : `SIMULAÇÃO — nada será gravado. Repita com --aplicar para migrar de verdade.`)

  const att = await migrarAttachments(sb)
  const atas = await migrarAtas(sb)

  const falhas = [...att.falhas, ...atas.falhas]
  console.log(`\n${'='.repeat(60)}`)
  console.log(`attachments: ${att.ok}/${att.total} — atas: ${atas.ok}/${atas.total}`)
  if (falhas.length) {
    console.log(`\n${falhas.length} falha(s) — nada foi perdido, o base64 continua no banco nessas linhas:`)
    for (const f of falhas) console.log(`  ${f}`)
    console.log('\nCorrija e rode de novo: as linhas já migradas são puladas.')
  } else if (APLICAR) {
    console.log('Tudo migrado. As linhas migradas ficaram com `data` nulo e `path` preenchido.')
  }
  console.log('='.repeat(60))
  process.exit(falhas.length ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
