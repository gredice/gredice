# Raised-bed planting presentation

Legacy and selected (advanced-sowing) records use the same plant presentation.
Only recorded facts are shown: missing spacing, density, or footprint data is
not a warning and must not be inferred from today's catalogue.

## Surfaces

| Surface | Presentation |
| --- | --- |
| Admin raised-bed detail | Shared `RaisedBedFieldsGrid`, `RaisedBedPlantItem`, and `RaisedBedPlantDetails`; field controls and planting actions retain their original command identities. |
| Farm raised-bed detail | The same grid and plant components; legacy and completed selected plantings support status-change requests through Admin approval. Selected requests carry the planting ID, variety and lifecycle version; stale requests cannot change a newer planting state. Completed plantings are behind history, not a second active-planting card. |
| Farm raised-bed overview | Compact previews use the same footprint grouping and show all companion plants. Beds keep three columns on every screen, with missing physical identifiers reserved and identifier 1 at the bottom-right. |
| Admin and Farm greenhouse | One row per occupancy record, all field numbers, and optional `RaisedBedPlantingFacts`; mobile and desktop receive the same facts. |
| Garden field HUD | Existing `RaisedBedFieldItemPlanted` modal (Biljka, Dnevnik, Radnje) for both methods, the existing plant-grid icon beside the count, a numbered footprint only for multi-field plantings, and explicit plant selection per field. Selected sowing tasks reuse the operation card and reschedule/cancel dialogs. Radnje also offers applicable operations for confirmed plantings, and Dnevnik shows their lifecycle and operation history; the default plant tab has no editing forms. Overlapping footprints contribute to one field selector. Pending cart controls remain accessible. |
| Schedule and approvals | Keep their task presentation and role-specific completion/approval controls. Central approvals include one selected sowing verification per planting. Selected task labels include saved count, density, footprint, and spacing; these are task views rather than a second planting inventory. |
| Desktop | Hosts the Garden, Farm, and Admin web apps; there is no separate planting renderer. |
| Public site and Delivery | No editable raised-bed planting view to migrate. Their catalogue/offer and delivery-item views remain separate product surfaces. |

## Spatial and action rules

- `getRaisedBedFieldGroups` in `@gredice/js/plants` is the Admin/Farm spatial
  boundary. It retains all physical cells while joining the bounding rectangles
  of shared plantings. Companion and empty cells inside a group keep explicit
  field numbers. Each active planting appears once within its group.
- Farm uses the compact grid on every screen, retaining three physical columns.
  Admin retains the default responsive grid, stacking groups on phones.
- Farm detail places each planting's date/details trigger in its anchor field
  header. An unsowed planting shows “Nije posijano”; no sowing date is inferred.
  Single-field items omit the repeated field number. Multi-field groups retain
  planting membership labels, including companions and empty fields.
- Farm status requests use outlined chips with full-size illustrated icons.
  The greenhouse uses the same light outlined treatment on desktop and mobile.
- Garden builds each field's selectors from actual memberships, including
  plantings with different overlapping footprints. Tabs only include plants that
  occupy the selected field.
- Rendering must not turn display occupancy into a mutation identity. Preserve
  selected-planting IDs/versions, legacy cycle IDs/versions, and role-specific
  actions. Selected-planting lifecycle status remains read-only in the customer
  field HUD; legacy plant cycles retain the status menu below.
- Collision/capacity validation remains in the sowing picker. Removing a legacy
  information notice does not relax those checks.

## Customer plant status menu

The legacy plant status menu and Garden PATCH endpoint share
`userAllowedPlantStatusTransitions` in `@gredice/js/plants`. Existing statuses
are offered according to the current stage:

| Current state | Available changes |
| --- | --- |
| Sowed | Sprouted, failed to sprout |
| Sprouted | First flowers, first fruits, ready for harvest, died; existing corrections to sowed or failed to sprout |
| First flowers | First fruits, ready for harvest, died |
| First fruits | Ready for harvest, died |
| Ready for harvest | Harvested, died; existing correction to sprouted |
| Failed to sprout or died | Existing correction to sprouted |

Sowed plants must sprout before later growth or harvest stages. Flowering and
fruiting are optional because some crops are harvested without those stages.
Harvest completion requires harvest readiness. Planning, sowing verification,
and plant removal retain their separate controls. Garden owners can clear a
field without the paid plant-removal operation only after a clean harvest or
when the field never sprouted. Changing a sprouted plant to failed-to-sprout
does not skip that charge. Other harvested or dead plants stay in the field
until the plant-removal operation is scheduled and paid. Changes retain date
confirmation and active-cycle identity and version checks.

## Verification

Component tests cover Admin and Farm mobile/desktop layouts, optional details,
legacy history without warnings, greenhouse footprints, and Garden co-plant
selection, overlapping footprints, pending carts, and owner controls. Pure
footprint tests cover co-plants, overlapping rectangles, and missing memberships.
Shared examples are available in Storybook under `UI/Raised beds/Fields` and the
raised-bed component showcase.

## Applied additions and catalogue corrections

Admin and Farm raised-bed details share `RaisedBedAddons`. Field indicators open
operation details with the application date, affected fields, and verification
state. Whole-bed additions also appear above the grid; partial removal lists the
remaining fields instead of claiming whole-bed coverage.

`resolveRaisedBedAddons` uses the directory's existing `visualReward` attribute
and applied operation statuses for mulch, supports, agrotextile and insect mesh.
It processes applications and removals by completion time (creation time fallback,
then operation ID), resolving each family at each physical field. Bed additions
include empty fields. Removing a plant clears all earlier additions at its physical
field, including inherited whole-bed coverage. Legacy removal dates are read from
all field cycles; selected-planting removals clear the exact membership footprint.
This cleanup persists through replanting. Only an application strictly after the
removal restores coverage; equal timestamps favor cleanup. Harvested/dead plants,
failed germination and cancelled plans do not imply physical removal.
Field treatments marked `appliesToEmptyFields` can be applied to an empty field
and remain when it is planted, until a later removal. Other field additions belong
to the active plant cycle. Selected-planting operations follow that planting's
exact memberships.
Missing plant targets are never promoted to whole-bed coverage. Pending
verification is visibly distinguished; planned, cancelled and unrelated operations
are excluded. This is a projection of recorded operations, not a physical inventory.

Admin's **Ispravi sortu** control corrects any active planting, including crops
that have already sprouted or fruited. It retains the cycle/planting identity,
status, dates, footprint, plant count, spacing and purchase snapshot. Corrections
are authorized and version checked inside the existing task transaction locks.
Legacy corrections use `plantReplaceSort`; selected corrections use
`raisedBedPlanting.sort.corrected`, preserving the initial catalogue ID in the
lifecycle-start event and task read model so checkout replays still match the
original immutable plan. The current selected catalogue ID and its correction
event are updated atomically. Farm remains read-only for catalogue corrections.
