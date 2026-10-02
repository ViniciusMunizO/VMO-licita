# Licita-VMO

Sistema web de gestão de licitações públicas: do cadastro da licitação à proposta em PDF, com itens, anexos, atas e contratos, relatórios e dashboard, para a equipe inteira trabalhar sobre a mesma informação.

> **Status:** projeto próprio, em desenvolvimento.

<!-- Capturas de tela: adicione 2 ou 3 imagens em docs/ (dashboard, detalhe da licitação, proposta em PDF) e referencie aqui:
![Dashboard](docs/dashboard.png) -->

## O que o sistema faz

- **Licitações:** cadastro, listagem com filtros, detalhe com status rápido e prazos (recurso e impugnação).
- **Itens:** importação a partir de planilha Excel, vencedor, desclassificação e histórico de preço por item.
- **Anexos, atas e contratos:** arquivos guardados no Supabase Storage e vinculados à licitação.
- **Documentos da empresa e contratantes:** cadastro da empresa, dados bancários e documentos.
- **Proposta e declarações em PDF:** gerados no navegador (jsPDF), com os dados da empresa.
- **Relatórios:** ganhos, perdidos, desclassificados, ranking de contratantes e histórico de item.
- **Dashboard, metas e entregas.**
- **Usuários e perfis de acesso:** `admin`, `moderador` e `user`, com ativação de conta e recuperação de senha.
- **Trilha de auditoria:** ações relevantes ficam registradas e consultáveis por administradores.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Front-end | Vite, React 18, TypeScript, Tailwind CSS 3, React Router 6 |
| Back-end | Supabase: PostgreSQL, Auth e Storage (sem servidor próprio) |
| PDF e planilhas | jsPDF, html2canvas, xlsx |
| Testes | Suíte end-to-end com Puppeteer (`scripts/`) |
| Hospedagem | Render (site estático, `render.yaml`) |

## Segurança

- **Row Level Security** em todas as tabelas: só membro ativo lê e grava; dados da empresa são graváveis apenas por administrador (`supabase/schema.sql`).
- **Storage** com políticas por objeto, também restritas a membro ativo.
- **Autenticação** feita pelo Supabase Auth; o sistema não guarda senhas.
- **Chave `anon` no front-end é pública por design:** a proteção vem das políticas do banco, não do sigilo da chave (veja `.env.example`). Nenhuma chave privada vai para o repositório.
- **Auditoria:** tabela `audit_logs` com o usuário preenchido pelo banco, não pelo cliente.

## Como rodar

Pré-requisitos: Node.js 18 ou superior e um projeto no [Supabase](https://supabase.com).

1. **Banco de dados:** no SQL Editor do Supabase, execute `supabase/schema.sql` e depois as migrações de `supabase/migrations/` em ordem numérica. Detalhes em `supabase/PROVISIONAMENTO.md`.
2. **Variáveis de ambiente:** copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
3. **Dependências e servidor de desenvolvimento:**

```bash
npm install
npm run dev
```

Outros comandos: `npm run build` (build de produção), `npm run preview` e `npm run lint`.

## Testes end-to-end

A suíte em `scripts/` abre o sistema num navegador de verdade (Puppeteer) e confere o resultado direto no banco. **Ela cria e apaga dados de verdade:** use somente em um projeto Supabase de teste, nunca com dados reais de cliente. Instruções completas em `scripts/README.md`.

## Deploy

O front-end é publicado como site estático no Render, a partir do `render.yaml`, com deploy automático a cada push. Defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas variáveis de ambiente do serviço.

## Estrutura

```
src/pages/       telas (licitações, relatórios, dashboard, usuários, auditoria)
src/components/  componentes reutilizáveis
src/context/     contexto de autenticação
src/utils/       regras de negócio, PDF, planilhas e acesso ao Supabase
supabase/        schema.sql e migrações numeradas
scripts/         suíte de testes end-to-end
```
