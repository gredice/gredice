# Rendered game icons

Use `@gredice/ui/GameIcons` for the garden's illustrated actions and objects.
The images match the chunky low-poly geometry, beveled edges, warm wood, greens,
and shaded materials of the existing backpack and shopping basket HUD artwork.

- `assets/*.webp` contains the selected transparent rendered artwork, generated
  with the built-in image tool. The exact prompts and reference descriptions are
  recorded in `assets/prompts.json`. `backpack.webp` reuses the existing
  `apps/garden/public/assets/hud/inventory-backpack.webp` byte-for-byte; the
  public copy remains available for the existing inventory HUD image URLs.
  Both backpack copies use a lossless re-encoding of the original artwork to
  avoid browser decoding failures, with all visible pixels preserved.
- Exports retain `SVGProps<SVGSVGElement>`. An SVG frame embeds the bitmap, so
  existing sizing, titles, accessibility attributes and event handlers still work.
- Static imports let Next.js and Storybook bundle and cache the assets. There
  are no production CDN dependencies.
- Generated assets are trimmed only in their empty alpha margins, downsampled to a maximum
  content edge of 320px and padded by 8px. WebP preserves full-quality alpha.
  The reused backpack retains its original 512px dimensions and padding.
- `GameRaisedBedIcon` keeps the physical ID as real, contrasting text, including
  numeric zero. Its existing width reservation and upper inset remain in place.
- Keep the default outline appearance of `RaisedBedIcon` unchanged.

Review `packages/ui/Icons/GameIcons` in Storybook beside the original backpack
and basket, at 16–64px and in light/dark themes. The story checks that every
bitmap loads and that physical identifiers stay clear of artwork and nearby text.

Review related destinations as a group: bed details use Journal, Tools and
Information; plant details use Seedling, Journal and Tools. Their shared
`RaisedBedDetailsTabsList` is rendered in the icon story, including historical
plants without actions. Camera and History cover adjacent photo and past-action
controls. Keep compact status indicators and standard utility controls legible.
