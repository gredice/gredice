#!/usr/bin/env python3
"""Generate the original Gredice chicken, piglet, goat, and animal homes.

Run with Blender, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python assets/scripts/generate-farm-animals.py \
      -- --output-dir assets/game-assets
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
    parser.add_argument(
        "--output-dir",
        type=Path,
        required=True,
        help="Directory that receives one .blend file per asset.",
    )
    parser.add_argument(
        "--asset",
        action="append",
        dest="assets",
        help="Generate only this asset name. May be supplied more than once.",
    )
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def reset_scene(asset_name: str) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene.world = bpy.data.worlds.new("Gredice World")
    scene.world.color = (0.055, 0.07, 0.06)
    scene["generated_by"] = "assets/scripts/generate-farm-animals.py"
    scene["asset_name"] = asset_name


def srgb_channel_to_linear(value: float) -> float:
    if value <= 0.04045:
        return value / 12.92
    return ((value + 0.055) / 1.055) ** 2.4


def linear_rgba(
    color: tuple[float, float, float, float],
) -> tuple[float, float, float, float]:
    red, green, blue, alpha = color
    return (
        srgb_channel_to_linear(red),
        srgb_channel_to_linear(green),
        srgb_channel_to_linear(blue),
        alpha,
    )


def material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    roughness: float = 0.86,
    metallic: float = 0,
) -> bpy.types.Material:
    linear_color = linear_rgba(color)
    value = bpy.data.materials.new(name)
    value.diffuse_color = linear_color
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    if shader:
        shader.inputs["Base Color"].default_value = linear_color
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = metallic
    return value


def activate(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_transforms(obj: bpy.types.Object) -> None:
    activate(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def bevel(obj: bpy.types.Object, width: float, segments: int = 2) -> None:
    activate(obj)
    modifier = obj.modifiers.new(name="Soft bevel", type="BEVEL")
    modifier.width = width
    modifier.segments = segments
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
    bevel_width: float = 0.025,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    apply_transforms(obj)
    if bevel_width > 0:
        bevel(obj, bevel_width)
    assign_material(obj, value)
    return obj


def add_ico_sphere(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    value: bpy.types.Material,
    *,
    subdivisions: int = 2,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=subdivisions,
        radius=1,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_transforms(obj)
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
    vertices: int = 10,
    bevel_width: float = 0.012,
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
    apply_transforms(obj)
    if bevel_width > 0:
        bevel(obj, bevel_width, 1)
    assign_material(obj, value)
    return obj


def add_cone(
    name: str,
    location: tuple[float, float, float],
    radius1: float,
    radius2: float,
    depth: float,
    value: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0, 0, 0),
    vertices: int = 8,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    apply_transforms(obj)
    assign_material(obj, value)
    return obj


def add_torus(
    name: str,
    location: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    value: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0, 0, 0),
    major_segments: int = 12,
    minor_segments: int = 5,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=major_segments,
        minor_segments=minor_segments,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    apply_transforms(obj)
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
    return result


def empty(name: str, location: tuple[float, float, float]) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.12
    obj.location = location
    bpy.context.collection.objects.link(obj)
    return obj


def parent_keep_transform(
    child: bpy.types.Object, parent: bpy.types.Object
) -> None:
    world_matrix = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world_matrix


def save_asset(
    filename: str,
    expected_names: Iterable[str],
    output_dir: Path,
) -> None:
    actual_names = {obj.name for obj in bpy.context.scene.objects}
    expected = set(expected_names)
    missing = sorted(expected - actual_names)
    unexpected = sorted(actual_names - expected)
    if missing or unexpected:
        raise RuntimeError(
            f"Unexpected {filename} objects; missing={missing}, unexpected={unexpected}"
        )

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / filename
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path), compress=True)
    print(f"Saved {output_path}")


def create_chicken(output_dir: Path) -> None:
    reset_scene("Chicken")
    cream = material("Material.Chicken.Cream", (0.92, 0.79, 0.52, 1))
    cream_light = material(
        "Material.Chicken.CreamLight", (1.0, 0.91, 0.68, 1)
    )
    cream_dark = material(
        "Material.Chicken.CreamDark", (0.66, 0.42, 0.22, 1)
    )
    red = material("Material.Chicken.Red", (0.72, 0.08, 0.06, 1))
    orange = material("Material.Chicken.Orange", (0.92, 0.43, 0.08, 1))
    charcoal = material(
        "Material.Chicken.Charcoal", (0.025, 0.03, 0.025, 1), roughness=0.68
    )
    eye_glint = material(
        "Material.Chicken.EyeGlint", (0.95, 0.92, 0.76, 1), roughness=0.45
    )

    root = empty("Chicken_Root", (0, 0, 0))
    body_pivot = empty("Chicken_BodyPivot", (0, 0, 0.54))
    head_pivot = empty("Chicken_HeadPivot", (0, 0.31, 0.73))
    wing_left_pivot = empty("Chicken_WingPivot_L", (-0.31, 0.02, 0.58))
    wing_right_pivot = empty("Chicken_WingPivot_R", (0.31, 0.02, 0.58))
    leg_left_pivot = empty("Chicken_LegPivot_L", (-0.15, 0.02, 0.29))
    leg_right_pivot = empty("Chicken_LegPivot_R", (0.15, 0.02, 0.29))
    tail_pivot = empty("Chicken_TailPivot", (0, -0.35, 0.65))

    parent_keep_transform(body_pivot, root)
    parent_keep_transform(head_pivot, body_pivot)
    parent_keep_transform(wing_left_pivot, body_pivot)
    parent_keep_transform(wing_right_pivot, body_pivot)
    parent_keep_transform(leg_left_pivot, root)
    parent_keep_transform(leg_right_pivot, root)
    parent_keep_transform(tail_pivot, body_pivot)

    body = add_ico_sphere(
        "Chicken_Body", (0, -0.02, 0.56), (0.39, 0.5, 0.43), cream
    )
    breast = add_ico_sphere(
        "Chicken_Breast", (0, 0.24, 0.55), (0.31, 0.3, 0.35), cream_light
    )
    head = add_ico_sphere(
        "Chicken_Head", (0, 0.34, 0.82), (0.27, 0.25, 0.27), cream_light
    )
    beak = add_cone(
        "Chicken_Beak",
        (0, 0.62, 0.82),
        0.12,
        0,
        0.26,
        orange,
        rotation=(-math.pi / 2, 0, 0),
        vertices=6,
    )
    wattle = add_ico_sphere(
        "Chicken_Wattle", (0, 0.51, 0.69), (0.07, 0.05, 0.12), red, subdivisions=1
    )
    comb_parts = [
        add_ico_sphere(
            f"Chicken_CombPart_{index}",
            (0, 0.23 + index * 0.085, 1.05 + (1 - abs(index - 1)) * 0.035),
            (0.075, 0.075, 0.12),
            red,
            subdivisions=1,
        )
        for index in range(3)
    ]
    comb = join_objects(comb_parts, "Chicken_Comb")

    eye_left = add_ico_sphere(
        "Chicken_Eye_L", (-0.205, 0.515, 0.88), (0.058, 0.038, 0.064), charcoal, subdivisions=2
    )
    eye_right = add_ico_sphere(
        "Chicken_Eye_R", (0.205, 0.515, 0.88), (0.058, 0.038, 0.064), charcoal, subdivisions=2
    )
    glint_left = add_ico_sphere(
        "Chicken_EyeGlint_L", (-0.224, 0.548, 0.905), (0.017, 0.012, 0.017), eye_glint, subdivisions=1
    )
    glint_right = add_ico_sphere(
        "Chicken_EyeGlint_R", (0.224, 0.548, 0.905), (0.017, 0.012, 0.017), eye_glint, subdivisions=1
    )

    wing_left = add_ico_sphere(
        "Chicken_Wing_L", (-0.35, -0.01, 0.58), (0.13, 0.36, 0.3), cream_dark
    )
    wing_right = add_ico_sphere(
        "Chicken_Wing_R", (0.35, -0.01, 0.58), (0.13, 0.36, 0.3), cream_dark
    )
    tail_parts = []
    for index, x in enumerate((-0.18, 0, 0.18)):
        tail_parts.append(
            add_cone(
                f"Chicken_TailFeather_{index}",
                (x, -0.49, 0.78 + (1 - abs(index - 1)) * 0.08),
                0.14,
                0.055,
                0.48,
                cream_dark,
                rotation=(math.radians(-24), 0, 0),
                vertices=6,
            )
        )
    tail = join_objects(tail_parts, "Chicken_TailFan")

    legs: list[bpy.types.Object] = []
    feet: list[bpy.types.Object] = []
    for side, x, pivot in (
        ("L", -0.15, leg_left_pivot),
        ("R", 0.15, leg_right_pivot),
    ):
        leg = add_cylinder(
            f"Chicken_Leg_{side}", (x, 0.01, 0.2), 0.035, 0.3, orange, vertices=7
        )
        toe_parts = [
            add_cylinder(
                f"Chicken_Toe_{side}_{index}",
                (x + spread, 0.15 + abs(spread) * 0.15, 0.055),
                0.018,
                0.25,
                orange,
                rotation=(math.pi / 2, 0, math.radians(angle)),
                vertices=6,
                bevel_width=0.004,
            )
            for index, (spread, angle) in enumerate(((-0.045, -18), (0, 0), (0.045, 18)))
        ]
        foot = join_objects(toe_parts, f"Chicken_Foot_{side}")
        parent_keep_transform(leg, pivot)
        parent_keep_transform(foot, pivot)
        legs.append(leg)
        feet.append(foot)

    for obj in (body, breast):
        parent_keep_transform(obj, body_pivot)
    for obj in (
        head,
        beak,
        wattle,
        comb,
        eye_left,
        eye_right,
        glint_left,
        glint_right,
    ):
        parent_keep_transform(obj, head_pivot)
    parent_keep_transform(wing_left, wing_left_pivot)
    parent_keep_transform(wing_right, wing_right_pivot)
    parent_keep_transform(tail, tail_pivot)

    # Blender +Y exports as runtime -Z, while the shared animal movement
    # convention treats runtime +Z as forward. Rotate the complete rig so its
    # beak, feet, and procedural poses face the direction of travel.
    root.rotation_euler.z = math.pi

    expected_names = [
        "Chicken_Root",
        "Chicken_BodyPivot",
        "Chicken_HeadPivot",
        "Chicken_WingPivot_L",
        "Chicken_WingPivot_R",
        "Chicken_LegPivot_L",
        "Chicken_LegPivot_R",
        "Chicken_TailPivot",
        "Chicken_Body",
        "Chicken_Breast",
        "Chicken_Head",
        "Chicken_Beak",
        "Chicken_Wattle",
        "Chicken_Comb",
        "Chicken_Eye_L",
        "Chicken_Eye_R",
        "Chicken_EyeGlint_L",
        "Chicken_EyeGlint_R",
        "Chicken_Wing_L",
        "Chicken_Wing_R",
        "Chicken_TailFan",
        "Chicken_Leg_L",
        "Chicken_Leg_R",
        "Chicken_Foot_L",
        "Chicken_Foot_R",
    ]
    save_asset("Chicken.blend", expected_names, output_dir)


def create_piglet(output_dir: Path) -> None:
    reset_scene("Piglet")
    pink = material("Material.Piglet.Pink", (0.94, 0.52, 0.55, 1))
    light_pink = material(
        "Material.Piglet.LightPink", (1.0, 0.68, 0.68, 1)
    )
    dark_pink = material(
        "Material.Piglet.DarkPink", (0.67, 0.23, 0.27, 1)
    )
    hoof = material("Material.Piglet.Hoof", (0.27, 0.13, 0.12, 1))
    charcoal = material(
        "Material.Piglet.Charcoal", (0.028, 0.025, 0.025, 1), roughness=0.65
    )
    glint = material(
        "Material.Piglet.EyeGlint", (1.0, 0.93, 0.78, 1), roughness=0.42
    )

    root = empty("Piglet_Root", (0, 0, 0))
    body_pivot = empty("Piglet_BodyPivot", (0, -0.03, 0.48))
    head_pivot = empty("Piglet_HeadPivot", (0, 0.49, 0.58))
    ear_left_pivot = empty("Piglet_EarPivot_L", (-0.25, 0.5, 0.82))
    ear_right_pivot = empty("Piglet_EarPivot_R", (0.25, 0.5, 0.82))
    tail_pivot = empty("Piglet_TailPivot", (0, -0.56, 0.59))
    leg_pivots = {
        "FL": empty("Piglet_LegPivot_FL", (-0.25, 0.3, 0.27)),
        "FR": empty("Piglet_LegPivot_FR", (0.25, 0.3, 0.27)),
        "RL": empty("Piglet_LegPivot_RL", (-0.25, -0.35, 0.27)),
        "RR": empty("Piglet_LegPivot_RR", (0.25, -0.35, 0.27)),
    }

    parent_keep_transform(body_pivot, root)
    parent_keep_transform(head_pivot, body_pivot)
    parent_keep_transform(ear_left_pivot, head_pivot)
    parent_keep_transform(ear_right_pivot, head_pivot)
    parent_keep_transform(tail_pivot, body_pivot)
    for pivot in leg_pivots.values():
        parent_keep_transform(pivot, root)

    body = add_ico_sphere(
        "Piglet_Body", (0, -0.06, 0.5), (0.43, 0.63, 0.39), pink
    )
    belly = add_ico_sphere(
        "Piglet_Belly", (0, 0.02, 0.32), (0.34, 0.49, 0.21), light_pink
    )
    head = add_ico_sphere(
        "Piglet_Head", (0, 0.5, 0.62), (0.38, 0.36, 0.34), pink
    )
    snout = add_ico_sphere(
        "Piglet_Snout", (0, 0.84, 0.57), (0.25, 0.18, 0.19), light_pink
    )
    nostril_left = add_ico_sphere(
        "Piglet_Nostril_L", (-0.09, 0.995, 0.59), (0.038, 0.022, 0.034), dark_pink, subdivisions=1
    )
    nostril_right = add_ico_sphere(
        "Piglet_Nostril_R", (0.09, 0.995, 0.59), (0.038, 0.022, 0.034), dark_pink, subdivisions=1
    )
    eye_left = add_ico_sphere(
        "Piglet_Eye_L", (-0.255, 0.74, 0.75), (0.06, 0.038, 0.065), charcoal
    )
    eye_right = add_ico_sphere(
        "Piglet_Eye_R", (0.255, 0.74, 0.75), (0.06, 0.038, 0.065), charcoal
    )
    glint_left = add_ico_sphere(
        "Piglet_EyeGlint_L", (-0.275, 0.771, 0.777), (0.017, 0.012, 0.017), glint, subdivisions=1
    )
    glint_right = add_ico_sphere(
        "Piglet_EyeGlint_R", (0.275, 0.771, 0.777), (0.017, 0.012, 0.017), glint, subdivisions=1
    )
    cheek_left = add_ico_sphere(
        "Piglet_Cheek_L", (-0.285, 0.67, 0.58), (0.08, 0.04, 0.06), light_pink, subdivisions=1
    )
    cheek_right = add_ico_sphere(
        "Piglet_Cheek_R", (0.285, 0.67, 0.58), (0.08, 0.04, 0.06), light_pink, subdivisions=1
    )

    ear_left = add_cone(
        "Piglet_Ear_L",
        (-0.27, 0.52, 0.93),
        0.2,
        0.02,
        0.38,
        pink,
        rotation=(math.radians(-10), math.radians(-18), math.radians(15)),
        vertices=5,
    )
    ear_right = add_cone(
        "Piglet_Ear_R",
        (0.27, 0.52, 0.93),
        0.2,
        0.02,
        0.38,
        pink,
        rotation=(math.radians(-10), math.radians(18), math.radians(-15)),
        vertices=5,
    )

    legs: list[bpy.types.Object] = []
    hooves: list[bpy.types.Object] = []
    for key, pivot in leg_pivots.items():
        x = -0.25 if key.endswith("L") else 0.25
        y = 0.3 if key.startswith("F") else -0.35
        leg = add_cylinder(
            f"Piglet_Leg_{key}", (x, y, 0.22), 0.095, 0.36, pink, vertices=8
        )
        foot = add_ico_sphere(
            f"Piglet_Hoof_{key}", (x, y + 0.035, 0.06), (0.11, 0.15, 0.085), hoof, subdivisions=1
        )
        parent_keep_transform(leg, pivot)
        parent_keep_transform(foot, pivot)
        legs.append(leg)
        hooves.append(foot)

    tail = add_torus(
        "Piglet_TailCurl",
        (0, -0.69, 0.62),
        0.12,
        0.035,
        dark_pink,
        rotation=(math.pi / 2, 0, 0),
        major_segments=10,
        minor_segments=5,
    )
    tail_tip = add_ico_sphere(
        "Piglet_TailTip", (0.09, -0.705, 0.69), (0.045, 0.045, 0.045), dark_pink, subdivisions=1
    )

    for obj in (body, belly):
        parent_keep_transform(obj, body_pivot)
    for obj in (
        head,
        snout,
        nostril_left,
        nostril_right,
        eye_left,
        eye_right,
        glint_left,
        glint_right,
        cheek_left,
        cheek_right,
    ):
        parent_keep_transform(obj, head_pivot)
    parent_keep_transform(ear_left, ear_left_pivot)
    parent_keep_transform(ear_right, ear_right_pivot)
    parent_keep_transform(tail, tail_pivot)
    parent_keep_transform(tail_tip, tail_pivot)

    # Blender +Y exports as runtime -Z, while the shared animal movement
    # convention treats runtime +Z as forward. Rotate the complete rig so its
    # snout, legs, and procedural poses face the direction of travel.
    root.rotation_euler.z = math.pi

    expected_names = [
        "Piglet_Root",
        "Piglet_BodyPivot",
        "Piglet_HeadPivot",
        "Piglet_EarPivot_L",
        "Piglet_EarPivot_R",
        "Piglet_TailPivot",
        "Piglet_LegPivot_FL",
        "Piglet_LegPivot_FR",
        "Piglet_LegPivot_RL",
        "Piglet_LegPivot_RR",
        "Piglet_Body",
        "Piglet_Belly",
        "Piglet_Head",
        "Piglet_Snout",
        "Piglet_Nostril_L",
        "Piglet_Nostril_R",
        "Piglet_Eye_L",
        "Piglet_Eye_R",
        "Piglet_EyeGlint_L",
        "Piglet_EyeGlint_R",
        "Piglet_Cheek_L",
        "Piglet_Cheek_R",
        "Piglet_Ear_L",
        "Piglet_Ear_R",
        "Piglet_Leg_FL",
        "Piglet_Leg_FR",
        "Piglet_Leg_RL",
        "Piglet_Leg_RR",
        "Piglet_Hoof_FL",
        "Piglet_Hoof_FR",
        "Piglet_Hoof_RL",
        "Piglet_Hoof_RR",
        "Piglet_TailCurl",
        "Piglet_TailTip",
    ]
    save_asset("Piglet.blend", expected_names, output_dir)


def create_goat(output_dir: Path) -> None:
    """Create a compact Croatian-spotted-goat-inspired garden companion."""

    reset_scene("Goat")
    cream = material("Material.Goat.Cream", (0.86, 0.79, 0.63, 1))
    cream_light = material(
        "Material.Goat.CreamLight", (0.96, 0.9, 0.75, 1)
    )
    charcoal = material(
        "Material.Goat.Charcoal", (0.09, 0.085, 0.075, 1), roughness=0.78
    )
    horn = material(
        "Material.Goat.Horn", (0.22, 0.19, 0.15, 1), roughness=0.9
    )
    hoof = material("Material.Goat.Hoof", (0.12, 0.105, 0.09, 1))
    eye = material(
        "Material.Goat.Eye", (0.025, 0.022, 0.018, 1), roughness=0.58
    )
    eye_glint = material(
        "Material.Goat.EyeGlint", (1.0, 0.93, 0.72, 1), roughness=0.4
    )
    collar = material(
        "Material.Goat.Collar", (0.12, 0.31, 0.2, 1), roughness=0.64
    )
    charm = material(
        "Material.Goat.SunflowerCharm", (0.94, 0.58, 0.08, 1), roughness=0.5
    )

    root = empty("Goat_Root", (0, 0, 0))
    body_pivot = empty("Goat_BodyPivot", (0, -0.06, 0.76))
    neck_pivot = empty("Goat_NeckPivot", (0, 0.43, 0.94))
    head_pivot = empty("Goat_HeadPivot", (0, 0.68, 1.2))
    jaw_pivot = empty("Goat_JawPivot", (0, 0.91, 1.1))
    ear_left_pivot = empty("Goat_EarPivot_L", (-0.22, 0.67, 1.35))
    ear_right_pivot = empty("Goat_EarPivot_R", (0.22, 0.67, 1.35))
    tail_pivot = empty("Goat_TailPivot", (0, -0.73, 0.91))
    leg_pivots = {
        "FL": empty("Goat_LegPivot_FL", (-0.27, 0.36, 0.49)),
        "FR": empty("Goat_LegPivot_FR", (0.27, 0.36, 0.49)),
        "RL": empty("Goat_LegPivot_RL", (-0.27, -0.45, 0.49)),
        "RR": empty("Goat_LegPivot_RR", (0.27, -0.45, 0.49)),
    }

    parent_keep_transform(body_pivot, root)
    parent_keep_transform(neck_pivot, body_pivot)
    parent_keep_transform(head_pivot, neck_pivot)
    parent_keep_transform(jaw_pivot, head_pivot)
    parent_keep_transform(ear_left_pivot, head_pivot)
    parent_keep_transform(ear_right_pivot, head_pivot)
    parent_keep_transform(tail_pivot, body_pivot)
    for pivot in leg_pivots.values():
        parent_keep_transform(pivot, root)

    body = add_ico_sphere(
        "Goat_Body", (0, -0.08, 0.79), (0.43, 0.7, 0.39), cream
    )
    chest = add_ico_sphere(
        "Goat_Chest", (0, 0.39, 0.82), (0.37, 0.36, 0.42), cream_light
    )
    patch_parts = [
        add_ico_sphere(
            "Goat_CoatPatch",
            (-0.375, -0.1, 0.86),
            (0.075, 0.31, 0.22),
            charcoal,
            subdivisions=2,
        ),
        add_ico_sphere(
            "Goat_CoatPatch",
            (0.375, -0.32, 0.76),
            (0.075, 0.22, 0.18),
            charcoal,
            subdivisions=2,
        ),
    ]
    coat_patches = join_objects(patch_parts, "Goat_CoatPatches")
    neck = add_ico_sphere(
        "Goat_Neck", (0, 0.47, 1.0), (0.27, 0.31, 0.43), cream_light
    )
    head = add_ico_sphere(
        "Goat_Head", (0, 0.72, 1.24), (0.3, 0.37, 0.29), cream_light
    )
    muzzle = add_ico_sphere(
        "Goat_Muzzle", (0, 1.02, 1.14), (0.21, 0.23, 0.17), cream
    )
    jaw = add_ico_sphere(
        "Goat_Jaw", (0, 0.98, 1.055), (0.19, 0.2, 0.09), cream
    )
    beard = add_cone(
        "Goat_Beard",
        (0, 0.84, 0.94),
        0.12,
        0.035,
        0.3,
        charcoal,
        rotation=(math.radians(4), 0, 0),
        vertices=7,
    )

    eye_left = add_ico_sphere(
        "Goat_Eye_L",
        (-0.225, 0.94, 1.31),
        (0.055, 0.034, 0.052),
        eye,
        subdivisions=2,
    )
    eye_right = add_ico_sphere(
        "Goat_Eye_R",
        (0.225, 0.94, 1.31),
        (0.055, 0.034, 0.052),
        eye,
        subdivisions=2,
    )
    glint_left = add_ico_sphere(
        "Goat_EyeGlint_L",
        (-0.242, 0.968, 1.328),
        (0.014, 0.01, 0.014),
        eye_glint,
        subdivisions=1,
    )
    glint_right = add_ico_sphere(
        "Goat_EyeGlint_R",
        (0.242, 0.968, 1.328),
        (0.014, 0.01, 0.014),
        eye_glint,
        subdivisions=1,
    )

    ear_left = add_ico_sphere(
        "Goat_Ear_L", (-0.35, 0.72, 1.36), (0.2, 0.085, 0.07), charcoal
    )
    ear_right = add_ico_sphere(
        "Goat_Ear_R", (0.35, 0.72, 1.36), (0.2, 0.085, 0.07), charcoal
    )

    horns: list[bpy.types.Object] = []
    for side, x in (("L", -0.16), ("R", 0.16)):
        horn_parts = [
            add_cone(
                f"Goat_HornBase_{side}",
                (x, 0.58, 1.51),
                0.07,
                0.052,
                0.34,
                horn,
                rotation=(math.radians(38), 0, math.radians(4 if side == "L" else -4)),
                vertices=8,
            ),
            add_cone(
                f"Goat_HornTip_{side}",
                (x * 1.12, 0.4, 1.61),
                0.052,
                0.012,
                0.31,
                horn,
                rotation=(math.radians(62), 0, math.radians(7 if side == "L" else -7)),
                vertices=8,
            ),
        ]
        joined_horn = join_objects(horn_parts, f"Goat_Horn_{side}")
        parent_keep_transform(joined_horn, head_pivot)
        horns.append(joined_horn)

    legs: list[bpy.types.Object] = []
    hooves: list[bpy.types.Object] = []
    for key, pivot in leg_pivots.items():
        x = -0.27 if key.endswith("L") else 0.27
        y = 0.36 if key.startswith("F") else -0.45
        leg = add_cylinder(
            f"Goat_Leg_{key}",
            (x, y, 0.31),
            0.072,
            0.58,
            cream,
            vertices=8,
        )
        foot = add_ico_sphere(
            f"Goat_Hoof_{key}",
            (x, y + 0.035, 0.055),
            (0.085, 0.13, 0.075),
            hoof,
            subdivisions=1,
        )
        parent_keep_transform(leg, pivot)
        parent_keep_transform(foot, pivot)
        legs.append(leg)
        hooves.append(foot)

    tail = add_cone(
        "Goat_Tail",
        (0, -0.85, 1.03),
        0.105,
        0.035,
        0.35,
        cream_light,
        rotation=(math.radians(-38), 0, 0),
        vertices=8,
    )
    collar_ring = add_torus(
        "Goat_Collar",
        (0, 0.54, 1.08),
        0.24,
        0.026,
        collar,
        major_segments=14,
        minor_segments=5,
    )
    sunflower_charm = add_ico_sphere(
        "Goat_SunflowerCharm",
        (0, 0.79, 1.02),
        (0.055, 0.035, 0.065),
        charm,
        subdivisions=1,
    )

    for obj in (body, chest, coat_patches):
        parent_keep_transform(obj, body_pivot)
    parent_keep_transform(neck, neck_pivot)
    for obj in (
        head,
        muzzle,
        beard,
        eye_left,
        eye_right,
        glint_left,
        glint_right,
        collar_ring,
        sunflower_charm,
    ):
        parent_keep_transform(obj, head_pivot)
    parent_keep_transform(jaw, jaw_pivot)
    parent_keep_transform(ear_left, ear_left_pivot)
    parent_keep_transform(ear_right, ear_right_pivot)
    parent_keep_transform(tail, tail_pivot)

    # Align the authored +Y face with the runtime animal +Z travel convention.
    root.rotation_euler.z = math.pi

    expected_names = [
        "Goat_Root",
        "Goat_BodyPivot",
        "Goat_NeckPivot",
        "Goat_HeadPivot",
        "Goat_JawPivot",
        "Goat_EarPivot_L",
        "Goat_EarPivot_R",
        "Goat_TailPivot",
        "Goat_LegPivot_FL",
        "Goat_LegPivot_FR",
        "Goat_LegPivot_RL",
        "Goat_LegPivot_RR",
        "Goat_Body",
        "Goat_Chest",
        "Goat_CoatPatches",
        "Goat_Neck",
        "Goat_Head",
        "Goat_Muzzle",
        "Goat_Jaw",
        "Goat_Beard",
        "Goat_Eye_L",
        "Goat_Eye_R",
        "Goat_EyeGlint_L",
        "Goat_EyeGlint_R",
        "Goat_Ear_L",
        "Goat_Ear_R",
        "Goat_Horn_L",
        "Goat_Horn_R",
        "Goat_Leg_FL",
        "Goat_Leg_FR",
        "Goat_Leg_RL",
        "Goat_Leg_RR",
        "Goat_Hoof_FL",
        "Goat_Hoof_FR",
        "Goat_Hoof_RL",
        "Goat_Hoof_RR",
        "Goat_Tail",
        "Goat_Collar",
        "Goat_SunflowerCharm",
    ]
    save_asset("Goat.blend", expected_names, output_dir)


def create_chicken_coop(output_dir: Path) -> None:
    reset_scene("ChickenCoop")
    wood = material("Material.ChickenCoop.Oak", (0.42, 0.23, 0.1, 1))
    wood_light = material(
        "Material.ChickenCoop.OakLight", (0.67, 0.42, 0.19, 1)
    )
    terracotta = material(
        "Material.ChickenCoop.Terracotta", (0.67, 0.19, 0.09, 1)
    )
    limewash = material(
        "Material.ChickenCoop.Limewash", (0.88, 0.8, 0.62, 1)
    )
    dark = material("Material.ChickenCoop.Dark", (0.07, 0.045, 0.028, 1))
    straw = material("Material.ChickenCoop.Straw", (0.88, 0.61, 0.15, 1))
    water = material(
        "Material.ChickenCoop.Water", (0.18, 0.43, 0.5, 1), roughness=0.28
    )

    wood_parts: list[bpy.types.Object] = []
    light_parts: list[bpy.types.Object] = []
    roof_parts: list[bpy.types.Object] = []
    trim_parts: list[bpy.types.Object] = []
    dark_parts: list[bpy.types.Object] = []
    straw_parts: list[bpy.types.Object] = []
    bowl_parts: list[bpy.types.Object] = []
    water_parts: list[bpy.types.Object] = []

    wood_parts.append(add_cube("Coop_Base", (0, -0.03, 0.2), (0.76, 0.68, 0.1), wood))
    for x in (-0.31, 0.31):
        wood_parts.append(add_cube("Coop_Leg", (x, -0.02, 0.13), (0.09, 0.09, 0.27), wood))
    light_parts.extend(
        [
            add_cube("Coop_Back", (0, -0.31, 0.56), (0.74, 0.08, 0.65), wood_light),
            add_cube("Coop_Left", (-0.35, -0.03, 0.56), (0.08, 0.56, 0.65), wood_light),
            add_cube("Coop_Right", (0.35, -0.03, 0.56), (0.08, 0.56, 0.65), wood_light),
            add_cube("Coop_FrontTop", (0, 0.27, 0.78), (0.74, 0.08, 0.2), wood_light),
            add_cube("Coop_FrontLeft", (-0.27, 0.27, 0.52), (0.2, 0.08, 0.34), wood_light),
            add_cube("Coop_FrontRight", (0.27, 0.27, 0.52), (0.2, 0.08, 0.34), wood_light),
        ]
    )
    dark_parts.append(add_cube("Coop_Entrance", (0, 0.305, 0.52), (0.29, 0.025, 0.34), dark, bevel_width=0.015))
    trim_parts.extend(
        [
            add_cube("Coop_DoorTrimLeft", (-0.175, 0.325, 0.52), (0.04, 0.045, 0.39), limewash, bevel_width=0.01),
            add_cube("Coop_DoorTrimRight", (0.175, 0.325, 0.52), (0.04, 0.045, 0.39), limewash, bevel_width=0.01),
            add_cube("Coop_DoorTrimTop", (0, 0.325, 0.71), (0.39, 0.045, 0.04), limewash, bevel_width=0.01),
        ]
    )
    roof_parts.extend(
        [
            add_cube(
                "Coop_RoofLeft", (-0.205, -0.03, 0.98), (0.52, 0.82, 0.075), terracotta, rotation=(0, math.radians(-25), 0)
            ),
            add_cube(
                "Coop_RoofRight", (0.205, -0.03, 0.98), (0.52, 0.82, 0.075), terracotta, rotation=(0, math.radians(25), 0)
            ),
            add_cylinder("Coop_Ridge", (0, -0.03, 1.09), 0.055, 0.84, terracotta, rotation=(math.pi / 2, 0, 0), vertices=8),
        ]
    )
    light_parts.append(
        add_cube(
            "Coop_Ramp",
            (0, 0.54, 0.22),
            (0.34, 0.58, 0.055),
            wood_light,
            rotation=(math.radians(-18), 0, 0),
            bevel_width=0.012,
        )
    )
    for index in range(4):
        wood_parts.append(
            add_cube(
                "Coop_RampCleat",
                (0, 0.36 + index * 0.12, 0.29 - index * 0.037),
                (0.38, 0.035, 0.035),
                wood,
                rotation=(math.radians(-18), 0, 0),
                bevel_width=0.007,
            )
        )

    # A small hazel-wattle side enclosure gives the silhouette a local garden character.
    for x in (-0.46, 0.46):
        for y in (0.16, 0.5, 0.82):
            wood_parts.append(add_cylinder("Coop_WattlePost", (x, y, 0.28), 0.025, 0.55, wood, vertices=7, bevel_width=0.005))
    for x in (-0.46, 0.46):
        for index, z in enumerate((0.13, 0.22, 0.31, 0.4, 0.49)):
            wood_parts.append(add_cylinder("Coop_WattleWeave", (x, 0.5 + (index % 2) * 0.025, z), 0.016, 0.7, wood, rotation=(math.pi / 2, 0, 0), vertices=7, bevel_width=0.004))

    for index in range(7):
        straw_parts.append(add_cylinder("Coop_Straw", (-0.22 + index * 0.072, -0.03 + (index % 2) * 0.05, 0.3), 0.014, 0.42, straw, rotation=(math.radians(82), math.radians(index * 11), 0), vertices=6, bevel_width=0.003))
    bowl_parts.extend(
        [
            add_cylinder(
                "Coop_Bowl",
                (-0.31, 0.67, 0.095),
                0.12,
                0.07,
                wood,
                vertices=12,
            ),
            add_torus(
                "Coop_BowlRim",
                (-0.31, 0.67, 0.135),
                0.11,
                0.018,
                wood,
                major_segments=12,
                minor_segments=5,
            ),
        ]
    )
    water_parts.append(
        add_cylinder(
            "Coop_Water",
            (-0.31, 0.67, 0.137),
            0.09,
            0.008,
            water,
            vertices=12,
            bevel_width=0,
        )
    )

    roles = [
        join_objects(wood_parts, "ChickenCoop_WoodDark"),
        join_objects(light_parts, "ChickenCoop_WoodLight"),
        join_objects(roof_parts, "ChickenCoop_Roof"),
        join_objects(trim_parts, "ChickenCoop_Trim"),
        join_objects(dark_parts, "ChickenCoop_Entrance"),
        join_objects(straw_parts, "ChickenCoop_Straw"),
        join_objects(bowl_parts, "ChickenCoop_Bowl"),
        join_objects(water_parts, "ChickenCoop_Water"),
    ]
    save_asset("ChickenCoop.blend", [obj.name for obj in roles], output_dir)


def create_piglet_pen(output_dir: Path) -> None:
    reset_scene("PigletPen")
    oak = material("Material.PigletPen.Oak", (0.43, 0.25, 0.12, 1))
    hazel = material("Material.PigletPen.Hazel", (0.58, 0.35, 0.16, 1))
    limewash = material("Material.PigletPen.Limewash", (0.86, 0.79, 0.64, 1))
    roof = material("Material.PigletPen.Roof", (0.56, 0.16, 0.08, 1))
    stone = material("Material.PigletPen.Stone", (0.48, 0.47, 0.4, 1))
    mud = material("Material.PigletPen.Mud", (0.2, 0.105, 0.055, 1), roughness=0.46)
    straw = material("Material.PigletPen.Straw", (0.83, 0.58, 0.14, 1))
    enamel = material("Material.PigletPen.Enamel", (0.22, 0.39, 0.43, 1), roughness=0.55, metallic=0.12)

    wood_parts: list[bpy.types.Object] = []
    wattle_parts: list[bpy.types.Object] = []
    wall_parts: list[bpy.types.Object] = []
    roof_parts: list[bpy.types.Object] = []
    stone_parts: list[bpy.types.Object] = []
    mud_parts: list[bpy.types.Object] = []
    straw_parts: list[bpy.types.Object] = []
    trough_parts: list[bpy.types.Object] = []

    stone_parts.append(add_cube("Pen_Foundation", (-0.19, -0.22, 0.075), (0.64, 0.52, 0.15), stone, bevel_width=0.045))
    wall_parts.extend(
        [
            add_cube("Pen_BackWall", (-0.19, -0.44, 0.43), (0.64, 0.09, 0.62), limewash),
            add_cube("Pen_LeftWall", (-0.47, -0.2, 0.43), (0.09, 0.52, 0.62), limewash),
        ]
    )
    for x in (-0.46, 0.08):
        wood_parts.append(add_cube("Pen_ShelterPost", (x, 0.02, 0.43), (0.08, 0.08, 0.72), oak, bevel_width=0.018))
    roof_parts.append(add_cube("Pen_ShelterRoof", (-0.19, -0.19, 0.81), (0.78, 0.7, 0.09), roof, rotation=(math.radians(-7), 0, 0), bevel_width=0.025))

    # Open woven fencing leaves the mud wallow readable from the game camera.
    for x, y in ((-0.48, 0.42), (0.0, 0.46), (0.48, 0.42), (0.48, -0.12), (0.48, -0.46)):
        wattle_parts.append(add_cylinder("Pen_WattlePost", (x, y, 0.31), 0.028, 0.62, hazel, vertices=7, bevel_width=0.005))
    for index, z in enumerate((0.16, 0.27, 0.38, 0.49)):
        wattle_parts.append(add_cylinder("Pen_FrontWeave", (0.25 + (index % 2) * 0.02, 0.43, z), 0.017, 0.5, hazel, rotation=(0, math.pi / 2, 0), vertices=7, bevel_width=0.004))
        wattle_parts.append(add_cylinder("Pen_RightWeave", (0.48, -0.03 + (index % 2) * 0.02, z), 0.017, 0.82, hazel, rotation=(math.pi / 2, 0, 0), vertices=7, bevel_width=0.004))

    mud_parts.extend(
        [
            add_ico_sphere("Pen_MudBase", (0.16, 0.11, 0.035), (0.3, 0.26, 0.05), mud, subdivisions=2),
            add_ico_sphere("Pen_MudPatch", (0.21, 0.1, 0.06), (0.21, 0.17, 0.035), mud, subdivisions=1),
        ]
    )
    trough_parts.extend(
        [
            add_cube("Pen_Trough", (-0.27, 0.29, 0.16), (0.38, 0.2, 0.18), enamel, bevel_width=0.045),
        ]
    )
    mud_parts.append(add_cube("Pen_TroughInset", (-0.27, 0.29, 0.255), (0.29, 0.12, 0.035), mud, bevel_width=0.025))
    wood_parts.extend(
        [
            add_cylinder("Pen_RubPost", (0.23, -0.25, 0.28), 0.05, 0.56, oak, vertices=8),
            add_ico_sphere("Pen_RubCap", (0.23, -0.25, 0.575), (0.085, 0.085, 0.07), oak, subdivisions=1),
        ]
    )
    for index in range(9):
        straw_parts.append(add_cylinder("Pen_Straw", (-0.37 + index * 0.06, -0.23 + (index % 3) * 0.055, 0.18), 0.013, 0.36, straw, rotation=(math.radians(80), math.radians(index * 17), 0), vertices=6, bevel_width=0.003))

    roles = [
        join_objects(wood_parts, "PigletPen_Wood"),
        join_objects(wattle_parts, "PigletPen_Wattle"),
        join_objects(wall_parts, "PigletPen_Limewash"),
        join_objects(roof_parts, "PigletPen_Roof"),
        join_objects(stone_parts, "PigletPen_Stone"),
        join_objects(mud_parts, "PigletPen_Mud"),
        join_objects(straw_parts, "PigletPen_Straw"),
        join_objects(trough_parts, "PigletPen_Trough"),
    ]
    save_asset("PigletPen.blend", [obj.name for obj in roles], output_dir)


GENERATORS: dict[str, Callable[[Path], None]] = {
    "Chicken": create_chicken,
    "Piglet": create_piglet,
    "Goat": create_goat,
    "ChickenCoop": create_chicken_coop,
    "PigletPen": create_piglet_pen,
}


def main() -> None:
    args = parse_args()
    requested = args.assets or list(GENERATORS)
    unknown = sorted(set(requested) - set(GENERATORS))
    if unknown:
        raise ValueError(f"Unknown assets: {', '.join(unknown)}")
    for asset_name in requested:
        GENERATORS[asset_name](args.output_dir)


if __name__ == "__main__":
    main()
