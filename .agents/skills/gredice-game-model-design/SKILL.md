---
name: gredice-game-model-design
description: Use for designing or restyling original Gredice garden 3D models, Blender source assets, low-poly/isometric game props, and style direction before runtime entity registration.
---

# Gredice Game Model Design

## Overview

Use this skill when the task is about the look, proportions, materials, or
source modeling of garden game assets. For registering a finished model as a
purchasable in-game entity, use `gredice-game-entity-creation` after the model
design is ready.

## Reference Safety

- Use public screenshots, storefront media, press materials, or first-party
  references for visual direction.
- Do not extract, import, trace, or reproduce assets from other games.
- Treat reference games such as Garden Galaxy as broad style inspiration only:
  low-poly cozy dioramas, isometric readability, chunky primitive shapes, and
  warm lighting accents. Make the final model a Gredice-specific object with a
  distinct silhouette, theme, and details.
- Keep downloaded reference images outside the repo unless the user explicitly
  asks for committed reference material and the usage rights are clear.

## Gredice Style Direction

- Favor a low-poly, toy-like, orthographic/isometric garden style.
- Build props from simple, readable primitives: bevelled boxes, cylinders,
  cones, wedges, rounded pots, chunky boards, and layered foliage.
- Use soft bevels and broad shapes instead of fine realistic detail.
- Prefer flat or lightly shaded materials with high roughness, minimal texture
  dependence, and clear albedo colors.
- Keep silhouettes legible from the game camera at small on-screen sizes.
- Use a restrained palette: leafy greens, soil browns, terracotta, warm
  limestone/cream, pale water blue, sunflower/gold accents, charcoal tool
  details, and small warm emissive glows for candles or lamps.
- Make assets feel Croatian allotment/garden specific when possible: raised
  beds, seed trays, crates, labels, stone borders, irrigation pieces, compost,
  small tools, market details, and practical farm-garden objects.

## Modeling Workflow

1. Define the model brief: gameplay role, tile footprint, expected scale,
   weather/season behavior, and whether the object is decorative, functional,
   plant-related, or terrain-adjacent.
2. Collect 3-6 public visual references. Write down the broad traits to borrow
   and the concrete details that must differ.
3. Create or edit the source Blender file under `assets/game-assets` when the
   task includes actual asset work. Use one source file per asset.
4. Name objects with stable, searchable prefixes such as
   `<EntityName>_<PartName>` and keep material names tied to their visual role.
5. Put the origin at the base center unless an existing nearby asset establishes
   a different convention. Keep the model aligned to the tile grid and avoid
   unintended floating geometry.
6. Use separate material roles for special surfaces that runtime code may need
   to treat differently, such as water, glass, emissive lights, or snow/rain
   overlays.
7. Preview the model from the in-game camera angle before export. Check that
   proportions, footprint, and silhouette read without zooming in.
8. If the asset should enter the game, update `assets/game-assets.json` and
   continue with `gredice-game-entity-creation`.

## Quality Checklist

- The model is original and not a copy of a reference-game asset.
- The asset reads clearly from the default garden camera.
- Geometry is intentionally simple; repeated details are instanced or kept
  lightweight where practical.
- Materials are few, named clearly, and do not depend on high-resolution
  textures unless there is a strong reason.
- Edges, bevels, and proportions match nearby Gredice garden assets.
- Any generated GLBs or model registries are produced through the established
  asset pipeline, not hand-edited.

## Validation

For design-only documentation or skill changes, run `git diff --check`. For
actual Blender/source asset changes, use the asset generation workflow from
`gredice-game-asset-docs` and the runtime/entity checks from
`gredice-game-entity-creation` when the model becomes playable or purchasable.
