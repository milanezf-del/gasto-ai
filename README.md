# Gastô

Assistente financeiro pessoal em **pt-BR** (valores inteiros em centavos/BRL, datas `dd/mm/aaaa`, fuso `America/Sao_Paulo`) construído com **React + Vite + Tailwind**, **Cloudflare Pages + Pages Functions (Hono)**, **Cloudflare Workers AI** e **Supabase (PostgreSQL + RLS + Auth)**.

## Funcionalidades Principais

- **Dashboard Financeiro (`/api/dashboard`)**: seletor de mês funcional, KPIs mensais, sparkline diário, gráfico de tendência diária, donut por categoria, barras de orçamento com estados *No esperado / Alerta / Estourado*, 5 despesas recentes e **Insights da IA (`/api/insights`)** com cache mensal.
- **Despesas & Comprovantes (`/api/expenses`, `/api/images/:id`)**: paginação por cursor, busca e filtros avançados, agrupamento diário, tela de detalhe com comprovante anexado, edição/exclusão com confirmação, badge de pendentes e **exportação CSV UTF-8 com BOM** (`/api/expenses/export.csv`).
- **Leitura Inteligente via Workers AI (`/api/ai/*`)**:
  - Compressão no navegador (`1280px` / JPEG `0.8`) e envio de 1 a 5 imagens (câmera ou galeria/drag-and-drop) para `@cf/meta/llama-3.2-11b-vision-instruct`.
  - Entrada rápida em linguagem natural e categorização via `@cf/meta/llama-3.1-8b-instruct-fp8-fast`.
  - Fila de revisão item a item com destaque em âmbar para campos com confiança `< 80%`, aviso de duplicata e aprendizado automático de regras (`merchant_rules`).
  - Controle de cota (`40/dia` e `300 total` por usuário) com fallback automático para lançamento manual preenchido (`429 AI_LIMIT`).
- **Assistente Conversacional Seguro (`/api/assistant`)**: arquitetura em 2 passos (classificação de intenção -> consulta parametrizada no servidor sempre filtrada pelo `user_id` da sessão -> redação opcional sem inventar valores), com cards clicáveis e mini gráfico.
- **PWA e Endurecimento**: `manifest.webmanifest`, service worker (`/sw.js`) sem cache de `/api/*`, tela offline (`/offline.html`), CSP restritiva e headers em `functions/_middleware.ts`, cache imutável em `public/_headers` e suporte opcional a **Cloudflare Turnstile**.

## Estrutura do Projeto

```text
├── db/
│   ├── schema.sql                  # Schema PostgreSQL + RLS para o Supabase
│   ├── migrations/002_insights.sql # Tabela insights_cache + política delete profile
│   └── README.md                   # Guia de configuração no Supabase
├── public/
│   ├── manifest.webmanifest        # Manifesto PWA ("Gastô")
│   ├── sw.js                       # Service worker (shell offline; nunca cacheia /api/*)
│   ├── offline.html                # Página amigável offline
│   ├── _headers                    # Cache imutável para /assets/*
│   └── _redirects                  # Fallback SPA (/* /index.html 200)
├── functions/
│   ├── _middleware.ts              # CSP restritiva e headers de segurança HTTP
│   └── api/
│       ├── ai.ts                   # Rotas Workers AI (/api/ai/parse-image, parse-text, categorize)
│       ├── app.ts                  # App Hono (/api/*)
│       ├── [[route]].ts            # Entrypoint Cloudflare Pages Functions
│       ├── lib/                    # supabase, aiClient, money, dates, turnstile, ids
│       ├── middleware/             # auth.ts (validação JWT via Supabase Auth)
│       └── routes/                 # health, auth, dashboard, expenses, images, budgets, rules, assistant, insights, account
├── src/                            # Frontend React + TypeScript + Tailwind
└── server.ts                       # Servidor local (Vite + ponte Hono /api/*)
```

## Desenvolvimento Local e Build

```bash
npm install
npm run dev      # Inicia na porta 3000 (Vite + API /api/*)
npm run lint     # Checagem estrita TypeScript (tsc --noEmit)
npm run build    # Gera dist/ pronto para Cloudflare Pages
```

## Checklist de Deploy (Cloudflare Pages)

1. Aplique `db/schema.sql` e `db/migrations/002_insights.sql` no **SQL Editor** do Supabase.
2. Conecte o repositório no **Cloudflare Pages** com build command `npm run build` e output directory `dist`.
3. Configure as variáveis (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, opcionalmente `TURNSTILE_SECRET`, `VITE_TURNSTILE_SITE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) e o binding **Workers AI** (`AI`) diretamente no painel do Cloudflare Pages (sem `wrangler.toml`).
