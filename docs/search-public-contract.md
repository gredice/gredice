# Public search contract and entity scope (GRE-363)

## Purpose

Define the **v1 public search contract** for Gredice so backend (`apps/api` + `packages/storage`) and frontend (`apps/www`) can implement PostgreSQL-backed search without ambiguity.

This document is intentionally reusable across `www`, `garden`, `app`, and `farm`: the response includes app-agnostic search fields first, with optional display helpers.

## Must-use technology

- Search implementation **must use PostgreSQL Full Text Search (FTS)**.
- Do **not** introduce Elasticsearch, Meilisearch, Algolia, Typesense, or other external search providers for this scope.

## API contract (v1)

### Request

`GET /api/search/public`

Query params:

- `q` (string): user search query.
- `category` (string, optional): selected filter slug (`all`, `plants`, `operations`, `blocks`, `sorts`).
- `page` (number, optional, default `1`).
- `limit` (number, optional, default `20`, max `50`).

### Response shape

```ts
type PublicSearchResponse = {
  query: {
    text: string;
    normalizedText: string;
    minQueryLength: number;
    category: SearchCategorySlug;
    page: number;
    limit: number;
  };
  results: PublicSearchResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
  facets: {
    categories: Array<{
      slug: SearchCategorySlug;
      label: string;
      count: number;
    }>;
  };
  meta: {
    execution: 'postgres-fts';
  };
};

type PublicSearchResult = {
  id: number;
  entityType: PublicSearchEntityType;
  category: SearchCategorySlug;
  categoryLabel: string;
  title: string;
  summary: string | null;
  href: string;
  image: {
    src: string;
    alt: string | null;
  } | null;
  score: number;
  rank: number;
  matchedFields?: string[];
};
```

### Field semantics

- `id`: directory entity id.
- `entityType`: source dictionary entity type (for downstream reuse).
- `category`/`categoryLabel`: UX filter grouping.
- `title`: canonical display name.
- `summary`: short snippet/description for cards and no-results fallback context.
- `href`: canonical public URL for `www`.
- `image`: optional lead image metadata when available.
- `score`: raw numeric relevance from PostgreSQL ranking.
- `rank`: stable 1-based position in current page.
- `matchedFields`: optional debug or highlighting support (e.g. `name`, `description`, `latinName`).

## Supported v1 category filters (www)

| Slug | Croatian label | Includes entity types |
| --- | --- | --- |
| `all` | Sve | All included public types |
| `plants` | Biljke | `plant` |
| `operations` | Radnje | `operation` |
| `blocks` | Blokovi | `block` |
| `sorts` | Sorte | `plantSort` |

Notes:

- Initial header/search page can show these filters in the order above.
- Additional groups can be added later without breaking the base contract.

## Public searchable entity scope (day one)

Included entity types are limited to types with stable public routes in `apps/www/src/KnownPages.ts`.

| Entity type | Category | Canonical href strategy | Included in v1 |
| --- | --- | --- | --- |
| `plant` | `plants` / Biljke | `/biljke/{alias}` | ✅ |
| `operation` | `operations` / Radnje | `/radnje/{alias}` | ✅ |
| `block` | `blocks` / Blokovi | `/blokovi/{alias}` | ✅ |
| `plantSort` | `sorts` / Sorte | `/biljke/{plantAlias}/sorte/{sortAlias}` | ✅ |

### Generated dictionary types excluded from v1 search

| Entity type | Status | Reason |
| --- | --- | --- |
| `brand` | Excluded | No stable public detail route in `KnownPages` |
| `faq` | Excluded | Public page exists as aggregate (`/cesta-pitanja`), but no stable per-entity canonical URL strategy defined |
| `faq-category` | Excluded | No stable public detail route |
| `farmSupply` | Excluded | No stable public detail route |
| `hqLocations` | Excluded | No stable public detail route |
| `liquidPreparation` | Excluded | No stable public detail route |
| `occasions` | Excluded | No stable public detail route |
| `operationFrequency` | Excluded | Internal/helper dictionary type; no public detail route |
| `plantStage` | Excluded | Internal/helper dictionary type; no public detail route |
| `seed` | Excluded | No stable public detail route |

These can be promoted once GRE-365 (canonical URL resolution) defines linkability and `www` has stable public pages.

## Query behavior

- **Minimum query length:** 2 non-whitespace characters after normalization.
- **Normalization:** preserve existing Croatian diacritic-insensitive behavior (`normalizeSearchText`) for input and indexed text.
- **Empty query behavior:**
  - `q` missing/empty/shorter than min length returns `200` with empty `results` and informative metadata (no hard error).
  - Facet counts can return `0` in this state.
- **Pagination:** default `limit=20`, max `50`, deterministic ordering by `score DESC`, then `entityType`, then `id`.
- **Ranking:** PostgreSQL FTS rank (cover density acceptable) with weighted fields:
  - highest: title/name-like fields
  - medium: subtitle/taxonomy-like fields (e.g. latin name)
  - lower: long description/body fields
- **No results behavior:** return empty `results` with preserved query metadata and category facets.

## Reuse guarantees for non-www consumers

To avoid a `www`-only contract:

- `entityType`, `id`, `score`, and `matchedFields` are first-class and app-agnostic.
- `href` is canonical for public web navigation but does not block other apps from mapping to internal deep links.
- `image` and `summary` are optional to accommodate partial datasets.

## Implementation notes linked to blocking issues

- GRE-364: add/optimize PostgreSQL FTS vectors and indexes for included entity types.
- GRE-365: finalize canonical URL strategy for included and future types.
- GRE-366: expose API route + generated client types for this contract.
- GRE-367: build `www` route and header integration with category filters.
- GRE-370: document cross-app adoption path (`garden`, `app`, `farm`) and public/private boundary.
