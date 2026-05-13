# [WWW] llms.txt deployment validation log (GRE-338)

_Last updated: May 13, 2026_

This document captures deployment validation evidence for `llms.txt` and `llms-full.txt` in preview and production, plus crawler-policy compatibility checks tied to GRE-267.

## Validation matrix

| Environment | URL | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| Preview | `<preview-domain>/llms.txt` | `200` plain text | ⚠️ Blocked in agent environment | Preview host URL was not available in Linear issue context, and direct outbound `curl` to public hosts from this execution environment returned `403` at the proxy layer. |
| Preview | `<preview-domain>/llms-full.txt` | `200` plain text | ⚠️ Blocked in agent environment | Same limitation as above. |
| Production | `https://www.gredice.com/llms.txt` | `200` plain text | ⚠️ Blocked in agent environment | Direct outbound `curl` returned `403 Forbidden` before origin response, so response headers/body could not be validated from this runtime. |
| Production | `https://www.gredice.com/llms-full.txt` | `200` plain text | ⚠️ Blocked in agent environment | Same limitation as above. |

## Repository-level verification performed

Although external host validation is blocked from this runtime, repository inspection confirms the deployed behavior intended by GRE-338:

- `apps/www/app/llms.txt/route.ts` returns a plain-text response with explicit `Content-Type: text/plain; charset=utf-8` and cache headers.
- `apps/www/app/llms-full.txt/route.ts` re-exports the same `GET` handler as `llms.txt`, so both endpoints currently serve identical plain-text content.
- All links embedded in the current file content are absolute canonical URLs on `https://www.gredice.com/...` except the explicitly optional non-www public service hosts (`vrt.gredice.com`, `status.gredice.com`) that are intentional.

## Crawler/robots policy coordination (GRE-267)

- This validation task should be completed with a network-capable runner to confirm robots interactions live at:
  - `https://www.gredice.com/robots.txt`
  - `https://www.gredice.com/sitemap.xml`
- Any required policy update should be tracked as a linked follow-up under GRE-267.

## Follow-up execution plan

Run these commands from a network environment that can reach production and preview hosts directly:

```bash
curl -i https://www.gredice.com/llms.txt
curl -i https://www.gredice.com/llms-full.txt
curl -i https://www.gredice.com/robots.txt
curl -i https://www.gredice.com/sitemap.xml

# Repeat for the preview deployment URL
a=

curl -i "${a}/llms.txt"
curl -i "${a}/llms-full.txt"
```

Record:

- HTTP status codes
- `Content-Type`
- caching headers
- any redirect chain/canonical host normalization
- whether robots policy would block intended crawler access
