-- ============================================================================
-- 0005 · Provision a workspace for every user
-- ----------------------------------------------------------------------------
-- Publishing is workspace-scoped (posts, social_accounts, targets all hang off
-- workspace_id), but sign-up only ever created a profile + subscription — never
-- a workspace. That left new accounts with nowhere to connect a channel or save
-- a post. This gives every user exactly one workspace they own: the trigger
-- handles new sign-ups, and the backfill covers everyone who joined earlier.
--
-- Safe to run more than once.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
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

  -- One owned workspace per user, created only if they don't already have one.
  if not exists (
    select 1 from public.workspace_members m where m.user_id = new.id
  ) then
    insert into public.workspaces (owner_id, name, slug)
    values (
      new.id,
      coalesce(nullif(split_part(new.email, '@', 1), ''), 'Workspace'),
      'w-' || replace(new.id::text, '-', '')
    )
    returning id into ws_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (ws_id, new.id, 'owner');
  end if;

  return new;
end;
$$;

-- Backfill: anyone without a workspace membership gets one now.
do $$
declare
  r record;
  ws_id uuid;
begin
  for r in
    select p.id, p.email
    from public.profiles p
    where not exists (
      select 1 from public.workspace_members m where m.user_id = p.id
    )
  loop
    insert into public.workspaces (owner_id, name, slug)
    values (
      r.id,
      coalesce(nullif(split_part(r.email, '@', 1), ''), 'Workspace'),
      'w-' || replace(r.id::text, '-', '')
    )
    on conflict (slug) do nothing
    returning id into ws_id;

    if ws_id is not null then
      insert into public.workspace_members (workspace_id, user_id, role)
      values (ws_id, r.id, 'owner')
      on conflict do nothing;
    end if;
  end loop;
end $$;
