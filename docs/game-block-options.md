# Block options and Proširi (Expand)

## Block options pop-up

Holding a placed block still lifts it after about 0.3 s, as before, and moving
while it is lifted still drags it. Releasing without moving settles the block
and opens the **Radnje za blok: {label}** pop-up beside it, with mouse and touch
alike. A single click and a double-click (rotate) behave as before. The
controls help calls pickup **Drži i povuci** and adds **Radnje s blokom — Drži i
pusti**. The pop-up never takes focus from a pointer open, follows the block
while the camera moves, and closes on Escape, a canvas press, a one-finger pan
or a switch to the 2D view. It is not available in the close-up or avatar
view.

- **Proširi** starts Expand (below).
- **Okreni** sends the same `rotation + 1` as a double-click and keeps the
  pop-up open.
- **Recikliraj** (**Obriši** in sandbox gardens) follows the drag-to-HUD rules:
  the block and everything stacked on it, plus the raised bed's cart items. A
  confirmation names what goes. Its refund line uses the owner's
  `paidSunflowers` from `GET /api/gardens/:gardenId` (`null` for other viewers)
  and matches the server, which refunds the price paid per block: the exact
  total, "nema povrata" when that total is 0, or a neutral line when any block
  has no stored price (legacy and pack blocks). Sandbox gardens show no
  refund line.
- **Pomakni** hands the press to the normal move: press the tile and drag, or
  tap it, then tap or drag to the destination. Escape puts the block back.

An unavailable tile stays focusable and shows its reason in the status line.
Unsaved blocks and a pending Expand disable every tile.

## Proširi

Expand works for 1×1 blocks. It is not offered for multi-cell blocks, raised
beds, garden boxes, gift boxes, animals, animal homes or `WoodenSign`. The
player drags the knob (or taps a cell, or uses the arrow keys on the focused
knob) to stretch a rectangle of see-through copies that keep the source's
rotation. Only empty cells at the same level get a copy: the same stack height
and the same kind of support underneath. Other cells are skipped and counted.
The corner is capped at 10 × 10 for instanced types (terrain, bushes, flowers)
and 5 × 5 for other blocks. The server accepts at most 100 placements in a
10 × 10 box. Holding the knob at the canvas edge pans the camera; a knob that
starts near an edge (common on phones) pans only once the pointer pushes
further toward that edge or leaves the edge band.

The bar shows the area, the number of new blocks, the total and **Imaš**, the
same balance as the sunflower HUD (balance minus the shopping cart). If the
player cannot afford every copy, **Potvrdi postavljanje** is disabled and the
bar says how many they can afford. Night-only blocks say so by day.

One confirm sends one all-or-nothing `POST /api/gardens/:gardenId/blocks/batch`
with `operationId`, `blockName`, `rotation` (0–3), `expectedUnitPrice` (0 in
sandbox gardens) and each placement with its expected existing blocks. The
server debits once (`gardenBlock:<gardenId>:expand:<operationId>`), stores the
paid price on every new block, replays a repeated `operationId`, and allows 30
batches per account in 10 minutes. The client stores the command in session
storage before sending. After a lost response it offers **Provjeri isti
zahtjev**, which resends the identical body. Sunflower history shows the debit
as **Proširivanje bloka**.

Ghosts draw one instanced mesh per template part; fences, shade and water get
one template per neighbour shape. Terrain copies share one rim. Nothing renders
per frame while the preview is idle.

Code: `packages/game/src/blockOptions` (pop-up, removal, Expand preview and
bar), `packages/game/src/controls/pickupReleaseIntent.ts`,
`blockMoveAnchor.ts` and `blockMoveCarry.ts` (gestures), and
`@gredice/js/gardenBlockExpansion` (shared rules). The server side is
`apps/api/lib/garden/gardenBlockBatchPurchaseService.ts` with the client in
`packages/client/src/garden-block-batch.ts`.

Validation from the repository root:

```sh
pnpm --filter @gredice/js test
pnpm --filter @gredice/game test
pnpm --filter @gredice/game exec tsc --noEmit
pnpm --filter garden exec playwright test --project=chromium-webgl-block-options
```

The browser specs mount `packages/game/tests/BlockOptionsFixture.tsx` and stub
every write.
