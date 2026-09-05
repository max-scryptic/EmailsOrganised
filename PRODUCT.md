# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is an individual professional working their own Gmail inbox —
a founder, consultant, or salesperson whose mail volume has outgrown manual
sorting. They are not an administrator configuring software for other people:
they build workflows for themselves, and they are the same person who later
lives with the results in their inbox.

The situation is recurring, not one-off. Mail keeps arriving; the user comes
back to adjust a workflow when it misfires or when a new kind of message starts
showing up.

## Product Purpose

EmailsOrganised turns inbox triage into workflows the user builds and can see.
A workflow starts from a trigger (by default, mail arriving in the primary
inbox), classifies each message with a prompt the user writes against output
labels the user names, and runs the actions on the branch the answer lands in —
forward, draft a reply, tag, or archive.

Success is a user who trusts what the workflow did without re-reading the
inbox to check.

## Positioning

Triage rules are a **visible workflow canvas**, not a hidden list of filters.
The user reads their own triage logic as a structure — trigger, classification
outputs, actions — and edits it in place. Competing inbox tools bury the same behaviour
in a settings list or behind an opaque model; the mechanism here is that the
logic is legible and directly manipulable.

## Operating Context

- Google is the only way in. One consent covers identity and mailbox access
  (`gmail.modify` — read, draft, send), so authorising the product and granting
  it the ability to do its job are a single step for the user.
- Work happens in the browser alongside Gmail, not instead of it. Actions land
  back in the user's real mailbox.
- Building a workflow is an act of describing intent in prose: the
  classification prompt and the names of its outputs are written by the user,
  not picked from a fixed taxonomy.
- The classification is one cheap GPT call per message. The user's output labels
  are not a suggestion to the model — they are the enum its answer is decoded
  against, so a workflow offering Sales / FAQ / Important can only ever be
  handed one of those three.
- A workflow has a lifecycle the user controls: `draft`, `live`, `paused`.

## Capabilities and Constraints

Confirmed and implemented:

- Workflow list and detail builder at `/workflows`, `/workflows/new`,
  `/workflows/[workflowId]`; workflows persist in `public.workflows`.
- Workflow vocabulary the UI must keep consistent: **workflow**, **trigger**,
  **classification** (its **prompt** and its **outputs**), **branch**,
  **action**, and the four action labels "Forward email", "Draft reply", "Tag
  email", "Archive". Status labels are "Live", "Paused", "Draft". An output is a
  setting of the classification node, not a node of its own — it is named in
  that node's panel and appears on the board as a branch.
- Classification runs through OpenAI, keyed by `OPENAI_API_KEY` and modelled by
  `OPENAI_CLASSIFIER_MODEL` (default `gpt-4o-mini`). The classification panel
  can run one against a sample email.
- Test mode on the builder: "Test workflow" arms the trigger node to listen to
  the connected mailbox (Gmail read only), and the first message to arrive
  after that starts a run the user steps through node by node, seeing each
  node's settings with `{{variables}}` resolved and the values it passes on. A
  test never writes to the mailbox — actions are described, not performed. The
  branch is picked by the same model call the workflow runs on, and the user can
  follow any other branch on demand to test it. A sample email stands in when no
  mailbox is connected; with no API key the run still steps, and says the branch
  is the user's choice rather than the model's.
- Actions carry their own settings — forward target, subject prefix, note,
  signature, include original thread, mark handled, draft instructions, draft
  tone, and an approval requirement on generated drafts.
- Google SSO through Supabase Auth. There are no password flows, and adding one
  would reverse a deliberate decision (see `AGENTS.md`).
- Settings and plans surfaces exist; billing runs through a swappable adapter
  with a keyless mock as the default.

Explicitly undecided — future work must not present these as settled:

- Whether the product ever serves shared or team mailboxes. Today it is
  single-user, and nothing in the UI should imply team seats.
- Billing: the plans and pricing surfaces are wired to a mock provider and the
  billing store is still in memory. No pricing shown today is a commitment.
- Marketing surfaces. There is no landing page, and no marketing claim has been
  agreed.

## Brand Commitments

- The product name is EmailsOrganised and is read from `appConfig` rather than
  typed into copy.
- The logo renders through `BrandMark` / `BrandLockup` in
  `src/components/brand-logo.tsx`. `--brand` is the brand orange, `--primary`
  resolves to it, and anything sitting on the brand orange is white
  (`primary-foreground`), never dark.

## Evidence on Hand

- Real, working product surfaces: the workflow builder, the workflow list, the
  settings and plans screens, `/kitchen-sink` for token QA.
- Real integration documentation in `docs/google-sso-setup.md`.
- Legal pages at `/legal/terms` and `/legal/privacy` exist because sign-up and
  Google's consent screen must link to them. They describe what the app really
  does but are an engineering draft, not lawyer-reviewed, and say so on their
  face.

Absent — future work must not fabricate these:

- No customers, testimonials, case studies, press, usage numbers, or
  benchmarks exist. The customers, metrics, and invoices in
  `src/lib/template-data.ts` are inherited template placeholders, not evidence.
- No agreed pricing.

## Product Principles

1. **The workflow is legible.** If the user cannot read what their triage will
   do before it runs, the surface has failed regardless of how it looks.
2. **The canvas is the centre of gravity.** `/workflows` is the product; every
   other surface exists to support returning to it.
3. **The user writes the intent.** The classification prompt and the names of
   its outputs are the user's own words. Do not replace that expressiveness with
   fixed categories.
4. **Automation is reversible and inspectable.** Draft, pause, approval before
   sending — the user stays able to stop and check.
5. **One consent, honestly scoped.** The product asks for mailbox access once
   and should never make that feel larger or vaguer than it is.

## Accessibility & Inclusion

No product-specific standard has been established beyond the repository's
existing convention that every async product view ships designed loading,
empty, and error states.
