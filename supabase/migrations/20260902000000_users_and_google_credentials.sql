-- EmailsOrganised: application users and Google mailbox credentials.
--
-- Supabase owns `auth.users`, which is not safe to reference from application
-- tables you want to join, extend, or expose. `public.users` is the mirror the
-- rest of the schema builds on: one row per auth user, kept in sync by a
-- trigger so no application code is responsible for creating it.

-- ---------------------------------------------------------------------------
-- public.users
-- ---------------------------------------------------------------------------

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  -- Google's stable subject id. Survives the user changing their email.
  google_sub text unique,
  -- Mailbox connection status, safe for the user to read. The tokens
  -- themselves live in public.google_credentials, which the user cannot read.
  gmail_connected_at timestamptz,
  gmail_scopes text[] not null default '{}',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.users is
  'Application profile mirroring auth.users. Populated by handle_new_user().';

create index if not exists users_email_idx on public.users (lower(email));

alter table public.users enable row level security;

-- A user can read and update only their own profile. There is deliberately no
-- insert or delete policy: rows are created by the trigger below and removed by
-- the cascade from auth.users.
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Sync trigger: auth.users -> public.users
-- ---------------------------------------------------------------------------

create or replace function public.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users as u (id, email, full_name, avatar_url, google_sub)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    ),
    new.raw_user_meta_data ->> 'sub'
  )
  on conflict (id) do update set
    email      = excluded.email,
    -- Never blank out a value the user has edited in-app just because a later
    -- Google payload omitted it.
    full_name  = coalesce(excluded.full_name, u.full_name),
    avatar_url = coalesce(excluded.avatar_url, u.avatar_url),
    google_sub = coalesce(excluded.google_sub, u.google_sub),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_change on auth.users;
create trigger on_auth_user_change
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_auth_user_change();

-- Backfill anyone who signed up before this migration ran.
insert into public.users as u (id, email, full_name, avatar_url, google_sub)
select
  au.id,
  coalesce(au.email, ''),
  coalesce(
    au.raw_user_meta_data ->> 'full_name',
    au.raw_user_meta_data ->> 'name'
  ),
  coalesce(
    au.raw_user_meta_data ->> 'avatar_url',
    au.raw_user_meta_data ->> 'picture'
  ),
  au.raw_user_meta_data ->> 'sub'
from auth.users au
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- public.google_credentials
-- ---------------------------------------------------------------------------
--
-- Google refresh tokens. Supabase returns provider_refresh_token exactly once,
-- in the OAuth callback, and does not persist it — so this table is the only
-- copy, and losing a row means sending the user back through consent.
--
-- RLS is enabled with NO policies and privileges are revoked from anon and
-- authenticated, so the table is unreachable with a user's JWT. Only the
-- service role (which bypasses RLS) can read it, and only through
-- src/lib/google/token-store.ts.

create table if not exists public.google_credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  scopes text[] not null default '{}',
  google_email text,
  revoked_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.google_credentials is
  'Service-role only. Google OAuth refresh tokens for mailbox access.';

alter table public.google_credentials enable row level security;

-- No policies are created on purpose: with RLS on and no policy, every request
-- carrying a user JWT sees zero rows and can write none.
-- Supabase's default privileges grant new public tables to anon/authenticated,
-- so the revoke is what actually locks this down. service_role is granted
-- explicitly rather than relying on those defaults.
revoke all on table public.google_credentials from anon, authenticated;
grant all on table public.google_credentials to service_role;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists google_credentials_set_updated_at on public.google_credentials;
create trigger google_credentials_set_updated_at
  before update on public.google_credentials
  for each row execute function public.set_updated_at();
