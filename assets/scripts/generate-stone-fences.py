#!/usr/bin/env python3
"""Generate the connected StoneFence and PolishedStoneFence source assets.

Run with Blender, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python assets/scripts/generate-stone-fences.py

Both assets use the existing fence connection topology. An isolated tile is a
single pillar; cardinal arms appear only for owned neighboring spans. Separate
post-free extensions continue mixed-material spans to the adjacent pillar.
"""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "assets/game-assets"

PILLAR_SIZE = 0.28
PILLAR_HEIGHT = 0.68
ROUGH_WALL_THICKNESS = 0.16
POLISHED_WALL_THICKNESS = PILLAR_SIZE
WALL_HEIGHT = 0.48
ARM_END = 0.5
ARM_START = PILLAR_SIZE / 2 - 0.02
ARM_LENGTH = ARM_END - ARM_START
ARM_CENTER = (ARM_START + ARM_END) / 2

VARIANT_DIRECTIONS = {
    "Solo": (),
    "Single": ((0, 1),),
    "Middle": ((0, 1), (0, -1)),
    "Corner": ((1, 0), (0, 1)),
    "T": ((1, 0), (0, 1), (-1, 0)),
    "Cross": ((1, 0), (0, 1), (-1, 0), (0, -1)),
}


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


def bevel(obj: bpy.types.Object, width: float, label: str) -> None:
    activate(obj)
    modifier = obj.modifiers.new(name=f"{label} soft edge", type="BEVEL")
    modifier.width = width
    modifier.segments = 1
    modifier.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def box(
    name: str,
    size: tuple[float, float, float],
    location: tuple[float, float, float],
    material: bpy.types.Material,
    bevel_width: float,
    bevel_label: str,
    material_palette: tuple[bpy.types.Material, ...] | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = tuple(dimension / 2 for dimension in size)
    assign_material(obj, material)
    apply_transforms(obj)
    bevel(obj, min(bevel_width, min(size) * 0.18), bevel_label)
    if material_palette is not None:
        obj.data.materials.clear()
        for palette_material in material_palette:
            obj.data.materials.append(palette_material)
        material_index = material_palette.index(material)
        for polygon in obj.data.polygons:
            polygon.material_index = material_index
    return obj


def compact_material_slots(obj: bpy.types.Object) -> None:
    materials: list[bpy.types.Material] = []
    remap: dict[int, int] = {}
    by_name: dict[str, int] = {}

    for old_index, material in enumerate(obj.data.materials):
        if material.name not in by_name:
            by_name[material.name] = len(materials)
            materials.append(material)
        remap[old_index] = by_name[material.name]

    for polygon in obj.data.polygons:
        polygon.material_index = remap[polygon.material_index]

    obj.data.materials.clear()
    for material in materials:
        obj.data.materials.append(material)


def join_objects(objects: Iterable[bpy.types.Object], name: str) -> bpy.types.Object:
    items = list(objects)
    if not items:
        raise ValueError(f"Cannot create empty fence variant {name}")

    bpy.ops.object.select_all(action="DESELECT")
    for obj in items:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = items[0]
    if len(items) > 1:
        bpy.ops.object.join()
    result = bpy.context.object
    result.name = name
    result.data.name = f"{name}_Mesh"
    compact_material_slots(result)
    # Runtime components use the geometry directly and reproduce this node
    # translation by positioning the fence group one unit above the stack.
    result.location = (0, 0, 1)
    return result


def color_disconnected_stones(
    obj: bpy.types.Object,
    material_count: int,
) -> None:
    """Give each joined, disconnected stone a stable material variation."""
    parents = list(range(len(obj.data.vertices)))

    def find(index: int) -> int:
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    def union(first: int, second: int) -> None:
        first_root = find(first)
        second_root = find(second)
        if first_root != second_root:
            parents[second_root] = first_root

    for edge in obj.data.edges:
        union(edge.vertices[0], edge.vertices[1])

    component_roots = sorted({find(index) for index in range(len(parents))})
    material_by_root = {
        root: index % material_count for index, root in enumerate(component_roots)
    }
    for polygon in obj.data.polygons:
        polygon.material_index = material_by_root[find(polygon.vertices[0])]


def create_material(
    name: str,
    hex_color: str,
    roughness: float,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    color = rgba(hex_color)
    material.diffuse_color = color
    material.metallic = 0
    material.roughness = roughness
    principled = material.node_tree.nodes.get("Principled BSDF")
    if principled is not None:
        principled.inputs["Base Color"].default_value = color
        principled.inputs["Metallic"].default_value = 0
        principled.inputs["Roughness"].default_value = roughness
        principled.inputs["IOR"].default_value = 1.45
    return material


def rough_stone_materials() -> tuple[bpy.types.Material, ...]:
    return (
        create_material("Material.StoneFence.Large", "#6D7273", 0.88),
        create_material("Material.StoneFence.Mid", "#5C6264", 0.91),
        create_material("Material.StoneFence.Dark", "#4C5355", 0.94),
    )


def add_rough_pillar(
    parts: list[bpy.types.Object],
    name: str,
    materials: tuple[bpy.types.Material, ...],
) -> None:
    course_height = 0.15
    for course in range(4):
        along_x = course % 2 == 0
        split = 0.46 if course % 4 < 2 else 0.54
        first_length = PILLAR_SIZE * split
        second_length = PILLAR_SIZE - first_length
        lengths = (first_length, second_length)
        cursor = -PILLAR_SIZE / 2
        for stone_index, length in enumerate(lengths):
            center = cursor + length / 2
            cursor += length
            size = (
                (length, PILLAR_SIZE, course_height)
                if along_x
                else (PILLAR_SIZE, length, course_height)
            )
            location = (
                center if along_x else 0,
                0 if along_x else center,
                -1 + course * course_height + course_height / 2,
            )
            parts.append(
                box(
                    f"{name}_Pillar_Course_{course}_Stone_{stone_index}",
                    size,
                    location,
                    materials[(course + stone_index) % len(materials)],
                    0.006,
                    "StoneFence",
                    materials,
                )
            )

    parts.append(
        box(
            f"{name}_Pillar_Cap",
            (0.32, 0.32, 0.08),
            (0, 0, -1 + PILLAR_HEIGHT - 0.04),
            materials[0],
            0.009,
            "StoneFence",
            materials,
        )
    )


def add_rough_arm(
    parts: list[bpy.types.Object],
    name: str,
    direction: tuple[int, int],
    materials: tuple[bpy.types.Material, ...],
    start: float = ARM_START,
    end: float = ARM_END,
) -> None:
    direction_x, direction_y = direction
    along_x = direction_x != 0
    course_height = 0.14
    arm_length = end - start

    for course in range(3):
        split = 0.48 if course % 2 == 0 else 0.56
        first_length = arm_length * split
        lengths = (first_length, arm_length - first_length)
        cursor = start
        for stone_index, length in enumerate(lengths):
            center_distance = cursor + length / 2
            cursor += length
            size = (
                (length, ROUGH_WALL_THICKNESS, course_height)
                if along_x
                else (ROUGH_WALL_THICKNESS, length, course_height)
            )
            parts.append(
                box(
                    f"{name}_Course_{course}_Stone_{stone_index}",
                    size,
                    (
                        direction_x * center_distance,
                        direction_y * center_distance,
                        -1 + course * course_height + course_height / 2,
                    ),
                    materials[(course * 2 + stone_index + 1) % len(materials)],
                    0.006,
                    "StoneFence",
                    materials,
                )
            )

    cap_height = WALL_HEIGHT - 3 * course_height
    for cap_index in range(2):
        length = arm_length / 2
        center_distance = start + length * (cap_index + 0.5)
        size = (
            (length, ROUGH_WALL_THICKNESS + 0.02, cap_height)
            if along_x
            else (ROUGH_WALL_THICKNESS + 0.02, length, cap_height)
        )
        parts.append(
            box(
                f"{name}_Cap_{cap_index}",
                size,
                (
                    direction_x * center_distance,
                    direction_y * center_distance,
                    -1 + WALL_HEIGHT - cap_height / 2,
                ),
                materials[0],
                0.007,
                "StoneFence",
                materials,
            )
        )


def create_rough_variant(
    name: str,
    directions: tuple[tuple[int, int], ...],
    materials: tuple[bpy.types.Material, ...],
) -> bpy.types.Object:
    parts: list[bpy.types.Object] = []
    add_rough_pillar(parts, name, materials)
    for index, direction in enumerate(directions):
        add_rough_arm(parts, f"{name}_Arm_{index}", direction, materials)
    result = join_objects(parts, name)
    color_disconnected_stones(result, len(materials))
    return result


def create_rough_extension(
    name: str,
    materials: tuple[bpy.types.Material, ...],
) -> bpy.types.Object:
    parts: list[bpy.types.Object] = []
    add_rough_arm(
        parts,
        name,
        (0, 1),
        materials,
        start=ARM_END,
        end=1,
    )
    result = join_objects(parts, name)
    color_disconnected_stones(result, len(materials))
    return result


def create_polished_variant(
    name: str,
    directions: tuple[tuple[int, int], ...],
    material: bpy.types.Material,
) -> bpy.types.Object:
    parts = [
        box(
            f"{name}_Pillar",
            (PILLAR_SIZE, PILLAR_SIZE, PILLAR_HEIGHT),
            (0, 0, -1 + PILLAR_HEIGHT / 2),
            material,
            0.012,
            "PolishedStoneFence",
        )
    ]
    for index, (direction_x, direction_y) in enumerate(directions):
        along_x = direction_x != 0
        parts.append(
            box(
                f"{name}_Arm_{index}",
                (
                    ARM_LENGTH if along_x else POLISHED_WALL_THICKNESS,
                    POLISHED_WALL_THICKNESS if along_x else ARM_LENGTH,
                    WALL_HEIGHT,
                ),
                (
                    direction_x * ARM_CENTER,
                    direction_y * ARM_CENTER,
                    -1 + WALL_HEIGHT / 2,
                ),
                material,
                0.012,
                "PolishedStoneFence",
            )
        )
    return join_objects(parts, name)


def create_polished_extension(
    name: str,
    material: bpy.types.Material,
) -> bpy.types.Object:
    return join_objects(
        [
            box(
                f"{name}_Wall",
                (POLISHED_WALL_THICKNESS, 0.5, WALL_HEIGHT),
                (0, 0.75, -1 + WALL_HEIGHT / 2),
                material,
                0.012,
                "PolishedStoneFence",
            )
        ],
        name,
    )


def reset_scene(asset_name: str) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene["generated_by"] = "assets/scripts/generate-stone-fences.py"
    scene["asset_name"] = asset_name


def save_asset(asset_name: str) -> None:
    expected_names = {
        f"{asset_name}_{shape}" for shape in VARIANT_DIRECTIONS
    }
    expected_names.add(f"{asset_name}_Extension")
    actual_names = {obj.name for obj in bpy.context.scene.objects}
    if actual_names != expected_names:
        raise RuntimeError(
            f"Unexpected {asset_name} objects: {sorted(actual_names)}"
        )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / f"{asset_name}.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path), compress=True)
    print(f"GENERATED {asset_name}: {output_path}")


def generate_stone_fence() -> None:
    asset_name = "StoneFence"
    reset_scene(asset_name)
    materials = rough_stone_materials()
    for shape, directions in VARIANT_DIRECTIONS.items():
        create_rough_variant(
            f"{asset_name}_{shape}",
            directions,
            materials,
        )
    create_rough_extension(f"{asset_name}_Extension", materials)
    save_asset(asset_name)


def generate_polished_stone_fence() -> None:
    asset_name = "PolishedStoneFence"
    reset_scene(asset_name)
    material = create_material(
        "Material.PolishedStoneFence.Surface",
        "#918B7F",
        0.58,
    )
    for shape, directions in VARIANT_DIRECTIONS.items():
        create_polished_variant(
            f"{asset_name}_{shape}",
            directions,
            material,
        )
    create_polished_extension(f"{asset_name}_Extension", material)
    save_asset(asset_name)


def main() -> None:
    generate_stone_fence()
    generate_polished_stone_fence()


if __name__ == "__main__":
    main()
