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
- Prefer established `@gredice/*` primitives already used in the app before introducing a new dependency.

## Next.js and React

- Follow the App Router patterns already present in each app.
- Keep server-only code on the server. Use `server-only` where the package/app already uses it.
- Add client components only when interactivity, browser APIs, or client state require them.
- Prefer Server Components for data loading and page composition.
- Use Server Actions where the app already uses them for mutations, and revalidate the affected routes with `revalidatePath` or the established cache pattern.
- Keep client state scoped. Use React Query or existing state helpers where the local app already does.
- Preserve existing route, layout, error boundary, and loading conventions.

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
- Keep focus management correct in dialogs, menus, drawers, and async forms.
- Public `www` changes should satisfy the existing Playwright accessibility tests.
