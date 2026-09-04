# Google SSO setup

Everything the code cannot do for itself. The app is wired for Supabase Auth
with Google as the only identity provider, and it requests Gmail access in the
same consent screen so one grant covers both signing in and working the mailbox.

Work through the four sections in order. Sections 1–3 take about half an hour.
Section 4 is the long pole and should be started early — see the warning there.

---

## 1. Supabase project

1. Create a project in the **EmailsOrganised** organisation.
2. Apply every file in `supabase/migrations/`, oldest first — via
   `supabase db push`, or by pasting each one into the SQL editor. Do this
   again whenever a migration is added: a table that exists in the repo but
   not in the project fails at request time, not at build time.
3. From **Project Settings → API Keys**, copy into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` — `https://<project-ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the `sb_publishable_...` key
   - `SUPABASE_SECRET_KEY` — the `sb_secret_...` key, revealed on click

   The secret key bypasses RLS. Keep it server-side and never give it a
   `NEXT_PUBLIC_` prefix, which would inline it into the browser bundle.

   Supabase's older JWT-based keys still work if a project has them:
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are read as
   fallbacks, so either generation of key is fine.
4. Under **Authentication → URL Configuration**, set:
   - Site URL: `https://<production-domain>`
   - Redirect URLs: `http://localhost:3000/**` and `https://<production-domain>/**`

## 2. Google Cloud OAuth client

In the [Google Cloud console](https://console.cloud.google.com/), in a project
dedicated to EmailsOrganised:

1. **APIs & Services → Library** → enable the **Gmail API**.
2. **APIs & Services → OAuth consent screen**:
   - User type **External**
   - App name, support email, logo, developer contact
   - **Authorised domains**: your production domain, and `supabase.co`
   - Links to a published privacy policy and terms of service — Google will not
     verify the app without them. The app serves both at `/legal/privacy` and
     `/legal/terms`; paste those production URLs here. The copy is an
     engineering draft and still needs a legal review before verification.
3. **Credentials → Create credentials → OAuth client ID → Web application**:
   - **Authorised JavaScript origins**: `http://localhost:3000`, your production origin
   - **Authorised redirect URI**: `https://<project-ref>.supabase.co/auth/v1/callback`

     This is the *Supabase* callback, not the app's. Supabase completes the
     Google exchange and then redirects to `/auth/callback` in the app, which is
     configured in step 1.4 rather than here.
4. Copy the client ID and secret into `.env.local` as `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`. The app needs its own copy to refresh Gmail tokens —
   Supabase only refreshes its own session, never the Google one.

## 3. Enable the provider in Supabase

**Authentication → Sign In / Providers → Google**: enable it and paste the same
client ID and secret.

Leave "Skip nonce check" off. Do not enable any other provider — `proxy.ts`
and the sign-in page assume Google is the only way in.

## 4. Google verification (start this now)

The app asks for `https://www.googleapis.com/auth/gmail.modify`, which covers
reading messages, creating and updating drafts, and sending. It is a
**restricted** scope, and Google gates it:

- **Until verified**, the OAuth consent screen stays in *Testing*, capped at
  **100 named test users**, and every user sees an "unverified app" warning.
- **Refresh tokens issued by a Testing-mode app expire after 7 days.** Users
  will silently lose mailbox access weekly and have to re-consent. This is the
  single most disruptive constraint on the pre-launch period, and it is not a
  bug in this code — `getGoogleAccessToken` marks the credential revoked and
  returns null, and the settings page shows "Not connected".
- **Verification** requires the consent-screen material above plus a demo video
  and, for restricted scopes, an annual **CASA security assessment** by a
  third-party assessor. Budget weeks, not days, and a real cost.

Nothing in the app changes when verification completes; the same client ID
simply stops being rate-limited.

If that timeline is a problem, the alternative is to ship sign-in on identity
scopes only (`openid email profile`, no verification needed) and add mailbox
access later as a separate consent. That is a one-line change: drop
`GMAIL_SCOPES` from `GOOGLE_SCOPES` in `src/lib/auth/scopes.ts`.

---

## How the pieces fit

| Concern | File |
| --- | --- |
| Scopes requested at consent | `src/lib/auth/scopes.ts` |
| Start the OAuth flow, sign out | `src/lib/auth/actions.ts` |
| "Who is this?" for all server code | `src/lib/auth/session.ts` |
| OAuth callback, token capture | `src/app/(auth)/auth/callback/route.ts` |
| Session refresh + route guard | `src/proxy.ts` |
| Supabase clients | `src/lib/supabase/` |
| Google token storage and refresh | `src/lib/google/token-store.ts` |
| Schema | `supabase/migrations/` |

### Why the callback stores tokens itself

Supabase returns `provider_token` and `provider_refresh_token` **only** in the
session from `exchangeCodeForSession`, and never persists them. If the callback
does not capture the refresh token, the only way to get it back is to send the
user through consent again. Hence `storeGoogleCredentials` running there, and
`access_type=offline` + `prompt=consent` on the authorize request — without
both, Google returns an access token with no refresh token on repeat sign-ins.

### Why `google_credentials` has no RLS policies

RLS is enabled and no policy exists, and `anon`/`authenticated` have no grants.
A request carrying a user JWT therefore sees zero rows and can write none; only
the service role reaches the table. The user-visible status lives on
`public.users.gmail_connected_at` instead, which they can read under RLS.

Tokens are stored as plaintext columns in a table nobody but the service role
can reach. If you later want defence-in-depth against a database dump, move
`refresh_token` into Supabase Vault — the read/write path is confined to
`src/lib/google/token-store.ts`, so it is a single-file change.

## Local development

```bash
cp .env.example .env.local   # fill in the Supabase and Google values
npm run dev
```

With an empty `.env.local` the app still boots: `isSupabaseConfigured` is false,
Proxy stops guarding routes, and `/auth/sign-in` renders a configuration notice
instead of a broken Google button.
