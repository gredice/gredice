#!/usr/bin/env python3
"""Generate original Gredice home blocks for the placeable garden animals.

Run with Blender, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python assets/scripts/generate-animal-homes.py \
      -- --output-dir assets/game-assets

Every home is base-centered and opens toward Blender +Y. The 1x1 homes stay
compact while the three 2x2 homes use their extra area for readable shelter,
feeding, and enclosure silhouettes at the normal isometric garden camera.
"""

from __future__ import annotations

import argparse
import math
import sys
from collections.abc import Callable, Iterable
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument(
        "--asset",
        action="append",
        dest="assets",
        help="Generate only this asset. May be supplied more than once.",
    )
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def srgb_channel_to_linear(value: float) -> float:
    if value <= 0.04045:
        return value / 12.92
    return ((value + 0.055) / 1.055) ** 2.4


def material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    roughness: float = 0.86,
    metallic: float = 0,
) -> bpy.types.Material:
    linear_color = tuple(srgb_channel_to_linear(channel) for channel in color[:3]) + (
        color[3],
    )
    value = bpy.data.materials.new(name)
    value.diffuse_color = linear_color
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    if shader:
        shader.inputs["Base Color"].default_value = linear_color
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = metallic
    return value


def reset_scene(asset_name: str, footprint: str) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = (
        "BLENDER_EEVEE" if bpy.app.version >= (5, 0, 0) else "BLENDER_EEVEE_NEXT"
    )
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene.world = bpy.data.worlds.new("Gredice World")
    scene.world.color = (0.055, 0.07, 0.06)
    scene["generated_by"] = "assets/scripts/generate-animal-homes.py"
    scene["asset_name"] = asset_name
    scene["footprint"] = footprint
    scene["front_direction"] = "Blender +Y"
    scene["originality_note"] = (
        "Original Gredice primitive model; no external meshes or textures imported"
    )


def activate(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_scale(obj: bpy.types.Object) -> None:
    activate(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def bevel(obj: bpy.types.Object, width: float) -> None:
    activate(obj)
    modifier = obj.modifiers.new(name="Soft bevel", type="BEVEL")
    modifier.width = width
    modifier.segments = 2
    modifier.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def assign_material(obj: bpy.types.Object, value: bpy.types.Material) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(value)


def add_cube(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    value: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0, 0, 0),
    bevel_width: float = 0.018,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    apply_scale(obj)
    if bevel_width > 0:
        bevel(obj, bevel_width)
    assign_material(obj, value)
    return obj


def add_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    value: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0, 0, 0),
    vertices: int = 8,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    apply_scale(obj)
    assign_material(obj, value)
    return obj


def add_ico_sphere(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    value: bpy.types.Material,
    *,
    subdivisions: int = 1,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=subdivisions,
        radius=1,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_scale(obj)
    assign_material(obj, value)
    return obj


def join_objects(
    objects: Iterable[bpy.types.Object], name: str
) -> bpy.types.Object:
    items = list(objects)
    if not items:
        raise ValueError(f"Cannot create empty mesh role {name}")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in items:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = items[0]
    bpy.ops.object.join()
    result = bpy.context.object
    result.name = name
    result.data.name = name
    return result


def save_asset(filename: str, roles: Iterable[bpy.types.Object], output_dir: Path) -> None:
    role_names = [obj.name for obj in roles]
    actual_names = {obj.name for obj in bpy.context.scene.objects}
    if actual_names != set(role_names):
        raise RuntimeError(
            f"Unexpected {filename} objects; expected={sorted(role_names)}, "
            f"actual={sorted(actual_names)}"
        )
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / filename
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path.resolve()), compress=True)
    print(f"Saved {output_path}")


def straw_scatter(
    prefix: str,
    center: tuple[float, float, float],
    count: int,
    span: float,
    value: bpy.types.Material,
) -> list[bpy.types.Object]:
    center_x, center_y, center_z = center
    return [
        add_cylinder(
            f"{prefix}_Straw_{index}",
            (
                center_x - span * 0.5 + span * index / max(1, count - 1),
                center_y + (index % 3) * 0.035,
                center_z,
            ),
            0.012,
            span * 0.72,
            value,
            rotation=(math.radians(82), math.radians(index * 17), 0),
            vertices=6,
        )
        for index in range(count)
    ]


