# Game icon reference snapshots

Original Gredice CDN artwork, copied on 2026-09-09 to keep the in-game icon
inventory independent of live services:

- `sunflower-large.svg`: https://cdn.gredice.com/sunflower-large.svg
- `advent-hat-512x493.png`: https://cdn.gredice.com/assets/advent-hat-512x493.png
- `advent-gift-box-secret-766x714.png`: https://cdn.gredice.com/assets/advent-gift-box-secret-766x714.png

HUD images and the recycle texture are imported directly from garden's existing
public assets. Refresh these snapshots when the corresponding CDN artwork changes.
The usage baseline lives in `stories/packages/game/icons/gameIconUsage.ts`;
update it when game or garden icon imports change. Keep aliased exports separate
because their replacement contexts may differ.
