---
name: gredice-admin-table-to-list
description: Use for Gredice admin UI work that converts table-based list pages into reusable list views with filter/sort controls above the results, left-aligned primary data, right-aligned tags/actions, and paginated or infinite loading. Trigger for apps/app admin tables, directory entity lists, table-to-list migrations, list item layout reuse, or follow-up pages that should match the operations directory list pattern.
---

# Gredice Admin Table To List

## Workflow

1. Read the nearest `AGENTS.md`, then `FRONTEND.md`, `DESIGN.md`, and `QUALITY_SCORE.md`.
2. Locate the current table owner, page route, filters, search state, data loader, row actions, and any special cell renderers.
3. Keep the page's data contract and permissions intact. Preserve server auth, mutation actions, revalidation, and existing filters unless the task asks to change them.
4. Replace the table with a list component rather than only restyling rows. Keep repeated list items as cards or divided list rows, not nested cards.
5. Move sortable column behavior into top controls near filters. Preserve every meaningful sort option from the table header.
6. Put primary data on the left: leading media, title/link, and short metadata. Put tags, status chips, dates, counters, and row actions on the right.
7. Promote special data types before text when useful. In directory lists, image display attributes should become the leading thumbnail before the label/name.
8. Add pagination before broadening the pattern. Prefer server-backed pages plus an admin API route and React Query `useInfiniteQuery`; include a manual `Učitaj još` fallback even when an IntersectionObserver loads the next page automatically.
9. Handle empty, loading, error, and end-of-list states. Keep controls keyboard reachable and labels explicit.
10. Run the narrowest relevant check from the repo root, usually `pnpm typecheck --filter app` for app-only TypeScript changes. Use `git diff --check` for docs-only edits.

## Gredice Patterns

- For directory entity pages, start from `apps/app/app/admin/directories/[entityType]/page.tsx`.
- Use `FilterProvider` and `SearchInput` for admin header search when the page already uses them.
- Use `TableFilter` for existing URL-backed single filters. Add a focused multiselect only when the filter truly needs multiple values.
- Use `Card` plus `CardOverflow` around the list when the page previously framed a table that way.
- Reuse `Chip`, `Button`, `DropdownMenu`, `ImageViewer`, `LocalDateTime`, `Typography`, `ServerActionIconButton`, and existing row action components before creating new primitives.
- Keep Croatian admin copy consistent with the surrounding page.

## List Layout Checklist

- Left side: media if present, primary link/title, compact metadata.
- Right side: publish/status chips, boolean/reference tags, dates, counts, and icon actions.
- Sorting: top dropdown or segmented control plus direction toggle.
- Filtering: top controls before the list; URL-backed when existing filters already use URL search params.
- Pagination: first page rendered by the server, later pages fetched lazily, with `Cache-Control: no-store` on admin API routes.
- Mobile: stack right-side tags below primary content; keep actions visible without hover-only access.