def create_rabbit_hutch(output_dir: Path) -> None:
    reset_scene("RabbitHutch", "1x1")
    oak = material("Material.RabbitHutch.Oak", (0.43, 0.24, 0.1, 1))
    timber = material("Material.RabbitHutch.Timber", (0.64, 0.4, 0.18, 1))
    limewash = material("Material.RabbitHutch.Limewash", (0.87, 0.8, 0.65, 1))
    roof = material("Material.RabbitHutch.Roof", (0.62, 0.17, 0.075, 1))
    dark = material("Material.RabbitHutch.Dark", (0.075, 0.045, 0.025, 1))
    straw = material("Material.RabbitHutch.Straw", (0.86, 0.59, 0.13, 1))

    dark_wood = [
        add_cube("Hutch_Base", (0, -0.04, 0.26), (0.78, 0.6, 0.09), oak),
        *[
            add_cube(
                f"Hutch_Post_{index}",
                (x, y, 0.39),
                (0.07, 0.07, 0.78),
                oak,
                bevel_width=0.012,
            )
            for index, (x, y) in enumerate(
                ((-0.35, -0.27), (0.35, -0.27), (-0.35, 0.24), (0.35, 0.24))
            )
        ],
    ]
    walls = [
        add_cube("Hutch_Back", (0, -0.29, 0.5), (0.72, 0.06, 0.52), timber),
        add_cube("Hutch_Left", (-0.36, -0.02, 0.5), (0.06, 0.52, 0.52), timber),
        add_cube("Hutch_Right", (0.36, -0.02, 0.5), (0.06, 0.52, 0.52), timber),
        add_cube("Hutch_FrontTop", (0, 0.25, 0.67), (0.72, 0.06, 0.18), limewash),
        add_cube("Hutch_FrontLeft", (-0.27, 0.25, 0.46), (0.18, 0.06, 0.34), limewash),
        add_cube("Hutch_FrontRight", (0.27, 0.25, 0.46), (0.18, 0.06, 0.34), limewash),
    ]
    roof_parts = [
        add_cube(
            "Hutch_RoofLeft",
            (-0.2, -0.02, 0.84),
            (0.52, 0.76, 0.07),
            roof,
            rotation=(0, math.radians(-24), 0),
        ),
        add_cube(
            "Hutch_RoofRight",
            (0.2, -0.02, 0.84),
            (0.52, 0.76, 0.07),
            roof,
            rotation=(0, math.radians(24), 0),
        ),
    ]
    entrance = [
        add_cube("Hutch_Entrance", (0, 0.276, 0.45), (0.28, 0.02, 0.32), dark),
        add_cube(
            "Hutch_Ramp",
            (0, 0.42, 0.17),
            (0.3, 0.42, 0.045),
            timber,
            rotation=(math.radians(-18), 0, 0),
        ),
    ]
    straw_parts = straw_scatter("Hutch", (0, -0.03, 0.31), 7, 0.42, straw)
    roles = [
        join_objects(dark_wood, "RabbitHutch_Oak"),
        join_objects(walls, "RabbitHutch_Walls"),
        join_objects(roof_parts, "RabbitHutch_Roof"),
        join_objects(entrance, "RabbitHutch_EntranceRamp"),
        join_objects(straw_parts, "RabbitHutch_Straw"),
    ]
    save_asset("RabbitHutch.blend", roles, output_dir)


