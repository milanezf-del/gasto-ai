# Banco de Dados e Autenticação (Supabase)

O **Gastô** utiliza **Supabase (PostgreSQL + Supabase Auth)** como banco de dados e autenticação, mantendo o frontend e a API Hono hospedados no **Cloudflare Pages + Pages Functions** com **Cloudflare Workers AI**.

## 1. Como aplicar o `schema.sql` inicial no Supabase

1. Acesse o painel do **Supabase** (`supabase.com/dashboard`) e abra o seu projeto.
2. No menu lateral esquerdo, clique em **SQL Editor** -> **New query**.
3. Copie todo o conteúdo do arquivo `db/schema.sql` deste repositório e cole no editor.
4. Clique em **Run** para criar as tabelas, índices, trigger de perfil e políticas **Row Level Security (RLS)**.

## 2. Como aplicar a migração `002_insights.sql`

Se você já havia aplicado `db/schema.sql` anteriormente, execute também `db/migrations/002_insights.sql` no **SQL Editor** para criar a tabela `public.insights_cache` (cache mensal de insights financeiros) e a política `profiles_delete_own` (necessária para exclusão completa de conta).

## 3. Como conferir se deu certo

No **SQL Editor**, rode:

```sql
select tablename
from pg_tables
where schemaname = 'public'
order by tablename;
```

Você deverá ver as tabelas: `ai_usage`, `budgets`, `expenses`, `images`, `insights_cache`, `merchant_rules` e `profiles`.

## 4. Variáveis e Bindings no Cloudflare Pages

Configure diretamente no painel do **Cloudflare Pages** (`Settings > Environment Variables` / `Bindings`):

- `SUPABASE_URL`: URL do seu projeto Supabase (`https://<ref>.supabase.co`)
- `SUPABASE_ANON_KEY`: Chave pública/publishable (`sb_publishable_...` ou `anon` key)
- Binding **Workers AI**: variável `AI`
- *(Opcional)* `SUPABASE_SERVICE_ROLE_KEY`: apenas se desejar remover também o registro em `auth.users` ao excluir conta
- *(Opcional)* `TURNSTILE_SECRET` e `VITE_TURNSTILE_SITE_KEY`: para ativar proteção antirrobô Cloudflare Turnstile no login e cadastro
