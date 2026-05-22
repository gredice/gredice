# Signalco component migration record

Date: 2026-05-21
Status: Completed

## Goal

This is a historical record of the completed migration from external Signalco
UI/auth/CMS packages to first-party Gredice packages. Do not add new
`@signalco/*` UI, auth, CMS, theme, hook, or helper dependencies; use
`@gredice/ui`, `@gredice/ui/auth`, `@gredice/auth`, `@gredice/js`, and
app-owned components instead.

The migration replaced Signalco UI component usage with first-party Gredice
components while keeping shared UI in `packages/ui`, app-specific workflows in
their owning app, and Storybook coverage for reusable components.

## Initial inventory

The initial static scan found these Signalco UI dependencies in source files:

| Package | Usage |
| --- | ---: |
| `@signalco/ui-primitives` | 1,804 imports across 554 files |
| `@signalco/ui-icons` | 234 imports across 233 files |
| `@signalco/ui` | 90 imports across 79 files |
| `@signalco/cms-core` and `@signalco/cms-components-marketing` | 24 imports |
| `@signalco/auth-client` and `@signalco/auth-server` | 23 imports |
| `@signalco/ui-notifications` | 2 imports |

Largest consumers are `apps/app`, `packages/game`, `apps/www`, `apps/farm`,
and `apps/garden`. The shared `@gredice/ui` package also imported Signalco
internals initially, so the migration started there before app imports were
removed.

The current app/package source, package manifests, and lockfile no longer
reference external `@signalco/*` UI, CMS, notification, or auth packages. The
remaining Signalco-named surface is the internal `@gredice/signalco` package,
which is an API integration package and not part of this UI/auth package
migration.

## Migration decisions

- Signalco and Gredice are both owned by us and open source, so it is acceptable
  to copy Signalco source code directly when that is the fastest safe path.
- Preserve existing Signalco prop names when they are already clear and widely
  used. Consolidate duplicate, typo-prone, or confusing prop names before
  freezing the Gredice API.
- Export icons from `@gredice/ui/icons`. Most Signalco icons are Lucide icons,
  so map them directly where possible and copy only the custom icons that do not
  have a Lucide equivalent.
- Prefer shadcn/ui source components where they fit. shadcn copies component
  code into the repo, which matches the goal of owning the Gredice UI surface.
  Use Radix-backed shadcn components for dialogs, menus, tooltips, selects,
  accordions, tables, forms, and similar interaction primitives.
- Base local Tailwind theme configuration on the pinned Signalco theme packages
  before removing them. `@signalco/ui-themes-minimal@0.1.3` defines the shared
  color tokens, radius tokens, accordion and scroll animations, `aspect-card`,
  selection colors, light/dark image display helpers, and Lucide stroke width.
  `@signalco/ui-themes-minimal-app@0.1.3` uses the same base config and adds a
  `0.875` font-size scale for app surfaces.

## Implementation order

## Progress log

- 2026-05-21: Added `packages/ui/components.json`, `@gredice/ui/utils`,
  `@gredice/ui/lib`, `@gredice/ui/icons`, Gredice Tailwind theme presets,
  `packages/ui/src/styles.css`, and switched `packages/ui/tailwind.config.ts`
  to the local Gredice preset.
- 2026-05-21: Added first-party low-level `@gredice/ui` primitives for
  typography, layout, links, buttons, icon buttons, inputs, avatars, chips,
  indicators, progress, collapse, skeletons, spinners, containers, and dividers.
- 2026-05-21: Finished the remaining low-level controls with first-party
  `Checkbox` and `Slider`, added `Card` and `Table` composed primitives, and
  documented the new shared surfaces in Storybook.
- 2026-05-21: Added first-party `Tooltip` and rebased `PlantYieldTooltip` onto
  Gredice primitives/icons.
- 2026-05-21: Added first-party `Modal`, `Menu`, `Popper`, and `List`
  primitives with Storybook coverage, copied the `useSearchParam` and
  `initials` helpers into Gredice-owned packages, and removed Signalco
  dependencies from `packages/ui` and `packages/js`.
