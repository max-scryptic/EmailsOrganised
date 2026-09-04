<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# EmailsOrganised

EmailsOrganised is a Next.js product built on an in-house SaaS starter
template. The template layer is already here and already coherent — extend it
before introducing new component patterns.

## Commands

```bash
npm ci         # install exactly what package-lock.json pins
npm run dev    # dev server on http://localhost:3000
npm run lint   # eslint
npm run build  # next build --webpack
```

The app boots with no environment file: billing falls back to a mock provider
and route guarding is disabled, so `npm run dev` works on a clean checkout.
`scripts/codex-setup.sh` installs dependencies and seeds `.env.local` — it is
what the Codex environment's setup script runs, and it must stay the single
place setup logic lives so the sandbox and a laptop agree.

## UI Decisions

- Use Next.js App Router, TypeScript, Tailwind CSS v4, and shadcn/ui.
- Use semantic tokens from `src/app/globals.css` for foundational color,
  radius, and typography decisions.
- Do not use raw hex colors in product UI. Add semantic tokens first when a
  new brand or status color is needed.
- Render the logo through `BrandMark` / `BrandLockup` in
  `src/components/brand-logo.tsx`, and read the product name from `appConfig`
  rather than typing "EmailsOrganised" into copy. `--brand` is the brand
  orange and `--primary` resolves to it — keep using `primary` in components,
  and pair it with `primary-foreground`, which is white: anything sitting on
  the brand orange is white, never dark.
- Keep shadcn primitives in `src/components/ui` as owned source. Compose
  product-level components outside that folder.
- Use the app shell, form field wrapper, table, state components, and confirm
  dialog hook before creating one-off replacements.
- A workflow node's text settings take `{{variables}}` from the nodes before
  it. Build them with `VariableInput` / `VariableTextarea`
  (`src/components/workflows/variable-fields.tsx`) so the data panel can insert
  into them, and declare what a node outputs in
  `src/lib/workflow-variables.ts` — nowhere else.
- Every async product view should have designed loading, empty, and error
  states.
- Destructive actions should go through `useConfirmDialog` or
  `AlertDialog`, not a generic dialog.

## Auth

Auth is Supabase Auth with Google as the only provider. There are no password
flows — do not add one without a decision to reverse that.

- Ask "who is this?" through `requireUser()` / `getSessionUser()` in
  `src/lib/auth/session.ts`. Never read auth cookies or call
  `supabase.auth.getUser()` directly in a page or action.
- `src/proxy.ts` refreshes the session and redirects signed-out visitors. It is
  an optimistic UX shortcut, not the authorization boundary — `session.ts` is.
- The service-role client (`createAdminClient`) bypasses RLS. It is for the two
  writes a user is deliberately not allowed to make themselves, and it lives
  behind `import "server-only"` modules.
- Google refresh tokens go through `src/lib/google/token-store.ts` and nowhere
  else. Supabase hands them over exactly once, in the OAuth callback.
- Setup that lives outside the repo — Supabase project, Google Cloud OAuth
  client, Gmail scope verification — is in `docs/google-sso-setup.md`.

## Not Wired Up Yet

These are inherited from the template and are still open decisions for
EmailsOrganised.

- Billing ships two providers behind one interface, selected by
  `NEXT_PUBLIC_BILLING_PROVIDER`: a mock that needs no keys, and Stripe.
  Components import `billingAdapter` and the types in `src/lib/billing/types.ts`
  — never a provider SDK. Server-only billing modules start with
  `import "server-only"`.
- `src/lib/billing/customer.ts` now resolves the real signed-in user.
  `src/lib/billing/store.ts` is still in-memory and is the next seam to replace
  — it should move to Supabase alongside `public.users`.
- Marketing pages are intentionally not included. Add them after the app
  surface is clear.
- `/legal/terms` and `/legal/privacy` exist because sign-up and Google's OAuth
  consent screen both have to link to them. The copy describes what the app
  really does but is an engineering draft, not lawyer-reviewed — the pages say
  so on their face. Route paths and the contact address live in
  `src/lib/legal.ts`; change them there, not inline.
- Sample content in `src/lib/template-data.ts` (customers, metrics, invoices,
  plans) is still the template's, not EmailsOrganised's. Treat it as
  placeholder. `appConfig` is the exception — it carries the real brand.
- Use `/kitchen-sink` to QA token changes in both light and dark mode.
