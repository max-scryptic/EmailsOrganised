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
and auth is UI-only, so `npm run dev` works on a clean checkout.
`scripts/codex-setup.sh` installs dependencies and seeds `.env.local` — it is
what the Codex environment's setup script runs, and it must stay the single
place setup logic lives so the sandbox and a laptop agree.

## UI Decisions

- Use Next.js App Router, TypeScript, Tailwind CSS v4, and shadcn/ui.
- Use semantic tokens from `src/app/globals.css` for foundational color,
  radius, and typography decisions.
- Do not use raw hex colors in product UI. Add semantic tokens first when a
  new brand or status color is needed.
- Keep shadcn primitives in `src/components/ui` as owned source. Compose
  product-level components outside that folder.
- Use the app shell, form field wrapper, table, state components, and confirm
  dialog hook before creating one-off replacements.
- Every async product view should have designed loading, empty, and error
  states.
- Destructive actions should go through `useConfirmDialog` or
  `AlertDialog`, not a generic dialog.

## Not Wired Up Yet

These are inherited from the template and are still open decisions for
EmailsOrganised. Do not assume a backend exists.

- Auth is UI-only by design. Wire it to Clerk, Supabase, Auth.js, or another
  provider.
- Billing ships two providers behind one interface, selected by
  `NEXT_PUBLIC_BILLING_PROVIDER`: a mock that needs no keys, and Stripe.
  Components import `billingAdapter` and the types in `src/lib/billing/types.ts`
  — never a provider SDK. Server-only billing modules start with
  `import "server-only"`.
- The identity and persistence seams (`src/lib/billing/customer.ts` and
  `src/lib/billing/store.ts`) are the two files this project is expected to
  replace. Keep them small and provider-agnostic.
- Marketing pages are intentionally not included. Add them after the app
  surface is clear.
- Sample content in `src/lib/template-data.ts` is still the template's, not
  EmailsOrganised's. Treat it as placeholder.
- Use `/kitchen-sink` to QA token changes in both light and dark mode.
