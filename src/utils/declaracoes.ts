// Templates das declarações emitidas pelo sistema. O texto de cada uma é fixo
// (extraído dos modelos usados pela empresa); apenas os trechos entre {{ }}
// são substituídos pelos dados da empresa (cadastro "Informações da Empresa")
// e pelos dados da licitação em questão.

export type DeclaracaoTemplate = {
  id: string
  titulo: string
  corpo: string
}

export const DECLARACOES: DeclaracaoTemplate[] = [
  {
    id: 'fato-superveniente',
    titulo: 'Declaração de Inexistência de Fato Superveniente Impeditivo à Habilitação',
    corpo: `{{razaoSocial}}, inscrita no CNPJ nº {{cnpj}}, sediada na {{endereco}}, CEP {{cep}}, {{cidade}}/{{uf}}, por intermédio de seu Representante Legal abaixo assinado, DECLARA, sob as penas da lei nº 14.133/2021, que até a presente data inexistem fatos impeditivos para sua habilitação no presente processo licitatório, estando ciente da obrigatoriedade de declarar ocorrências posteriores.`,
  },
  {
    id: 'empregador-pj',
    titulo: 'Declaração do Art. 7º Inciso XXXIII da Constituição Federal',
    corpo: `{{razaoSocial}}, inscrita no CNPJ nº {{cnpj}}, sediada na {{endereco}}, CEP {{cep}}, {{cidade}}/{{uf}}, por intermédio de seu Representante Legal abaixo assinado, DECLARA, sob as penas da Lei nº 14.133/2021, para fins do(a) PREGÃO ELETRÔNICO, que a empresa {{razaoSocial}}, cumpre com o disposto no inciso XXXIII, do artigo sétimo da Constituição Federal: "...proibição de trabalho noturno perigoso ou insalubre, aos menores de dezoito anos e de qualquer trabalho a menores de dezesseis anos, exceto na condição de aprendiz, a partir de quatorze anos".

Ressalva: ( ) emprega menor, a partir de quatorze anos, na condição de aprendiz.`,
  },
  {
    id: 'reserva-cargos',
    titulo: 'Declaração Reserva de Cargos',
    corpo: `A Empresa {{razaoSocial}}, inscrita no CNPJ nº {{cnpj}}, sediada na {{endereco}}, CEP {{cep}}, {{cidade}}/{{uf}}, DECLARA, sob as penas da Lei nº 14.133/2021, que: cumpre as exigências de reserva de cargos para pessoa com deficiência e para reabilitado da Previdência Social, previstas em lei e em outras normas específicas.`,
  },
  {
    id: 'elaboracao-independente',
    titulo: 'Declaração de Elaboração Independente de Proposta',
    corpo: `A empresa {{razaoSocial}}, inscrita no CNPJ nº {{cnpj}}, sediada na {{endereco}}, CEP {{cep}}, {{cidade}}/{{uf}}, por intermédio de seu(ua) {{representanteCargo}} o(a) Sr(a). {{representanteNome}} portador(a) da Carteira de Identidade nº {{representanteRg}} e do CPF nº {{representanteCpf}}. DECLARA, sob as penas da lei nº 14.133/2021, que:

a) a proposta apresentada foi elaborada de maneira independente e o seu conteúdo não foi, no todo ou em parte, direta ou indiretamente, informado ou discutido com qualquer outro licitante ou interessado, em potencial ou de fato, no presente procedimento licitatório;

b) a intenção de apresentar a proposta não foi informada ou discutida com qualquer outro licitante ou interessado, em potencial ou de fato, no presente procedimento licitatório;

c) o licitante não tentou, por qualquer meio ou por qualquer pessoa, influir na decisão de qualquer outro licitante ou interessado, em potencial ou de fato, no presente procedimento licitatório;

d) o conteúdo da proposta apresentada não será, no todo ou em parte, direta ou indiretamente, comunicado ou discutido com qualquer outro licitante ou interessado, em potencial ou de fato, no presente procedimento licitatório antes da adjudicação do objeto;

e) o conteúdo da proposta apresentada não foi, no todo ou em parte, informado, discutido ou recebido de qualquer integrante relacionado, direta ou indiretamente, ao órgão licitante antes da abertura oficial das propostas; e

f) o representante legal do licitante está plenamente ciente do teor e da extensão desta declaração e que detém plenos poderes e informações para firmá-la.

DECLARO, ainda, que a pessoa jurídica que represento conduz seus negócios de forma a coibir fraudes, corrupção e a prática de quaisquer outros atos lesivos à Administração Pública, nacional ou estrangeira, em atendimento à Lei Federal nº 12.846/2013, tais como:

I – prometer, oferecer ou dar, direta ou indiretamente, vantagem indevida a agente público, ou a terceira pessoa a ele relacionada;

II – comprovadamente, financiar, custear, patrocinar ou de qualquer modo subvencionar a prática dos atos ilícitos previstos em Lei;

III – comprovadamente, utilizar-se de interposta pessoa física ou jurídica para ocultar ou dissimular seus reais interesses ou a identidade dos beneficiários dos atos praticados;

IV – no tocante a licitações e contratos:

a) frustrar ou fraudar, mediante ajuste, combinação ou qualquer outro expediente, o caráter competitivo de procedimento licitatório público;

b) impedir, perturbar ou fraudar a realização de qualquer ato de procedimento licitatório público;

c) afastar ou procurar afastar licitante, por meio de fraude ou oferecimento de vantagem de qualquer tipo;

d) fraudar licitação pública ou contrato dela decorrente;

e) criar, de modo fraudulento ou irregular, pessoa jurídica para participar de licitação pública ou celebrar contrato administrativo;

f) obter vantagem ou benefício indevido, de modo fraudulento, de modificações ou prorrogações de contratos celebrados com a administração pública, sem autorização em lei, no ato convocatório da licitação pública ou nos respectivos instrumentos contratuais; ou

g) manipular ou fraudar o equilíbrio econômico-financeiro dos contratos celebrados com a administração pública;

V – dificultar atividade de investigação ou fiscalização de órgãos, entidades ou agentes públicos, ou intervir em sua atuação, inclusive no âmbito das agências reguladoras e dos órgãos de fiscalização do sistema financeiro nacional.

Por ser expressão de verdade, firmamos o presente.`,
  },
  {
    id: 'carta-credenciamento',
    titulo: 'Carta de Credenciamento',
    corpo: `Pelo presente a empresa {{razaoSocial}}, inscrita no CNPJ nº {{cnpj}}, sediada na {{endereco}}, CEP {{cep}}, {{cidade}}/{{uf}}, através de seu(sua) REPRESENTANTE LEGAL o(a) Sr(a). {{representanteNome}} - {{representanteCargo}} - CPF: {{representanteCpf}} / RG: {{representanteRg}}, outorga poderes para o(a) Sr(a). {{representanteNome}}, portador da cédula de identidade sob nº {{representanteRg}} e inscrito no CPF nº {{representanteCpf}}, BRASILEIRO(A), residente e domiciliado(a) na {{endereco}}, {{cidade}}/{{uf}}, Representar a OUTORGANTE perante o(a) {{contratanteCompleto}}, nos atos relativos no(a) PREGÃO ELETRÔNICO nº {{numeroPregao}}, podendo, para tanto, protocolar documento e envelopes, apresentar proposta de preços e lances verbais, assinar a proposta apregoada, bem como qualquer documento inerente ao processo, assinar atas e declarações, impugnar licitantes e propostas, recorrer de qualquer instância administrativa, denegar do direito de recurso, rubricar páginas de documentos, concordar, discordar, transigir, desistir, firmar compromissos, requerer, alegar e assinar o que convier, pedir informações, requerer vistas e cópias aos documentos pertinentes ao processo licitatório, enfim, praticar todos os atos pertinentes ao certame, em nome da proponente.`,
  },
  {
    id: 'procuracao',
    titulo: 'Procuração',
    corpo: `OUTORGANTE: {{razaoSocial}}, inscrita no CNPJ nº {{cnpj}}, sediada na {{endereco}}, CEP {{cep}}, {{cidade}}/{{uf}}, neste ato representada por {{representanteNome}} - {{representanteCargo}} - CPF: {{representanteCpf}} / RG: {{representanteRg}}.

OUTORGADO: {{representanteNome}}, portador da cédula de identidade sob nº {{representanteRg}} e inscrito no CPF nº {{representanteCpf}}, BRASILEIRO(A), residente e domiciliado(a) na {{endereco}}, {{cidade}}/{{uf}}.

PODERES: Representar a OUTORGANTE perante o(a) {{contratanteCompleto}}, nos atos relativos no(a) PREGÃO ELETRÔNICO nº {{numeroPregao}}, podendo, para tanto, protocolar documento e envelopes, apresentar proposta de preços e lances verbais, assinar a proposta apregoada, bem como qualquer documento inerente ao processo, assinar atas e declarações, impugnar licitantes e propostas, recorrer de qualquer instância administrativa, denegar do direito de recurso, rubricar páginas de documentos, concordar, discordar, transigir, desistir, firmar compromissos, requerer, alegar e assinar o que convier, pedir informações, requerer vistas e cópias aos documentos pertinentes ao processo licitatório, enfim, praticar todos os atos necessários e implícitos ao fiel, perfeito e cabal desempenho da presente procuração.`,
  },
  {
    id: 'req-hab',
    titulo: 'Declaração de Que Cumpre os Requisitos de Habilitação',
    corpo: `{{razaoSocial}}, inscrita no CNPJ nº {{cnpj}}, sediada na {{endereco}}, CEP {{cep}}, {{cidade}}/{{uf}}, por intermédio de seu Representante Legal abaixo assinado, DECLARA, sob as penas da Lei nº 14.133/2021, que está ciente e cumpre plenamente os requisitos da habilitação e entrega os envelopes contendo a indicação do objeto e do preço oferecidos, ciente da obrigatoriedade de declarar ocorrências posteriores e que inexistem fatos impeditivos para sua habilitação.`,
  },
  {
    id: 'enquadramento-me',
    titulo: 'Declaração de Enquadramento como ME/EPP',
    corpo: `Eu {{representanteNome}}, portador da cédula de identidade sob nº {{representanteRg}} e inscrito no CPF nº {{representanteCpf}}, DECLARO, sob as penas da Lei, para fins do disposto no Inciso III do Artigo 1º da Lei Complementar n.º 123, de 14 de dezembro de 2006, que a empresa {{razaoSocial}} cumpre os requisitos estabelecidos em seu Artigo 3º e está apta a usufruir o tratamento favorecido estabelecido no Capítulo V – Seção Única daquela Lei Complementar. Declaro ainda, que não existe qualquer impedimento entre os previstos nos Incisos do §4º do Artigo 3º da Lei Complementar n.º 123/2006.`,
  },
  {
    id: 'ficha-dados',
    titulo: 'Planilha de Dados para Preenchimento do Contrato',
    corpo: `DADOS DA EMPRESA:
Razão Social: {{razaoSocial}}
CNPJ: {{cnpj}}
Insc. Estadual: {{inscricaoEstadual}}
Insc. Municipal: {{inscricaoMunicipal}}
Endereço: {{endereco}}
CEP: {{cep}}
Cidade: {{cidade}}
Estado: {{uf}}
Fone: {{telefone}}
E-mail: {{email}}

DADOS DO REPRESENTANTE DA EMPRESA:
Nome: {{representanteNome}}
Cargo: {{representanteCargo}}
CPF: {{representanteCpf}}
RG: {{representanteRg}}

DADOS BANCÁRIOS:
{{banco}} / {{agencia}} / {{conta}}`,
  },
  {
    id: 'lgpd',
    titulo: 'Declaração LGPD',
    corpo: `{{razaoSocial}}, inscrita no CNPJ nº {{cnpj}}, sediada na {{endereco}}, CEP {{cep}}, {{cidade}}/{{uf}}, DECLARA, sob as penas da lei, que:

1. Como condição para participar desta contratação e ser contratado(a), o(a) interessado(a) deve fornecer para a Administração Pública diversos dados pessoais, entre eles:
1.1. aqueles inerentes a documentos de identificação;
1.2. referentes a participações societárias;
1.3. informações inseridas em contratos sociais;
1.4. endereços físicos e eletrônicos;
1.5. estado civil;
1.6. eventuais informações sobre cônjuges;
1.7. relações de parentesco;
1.8. número de telefone;
1.9. sanções administrativas que esteja cumprindo perante a Administração Pública;
1.10. informações sobre eventuais condenações no plano criminal ou por improbidade administrativa; dentre outros necessários à contratação.

2. Essas informações constarão do processo administrativo e serão objeto de tratamento por parte da Administração Pública.

3. O tratamento dos dados pessoais relacionados aos processos de contratação se presume válido, legítimo e, portanto, juridicamente adequado.`,
  },
  {
    id: 'responsabilidade',
    titulo: 'Declaração de Responsabilidade',
    corpo: `{{razaoSocial}}, inscrita no CNPJ nº {{cnpj}}, sediada na {{endereco}}, CEP {{cep}}, {{cidade}}/{{uf}}, por intermédio de seu Representante Legal abaixo assinado, DECLARA, sob as penas da lei nº 14.133/2021, que até a presente data inexistem fatos impeditivos para sua habilitação no presente processo licitatório, estando ciente da obrigatoriedade de declarar ocorrências posteriores.

- Assumimos inteira responsabilidade pela autenticidade de todos os documentos apresentados, sujeitando-nos a eventuais averiguações que se façam necessários;

- Comprometemo-nos a manter, durante todo o período de vigência do presente contrato, em compatibilidade com as obrigações assumidas, todas as condições de habilitação e qualificação exigidas na licitação;

- Comprometemo-nos a repassar na proporção correspondente, eventuais reduções de preços decorrentes de mudanças de alíquotas de impostos incidentes sobre o fornecimento do objeto, em função de alterações de legislação pertinente, publicadas durante a vigência do contrato;

- Temos conhecimento e submetemo-nos ao disposto na Lei nº 8.078 – Código de Defesa do Consumidor, bem como, ao Edital e Anexos do PREGÃO ELETRÔNICO nº {{numeroPregao}}, realizado pelo(a) {{contratanteCompleto}}.

Por ser expressão de verdade, firmamos o presente.`,
  },
  {
    id: 'unificada',
    titulo: 'Declaração Unificada',
    corpo: `{{razaoSocial}}, inscrita no CNPJ nº {{cnpj}}, sediada na {{endereco}}, CEP {{cep}}, {{cidade}}/{{uf}}, DECLARA, sob as penas da lei, que:

1) Declaramos, para os fins do disposto no inciso XXXIII do art. 7º da Constituição Federal, não empregamos menores de dezoito anos em trabalho noturno, perigoso ou insalubre e nem menores de dezesseis anos, em qualquer trabalho, salvo na condição de aprendiz, a partir dos quatorze anos de idade, em cumprimento ao que determina o inciso V do art. 27 da Lei nº 8.666/93, acrescida pela Lei nº 9.854/99.

2) Declaramos, para os fins que até a presente data inexistem fatos supervenientes impeditivos para habilitação no presente processo licitatório, estando ciente da obrigatoriedade de declarar ocorrências posteriores.

3) Declaramos, para os fins que a empresa não foi declarada inidônea por nenhum órgão público de qualquer esfera de governo, estando apta a contratar com o poder público.

4) Declaramos, para os devidos fins que não possuímos em nosso quadro societário e de empregados, servidor ou dirigente de órgão ou entidade contratante ou responsável pela licitação, nos termos do inciso III, do artigo 9° da Lei n° 8.666, de 21 de junho de 1993.

5) Comprometo-me a manter durante a execução do contrato, em compatibilidade com as obrigações assumidas, todas as condições de habilitação e qualificação exigidas na licitação.

6) Declaramos, para os devidos fins de direito, na qualidade de Proponente dos procedimentos licitatórios, instaurados por este Município, que o(a) responsável legal da empresa é o(a) Sr.(a) {{representanteNome}}, Portador(a) do RG sob nº {{representanteRg}} e CPF nº {{representanteCpf}}, cuja função/cargo é {{representanteCargo}}, responsável pela assinatura da Ata de Registro de Preços/Contrato.
E-mail: {{email}}
Telefone: {{telefone}}

7) Declaramos, para os devidos fins que em caso de qualquer comunicação futura referente a este processo licitatório, bem como em caso de eventual contratação, concordo que a Ata de Registro de Preços/Contrato seja encaminhado para o seguinte endereço:
E-mail: {{email}}
Telefone: {{telefone}}

8) Caso altere o citado e-mail ou telefone comprometo-me em protocolizar pedido de alteração junto ao Sistema de Protocolo deste Município, sob pena de ser considerado como intimado nos dados anteriormente fornecidos.

9) Nomeamos e constituímos o senhor(a) {{representanteNome}}, portador(a) do CPF/MF sob n.º {{representanteCpf}}, para ser o(a) responsável para acompanhar a execução da Ata de Registro de Preços/Contrato, referente a(ao) PREGÃO ELETRÔNICO n.º {{numeroPregao}} e todos os atos necessários ao cumprimento das obrigações contidas no instrumento convocatório, seus Anexos e na Ata de Registro de Preços/Contrato.

Por ser expressão de verdade, firmamos o presente.`,
  },
  {
    id: 'representante-legal',
    titulo: 'Declaração de Qualificação do Representante Legal',
    corpo: `{{razaoSocial}}, inscrita no CNPJ nº {{cnpj}}, sediada na {{endereco}}, CEP {{cep}}, {{cidade}}/{{uf}}, por intermédio de seu Representante Legal abaixo assinado, DECLARA, sob as penas da Lei nº 14.133/2021, que o(a) Representante Legal da Empresa com poderes para assinar o instrumento contratual é o(a) Sr(a). {{representanteNome}} - {{representanteCargo}} - CPF: {{representanteCpf}} / RG: {{representanteRg}}. - Dados Bancários: {{banco}} / {{agencia}} / {{conta}}.`,
  },
  {
    id: 'ciencia-concordancia',
    titulo: 'Declaração de Ciência e Concordância com o Edital',
    corpo: `{{razaoSocial}}, inscrita no CNPJ nº {{cnpj}}, sediada na {{endereco}}, CEP {{cep}}, {{cidade}}/{{uf}}, em atendimento a(ao) PREGÃO ELETRÔNICO nº {{numeroPregao}}, por intermédio de seu Representante Legal abaixo assinado, DECLARA, sob as penas da lei nº 14.133/2021, que tem pleno, total, amplo e irrestrito conhecimento da natureza, escopo e objeto da LICITAÇÃO. DECLARA, ainda, conhecer toda a legislação relativa à presente LICITAÇÃO, bem como os termos e condições estabelecidos no EDITAL e seus ANEXOS, com os quais CONCORDA.`,
  },
  {
    id: 'aceite-edital',
    titulo: 'Declaração de Aceite do Teor do Edital',
    corpo: `{{razaoSocial}}, inscrita no CNPJ nº {{cnpj}}, sediada na {{endereco}}, CEP {{cep}}, {{cidade}}/{{uf}}, por intermédio de seu Representante Legal abaixo assinado, DECLARA, sob as penas da Lei nº 14.133/2021, de que conhece e aceita o teor completo do Edital de PREGÃO ELETRÔNICO nº {{numeroPregao}}, ressalvando-se o direito recursal, bem como de que recebeu todos os documentos e informações necessárias para o cumprimento integral das obrigações objeto da licitação.`,
  },
  {
    id: 'nao-parentesco',
    titulo: 'Declaração de Não Parentesco',
    corpo: `{{razaoSocial}}, inscrita no CNPJ nº {{cnpj}}, sediada na {{endereco}}, CEP {{cep}}, {{cidade}}/{{uf}}, por intermédio de seu Representante Legal abaixo assinado, DECLARA, sob as penas da Lei nº 14.133/2021, que:

1) Não possui proprietário, sócios ou funcionários que sejam servidores ou agentes políticos do órgão ou entidade contratante ou responsável pela licitação;

2) Não possui proprietário ou sócio que seja cônjuge, companheiro ou parente em linha reta, colateral ou por afinidade, até o terceiro grau, e por afinidade, até o segundo grau, de agente político do órgão ou entidade contratante ou responsável pela licitação.`,
  },
  {
    id: 'idoneidade',
    titulo: 'Declaração de Idoneidade',
    corpo: `{{razaoSocial}}, inscrita no CNPJ nº {{cnpj}}, sediada na {{endereco}}, CEP {{cep}}, {{cidade}}/{{uf}}, por intermédio de seu Representante Legal abaixo assinado, DECLARA, sob as penas da lei nº 14.133/2021, que está apta a tomar parte do processo licitatório, tendo em vista inexistir contra a mesma Declaração de Inidoneidade emitida por órgão de Administração Pública Federal, Estadual, Municipal ou do Distrito Federal.`,
  },
]