- 2026-05-21: Rebased the remaining Signalco imports inside `packages/ui/src`
  onto first-party primitives/icons, including filters, image viewers/editors,
  auth buttons, avatars, debug controls, schedule UI, and plant/raised-bed
  helpers.
- 2026-05-21: Added first-party `Alert`, `Breadcrumbs`, `ModalConfirm`,
  `NavigatingButton`, and `NoDataPlaceholder`, expanded `Button` with
  Signalco-compatible `color` props, documented the new components in
  Storybook, and moved `packages/game` off Signalco `Alert`, `ModalConfirm`,
  and `NoDataPlaceholder` imports.
- 2026-05-21: Added first-party `SelectItems` and `EditableInput`, documented
  both in Storybook, moved all `packages/game` `SelectItems` imports to
  `@gredice/ui`, and removed the last `@signalco/ui/*` component import from
  `packages/game` source.
- 2026-05-21: Replaced remaining `packages/game` Signalco primitive, icon,
  theme, hook, and helper imports with Gredice-owned equivalents, added the
  missing `Megaphone` icon compatibility export, and removed migrated Signalco
  package entries from `@gredice/game`.
- 2026-05-21: Removed remaining Storybook Signalco UI/icon/theme imports,
  switched Storybook to the Gredice app theme preset and local Tailwind CSS,
  and removed migrated Signalco UI packages from `apps/storybook`.
- 2026-05-21: Migrated `apps/api` page/layout/not-found UI imports and
  Tailwind theme setup to `@gredice/ui`, removed migrated Signalco UI packages
  from the API workspace, removed a stale `@gredice/client` dependency from
  `@gredice/ui` to avoid a workspace cycle, and validated the API build.
- 2026-05-21: Migrated `apps/farm` source imports, Tailwind theme setup, and
  Next.js package optimization entries to `@gredice/ui`, removed migrated
  Signalco UI packages from the Farm workspace, and validated Farm lint/build.
- 2026-05-21: Migrated the remaining small package refs in
  `@gredice/transactional`, `@gredice/stripe`, and `@gredice/storage`: added a
  Gredice-owned `isAbsoluteUrl` helper, switched Transactional to the local
  theme preset, removed stale Signalco package dependencies, and validated the
  touched package slice.
- 2026-05-21: Migrated `apps/garden` direct primitive, icon, theme, hook, and
  helper imports to Gredice-owned equivalents, added a reusable
  `@gredice/js/arrays` `orderBy` helper, and validated Garden lint/build.
  At that point Garden still intentionally kept `@signalco/ui-notifications`
  and its `@signalco/ui-primitives` peer until the notification UI phase.
- 2026-05-21: Fixed Gredice `Input` generated label ids and restored
  Signalco-compatible mobile drawer behavior in `Modal` using `vaul`; focused
  Garden notification/drawer tests and the full Garden Playwright assertion set
  passed. The Garden test runner still required manual cleanup after an
  orphaned `next-server` stayed alive after all tests reported pass.
- 2026-05-21: Added first-party `Accordion`, `Gallery`, `GentleSlide`,
  `SplitView`, and `PageNav` primitives with Storybook coverage, migrated
  `apps/www` direct Signalco UI/icon/helper/theme imports to Gredice-owned
  equivalents, added a `@gredice/js/slug` compatibility export, and validated
  `www` lint/build.
- 2026-05-21: Migrated `apps/app` direct Signalco primitive, component, icon,
  hook, helper, and app-theme imports to Gredice-owned equivalents, added
  `@gredice/js/strings` `camelToSentenceCase`, `@gredice/ui/hooks`
  `useControllableState`, and the remaining Signalco-compatible Lucide icon
  aliases. At that point `apps/app` still intentionally kept `@signalco/ui`
  and `@signalco/ui-primitives` only for Signalco auth/CMS package internals.
