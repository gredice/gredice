# Base UI migration

Date: 2026-08-21
Status: Complete in the migration stack ([epic #4624](https://github.com/gredice/gredice/issues/4624))

## Boundary

`@gredice/ui` owns the public component contracts. Applications and other
packages consume those contracts and must not import Base UI, Radix, or Vaul
directly. `packages/ui` is the only first-party package that imports or declares
`@base-ui/react`.

Base UI is the only directly declared headless primitive library. Radix used
internally by `@mdxeditor/editor` is an intentional third-party exception and
is not an implementation dependency of shared Gredice components.

## Compatibility decisions

| Existing behavior | Final contract |
| --- | --- |
| Radix `asChild` trigger composition | Shared wrappers translate the remaining Gredice-owned compatibility props to Base UI `render`. New component APIs use `render` composition. |
| Menu `onSelect` | Preserve the `(event: Event) => void` contract, including `event.preventDefault()` to keep a menu open. Adapt Base UI event details inside the wrapper. |
| Tabs `forceMount` | Translate the public compatibility prop to Base UI `keepMounted` and preserve automatic activation with `activateOnFocus`. |
| Checkbox indeterminate state | Preserve `checked` and `defaultChecked` as `boolean \| 'indeterminate'`. |
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

## Enforced primitive boundary

`scripts/check-ui-primitives.mjs` rejects Base UI imports outside `packages/ui`
and all first-party imports from `@radix-ui/*` or `vaul`. It also inspects root,
app, and package manifests: only `packages/ui/package.json` may declare
`@base-ui/react`, and no first-party manifest may declare Radix or Vaul in a
dependency, development dependency, optional dependency, or peer dependency.
The guard and its regression tests run in CI.

## Dependency audit

The final audit removed Farm's unused `@mdxeditor/editor` development
dependency. App and WWW still import the editor directly, so their declarations
remain. `pnpm why --recursive @mdxeditor/editor` and representative
`pnpm why --recursive @radix-ui/react-dialog` checks resolve the remaining
chain exclusively as:

```text
@radix-ui/* -> @mdxeditor/editor@4.0.4 -> app (devDependency)
@radix-ui/* -> @mdxeditor/editor@4.0.4 -> www (dependency)
```

`pnpm why --recursive vaul` returns no dependency path, and the lockfile has no
Vaul package. Any future third-party Radix path requires review rather than a
new allowlist entry.

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
