#!/usr/bin/env python3
"""Generate the original Gredice Slug source asset.

Run with Blender, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python assets/scripts/generate-slug.py \
      -- --output assets/game-assets/Slug.blend
"""

from __future__ import annotations

import argparse
import math
import sys
from collections.abc import Iterable
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


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
    roughness: float = 0.82,
) -> bpy.types.Material:
    linear_color = linear_rgba(color)
    value = bpy.data.materials.new(name)
    value.diffuse_color = linear_color
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    if shader:
        shader.inputs["Base Color"].default_value = linear_color
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = 0
    return value


def activate(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_scale(obj: bpy.types.Object) -> None:
    activate(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def assign_material(obj: bpy.types.Object, value: bpy.types.Material) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(value)


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
    apply_scale(obj)
    assign_material(obj, value)
    return obj


def add_cylinder_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    value: bpy.types.Material,
    *,
    vertices: int = 8,
) -> bpy.types.Object:
    start_point = Vector(start)
    end_point = Vector(end)
    direction = end_point - start_point
    midpoint = (start_point + end_point) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=direction.length,
        location=midpoint,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    obj.rotation_mode = "XYZ"
    apply_scale(obj)
    assign_material(obj, value)
    return obj


def empty(name: str, location: tuple[float, float, float]) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.1
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
    output_path: Path, expected_names: Iterable[str]
) -> None:
    actual_names = {obj.name for obj in bpy.context.scene.objects}
    expected = set(expected_names)
    missing = sorted(expected - actual_names)
    unexpected = sorted(actual_names - expected)
    if missing or unexpected:
        raise RuntimeError(
            f"Unexpected Slug objects; missing={missing}, unexpected={unexpected}"
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path), compress=True)
    print(f"Saved {output_path}")


