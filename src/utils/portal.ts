// Portal onde acontece a disputa (BLL, BNC, Compras.gov.br, Licitanet...).
// O PNCP não tem um campo 'portal'. Há duas pistas:
// 1) o link do sistema de origem (linkSistemaOrigem), quando o órgão informa: o endereço diz o portal
// 2) quem mandou a licitação ao PNCP (usuarioNome). Quando é o próprio portal ('BLL Compras'), vale.
//    Quando é o sistema de gestão da prefeitura (Elotech, IPM, Betha, Equiplano...), não diz onde
//    é a disputa: aí a resposta é null e o cartão manda olhar no edital.
// Medido no PR em nov/2026: cerca de 6 em cada 10 licitações abertas saem com o portal conhecido.
// Esta lista existe igual no bot (radar-licitacoes, src/bot/portal.ts): mudou aqui, mude lá.

const POR_ENDERECO: [RegExp, string][] = [
  [/(^|\.)bllcompras\.com$|(^|\.)bll\.org\.br$/, 'BLL Compras'],
  [/(^|\.)bnccompras\.com$|(^|\.)bnc\.org\.br$/, 'BNC'],
  [/(^|\.)licitanet\.com\.br$/, 'Licitanet'],
  [/(^|\.)portaldecompraspublicas\.com\.br$/, 'Portal de Compras Públicas'],
  [/(^|\.)estaleiro\.serpro\.gov\.br$|(^|\.)compras\.gov\.br$|(^|\.)comprasnet\.gov\.br$/, 'Compras.gov.br'],
  [/(^|\.)licitacoes-e2?\.bb\.com\.br$|(^|\.)licitacoes-e\.com\.br$/, 'Licitações-e (Banco do Brasil)'],
  [/(^|\.)comprasbr\.com\.br$/, 'ComprasBR'],
  [/(^|\.)bbmnet\.com\.br$/, 'BBMNET'],
  [/(^|\.)licitardigital\.com\.br$/, 'Licitar Digital'],
]

const POR_QUEM_PUBLICOU: [RegExp, string][] = [
  [/^bll\b/, 'BLL Compras'],
  [/bolsa nacional de compras|^bnc\b/, 'BNC'],
  [/^licitanet\b/, 'Licitanet'],
  [/^portal de compras publicas\b/, 'Portal de Compras Públicas'],
  [/^compras\.gov\.br$|^comprasnet\b/, 'Compras.gov.br'],
  [/^licitacoes-e\b/, 'Licitações-e (Banco do Brasil)'],
  [/bbmnet/, 'BBMNET'],
  [/^licitar digital\b/, 'Licitar Digital'],
]

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function endereco(link: string | null | undefined): string | null {
  if (!link) return null
  try {
    return new URL(link.trim()).hostname.toLowerCase()
  } catch {
    return null
  }
}

/** Nome do portal da disputa, ou null quando o PNCP não deixa saber. */
export function portalDaDisputa(link: string | null | undefined, publicadoPor: string | null | undefined): string | null {
  const host = endereco(link)
  if (host) {
    for (const [re, nome] of POR_ENDERECO) if (re.test(host)) return nome
  }
  const quem = semAcento(publicadoPor ?? '')
  if (quem) {
    for (const [re, nome] of POR_QUEM_PUBLICOU) if (re.test(quem)) return nome
  }
  return null
}
