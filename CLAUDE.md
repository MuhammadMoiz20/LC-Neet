@AGENTS.md

# Deployment: Mac Studio

A production-ish instance of this app runs on the Mac Studio (hostname `L7JX7HJLWF`, SSH alias `mac-studio`, user `moiz-dev`).

- Source checkout: `/Users/moiz-dev/Projects/LC-Neet`
- Started with: `pnpm exec next start -H 0.0.0.0 -p 3100` (i.e. served by `next start`, not `next dev`)
- Listens on: `0.0.0.0:3100` (reachable on the LAN at `http://mac-studio:3100`)
- Runtime: Node via pnpm; `next-server` reports v16.2.4

To redeploy after pushing changes: SSH in, `git pull` in `~/Projects/LC-Neet`, `pnpm install`, `pnpm build`, then restart the `next start` process. Note the local working copy uses npm; the Mac Studio copy uses pnpm.

A separate Math-Tutor app also runs on the same machine on port 8723 — leave it alone.