def create_slug(output_path: Path) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene.world = bpy.data.worlds.new("Gredice World")
    scene.world.color = (0.055, 0.07, 0.06)
    scene["generated_by"] = "assets/scripts/generate-slug.py"
    scene["asset_name"] = "Slug"
    scene["design_note"] = (
        "Original Gredice low-poly slug; runtime pivots support body wave, "
        "foot glide, head seeking, and independent feeler motion."
    )

    body = material("Material.Slug.Body", (0.57, 0.37, 0.18, 1))
    body_light = material(
        "Material.Slug.BodyLight", (0.76, 0.55, 0.29, 1), roughness=0.76
    )
    mantle = material(
        "Material.Slug.Mantle", (0.34, 0.42, 0.18, 1), roughness=0.8
    )
    mantle_spot = material(
        "Material.Slug.MantleSpot", (0.78, 0.65, 0.25, 1), roughness=0.72
    )
    foot = material(
        "Material.Slug.Foot", (0.82, 0.69, 0.44, 1), roughness=0.68
    )
    eye = material("Material.Slug.Eye", (0.035, 0.03, 0.025, 1), roughness=0.58)
    eye_glint = material(
        "Material.Slug.EyeGlint", (0.98, 0.91, 0.66, 1), roughness=0.4
    )

    root = empty("Slug_Root", (0, 0, 0))
    foot_pivot = empty("Slug_FootPivot", (0, -0.05, 0.09))
    rear_pivot = empty("Slug_RearPivot", (0, -0.39, 0.18))
    middle_pivot = empty("Slug_MiddlePivot", (0, -0.04, 0.22))
    mantle_pivot = empty("Slug_MantlePivot", (0, 0.26, 0.3))
    head_pivot = empty("Slug_HeadPivot", (0, 0.58, 0.25))
    upper_left_pivot = empty("Slug_UpperFeelerPivot_L", (-0.13, 0.72, 0.36))
    upper_right_pivot = empty("Slug_UpperFeelerPivot_R", (0.13, 0.72, 0.36))
    lower_left_pivot = empty("Slug_LowerFeelerPivot_L", (-0.1, 0.73, 0.25))
    lower_right_pivot = empty("Slug_LowerFeelerPivot_R", (0.1, 0.73, 0.25))

    for pivot in (
        foot_pivot,
        rear_pivot,
        middle_pivot,
        mantle_pivot,
        head_pivot,
    ):
        parent_keep_transform(pivot, root)
    for pivot in (
        upper_left_pivot,
        upper_right_pivot,
        lower_left_pivot,
        lower_right_pivot,
    ):
        parent_keep_transform(pivot, head_pivot)

    foot_mesh = add_ico_sphere(
        "Slug_Foot", (0, -0.04, 0.085), (0.24, 0.79, 0.075), foot
    )
    rear_mesh = add_ico_sphere(
        "Slug_RearBody", (0, -0.4, 0.19), (0.27, 0.43, 0.18), body
    )
    middle_mesh = add_ico_sphere(
        "Slug_MiddleBody", (0, -0.05, 0.22), (0.31, 0.43, 0.22), body_light
    )
    mantle_mesh = add_ico_sphere(
        "Slug_Mantle", (0, 0.26, 0.31), (0.33, 0.38, 0.27), mantle
    )
    mantle_spot_left = add_ico_sphere(
        "Slug_MantleSpot_L", (-0.22, 0.3, 0.4), (0.055, 0.12, 0.075), mantle_spot, subdivisions=1
    )
    mantle_spot_right = add_ico_sphere(
        "Slug_MantleSpot_R", (0.22, 0.3, 0.4), (0.055, 0.12, 0.075), mantle_spot, subdivisions=1
    )
    head_mesh = add_ico_sphere(
        "Slug_Head", (0, 0.59, 0.25), (0.25, 0.27, 0.22), body_light
    )
    mouth = add_ico_sphere(
        "Slug_Mouth", (0, 0.83, 0.205), (0.055, 0.022, 0.018), eye, subdivisions=1
    )

    upper_feelers: list[bpy.types.Object] = []
    upper_tips: list[bpy.types.Object] = []
    eyes: list[bpy.types.Object] = []
    glints: list[bpy.types.Object] = []
    for side, x_sign, pivot in (
        ("L", -1, upper_left_pivot),
        ("R", 1, upper_right_pivot),
    ):
        start = (0.13 * x_sign, 0.72, 0.36)
        end = (0.2 * x_sign, 0.99, 0.54)
        feeler = add_cylinder_between(
            f"Slug_UpperFeeler_{side}", start, end, 0.026, body_light
        )
        tip = add_ico_sphere(
            f"Slug_UpperFeelerTip_{side}", end, (0.065, 0.065, 0.065), body_light, subdivisions=1
        )
        eye_mesh = add_ico_sphere(
            f"Slug_Eye_{side}",
            (end[0], end[1] + 0.05, end[2] + 0.012),
            (0.04, 0.035, 0.04),
            eye,
            subdivisions=2,
        )
        glint = add_ico_sphere(
            f"Slug_EyeGlint_{side}",
            (end[0] - 0.008 * x_sign, end[1] + 0.078, end[2] + 0.03),
            (0.011, 0.009, 0.011),
            eye_glint,
            subdivisions=1,
        )
        for obj in (feeler, tip, eye_mesh, glint):
            parent_keep_transform(obj, pivot)
        upper_feelers.append(feeler)
        upper_tips.append(tip)
        eyes.append(eye_mesh)
        glints.append(glint)

    lower_feelers: list[bpy.types.Object] = []
    lower_tips: list[bpy.types.Object] = []
    for side, x_sign, pivot in (
        ("L", -1, lower_left_pivot),
        ("R", 1, lower_right_pivot),
    ):
        start = (0.1 * x_sign, 0.73, 0.25)
        end = (0.17 * x_sign, 0.91, 0.27)
        feeler = add_cylinder_between(
            f"Slug_LowerFeeler_{side}", start, end, 0.019, body_light, vertices=7
        )
        tip = add_ico_sphere(
            f"Slug_LowerFeelerTip_{side}", end, (0.038, 0.038, 0.038), body_light, subdivisions=1
        )
        parent_keep_transform(feeler, pivot)
        parent_keep_transform(tip, pivot)
        lower_feelers.append(feeler)
        lower_tips.append(tip)

    parent_keep_transform(foot_mesh, foot_pivot)
    parent_keep_transform(rear_mesh, rear_pivot)
    parent_keep_transform(middle_mesh, middle_pivot)
    for obj in (mantle_mesh, mantle_spot_left, mantle_spot_right):
        parent_keep_transform(obj, mantle_pivot)
    for obj in (head_mesh, mouth):
        parent_keep_transform(obj, head_pivot)

    # Blender +Y exports as runtime -Z. Rotate the complete rig so runtime +Z
    # is the forward direction used by every autonomous Gredice animal.
    root.rotation_euler.z = math.pi

    expected_names = [
        "Slug_Root",
        "Slug_FootPivot",
        "Slug_RearPivot",
        "Slug_MiddlePivot",
        "Slug_MantlePivot",
        "Slug_HeadPivot",
        "Slug_UpperFeelerPivot_L",
        "Slug_UpperFeelerPivot_R",
        "Slug_LowerFeelerPivot_L",
        "Slug_LowerFeelerPivot_R",
        "Slug_Foot",
        "Slug_RearBody",
        "Slug_MiddleBody",
        "Slug_Mantle",
        "Slug_MantleSpot_L",
        "Slug_MantleSpot_R",
        "Slug_Head",
        "Slug_Mouth",
        "Slug_UpperFeeler_L",
        "Slug_UpperFeeler_R",
        "Slug_UpperFeelerTip_L",
        "Slug_UpperFeelerTip_R",
        "Slug_Eye_L",
        "Slug_Eye_R",
        "Slug_EyeGlint_L",
        "Slug_EyeGlint_R",
        "Slug_LowerFeeler_L",
        "Slug_LowerFeeler_R",
        "Slug_LowerFeelerTip_L",
        "Slug_LowerFeelerTip_R",
    ]
    save_asset(output_path, expected_names)


if __name__ == "__main__":
    create_slug(parse_args().output)
