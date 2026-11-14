# Gastô

Assistente financeiro pessoal em **pt-BR** (valores em centavos/BRL, datas `dd/mm/aaaa`, fuso `America/Sao_Paulo`) construído para **Cloudflare Pages**, **Pages Functions (Hono)**, **Cloudflare D1** e **Cloudflare Workers AI**.

## Estrutura do Projeto

```text
├── public/
│   └── _redirects               # Fallback SPA para Cloudflare Pages (/* /index.html 200)
├── functions/
│   └── api/
│       ├── types.ts             # Tipagem dos bindings Cloudflare (DB, AI, APP_SECRET)
│       ├── schemas.ts           # Schemas Zod compartilhados / validação de entrada
│       ├── app.ts               # Instância principal Hono com basePath /api e tratamento de erros
│       ├── routes/
│       │   └── health.ts        # Módulo de healthcheck (GET /api/health -> { ok: true })
│       └── [[route]].ts         # Entrypoint Cloudflare Pages Functions (hono/cloudflare-pages)
├── src/
│   ├── lib/
│   │   ├── api.ts               # Fetch wrapper tipado (credentials: 'include', erros pt-BR)
│   │   └── schemas.ts           # Validação Zod para entradas e respostas no frontend
│   ├── hooks/                   # Hooks de dados (useSummary, useExpenses, useBudgets, useAccounts, useAiAssistant, useTheme)
│   ├── components/              # Interface visual (estados loading skeleton, empty e error)
│   ├── types/finance.ts         # Contratos TypeScript estritos (valores inteiros em centavos, datas ISO yyyy-mm-dd)
│   └── utils/formatters.ts      # Formatação BRL (centavos -> R$), datas dd/mm/aaaa e fuso America/Sao_Paulo
├── server.ts                    # Servidor local de desenvolvimento (Vite + ponte para rotas Hono /api/*)
└── package.json
```

## Scripts

- `npm run dev` — Inicia o ambiente de desenvolvimento na porta `3000`.
- `npm run build` — Gera o bundle de produção em `dist/` (incluindo `_redirects`).
- `npm run lint` — Executa checagem estrita TypeScript (`tsc --noEmit`).
