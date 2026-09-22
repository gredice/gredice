# Seasonal scene debugging

All seasonal presentation reads `seasonState` from the game store. Lighting,
seasonal effects and debug controls share `freezeTime`; no seasonal component
should create its own current date. Debug date changes also affect plant growth
visuals and suggestions, but never write garden or crop data.

The Debug HUD Time section provides a full-year slider, season starts and
mid/late autumn jumps. Reset time restores the live clock. Calendar changes
preserve clock time, while the sun position naturally changes with the date.

Debug routes accept a strict `date=YYYY-MM-DD` parameter:

- `/debug/profile/game?mode=autumn&date=2024-10-22&fixedTimeSeconds=12&debugHud=1&hud=1`
- `/debug/sandbox?date=2024-11-21`
- `/debug/entities?date=2024-11-21`
- `/debug/entities/Tree?date=2024-10-22`

Malformed dates and impossible calendar days retain the route's default time
(live for sandbox routes, the mode's frozen date for profiles). Profile dates
preserve the selected mode's clock time. These query parameters are read only by
debug routes. `fixedTimeSeconds` controls animation time independently of date.

Import `getSeasonDebugDates` from `@gredice/game/seasonal-debug` for fixture and
story dates: `spring`, `summer`, `earlyAutumn`, `midAutumn`, `lateAutumn`, `winter`.
The default capture year is 2024; callers may supply another year. Each call
returns fresh local-noon dates derived from the shared seasonal milestones.
Calendar and clock parts cross the server/client boundary without a timezone,
then become a browser-local Date. Capture reports record the resolved ISO instant
and browser timezone in their comparison signature; different dates or zones are
incompatible. Use a fixed browser timezone when comparing captures across machines.

Run the HUD browser checks with
`pnpm --filter garden exec playwright test --config playwright.season.config.ts`.

## Deciduous canopy

`autumnState` is resolved alongside the shared season state at every scene-clock
write. It exposes foliage colour, retention, shedding and settled-leaf curves.
Winter keeps the brown/low-retention endpoint; spring gradually regrows foliage.
`Tree` alone opts into the colour curve. Its existing canopy material receives a
memoized HSL colour derived from the stable block ID; cached GLTF materials,
trunk, palms, crops and grass materials stay unchanged. Weather visualization
disablement restores the base canopy. Frozen seasonal stories and WebGL captures
cover summer, early/mid/late autumn, winter, cloudy/twilight light and snow.
