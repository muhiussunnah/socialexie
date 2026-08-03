# Socialexie — auth email templates

Brand-custom HTML for every Supabase auth email. Paste each file's contents
into **Supabase → Authentication → Emails → Templates**, and set the matching
subject line below.

All links use the token-hash flow and point at `/auth/confirm`, which verifies
the token server-side (SSR-safe) before any protected page runs. The route lives
at `src/app/auth/confirm/route.ts`.

| Supabase template     | File                     | Subject line                              |
| --------------------- | ------------------------ | ----------------------------------------- |
| Confirm signup        | `confirm-signup.html`    | Confirm your email · Socialexie           |
| Reset password        | `reset-password.html`    | Reset your Socialexie password            |
| Magic Link            | `magic-link.html`        | Your Socialexie sign-in link              |
| Change Email Address  | `change-email.html`      | Confirm your new email · Socialexie        |
| Reauthentication      | `reauthentication.html`  | Your Socialexie verification code          |
| Invite user           | `invite.html`            | You're invited to Socialexie               |

## Required dashboard settings

**Authentication → URL Configuration**

- **Site URL:** `https://socialexi.app`
- **Redirect URLs (allow list):**
  - `https://socialexi.app/**`
  - `http://localhost:3000/**` (local development)

**Authentication → Emails → SMTP Settings** (custom SMTP via Resend — this is
what removes the built-in ~2–4/hour email cap)

- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: *Resend API key* (starts `re_…`) — paste in the dashboard
- Sender email: `noreply@socialexi.app` (requires the domain verified in Resend)
- Sender name: `Socialexie`

**Authentication → Rate Limits** (safe launch defaults once custom SMTP is on)

- Emails per hour: `100`
- Token verifications / OTP: leave default unless abuse appears

## Template variables used

- `{{ .SiteURL }}` — the configured Site URL
- `{{ .TokenHash }}` — hashed one-time token for the confirm route
- `{{ .Token }}` — 6-digit code (reauthentication only)
- `{{ .Email }}` / `{{ .NewEmail }}` — recipient / new address (email change)
