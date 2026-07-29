-- ============================================================================
-- Socialexie — initial schema
--
-- Tenancy model: every row that belongs to a customer hangs off a workspace.
-- Access is granted through workspace_members, and every table below denies
-- by default until an explicit policy allows the caller. Platform staff are
-- listed in platform_admins and are the only accounts that can read across
-- tenants.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type member_role as enum ('owner', 'admin', 'editor', 'viewer');

create type platform_id as enum (
  'facebook', 'instagram', 'tiktok', 'youtube',
  'x', 'linkedin', 'pinterest', 'threads'
);

create type account_status as enum ('active', 'expired', 'revoked', 'error');

create type post_status as enum (
  'draft', 'pending_approval', 'scheduled', 'publishing',
  'published', 'failed', 'paused'
);

create type post_format as enum (
  'text', 'image', 'carousel', 'video', 'reel', 'short', 'story'
);

create type target_status as enum (
  'pending', 'publishing', 'published', 'failed', 'skipped'
);

create type media_kind as enum ('image', 'video');

create type plan_tier as enum ('free', 'creator', 'studio', 'agency');

create type billing_mode as enum ('monthly', 'lifetime');

create type subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'expired'
);

create type automation_status as enum ('draft', 'active', 'paused');

create type ai_kind as enum ('image', 'text');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       citext not null unique,
  full_name   text,
  avatar_url  text,
  locale      text not null default 'en',
  timezone    text not null default 'UTC',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Platform staff. Membership here is what unlocks the admin console; it is
-- deliberately a table rather than an env var so access is auditable.
create table public.platform_admins (
  email      citext primary key,
  note       text,
  created_at timestamptz not null default now()
);

insert into public.platform_admins (email, note)
values ('itsinjamul@gmail.com', 'Founding administrator')
on conflict (email) do nothing;

-- Mirror the signed-in user's email into a claim-free helper. SECURITY DEFINER
-- so it can read platform_admins without granting the caller access to it.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins pa
    join public.profiles p on p.email = pa.email
    where p.id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 80),
  slug        citext not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  timezone    text not null default 'UTC',
  brand_voice text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index workspaces_owner_idx on public.workspaces (owner_id);

create trigger workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         member_role not null default 'editor',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id);

-- SECURITY DEFINER breaks the recursion that would occur if a policy on
-- workspace_members had to query workspace_members through RLS.
create or replace function public.is_workspace_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_workspace_role(
  target uuid,
  allowed member_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target
      and m.user_id = auth.uid()
      and m.role = any(allowed)
  );
$$;

-- ---------------------------------------------------------------------------
-- Connected channels
-- ---------------------------------------------------------------------------

create table public.social_accounts (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  platform         platform_id not null,
  external_id      text not null,
  handle           text not null,
  display_name     text,
  avatar_url       text,
  -- Tokens are written by the server with the service role and are never
  -- exposed to the browser; no client policy selects these columns.
  access_token     text,
  refresh_token    text,
  token_expires_at timestamptz,
  scopes           text[] not null default '{}',
  status           account_status not null default 'active',
  last_error       text,
  connected_by     uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (workspace_id, platform, external_id)
);

create index social_accounts_workspace_idx on public.social_accounts (workspace_id, status);

create trigger social_accounts_updated_at
  before update on public.social_accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Media library
-- ---------------------------------------------------------------------------

