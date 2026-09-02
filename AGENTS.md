<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Base SaaS Template Rules

This repository is a reusable SaaS starter. Prefer extending the existing
template layer before introducing new component patterns.

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

## Template Boundaries

- Auth is UI-only by design. Wire it to Clerk, Supabase, Auth.js, or another
  provider per project.
- Billing ships two providers behind one interface, selected by
  `NEXT_PUBLIC_BILLING_PROVIDER`: a mock that needs no keys, and Stripe.
  Components import `billingAdapter` and the types in `src/lib/billing/types.ts`
  — never a provider SDK. Server-only billing modules start with
  `import "server-only"`.
- The identity and persistence seams (`src/lib/billing/customer.ts` and
  `src/lib/billing/store.ts`) are the two files a new project is expected to
  replace. Keep them small and provider-agnostic.
- Marketing pages are intentionally not included. Add project-specific
  marketing after the app surface is clear.
- Use `/kitchen-sink` to QA token changes in both light and dark mode.
