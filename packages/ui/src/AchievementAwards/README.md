# Achievement awards

Shared artwork and family presentation for the garden, public profiles, and admin achievement views. All 68 milestone keys map to distinct illustrations in `artwork.ts`, including ten garden-diversity awards, ten seed-to-table awards and three 2026 seasonal awards. The registry requires artwork for every known key at compile time. Shared domain definitions in `@gredice/js/achievements` contain no image imports.

## Usage

```tsx
import { AchievementAward } from '@gredice/ui/AchievementAwards';

<AchievementAward achievementKey="planting_20" className="size-24" />
```

Use `aria-hidden` when adjacent text already identifies the award. Otherwise the component supplies the Croatian title and level. Levels are real UI text through `AchievementLevelLabel`; they are never painted into the image. Unknown keys use a neutral information icon.

`AchievementFamilyCard` and `AchievementFamilyDetails` consume `getAchievementFamilies(records)`. Only approved records count as earned. Pending, denied and locked levels remain visible with explicit status labels. Keep the current API's `progressValue` out of live progress bars: it is an earned milestone snapshot, not a current action count.

The garden announces approvals observed after the collection's initial load. It establishes a new baseline when account identity changes, summarizes several approvals in one notice, and honors reduced motion. Opening an existing collection does not replay old awards.

## Artwork

- One standalone illustration per achievement; no recolored duplicates or crops from the concept board. Only unknown keys use the information-icon fallback.
- 512px square WebP, with a fixed reserved area and a shared bottom alignment. Larger visual grades fill more of that area without changing the clickable layout.
- Images were generated with the built-in `image_gen` tool. Original prompts are in `assets/prompts.json`; the 13 garden-family prompts, source hashes and export details are in `assets/garden-families-prompts.json`. The 21 advanced milestone prompts and hashes are in `assets/headroom-prompts.json`. The approved direction is in `docs/achievement-awards/proposal.md`.
- The original 34 images used local macOS Vision background extraction. The 13 garden-family images preserve generated transparency and are resized with consistent padding. Exports are checked for distinct hashes, decoded dimensions, transparent borders and clean rendering on light and dark backgrounds.

Garden diversity progresses from a terracotta mixed planter to a tiered botanical garden with a butterfly arbor. Seed-to-table progresses from a carrot and seedling keepsake to a garden banquet pavilion. Spring, summer and autumn use fresh shoots and dew, ripe tomatoes and sunshine, and a pumpkin harvest respectively. Higher levels change the structure and silhouette; teal, leafy green, terracotta, purple and orange carry the palette, with restrained metal details.

## Coverage

Storybook: `packages/ui/AchievementAwards` (all current awards plus focused `NewFamilies` / `NewFamiliesDark` and `AdvancedLevels` / `AdvancedLevelsDark` views, three sizes, light/dark) and `packages/game/Achievements/Collection` (empty, starter, experienced, complete, dark). The GardenWorkspace showcase also includes the real collection.

Domain checks: `pnpm --filter @gredice/js exec node --import tsx --test src/achievements/families.unit.ts`.

Garden browser checks: `pnpm --filter garden exec playwright test --config playwright.achievements.config.ts`.

Public profile checks: `pnpm --filter www exec playwright test --config playwright.profile.config.ts` and `pnpm --filter www exec node --import tsx --test tests/publicProfile.node.spec.ts`.

Existing keys, artwork, approval requirements and sunflower balances are preserved. No storage migration is needed. The current-account API also returns `activity.counts` and `activity.calculatedAt`. Pass `activity` to `AchievementFamilyDetails` to show a numeric next-goal bar, current verified count and remaining amount. Missing activity shows an unavailable state, never a fabricated zero. Reached goals remain pending until approved; seasonal/registration and fully completed families do not show a numeric bar. A favorites shelf remains later work.