- 2026-05-21: Added a Gredice-owned CMS rendering surface in `@gredice/ui/cms`
  with `SectionData`, parsers, `SectionsView`, and the `Heading1`, `Feature1`,
  `Faq1`, and `Footer1` marketing sections. Migrated `apps/app`, `apps/www`,
  and `apps/status` CMS rendering/preview imports, removed Signalco CMS/UI peer
  packages from those app dependency lists where no longer needed, and
  validated the affected builds.
- 2026-05-21: Added `@gredice/ui/notifications` with Signalco-compatible
  `NotificationsContainer`, `showNotification`, `showPrompt`, and
  `hideNotification` exports backed by `sonner`. Migrated Garden notification
  imports, removed `@signalco/ui-notifications` from `apps/garden`, refreshed
  the lockfile, and validated `@gredice/ui` plus the Garden provider smoke
  path.
- 2026-05-21: Added Gredice-owned auth client wrappers in `@gredice/ui/auth`
  and server visibility wrappers in `@gredice/ui/auth/server`. Migrated
  `AuthProvider`, `SignedIn`, `SignedOut`, `authCurrentUserQueryKeys`, and
  `AuthProtectedSection` imports in `apps/app`, `apps/farm`, and
  `apps/garden`, removed `@signalco/auth-client` and `@signalco/ui-primitives`
  from those apps, removed stale Signalco Tailwind content paths, and refreshed
  the lockfile.
- 2026-05-21: Added the Gredice-owned `@gredice/auth` runtime package with
  `initAuth`, `initRbac`, JWT verification, cookie helpers, and request auth
  wrappers. Migrated `apps/api`, `apps/app`, and `apps/farm` from
  `@signalco/auth-server`, removed the final external `@signalco/*` package
  dependencies from app/package manifests and `pnpm-lock.yaml`, and validated
  API, app, farm, and garden builds plus the API node test suite.
- 2026-05-21: Promoted the duplicated public `PageHeader` and CMS
  `PageHeaderSection` components from `apps/app` and `apps/www` into
  `@gredice/ui/PageHeader`, migrated app and public-site consumers to the
  shared component, and moved the Storybook coverage under `packages/ui`.
- 2026-05-21: Reviewed the remaining app-owned component promotion candidates.
  Kept `Logotype` variants app-owned because public/garden/status use different
  rendering and asset strategies, kept server-action buttons and field display
  helpers app-owned because they are internal admin patterns, and removed the
  unused app-local skeleton helpers instead of promoting dead API.
- 2026-05-21: Added Storybook coverage for the promoted `PageHeader` and a
  compact `CorePrimitives` foundation story covering the remaining small shared
  UI primitives. Updated contributor docs to remove stale `@signalco/*`
  guidance and include `@gredice/auth` in the workspace package map.
- 2026-05-21: Completed the targeted visual sweep. Added Storybook render
  coverage for app admin tables/forms and the farm schedule shell, rebuilt
  Storybook, rebuilt `farm`, `garden`, and `status`, and smoke-rendered the
  live `www`, `farm`, `status`, and `garden` surfaces plus the relevant
  Storybook stories with Playwright screenshots and body-size checks.
- 2026-05-21: Tightened post-migration visual parity for the shared primitives
  after browser comparison: restored default Row centering, Signalco-like
  Container widths, Typography weights, Avatar sizes, Input placeholder
  opacity, Chip decorator sizing, and normalized CMS footer social icon sizing.
- 2026-05-21: Kept the new `Stack` and `Row` spacing contract at
  `spacing={n}` equals Tailwind gap `n`, then doubled migrated `spacing` call
  site values so layouts keep their pre-migration visual rhythm.
- 2026-05-22: Removed stale Signalco recommendations from active contributor
  guides. Remaining Signalco package names in this document are historical
  migration inventory, decisions, and completion evidence.

### 1. Define the first-party UI foundation