def create_horse_stable(output_dir: Path) -> None:
    reset_scene("HorseStable", "2x2")
    oak = material("Material.HorseStable.Oak", (0.38, 0.2, 0.085, 1))
    planks = material("Material.HorseStable.Planks", (0.62, 0.38, 0.16, 1))
    roof = material("Material.HorseStable.Roof", (0.59, 0.16, 0.07, 1))
    stone = material("Material.HorseStable.Stone", (0.52, 0.5, 0.41, 1))
    straw = material("Material.HorseStable.Straw", (0.86, 0.6, 0.14, 1))
    enamel = material(
        "Material.HorseStable.Enamel", (0.16, 0.34, 0.34, 1), roughness=0.6
    )

    foundation = [
        add_cube("Stable_Foundation", (0, -0.08, 0.07), (1.72, 1.54, 0.14), stone)
    ]
    frame = [
        *[
            add_cube(
                f"Stable_Post_{index}",
                (x, y, 0.76),
                (0.11, 0.11, 1.42),
                oak,
                bevel_width=0.02,
            )
            for index, (x, y) in enumerate(
                ((-0.77, -0.67), (0.77, -0.67), (-0.77, 0.62), (0.77, 0.62))
            )
        ],
        add_cube("Stable_BackBeam", (0, -0.67, 1.33), (1.65, 0.12, 0.13), oak),
        add_cube("Stable_FrontBeam", (0, 0.62, 1.33), (1.65, 0.12, 0.13), oak),
        add_cube("Stable_Divider", (0, -0.08, 0.72), (0.09, 1.18, 1.12), oak),
    ]
    wall_parts = [
        add_cube("Stable_BackWall", (0, -0.72, 0.72), (1.55, 0.08, 1.1), planks),
        add_cube("Stable_LeftWall", (-0.82, -0.12, 0.7), (0.08, 1.16, 1.0), planks),
        add_cube("Stable_RightWall", (0.82, -0.12, 0.7), (0.08, 1.16, 1.0), planks),
    ]
    roof_parts = [
        add_cube(
            "Stable_RoofLeft",
            (-0.43, -0.05, 1.5),
            (1.04, 1.72, 0.1),
            roof,
            rotation=(0, math.radians(-18), 0),
        ),
        add_cube(
            "Stable_RoofRight",
            (0.43, -0.05, 1.5),
            (1.04, 1.72, 0.1),
            roof,
            rotation=(0, math.radians(18), 0),
        ),
    ]
    feed = [
        add_cube("Stable_Trough", (-0.45, 0.45, 0.28), (0.55, 0.28, 0.27), enamel),
        add_cube("Stable_TroughInset", (-0.45, 0.45, 0.42), (0.45, 0.18, 0.035), straw),
    ]
    straw_parts = straw_scatter("Stable", (0.4, -0.18, 0.16), 11, 0.7, straw)
    roles = [
        join_objects(foundation, "HorseStable_Stone"),
        join_objects(frame, "HorseStable_Frame"),
        join_objects(wall_parts, "HorseStable_Walls"),
        join_objects(roof_parts, "HorseStable_Roof"),
        join_objects(feed, "HorseStable_Trough"),
        join_objects(straw_parts, "HorseStable_Straw"),
    ]
    save_asset("HorseStable.blend", roles, output_dir)


def create_cow_shelter(output_dir: Path) -> None:
    reset_scene("CowShelter", "2x2")
    timber = material("Material.CowShelter.Timber", (0.42, 0.24, 0.1, 1))
    wall = material("Material.CowShelter.Limewash", (0.83, 0.78, 0.65, 1))
    roof = material(
        "Material.CowShelter.Roof", (0.24, 0.34, 0.32, 1), roughness=0.68, metallic=0.08
    )
    stone = material("Material.CowShelter.Stone", (0.48, 0.48, 0.42, 1))
    water = material("Material.CowShelter.Water", (0.18, 0.45, 0.5, 1), roughness=0.3)
    enamel = material(
        "Material.CowShelter.Enamel", (0.17, 0.3, 0.3, 1), roughness=0.58
    )

    stone_parts = [
        add_cube("CowShelter_Base", (0, -0.08, 0.075), (1.75, 1.5, 0.15), stone)
    ]
    timber_parts = [
        *[
            add_cube(
                f"CowShelter_Post_{index}",
                (x, y, 0.72),
                (0.11, 0.11, 1.28),
                timber,
            )
            for index, (x, y) in enumerate(
                ((-0.78, -0.63), (0.78, -0.63), (-0.78, 0.58), (0.78, 0.58))
            )
        ],
        add_cube("CowShelter_FrontBeam", (0, 0.58, 1.27), (1.66, 0.12, 0.13), timber),
        add_cube("CowShelter_BackBeam", (0, -0.63, 1.17), (1.66, 0.12, 0.13), timber),
    ]
    walls = [
        add_cube("CowShelter_BackWall", (0, -0.68, 0.58), (1.54, 0.08, 0.86), wall),
        add_cube("CowShelter_LeftWall", (-0.83, -0.15, 0.55), (0.08, 1.02, 0.8), wall),
        add_cube("CowShelter_RightWall", (0.83, -0.15, 0.55), (0.08, 1.02, 0.8), wall),
    ]
    roof_parts = [
        add_cube(
            "CowShelter_Roof",
            (0, -0.04, 1.36),
            (1.88, 1.65, 0.11),
            roof,
            rotation=(math.radians(-5), 0, 0),
        )
    ]
    trough_parts = [
        add_cube("CowShelter_Trough", (-0.47, 0.42, 0.25), (0.66, 0.32, 0.27), enamel),
        add_cube("CowShelter_Water", (-0.47, 0.42, 0.39), (0.55, 0.21, 0.025), water),
    ]
    roles = [
        join_objects(stone_parts, "CowShelter_Stone"),
        join_objects(timber_parts, "CowShelter_Timber"),
        join_objects(walls, "CowShelter_Walls"),
        join_objects(roof_parts, "CowShelter_Roof"),
        join_objects(trough_parts, "CowShelter_Trough"),
    ]
    save_asset("CowShelter.blend", roles, output_dir)


