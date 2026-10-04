# Directory search indexing operations

This guide documents how `@gredice/storage` keeps `entity_search_documents` in sync with directory entity mutations.

## Automatic refresh path

The following repository mutations trigger `refreshImpactedEntitySearchDocuments`:

- `updateEntity` and `deleteEntity` in `entitiesRepo.ts`.
- `upsertAttributeValue` and `deleteAttributeValue` in `attributeValuesRepo.ts`.

The refresh flow is safe and idempotent:

1. Recompute the source entity search document.
2. Recompute dependent entity documents when parent public URL dependencies change:
   - `plant` changes refresh linked `plantSort` and `seed` documents.
   - `plantSort` changes refresh linked `seed` documents.
3. Remove documents automatically when entities are unpublished/deleted/non-public.

Failures log operational context (`entityId`, error object) without logging attribute values.

## Full rebuild / backfill

Use `rebuildDirectorySearchIndex()` from `entitySearchRepo` for deployment backfills and maintenance:

- Refreshes all currently published, non-deleted entities.
- Deletes stale rows for entities that are no longer published or were deleted.
- Returns `{ refreshedCount }`.
- Empty datasets are a successful no-op (`refreshedCount: 0`).

Example (from repo root):

```bash
pnpm --filter @gredice/storage exec tsx -e "import { rebuildDirectorySearchIndex } from './src/repositories/entitySearchRepo.ts'; rebuildDirectorySearchIndex().then((r) => { console.log(r); process.exit(0); });"
```

## Revalidation coordination

Search documents are consumed by the directories API search endpoint. Existing `Cache-Control` and `www` revalidation endpoints continue to govern HTTP/page cache lifetimes. Index updates now happen during mutation writes so API search reads fresh indexed rows without waiting for a periodic job.