- [x] Add a small `cx` helper in a Gredice-owned package or `@gredice/ui` export.
- [x] Add shadcn configuration for `packages/ui` or a monorepo-compatible
      root-level setup that writes generated source into `packages/ui`.
      There is no `components.json` in the repo at the time of this plan.
      When using the CLI, use a non-interactive command such as
      `pnpm dlx shadcn@latest init -d --base radix` and adapt the paths before
      accepting generated files.
- [x] Preserve compatible Signalco prop names where they are useful
      (`variant`, `size`, `color`, `startDecorator`, `endDecorator`,
      `loading`, `fullWidth`, `spacing`, `level`, etc.).
- [x] Consolidate unclear or duplicate props into one Gredice API before wide
      app replacement.
      Progress: compatibility props were preserved where they were already
      clear and widely used (`variant`, `size`, `color`, decorators, loading,
      full-width/layout props), while promoted shared components use one
      Gredice-owned prop surface instead of app-local duplicates.
- [x] Create `@gredice/ui/icons` compatibility exports backed by `lucide-react`
      where possible.
- [x] Copy or adapt custom Signalco icons that do not map cleanly to Lucide.
- [x] Copy the relevant Tailwind token extension from
      `@signalco/ui-themes-minimal` into a Gredice-owned config.
- [x] Copy the app font-size scale from `@signalco/ui-themes-minimal-app` into
      the app-facing Gredice Tailwind config.
- [x] Move Signalco theme CSS variables and helpers into local app/package CSS
      without changing existing token names.
- [x] Add Storybook grouping for first-party primitives under
      `apps/storybook/stories/packages/ui`.

### 2. Build low-level primitives in `packages/ui`

Implement these first because most other components depend on them. Prefer
shadcn source where it fits; copy/adapt Signalco code when shadcn does not fit
the existing Gredice API.

- [x] `Typography` using a Gredice API compatible with current `level`,
      `component`, `secondary`, `semiBold`, `mono`, `center`, and `noWrap`
      usage.
- [x] `Stack` and `Row` as lightweight layout primitives.
- [x] `Container`
- [x] `Divider`
- [x] `Skeleton` using shadcn as the base if possible.
- [x] `Spinner` or loading indicator with current `loading` button behavior.
- [x] `Link`
- [x] `Button` using shadcn as the base, with compatibility props for current
      Signalco usage.
- [x] `IconButton` built on the Gredice `Button` primitive.
- [x] `Input` using shadcn as the base, with label and decorator support.
- [x] `Checkbox` using shadcn as the base.
- [x] `Chip` using shadcn `Badge` as the base if the variant/color mapping is
      clean.
- [x] `Avatar` using shadcn as the base.
- [x] `DotIndicator`
- [x] `Progress` using shadcn as the base.
- [x] `Slider` using shadcn as the base.
- [x] `Collapse`

Validation after this phase:

```bash
pnpm lint --filter @gredice/ui
pnpm build --filter storybook
```

### 3. Build composed primitives in `packages/ui`

These unlock the admin, farm, public, and game screens that currently rely on
Signalco overlays and data-display components.

- [x] `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardActions`,
      `CardOverflow` using shadcn `Card` as the base where possible.
- [x] `Table` with `Header`, `Body`, `Row`, `Head`, and `Cell` using shadcn as
      the base.
- [x] `Modal` using shadcn `Dialog` as the base.
- [x] `ModalConfirm` using shadcn `AlertDialog` as the base.
- [x] `Menu` / dropdown menu components using shadcn `DropdownMenu` as the
      base.
- [x] `Popper`
- [x] `Tooltip` using shadcn as the base.
- [x] `SelectItems` using shadcn `Select`, `Command`, or `Combobox` patterns
      depending on current option grouping/search needs.
- [x] `Alert` using a shadcn-style owned source component.
- [x] `Breadcrumbs` as a Gredice-owned navigation component.
- [x] `Accordion` as a Gredice-owned Signalco-compatible collapsible card.
- [x] `List`, `ListHeader`, `ListItem`
- [x] `NavigatingButton`
- [x] `NoDataPlaceholder`
- [x] `Gallery`
- [x] `SplitView`
- [x] `EditableInput`
- [x] `GentleSlide`
- [x] `PageNav`