export type DeclaracaoContext = Record<string, string>

export function buildDeclaracaoContext(empresa: any, licitacao: any): DeclaracaoContext {
  empresa = empresa || {}
  licitacao = licitacao || {}
  const contratanteNome = licitacao.contratante?.nome || licitacao.contratado || ''
  const contratanteUf = licitacao.contratante?.uf || ''
  const contratanteCompleto = contratanteNome
    ? `PREFEITURA MUNICIPAL DE ${String(contratanteNome).toUpperCase()}${contratanteUf ? '/' + String(contratanteUf).toUpperCase() : ''}`
    : ''
  return {
    razaoSocial: empresa.razaoSocial || '',
    cnpj: empresa.cnpj || '',
    inscricaoEstadual: empresa.inscricaoEstadual || '',
    inscricaoMunicipal: empresa.inscricaoMunicipal || '',
    endereco: empresa.endereco || '',
    cep: empresa.cep || '',
    cidade: empresa.cidade || '',
    uf: empresa.uf || '',
    telefone: empresa.telefone || '',
    email: empresa.email || '',
    banco: empresa.banco || '',
    agencia: empresa.agencia || '',
    conta: empresa.conta || '',
    representanteNome: empresa.representanteNome || '',
    representanteCargo: empresa.representanteCargo || '',
    representanteCpf: empresa.representanteCpf || '',
    representanteRg: empresa.representanteRg || '',
    contratanteCompleto,
    numeroPregao: licitacao.numeroPregao || '',
    numeroProcesso: licitacao.numeroProcesso || '',
    tipoDisputa: (licitacao.tipoDisputa || '').toUpperCase(),
    objetoLicitacao: licitacao.objetoLicitacao || '',
  }
}

export function renderDeclaracaoText(template: string, ctx: DeclaracaoContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => ctx[key] ?? '')
}
