---
name: EmailsOrganised
description: Inbox triage you can read — dense, calm product UI with one signal colour.
colors:
  signal-orange: "oklch(0.77 0.166 63)"
  signal-orange-dark: "oklch(0.8 0.163 63)"
  signal-glow: "oklch(0.77 0.166 63 / 0.4)"
  paper: "oklch(0.985 0 0)"
  surface: "oklch(1 0 0)"
  ink: "oklch(0.145 0 0)"
  ink-muted: "oklch(0.556 0 0)"
  hairline: "oklch(0.922 0 0)"
  quiet-fill: "oklch(0.965 0 0)"
  danger: "oklch(0.577 0.245 27.325)"
  affirm: "oklch(0.63 0.17 152)"
  caution: "oklch(0.74 0.15 75)"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: "2.25rem"
    letterSpacing: "normal"
  headline:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: "2rem"
    letterSpacing: "normal"
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: "1.75rem"
    letterSpacing: "normal"
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
    letterSpacing: "normal"
  control-sm:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 500
    lineHeight: "1.25rem"
    letterSpacing: "normal"
rounded:
  sm: "1.2px"
  md: "1.6px"
  lg: "2px"
  xl: "2.8px"
  2xl: "3.6px"
  3xl: "4.4px"
  4xl: "5.2px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  6: "24px"
components:
  button-primary:
    backgroundColor: "{colors.signal-orange}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "oklch(0.77 0.166 63 / 0.8)"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.quiet-fill}"
    textColor: "{colors.ink}"
  input-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "32px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "16px"
  badge-default:
    backgroundColor: "{colors.signal-orange}"
    textColor: "#ffffff"
    rounded: "{rounded.4xl}"
    padding: "2px 8px"
    height: "20px"
    typography: "{typography.label}"
  badge-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.4xl}"
    padding: "2px 8px"
    height: "20px"
---

# Design System: EmailsOrganised

## Overview

**Creative North Star: "The Quiet Workbench"**

EmailsOrganised looks like a workbench someone keeps tidy: a dense surface of
tools laid out exactly where they were left, in a grey so even it disappears,
with one warm orange reserved for the things you can act on. Nothing decorates.
Corners are cut almost square, separation is drawn with hairlines rather than
shadow, and controls sit at 32px because a person configuring triage rules is
scanning many of them at once, not admiring one.

The system is built for reading structure. A workflow is a trigger, a set of
outcomes, and the actions under each one — and the interface's whole job is to
make that shape legible at a glance. Density is therefore a feature, not a
compromise: tighter rows mean more of the structure is on screen at once. Weight
does the work that size would do in a marketing layout; the type scale is
narrow, and hierarchy comes from 500/600 weight and muted grey, not from jumps
between display sizes.

Colour is rationed. Grey is not a background the brand sits on top of — grey is
the system, and Signal Orange is an event inside it. That is why the accent
survives: it appears on the primary action, the live state, the selected node,
and essentially nowhere else. A screen where the orange has spread across
headings, icons, and decorative fills has broken the system even if every token
is technically correct.

**Key Characteristics:**

- Near-square corners (2px base radius) — crisp, drafted, not friendly-round
- Achromatic greys throughout; one chromatic accent, used sparingly
- Hairline rings and borders instead of shadows for separation
- 32px control height as the default rhythm; 14px body text
- Full light/dark parity — every colour is defined in both themes
- OKLCH throughout, so lightness edits stay perceptually honest

## Colors

An achromatic grey system with a single warm accent; the only other chromatic
values are the three status colours, and each earns its hue by meaning
something.

### Primary

- **Signal Orange** (`oklch(0.77 0.166 63)` light, `oklch(0.8 0.163 63)` dark):
  the brand orange, taken from the logo mark. It carries `--primary`, `--ring`,
  and `--sidebar-primary`, which is deliberate: the accent colour and the logo
  cannot drift apart. It appears on the primary button, the active nav item, the
  focus ring, live-state badges, and the selected workflow node. In dark mode it
  is nudged lighter so it keeps the same punch against the dark ground.
- **Signal Glow** (`oklch(0.77 0.166 63 / 0.4)` light, `/ 0.5` dark): the same
  orange at low alpha, for halos cast *around* a surface rather than painted on
  it. Its one use today is the breathing halo on the workflow canvas' first
  node.

### Neutral

- **Paper** (`oklch(0.985 0 0)`): the page ground. Slightly off-white so cards
  can be pure white and still separate.
- **Surface** (`oklch(1 0 0)`): cards, popovers, inputs, and the sidebar. Pure
  white in light mode; `oklch(0.205 0 0)` in dark.
