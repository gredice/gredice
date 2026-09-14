# Weather icons

The weather HUD, current conditions and forecast details share seven transparent
WebP pieces: sun, moon, cloud, raindrop, snowflake, lightning and fog. They use the
same chunky, faceted 3D style as the game's backpack and shopping basket.

`weatherDefinitions.ts` keeps the existing provider condition IDs (1–42) and
accessible Croatian descriptions. `weatherComposition.ts` positions the pieces
inside a 64×64 viewBox. Cloud coverage changes the celestial/cloud balance;
precipitation intensity changes the number of drops or flakes. Sleet always
includes both. Thunder and fog remain visible alongside precipitation. Night
uses a crescent and darker clouds without changing the underlying conditions.

`WeatherIcons.tsx` retains the `weatherIcons[code].day` / `.night` SVG component
API and SVG props. The six original named icon modules re-export those pairs for
compatibility. `RainIcon` reuses the raindrop with its existing bottom-up indicator
fill and 16px footprint; finite percentages are clamped to 0–100.
The `chance` prop controls only visual fill: existing callers also derive it
from rainfall amounts. Its accessible name stays generic (`Oborine`) so those
amounts are not incorrectly announced as precipitation probabilities.

Sun, moon, cloud, snowflake and fog live with this package. Water and lightning
live in `packages/ui/src/GameIcons/assets` and are shared through
`gameWeatherArtwork` with the soil-moisture and neighbour HUD icons. Next.js
consumers and Vite Storybook bundle the same source files. `WeatherArtwork.tsx` handles the static-image import shape
in both bundlers. There are no CDN URLs or runtime image generation calls.

The images were created with built-in image generation. Exact prompts and style
references are recorded in `assets/prompts.json`. Only transparent-margin trimming,
resizing and WebP encoding were applied after generation; alpha is preserved.

Review `packages/game/Icons/WeatherIcons` in Storybook for all 84 variants at 64px
and the actual 24px HUD size on light and dark backgrounds. The full in-game icon
inventory also includes every variant. The focused story checks asset decoding
and indicator fill; `weatherComposition.unit.ts` checks condition coverage,
viewBox bounds and mixed-weather semantics.
