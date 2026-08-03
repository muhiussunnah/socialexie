-- ============================================================================
-- 0002 · Bring-your-own AI provider connections
-- ----------------------------------------------------------------------------
-- One row per (user, provider). Holds the workspace's own API key so generation
-- can spend the workspace's quota instead of the platform's shared keys. The
-- key is only ever read by the service role on the server; row-level security
-- keeps a user from reading anyone's connection but their own, and the key is
-- never sent to the browser (the UI shows a masked preview only).
--
-- Safe to run more than once.
-- ============================================================================

create table if not exists public.ai_connections (
  user_id             uuid not null references public.profiles(id) on delete cascade,
  provider            text not null
    check (provider in ('openrouter', 'google', 'openai', 'anthropic')),
  api_key             text,
  enabled             boolean not null default true,
  default_text_model  text,
  default_image_model text,
  status              text not null default 'not_tested'
    check (status in ('not_tested', 'connected', 'error')),
  last_tested_at      timestamptz,
  last_error          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.ai_connections enable row level security;

-- A user owns exactly their own connections; platform admins may read for support.
drop policy if exists ai_connections_read on public.ai_connections;
create policy ai_connections_read on public.ai_connections
  for select using (user_id = auth.uid() or public.is_platform_admin());

drop policy if exists ai_connections_write on public.ai_connections;
create policy ai_connections_write on public.ai_connections
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists ai_connections_updated_at on public.ai_connections;
create trigger ai_connections_updated_at
  before update on public.ai_connections
  for each row execute function public.set_updated_at();
