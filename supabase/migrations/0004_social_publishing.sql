-- ============================================================================
-- 0004 · Social OAuth token storage + publishing bookkeeping
-- ----------------------------------------------------------------------------
-- 0001 stored access_token / refresh_token in the clear on social_accounts, and
-- the blanket workspace-member SELECT policy exposes every column — so those
-- columns are dropped here and replaced with AES-256-GCM ciphertext that only
-- the Worker's SOCIAL_TOKEN_ENC_KEY can open. Column-level SELECT on the
-- ciphertext is revoked from anon/authenticated as belt-and-braces, so even the
-- encrypted blob never rides down to the browser. The dispatcher's retry
-- columns and the private "media" bucket are set up alongside.
--
-- Safe to run more than once.
-- ============================================================================

-- --- social_accounts: encrypted tokens + per-network publishing ids ---------
alter table public.social_accounts
  drop column if exists access_token,
  drop column if exists refresh_token;

alter table public.social_accounts
  add column if not exists access_token_enc  text,
  add column if not exists refresh_token_enc text,
  add column if not exists token_type        text,
  -- Page tokens, IG user id, LinkedIn author urn, YouTube channel id, etc.
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb;

-- Ciphertext is written by the service role only; no client ever needs to read
-- it, so pull SELECT on these columns out of the table-wide grant.
revoke select (access_token_enc, refresh_token_enc)
  on public.social_accounts from anon, authenticated;

-- --- post_targets: claim + retry bookkeeping --------------------------------
alter table public.post_targets
  -- When this target becomes eligible again; the cron only claims due rows.
  add column if not exists next_attempt_at timestamptz,
  -- Set when the cron flips a row to 'publishing' so a second run can't double-send.
  add column if not exists locked_at       timestamptz,
  add column if not exists last_attempt_at timestamptz,
  -- Scratch space for multi-step publishes (IG container id, TikTok publish_id).
  add column if not exists publish_state   jsonb not null default '{}'::jsonb;

-- The cron scans for pending targets whose backoff has elapsed; keep it narrow.
create index if not exists post_targets_due_idx
  on public.post_targets (next_attempt_at)
  where status = 'pending';

-- --- Media storage bucket ----------------------------------------------------
-- Private bucket. Uploads run under the service role; adapters fetch media via
-- short-lived signed URLs, so no object is ever world-readable.
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

-- Workspace members may read their own workspace's objects (path is
-- media/{workspace_id}/…); writes stay server-side under the service role.
drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects
  for select using (
    bucket_id = 'media'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );
