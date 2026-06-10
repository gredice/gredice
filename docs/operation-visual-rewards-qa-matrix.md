# Operation Visual Rewards QA Matrix

This matrix tracks the garden scene before/after reward behavior for completed real operations. It is meant for release review of the operation visual reward stack and should stay aligned with the `attributes.visualReward` operation attribute, `packages/game/src/operationVisualRewards.ts`, and the raised-bed render helpers under `packages/game/src/entities/raisedBed/`.

## Source Rules

- Completed, confirmed, and pending-verification operation states can create visual rewards.
- Planned, failed, canceled, and unknown operation states must not create visual rewards.
- `attributes.visualReward` is the source of truth for reward selection. Supported values are `watering`, `weeding`, `mulch`, `removeMulch`, `agrotextile`, `removeAgrotextile`, `supports`, `harvest`, and `photographyUpdate`.
- Operation names, labels, stage labels, descriptions, instructions, image paths, and remove/apply wording must not infer visual rewards.
- Field-scoped operations affect only the matching raised-bed field.
- Raised-bed-scoped operations affect the raised bed according to the visual family.
- Watering uses a darker moist-soil tint only. Do not add small droplets; they do not read well in the low-poly world.
- Photography updates use the existing photography operation history and its `imageUrls`. Do not introduce a separate proof-photo concept.
- Existing production operation definitions are backfilled by `packages/storage/scripts/upsertOperationVisualRewardAttributes.ts`; future operation changes should be controlled through the operation attribute in admin.

## Matrix

| Operation | `attributes.visualReward` | Before State | After Reward | Scope Checks | Time / Freshness | Automated Coverage |
| --- | --- | --- | --- | --- | --- | --- |
| Watering | `watering` | Dry raised-bed soil. | Darker moist-soil tint. | Field rewards tint only the matching field; raised-bed rewards tint planted fields in the bed. | Visible for 72 hours after the reward timestamp. | `raisedBedWateringRewards.unit.ts`; `RaisedBedFields.tsx`. |
| Weeding | `weeding` | Admin- or AI-entered weed state on bed or field. | Weeds disappear and the soil reads clean. | Field weeding clears only the matching field; bed state applies to fields without newer field overrides. | Persistent until a newer weed observation is entered. | `raisedBedWeedState.unit.ts`; admin controls in raised-bed edit UI. |
| Mulch | `mulch` | Bare planting surface. | Straw/mulch layer appears. | Whole-bed mulch covers the bed; field mulch covers the target field and can override older field mulch. | Persistent until a newer matching remove-mulch reward. | `raisedBedMulchVisualRewards.unit.ts`; `raisedBedMulchOperationOrder.unit.ts`. |
| Remove mulch | `removeMulch` | Straw/mulch layer exists. | Matching layer is removed and the planting zone is clean. | Field removal does not clear whole-bed mulch; whole-bed removal clears the whole-bed layer. | Persistent until a newer matching mulch reward. | `raisedBedMulchVisualRewards.unit.ts`. |
| Agrotextile | `agrotextile` | Exposed bed or field. | Low-poly fabric cover appears and hides plants/weeds under covered positions. | Raised-bed cover marks every local field position; field cover marks the matching active field. | Persistent until a newer matching remove-agrotextile reward. | `raisedBedAgrotextileRewards.unit.ts`; `RaisedBedFields.tsx`. |
| Remove agrotextile | `removeAgrotextile` | Covered bed or field. | Cover disappears and plants/planting zone render again. | Field removal preserves covers on other fields; whole-bed removal clears the whole-bed cover. | Persistent until a newer matching agrotextile reward. | `raisedBedAgrotextileRewards.unit.ts`. |
| Supports | `supports` | Unsupported plants. | Stakes and tie bands appear beside supported plants. | Raised-bed support marks planted fields; field support marks only the matching planted field. | Persistent visual reward. | `raisedBedSupportRewards.unit.ts`; `RaisedBedFields.tsx`. |
| Harvest | `harvest` | Ripe plants with produce. | Crate with produce appears; generated plant produce/flowers are reduced for harvested positions. | Field harvest changes only the matching planted field; raised-bed harvest marks planted fields in the current block. | Persistent visual reward. | `raisedBedHarvestRewards.unit.ts`; generated plant batch props. |
| Photography update | `photographyUpdate` | Old garden/photo state. | Photo/update marker appears from latest photography operation images. | Raised-bed photo creates centered marker; field photo creates marker on the matching field. | Source is latest operation history item with images; no separate proof-photo state. | `raisedBedPhotographyRewards.unit.ts`; `useRaisedBedOperationVisualRewards.ts`. |

## Manual Visual Review

Use this pass before rollout or when any row changes:

1. Start the garden app locally or open the preview environment with the full operation visual reward stack.
2. Review desktop and mobile viewports for each operation family.
3. Confirm the canvas is nonblank, correctly framed, and controls still work.
4. Confirm field-scoped rewards do not bleed into neighboring fields.
5. Confirm removal rewards visibly undo only the matching visual family and scope.
6. Confirm watering remains readable as moist soil without relying on droplets.
7. Confirm photography markers point back to existing operation history/photos rather than a new proof-photo workflow.
8. Confirm each reviewed operation has the expected `attributes.visualReward` value in admin.

## Validation Commands

Runtime visual changes in this stack were validated with:

```bash
pnpm --filter @gredice/game test
pnpm --filter @gredice/game typecheck
pnpm --filter @gredice/game lint
pnpm --filter garden build
git diff --check
```

For docs-only updates to this matrix, `git diff --check` is sufficient.
