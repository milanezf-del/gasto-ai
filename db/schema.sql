-- Esquema PostgreSQL / Supabase para o Gastô
-- Execute este script no SQL Editor do seu projeto Supabase.

create extension if not exists pgcrypto;

-- Perfil público espelhando auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null check (email = lower(email)),
  name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'name', '')), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(excluded.name, public.profiles.name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Metadados / armazenamento de comprovantes
create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mime text not null,
  storage_path text,
  data bytea,
  size integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_images_user_id on public.images (user_id);

alter table public.images enable row level security;

drop policy if exists "images_all_own" on public.images;
create policy "images_all_own"
  on public.images for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Lançamentos financeiros (valores inteiros em centavos; datas yyyy-mm-dd)
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  merchant text,
  amount_cents integer not null,
  expense_date date not null,
  category text not null check (category in ('Alimentação', 'Transporte', 'Educação', 'Lazer', 'Outros')),
  note text,
  source text check (source in ('image', 'text', 'manual')) default 'manual',
  status text not null check (status in ('confirmed', 'needs_review')) default 'confirmed',
  confidence_json jsonb,
  image_id uuid references public.images (id) on delete set null,
  dedupe_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_expenses_user_date
  on public.expenses (user_id, expense_date desc);

create index if not exists idx_expenses_user_dedupe
  on public.expenses (user_id, dedupe_hash);

alter table public.expenses enable row level security;

drop policy if exists "expenses_all_own" on public.expenses;
create policy "expenses_all_own"
  on public.expenses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Orçamentos mensais por categoria
create table if not exists public.budgets (
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('Alimentação', 'Transporte', 'Educação', 'Lazer', 'Outros')),
  limit_cents integer not null check (limit_cents >= 0),
  alert_percent integer not null default 80 check (alert_percent between 1 and 100),
  primary key (user_id, category)
);

alter table public.budgets enable row level security;

drop policy if exists "budgets_all_own" on public.budgets;
create policy "budgets_all_own"
  on public.budgets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Regras aprendidas por estabelecimento normalizado
create table if not exists public.merchant_rules (
  user_id uuid not null references auth.users (id) on delete cascade,
  merchant_norm text not null,
  category text not null check (category in ('Alimentação', 'Transporte', 'Educação', 'Lazer', 'Outros')),
  updated_at timestamptz not null default now(),
  primary key (user_id, merchant_norm)
);

alter table public.merchant_rules enable row level security;

drop policy if exists "merchant_rules_all_own" on public.merchant_rules;
create policy "merchant_rules_all_own"
  on public.merchant_rules for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Controle diário de uso de IA
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_all_own" on public.ai_usage;
create policy "ai_usage_all_own"
  on public.ai_usage for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
