# Migrations

Alterações no banco, em ordem numérica. Cada arquivo roda **uma vez por
ambiente**, colado no SQL Editor do Supabase.

## Provisionar um projeto do zero

1. `supabase/schema.sql` (cria tudo que é base)
2. depois, cada arquivo desta pasta, em ordem: `0001_`, `0002_`, ...

Num projeto novo, só o `0001_` tem efeito de verdade — o `0002_` e o `0003_`
existem pra desfazer coisa que projeto novo nunca chegou a ter.

Isso aqui é só a parte do banco. Pra provisionar um **cliente novo** de
ponta a ponta (usuário admin, bucket de anexos, segurança, Render, e como
validar que pegou de verdade antes de considerar pronto), siga
[`supabase/PROVISIONAMENTO.md`](../PROVISIONAMENTO.md).

## Aplicar num banco que já está rodando

Só os arquivos que ainda não foram aplicados naquele ambiente.

Todos são escritos para serem idempotentes (`if not exists`, `drop ... if
exists` antes de criar), então rodar de novo por engano não estraga nada —
mas quem controla o que já rodou é você.

## Por que esta pasta existe

O `schema.sql` descreve como o banco **deveria** estar, e é ótimo pra criar um
projeto novo. O que ele não faz é registrar o que já foi aplicado num banco que
já tem dados.

Foi assim que as colunas `path`, `mime` e `size` de `attachments` ficaram
faltando em produção: estavam no `schema.sql`, nunca chegaram ao banco. O
sintoma não apontava pra lá — a tela de detalhe mostrava a licitação **sem
nenhum item**, porque a leitura dos anexos falhava junto com a dos itens no
mesmo `Promise.all`. Um arquivo numerado por mudança evita esse tipo de
defasagem silenciosa.

## Lista

| Arquivo | O que faz |
|---|---|
| `0001_attachments_e_updated_at.sql` | Aplica as colunas pendentes de `attachments` e faz `updated_at` se atualizar sozinho em `items` e `licitacoes`. |
| `0002_remover_planilha_fortune_sheet.sql` | **Apaga dados.** Derruba `planilhas` e `planilha_modelos`, da planilha livre estilo Excel que foi descartada. Opcional — rode quando tiver certeza. |
| `0003_remover_cotacao.sql` | Desfaz a grade de cotação dentro do cadastro, também descartada: derruba `cotacao_colunas`, `cotacao_modelos`, a RPC `salvar_licitacao_com_itens` e as colunas que só ela usava em `items`. Só tem efeito em quem rodou a versão antiga do `0001_cotacao.sql`. |
| `0004_documentos_empresa.sql` | Cria `documentos_empresa` (certidões/documentos da empresa com data de validade), com RLS e `updated_at` automático. |
| `0005_prazos_recurso_impugnacao.sql` | Adiciona `dataLimiteRecurso` e `dataLimiteImpugnacao` em `licitacoes`, usadas pelo alerta de prazos no Dashboard. |
| `0006_empresa_info_somente_admin.sql` | Restringe gravação em `empresa_info` a admin ativo (leitura continua liberada pra qualquer membro ativo). |
| `0007_audit_logs_user_id.sql` | Adiciona `user_id` (preenchido pelo Postgres via `auth.uid()`, não pelo texto que o cliente manda) em `audit_logs`, pra trilha de auditoria parar de confiar em texto forjável. Adiciona também o índice em `at` que faltava. |
| `0008_audit_logs_retencao.sql` | Policy de delete em `audit_logs` restrita a admin ativo — usada pelo botão "Exportar e apagar logs antigos" da tela de auditoria (retenção/LGPD). |
| `0009_propostas_emitidas.sql` | Cria `propostas_emitidas`: um snapshot automático dos itens/valores gravado a cada emissão da Proposta de Preços em PDF, pra existir um registro do que foi de fato enviado ao órgão mesmo que os dados mudem depois. |
| `0010_metas.sql` | Cria `metas` (valor e taxa de sucesso alvo por mês), comparada com o realizado no card "Meta do mês" do Dashboard. Só admin define, qualquer membro ativo lê. |
| `0011_entregas.sql` | Cria `entregas` (quantidade/data/nota fiscal por remessa entregue de um item vencedor), pra comparar entregue x contratado na tela de detalhe. Escopo menor do que "alerta de capacidade" — isso ficou de fora, precisaria de catálogo de produtos/estoque à parte. |
| `0012_audit_logs_retencao_minima.sql` | **Corrige falha de segurança da 0008**: a policy de delete deixava admin apagar qualquer log, inclusive recém-criado. Agora só deixa apagar log com mais de 180 dias, reforçado no banco. Rode mesmo se já rodou a 0008. |

## Nota sobre o `0001_cotacao.sql`

Se você tem um arquivo com esse nome anotado como "já rodei", ele era a versão
antiga do `0001`, que criava a grade de cotação. A funcionalidade foi
descartada — rode o `0003_` para desfazer. A parte dele que continua valendo
(colunas de `attachments`, triggers de `updated_at`) é o que sobrou no
`0001_attachments_e_updated_at.sql`, que é seguro rodar de novo.
