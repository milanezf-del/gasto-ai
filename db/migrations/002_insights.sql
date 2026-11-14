-- Migração 002: Cache de insights financeiros por usuário/mês e política de exclusão de perfil
-- Execute este script no SQL Editor do Supabase (ou console SQL equivalente).

create table if not exists public.insights_cache (
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  insights_json jsonb not null,
  data_signature text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

create index if not exists idx_insights_cache_user_month
  on public.insights_cache (user_id, month);

alter table public.insights_cache enable row level security;

drop policy if exists "insights_cache_all_own" on public.insights_cache;
create policy "insights_cache_all_own"
  on public.insights_cache for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Permite que o usuário autenticado remova seu próprio perfil ao excluir a conta
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = id);
