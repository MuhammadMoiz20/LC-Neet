# LC-Neet

Personal NeetCode 150 trainer with AI coach. Built with Next.js, SQLite, and the Anthropic Agent SDK.

See `docs/plans/2026-04-25-leetcode-neetcode-clone-design.md` for the full design.

## Setup

```bash
npm install
cp .env.local.example .env.local   # then fill in AUTH_SECRET (any 32-byte hex)
npx tsx scripts/create-user.ts you@example.com yourpassword
npm run dev
```

Visit `http://localhost:3000` and sign in.

## Scripts

- `npm run dev` — start app
- `npm run build` — production build
- `npm run seed` — re-seed problems (also runs automatically on server boot)
- `npm test` — unit tests (Vitest)
- `npm run e2e` — end-to-end tests (Playwright)
- `npx tsx scripts/create-user.ts <email> <password>` — create a user

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- NextAuth v5 (credentials provider)
- SQLite via better-sqlite3
- Vitest + Playwright
- (coming) Pyodide for in-browser Python execution
- (coming) Anthropic Agent SDK for the AI coach

## Status

Step 1 of build complete: skeleton, auth, DB, problem catalog (3 of 150 seeded). See the design doc for the rest.
