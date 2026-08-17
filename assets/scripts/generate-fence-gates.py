#!/usr/bin/env python3
"""Generate four interactive fence-gate source assets.

Run with Blender, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python assets/scripts/generate-fence-gates.py

Each gate is one tile wide along the local X axis. ``*_Posts`` stays fixed,
while ``*_Leaf`` is authored relative to its left hinge so the runtime can
swing it open without rebuilding geometry.
"""

from __future__ import annotations

import math
from collections.abc import Iterable
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "assets/game-assets"

GATE_HALF_WIDTH = 0.43
LEAF_LENGTH = GATE_HALF_WIDTH * 2


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
    *,
    rotation_y: float = 0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=(0, rotation_y, 0))
    obj = bpy.context.object
    obj.name = name
    obj.scale = tuple(dimension / 2 for dimension in size)
    assign_material(obj, material)
    apply_transforms(obj)
    bevel(obj, min(0.009, min(size) * 0.16), name.split("_")[0])
    return obj


def cap(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=4,
        radius1=radius,
        radius2=0.015,
        depth=depth,
        location=location,
        rotation=(0, 0, math.pi / 4),
    )
    obj = bpy.context.object
    obj.name = name
    assign_material(obj, material)
    apply_transforms(obj)
    bevel(obj, 0.006, name.split("_")[0])
    return obj


