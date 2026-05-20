# [WWW] llms.txt maintenance and regression checks

_Last updated: May 13, 2026_

This guide explains where `llms.txt` content lives, how to update it, and how to run regression checks so public LLM discovery files do not silently drift.

## Ownership and update expectations

- **Primary technical owner:** `app › 🌐 www` maintainers.
- **Content reviewers:** public website content owners for canonical page selection and descriptions.
- Every `llms.txt`/`llms-full.txt` change should be reviewed like other public SEO/discovery assets.

## Source of truth in the repo

- Route handler and content source: `apps/www/app/llms.txt/route.ts`
- `llms-full.txt` endpoint wiring (currently same content): `apps/www/app/llms-full.txt/route.ts`
- Regression test coverage: `apps/www/app/llms-routes.spec.ts`

## How to update `llms.txt` and `llms-full.txt`

1. Edit the `content` string in `apps/www/app/llms.txt/route.ts`.
2. Keep canonical absolute links on `https://www.gredice.com/...` for primary public pages.
3. Preserve clear section headings (`## Core Resources`, `## Company and Support`, `## Policies`) unless intentionally redesigning file structure.
4. If `llms-full.txt` should diverge in the future, replace the re-export route with a dedicated handler and add/adjust tests accordingly.

## Required regression checks

Run from repo root using existing targeted command flow:

```bash
pnpm lint --filter www
pnpm --filter www run test:llms
pnpm build --filter www
```

What `test:llms` validates:

- `/llms.txt` returns HTTP `200`
- `/llms-full.txt` returns HTTP `200`
- Both endpoints return `text/plain; charset=utf-8`
- Both responses include core section headings and key canonical links (without overfitting to copy text)

If any of these checks fail, treat it as a regression in public llms file support.
