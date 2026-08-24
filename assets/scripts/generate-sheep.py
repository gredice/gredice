#!/usr/bin/env python3
"""Generate the original low-poly Gredice sheep source asset.

Run with Blender, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python assets/scripts/generate-sheep.py \
      -- --output-dir assets/game-assets
"""

from __future__ import annotations

import argparse
import math
import sys
from collections.abc import Iterable
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
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
    roughness: float = 0.88,
) -> bpy.types.Material:
    red, green, blue, alpha = color
    linear_color = (
        srgb_channel_to_linear(red),
        srgb_channel_to_linear(green),
        srgb_channel_to_linear(blue),
        alpha,
    )
    value = bpy.data.materials.new(name)
    value.diffuse_color = linear_color
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    if shader:
        shader.inputs["Base Color"].default_value = linear_color
        shader.inputs["Roughness"].default_value = roughness
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
    rotation: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=subdivisions,
        radius=1,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_scale(obj)
    assign_material(obj, value)
    return obj


def add_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    value: bpy.types.Material,
    *,
    vertices: int = 8,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
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
    bpy.context.view_layer.update()
    world_matrix = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world_matrix
    bpy.context.view_layer.update()


def create_sheep(output_dir: Path) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene.world = bpy.data.worlds.new("Gredice World")
    scene.world.color = (0.055, 0.07, 0.06)
    scene["generated_by"] = "assets/scripts/generate-sheep.py"
    scene["asset_name"] = "Sheep"
    scene["design_note"] = (
        "Original Gredice low-poly sheep with pramenka-inspired dark face markings"
    )

    wool = material("Material.Sheep.Wool", (0.91, 0.84, 0.68, 1))
    wool_light = material(
        "Material.Sheep.WoolLight", (1.0, 0.94, 0.78, 1)
    )
    wool_shadow = material(
        "Material.Sheep.WoolShadow", (0.66, 0.56, 0.4, 1)
    )
    face = material("Material.Sheep.Face", (0.2, 0.17, 0.14, 1))
    muzzle = material("Material.Sheep.Muzzle", (0.36, 0.3, 0.24, 1))
    hoof = material("Material.Sheep.Hoof", (0.11, 0.095, 0.08, 1))
    inner_ear = material(
        "Material.Sheep.InnerEar", (0.63, 0.4, 0.34, 1)
    )
    eye = material(
        "Material.Sheep.Eye", (0.022, 0.02, 0.018, 1), roughness=0.62
    )
    eye_glint = material(
        "Material.Sheep.EyeGlint", (1.0, 0.93, 0.76, 1), roughness=0.42
    )

    root = empty("Sheep_Root", (0, 0, 0))
    body_pivot = empty("Sheep_BodyPivot", (0, -0.04, 0.79))
    head_pivot = empty("Sheep_HeadPivot", (0, 0.67, 0.86))
    jaw_pivot = empty("Sheep_JawPivot", (0, 0.91, 0.72))
    ear_left_pivot = empty("Sheep_EarPivot_L", (-0.23, 0.68, 1.03))
    ear_right_pivot = empty("Sheep_EarPivot_R", (0.23, 0.68, 1.03))
    tail_pivot = empty("Sheep_TailPivot", (0, -0.72, 0.86))
    leg_pivots = {
        "FL": empty("Sheep_LegPivot_FL", (-0.28, 0.36, 0.44)),
        "FR": empty("Sheep_LegPivot_FR", (0.28, 0.36, 0.44)),
        "RL": empty("Sheep_LegPivot_RL", (-0.28, -0.43, 0.44)),
        "RR": empty("Sheep_LegPivot_RR", (0.28, -0.43, 0.44)),
    }

    parent_keep_transform(body_pivot, root)
    parent_keep_transform(head_pivot, body_pivot)
    parent_keep_transform(jaw_pivot, head_pivot)
    parent_keep_transform(ear_left_pivot, head_pivot)
    parent_keep_transform(ear_right_pivot, head_pivot)
    parent_keep_transform(tail_pivot, body_pivot)
    for pivot in leg_pivots.values():
        parent_keep_transform(pivot, body_pivot)

    wool_tuft_specs = [
        ((0, -0.05, 0.79), (0.5, 0.74, 0.5)),
        ((-0.34, -0.2, 0.82), (0.3, 0.43, 0.38)),
        ((0.34, -0.2, 0.82), (0.3, 0.43, 0.38)),
        ((-0.31, 0.28, 0.84), (0.3, 0.39, 0.38)),
        ((0.31, 0.28, 0.84), (0.3, 0.39, 0.38)),
        ((0, -0.48, 0.86), (0.42, 0.35, 0.42)),
        ((0, 0.42, 0.88), (0.42, 0.34, 0.42)),
        ((0, -0.02, 1.13), (0.41, 0.52, 0.25)),
    ]
    wool_body = join_objects(
        [
            add_ico_sphere(
                f"Sheep_WoolTuft_{index}",
                location,
                scale,
                wool if index % 3 else wool_light,
                subdivisions=2,
            )
            for index, (location, scale) in enumerate(wool_tuft_specs)
        ],
        "Sheep_WoolBody",
    )
    wool_chest = join_objects(
        [
            add_ico_sphere(
                f"Sheep_ChestTuft_{index}",
                (x, y, z),
                (0.24, 0.27, 0.29),
                wool_shadow if index == 0 else wool_light,
                subdivisions=2,
            )
            for index, (x, y, z) in enumerate(
                ((0, 0.48, 0.66), (-0.18, 0.54, 0.82), (0.18, 0.54, 0.82))
            )
        ],
        "Sheep_WoolChest",
    )

    head = add_ico_sphere(
        "Sheep_Head",
        (0, 0.71, 0.92),
        (0.27, 0.38, 0.34),
        face,
        subdivisions=2,
        rotation=(math.radians(-10), 0, 0),
    )
    wool_cap = add_ico_sphere(
        "Sheep_WoolCap",
        (0, 0.59, 1.12),
        (0.3, 0.24, 0.2),
        wool_light,
        subdivisions=2,
    )
    muzzle_mesh = add_ico_sphere(
        "Sheep_Muzzle",
        (0, 1.0, 0.75),
        (0.21, 0.2, 0.19),
        muzzle,
        subdivisions=2,
    )
    nose = add_ico_sphere(
        "Sheep_Nose",
        (0, 1.17, 0.76),
        (0.12, 0.055, 0.075),
        hoof,
        subdivisions=1,
    )
    jaw = add_ico_sphere(
        "Sheep_Jaw",
        (0, 0.99, 0.65),
        (0.17, 0.18, 0.1),
        muzzle,
        subdivisions=1,
    )

    eye_left = add_ico_sphere(
        "Sheep_Eye_L",
        (-0.205, 0.925, 0.95),
        (0.055, 0.035, 0.06),
        eye,
        subdivisions=2,
    )
    eye_right = add_ico_sphere(
        "Sheep_Eye_R",
        (0.205, 0.925, 0.95),
        (0.055, 0.035, 0.06),
        eye,
        subdivisions=2,
    )
    glint_left = add_ico_sphere(
        "Sheep_EyeGlint_L",
        (-0.221, 0.954, 0.973),
        (0.015, 0.011, 0.015),
        eye_glint,
        subdivisions=1,
    )
    glint_right = add_ico_sphere(
        "Sheep_EyeGlint_R",
        (0.221, 0.954, 0.973),
        (0.015, 0.011, 0.015),
        eye_glint,
        subdivisions=1,
    )

    ears: list[bpy.types.Object] = []
    inner_ears: list[bpy.types.Object] = []
    for side, x, z_rotation, pivot in (
        ("L", -0.29, math.radians(22), ear_left_pivot),
        ("R", 0.29, math.radians(-22), ear_right_pivot),
    ):
        ear = add_ico_sphere(
            f"Sheep_Ear_{side}",
            (x, 0.7, 1.04),
            (0.16, 0.24, 0.075),
            face,
            subdivisions=1,
            rotation=(0, math.radians(8), z_rotation),
        )
        inner = add_ico_sphere(
            f"Sheep_InnerEar_{side}",
            (x * 1.02, 0.727, 1.055),
            (0.09, 0.16, 0.025),
            inner_ear,
            subdivisions=1,
            rotation=(0, math.radians(8), z_rotation),
        )
        parent_keep_transform(ear, pivot)
        parent_keep_transform(inner, pivot)
        ears.append(ear)
        inner_ears.append(inner)

    legs: list[bpy.types.Object] = []
    hooves: list[bpy.types.Object] = []
    for key, pivot in leg_pivots.items():
        x = -0.28 if key.endswith("L") else 0.28
        y = 0.36 if key.startswith("F") else -0.43
        leg = add_cylinder(
            f"Sheep_Leg_{key}", (x, y, 0.27), 0.072, 0.48, face
        )
        hoof_mesh = add_ico_sphere(
            f"Sheep_Hoof_{key}",
            (x, y + 0.035, 0.055),
            (0.09, 0.14, 0.075),
            hoof,
            subdivisions=1,
        )
        parent_keep_transform(leg, pivot)
        parent_keep_transform(hoof_mesh, pivot)
        legs.append(leg)
        hooves.append(hoof_mesh)

    tail = join_objects(
        [
            add_ico_sphere(
                "Sheep_TailTuft_A",
                (0, -0.74, 0.91),
                (0.2, 0.22, 0.2),
                wool_light,
                subdivisions=2,
            ),
            add_ico_sphere(
                "Sheep_TailTuft_B",
                (0, -0.84, 0.84),
                (0.14, 0.19, 0.14),
                wool,
                subdivisions=2,
            ),
        ],
        "Sheep_Tail",
    )

    for obj in (wool_body, wool_chest):
        parent_keep_transform(obj, body_pivot)
    for obj in (
        head,
        wool_cap,
        muzzle_mesh,
        nose,
        eye_left,
        eye_right,
        glint_left,
        glint_right,
    ):
        parent_keep_transform(obj, head_pivot)
    parent_keep_transform(jaw, jaw_pivot)
    parent_keep_transform(tail, tail_pivot)

    # Blender +Y exports as runtime -Z. The shared animal convention uses
    # runtime +Z as forward, so turn the complete original rig once at root.
    root.rotation_euler.z = math.pi

    expected_names = {
        "Sheep_Root",
        "Sheep_BodyPivot",
        "Sheep_HeadPivot",
        "Sheep_JawPivot",
        "Sheep_EarPivot_L",
        "Sheep_EarPivot_R",
        "Sheep_TailPivot",
        "Sheep_LegPivot_FL",
        "Sheep_LegPivot_FR",
        "Sheep_LegPivot_RL",
        "Sheep_LegPivot_RR",
        "Sheep_WoolBody",
        "Sheep_WoolChest",
        "Sheep_Head",
        "Sheep_WoolCap",
        "Sheep_Muzzle",
        "Sheep_Nose",
        "Sheep_Jaw",
        "Sheep_Eye_L",
        "Sheep_Eye_R",
        "Sheep_EyeGlint_L",
        "Sheep_EyeGlint_R",
        "Sheep_Ear_L",
        "Sheep_Ear_R",
        "Sheep_InnerEar_L",
        "Sheep_InnerEar_R",
        "Sheep_Leg_FL",
        "Sheep_Leg_FR",
        "Sheep_Leg_RL",
        "Sheep_Leg_RR",
        "Sheep_Hoof_FL",
        "Sheep_Hoof_FR",
        "Sheep_Hoof_RL",
        "Sheep_Hoof_RR",
        "Sheep_Tail",
    }
    actual_names = {obj.name for obj in bpy.context.scene.objects}
    if actual_names != expected_names:
        raise RuntimeError(
            "Unexpected Sheep objects; "
            f"missing={sorted(expected_names - actual_names)}, "
            f"unexpected={sorted(actual_names - expected_names)}"
        )

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "Sheep.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path), compress=True)
    print(f"Saved {output_path}")


if __name__ == "__main__":
    create_sheep(parse_args().output_dir)
