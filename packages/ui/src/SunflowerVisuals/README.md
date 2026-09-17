# Sunflower visuals

`SunflowerPackageVisual` selects an illustration by the stable package code. It is shared by the game package cards, package purchase history and public `/suncokreti` page. Unknown codes deliberately fall back to the small pouch so new catalogue entries still render.

| Code | Artwork |
| --- | --- |
| `mali_zalogaj` | Teal fabric pouch |
| `vrtna_kosarica` | Green basket |
| `mirna_sezona` | Blue wooden crate |
| `puna_gredica` | Terracotta raised-bed planter |
| `majstor_vrtlar` | Golden wheelbarrow |

The illustration is decorative beside a package name. Prices, amounts, bonuses and eligibility always come from the catalogue, never from a flower count or the illustration. Pass `aria-hidden` when the adjacent text names the package. The component otherwise provides its own accessible label and accepts the existing SVG icon props.

`SunflowerMascot3D` is the approved rendered 3D-style mascot. `GameSunflowerIcon` uses the same artwork for currency, rewards and navigation; `sunflowerMascotArtwork` supports Next.js images and DOM payment particles. `SunflowerText` renders currency marks in explicit UI labels while leaving stored text unchanged. This is transparent raster artwork, not a rigged or interactive 3D model.

## Provenance

Eight original transparent PNGs were generated with the built-in image-generation tool using the existing Gredice mascot, backpack, basket and gift assets as visual references. Exact prompts and reference paths are recorded in [assets/prompts.json](assets/prompts.json). Only resizing and WebP encoding were applied with Sharp; original alpha and composition were retained.

- Package artwork: 512 × 512 WebP.
- Mascot: 768 × 768 WebP.
- Related birthday/refund event icons: 384 × 384 WebP under `../GameIcons/assets`.

The palette uses teal, green, blue and terracotta, with a golden wheelbarrow for Majstor vrtlar at the user’s request.

## Previews

- `packages/game/hud/SunflowerEconomy`: real package cards and history with offline fixtures; light, dark and a constrained 400px profile.
- `packages/ui/Icons/SunflowerVisuals`: each package, unknown-code fallback and previous/current mascot comparison.
- `packages/game/icons/InGameIcons`: searchable artwork inventory.

Game earn/spend history reuses basket, calendar, gift, receipt, community, tasks, blocks and ruler artwork, plus new mint refund-arrow and birthday-cake icons. Existing achievement awards and block previews retain their identity.

## Rollout boundaries

Game HUDs, assistant portraits, reward screens, package totals, checkout, build-mode prices, public pages and admin balances use the approved mascot. Decorative sunflower emojis in authored prose, metadata, email/plain-text notification content remain text. Existing sad/gift illustrations and the physical garden sunflower model are separate expressions/entities. Backend notification artwork uses a stable public copy at `apps/www/public/assets/sunflower-3d.webp`, identical to the shared source.