def create_goat_shelter(output_dir: Path) -> None:
    reset_scene("GoatShelter", "1x1")
    timber = material("Material.GoatShelter.Timber", (0.44, 0.25, 0.1, 1))
    light = material("Material.GoatShelter.LightWood", (0.68, 0.44, 0.2, 1))
    roof = material("Material.GoatShelter.Roof", (0.54, 0.16, 0.075, 1))
    stone = material("Material.GoatShelter.Stone", (0.5, 0.49, 0.42, 1))
    salt = material("Material.GoatShelter.Salt", (0.88, 0.7, 0.49, 1))

    stone_parts = [
        add_cube("GoatShelter_Base", (0, -0.02, 0.07), (0.9, 0.82, 0.14), stone),
        add_ico_sphere("GoatShelter_Salt", (0.25, 0.26, 0.17), (0.12, 0.1, 0.12), salt),
    ]
    frame = [
        *[
            add_cube(
                f"GoatShelter_Post_{index}",
                (x, y, 0.48),
                (0.075, 0.075, 0.78),
                timber,
                bevel_width=0.012,
            )
            for index, (x, y) in enumerate(
                ((-0.38, -0.32), (0.38, -0.32), (-0.38, 0.3), (0.38, 0.3))
            )
        ],
        add_cube("GoatShelter_BackBeam", (0, -0.32, 0.79), (0.84, 0.08, 0.1), timber),
        add_cube("GoatShelter_FrontBeam", (0, 0.3, 0.79), (0.84, 0.08, 0.1), timber),
    ]
    wall_parts = [
        add_cube("GoatShelter_BackWall", (0, -0.36, 0.48), (0.76, 0.06, 0.58), light),
        add_cube("GoatShelter_LeftWall", (-0.41, -0.08, 0.45), (0.06, 0.56, 0.52), light),
    ]
    roof_parts = [
        add_cube(
            "GoatShelter_Roof",
            (0, -0.04, 0.9),
            (0.98, 0.9, 0.08),
            roof,
            rotation=(math.radians(-8), 0, 0),
        )
    ]
    platform = [
        add_cube("GoatShelter_Step", (0.21, 0.2, 0.2), (0.34, 0.28, 0.16), stone),
        add_cube("GoatShelter_Ramp", (-0.13, 0.35, 0.15), (0.38, 0.28, 0.05), light),
    ]
    roles = [
        join_objects(stone_parts, "GoatShelter_Stone"),
        join_objects(frame, "GoatShelter_Frame"),
        join_objects(wall_parts, "GoatShelter_Walls"),
        join_objects(roof_parts, "GoatShelter_Roof"),
        join_objects(platform, "GoatShelter_Platform"),
    ]
    save_asset("GoatShelter.blend", roles, output_dir)


