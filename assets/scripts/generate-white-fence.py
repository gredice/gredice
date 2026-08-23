#!/usr/bin/env python3
"""Generate the low-poly WhiteFence source asset.

Run with Blender, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python assets/scripts/generate-white-fence.py

The connected variants mirror the Fence topology while using rows of broad
pointed planks, two narrow rails, and matte warm-white paint. A separate pole
and post-free extension support clean connections to other fence materials.
"""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = ROOT / "assets/game-assets/WhiteFence.blend"
MATERIAL_NAME = "Material.WhitePaint"

PICKET_FACE_WIDTH = 0.215
PICKET_DEPTH = 0.045
POST_BODY_HEIGHT = 0.58
POST_CAP_HEIGHT = 0.14
RAIL_DEPTH = 0.04
RAIL_HEIGHT = 0.055
RAIL_LENGTH = 0.5
RAIL_HEIGHTS = (0.25, 0.45)
PICKET_SPACING = RAIL_LENGTH / 2


def srgb_channel_to_linear(value: float) -> float:
    if value <= 0.04045:
        return value / 12.92
    return ((value + 0.055) / 1.055) ** 2.4


def rgba(hex_color: str) -> tuple[float, float, float, float]:
    value = hex_color.removeprefix("#")
    channels = [int(value[index : index + 2], 16) / 255 for index in (0, 2, 4)]
    return (*(srgb_channel_to_linear(channel) for channel in channels), 1.0)


