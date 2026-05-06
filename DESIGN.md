# Design Guide

Use this guide for visual and interaction design decisions.

## Product surfaces

- `www`: polished public marketing and commerce pages. The product, offer, plant, operation, or place should be visible and inspectable early.
- `garden`: immersive customer experience. Favor tactile interaction, clear garden state, readable HUDs, and smooth responsive behavior.
- `farm`: operational interface. Favor dense, calm layouts for repeated farm work.
- `app`: internal admin interface. Favor scannable tables, filters, forms, status indicators, and predictable navigation.
- `storybook`: documentation surface. Favor isolated examples, states, variants, and clear component names.

## Visual standards

- Follow the app's existing Tailwind, typography, spacing, and component patterns before introducing new visual language.
- Reuse `@gredice/ui` and `@signalco/ui` primitives first.
- Avoid decorative layouts that reduce task clarity in admin and farm tools.
- Use cards for repeated items, modals, and genuinely framed tools. Do not nest cards inside cards.
- Keep repeated operational views compact and aligned. Avoid oversized hero-style typography inside panels, tables, cards, and sidebars.
- Avoid one-note palettes. Use the existing app palette and status colors rather than building an entire view from one hue family.
- Make loading, empty, error, disabled, and success states part of the design, not afterthoughts.

## Interaction standards

- Use icons for common tool actions when an established icon exists.
- Use segmented controls for modes, toggles or checkboxes for binary settings, sliders or numeric inputs for numbers, menus for option sets, and tabs for sibling views.
- Text in controls must fit at mobile and desktop widths.
- Layout dimensions should be stable for boards, grids, toolbars, counters, and tiles so hover states and dynamic labels do not shift the interface.
- Do not expose instructions about how the UI works as permanent page copy when the control can be made self-evident.

## Responsive behavior

- Verify dense app views at mobile, tablet, and desktop breakpoints when touched.
- Public pages must keep the first viewport meaningful on mobile and desktop.
- Game and canvas views must avoid blank, clipped, or unclickable primary content.
- Avoid viewport-width font scaling. Use responsive layout constraints instead.

## Storybook expectations

- New reusable UI components need stories under `apps/storybook/stories`.
- Stories should cover the meaningful states: default, loading, empty, disabled, error, long content, and any important variants.
- Keep stories close to real product usage rather than synthetic decoration.
