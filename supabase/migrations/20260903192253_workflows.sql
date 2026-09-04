-- EmailsOrganised: persisted workflow builder drafts.

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  detail text not null default '',
  status text not null default 'draft',
  owner_role text not null default '',
  trigger text not null default '',
  classifier_prompt text not null default '',
  outcomes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflows_name_not_blank check (length(btrim(name)) > 0),
  constraint workflows_status_valid check (status in ('live', 'paused', 'draft')),
  constraint workflows_outcomes_is_array check (jsonb_typeof(outcomes) = 'array')
);

comment on table public.workflows is
  'User-owned mailbox automation workflows created in the workflow builder.';

create index if not exists workflows_user_updated_at_idx
  on public.workflows (user_id, updated_at desc);

alter table public.workflows enable row level security;

-- Keep the Data API surface explicit for this exposed public table. RLS below
-- still decides which rows each signed-in user can reach.
revoke all on table public.workflows from anon;
grant select, insert, update, delete on table public.workflows to authenticated;
grant all on table public.workflows to service_role;

drop policy if exists workflows_select_own on public.workflows;
create policy workflows_select_own on public.workflows
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists workflows_insert_own on public.workflows;
create policy workflows_insert_own on public.workflows
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists workflows_update_own on public.workflows;
create policy workflows_update_own on public.workflows
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists workflows_delete_own on public.workflows;
create policy workflows_delete_own on public.workflows
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop trigger if exists workflows_set_updated_at on public.workflows;
create trigger workflows_set_updated_at
  before update on public.workflows
  for each row execute function public.set_updated_at();