def create_sheep_fold(output_dir: Path) -> None:
    reset_scene("SheepFold", "2x2")
    hazel = material("Material.SheepFold.Hazel", (0.48, 0.28, 0.12, 1))
    timber = material("Material.SheepFold.Timber", (0.36, 0.2, 0.085, 1))
    roof = material("Material.SheepFold.Roof", (0.63, 0.2, 0.08, 1))
    stone = material("Material.SheepFold.Stone", (0.51, 0.5, 0.43, 1))
    straw = material("Material.SheepFold.Straw", (0.86, 0.6, 0.14, 1))

    stone_parts = [
        add_cube("SheepFold_Base", (0, -0.04, 0.055), (1.72, 1.52, 0.11), stone)
    ]
    wattle_parts: list[bpy.types.Object] = []
    post_locations = [
        (-0.78, -0.65),
        (-0.78, -0.18),
        (-0.78, 0.3),
        (-0.78, 0.65),
        (0.78, -0.65),
        (0.78, -0.18),
        (0.78, 0.3),
        (0.78, 0.65),
        (-0.3, -0.65),
        (0.2, -0.65),
        (0.78, -0.65),
        (-0.78, 0.65),
        (-0.35, 0.65),
        (0.35, 0.65),
        (0.78, 0.65),
    ]
    for index, (x, y) in enumerate(post_locations):
        wattle_parts.append(
            add_cylinder(f"SheepFold_Post_{index}", (x, y, 0.35), 0.035, 0.66, hazel)
        )
    for index, z in enumerate((0.17, 0.3, 0.43, 0.56)):
        offset = 0.018 if index % 2 else -0.018
        wattle_parts.extend(
            [
                add_cylinder(
                    f"SheepFold_LeftWeave_{index}",
                    (-0.78 + offset, 0, z),
                    0.018,
                    1.3,
                    hazel,
                    rotation=(math.pi / 2, 0, 0),
                    vertices=7,
                ),
                add_cylinder(
                    f"SheepFold_RightWeave_{index}",
                    (0.78 - offset, 0, z),
                    0.018,
                    1.3,
                    hazel,
                    rotation=(math.pi / 2, 0, 0),
                    vertices=7,
                ),
                add_cylinder(
                    f"SheepFold_BackWeave_{index}",
                    (0, -0.65 + offset, z),
                    0.018,
                    1.56,
                    hazel,
                    rotation=(0, math.pi / 2, 0),
                    vertices=7,
                ),
            ]
        )
        for side, center_x in (("L", -0.57), ("R", 0.57)):
            wattle_parts.append(
                add_cylinder(
                    f"SheepFold_FrontWeave_{side}_{index}",
                    (center_x, 0.65 - offset, z),
                    0.018,
                    0.42,
                    hazel,
                    rotation=(0, math.pi / 2, 0),
                    vertices=7,
                )
            )

    shelter_frame = [
        add_cube("SheepFold_ShelterPost_L", (-0.68, -0.55, 0.74), (0.09, 0.09, 1.28), timber),
        add_cube("SheepFold_ShelterPost_R", (0.1, -0.55, 0.74), (0.09, 0.09, 1.28), timber),
        add_cube("SheepFold_ShelterFront_L", (-0.68, 0.02, 0.68), (0.09, 0.09, 1.08), timber),
        add_cube("SheepFold_ShelterFront_R", (0.1, 0.02, 0.68), (0.09, 0.09, 1.08), timber),
    ]
    roof_parts = [
        add_cube(
            "SheepFold_ShelterRoof",
            (-0.29, -0.28, 1.34),
            (0.98, 1.02, 0.09),
            roof,
            rotation=(math.radians(-7), 0, 0),
        )
    ]
    straw_parts = straw_scatter("SheepFold", (-0.28, -0.27, 0.14), 12, 0.68, straw)
    gate_parts = [
        add_cube("SheepFold_GateLeft", (-0.19, 0.65, 0.37), (0.06, 0.06, 0.58), timber),
        add_cube("SheepFold_GateRight", (0.19, 0.65, 0.37), (0.06, 0.06, 0.58), timber),
        add_cube("SheepFold_GateTop", (0, 0.65, 0.62), (0.42, 0.06, 0.06), timber),
    ]
    roles = [
        join_objects(stone_parts, "SheepFold_Stone"),
        join_objects(wattle_parts, "SheepFold_Wattle"),
        join_objects(shelter_frame, "SheepFold_ShelterFrame"),
        join_objects(roof_parts, "SheepFold_Roof"),
        join_objects(straw_parts, "SheepFold_Straw"),
        join_objects(gate_parts, "SheepFold_Gate"),
    ]
    save_asset("SheepFold.blend", roles, output_dir)


GENERATORS: dict[str, Callable[[Path], None]] = {
    "RabbitHutch": create_rabbit_hutch,
    "HorseStable": create_horse_stable,
    "CowShelter": create_cow_shelter,
    "GoatShelter": create_goat_shelter,
    "SheepFold": create_sheep_fold,
}


def main() -> None:
    args = parse_args()
    requested = args.assets or list(GENERATORS)
    unknown = sorted(set(requested) - set(GENERATORS))
    if unknown:
        raise ValueError(f"Unknown assets: {', '.join(unknown)}")
    for asset_name in requested:
        GENERATORS[asset_name](args.output_dir.resolve())


if __name__ == "__main__":
    main()
