-- ============================================================
-- 0003_remover_cotacao — limpeza
-- ============================================================
--
-- Rode este arquivo SÓ se você chegou a executar a versão antiga do
-- `0001_cotacao.sql`, que criava a grade de cotação dentro da tela de
-- cadastro da licitação. Essa funcionalidade foi descartada: a cotação
-- continua sendo feita no Excel do cliente e entrando pelo botão
-- "Importar Itens".
--
-- Se o seu ambiente nunca rodou aquele arquivo, rodar este aqui não faz
-- nada (é tudo `if exists`) — e também não custa nada.
--
-- O que este script desfaz:
--   1. As tabelas `cotacao_colunas` e `cotacao_modelos`
--   2. A função `salvar_licitacao_com_itens`
--   3. As colunas que só a grade usava em `items`
--   4. As constraints de valor não-negativo que vieram junto
--
-- O que NÃO é desfeito: as colunas de `attachments` e os triggers de
-- `updated_at`. Eles nunca foram da cotação — hoje moram no
-- `0001_attachments_e_updated_at.sql` e continuam valendo.

begin;

-- ============================================================
-- 1. tabelas do layout da grade
--
-- Guardavam só o desenho das colunas (largura, ordem, título, fórmula).
-- Nenhum dado de licitação mora aqui: os itens sempre estiveram em `items`.
-- ============================================================
drop table if exists cotacao_colunas;
drop table if exists cotacao_modelos;

-- ============================================================
-- 2. a RPC transacional da grade
--
-- Gravava licitação + layout + itens numa transação só. Sem a grade, quem
-- grava é o PostgREST direto, como antes.
-- ============================================================
drop function if exists public.salvar_licitacao_com_itens(jsonb, jsonb, jsonb);

-- ============================================================
-- 3. colunas de `items` que só existiam pra grade
--
-- ATENÇÃO: este é o único trecho que apaga dado. `dadosExtras` guardava as
-- colunas personalizadas criadas na grade e `ordem` a posição da linha —
-- nada disso é lido por qualquer tela do sistema hoje (a lista de itens
-- ordena por `created_at`). Se por algum motivo você digitou dados direto na
-- grade e quer conferir antes, rode:
--
--   select count(*) from items where "dadosExtras" <> '{}'::jsonb;
--
-- `fornecedor` e `observacoes` NÃO são apagadas de propósito: são campos de
-- texto comum, podem ter sido preenchidos à mão e não atrapalham nada
-- ficando aí. Se quiser mesmo assim, descomente as duas linhas no fim.
-- ============================================================
alter table items drop column if exists "dadosExtras";
alter table items drop column if exists ordem;
drop index if exists items_ordem_idx;

-- ============================================================
-- 4. constraints de valor não-negativo
--
-- Vieram com a grade e o resto do sistema não as espelha: a importação da
-- planilha valida formato de número, não sinal. Uma planilha com um valor
-- negativo (um desconto lançado errado, por exemplo) passaria pela tela e
-- morreria aqui com erro de banco, que é pior de entender do que o aviso da
-- importação. Saem junto com a grade que as introduziu.
-- ============================================================
alter table items drop constraint if exists items_quantidade_nao_negativa;
alter table items drop constraint if exists items_valores_nao_negativos;

-- Opcionais — descomente se quiser derrubar também os dois campos de texto:
-- alter table items drop column if exists fornecedor;
-- alter table items drop column if exists observacoes;

commit;
