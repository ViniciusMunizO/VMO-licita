-- ============================================================
-- 0002_remover_planilha_fortune_sheet — limpeza
-- ============================================================
--
-- ATENÇÃO: este script APAGA DADOS. Rode só quando tiver certeza de que não
-- quer mais nada que foi salvo na planilha antiga — a de células livres,
-- estilo Excel, que ficava na tela "Planilhas".
--
-- Ela foi descartada, e a grade de cotação que chegou a substituí-la também
-- (veja o `0003_remover_cotacao.sql`). A cotação continua sendo feita na
-- planilha do cliente e entrando pelo botão "Importar Itens".
--
-- Como conferir antes de apagar — se as duas contagens vierem zero, não há
-- nada a perder:
--
--   select count(*) from planilha_modelos;
--   select count(*) from planilhas;
--
-- Nada no sistema lê mais essas tabelas: a tela "Planilhas", o modal de
-- cotação e o componente Fortune-sheet já não existem no código.

begin;

drop table if exists planilhas;
drop table if exists planilha_modelos;

commit;