Validation after this phase:

```bash
pnpm lint --filter @gredice/ui
pnpm build --filter storybook
```

### 4. Replace Signalco internals inside existing `@gredice/ui`

Rebase existing shared components onto the new first-party primitives before
changing app imports.

- [x] `packages/ui/src/Tabs` is already first-party on Radix; keep it as the
      reference pattern.
- [x] Rebase `FilterInput`.
- [x] Rebase `ExpandableSearchInput`.
- [x] Rebase `TableFilter`.
- [x] Rebase `ImageViewer`.
- [x] Rebase `ImageGallery`.
- [x] Rebase `ImageEditor`.
- [x] Rebase `UserAvatar`.
- [x] Rebase `ErrorFallback`.
- [x] Rebase `DebugControls`.
- [x] Rebase `DailySchedule`.
- [x] Rebase `PlantYieldTooltip`.
- [x] Rebase `GoogleLoginButton`, `FacebookLoginButton`, and
      `useLastLoginProvider`.
- [x] Rebase additional shared leaf components that had Signalco imports:
      `AvatarSelectionMenu`, `LoadingIndicator`, `OperationImage`,
      `RaisedBedIcon`, `PlantImage`, `SeedTimeInformationBadge`,
      `RaisedBedLabel`, and `StyledHtml`.
- [x] Remove `@signalco/ui`, `@signalco/ui-icons`,
      `@signalco/ui-primitives`, `@signalco/hooks`, and `@signalco/js` from
      `packages/ui/package.json` once no `packages/ui/src` imports remain.

Validation after this phase:

```bash
pnpm lint --filter @gredice/ui
pnpm typecheck --filter @gredice/ui
pnpm build --filter storybook
```

### 5. Move duplicated custom components into `packages/ui`

These already exist in app code and should be promoted once their Signalco
dependencies are gone.

- [x] Move duplicated `PageHeader` from `apps/app/components/shared` and
      `apps/www/components/shared` into `@gredice/ui`.
- [x] Move duplicated `PageHeaderSection` into `@gredice/ui` or a CMS-facing
      shared module.
      Progress: both are exported from `@gredice/ui/PageHeader`; `apps/app`
      and `apps/www` CMS registries use the shared `PageHeaderSection`, and
      public `apps/www` pages import `PageHeader` from `@gredice/ui`.
- [x] Move duplicated `NoDataPlaceholder` into `@gredice/ui`.
- [x] Review `Logotype` variants in `apps/www`, `apps/garden`, and
      `apps/status`; move shared brand pieces only if the variants can share one
      API without hiding app-specific behavior.
      Progress: reviewed and kept app-owned. `apps/www` and `apps/garden` use
      app-specific inline SVG variants with different fill/className behavior,
      while `apps/status` uses a CDN image via `next/image`.
- [x] Review `ServerActionButton` and `ServerActionIconButton`; keep in
      `apps/app` unless `farm` or another app adopts the same server-action
      pattern.
      Progress: reviewed and kept app-owned because only internal admin code
      imports these server-action wrappers.
- [x] Review `Field`, `FieldSet`, and `FormFields`; keep admin-only fields in
      `apps/app` unless they are reused outside internal admin.
      Progress: reviewed and kept app-owned because the display helpers are only
      used by internal admin/detail pages and encode admin formatting choices
      such as `LocalDateTime`, boolean labels, and no-wrap values.
- [x] Move reusable skeleton helpers only after `Card` and `Skeleton` are
      first-party.
      Progress: `Card` and `Skeleton` are first-party, but the app-local
      skeleton helpers had no remaining imports, so they were deleted instead
      of promoted.
- [x] Add or update Storybook stories for every component promoted to
      `packages/ui`.

Validation after this phase:

```bash
pnpm lint --filter @gredice/ui
pnpm build --filter storybook
pnpm build --filter app
pnpm build --filter www
```

