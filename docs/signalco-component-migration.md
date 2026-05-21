# Signalco component migration todo

Date: 2026-05-21

## Goal

Replace Signalco UI component usage with first-party Gredice components while
keeping shared UI in `packages/ui`, app-specific workflows in their owning app,
and Storybook coverage for reusable components.

## Current inventory

Latest static scan found these Signalco UI dependencies in source files:

| Package | Usage |
| --- | ---: |
| `@signalco/ui-primitives` | 1,804 imports across 554 files |
| `@signalco/ui-icons` | 234 imports across 233 files |
| `@signalco/ui` | 90 imports across 79 files |
| `@signalco/cms-core` and `@signalco/cms-components-marketing` | 24 imports |
| `@signalco/auth-client` and `@signalco/auth-server` | 23 imports |
| `@signalco/ui-notifications` | 2 imports |

Largest consumers are `apps/app`, `packages/game`, `apps/www`, `apps/farm`,
and `apps/garden`. The shared `@gredice/ui` package also still imports
Signalco internals, so the migration must start there before app imports can be
fully removed.

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
- [ ] Consolidate unclear or duplicate props into one Gredice API before wide
      app replacement.
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
- [ ] `Accordion` using shadcn as the base.
- [x] `List`, `ListHeader`, `ListItem`
- [x] `NavigatingButton`
- [x] `NoDataPlaceholder`
- [ ] `Gallery`
- [ ] `SplitView`
- [x] `EditableInput`
- [ ] `GentleSlide`
- [ ] `PageNav`

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

- [ ] Move duplicated `PageHeader` from `apps/app/components/shared` and
      `apps/www/components/shared` into `@gredice/ui`.
- [ ] Move duplicated `PageHeaderSection` into `@gredice/ui` or a CMS-facing
      shared module.
- [x] Move duplicated `NoDataPlaceholder` into `@gredice/ui`.
- [ ] Review `Logotype` variants in `apps/www`, `apps/garden`, and
      `apps/status`; move shared brand pieces only if the variants can share one
      API without hiding app-specific behavior.
- [ ] Review `ServerActionButton` and `ServerActionIconButton`; keep in
      `apps/app` unless `farm` or another app adopts the same server-action
      pattern.
- [ ] Review `Field`, `FieldSet`, and `FormFields`; keep admin-only fields in
      `apps/app` unless they are reused outside internal admin.
- [ ] Move reusable skeleton helpers only after `Card` and `Skeleton` are
      first-party.
- [ ] Add or update Storybook stories for every component promoted to
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

- [ ] Replace `@signalco/ui-primitives/*` imports in `apps/api`.
- [ ] Replace `@signalco/ui-primitives/*` imports in `apps/farm`.
- [ ] Replace `@signalco/ui-primitives/*` imports in `apps/garden`.
- [ ] Replace `@signalco/ui-primitives/*` imports in `apps/www`.
- [ ] Replace `@signalco/ui-primitives/*` imports in `packages/game`.
      Progress: `@signalco/ui/Alert`, `@signalco/ui/ModalConfirm`, and
      `@signalco/ui/NoDataPlaceholder` are replaced with `@gredice/ui`
      equivalents. All `@signalco/ui-primitives/SelectItems` imports and the
      remaining `@signalco/ui/EditableInput` component import are also replaced
      in `packages/game` source.
- [ ] Replace `@signalco/ui-primitives/*` imports in `apps/app`.
- [ ] Replace `@signalco/ui/*` imports with `@gredice/ui` equivalents.
- [ ] Replace `@signalco/ui-icons` imports with the chosen Gredice icon layer.
- [ ] Replace `@signalco/hooks/useSearchParam` and other Signalco hooks with
      app-local hooks, `nuqs`, or Gredice-owned hooks.
- [ ] Replace `@signalco/js` helpers (`orderBy`, `slug`, `initials`,
      `camelToSentenceCase`, `isAbsoluteUrl`) with `@gredice/js` equivalents.
- [ ] Copy Signalco implementation details directly where a compatibility
      component would otherwise take longer to re-create safely.

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

Current CMS rendering depends on `@signalco/cms-core` and
`@signalco/cms-components-marketing`.

- [ ] Define a Gredice `SectionData` type and parser.
- [ ] Build a Gredice `SectionsView`.
- [ ] Rebuild `Heading1`.
- [ ] Rebuild `Feature1`.
- [ ] Rebuild `Faq1`.
- [ ] Rebuild `Footer1`.
- [ ] Update `apps/app/components/shared/sectionsComponentRegistry.ts`.
- [ ] Update `apps/www/components/shared/sectionsComponentRegistry.ts`.
- [ ] Update `apps/status/components/StatusFooter.tsx`.
- [ ] Update CMS page validation and tests in `packages/storage` only if the
      supported section contract changes.

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

- [ ] Replace `AuthProvider`, `SignedIn`, and `SignedOut` from
      `@signalco/auth-client/components` with Gredice-owned equivalents.
- [ ] Replace `authCurrentUserQueryKeys` usage with a Gredice-owned query key.
- [ ] Replace `AuthProtectedSection` and `SignedOut` from
      `@signalco/auth-server/components`.
- [ ] Replace `initAuth` and `initRbac` only after the auth boundary is reviewed
      separately from visual component work.
- [ ] Replace `NotificationsContainer` and `showNotification` from
      `@signalco/ui-notifications`.

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
- [ ] Replace imports of `@signalco/ui-themes-minimal/config`.
- [ ] Replace imports of `@signalco/ui-themes-minimal-app/config`.
- [ ] Replace `@import "@signalco/ui-themes-minimal-app/styles"` in app CSS.
- [ ] Remove Signalco paths from app Tailwind `content` arrays.
- [ ] Remove Signalco packages from app/package `package.json` files.
- [ ] Run `pnpm install` to update `pnpm-lock.yaml`.
- [ ] Remove `transpilePackages` entries for Signalco UI packages from Next.js
      configs where no longer needed.

Validation after this phase:

```bash
pnpm lint
pnpm test
pnpm build
```

### 10. Final verification and cleanup

- [ ] Confirm no UI-related Signalco imports remain:

```bash
rg "@signalco/(ui|ui-primitives|ui-icons|cms-core|cms-components-marketing|ui-notifications)" apps packages
```

- [ ] Confirm app/package dependencies no longer include migrated Signalco
      packages.
- [ ] Confirm Storybook has stories for all reusable first-party primitives and
      promoted components.
- [ ] Run targeted visual checks for the highest-risk surfaces:
      `apps/app` admin tables/forms, `apps/farm` schedule flows,
      `apps/garden` login/HUD flows, `apps/www` public pages, and `apps/status`
      footer/status cards.
- [ ] Update contributor docs if commands, package boundaries, or Storybook
      expectations changed during the migration.
