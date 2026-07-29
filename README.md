# Socialexie

The control room for social growth — plan, generate and publish across every
network from one desk.

Socialexie is a multi-workspace social media management app: a scheduling queue
that fans one post out to eight networks under each network's own publishing
rules, an AI image studio, evergreen recycling, and compliant comment-to-DM
automation, with analytics on top.

## Stack

| Layer     | Choice                                                    |
| --------- | --------------------------------------------------------- |
| Framework | Next.js 16 (App Router, React 19, Server Components)      |
| Language  | TypeScript, `strict`                                      |
| Styling   | Tailwind CSS v4, CSS-variable design tokens               |
| Data      | Supabase (Postgres, Auth, Storage, row-level security)    |
| Schemas   | Zod                                                        |
| Dates     | `date-fns` + `@date-fns/tz` for per-workspace time zones  |
| Icons     | `lucide-react`                                            |
| Tests     | Vitest + Testing Library (jsdom)                          |

## Prerequisites

- Node.js 20.9 or newer (24.x is what this is developed against)
- npm 10+
- A Supabase project — optional for a first look, see [Demo mode](#demo-mode)

## Setup

```bash
git clone <your-remote> socialexie
cd socialexie
npm install
cp .env.example .env.local
npm run dev
```

The app comes up on <http://localhost:3000>. With no Supabase credentials in
`.env.local` it runs in demo mode; fill them in to run against real data.

### Environment

Every variable lives in `.env.example` with a comment. The ones that matter:

| Variable                        | Required | Purpose                                            |
| ------------------------------- | -------- | -------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | no       | Absolute URL for metadata and OAuth redirects       |
| `NEXT_PUBLIC_SUPABASE_URL`      | yes\*    | Supabase project URL                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes\*    | Supabase anon key — safe in the browser             |
| `SUPABASE_SERVICE_ROLE_KEY`     | yes\*    | Bypasses RLS. Server only. Never expose it          |
| `ADMIN_EMAILS`                  | no       | Comma-separated accounts allowed into `/admin`      |
| `OPENROUTER_API_KEY` and others | no       | AI providers; the router uses whatever is present   |

\* Required to leave demo mode. Validation is lazy on purpose — a missing key
only throws when a feature that needs it is actually used, so the marketing
pages render on a fresh clone with no `.env` at all.

### Database

Create a Supabase project, then run the schema against it:

```bash
# Supabase CLI, from the project root
supabase db push

# or paste the file into the SQL editor in the Supabase dashboard
```

The file is `supabase/migrations/0001_init.sql`. It creates the whole tenancy
model in one pass: `workspaces` and `workspace_members` at the root, then
`social_accounts`, `posts`, `post_targets`, `schedule_slots`, `recycle_rules`,
`automations`, `ai_generations`, `usage_counters`, `subscriptions`, `licenses`
and `audit_log` hanging off them.

Every table denies by default and is opened up by an explicit row-level
security policy keyed on workspace membership. Cross-tenant reads are only
possible for accounts listed in `platform_admins`.

## Demo mode

If `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are absent or
malformed, `isSupabaseConfigured()` returns false and the app degrades instead
of crashing:

- `src/proxy.ts` skips the session check entirely, so no route redirects to
  `/login` and the whole product is walkable.
- Dashboard screens read the fixtures in `src/lib/demo.ts`.
- Every screen showing sample data renders a "demo data" banner, so the numbers
  are never mistaken for real ones.

This is what makes a fresh clone explorable end to end without an account. It is
not a fallback for a misconfigured production deploy — check the banner is gone
before you call an environment live.

## Scripts

| Script              | What it does                                     |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Dev server with hot reload                       |
| `npm run build`     | Production build                                 |
| `npm start`         | Serve the production build                       |
| `npm run lint`      | ESLint                                           |
| `npm run typecheck` | `tsc --noEmit`                                   |
| `npm test`          | Vitest, single run                               |
| `npm run test:watch`| Vitest in watch mode                             |
| `npm run verify`    | typecheck, lint, test and build — run before a PR |

## Project structure

```
src/
  app/
    (app)/            Authenticated product shell — dashboard and friends
    (auth)/           Login and signup
    offline/          Service-worker fallback for a failed navigation
    pricing/          Public pricing page
    layout.tsx        Root layout, fonts, metadata, theme bootstrap
    globals.css       Design tokens and base layer
  components/
    app/              Product chrome — sidebar, topbar, charts
    marketing/        Landing-page sections
    ui/               Primitives: button, card, badge, field, segmented
  lib/
    plans.ts          Plan catalogue, limits and entitlement helpers
    platforms.ts      Per-network publishing rules and canvas presets
    env.ts            Lazy, validated environment access
    site.ts           Site metadata and the admin allow-list
    demo.ts           Fixtures for demo mode
    supabase/         Browser and server clients, generated types
  proxy.ts            Route protection (Next 16's middleware)
public/
  sw.js               Service worker
  manifest.webmanifest
  icons/              PWA icons
supabase/
  migrations/         SQL schema
tests/                Vitest suites
```

### Design tokens

Colour, radius and elevation are CSS variables declared in
`src/app/globals.css` and exposed to Tailwind through `@theme inline`. Use the
token classes (`bg-bg`, `text-fg`, `text-muted`, `border-line`, `rounded-card`,
`shadow-e2`) rather than raw palette values, so light and dark stay in step.

Amber is signal, teal is live. Channel colours (`text-ch-instagram` and so on)
identify a network and are never used as decoration.

### Platform rules

`src/lib/platforms.ts` is the single source of truth for what each network
accepts: caption limits, allowed formats, media counts, video duration bounds,
hashtag ceilings. The composer, the previews and the scheduler all read from it,
so "how long can an X post be" is answered in exactly one place.

## Progressive web app

The app installs. `public/manifest.webmanifest` declares a standalone display
mode starting at `/dashboard`, with shortcuts into the composer and the AI
studio.

`public/sw.js` is registered by `src/components/pwa-register.tsx` on `load`, in
production builds only. Its strategy:

- **Navigations** — network first, falling back to the last good copy of that
  page and then to `/offline`.
- **`/_next/static/*` and images** — stale while revalidate.
- **`/api/*`, `/auth/*`, anything carrying an `Authorization` header, and every
  non-`GET` request** — never cached, at all.

The cache name carries a version constant. Bump `CACHE_VERSION` in `sw.js`
whenever the worker changes; activation deletes every cache that does not match,
which is the only thing stopping a stale shell from outliving a deploy.

## Testing

```bash
npm test
```

Vitest runs in jsdom with `@testing-library/jest-dom` matchers loaded from
`vitest.setup.ts`, and resolves `@/*` to `src/*` the same way the app does.
Suites live in `tests/` and cover the pure logic that the rest of the product
trusts: plan pricing and entitlements, platform rules and canvas clamping,
formatting helpers, the admin allow-list and environment validation.

## Deployment

Vercel is the intended target.

1. Import the repository. The framework preset and build command are detected.
2. Add every variable from `.env.example` under **Settings → Environment
   Variables**. `SUPABASE_SERVICE_ROLE_KEY` must not be exposed to the browser —
   keep it out of any `NEXT_PUBLIC_` name.
3. Set `NEXT_PUBLIC_SITE_URL` to the production origin, and add that origin to
   the Supabase project's allowed redirect URLs.
4. Set `ADMIN_EMAILS` to the real operators. The development fallback in
   `src/lib/site.ts` is a convenience for local work, not a production default.

Security headers, caching and image formats are configured in `next.config.ts`
and apply on any host that honours Next's `headers()` output.

Run `npm run verify` before promoting a build.

## Security

- **Tenancy is enforced in the database.** Row-level security policies key every
  table on workspace membership, so a bug in application code cannot leak
  another tenant's rows. The service-role key is the only way around that and is
  never sent to the browser.
- **Admin access is an explicit allow-list.** `ADMIN_EMAILS` is read on the
  server only, matched case-insensitively after trimming.
- **Response headers** (`next.config.ts`): a Content Security Policy with
  `frame-ancestors 'none'`, `object-src 'none'` and `base-uri 'self'`; HSTS for
  two years with `includeSubDomains` and `preload`; `X-Content-Type-Options:
  nosniff`; `X-Frame-Options: DENY`; `Referrer-Policy:
  strict-origin-when-cross-origin`; `Cross-Origin-Opener-Policy: same-origin`;
  and a `Permissions-Policy` that switches off camera, microphone, geolocation
  and interest-cohort. `'unsafe-eval'` and the HMR websocket are gated on
  `NODE_ENV` and never ship to production.
- **The service worker never caches credentials.** API routes, auth routes and
  any request carrying an `Authorization` header bypass the cache entirely.
- **Secrets stay out of git.** `.env.local` is ignored; `.env.example` carries
  names and comments only.

Found a vulnerability? Report it privately rather than opening a public issue.
