#!/usr/bin/env python3
"""Add a post-free continuation mesh to the legacy Fence source asset.

Run with Blender, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python assets/scripts/add-fence-extension.py

The existing connected variants reach from their post to the edge of a tile.
Fence Extension continues those two rails from that edge to an adjacent post.
"""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = ROOT / "assets/game-assets/Fence.blend"
EXTENSION_NAME = "Fence Extension"
MATERIAL_NAME = "Material.Planks"
RAIL_DEPTH = 0.1
RAIL_HEIGHT = 0.1
RAIL_LENGTH = 0.5
RAIL_CENTER_Y = 0.75
RAIL_HEIGHTS = (-0.79, -0.61)


def activate(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def assign_material(
    obj: bpy.types.Object,
    material: bpy.types.Material,
) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = 0
        polygon.use_smooth = False


def create_rail(
    name: str,
    height: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=(0, RAIL_CENTER_Y, height))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (RAIL_DEPTH / 2, RAIL_LENGTH / 2, RAIL_HEIGHT / 2)
    assign_material(obj, material)
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    modifier = obj.modifiers.new(name="Timber Bevel", type="BEVEL")
    modifier.width = 0.01
    modifier.segments = 1
    modifier.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def join_objects(
    objects: Iterable[bpy.types.Object],
    material: bpy.types.Material,
) -> None:
    items = list(objects)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in items:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = items[0]
    bpy.ops.object.join()
    result = bpy.context.object
    result.name = EXTENSION_NAME
    result.data.name = EXTENSION_NAME
    assign_material(result, material)
    result.location = (0, 0, 1)


def main() -> None:
    bpy.ops.wm.open_mainfile(filepath=str(OUTPUT_PATH))
    existing = bpy.data.objects.get(EXTENSION_NAME)
    if existing is not None:
        bpy.data.objects.remove(existing, do_unlink=True)

    material = bpy.data.materials.get(MATERIAL_NAME)
    if material is None:
        raise RuntimeError(f"Missing {MATERIAL_NAME} in {OUTPUT_PATH}")

    join_objects(
        (
            create_rail(f"{EXTENSION_NAME} {index}", height, material)
            for index, height in enumerate(RAIL_HEIGHTS)
        ),
        material,
    )

    expected_names = {
        "Fence Corner",
        "Fence Cross",
        "Fence Middle",
        "Fence Single",
        "Fence Solo",
        "Fence T",
        EXTENSION_NAME,
    }
    actual_names = {obj.name for obj in bpy.context.scene.objects}
    if actual_names != expected_names:
        raise RuntimeError(f"Unexpected Fence objects: {sorted(actual_names)}")

    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_PATH), compress=True)
    print(f"UPDATED Fence: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
