import { describe, expect, it } from 'vitest'
import { portalDaDisputa } from './portal'

describe('portal da disputa', () => {
  it('reconhece o portal pelo link do sistema de origem', () => {
    expect(portalDaDisputa('https://bllcompras.com/Process/ProcessView?param1=abc', null)).toBe('BLL Compras')
    expect(portalDaDisputa('https://bnccompras.com/Process/ProcessView?param1=abc', null)).toBe('BNC')
    expect(portalDaDisputa('https://licitanet.com.br/processos/123', null)).toBe('Licitanet')
    expect(portalDaDisputa('https://www.portaldecompraspublicas.com.br/processos/pr/x', null)).toBe('Portal de Compras Públicas')
    expect(portalDaDisputa('https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras', null)).toBe('Compras.gov.br')
    expect(portalDaDisputa('https://www.licitacoes-e2.bb.com.br/aop-inter-estatico/', null)).toBe('Licitações-e (Banco do Brasil)')
  })

  it('sem link, usa quem publicou no PNCP quando é o próprio portal', () => {
    expect(portalDaDisputa(null, 'BLL Compras')).toBe('BLL Compras')
    expect(portalDaDisputa(null, 'Bolsa Nacional De Compras - BNC')).toBe('BNC')
    expect(portalDaDisputa(null, 'Licitações-E BB')).toBe('Licitações-e (Banco do Brasil)')
    expect(portalDaDisputa(null, 'Novo BBMNET Licitações')).toBe('BBMNET')
    expect(portalDaDisputa(null, 'Compras.gov.br')).toBe('Compras.gov.br')
  })

  it('sistema de gestão da prefeitura, link estranho ou nada: não sabe (null)', () => {
    expect(portalDaDisputa(null, 'Elotech Gestão Pública Ltda')).toBeNull()
    expect(portalDaDisputa(null, 'IPM Sistemas')).toBeNull()
    expect(portalDaDisputa('https://transparencia.exemplo.invalid/licitacao/1', 'Betha Sistemas')).toBeNull()
    expect(portalDaDisputa('não é endereço', null)).toBeNull()
    expect(portalDaDisputa(null, null)).toBeNull()
    // Endereço parecido não engana: só o domínio do portal vale.
    expect(portalDaDisputa('https://bllcompras.com.golpe.invalid/x', null)).toBeNull()
  })
})
