# Licita-VMO

Sistema de gestão de licitações públicas — cadastro de licitações, itens/cotação, anexos, atas/contratos, emissão de proposta e declarações em PDF, relatórios (ganhos, perdidos, desclassificados, ranking de contratantes, histórico de item) e dashboard.

Stack: Vite + React + TypeScript + Tailwind, com Supabase (Postgres + Auth + Storage) como backend.

## Arquitetura

Uma instância por cliente vendido — cada cliente roda seu próprio projeto Supabase + serviço Render a partir deste mesmo repositório, não é uma plataforma multi-tenant. Ver [`supabase/PROVISIONAMENTO.md`](supabase/PROVISIONAMENTO.md) pro passo a passo completo de colocar um cliente novo no ar.

## Rodando localmente

1. `npm install`
2. Copie `.env.example` pra `.env` e preencha com a URL/anon key de um projeto Supabase (ver `supabase/schema.sql` pra provisionar um do zero).
3. `npm run dev` — servidor de desenvolvimento em `http://localhost:5173`.

Outros scripts:

- `npm run build` — build de produção
- `npm run lint` — ESLint
- `npm run preview` — serve o build de produção localmente

## Testes

Suíte end-to-end (Puppeteer) que usa o sistema como um usuário usaria e confere o resultado direto no banco — ver [`scripts/README.md`](scripts/README.md). **Cria e apaga dados de verdade**, nunca rodar apontando pra um ambiente com dado real de cliente sem entender esse risco.

## Banco de dados

- [`supabase/schema.sql`](supabase/schema.sql) — schema completo, para provisionar um projeto novo.
- [`supabase/migrations/`](supabase/migrations/) — alterações incrementais, para aplicar num projeto que já está rodando.
