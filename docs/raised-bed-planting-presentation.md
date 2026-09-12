# Raised-bed planting presentation

Legacy and selected (advanced-sowing) records use the same plant presentation.
Only recorded facts are shown: missing spacing, density, or footprint data is
not a warning and must not be inferred from today's catalogue.

## Surfaces

| Surface | Presentation |
| --- | --- |
| Admin raised-bed detail | Shared `RaisedBedFieldsGrid`, `RaisedBedPlantItem`, and `RaisedBedPlantDetails`; field controls and planting actions retain their original command identities. |
| Farm raised-bed detail | The same grid and plant components; legacy status requests remain available and selected status remains read-only, matching the existing Farm permissions. Completed plantings are behind history, not a second active-planting card. |
| Farm raised-bed overview | Compact previews use the same footprint grouping and show all companion plants. Beds keep three columns on every screen, with missing physical identifiers reserved and identifier 1 at the bottom-right. |
| Admin and Farm greenhouse | One row per occupancy record, all field numbers, and optional `RaisedBedPlantingFacts`; mobile and desktop receive the same facts. |
| Garden field HUD | Existing `RaisedBedFieldItemPlanted` modal (Biljka, Dnevnik, Radnje) for both methods, the existing plant-grid icon beside the count, a numbered footprint only for multi-field plantings, and explicit plant selection per field. Selected sowing tasks reuse the operation card and reschedule/cancel dialogs; the default plant tab has no editing forms. Overlapping footprints contribute to one field selector. Pending cart controls remain accessible. |
| Schedule and approvals | Keep their task presentation and role-specific completion/approval controls. Selected task labels already include saved count, density, footprint, and spacing; these are task views rather than a second planting inventory. |
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
and removal retain their separate controls; harvested plants use the existing
removal action. Changes retain date confirmation and active-cycle identity and
version checks.

## Verification

Component tests cover Admin and Farm mobile/desktop layouts, optional details,
legacy history without warnings, greenhouse footprints, and Garden co-plant
selection, overlapping footprints, pending carts, and owner controls. Pure
footprint tests cover co-plants, overlapping rectangles, and missing memberships.
Shared examples are available in Storybook under `UI/Raised beds/Fields` and the
raised-bed component showcase.