- **Ink** (`oklch(0.145 0 0)`): primary text. Also the dark-mode page ground —
  the two themes are a straight inversion of the same two values.
- **Ink Muted** (`oklch(0.556 0 0)` light, `oklch(0.708 0 0)` dark): secondary
  text, descriptions, placeholders, and inactive icons. This is the workhorse of
  the hierarchy — most of what would be a smaller size elsewhere is muted grey
  here instead.
- **Hairline** (`oklch(0.922 0 0)` light, `oklch(1 0 0 / 10%)` dark): borders,
  dividers, and input strokes.
- **Quiet Fill** (`oklch(0.965 0 0)` light, `oklch(0.269 0 0)` dark): the
  secondary/muted/accent surface — hover fills, secondary buttons, table zebra.
  All three roles share one value on purpose; the system has one step of
  quietness, not three.

### Status

- **Danger** (`oklch(0.577 0.245 27.325)` light, `oklch(0.704 0.191 22.216)`
  dark): destructive actions and validation errors. Note the pattern: it is
  almost never a solid fill. Destructive buttons and badges are
  `bg-destructive/10` with destructive-coloured text, so the loudest colour in
  the system stays quiet until it is pressed.
- **Affirm** (`oklch(0.63 0.17 152)` light, `oklch(0.72 0.18 151)` dark): a
  completed or successful state.
- **Caution** (`oklch(0.74 0.15 75)` light, `oklch(0.78 0.16 77)` dark): a
  warning that is not yet an error. It sits close to Signal Orange in hue —
  keep them apart on the same screen, or the accent stops reading as the accent.

### Named Rules

**The Rationed Accent Rule.** Signal Orange appears on at most one primary
action per view, plus genuine live-state indicators. If a screen shows orange in
three unrelated places, two of them are wrong.

**The White-On-Orange Rule.** Anything sitting on Signal Orange is white
(`--primary-foreground`), in both themes, always. Dark text on the orange is
never correct.

**The No Raw Hex Rule.** Product UI uses semantic tokens. A new brand or status
colour is added to `src/app/globals.css` first, in OKLCH, in both `:root` and
`.dark`, and only then referenced.

## Typography

**Display Font:** system UI sans (`ui-sans-serif, system-ui, sans-serif`)
**Body Font:** the same stack — one family throughout
**Label/Mono Font:** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas`
for values that must align or be copied

**Character:** Deliberately unbranded. The system font is the fastest thing on
the user's machine and the most familiar shape in their OS, and this is an
operator's tool where legibility beats voice. Personality lives in the colour
and the spacing, not the letterforms. `--font-heading` exists as a separate
token and currently resolves to the same stack — the seam for a display face is
open, unused, and should stay unused unless someone decides otherwise.

### Hierarchy

- **Display** (600, 1.875rem/30px, responsive from 1.5rem): page titles in the
  app shell header at `sm` and up. The largest type in the product.
- **Headline** (600, 1.5rem/24px): page titles at mobile width, legal document
  titles, the workflow name in the builder header.
- **Title** (500–600, 1.125rem/18px): card titles, section headings, plan names.
- **Body** (400, 0.875rem/14px): the default. Nearly everything — table cells,
  form values, descriptions, canvas node text. Inputs render at 1rem below `md`
  to stop iOS zooming on focus, then drop to 0.875rem.
- **Label** (500, 0.75rem/12px): badges, table headers, helper text, metadata.
- **Control (sm)** (500, 0.8rem/12.8px): the one size that sits between Body and
  Label, used only by the 28px `sm` button so a compact control reads slightly
  smaller than body text without dropping to badge size. It is a control step,
  not a text step — do not use it for prose.

### Named Rules

**The Narrow Ramp Rule.** The scale runs 12 → 30px across the whole product.
Hierarchy is made with weight (400/500/600) and muted grey, not with size. A new
surface reaching for 40px+ type is importing a marketing habit into an operator
tool.

**The Muted Second Voice Rule.** Supporting text is `text-muted-foreground` at
the same size, not smaller black text. Shrinking below 12px is not an option
the system offers.

## Layout

A fixed left sidebar (16rem expanded, 3rem collapsed to icons, 18rem as a sheet
on mobile) beside a scrolling content column. Content is centred at `max-w-7xl`
(80rem) with a `gap-6` (24px) stack rhythm; the app shell also has a `fill`
mode that drops the max-width and tightens to `gap-3` (12px) so the workflow
canvas can claim the whole viewport.

Spacing runs on Tailwind's 4px base. The values actually in use are 4, 8, 12,
16, and 24px — cards set their internal padding through a `--card-spacing`
custom property (16px default, 12px at `size="sm"`) so header, content, and
footer stay in step without each restating the number.

Density is the default and it is intentional: 32px controls, 20px badges, 14px
body, 4px gaps inside grouped controls. Breakpoints follow Tailwind's defaults
(`sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536). The sidebar becomes a
sheet below `md`; the topbar search appears at `lg`; page titles step up a size
at `sm`.