def cylinder(
    name: str,
    radius: float,
    depth: float,
    location: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=10,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    assign_material(obj, material)
    apply_transforms(obj)
    bevel(obj, min(0.006, radius * 0.22), name.split("_")[0])
    return obj


def create_material(
    name: str,
    hex_color: str,
    roughness: float,
    metallic: float = 0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    color = rgba(hex_color)
    material.diffuse_color = color
    material.metallic = metallic
    material.roughness = roughness
    principled = material.node_tree.nodes.get("Principled BSDF")
    if principled is not None:
        principled.inputs["Base Color"].default_value = color
        principled.inputs["Metallic"].default_value = metallic
        principled.inputs["Roughness"].default_value = roughness
        principled.inputs["IOR"].default_value = 1.45
    return material


def join_objects(objects: Iterable[bpy.types.Object], name: str) -> bpy.types.Object:
    items = list(objects)
    if not items:
        raise ValueError(f"Cannot create empty gate part {name}")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in items:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = items[0]
    if len(items) > 1:
        bpy.ops.object.join()
    result = bpy.context.object
    result.name = name
    result.data.name = f"{name}_Mesh"
    return result


def add_hardware(
    parts: list[bpy.types.Object],
    asset_name: str,
    material: bpy.types.Material,
    leaf_height: float,
) -> None:
    for index, height in enumerate((leaf_height * 0.28, leaf_height * 0.75)):
        parts.append(
            cylinder(
                f"{asset_name}_Leaf_Hinge_{index}",
                0.026,
                0.11,
                (0, 0, height),
                material,
                rotation=(math.pi / 2, 0, 0),
            )
        )
    parts.append(
        box(
            f"{asset_name}_Leaf_Latch",
            (0.11, 0.07, 0.055),
            (LEAF_LENGTH - 0.07, 0, leaf_height * 0.62),
            material,
        )
    )


def create_wooden_gate() -> None:
    asset_name = "FenceGate"
    wood = create_material("Material.FenceGate.Wood", "#8A5A37", 0.82)
    metal = create_material("Material.FenceGate.Hardware", "#3F4547", 0.62, 0.45)
    posts = []
    for side in (-1, 1):
        posts.append(
            box(
                f"{asset_name}_Post_{side}",
                (0.16, 0.16, 0.62),
                (side * GATE_HALF_WIDTH, 0, 0.31),
                wood,
            )
        )
        posts.append(
            cap(
                f"{asset_name}_PostCap_{side}",
                (side * GATE_HALF_WIDTH, 0, 0.67),
                0.13,
                0.12,
                wood,
            )
        )

    leaf = []
    leaf_height = 0.55
    for index, height in enumerate((0.18, 0.46)):
        leaf.append(
            box(
                f"{asset_name}_Leaf_Rail_{index}",
                (LEAF_LENGTH, 0.09, 0.08),
                (LEAF_LENGTH / 2, 0, height),
                wood,
            )
        )
    leaf.append(
        box(
            f"{asset_name}_Leaf_Brace",
            (0.92, 0.07, 0.065),
            (LEAF_LENGTH / 2, 0, 0.32),
            wood,
            rotation_y=-0.42,
        )
    )
    add_hardware(leaf, asset_name, metal, leaf_height)
    join_objects(posts, f"{asset_name}_Posts")
    join_objects(leaf, f"{asset_name}_Leaf")


def create_white_gate() -> None:
    asset_name = "WhiteFenceGate"
    paint = create_material("Material.WhiteFenceGate.Paint", "#F4F2EA", 0.82)
    metal = create_material("Material.WhiteFenceGate.Hardware", "#6F7473", 0.64, 0.32)
    posts = []
    for side in (-1, 1):
        posts.append(
            box(
                f"{asset_name}_Post_{side}",
                (0.14, 0.08, 0.6),
                (side * GATE_HALF_WIDTH, 0, 0.3),
                paint,
            )
        )
        posts.append(
            cap(
                f"{asset_name}_PostCap_{side}",
                (side * GATE_HALF_WIDTH, 0, 0.66),
                0.105,
                0.14,
                paint,
            )
        )

    leaf = []
    leaf_height = 0.58
    for index, x in enumerate((0.08, 0.25, 0.43, 0.61, 0.78)):
        height = leaf_height - (0.03 if index in (0, 4) else 0)
        leaf.append(
            box(
                f"{asset_name}_Leaf_Picket_{index}",
                (0.11, 0.045, height),
                (x, 0, height / 2),
                paint,
            )
        )
        leaf.append(
            cap(
                f"{asset_name}_Leaf_PicketCap_{index}",
                (x, 0, height + 0.055),
                0.078,
                0.11,
                paint,
            )
        )
    for index, height in enumerate((0.21, 0.43)):
        leaf.append(
            box(
                f"{asset_name}_Leaf_Rail_{index}",
                (LEAF_LENGTH, 0.055, 0.055),
                (LEAF_LENGTH / 2, 0.015, height),
                paint,
            )
        )
    add_hardware(leaf, asset_name, metal, leaf_height)
    join_objects(posts, f"{asset_name}_Posts")
    join_objects(leaf, f"{asset_name}_Leaf")


def create_stone_posts(
    asset_name: str,
    materials: tuple[bpy.types.Material, ...],
    *,
    polished: bool,
) -> list[bpy.types.Object]:
    posts = []
    for side in (-1, 1):
        if polished:
            posts.append(
                box(
                    f"{asset_name}_Post_{side}",
                    (0.28, 0.28, 0.68),
                    (side * GATE_HALF_WIDTH, 0, 0.34),
                    materials[0],
                )
            )
            continue

        course_height = 0.15
        for course in range(4):
            split = 0.46 if course % 2 == 0 else 0.54
            cursor = -0.14
            for stone_index, length in enumerate((0.28 * split, 0.28 * (1 - split))):
                center = cursor + length / 2
                cursor += length
                along_x = course % 2 == 0
                posts.append(
                    box(
                        f"{asset_name}_Post_{side}_{course}_{stone_index}",
                        (
                            length if along_x else 0.28,
                            0.28 if along_x else length,
                            course_height,
                        ),
                        (
                            side * GATE_HALF_WIDTH + (center if along_x else 0),
                            0 if along_x else center,
                            course * course_height + course_height / 2,
                        ),
                        materials[(course + stone_index) % len(materials)],
                    )
                )
        posts.append(
            box(
                f"{asset_name}_PostCap_{side}",
                (0.32, 0.32, 0.08),
                (side * GATE_HALF_WIDTH, 0, 0.64),
                materials[0],
            )
        )
    return posts


def create_metal_leaf(
    asset_name: str,
    metal: bpy.types.Material,
    hardware: bpy.types.Material,
) -> list[bpy.types.Object]:
    leaf = []
    leaf_height = 0.55
    for index, height in enumerate((0.12, 0.5)):
        leaf.append(
            box(
                f"{asset_name}_Leaf_Rail_{index}",
                (LEAF_LENGTH, 0.055, 0.055),
                (LEAF_LENGTH / 2, 0, height),
                metal,
            )
        )
    for index, x in enumerate((0.08, 0.25, 0.43, 0.61, 0.78)):
        leaf.append(
            box(
                f"{asset_name}_Leaf_Bar_{index}",
                (0.045, 0.045, 0.42),
                (x, 0, 0.31),
                metal,
            )
        )
        leaf.append(
            cap(
                f"{asset_name}_Leaf_Finial_{index}",
                (x, 0, 0.56),
                0.047,
                0.1,
                metal,
            )
        )
    add_hardware(leaf, asset_name, hardware, leaf_height)
    return leaf


def create_stone_gate(*, polished: bool) -> None:
    asset_name = "PolishedStoneFenceGate" if polished else "StoneFenceGate"
    if polished:
        stone_materials = (
            create_material(
                "Material.PolishedStoneFenceGate.Surface", "#918B7F", 0.58
            ),
        )
    else:
        stone_materials = (
            create_material("Material.StoneFenceGate.Large", "#6D7273", 0.88),
            create_material("Material.StoneFenceGate.Mid", "#5C6264", 0.91),
            create_material("Material.StoneFenceGate.Dark", "#4C5355", 0.94),
        )
    metal = create_material(
        f"Material.{asset_name}.Metal", "#344747", 0.54, 0.55
    )
    hardware = create_material(
        f"Material.{asset_name}.Hardware", "#B98A3A", 0.46, 0.62
    )
    posts = create_stone_posts(
        asset_name,
        stone_materials,
        polished=polished,
    )
    leaf = create_metal_leaf(asset_name, metal, hardware)
    join_objects(posts, f"{asset_name}_Posts")
    join_objects(leaf, f"{asset_name}_Leaf")


def reset_scene(asset_name: str) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene["generated_by"] = "assets/scripts/generate-fence-gates.py"
    scene["asset_name"] = asset_name


def save_asset(asset_name: str) -> None:
    expected_names = {f"{asset_name}_Posts", f"{asset_name}_Leaf"}
    actual_names = {obj.name for obj in bpy.context.scene.objects}
    if actual_names != expected_names:
        raise RuntimeError(f"Unexpected {asset_name} objects: {sorted(actual_names)}")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / f"{asset_name}.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path), compress=True)
    print(f"GENERATED {asset_name}: {output_path}")


def main() -> None:
    generators = (
        ("FenceGate", create_wooden_gate),
        ("WhiteFenceGate", create_white_gate),
        ("StoneFenceGate", lambda: create_stone_gate(polished=False)),
        ("PolishedStoneFenceGate", lambda: create_stone_gate(polished=True)),
    )
    for asset_name, generator in generators:
        reset_scene(asset_name)
        generator()
        save_asset(asset_name)


if __name__ == "__main__":
    main()
