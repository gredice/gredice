# Raised-bed planting presentation

Legacy and selected (advanced-sowing) records use the same plant presentation.
Only recorded facts are shown: missing spacing, density, or footprint data is
not a warning and must not be inferred from today's catalogue.

## Surfaces

| Surface | Presentation |
| --- | --- |
| Admin raised-bed detail | Shared `RaisedBedFieldsGrid`, `RaisedBedPlantItem`, and `RaisedBedPlantDetails`; field controls and planting actions retain their original command identities. |
| Farm raised-bed detail | The same grid and plant components; legacy status requests remain available and selected status remains read-only, matching the existing Farm permissions. Completed plantings are behind history, not a second active-planting card. |
| Farm raised-bed overview | Compact previews use the same footprint grouping and show all companion plants. |
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
- Desktop and tablet use three physical columns; phones stack the groups without
  horizontal clipping. Compact overview previews keep their spatial arrangement.
- Garden builds each field's selectors from actual memberships, including
  plantings with different overlapping footprints. Tabs only include plants that
  occupy the selected field.
- Rendering must not turn display occupancy into a mutation identity. Preserve
  selected-planting IDs/versions, legacy cycle IDs/versions, and role-specific
  actions. Customer lifecycle status does not become editable through the
  field HUD.
- Collision/capacity validation remains in the sowing picker. Removing a legacy
  information notice does not relax those checks.

## Verification

Component tests cover Admin and Farm mobile/desktop layouts, optional details,
legacy history without warnings, greenhouse footprints, and Garden co-plant
selection, overlapping footprints, pending carts, and owner controls. Pure
footprint tests cover co-plants, overlapping rectangles, and missing memberships.
Shared examples are available in Storybook under `UI/Raised beds/Fields` and the
raised-bed component showcase.