**The One Column Rule.** Product views are a single centred column of stacked
sections. Multi-column dashboards are not part of this system — the workflow
canvas is the one surface allowed its own spatial model.

## Elevation & Depth

Flat by default. Separation comes from a hairline: cards use `ring-1
ring-foreground/10`, inputs and outline buttons use a 1px border in the
hairline grey, and the sidebar is divided from content by a border rather than
a drop shadow. Depth in the resting UI is conveyed by surface value alone —
Paper behind, Surface in front — which is why the two are only 1.5% apart in
lightness and still read as layered.

Shadow is reserved for the workflow canvas, where it means one specific thing:
*this floats above the canvas*. Floating toolbars, node editor popovers, the
add-node button, and selected nodes are the only places it appears.

### Shadow Vocabulary

- **Resting node** (`shadow-sm`): a node sitting on the canvas — just enough to
  lift it off the grid.
- **Selected node** (`shadow-md` + `ring-2 ring-primary/20`): selection is the
  ring; the shadow only supports it.
- **Floating panel** (`shadow-lg`): the canvas toolbar and the add-node button.
- **Canvas overlay** (`shadow-xl`): node editor popovers, which sit above
  everything else on the canvas.
- **Brand halo** (`box-shadow: 0 0 0 1px var(--brand-glow), 0 0 16px -6px
  var(--brand-glow)`, breathing to `30px -2px` over 3.6s): the first-node
  affordance on an empty canvas. It is behind `motion-safe:` with a static
  `motion-reduce:` fallback at the same colour.

### Named Rules

**The Depth-Belongs-To-The-Canvas Rule.** Outside the workflow canvas, surfaces
are flat and separated by hairlines. If a new component reaches for
`shadow-md`, the right answer is almost always a ring or a border.

**The Reduced-Motion Pair Rule.** Any animated depth ships its
`motion-reduce:` static equivalent in the same commit, at the same colour.

## Shapes

Corners are cut, not rounded. The base radius is `0.125rem` (2px) and the whole
scale is derived from it (`sm` 1.2px through `4xl` 5.2px), so even the softest
shape in the system is barely 5px. The effect is drafted rather than friendly:
edges look cut to a line, which suits a tool whose subject is precise rules.

Form language:

- Rectangles with hairline strokes are the default container.
- Buttons and inputs share `rounded-lg` (2px) and 32px height, so a button and
  a field sitting side by side line up exactly.
- Small controls clamp their radius (`rounded-[min(var(--radius-md),10px)]`) so
  shrinking a control never makes it proportionally rounder.
- Badges use the largest step (`rounded-4xl`, 5.2px) — noticeably softer than
  their neighbours, never a pill.
- The two genuinely circular things in the product are the avatar and the
  canvas' add-node button. Circles mean "this is an object, not a container".

**The Cut-Corner Rule.** Radius comes from the scale. A hard-coded
`rounded-full` or `rounded-2xl` in product UI is a bug unless the element is an
avatar or a canvas affordance.

## Components

### Buttons

Compact and quiet; the primary is the only one that raises its voice.

- **Shape:** near-square (2px radius), 32px tall by default (24px `xs`, 28px
  `sm`, 36px `lg`), horizontal padding 10px, 14px medium-weight label, 16px
  icons.
- **Primary:** Signal Orange fill, white label, hover to 80% opacity.
- **Outline:** Surface fill, hairline border, hover to Quiet Fill.
- **Secondary:** Quiet Fill, hover mixes 5% Ink in via `color-mix(in oklch, …)`
  rather than an opacity change.
- **Ghost:** transparent, hover to Quiet Fill. The default for icon buttons and
  anything in a toolbar.
- **Destructive:** `destructive/10` fill with Danger text — tinted, not solid.
- **Hover / Focus:** all transitions are `transition-all` with no duration
  override (150ms). Focus is a 3px `ring-ring/50` plus a border shift to the
  ring colour, never an outline removal without a replacement. Pressing shifts
  the button down 1px (`active:translate-y-px`), skipped on menu triggers.

### Inputs / Fields

- **Style:** Surface fill, hairline border, 2px radius, 32px tall, 10px
  horizontal padding. Dark mode fills at `input/30` instead of a flat surface.
- **Focus:** border shifts to the ring colour, plus a 3px `ring-ring/50` halo.
- **Error:** `aria-invalid` drives it — Danger border and a Danger-tinted ring.
  Errors are announced by state, not by a class the author remembers to add.