def activate(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_transforms(obj: bpy.types.Object) -> None:
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def assign_material(obj: bpy.types.Object, material: bpy.types.Material) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = 0
        polygon.use_smooth = False


def bevel(obj: bpy.types.Object, width: float) -> None:
    activate(obj)
    modifier = obj.modifiers.new(name="WhiteFence soft edge", type="BEVEL")
    modifier.width = width
    modifier.segments = 1
    modifier.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def box(
    name: str,
    size: tuple[float, float, float],
    location: tuple[float, float, float],
    material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = tuple(dimension / 2 for dimension in size)
    assign_material(obj, material)
    apply_transforms(obj)
    bevel(obj, min(0.008, min(size) * 0.18))
    return obj


def picket_plank(
    name: str,
    location: tuple[float, float],
    along_x: bool,
    material: bpy.types.Material,
) -> bpy.types.Object:
    bottom_z = -1
    shoulder_z = bottom_z + POST_BODY_HEIGHT
    top_z = shoulder_z + POST_CAP_HEIGHT
    half_face = PICKET_FACE_WIDTH / 2
    half_depth = PICKET_DEPTH / 2
    x, y = location

    def oriented(
        along: float,
        depth: float,
        z: float,
    ) -> tuple[float, float, float]:
        return (
            x + (along if along_x else depth),
            y + (depth if along_x else along),
            z,
        )

    profile = [
        (-half_face, bottom_z),
        (half_face, bottom_z),
        (half_face, shoulder_z),
        (0, top_z),
        (-half_face, shoulder_z),
    ]
    vertices = [
        oriented(along, depth, z)
        for depth in (-half_depth, half_depth)
        for along, z in profile
    ]
    faces = [tuple(range(5)), tuple(range(9, 4, -1))]
    for index in range(5):
        next_index = (index + 1) % 5
        faces.append((index, next_index, next_index + 5, index + 5))

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    assign_material(obj, material)
    return obj


def join_objects(
    objects: Iterable[bpy.types.Object],
    name: str,
    material: bpy.types.Material,
) -> bpy.types.Object:
    items = list(objects)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in items:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = items[0]
    bpy.ops.object.join()
    result = bpy.context.object
    result.name = name
    result.data.name = f"{name}_Mesh"
    assign_material(result, material)
    result.location = (0, 0, 1)
    return result


def create_material() -> bpy.types.Material:
    material = bpy.data.materials.new(MATERIAL_NAME)
    material.use_nodes = True
    color = rgba("#F4F2EA")
    material.diffuse_color = color
    material.metallic = 0
    material.roughness = 0.82
    principled = material.node_tree.nodes.get("Principled BSDF")
    if principled is not None:
        principled.inputs["Base Color"].default_value = color
        principled.inputs["Metallic"].default_value = 0
        principled.inputs["Roughness"].default_value = 0.82
        principled.inputs["IOR"].default_value = 1.45
    return material


def add_picket(
    parts: list[bpy.types.Object],
    name: str,
    location: tuple[float, float],
    along_x: bool,
    material: bpy.types.Material,
) -> None:
    parts.append(picket_plank(name, location, along_x, material))


def add_rail_run(
    parts: list[bpy.types.Object],
    name: str,
    direction: tuple[int, int],
    material: bpy.types.Material,
    start: float = 0,
    end: float = RAIL_LENGTH,
) -> None:
    direction_x, direction_y = direction
    along_x = direction_x != 0
    length = end - start
    center = (start + end) / 2
    for rail_index, rail_height in enumerate(RAIL_HEIGHTS):
        parts.append(
            box(
                f"{name}_Rail_{rail_index}",
                (
                    length if along_x else RAIL_DEPTH,
                    RAIL_DEPTH if along_x else length,
                    RAIL_HEIGHT,
                ),
                (
                    direction_x * center,
                    direction_y * center,
                    -1 + rail_height,
                ),
                material,
            )
        )


def create_variant(
    name: str,
    directions: tuple[tuple[int, int], ...],
    material: bpy.types.Material,
) -> bpy.types.Object:
    parts: list[bpy.types.Object] = []
    center_along_x = not directions or directions[0][0] != 0
    add_picket(
        parts,
        f"{name}_Center",
        (0, 0),
        center_along_x,
        material,
    )

    if not directions:
        for side in (-1, 1):
            add_picket(
                parts,
                f"{name}_Picket_{side}",
                (side * PICKET_SPACING, 0),
                True,
                material,
            )
        for rail_index, rail_height in enumerate(RAIL_HEIGHTS):
            parts.append(
                box(
                    f"{name}_Rail_{rail_index}",
                    (RAIL_LENGTH, RAIL_DEPTH, RAIL_HEIGHT),
                    (0, 0, -1 + rail_height),
                    material,
                )
            )

    for direction_index, (direction_x, direction_y) in enumerate(directions):
        for picket_index, distance in enumerate(
            (PICKET_SPACING, RAIL_LENGTH),
        ):
            add_picket(
                parts,
                f"{name}_Arm_{direction_index}_Picket_{picket_index}",
                (direction_x * distance, direction_y * distance),
                direction_x != 0,
                material,
            )
        add_rail_run(
            parts,
            f"{name}_Arm_{direction_index}",
            (direction_x, direction_y),
            material,
        )

    return join_objects(parts, name, material)


def create_pole(material: bpy.types.Material) -> bpy.types.Object:
    name = "WhiteFence_Pole"
    parts: list[bpy.types.Object] = []
    add_picket(parts, name, (0, 0), True, material)
    return join_objects(parts, name, material)


def create_extension(material: bpy.types.Material) -> bpy.types.Object:
    name = "WhiteFence_Extension"
    parts: list[bpy.types.Object] = []
    add_picket(parts, f"{name}_Picket", (0, 0.75), False, material)
    add_rail_run(parts, name, (0, 1), material, start=0.5, end=1)
    return join_objects(parts, name, material)


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene["generated_by"] = "assets/scripts/generate-white-fence.py"
    scene["asset_name"] = "WhiteFence"
    material = create_material()
    variants = {
        "WhiteFence_Solo": (),
        "WhiteFence_Single": ((0, 1),),
        "WhiteFence_Middle": ((0, 1), (0, -1)),
        "WhiteFence_Corner": ((1, 0), (0, 1)),
        "WhiteFence_T": ((1, 0), (0, 1), (-1, 0)),
        "WhiteFence_Cross": ((1, 0), (0, 1), (-1, 0), (0, -1)),
    }
    for name, directions in variants.items():
        create_variant(name, directions, material)

    create_pole(material)
    create_extension(material)

    actual_names = {obj.name for obj in bpy.context.scene.objects}
    expected_names = {*variants, "WhiteFence_Pole", "WhiteFence_Extension"}
    if actual_names != expected_names:
        raise RuntimeError(f"Unexpected WhiteFence objects: {sorted(actual_names)}")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_PATH), compress=True)
    print(f"GENERATED WhiteFence: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
