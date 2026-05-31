create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade unique,
  allowed_pages text[] not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_user_permissions_user on public.user_permissions(user_id);

alter table public.user_permissions enable row level security;

drop policy if exists "user_permissions_select" on public.user_permissions;
create policy "user_permissions_select" on public.user_permissions
  for select using (auth.role() = 'authenticated');

drop policy if exists "user_permissions_write" on public.user_permissions;
create policy "user_permissions_write" on public.user_permissions
  for all using (
    exists (select 1 from public.users where auth_id = auth.uid() and level <= 1)
  ) with check (
    exists (select 1 from public.users where auth_id = auth.uid() and level <= 1)
  );

drop trigger if exists trg_user_permissions_updated on public.user_permissions;
create trigger trg_user_permissions_updated
  before update on public.user_permissions
  for each row
  execute function public.update_updated_at();

