# Autumn 2026: three small-garden arrangements

Manual placement references for [#4983](https://github.com/gredice/gredice/issues/4983),
following the [autumn art direction](autumn-art-direction-2026.md). These compositions
reuse original Gredice models. They do not define purchasable packs, grant inventory,
automatically place objects, publish draft catalogue items, or change customer dates.

The single source is [`autumnArrangements`](../packages/game/src/arrangements/autumnArrangements.ts),
exported as `@gredice/game/autumn-arrangements`. Collection IDs match the autumn picker:
`harvest`, `woodland`, and `evening`. A reference can be shown only when every pictured
identity resolves in the published directory, every included decoration is for sale,
and its reviewed footprint still matches. Sandbox previews may use local fixture data.

## Exact compositions

“Included” below means the decoration list for this manual reference; it is not a
commercial offer. Quantities count placeable catalogue objects. Three pumpkins in a
pumpkin-group model count as one object; the tea table, thermos, and two cups are one
object; the blanket is part of its bench. No colour or variant is chosen randomly.

| Reference | Included decoration objects | Occupied cells | Reserved corner |
| --- | --- | --- | --- |
| Kutak jesenske berbe | 1 × `HarvestPumpkinGroupOrange`; 1 × `HarvestPumpkinSquatCream`; 1 × `HarvestCrateOrchard`; 1 × `GardenScarecrow` | 4 | 2 × 3 |
| Staza uz šumski kutak | 1 × `WoodlandMushrooms`; 1 × `StoneMedium`; 1 × `AutumnLeafPileCrescent`; 1 × `FallenLog` | 5 | 2 × 3 |
| Mjesto za toplu večer | 1 × `AutumnBlanketBench`; 1 × `GardenTeaTable`; 1 × `EnamelGardenLamp`; 1 × `AutumnAsterPotMauve` | 5 | 2 × 3 |

All three pictures also contain **scenery outside the decoration list**: 16 ×
`Block_Grass`, 1 × `Tree`, 1 × `Pine`, and 3 × `StoneWalkway`. Lighting, sky/clouds,
shadows and seasonal leaf colour are environment presentation, not additional items.
The full pictured garden is 4 × 4. Ten cells lie outside the reserved 2 × 3 corner.
The log and blanket bench each reserve two supported cells; nothing sits on them.

Coordinates and quarter-turn rotations are in the manifest; `(0,0)` is the front
corner, X/Z increase across the garden, and all current rotations are zero. The
fixture translates the garden by `(-2,0,-2)` without changing spacing or model scale.
The stone path at X=2 runs from Z=0 through Z=2. The open approach is `(1,1)` for
harvest/woodland and `(1,2)` for the bench. Trees remain behind the props.

## Capture matrix and reproduction

The opt-in isolated fixture mounts production `Scene`, `Environment`, and individual
`EntityFactory` components with local assets and local mock catalogue data. It blocks
remote and non-read requests, supplies no customer plants or operations, freezes the
shared scene clock at debug milestones, and disables audio. Capture dates never reach
a customer garden.

Each composition is captured at early/mid/late autumn from `getSeasonDebugDates(2026)`
and day/overcast/dusk/night, at both 780 × 600 high quality and 390 × 440 low quality
with reduced motion. DPR is 1, animation time is fixed at 12 seconds, springs are
static, wind/rain/snow inputs are zero. Overcast uses cloudy=1; dusk uses the existing
solar-time resolver at 0.8, and night is 22:30 local time in Europe/Zagreb.

```sh
pnpm install --frozen-lockfile
pnpm --filter @gredice/game exec tsx --test src/arrangements/autumnArrangements.unit.ts
pnpm --filter garden exec playwright test --config playwright.autumn-arrangements.config.ts --update-snapshots
```

Commit source inputs before capturing. The harness rejects dirty inputs outside its
two output folders, records the input commit/tree and each scene's actual ISO time,
season state, object identities, geometry counts and projected bounds, and verifies
that no source changed during capture. High-quality early-day images are copied
byte-for-byte to `apps/garden/public/assets/arrangements` for collection previews.
Every pictured object must have geometry and fit inside the canvas; decoration
bounds must remain larger than 14 × 10 pixels on the small canvas. These bounds
checks complement visual inspection; they are not an occlusion or device-performance
benchmark. The committed JSON records are the reproduction evidence.