### 6. Replace app and package imports incrementally

Use small app/package slices so visual and type regressions are easier to catch.

- [x] Replace `@signalco/ui-primitives/*` imports in `apps/api`.
- [x] Replace `@signalco/ui-primitives/*` imports in `apps/farm`.
      Progress: `apps/farm` source now uses `@gredice/ui` primitives,
      `@gredice/ui/icons`, and local Gredice theme config; migrated Signalco
      UI/icon/theme packages were removed from the Farm workspace.
- [x] Replace `@signalco/ui-primitives/*` imports in `apps/garden`.
      Progress: direct Garden source imports now use `@gredice/ui`; the
      Signalco primitive package and Tailwind content paths were removed after
      the auth client wrapper moved to `@gredice/ui/auth`.
- [x] Replace `@signalco/ui-primitives/*` imports in `apps/www`.
      Progress: direct `apps/www` source now uses `@gredice/ui`,
      `@gredice/ui/icons`, `@gredice/js/arrays`, and `@gredice/js/slug`.
      Signalco UI primitive peers were removed after the CMS phase.
- [x] Replace `@signalco/ui-primitives/*` imports in `packages/game`.
      Progress: `packages/game` source now uses `@gredice/ui` primitives,
      `@gredice/ui/icons`, and `@gredice/ui/hooks`; migrated Signalco UI/icon
      packages were removed from `@gredice/game`.
- [x] Replace `@signalco/ui-primitives/*` imports in `apps/app`.
      Progress: direct admin source imports now use `@gredice/ui`,
      `@gredice/ui/icons`, `@gredice/ui/hooks`, and `@gredice/js/strings`.
      Signalco UI/primitives packages were removed after the CMS and auth
      component phases.
- [x] Replace `@signalco/ui/*` imports with `@gredice/ui` equivalents.
      Progress: complete for `apps/api`, `apps/farm`, `apps/garden`,
      `apps/www`, `apps/app`, and `packages/game`, excluding CMS package
      internals.
- [x] Replace `@signalco/ui-icons` imports with the chosen Gredice icon layer.
      Progress: complete for `apps/farm`, `apps/garden`, `apps/www`,
      `apps/app`, and `packages/game`.
- [x] Replace `@signalco/hooks/useSearchParam` and other Signalco hooks with
      app-local hooks, `nuqs`, or Gredice-owned hooks.
      Progress: complete for `apps/garden`, `apps/www`, `apps/app`, and
      `packages/game`.
- [x] Replace `@signalco/js` helpers (`orderBy`, `slug`, `initials`,
      `camelToSentenceCase`, `isAbsoluteUrl`) with `@gredice/js` equivalents.
      Progress: `initials`, `isAbsoluteUrl`, `orderBy`, `slug`, and
      `camelToSentenceCase` now have Gredice-owned equivalents;
      `isAbsoluteUrl` is used by `@gredice/stripe`, `orderBy`/`slug` are used
      by `apps/garden` and `apps/www`, and `camelToSentenceCase` is used by
      `apps/app`.
- [x] Copy Signalco implementation details directly where a compatibility
      component would otherwise take longer to re-create safely.
      Progress: copied/adapted compatibility behavior for primitives including
      `Card`, `Modal`, `Gallery`, `GentleSlide`, `PageNav`, auth wrappers,
      notifications, and promoted page headers where preserving the existing
      prop surface reduced app churn.

Suggested validation per slice:

```bash
pnpm lint --filter <workspace>
pnpm test --filter <workspace>
pnpm build --filter <workspace>
```

For `@gredice/game` changes, validate both consumers:

```bash
pnpm lint --filter @gredice/game
pnpm lint --filter garden
pnpm lint --filter www
pnpm build --filter garden
pnpm build --filter www
```

### 7. Rebuild CMS rendering and marketing sections

CMS rendering used to depend on `@signalco/cms-core` and
`@signalco/cms-components-marketing`; the supported Gredice sections now live
in `@gredice/ui/cms`.