- **Disabled:** 50% opacity, `not-allowed` cursor, muted fill.

### Cards / Containers

- **Corner Style:** 2.8px (`rounded-xl`).
- **Background:** Surface, on the Paper page ground.
- **Shadow Strategy:** none — `ring-1 ring-foreground/10` (see Elevation).
- **Internal Padding:** 16px via `--card-spacing`, 12px at `size="sm"`; header,
  content, and footer all read the same property.
- Images bleed to the card's edge and inherit its corner rounding.

### Badges

- **Style:** 20px tall, 12px medium label, 8px horizontal padding, 5.2px radius,
  12px icons.
- **State:** `default` is Signal Orange with white text and is reserved for live
  or primary states; `secondary` is Quiet Fill; `outline` is a hairline border
  with no fill; `destructive` is a Danger tint. Workflow status uses
  default/secondary/outline for Live/Paused/Draft.

### Navigation

- **Sidebar:** Surface-coloured, 16rem, collapsing to a 3rem icon rail and to a
  sheet below `md`. Items are 14px, ghost-styled at rest, Quiet Fill on hover;
  the active item takes `sidebar-primary` (Signal Orange) with white text.
- **Topbar:** sidebar trigger, breadcrumbs, a borderless search field that
  appears at `lg`, theme toggle, and the user menu.
- **Breadcrumbs:** muted grey with an Ink-coloured current page.

### Workflow Canvas (signature component)

The product's one surface with its own spatial rules. Nodes are absolutely
positioned Surface cards with a hairline border, `rounded-md` (1.6px) and
`shadow-sm`; edges are drawn behind them and move with the node as it is
dragged. Selection is `border-primary` + `ring-2 ring-primary/20` +
`shadow-md`. An empty canvas offers a single node wearing the breathing Signal
Glow halo. Connector handles are 4px dots that grow to 24px and fill with Signal
Orange on hover or when open. Everything that floats — toolbar, add button,
editor popovers — uses the shadow ladder in Elevation and enters with
`animate-in fade-in-0 zoom-in-95` over 150ms.

**A node states its identity, not its configuration.** 252×60px, 12px
horizontal padding: a 36px tinted icon tile, one line of 14px medium-weight
title, and nothing else. The width is set by the longest node name sitting
beside the status badge a test run puts there — a node whose name truncates to
fit its own state has stopped stating its identity. Settings, summaries, and
counts belong in the node's
editor popover, which is where they can be changed. A node missing something it
cannot run without carries a single 14px Caution triangle at its right edge;
what is missing is named in the node's accessible label and fixed in its panel.

**The classification node is the one node that grows.** Below its title it
carries a 26px row per output label — the label name in 12px muted type, right
aligned, with that branch's connector dot on the node's edge — and 10px of
padding under the last one. Edges leave from those dots rather than from the
middle of the node, so the fan-out reads as one outlet per answer. With no
outputs the node still shows one row, reading "No outputs yet", so an unfinished
classification never looks finished.

## Do's and Don'ts

### Do:

- **Do** reach for a semantic token (`bg-card`, `text-muted-foreground`,
  `border-border`) before any literal value, and add the token to
  `globals.css` first when one is genuinely missing.
- **Do** define every new colour in both `:root` and `.dark`, in OKLCH.
- **Do** keep controls on the 32px rhythm so buttons, inputs, and selects align
  when they sit in a row.
- **Do** build hierarchy from weight and muted grey rather than from size.
- **Do** separate surfaces with `ring-1 ring-foreground/10` or a hairline
  border.
- **Do** pair every animation with a `motion-reduce:` fallback.
- **Do** render the logo through `BrandMark` / `BrandLockup` and read the
  product name from `appConfig`.
- **Do** give every async view a designed loading, empty, and error state, and
  route destructive actions through `useConfirmDialog` or `AlertDialog`.

### Don't:

- **Don't** put a raw hex value in product UI.
- **Don't** put dark text on Signal Orange, in either theme.
- **Don't** spread Signal Orange across headings, icons, or decorative fills —
  one primary action per view, plus true live states.
- **Don't** use shadow for separation outside the workflow canvas.
- **Don't** hard-code `rounded-full` or `rounded-2xl` in product UI; the radius
  scale is derived from `--radius` and avatars and canvas affordances are the
  only circles.
- **Don't** introduce a display typeface, a gradient, or a glassmorphic panel.
  The system is one system font, flat fills, and hairlines.
- **Don't** go below 12px type or above 30px in product UI.
- **Don't** replace a shadcn primitive in `src/components/ui` with a one-off;
  compose product components around it instead.
