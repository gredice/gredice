# Achievement awards

Shared artwork and family presentation for the garden, public profiles, and admin achievement views. Each of the 34 existing milestone keys maps to a distinct illustration in `artwork.ts`. Shared domain definitions in `@gredice/js/achievements` contain no image imports.

## Usage

```tsx
import { AchievementAward } from '@gredice/ui/AchievementAwards';

<AchievementAward achievementKey="planting_20" className="size-24" />
```

Use `aria-hidden` when adjacent text already identifies the award. Otherwise the component supplies the Croatian title and level. Levels are real UI text through `AchievementLevelLabel`; they are never painted into the image. Unknown keys use a neutral information icon.

`AchievementFamilyCard` and `AchievementFamilyDetails` consume `getAchievementFamilies(records)`. Only approved records count as earned. Pending, denied and locked levels remain visible with explicit status labels. Keep the current API's `progressValue` out of live progress bars: it is an earned milestone snapshot, not a current action count.

The garden announces approvals observed after the collection's initial load. It establishes a new baseline when account identity changes, summarizes several approvals in one notice, and honors reduced motion. Opening an existing collection does not replay old awards.

## Artwork

- One standalone illustration per existing achievement; no recolored duplicates or crops from the concept board.
- 512px square WebP, with a fixed reserved area and a shared bottom alignment. Larger visual grades fill more of that area without changing the clickable layout.
- Original images were generated with the built-in `image_gen` tool. Exact prompts are in `assets/prompts.json`; the approved direction is in `docs/achievement-awards/proposal.md`.
- Transparent backgrounds were extracted locally with macOS Vision, then the masks were inset to remove the generator’s painted checkerboard fringe. Exports are checked for distinct hashes, decoded dimensions, transparent borders and clean rendering on light and dark backgrounds.

## Coverage

Storybook: `packages/ui/AchievementAwards` (all 34 images, three sizes, light/dark) and `packages/game/Achievements/Collection` (empty, starter, experienced, complete, dark). The GardenWorkspace showcase also includes the real collection.

Domain checks: `pnpm --filter @gredice/js exec node --import tsx --test src/achievements/families.unit.ts`.

Garden browser checks: `pnpm --filter garden exec playwright test --config playwright.achievements.config.ts`.

Public profile checks: `pnpm --filter www exec playwright test --config playwright.profile.config.ts` and `pnpm --filter www exec node --import tsx --test tests/publicProfile.node.spec.ts`.

Existing keys, thresholds, approval requirements and sunflower balances are preserved. No storage migration is needed. Live progress projections, new families, seasonal awards and a favorites shelf remain later work.