- [x] Define a Gredice `SectionData` type and parser.
- [x] Build a Gredice `SectionsView`.
- [x] Rebuild `Heading1`.
- [x] Rebuild `Feature1`.
- [x] Rebuild `Faq1`.
- [x] Rebuild `Footer1`.
- [x] Update `apps/app/components/shared/sectionsComponentRegistry.ts`.
- [x] Update `apps/www/components/shared/sectionsComponentRegistry.ts`.
- [x] Update `apps/status/components/StatusFooter.tsx`.
- [x] Update CMS page validation and tests in `packages/storage` only if the
      supported section contract changes. No storage update was needed because
      the section component names and stored JSON contract stayed stable.

Validation after this phase:

```bash
pnpm test --filter @gredice/storage
pnpm build --filter app
pnpm build --filter www
pnpm build --filter status
```

### 8. Replace auth and notification UI integrations

Keep this after the component migration because auth screens rely on modals,
inputs, buttons, alerts, dividers, and provider wrappers.

- [x] Replace `AuthProvider`, `SignedIn`, and `SignedOut` from
      `@signalco/auth-client/components` with Gredice-owned equivalents.
      Progress: client auth components now come from `@gredice/ui/auth` in
      `apps/app`, `apps/farm`, and `apps/garden`.
- [x] Replace `authCurrentUserQueryKeys` usage with a Gredice-owned query key.
      Progress: app and farm login/logout forwarding now invalidates
      `@gredice/ui/auth` query keys.
- [x] Replace `AuthProtectedSection` and `SignedOut` from
      `@signalco/auth-server/components`.
      Progress: server visibility wrappers now come from
      `@gredice/ui/auth/server`.
- [x] Replace `initAuth` and `initRbac` only after the auth boundary is reviewed
      separately from visual component work.
      Progress: runtime auth helpers now come from `@gredice/auth` in
      `apps/api`, `apps/app`, and `apps/farm`.
- [x] Replace `NotificationsContainer` and `showNotification` from
      `@signalco/ui-notifications`.
      Progress: `apps/garden` now imports notification APIs from
      `@gredice/ui/notifications`, which also provides compatibility exports
      for `showPrompt` and `hideNotification`.

Validation after this phase:

```bash
pnpm build --filter app
pnpm build --filter farm
pnpm build --filter garden
pnpm build --filter api
```

### 9. Remove Signalco theme and build configuration

Do this only after imports are gone from source and Tailwind content scanning no
longer needs Signalco package paths.

- [x] Create a Gredice Tailwind preset that copies the current
      `@signalco/ui-themes-minimal@0.1.3` `theme.extend` values: `border`,
      `input`, `ring`, `background`, `foreground`, `primary`, `secondary`,
      `tertiary`, `destructive`, `muted`, `accent`, `popover`, `card`,
      `borderRadius`, accordion keyframes, scroll keyframes, `aspectRatio.card`,
      and animation names.
- [x] Create an app-facing Gredice Tailwind preset that copies
      `@signalco/ui-themes-minimal-app@0.1.3` and its `0.875` font-size scale.
- [x] Move the Signalco base CSS variables into local Gredice CSS while keeping
      token names stable: `--background`, `--foreground`, `--muted`,
      `--muted-foreground`, `--popover`, `--popover-foreground`, `--card`,
      `--card-transparent`, `--card-foreground`, `--border`, `--input`,
      `--primary`, `--primary-foreground`, `--secondary`,
      `--secondary-foreground`, `--tertiary`, `--tertiary-foreground`,
      `--accent`, `--accent-foreground`, `--destructive`,
      `--destructive-foreground`, `--ring`, and `--radius`.
- [x] Preserve local CSS helpers from the Signalco styles: `--light-display`,
      `--dark-display`, `.image--light`, `.image--dark`, selection colors, and
      `svg.lucide { stroke-width: 1.75px; }`.
- [x] Replace imports of `@signalco/ui-themes-minimal/config`.
      Progress: complete for `apps/garden`, `apps/www`, and
      `@gredice/transactional`.
