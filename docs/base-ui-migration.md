# Base UI migration

Date: 2026-08-20
Status: In progress ([epic #4624](https://github.com/gredice/gredice/issues/4624))

## Boundary

`@gredice/ui` owns the public component contracts. Applications and other
packages consume those contracts and must not import Base UI, Radix, or Vaul
directly. During the migration, `packages/ui` temporarily contains both
`@base-ui/react@1.7.0` and the existing Radix/Vaul implementations so each
component family can move in an independently reviewable change.

Base UI will be the only directly declared headless primitive library after the
migration. Radix used internally by `@mdxeditor/editor` is an intentional
third-party exception and is not an implementation dependency of shared
Gredice components.

## Compatibility decisions

| Existing behavior | Migration contract |
| --- | --- |
| Radix `asChild` trigger composition | Keep the library-owned compatibility prop until the owning component slice replaces call sites with Base UI `render`. Do not add new `asChild` call sites. |
| Menu `onSelect` | Preserve the `(event: Event) => void` contract, including `event.preventDefault()` to keep a menu open. Adapt Base UI event details inside the wrapper. |
| Tabs `forceMount` | Keep the public compatibility prop through the tabs slice, then translate it to Base UI `keepMounted`. Preserve Radix's current automatic activation with `activateOnFocus`. |
| Checkbox indeterminate state | Preserve `checked` and `defaultChecked` as `boolean | 'indeterminate'`. |
| Popper custom container | Preserve the `container` escape hatch and default to the shared body portal contract. |
| Popper open autofocus | Preserve the cancellable native-event callback while adapting it inside the Base UI wrapper. |
| Slider values | Preserve array-valued `value`, `defaultValue`, `onValueChange`, and `onValueCommit` contracts. |
| Select search | Use Base UI Select for ordinary options and a supported Base UI searchable-selection primitive for searchable or remotely filtered options. |

Public prop types are defined using React, DOM, and Gredice-owned types. They
must not derive from third-party primitive component types.

## Portal contract

Each consuming application marks `body` with
`data-gredice-ui-portal-root` and renders its providers and page content inside
`UiApplicationRoot` from `@gredice/ui/PortalRoot`.

- The body remains the default portal container and is positioned relatively
  for visual-viewport backdrops on current iOS browsers.
- The application root uses `isolation: isolate`, keeping ordinary application
  stacking contexts below overlays portaled to the body.
- Custom overlay containers remain supported where product behavior needs
  them.
- Storybook applies the same body marker and application-root wrapper as the
  Next.js applications.

Do not add app-specific portal root IDs. Use `getUiPortalRoot()` only when a
component needs to resolve the default container explicitly.

## Temporary import guard

`scripts/check-ui-primitives.mjs` rejects Base UI imports outside `packages/ui`
and new first-party imports from `@radix-ui/*` or `vaul`. Its legacy allowlist
contains only the implementation files present in the initial inventory. Every
migration slice must remove its files from the allowlist; stale entries fail
the guard. The final cleanup issue
[#4632](https://github.com/gredice/gredice/issues/4632) replaces the temporary
allowlist with a complete prohibition.

## Delivery order

1. [#4625](https://github.com/gredice/gredice/issues/4625) establishes the
   dependency, contracts, portal boundary, and import guard.
2. [#4626](https://github.com/gredice/gredice/issues/4626),
   [#4627](https://github.com/gredice/gredice/issues/4627),
   [#4628](https://github.com/gredice/gredice/issues/4628), and
   [#4630](https://github.com/gredice/gredice/issues/4630) migrate component
   families in stacked branches.
3. [#4631](https://github.com/gredice/gredice/issues/4631) verifies the combined
   behavior across applications and responsive interaction modes.
4. [#4632](https://github.com/gredice/gredice/issues/4632) removes the obsolete
   dependencies, compatibility code, and temporary allowlist.
