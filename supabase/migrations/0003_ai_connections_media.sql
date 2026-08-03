-- ============================================================================
-- 0003 · Widen AI connections for image + video providers
-- ----------------------------------------------------------------------------
-- Adds the media vendors (fal.ai, Replicate, Hugging Face, ImageRouter) to the
-- allowed provider list and a per-provider default video model, so one row can
-- carry a workspace's text, image and video preferences for a provider.
--
-- Safe to run more than once.
-- ============================================================================

alter table public.ai_connections
  drop constraint if exists ai_connections_provider_check;

alter table public.ai_connections
  add constraint ai_connections_provider_check
  check (provider in (
    'openrouter', 'google', 'openai', 'anthropic',
    'fal', 'replicate', 'huggingface', 'imagerouter'
  ));

alter table public.ai_connections
  add column if not exists default_video_model text;