- [x] Replace imports of `@signalco/ui-themes-minimal-app/config`.
      Progress: complete for `apps/api`, `apps/farm`, `apps/app`, and
      `apps/storybook`.
- [x] Replace `@import "@signalco/ui-themes-minimal-app/styles"` in app CSS.
      Progress: complete for `apps/api`, `apps/app`, and `apps/storybook`.
- [x] Remove Signalco paths from app Tailwind `content` arrays.
      Progress: complete for `packages/game`, `apps/api`, `apps/app`,
      `apps/farm`, `apps/garden`, `apps/storybook`, `apps/www`, and
      `apps/status`.
- [x] Remove Signalco packages from app/package `package.json` files.
      Progress: UI/icon/theme/hook/helper packages removed from
      `@gredice/game`; UI/icon/theme packages removed from `apps/api`,
      `apps/farm`, `apps/storybook`, and `@gredice/transactional`; stale
      `@signalco/js` dependencies removed from `@gredice/storage` and
      `@gredice/stripe`; `apps/garden` no longer declares Signalco packages;
      `apps/www` and `apps/status` Signalco CMS/UI packages removed; `apps/app`
      and `apps/farm` removed Signalco auth-client/UI peer packages; `apps/api`,
      `apps/app`, and `apps/farm` now use `@gredice/auth` instead of
      `@signalco/auth-server`.
- [x] Run `pnpm install` to update `pnpm-lock.yaml`.
      Progress: run after the `apps/farm`, `@gredice/transactional`,
      `@gredice/storage`, `@gredice/stripe`, `apps/garden`, and `apps/www`
      dependency changes, again after the `apps/app` dependency changes, and
      again after the CMS dependency removals from `apps/app`, `apps/www`, and
      `apps/status`, after the Garden notification dependency removal, and
      after the auth-client/UI peer dependency removals from `apps/app`,
      `apps/farm`, and `apps/garden`, and again after replacing
      `@signalco/auth-server` with `@gredice/auth`.
- [x] Remove `transpilePackages` or `optimizePackageImports` entries for
      Signalco UI packages from Next.js configs where no longer needed.
      Progress: complete for `apps/farm`, `apps/garden`, `apps/www`,
      `apps/app`, and the remaining app/package config scan.

Validation after this phase:

```bash
pnpm lint
pnpm test
pnpm build
```

### 10. Final verification and cleanup

- [x] Confirm no external Signalco imports remain:

```bash
rg "@signalco" apps packages pnpm-lock.yaml
```

- [x] Confirm app/package dependencies no longer include migrated Signalco
      packages.
- [x] Confirm Storybook has stories for all reusable first-party primitives and
      promoted components.
      Progress: reusable migration surfaces are covered by package UI stories,
      including promoted `PageHeader`/`PageHeaderSection` and a
      `CorePrimitives` story for buttons, icon buttons, inputs, chips,
      avatars, layout helpers, links, progress, skeleton, and spinner.
- [x] Run targeted visual checks for the highest-risk surfaces:
      `apps/app` admin tables/forms, `apps/farm` schedule flows,
      `apps/garden` login/HUD flows, `apps/www` public pages, and `apps/status`
      footer/status cards.
      Progress: visual smoke passed for live `apps/www` public pages
      (`/cjenik`, `/biljke`), live `apps/farm` schedule signed-out state
      (`/schedule`), live `apps/status` overview/footer (`/`), live
      `apps/garden` signed-in HUD (`/` with mocked API), and Storybook-rendered
      app admin tables/forms, farm schedule shell, shared `PageHeader`, and
      `CorePrimitives` stories.
- [x] Update contributor docs if commands, package boundaries, or Storybook
      expectations changed during the migration.
      Progress: `WORKSPACE.md` now includes `@gredice/auth` in the shared
      package map and `FRONTEND.md` points contributors to `@gredice/*`
      primitives instead of stale Signalco primitives.
