#!/usr/bin/env bash
#
# Environment setup for OpenAI Codex.
#
# Codex runs this once while it is building the container, when network access
# is still available. Anything the agent needs at task time has to be installed
# here: during a task the sandbox may have no network, so a later `npm ci`
# would fail with nothing to fall back on.
#
# Point the Codex environment's "setup script" at this file:
#
#     bash scripts/codex-setup.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing dependencies (npm ci)"
npm ci

# The app is designed to boot with no environment file at all: billing falls
# back to the mock provider and auth is UI-only. Seeding .env.local from the
# example is still worth doing so the real variable names are discoverable, and
# it is safe — the example ships NEXT_PUBLIC_BILLING_PROVIDER=mock and empty
# Stripe keys, so nothing tries to reach the network.
if [ ! -f .env.local ]; then
  echo "==> Seeding .env.local from .env.example"
  cp .env.example .env.local
fi

# Optional: uncomment to warm the Next.js build cache during setup instead of
# paying for the first compile inside a task. It makes setup noticeably slower,
# and a build failure here fails the whole environment build.
# npm run build

echo "==> Setup complete. Verify with: npm run lint && npm run build"
