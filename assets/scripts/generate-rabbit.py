#!/usr/bin/env python3
"""Generate the original low-poly Gredice Rabbit source asset.

Run with Blender, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python assets/scripts/generate-rabbit.py \
      -- --output assets/game-assets/Rabbit.blend

The neutral source palette represents the chestnut-agouti family. Runtime
materials map the same named material roles to the persisted cream family.
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


def create_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    roughness: float = 0.88,
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
    rotation: tuple[float, float, float] = (0, 0, 0),
    subdivisions: int = 2,
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
    rotation: tuple[float, float, float] = (0, 0, 0),
    vertices: int = 7,
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


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene.world = bpy.data.worlds.new("Gredice World")
    scene.world.color = (0.055, 0.07, 0.06)
    scene["generated_by"] = "assets/scripts/generate-rabbit.py"
    scene["asset_name"] = "Rabbit"
    scene["design_references"] = (
        "https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/"
        "rabbits/rabbit-body-language;"
        "https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/behaviour/"
        "understanding;https://rabbitwelfare.co.uk/welfare-need/foraging/"
    )
    scene["design_notes"] = (
        "Original Gredice silhouette using broad rabbit anatomy traits: strong "
        "haunches, compact chest, long independently animated ears, low alert "
        "posture, twitching nose, and short grazing pose."
    )


def create_rabbit(output: Path) -> None:
    reset_scene()
    primary = create_material(
        "Material.Rabbit.FurPrimary", (0.53, 0.32, 0.17, 1)
    )
    secondary = create_material(
        "Material.Rabbit.FurSecondary", (0.79, 0.65, 0.47, 1)
    )
    inner_ear = create_material(
        "Material.Rabbit.InnerEar", (0.74, 0.39, 0.4, 1)
    )
    charcoal = create_material(
        "Material.Rabbit.Charcoal", (0.025, 0.023, 0.021, 1), roughness=0.62
    )
    eye_glint = create_material(
        "Material.Rabbit.EyeGlint", (0.98, 0.94, 0.81, 1), roughness=0.4
    )

    root = empty("Rabbit_Root", (0, 0, 0))
    body_pivot = empty("Rabbit_BodyPivot", (0, -0.07, 0.39))
    head_pivot = empty("Rabbit_HeadPivot", (0, 0.39, 0.53))
    nose_pivot = empty("Rabbit_NosePivot", (0, 0.69, 0.52))
    ear_left_pivot = empty("Rabbit_EarPivot_L", (-0.13, 0.39, 0.73))
    ear_right_pivot = empty("Rabbit_EarPivot_R", (0.13, 0.39, 0.73))
    front_left_pivot = empty("Rabbit_LegPivot_FL", (-0.16, 0.29, 0.21))
    front_right_pivot = empty("Rabbit_LegPivot_FR", (0.16, 0.29, 0.21))
    hind_left_pivot = empty("Rabbit_LegPivot_HL", (-0.23, -0.28, 0.24))
    hind_right_pivot = empty("Rabbit_LegPivot_HR", (0.23, -0.28, 0.24))
    tail_pivot = empty("Rabbit_TailPivot", (0, -0.55, 0.42))

    parent_keep_transform(body_pivot, root)
    parent_keep_transform(head_pivot, body_pivot)
    parent_keep_transform(nose_pivot, head_pivot)
    parent_keep_transform(ear_left_pivot, head_pivot)
    parent_keep_transform(ear_right_pivot, head_pivot)
    parent_keep_transform(front_left_pivot, root)
    parent_keep_transform(front_right_pivot, root)
    parent_keep_transform(hind_left_pivot, root)
    parent_keep_transform(hind_right_pivot, root)
    parent_keep_transform(tail_pivot, body_pivot)

    body = add_ico_sphere(
        "Rabbit_Body", (0, -0.12, 0.42), (0.34, 0.5, 0.32), primary
    )
    chest = add_ico_sphere(
        "Rabbit_Chest", (0, 0.2, 0.38), (0.27, 0.3, 0.28), secondary
    )
    haunch_left = add_ico_sphere(
        "Rabbit_Haunch_L", (-0.22, -0.29, 0.36), (0.23, 0.31, 0.27), primary
    )
    haunch_right = add_ico_sphere(
        "Rabbit_Haunch_R", (0.22, -0.29, 0.36), (0.23, 0.31, 0.27), primary
    )
    head = add_ico_sphere(
        "Rabbit_Head", (0, 0.42, 0.59), (0.29, 0.29, 0.27), primary
    )
    muzzle = add_ico_sphere(
        "Rabbit_Muzzle", (0, 0.66, 0.51), (0.2, 0.16, 0.14), secondary
    )
    nose = add_ico_sphere(
        "Rabbit_Nose", (0, 0.79, 0.54), (0.065, 0.045, 0.055), charcoal, subdivisions=1
    )

    eye_left = add_ico_sphere(
        "Rabbit_Eye_L", (-0.22, 0.59, 0.65), (0.065, 0.045, 0.07), charcoal
    )
    eye_right = add_ico_sphere(
        "Rabbit_Eye_R", (0.22, 0.59, 0.65), (0.065, 0.045, 0.07), charcoal
    )
    glint_left = add_ico_sphere(
        "Rabbit_EyeGlint_L", (-0.239, 0.627, 0.677), (0.018, 0.013, 0.018), eye_glint, subdivisions=1
    )
    glint_right = add_ico_sphere(
        "Rabbit_EyeGlint_R", (0.239, 0.627, 0.677), (0.018, 0.013, 0.018), eye_glint, subdivisions=1
    )

    ear_left = add_ico_sphere(
        "Rabbit_Ear_L",
        (-0.14, 0.38, 0.99),
        (0.115, 0.085, 0.35),
        primary,
        rotation=(math.radians(-5), math.radians(-9), math.radians(-6)),
    )
    ear_right = add_ico_sphere(
        "Rabbit_Ear_R",
        (0.14, 0.38, 0.99),
        (0.115, 0.085, 0.35),
        primary,
        rotation=(math.radians(-5), math.radians(9), math.radians(6)),
    )
    inner_left = add_ico_sphere(
        "Rabbit_InnerEar_L",
        (-0.14, 0.447, 0.995),
        (0.064, 0.025, 0.245),
        inner_ear,
        rotation=(math.radians(-5), math.radians(-9), math.radians(-6)),
        subdivisions=1,
    )
    inner_right = add_ico_sphere(
        "Rabbit_InnerEar_R",
        (0.14, 0.447, 0.995),
        (0.064, 0.025, 0.245),
        inner_ear,
        rotation=(math.radians(-5), math.radians(9), math.radians(6)),
        subdivisions=1,
    )

    front_legs: list[bpy.types.Object] = []
    front_paws: list[bpy.types.Object] = []
    for side, x, pivot in (
        ("L", -0.16, front_left_pivot),
        ("R", 0.16, front_right_pivot),
    ):
        leg = add_ico_sphere(
            f"Rabbit_FrontLeg_{side}", (x, 0.29, 0.2), (0.09, 0.12, 0.2), primary
        )
        paw = add_ico_sphere(
            f"Rabbit_FrontPaw_{side}", (x, 0.39, 0.055), (0.1, 0.18, 0.07), secondary, subdivisions=1
        )
        parent_keep_transform(leg, pivot)
        parent_keep_transform(paw, pivot)
        front_legs.append(leg)
        front_paws.append(paw)

    hind_legs: list[bpy.types.Object] = []
    hind_feet: list[bpy.types.Object] = []
    for side, x, pivot in (
        ("L", -0.23, hind_left_pivot),
        ("R", 0.23, hind_right_pivot),
    ):
        leg = add_ico_sphere(
            f"Rabbit_HindLeg_{side}", (x, -0.29, 0.24), (0.16, 0.23, 0.22), primary
        )
        foot = add_ico_sphere(
            f"Rabbit_HindFoot_{side}", (x, 0.0, 0.065), (0.13, 0.3, 0.085), secondary, subdivisions=1
        )
        parent_keep_transform(leg, pivot)
        parent_keep_transform(foot, pivot)
        hind_legs.append(leg)
        hind_feet.append(foot)

    tail = add_ico_sphere(
        "Rabbit_Tail", (0, -0.62, 0.48), (0.17, 0.16, 0.17), secondary
    )

    whiskers: list[bpy.types.Object] = []
    for side, direction in (("L", -1), ("R", 1)):
        for index, height in enumerate((0.48, 0.53, 0.58), start=1):
            whiskers.append(
                add_cylinder(
                    f"Rabbit_Whisker_{side}_{index}",
                    (direction * 0.23, 0.72, height),
                    0.006,
                    0.38,
                    secondary,
                    rotation=(0, math.radians(90), math.radians(direction * (index - 2) * 8)),
                    vertices=6,
                )
            )
    whisker_mesh = join_objects(whiskers, "Rabbit_Whiskers")

    for obj in (body, chest, haunch_left, haunch_right):
        parent_keep_transform(obj, body_pivot)
    for obj in (head, muzzle, eye_left, eye_right, glint_left, glint_right):
        parent_keep_transform(obj, head_pivot)
    parent_keep_transform(nose, nose_pivot)
    parent_keep_transform(whisker_mesh, nose_pivot)
    parent_keep_transform(ear_left, ear_left_pivot)
    parent_keep_transform(ear_right, ear_right_pivot)
    parent_keep_transform(inner_left, ear_left_pivot)
    parent_keep_transform(inner_right, ear_right_pivot)
    parent_keep_transform(tail, tail_pivot)

    # Blender +Y exports as runtime -Z. Rotate the complete rig to match the
    # shared animal convention where runtime +Z is forward travel.
    root.rotation_euler.z = math.pi

    expected_names = {
        "Rabbit_Root",
        "Rabbit_BodyPivot",
        "Rabbit_HeadPivot",
        "Rabbit_NosePivot",
        "Rabbit_EarPivot_L",
        "Rabbit_EarPivot_R",
        "Rabbit_LegPivot_FL",
        "Rabbit_LegPivot_FR",
        "Rabbit_LegPivot_HL",
        "Rabbit_LegPivot_HR",
        "Rabbit_TailPivot",
        "Rabbit_Body",
        "Rabbit_Chest",
        "Rabbit_Haunch_L",
        "Rabbit_Haunch_R",
        "Rabbit_Head",
        "Rabbit_Muzzle",
        "Rabbit_Nose",
        "Rabbit_Eye_L",
        "Rabbit_Eye_R",
        "Rabbit_EyeGlint_L",
        "Rabbit_EyeGlint_R",
        "Rabbit_Ear_L",
        "Rabbit_Ear_R",
        "Rabbit_InnerEar_L",
        "Rabbit_InnerEar_R",
        "Rabbit_FrontLeg_L",
        "Rabbit_FrontLeg_R",
        "Rabbit_FrontPaw_L",
        "Rabbit_FrontPaw_R",
        "Rabbit_HindLeg_L",
        "Rabbit_HindLeg_R",
        "Rabbit_HindFoot_L",
        "Rabbit_HindFoot_R",
        "Rabbit_Tail",
        "Rabbit_Whiskers",
    }
    actual_names = {obj.name for obj in bpy.context.scene.objects}
    if actual_names != expected_names:
        raise RuntimeError(
            f"Unexpected Rabbit objects; missing={sorted(expected_names - actual_names)}, "
            f"unexpected={sorted(actual_names - expected_names)}"
        )

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    print(f"Saved {output}")


def main() -> None:
    args = parse_args()
    create_rabbit(args.output)


if __name__ == "__main__":
    main()
