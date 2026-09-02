# EmailsOrganised

Built with Next.js App Router, Tailwind CSS v4, TypeScript, and shadcn/ui,
starting from an in-house SaaS template.

The starting point focuses on product UI and conventions rather than a
marketing site. Auth and billing arrive UI-only, so this project can pick its
providers without unpicking backend assumptions first. The rest of this file
documents what came with the template and how to wire each piece up.

## Agent setup

`AGENTS.md` holds the repo conventions and is read by both Codex and Claude
Code (`CLAUDE.md` just imports it). `scripts/codex-setup.sh` is the setup
script for the Codex environment — it runs `npm ci` and seeds `.env.local`.

## Included

- Semantic light/dark design tokens in `src/app/globals.css`
- shadcn/ui primitives in `src/components/ui`
- Responsive app shell with sidebar, topbar, breadcrumbs, search, and user menu
- Auth screens for sign in, sign up, forgot password, reset password, change
  password, verify
- Settings layout with user, billing, payments & invoices, and appearance tabs,
  covering usage meters, invoices, and payment method UI
- `/plans` route with selectable plan cards, upgrade/downgrade summary, and a
  confirmed save flow through a swappable billing adapter
- Stripe integration behind an environment flag: Checkout, subscription
  updates, the customer portal, and a signature-verified webhook
- TanStack-powered `DataTable` with sorting, filtering, pagination, selection,
  column visibility, and row actions
- `TemplateFormField` wrapper for react-hook-form + zod validation
- Empty, loading, and error state components
- Promise-based destructive confirmation hook
- `/kitchen-sink` route for visual QA

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

No environment file is needed to start: auth and billing fall back to mocks.
Copy `.env.example` to `.env.local` when wiring a real provider.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Useful routes:

- `/` dashboard
- `/plans`
- `/settings`
- `/auth/sign-in`
- `/auth/sign-up`
- `/auth/forgot-password`
- `/auth/reset-password`
- `/auth/change-password`
- `/auth/verify`
- `/kitchen-sink`

## Auth Adapter

Auth screens submit through `src/lib/auth/auth-adapter.ts`. The adapter is
mocked for now so the template can show complete loading, validation, success,
and error states without choosing a backend too early.

The methods are intentionally shaped around Supabase Auth:

```ts
supabase.auth.signInWithPassword({ email, password })
supabase.auth.signUp({ email, password, options: { emailRedirectTo } })
supabase.auth.resetPasswordForEmail(email, { redirectTo })
supabase.auth.updateUser({ password })
supabase.auth.updateUser({ password, current_password })
```

When a project chooses Supabase, install pinned versions of `@supabase/supabase-js`
and `@supabase/ssr`, keep the service-role key out of browser code, configure
the dashboard redirect URLs for `/auth/reset-password`, and move mutations into
server actions or framework-native Supabase clients.

## Billing

Billing has two implementations behind one interface. Which one runs is decided
by `NEXT_PUBLIC_BILLING_PROVIDER`, so a project turns real billing on by adding
environment variables rather than by rewriting UI.

- `mock` (default) — no keys, no network. `/plans` and `/settings` show their
  full loading, success, and error states out of the box.
- `stripe` — Checkout, in-place subscription updates, the customer portal, and a
  signature-verified webhook.

### Layout

| Path | Role |
| --- | --- |
| `src/lib/billing/types.ts` | Provider-neutral contracts. The only billing types the UI sees. |
| `src/lib/billing/config.ts` | Client-safe config: which provider, which routes, which return paths. |
| `src/lib/billing/billing-adapter.ts` | Picks the provider. What components import. |
| `src/lib/billing/providers/` | `mock-provider.ts` and `stripe-provider.ts`. |
| `src/lib/billing/server.ts` | `getSubscription()` for server components. |
| `src/lib/billing/customer.ts` | The auth ↔ billing seam. Wire your auth provider here. |
| `src/lib/billing/store.ts` | The persistence seam. Replace the in-memory default. |
| `src/lib/billing/stripe/` | Server-only Stripe code: env, client, service, mapping. |
| `src/app/api/billing/` | `checkout`, `portal`, and `webhook` route handlers. |

Nothing under `src/lib/billing/stripe/` or `store.ts`/`customer.ts` can be
imported from a client component: they start with `import "server-only"`, which
turns that mistake into a build error rather than a leaked secret key.

### Turning Stripe on

1. Create the products and **recurring** prices in the Stripe dashboard, one per
   self-serve plan in `plans` in `src/lib/template-data.ts`.
