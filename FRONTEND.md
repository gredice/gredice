# Frontend Guide

Use this guide for React, Next.js, TypeScript, UI components, and frontend app structure.

## App ownership

- `apps/www`: public site and commerce flows. Treat SEO, accessibility, performance, and polish as core behavior.
- `apps/garden`: customer garden/game experience. Treat canvas/3D/game state, asset loading, touch input, and responsive layout as core behavior.
- `apps/farm`: farm operations. Optimize for dense, repeatable workflows and clear task status.
- `apps/app`: internal admin and operations. Optimize for data density, scanning, bulk actions, and reliable form workflows.
- `apps/status`: public status page. Keep it simple, fast, and resilient.
- `apps/storybook`: documentation surface for shared UI and reusable app components.

## Component rules

- Check `@gredice/ui`, `@gredice/game`, and existing app components before creating a new component.
- If a component is reusable across apps, add it to `packages/ui` or the appropriate shared package.
- Do not create multiple components in the same file. Split each component into its own file.
- Keep app-specific components inside their owning app unless reuse is real.
- When adding or changing a reusable UI component, add or update a Storybook story under `apps/storybook/stories` in the same change.
- When adding a new `@gredice/ui` component or a meaningful new variant/state, update the relevant showcase story under `apps/storybook/stories/packages/ui/Showcases` so contributors can see it in an appropriate product context.
- Prefer established `@gredice/*` primitives already used in the app before introducing a new dependency.

### Shared primitive boundary

Base UI is the headless implementation layer for interactive components owned
by `@gredice/ui`. Application code and other packages must import the shared
Gredice components rather than `@base-ui/react` directly. First-party Radix and
Vaul imports or dependency declarations are prohibited; the
`lint:ui-primitives` and `test:ui-primitives` checks enforce this boundary.

Third-party packages may carry their own primitive implementation internally.
In particular, `@mdxeditor/editor` currently brings Radix transitively for the
App and WWW editors; that does not make Radix part of the Gredice UI contract.
See [the Base UI migration record](./docs/base-ui-migration.md) for the portal,
compatibility, and dependency-audit decisions.

## Next.js and React

- Follow the App Router patterns already present in each app.
- Keep server-only code on the server. Use `server-only` where the package/app already uses it.
- Add client components only when interactivity, browser APIs, or client state require them.
- Prefer Server Components for data loading and page composition.
- Use Server Actions where the app already uses them for mutations, and revalidate the affected routes with `revalidatePath` or the established cache pattern.
- Keep client state scoped. Use React Query or existing state helpers where the local app already does.
- Preserve existing route, layout, error boundary, and loading conventions.
- WWW public profiles (`/korisnici/[publicId]`) load their data on the server for every request and are never cached, so a renamed gardener or a garden that stops being public disappears with the next visit. Keep `loading.tsx` out of that route and its parent segment: the leaderboard's loading state lives in the `korisnici/(ljestvica)` route group so the profile response waits for its data, shows no loading text and answers a missing profile with a real `404`.
- Links between WWW and News cross a Next.js app boundary even on the same domain. Use native anchors (or `Button` with `navigation="document"`) across that boundary; keep Next.js links for routes within the same app. Disabling prefetch alone still allows an incompatible RSC navigation on click.

## TypeScript

- Reuse types from `@gredice/*`, generated OpenAPI types, Drizzle schema types, and existing domain modules.
- Do not create types that duplicate existing ones.
- Do not create types that TypeScript can infer.
- Use `unknown` instead of `any`.
- Avoid `as` assertions. If narrowing is needed, prefer validation, discriminated unions, or local type guards.
- Keep exported component props minimal and stable.

## Forms and data entry

- Validate user input at the boundary, not only in the UI.
- Preserve existing form action result shapes and error display patterns.
- Keep optimistic UI conservative for inventory, payment, delivery, account, and schedule workflows.
- After mutations, revalidate every page or query that can show stale data.

## Assets and media

- Use `next/image` where the app already expects optimized images.
- Use existing image and gallery components from `@gredice/ui` when possible.
- For game assets and generated model types, use the existing generation scripts instead of hand-editing generated model output.
- Avoid adding large assets unless the workflow explicitly needs them.

## Accessibility

- Interactive elements must be keyboard reachable and have clear labels.
- Prefer semantic buttons, links, headings, tables, and form labels.
- Keep heading levels sequential: card section titles directly under a page `h1` render as `h2` (the shared `CardTitle` is an `h3`).
- Keep focus management correct in dialogs, menus, drawers, and async forms.
- Public `www` changes should satisfy the existing Playwright accessibility tests.
- Profile avatar links include visible fallback initials in their accessible names; garden like buttons include the displayed count. Named garden member links derive their names from their content and use `UserAvatar decorativeImage` to avoid repeating the adjacent name through image alt text.
- In-page section links (`PageSectionNav`) end their accessible name with
  "– odjeljak ove stranice", so they differ from same-text links to a separate
  page (for example `#radnje` vs `/radnje` in the footer). Prefer visible text
  plus `sr-only` context over an `aria-label` that drops the visible text
  (WCAG 2.5.3), keep a positioned ancestor (`relative`) around `sr-only` text in
  scrolling rows, and start `sr-only` additions with a dash, not a comma
  (Chrome adds a space before them).

- Admin dashboard statistics use the page's selected Zagreb calendar date range.
  Registrations, operation durations and sunflowers share that range; charts show
  daily columns for up to seven days and at most seven contiguous date buckets
  for longer periods. The expandable chart tables expose each bucket's exact dates.
- The dashboard period picker and custom date inputs sit in the page-level
  period control group, rendered as `AdminPageHeader` actions on the right of
  the breadcrumb row; they wrap below the breadcrumbs on narrow screens.
- Dashboard bucket descriptions include years throughout ranges spanning New Year.
- The exported dashboard analytics action requires admin access before cache lookup.
- The admin nav profile shows the user's display name (falling back to the
  user name) with a megaphone `UierReviewButton` beside it that toggles the
  UIer review toolbar, like the settings `UierReviewToggle`.

- Closed admin mobile navigation is inert and hidden from assistive technology,
  so off-screen controls cannot receive keyboard focus. Review button stories use
  controlled state, matching the review toggle previews, without loading UIer.
