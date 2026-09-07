# Headshot AI Admin — Visual QA Report

**Date:** 2026-09-05  
**App:** Next.js admin at `http://localhost:3001`  
**API:** Fastify at `http://127.0.0.1:3000/v1`  
**Design source:** `.design/` (38 PNG references)

## Summary

All **19 required pages** are implemented on the existing Next.js admin app. Shared shell (256px sidebar, 64px header), design tokens, and light/dark themes persist via `headshot-admin-theme`. Charts are Recharts (not images). Tables scroll inside their own containers with hidden scrollbars. API key generate / rotate / revoke is intact.

| Check | Status |
| --- | --- |
| 19 pages implemented | Pass |
| Routes resolve | Pass |
| Light + dark tokens | Pass |
| Shared sidebar + header | Pass |
| Theme persistence | Pass |
| Hidden scrollbars | Pass |
| Charts resize with layout | Pass |
| Page-level horizontal overflow (390px API Keys) | Pass (`scrollWidth === clientWidth`) |
| Screenshot archive | Pass — 117 files under `qa/screenshots/` |

## Pages

| # | Page | Route | Light | Dark | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Login | `/login` | Pass | Pass | Split branding + form; black Sign in (light), pale-blue Sign in (dark) |
| 2 | Dashboard / Overview | `/` | Pass | Pass | Stat cards, line + donut + bar, job health, activity |
| 3 | Users | `/users` | Pass | Pass | Filters, selection bar, badges, pagination |
| 4 | User Detail | `/users/[uid]` | Pass | Pass | Emma Wilson tabs: Overview / Wallet / Subscription / Purchases / Activity |
| 5 | Credits / Wallet | `/credits` | Pass | Pass | Area + donut + credit rules + wallet table |
| 6 | Purchases / Transactions | `/transactions` | Pass | Pass | Combo + donut + purchase table |
| 7 | Subscriptions | `/subscriptions` | Pass | Pass | Line + plan mix + subscriber table |
| 8 | Headshots / Generations | `/headshots` | Pass | Pass | Combo + provider split + job table |
| 9 | Generation Job Detail | `/headshots/[jobId]` | Pass | Pass | Preview + metadata + timeline |
| 10 | Branding Analysis | `/branding` | Pass | Pass | Line + analysis table |
| 11 | Profile Reviews | `/reviews` | Pass | Pass | Line + photos donut + review table |
| 12 | Projects / Library | `/projects` | Pass | Pass | Grid/list toggle + storage bar |
| 13 | Notifications | `/notifications` | Pass | Pass | Line + type donut + All/Unread/Read |
| 14 | FCM / Notification Management | `/fcm` | Pass | Pass | Compose / Tokens / History + preview |
| 15 | AI Usage / Analytics | `/ai-usage` | Pass | Pass | Combo + donut + bars + latency line |
| 16 | AI Jobs | `/jobs` | Pass | Pass | Queue tabs + merged job table |
| 17 | Webhooks / Events | `/webhooks` | Pass | Pass | Volume chart + event table |
| 18 | Remote Config / Settings | `/remote-config` | Pass | Pass | Editable flags + Publish |
| 19 | API Keys / Token Management | `/api-keys` | Pass | Pass | Stats, traffic, health, tabs, filters, generate once |

## Verification rounds

Each page folder contains:

- `{light,dark}-round-1.png` — structure
- `{light,dark}-round-2.png` — visual details after fixes
- `{light,dark}-final.png` — post-fix archive

Extra responsive captures:

- `login/light-mobile.png` — 390×844
- `users/light-tablet.png` — 768×1024
- `api-keys/light-mobile.png` — 390×844

Desktop verification used **1440×1024**. Tablet hides the full sidebar (hamburger + drawer). Mobile stacks cards and keeps table overflow inside `.scrollable`.

## Fixes applied during QA

1. Sidebar content offset (`spacing.sidebar`) so main content does not sit under the nav.
2. Sidebar footer stays visible (`min-h-0` on the nav scroller).
3. Empty live API lists no longer wipe design-matching mock rows.
4. Small-sample stat cards use design totals instead of `1` / `0` from a sparse local DB.
5. API Keys stats use live counts when present and design fallbacks for traffic volume.
6. Login matches light (black CTA, light branding pane) and dark (hashed form card, `#DBEAFE` CTA).
7. Combo charts use Recharts `ComposedChart`.

## Known residual differences vs `.design`

- Login branding uses gradient portrait placeholders (no licensed headshot assets in-repo).
- Logo is an “H” mark, not the illustrated face glyph from some screenshots.
- Live API-key names/counts differ from the mock “7 / 42.8K / 2 / 4” when real keys exist.
- Combo “cost” series shares the usage Y-axis so the line stays near the baseline.
- Header date-range control is on Overview only; other list pages use static range labels.

## How to review

```text
qa/screenshots/<page>/{light,dark}-{round-1,round-2,final}.png
```

Admin: `npm run dev --workspace=admin` (port 3001)  
API: `npm run dev` (port 3000)