create table public.media_assets (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  kind             media_kind not null,
  storage_path     text not null,
  width            integer check (width > 0),
  height           integer check (height > 0),
  duration_seconds numeric(10,3) check (duration_seconds >= 0),
  byte_size        bigint check (byte_size >= 0),
  alt_text         text,
  -- Provenance for anything the AI studio produced.
  ai_provider      text,
  ai_model         text,
  ai_prompt        text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index media_assets_workspace_idx on public.media_assets (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Content organisation
-- ---------------------------------------------------------------------------

create table public.content_categories (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 60),
  color        text not null default '#FFB020',
  -- When true, finished posts in this category go back into rotation.
  recycle      boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (workspace_id, name)
);

create index content_categories_workspace_idx on public.content_categories (workspace_id);

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------

create table public.posts (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  category_id    uuid references public.content_categories(id) on delete set null,
  title          text,
  body           text not null default '',
  format         post_format not null default 'text',
  status         post_status not null default 'draft',
  scheduled_at   timestamptz,
  published_at   timestamptz,
  -- Recycling bookkeeping.
  recycle_enabled boolean not null default false,
  recycle_count  integer not null default 0 check (recycle_count >= 0),
  last_recycled_at timestamptz,
  created_by     uuid references public.profiles(id) on delete set null,
  approved_by    uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- A post cannot claim to be scheduled without a time.
  constraint posts_scheduled_needs_time
    check (status <> 'scheduled' or scheduled_at is not null)
);

-- The publisher polls this constantly; keep it a narrow partial index.
create index posts_due_idx
  on public.posts (scheduled_at)
  where status = 'scheduled';

create index posts_workspace_status_idx
  on public.posts (workspace_id, status, scheduled_at desc);

create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

create table public.post_media (
  post_id  uuid not null references public.posts(id) on delete cascade,
  media_id uuid not null references public.media_assets(id) on delete cascade,
  position smallint not null default 0,
  primary key (post_id, media_id)
);

create index post_media_post_idx on public.post_media (post_id, position);

-- One row per network a post goes out on, so a partial failure is visible
-- per channel instead of collapsing the whole post into "failed".
create table public.post_targets (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references public.posts(id) on delete cascade,
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  platform          platform_id not null,
  caption_override  text,
  status            target_status not null default 'pending',
  external_post_id  text,
  permalink         text,
  error             text,
  attempt_count     smallint not null default 0,
  published_at      timestamptz,
  unique (post_id, social_account_id)
);

create index post_targets_post_idx on public.post_targets (post_id);
create index post_targets_pending_idx
  on public.post_targets (status)
  where status in ('pending', 'publishing');

-- ---------------------------------------------------------------------------
-- Queue automation
-- ---------------------------------------------------------------------------

-- Recurring publishing slots. day_of_week follows ISO numbering (1 = Monday);
-- null means the slot fires every day.
create table public.schedule_slots (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  category_id  uuid references public.content_categories(id) on delete cascade,
  day_of_week  smallint check (day_of_week between 1 and 7),
  time_of_day  time not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index schedule_slots_workspace_idx
  on public.schedule_slots (workspace_id, active);

create table public.recycle_rules (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  category_id       uuid not null references public.content_categories(id) on delete cascade,
  min_days_between  smallint not null default 30 check (min_days_between >= 1),
  max_recycles      smallint check (max_recycles >= 1),
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (workspace_id, category_id)
);

-- ---------------------------------------------------------------------------
-- Comment-to-DM automation
-- ---------------------------------------------------------------------------

create table public.automations (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  name              text not null,
  -- Comment keywords that open the flow. Stored lower-cased.
  keywords          text[] not null default '{}',
  -- Null means "any post on this account".
  target_post_id    uuid references public.posts(id) on delete set null,
  -- Rotated so repeated public replies do not look automated.
  public_replies    text[] not null default '{}',
  -- Two-step DM: an opt-in prompt followed by the payload.
  optin_message     text not null,
  payload_message   text not null,
  payload_url       text,
  status            automation_status not null default 'draft',
  -- Guardrails. Meta allows one automated DM per person per day and only
  -- inside the 24h window opened by their comment.
  daily_send_cap    integer not null default 500 check (daily_send_cap > 0),
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint automations_needs_keywords
    check (cardinality(keywords) > 0)
);

create index automations_workspace_idx on public.automations (workspace_id, status);

create trigger automations_updated_at
  before update on public.automations
  for each row execute function public.set_updated_at();

-- One row per person per automation per day — the unique index is what
-- actually enforces the "one automated DM per user per 24h" rule.
create table public.automation_events (
  id             uuid primary key default gen_random_uuid(),
  automation_id  uuid not null references public.automations(id) on delete cascade,
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  subject_id     text not null,
  comment_id     text,
  send_date      date not null default (now() at time zone 'utc')::date,
  opted_in       boolean not null default false,
  delivered      boolean not null default false,
  error          text,
  created_at     timestamptz not null default now(),
  unique (automation_id, subject_id, send_date)
);

create index automation_events_workspace_idx
  on public.automation_events (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- AI usage
-- ---------------------------------------------------------------------------

create table public.ai_generations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  kind          ai_kind not null,
  provider      text not null,
  model         text not null,
  prompt        text not null,
  params        jsonb not null default '{}'::jsonb,
  media_id      uuid references public.media_assets(id) on delete set null,
  output_text   text,
  input_tokens  integer,
  output_tokens integer,
  cost_cents    integer not null default 0 check (cost_cents >= 0),
  duration_ms   integer,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index ai_generations_workspace_idx
  on public.ai_generations (workspace_id, created_at desc);

-- Rolled up per billing month so quota checks never scan ai_generations.
create table public.usage_counters (
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  period_start     date not null,
  image_credits    integer not null default 0 check (image_credits >= 0),
  ai_words         integer not null default 0 check (ai_words >= 0),
  posts_published  integer not null default 0 check (posts_published >= 0),
  updated_at       timestamptz not null default now(),
  primary key (workspace_id, period_start)
);

-- ---------------------------------------------------------------------------
-- Billing
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  tier               plan_tier not null default 'free',
  billing            billing_mode not null default 'monthly',
  status             subscription_status not null default 'active',
  current_period_end timestamptz,
  provider           text,
  external_id        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Lifetime purchases never expire, so they must not carry a period end.
  constraint subscriptions_lifetime_has_no_period
    check (billing <> 'lifetime' or current_period_end is null)
);

create unique index subscriptions_one_active_per_user
  on public.subscriptions (user_id)
  where status in ('trialing', 'active', 'past_due');

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Redeemable one-time licence codes for the lifetime ladder.
create table public.licenses (
  id           uuid primary key default gen_random_uuid(),
  code         citext not null unique,
  tier         plan_tier not null,
  seats        smallint not null default 1 check (seats >= 1),
  note         text,
  redeemed_by  uuid references public.profiles(id) on delete set null,
  redeemed_at  timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index licenses_redeemed_idx on public.licenses (redeemed_by);

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id           bigserial primary key,
  workspace_id uuid references public.workspaces(id) on delete set null,
  actor_id     uuid references public.profiles(id) on delete set null,
  action       text not null,
  entity       text,
  entity_id    text,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index audit_log_workspace_idx on public.audit_log (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- New signups get a profile automatically.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, tier, billing, status)
  values (new.id, 'free', 'monthly', 'active')
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Row level security
-- ============================================================================

alter table public.profiles            enable row level security;
alter table public.platform_admins     enable row level security;
alter table public.workspaces          enable row level security;
alter table public.workspace_members   enable row level security;
alter table public.social_accounts     enable row level security;
alter table public.media_assets        enable row level security;
alter table public.content_categories  enable row level security;
alter table public.posts               enable row level security;
alter table public.post_media          enable row level security;
alter table public.post_targets        enable row level security;
alter table public.schedule_slots      enable row level security;
alter table public.recycle_rules       enable row level security;
alter table public.automations         enable row level security;
alter table public.automation_events   enable row level security;
alter table public.ai_generations      enable row level security;
alter table public.usage_counters      enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.licenses            enable row level security;
alter table public.audit_log           enable row level security;

-- Profiles -------------------------------------------------------------------
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_platform_admin());

create policy profiles_self_write on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Platform admins ------------------------------------------------------------
create policy platform_admins_read on public.platform_admins
  for select using (public.is_platform_admin());

-- Workspaces -----------------------------------------------------------------
create policy workspaces_read on public.workspaces
  for select using (
    public.is_workspace_member(id) or public.is_platform_admin()
  );

create policy workspaces_insert on public.workspaces
  for insert with check (owner_id = auth.uid());

create policy workspaces_update on public.workspaces
  for update using (public.has_workspace_role(id, array['owner','admin']::member_role[]))
  with check (public.has_workspace_role(id, array['owner','admin']::member_role[]));

create policy workspaces_delete on public.workspaces
  for delete using (owner_id = auth.uid());

-- Members --------------------------------------------------------------------
create policy members_read on public.workspace_members
  for select using (
    user_id = auth.uid()
    or public.is_workspace_member(workspace_id)
    or public.is_platform_admin()
  );

create policy members_manage on public.workspace_members
  for all using (
    public.has_workspace_role(workspace_id, array['owner','admin']::member_role[])
  )
  with check (
    public.has_workspace_role(workspace_id, array['owner','admin']::member_role[])
  );

-- Everything else is scoped to workspace membership. Write access additionally
-- requires an editing role so viewers cannot mutate content.
do $$
declare
  t text;
begin
  foreach t in array array[
    'social_accounts', 'media_assets', 'content_categories', 'posts',
    'schedule_slots', 'recycle_rules', 'automations', 'automation_events',
    'ai_generations', 'usage_counters', 'audit_log'
  ]
  loop
    execute format($f$
      create policy %1$s_read on public.%1$s
        for select using (
          public.is_workspace_member(workspace_id) or public.is_platform_admin()
        );
    $f$, t);

    execute format($f$
      create policy %1$s_write on public.%1$s
        for all using (
          public.has_workspace_role(
            workspace_id, array['owner','admin','editor']::member_role[]
          )
        )
        with check (
          public.has_workspace_role(
            workspace_id, array['owner','admin','editor']::member_role[]
          )
        );
    $f$, t);
  end loop;
end;
$$;

-- Child tables reach the workspace through their parent.
create policy post_media_read on public.post_media
  for select using (
    exists (
      select 1 from public.posts p
      where p.id = post_id and public.is_workspace_member(p.workspace_id)
    )
  );

create policy post_media_write on public.post_media
  for all using (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and public.has_workspace_role(
          p.workspace_id, array['owner','admin','editor']::member_role[]
        )
    )
  )
  with check (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and public.has_workspace_role(
          p.workspace_id, array['owner','admin','editor']::member_role[]
        )
    )
  );

create policy post_targets_read on public.post_targets
  for select using (
    exists (
      select 1 from public.posts p
      where p.id = post_id and public.is_workspace_member(p.workspace_id)
    )
  );

create policy post_targets_write on public.post_targets
  for all using (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and public.has_workspace_role(
          p.workspace_id, array['owner','admin','editor']::member_role[]
        )
    )
  )
  with check (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and public.has_workspace_role(
          p.workspace_id, array['owner','admin','editor']::member_role[]
        )
    )
  );

-- Billing --------------------------------------------------------------------
create policy subscriptions_read on public.subscriptions
  for select using (user_id = auth.uid() or public.is_platform_admin());

create policy licenses_read on public.licenses
  for select using (redeemed_by = auth.uid() or public.is_platform_admin());
