#!/usr/bin/env python3
"""Generate the original Gredice farm animals and their home blocks.

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
    # Newly positioned empties need a dependency-graph update before reading
    # matrix_world, otherwise Blender can collapse authored rig pivots to zero.
    bpy.context.view_layer.update()
    world_matrix = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world_matrix
    bpy.context.view_layer.update()


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


def create_cow(output_dir: Path) -> None:
    """Create a broad, readable dairy cow for the normal isometric camera.

    The shared cream body plus one visible patch role yields exactly two runtime
    coats. Separate stable pivots support procedural breathing, grazing, cud
    chewing, ear/head motion, tail swatting, walking, and trotting.
    """
    reset_scene("Cow")
    cream = material("Material.Cow.Cream", (0.91, 0.86, 0.72, 1))
    cream_light = material("Material.Cow.CreamLight", (0.98, 0.95, 0.84, 1))
    brown = material("Material.Cow.Brown", (0.36, 0.14, 0.055, 1))
    black = material("Material.Cow.Black", (0.035, 0.04, 0.038, 1), roughness=0.76)
    muzzle = material("Material.Cow.Muzzle", (0.77, 0.47, 0.42, 1))
    inner_ear = material("Material.Cow.InnerEar", (0.69, 0.35, 0.34, 1))
    horn = material("Material.Cow.Horn", (0.76, 0.65, 0.45, 1))
    hoof = material("Material.Cow.Hoof", (0.12, 0.09, 0.07, 1))
    eye = material("Material.Cow.Eye", (0.018, 0.02, 0.018, 1), roughness=0.64)
    eye_glint = material("Material.Cow.EyeGlint", (1.0, 0.95, 0.78, 1), roughness=0.4)
    udder = material("Material.Cow.Udder", (0.82, 0.51, 0.48, 1))

    root = empty("Cow_Root", (0, 0, 0))
    body_pivot = empty("Cow_BodyPivot", (0, -0.06, 1.02))
    neck_pivot = empty("Cow_NeckPivot", (0, 0.68, 1.18))
    head_pivot = empty("Cow_HeadPivot", (0, 0.97, 1.28))
    jaw_pivot = empty("Cow_JawPivot", (0, 1.24, 1.16))
    ear_left_pivot = empty("Cow_EarPivot_L", (-0.37, 0.98, 1.43))
    ear_right_pivot = empty("Cow_EarPivot_R", (0.37, 0.98, 1.43))
    tail_base_pivot = empty("Cow_TailPivot_Base", (0, -1.03, 1.18))
    tail_tip_pivot = empty("Cow_TailPivot_Tip", (0, -1.04, 0.60))
    leg_pivots = {
        "FL": empty("Cow_LegPivot_FL", (-0.43, 0.6, 0.65)),
        "FR": empty("Cow_LegPivot_FR", (0.43, 0.6, 0.65)),
        "RL": empty("Cow_LegPivot_RL", (-0.43, -0.65, 0.65)),
        "RR": empty("Cow_LegPivot_RR", (0.43, -0.65, 0.65)),
    }

    parent_keep_transform(body_pivot, root)
    parent_keep_transform(neck_pivot, body_pivot)
    parent_keep_transform(head_pivot, neck_pivot)
    parent_keep_transform(jaw_pivot, head_pivot)
    parent_keep_transform(ear_left_pivot, head_pivot)
    parent_keep_transform(ear_right_pivot, head_pivot)
    parent_keep_transform(tail_base_pivot, body_pivot)
    parent_keep_transform(tail_tip_pivot, tail_base_pivot)
    for pivot in leg_pivots.values():
        parent_keep_transform(pivot, root)

    body = add_ico_sphere(
        "Cow_Body", (0, -0.13, 1.02), (0.68, 1.08, 0.63), cream_light
    )
    shoulders = add_ico_sphere(
        "Cow_Shoulders", (0, 0.48, 1.08), (0.7, 0.62, 0.66), cream
    )
    chest = add_ico_sphere(
        "Cow_Chest", (0, 0.67, 0.86), (0.57, 0.44, 0.52), cream_light
    )
    neck = add_ico_sphere(
        "Cow_Neck", (0, 0.76, 1.18), (0.48, 0.5, 0.54), cream
    )
    head = add_ico_sphere(
        "Cow_Head", (0, 1.05, 1.32), (0.43, 0.48, 0.42), cream_light
    )
    forehead = add_ico_sphere(
        "Cow_Forehead", (0, 1.27, 1.43), (0.32, 0.29, 0.28), cream
    )
    muzzle_mesh = add_ico_sphere(
        "Cow_Muzzle", (0, 1.48, 1.16), (0.37, 0.28, 0.24), muzzle
    )
    nostrils = join_objects(
        [
            add_ico_sphere(
                "Cow_NostrilPart_L", (-0.13, 1.715, 1.18), (0.045, 0.025, 0.035), hoof, subdivisions=1
            ),
            add_ico_sphere(
                "Cow_NostrilPart_R", (0.13, 1.715, 1.18), (0.045, 0.025, 0.035), hoof, subdivisions=1
            ),
        ],
        "Cow_Nostrils",
    )

    eyes = []
    glints = []
    for side, x in (("L", -0.31), ("R", 0.31)):
        eyes.append(
            add_ico_sphere(
                f"Cow_Eye_{side}", (x, 1.39, 1.43), (0.064, 0.038, 0.07), eye
            )
        )
        glints.append(
            add_ico_sphere(
                f"Cow_EyeGlint_{side}",
                (x + (-0.018 if side == "L" else 0.018), 1.423, 1.456),
                (0.017, 0.012, 0.017),
                eye_glint,
                subdivisions=1,
            )
        )

    ears = []
    inner_ears = []
    for side, x, sign in (("L", -0.48, -1), ("R", 0.48, 1)):
        ears.append(
            add_ico_sphere(
                f"Cow_Ear_{side}", (x, 1.02, 1.47), (0.23, 0.12, 0.105), cream
            )
        )
        inner_ears.append(
            add_ico_sphere(
                f"Cow_InnerEar_{side}",
                (x + sign * 0.015, 1.10, 1.475),
                (0.15, 0.035, 0.055),
                inner_ear,
                subdivisions=1,
            )
        )

    horns = []
    for side, x, tilt in (("L", -0.25, -0.22), ("R", 0.25, 0.22)):
        horns.append(
            add_cone(
                f"Cow_Horn_{side}",
                (x, 1.02, 1.72),
                0.085,
                0.02,
                0.34,
                horn,
                rotation=(0, tilt, 0),
                vertices=7,
            )
        )

    legs = []
    hooves = []
    for key, pivot in leg_pivots.items():
        x = -0.43 if key.endswith("L") else 0.43
        y = 0.6 if key.startswith("F") else -0.65
        upper = add_cylinder(
            f"Cow_Leg_{key}", (x, y, 0.48), 0.13, 0.72, cream, vertices=8
        )
        foot = add_ico_sphere(
            f"Cow_Hoof_{key}", (x, y + 0.025, 0.105), (0.14, 0.18, 0.105), hoof, subdivisions=1
        )
        parent_keep_transform(upper, pivot)
        parent_keep_transform(foot, pivot)
        legs.append(upper)
        hooves.append(foot)

    udder_mesh = add_ico_sphere(
        "Cow_Udder", (0, -0.34, 0.47), (0.31, 0.37, 0.24), udder
    )
    teats = join_objects(
        [
            add_cylinder(
                f"Cow_Teat_{index}",
                (x, y, 0.28),
                0.035,
                0.2,
                udder,
                vertices=7,
                bevel_width=0.005,
            )
            for index, (x, y) in enumerate(
                ((-0.13, -0.17), (0.13, -0.17), (-0.13, -0.5), (0.13, -0.5))
            )
        ],
        "Cow_Teats",
    )

    tail = add_cylinder(
        "Cow_Tail", (0, -1.15, 0.89), 0.045, 0.62, cream, rotation=(0.35, 0, 0), vertices=8
    )
    tail_tuft = add_ico_sphere(
        "Cow_TailTuft", (0, -1.02, 0.48), (0.13, 0.12, 0.17), brown, subdivisions=1
    )

    patch_transforms = [
        ((-0.61, -0.25, 1.14), (0.075, 0.46, 0.35)),
        ((0.61, 0.34, 1.03), (0.075, 0.34, 0.3)),
        ((-0.52, 0.55, 1.34), (0.08, 0.27, 0.23)),
        ((0.5, -0.62, 0.97), (0.08, 0.3, 0.28)),
        ((0, -0.92, 1.22), (0.32, 0.09, 0.24)),
        ((0, 1.33, 1.48), (0.2, 0.08, 0.16)),
    ]
    brown_patches = join_objects(
        [
            add_ico_sphere(
                f"Cow_BrownPatchPart_{index}", location, scale, brown, subdivisions=1
            )
            for index, (location, scale) in enumerate(patch_transforms)
        ],
        "Cow_Coat_BrownPatches",
    )
    black_patches = join_objects(
        [
            add_ico_sphere(
                f"Cow_BlackPatchPart_{index}", location, scale, black, subdivisions=1
            )
            for index, (location, scale) in enumerate(patch_transforms)
        ],
        "Cow_Coat_BlackPatches",
    )

    for obj in (body, shoulders, chest, brown_patches, black_patches, udder_mesh, teats):
        parent_keep_transform(obj, body_pivot)
    parent_keep_transform(neck, neck_pivot)
    for obj in (head, forehead, *eyes, *glints, *horns):
        parent_keep_transform(obj, head_pivot)
    for obj in (muzzle_mesh, nostrils):
        parent_keep_transform(obj, jaw_pivot)
    for obj in (ears[0], inner_ears[0]):
        parent_keep_transform(obj, ear_left_pivot)
    for obj in (ears[1], inner_ears[1]):
        parent_keep_transform(obj, ear_right_pivot)
    parent_keep_transform(tail, tail_base_pivot)
    parent_keep_transform(tail_tuft, tail_tip_pivot)

    root.rotation_euler.z = math.pi

    expected_names = [
        "Cow_Root",
        "Cow_BodyPivot",
        "Cow_NeckPivot",
        "Cow_HeadPivot",
        "Cow_JawPivot",
        "Cow_EarPivot_L",
        "Cow_EarPivot_R",
        "Cow_TailPivot_Base",
        "Cow_TailPivot_Tip",
        "Cow_LegPivot_FL",
        "Cow_LegPivot_FR",
        "Cow_LegPivot_RL",
        "Cow_LegPivot_RR",
        "Cow_Body",
        "Cow_Shoulders",
        "Cow_Chest",
        "Cow_Neck",
        "Cow_Head",
        "Cow_Forehead",
        "Cow_Muzzle",
        "Cow_Nostrils",
        "Cow_Eye_L",
        "Cow_Eye_R",
        "Cow_EyeGlint_L",
        "Cow_EyeGlint_R",
        "Cow_Ear_L",
        "Cow_Ear_R",
        "Cow_InnerEar_L",
        "Cow_InnerEar_R",
        "Cow_Horn_L",
        "Cow_Horn_R",
        "Cow_Leg_FL",
        "Cow_Leg_FR",
        "Cow_Leg_RL",
        "Cow_Leg_RR",
        "Cow_Hoof_FL",
        "Cow_Hoof_FR",
        "Cow_Hoof_RL",
        "Cow_Hoof_RR",
        "Cow_Udder",
        "Cow_Teats",
        "Cow_Tail",
        "Cow_TailTuft",
        "Cow_Coat_BrownPatches",
        "Cow_Coat_BlackPatches",
    ]
    save_asset("Cow.blend", expected_names, output_dir)


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
    "Cow": create_cow,
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