2. `cp .env.example .env.local` and fill in `STRIPE_SECRET_KEY`, the
   `STRIPE_PRICE_*` ids, and `NEXT_PUBLIC_APP_URL`.
3. Set `NEXT_PUBLIC_BILLING_PROVIDER=stripe`.
4. Forward webhooks locally and copy the printed signing secret into
   `STRIPE_WEBHOOK_SECRET`:

   ```bash
   stripe listen --forward-to localhost:3000/api/billing/webhook
   ```

5. In production, create the endpoint in the dashboard pointing at
   `https://your-domain/api/billing/webhook` and subscribe it to
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`, and
   `invoice.payment_failed`.

Test cards live at [docs.stripe.com/testing](https://docs.stripe.com/testing);
`4242 4242 4242 4242` with any future expiry completes a checkout.

### How a plan change flows

A customer with no subscription goes to hosted Checkout. A customer who already
subscribes has their existing subscription item swapped in place, so an upgrade
never bounces them through a second checkout. Both directions settle on the next
invoice — an upgrade adds a charge for the remainder of the period, a downgrade
adds a credit. To hold a downgrade until the period boundary instead, replace the
`proration_behavior` call in `src/lib/billing/stripe/service.ts` with a
[subscription schedule](https://docs.stripe.com/billing/subscriptions/subscription-schedules).

The browser never learns which path it took: the route returns either a URL to
redirect to or an `applied` result, and `BillingResult.outcome` tells the UI
whether the plan really changed.

### The two seams to wire

**Identity.** `resolveBillingIdentity()` in `src/lib/billing/customer.ts` returns
the template user. Point it at your auth provider — with Supabase:

```ts
const supabase = await createServerClient();
const { data } = await supabase.auth.getUser();
if (!data.user) throw new UnauthenticatedBillingError();
return { userId: data.user.id, email: data.user.email!, name: data.user.user_metadata.name };
```

**Persistence.** `billingStore` in `src/lib/billing/store.ts` is an in-memory map.
It is enough to click through the whole flow locally, but it resets on restart
and is not shared between serverless instances. Stripe stays the source of truth
either way — a cold store falls back to looking the customer up in Stripe — but
that costs an API call on every render, so give it a real table before launch:

```sql
create table billing_customers (
  user_id uuid primary key references auth.users on delete cascade,
  stripe_customer_id text unique not null,
  created_at timestamptz not null default now()
);

create table billing_subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text unique not null,
  plan_id text not null,
  status text not null,
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table billing_customers enable row level security;
alter table billing_subscriptions enable row level security;

create policy "own subscription" on billing_subscriptions
  for select using (auth.uid() = user_id);
```

Then implement `BillingStore` against those tables. Write with the service-role
key from the webhook — it runs without a user session — and keep row-level
security on so the browser can only read its own row. Never let the client write
these tables; the webhook is the only writer.

### Adding a plan

1. Add it to `plans` in `src/lib/template-data.ts`.
2. Add its price env var to `priceEnvNames` in `src/lib/billing/stripe/env.ts`
   and to `.env.example`.
3. Create the price in Stripe and set the variable.

Sales-led plans (`contactSales: true`) need no price: the checkout route rejects
them, and `requestSalesContact` is where the CRM or scheduling handoff goes.

### Before launch

- Replace the in-memory store and the template identity.
- Confirm the webhook endpoint is registered in live mode with its own signing
  secret — test and live secrets differ.
- Set `NEXT_PUBLIC_APP_URL` to the deployed origin, or Checkout will send
  customers back to `localhost`.
- Decide what an unpaid account loses. `invoice.payment_failed` in the webhook is
  where dunning starts.

## Template Rules

- Treat `src/components/ui` as vendored shadcn source.
- Put reusable product compositions in `src/components`.
- Use semantic tokens instead of hardcoded palette classes for app surfaces.
- Keep every async view covered by loading, empty, and error states.
- Use `AlertDialog` or `useConfirmDialog` for destructive actions.
- Keep components on the provider-neutral billing types; never import a provider
  SDK outside `src/lib/billing/<provider>/`.
- Mark every server-only billing module with `import "server-only"`.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```

## Rebranding

Still carrying the template's identity. To make it EmailsOrganised, change:

- `metadata` in `src/app/layout.tsx`
- Brand name in `appConfig` and sample data in `src/lib/template-data.ts`
- Brand logo in `src/components/app-branding.tsx`
- Semantic tokens in `src/app/globals.css`
