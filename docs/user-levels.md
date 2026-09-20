# User levels and public leaderboard

`/korisnici` lists up to ten registered, non-temporary users with approved
achievements, linking to their existing public profiles. Rankings use approved
achievement count descending, user registration date ascending, then user ID.
The public API returns the same safe display-name projection as public profiles;
login names and email addresses are excluded.

Achievements remain account-owned. A user's primary account is their earliest
`account_users` membership, with membership ID breaking timestamp ties. Shared
account members share the same score; additional accounts and duplicate
memberships do not inflate it. Only approved, recognized achievement keys count.
In addition to welcome, planting, watering, harvest, and community edits,
accounts can earn:

- **Raznolik vrt:** distinct parent-plant species from confirmed sowings
- **Od sjemena do stola:** unique plantings that were sowed and later harvested
- **Sezona za pamćenje:** qualifying sowing or a completed cycle in a defined
  2026 growing season (spring, summer, autumn in `Europe/Zagreb`)

The API achievement cron runs hourly at minute zero and replays the full
available planting history, including soft-deleted plantings, catalogue links,
and activity from before these families were introduced. It creates missing
awards as pending for admin approval, preserving
existing pending, approved, and denied rows; no manual data backfill is needed.
Seasonal dates use selected lifecycle `effectiveAt` or legacy `effectiveDate`,
falling back to the event creation date when missing or invalid. Milestone
awards store the threshold count and the date that threshold was reached.

Each achievement earns 100 XP. Level L starts at `100 × L × (L − 1) / 2` XP:
levels 1–8 begin at 0, 100, 300, 600, 1000, 1500, 2100, and 2800 XP. The shared
calculation lives in `packages/js/src/achievements/progression.ts`. Existing
awards count immediately, without migrations or a backfill. XP is independent
of sunflower rewards, purchases, and spending. Approval/rejection changes are
reflected on the next data read.

`UserAvatar` accepts `achievementCount` and renders a numbered, colored badge
using sprout, leaf, flower, and award icons. User projections provide this value
across public, garden, admin, farm, referral, and history views. Unknown or
historical actors without a surviving user, and older cached responses without
the field, keep a plain avatar rather than an invented level. Public profiles
and garden profiles also show XP and progress. Earning every available award
shows completion instead of promising a currently unreachable next level.

The leaderboard uses a fresh server request to `GET /api/users/public/leaderboard`
with a ten-second timeout. Failures show a retry state; an empty ranking never
substitutes demo users. It is linked from the public footer and included in the
sitemap source paths. Roll out the API before the WWW route.

Focused checks:

```sh
pnpm --filter @gredice/storage test:node userLeaderboardRepo.node.spec.ts achievementsGardenFamilies.node.spec.ts
pnpm --filter @gredice/js exec node --import tsx --test src/achievements/progression.unit.ts src/achievements/families.unit.ts src/achievements/gardenProgress.unit.ts src/achievements/seasons.unit.ts
pnpm --filter www test:public-profile
pnpm --filter www typecheck
```
