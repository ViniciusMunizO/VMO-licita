const H = require('./_harness')
async function main() {
  const sb = await H.supabaseLogado()
  const { data: lics } = await sb.from('licitacoes').select('codigo,numeroPregao,contratado')
  const alvos = lics.filter(l => String(l.numeroPregao || '').startsWith('TESTE-E2E') || String(l.contratado || '').includes('TESTE CASCADE'))
  for (const l of alvos) {
    // O `on delete cascade` do banco não alcança o Storage: os arquivos das
    // pastas da licitação precisam ser apagados na mão, senão ficam lá pra
    // sempre sem nenhuma linha apontando pra eles.
    for (const pasta of [`licitacoes/${l.codigo}`, `atas/${l.codigo}`]) {
      const { data: objetos } = await sb.storage.from('anexos').list(pasta)
      const caminhos = (objetos || []).map(o => `${pasta}/${o.name}`)
      if (caminhos.length) {
        await sb.storage.from('anexos').remove(caminhos)
        console.log(`  removidos ${caminhos.length} arquivo(s) de ${pasta}`)
      }
    }
    await sb.from('licitacoes').delete().eq('codigo', l.codigo)
    console.log('removida licitação de teste', l.codigo)
  }
  const { data: restantes } = await sb.from('licitacoes').select('codigo,numeroPregao')
  console.log('licitações restantes:', JSON.stringify(restantes))
}
main().catch(e => { console.error(e); process.exit(1) })
