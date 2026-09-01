const H = require('./_harness')
async function main() {
  const sb = await H.supabaseLogado()
  const { data: lics } = await sb.from('licitacoes').select('codigo,numeroPregao,contratado')
  const alvos = lics.filter(l => String(l.numeroPregao || '').startsWith('TESTE-E2E') || String(l.contratado || '').includes('TESTE CASCADE'))
  for (const l of alvos) {
    await sb.from('licitacoes').delete().eq('codigo', l.codigo)
    console.log('removida licitação de teste', l.codigo)
  }
  const { data: restantes } = await sb.from('licitacoes').select('codigo,numeroPregao')
  console.log('licitações restantes:', JSON.stringify(restantes))
}
main().catch(e => { console.error(e); process.exit(1) })
