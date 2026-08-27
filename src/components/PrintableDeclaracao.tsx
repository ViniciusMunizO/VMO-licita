import React from 'react'
import { DeclaracaoContext } from '../utils/declaracoes'
import { nowDateExtensoBR } from '../utils/date'

type Props = {
  titulo: string
  corpo: string
  ctx: DeclaracaoContext
  pageRef?: React.RefObject<HTMLDivElement>
}

const row: React.CSSProperties = { marginTop: 4 }

export default function PrintableDeclaracao({ titulo, corpo, ctx, pageRef }: Props) {
  const cidadeUf = [ctx.cidade, ctx.uf].filter(Boolean).join('/')

  return (
    <div ref={pageRef} style={{ width: '794px', padding: 32, background: '#fff', color: '#000', boxSizing: 'border-box', fontFamily: 'Arial, sans-serif', fontSize: 12, lineHeight: 1.5 }}>
      <header style={{ marginBottom: 12, borderBottom: '2px solid #2C2D7D', paddingBottom: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#2C2D7D' }}>{ctx.razaoSocial || 'Empresa'}</div>
        <div style={{ fontSize: 11, color: '#444' }}>CNPJ: {ctx.cnpj || '-'}{ctx.inscricaoEstadual ? ` — I.E.: ${ctx.inscricaoEstadual}` : ''}</div>
        <div style={{ fontSize: 11, color: '#444' }}>{ctx.endereco || '-'}{ctx.cidade ? ` — ${ctx.cidade}` : ''}{ctx.uf ? `/${ctx.uf}` : ''}{ctx.cep ? ` — CEP ${ctx.cep}` : ''}</div>
        {ctx.telefone && <div style={{ fontSize: 11, color: '#444' }}>Tel: {ctx.telefone}</div>}
      </header>

      <div style={row}>À {ctx.contratanteCompleto || '-'}</div>
      <div style={{ ...row, display: 'flex', justifyContent: 'space-between' }}>
        <span>PREGÃO ELETRÔNICO Nº {ctx.numeroPregao || '-'}</span>
        <span>Processo nº: {ctx.numeroProcesso || '-'}</span>
      </div>
      <div style={row}>JULGAMENTO: {ctx.tipoDisputa || '-'}</div>
      <div style={row}>Objeto: {ctx.objetoLicitacao || '-'}</div>

      <div style={{ marginTop: 14 }}>
        <strong>DADOS DA PROPONENTE:</strong>
        <div style={row}>Nome: {ctx.razaoSocial || '-'}</div>
        <div style={row}>CNPJ nº: {ctx.cnpj || '-'}    Insc. Estadual: {ctx.inscricaoEstadual || '-'}    Insc. Municipal: {ctx.inscricaoMunicipal || '-'}</div>
        <div style={row}>Endereço: {ctx.endereco || '-'}</div>
        <div style={row}>CEP: {ctx.cep || '-'}    Cidade: {ctx.cidade || '-'}    UF: {ctx.uf || '-'}</div>
        <div style={row}>Fone: {ctx.telefone || '-'}    E-mail: {ctx.email || '-'}</div>
      </div>

      <div style={{ marginTop: 10 }}>
        <strong>DADOS BANCÁRIOS:</strong>
        <div style={row}>{[ctx.banco, ctx.agencia, ctx.conta].filter(Boolean).join(' / ') || '-'}</div>
      </div>

      <div style={{ marginTop: 10 }}>
        <strong>DADOS PARA ASSINATURA DO CONTRATO:</strong>
        <div style={row}>{ctx.representanteNome || '-'} - {ctx.representanteCargo || '-'} - CPF: {ctx.representanteCpf || '-'} / RG: {ctx.representanteRg || '-'}.</div>
      </div>

      <h2 style={{ fontSize: 13, textAlign: 'center', background: '#eef0fa', padding: '8px 6px', marginTop: 18, marginBottom: 14, textTransform: 'uppercase' }}>{titulo}</h2>

      <div style={{ whiteSpace: 'pre-wrap', textAlign: 'justify' }}>{corpo}</div>

      <div style={{ marginTop: 24 }}>{cidadeUf || '-'}, {nowDateExtensoBR()}</div>

      <div style={{ marginTop: 56 }}>
        <div style={{ borderTop: '1px solid #000', width: 300, marginBottom: 6 }} />
        <div><strong>{ctx.razaoSocial || '-'}</strong></div>
        <div>CNPJ: {ctx.cnpj || '-'}</div>
        <div>{ctx.representanteNome || '-'}</div>
        <div>{ctx.representanteCargo || '-'}</div>
        <div>RG Nº {ctx.representanteRg || '-'}</div>
        <div>CPF Nº {ctx.representanteCpf || '-'}</div>
      </div>
    </div>
  )
}
