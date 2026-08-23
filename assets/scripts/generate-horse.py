#!/usr/bin/env python3
"""Generate the original Gredice Horse source asset.

Run with Blender, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python assets/scripts/generate-horse.py \
      -- --output assets/game-assets/Horse.blend

The mesh is authored at game scale and faces Blender +Y. Horse_Root is rotated
180 degrees so the exported model follows the runtime animal +Z-forward
convention used by Chicken and Piglet.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections.abc import Iterable
from pathlib import Path

import bpy
from mathutils import Vector


COAT_PALETTES = {
    "bay": {
        "label": "Dorat",
        "coat": "#6F3F2D",
        "mane": "#211715",
        "marking": "#EEE3CF",
        "muzzle": "#4D3832",
    },
    "chestnut": {
        "label": "Kestenjasti",
        "coat": "#9B4D2F",
        "mane": "#6D2F22",
        "marking": "#F2DFC4",
        "muzzle": "#6F453C",
    },
    "black": {
        "label": "Vranac",
        "coat": "#24211F",
        "mane": "#11100F",
        "marking": "#DDD8CE",
        "muzzle": "#393433",
    },
    "dapple-gray": {
        "label": "Sivac",
        "coat": "#B9B5AD",
        "mane": "#77736D",
        "marking": "#E8E3D9",
        "muzzle": "#858079",
    },
    "palomino": {
        "label": "Palomino",
        "coat": "#C9944F",
        "mane": "#EAD8AB",
        "marking": "#F4E8CD",
        "muzzle": "#927052",
    },
    "pinto": {
        "label": "Šarac",
        "coat": "#8B553B",
        "mane": "#38251E",
        "marking": "#F0E6D5",
        "muzzle": "#725449",
    },
}

HORSE_COAT_DARK_FACTOR = 0.72


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Path to the generated Horse.blend file.",
    )
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def hex_rgba(value: str) -> tuple[float, float, float, float]:
    color = value.removeprefix("#")
    return (
        int(color[0:2], 16) / 255,
        int(color[2:4], 16) / 255,
        int(color[4:6], 16) / 255,
        1,
    )


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


def darken_linear_rgba(
    color: tuple[float, float, float, float], factor: float
) -> tuple[float, float, float, float]:
    red, green, blue, alpha = linear_rgba(color)
    return (red * factor, green * factor, blue * factor, alpha)


def material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    color_is_linear: bool = False,
    roughness: float = 0.84,
) -> bpy.types.Material:
    linear_color = color if color_is_linear else linear_rgba(color)
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


def apply_transforms(obj: bpy.types.Object) -> None:
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
    apply_transforms(obj)
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
    vertices: int = 7,
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
    obj.empty_display_size = 0.09
    obj.location = location
    bpy.context.collection.objects.link(obj)
    return obj


def parent_keep_transform(
    child: bpy.types.Object, parent: bpy.types.Object
) -> None:
    world_matrix = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world_matrix


def animate_object(
    clip_name: str,
    end_frame: int,
    obj: bpy.types.Object,
    keyframes: list[
        tuple[
            int,
            tuple[float, float, float],
            tuple[float, float, float],
            tuple[float, float, float],
        ]
    ],
) -> None:
    """Create one object action on a same-named NLA track.

    The exporter merges same-named tracks from all pivots into one GLB clip.
    Keyframe values are offsets/multipliers relative to the authored rest pose.
    """

    base_location = obj.location.copy()
    base_rotation = obj.rotation_euler.copy()
    base_scale = obj.scale.copy()
    obj.animation_data_create()
    obj.animation_data.use_nla = False
    action = bpy.data.actions.new(f"{clip_name}_{obj.name}")
    action.frame_start = 1
    action.frame_end = end_frame
    obj.animation_data.action = action

    for frame, location, rotation, scale in keyframes:
        obj.location = (
            base_location.x + location[0],
            base_location.y + location[1],
            base_location.z + location[2],
        )
        obj.rotation_euler = (
            base_rotation.x + rotation[0],
            base_rotation.y + rotation[1],
            base_rotation.z + rotation[2],
        )
        obj.scale = (
            base_scale.x * scale[0],
            base_scale.y * scale[1],
            base_scale.z * scale[2],
        )
        obj.keyframe_insert(data_path="location", frame=frame, group=obj.name)
        obj.keyframe_insert(
            data_path="rotation_euler", frame=frame, group=obj.name
        )
        obj.keyframe_insert(data_path="scale", frame=frame, group=obj.name)

    obj.animation_data.action = None
    track = obj.animation_data.nla_tracks.new()
    track.name = clip_name
    strip = track.strips.new(clip_name, 1, action)
    strip.name = clip_name
    obj.animation_data.use_nla = True
    obj.location = base_location
    obj.rotation_euler = base_rotation
    obj.scale = base_scale


def key(
    frame: int,
    *,
    location: tuple[float, float, float] = (0, 0, 0),
    rotation: tuple[float, float, float] = (0, 0, 0),
    scale: tuple[float, float, float] = (1, 1, 1),
) -> tuple[
    int,
    tuple[float, float, float],
    tuple[float, float, float],
    tuple[float, float, float],
]:
    return (frame, location, rotation, scale)


def add_animations(objects: dict[str, bpy.types.Object]) -> None:
    neutral = key(1)

    idle_end = 60
    animate_object(
        "Horse_Idle",
        idle_end,
        objects["Horse_BodyPivot"],
        [
            neutral,
            key(30, location=(0, 0, 0.012), scale=(1.004, 1.008, 1.018)),
            key(idle_end),
        ],
    )
    animate_object(
        "Horse_Idle",
        idle_end,
        objects["Horse_NeckPivot"],
        [neutral, key(30, rotation=(math.radians(-1.2), 0, 0)), key(idle_end)],
    )
    animate_object(
        "Horse_Idle",
        idle_end,
        objects["Horse_HeadPivot"],
        [neutral, key(30, rotation=(math.radians(1.6), 0, 0)), key(idle_end)],
    )

    graze_end = 84
    animate_object(
        "Horse_Graze",
        graze_end,
        objects["Horse_NeckPivot"],
        [
            neutral,
            key(18, rotation=(math.radians(-38), 0, 0)),
            key(32, rotation=(math.radians(-67), 0, 0)),
            key(56, rotation=(math.radians(-64), 0, math.radians(3))),
            key(70, rotation=(math.radians(-38), 0, 0)),
            key(graze_end),
        ],
    )
    animate_object(
        "Horse_Graze",
        graze_end,
        objects["Horse_HeadPivot"],
        [
            neutral,
            key(18, rotation=(math.radians(8), 0, 0)),
            key(32, rotation=(math.radians(18), 0, 0)),
            key(44, rotation=(math.radians(22), 0, math.radians(-4))),
            key(56, rotation=(math.radians(16), 0, math.radians(4))),
            key(70, rotation=(math.radians(8), 0, 0)),
            key(graze_end),
        ],
    )
    animate_object(
        "Horse_Graze",
        graze_end,
        objects["Horse_BodyPivot"],
        [neutral, key(42, location=(0, 0.015, -0.018)), key(graze_end)],
    )

    attentive_end = 64
    animate_object(
        "Horse_Attentive",
        attentive_end,
        objects["Horse_NeckPivot"],
        [
            neutral,
            key(14, rotation=(math.radians(7), 0, math.radians(-3))),
            key(34, rotation=(math.radians(9), 0, math.radians(4))),
            key(52, rotation=(math.radians(5), 0, 0)),
            key(attentive_end),
        ],
    )
    animate_object(
        "Horse_Attentive",
        attentive_end,
        objects["Horse_HeadPivot"],
        [
            neutral,
            key(14, rotation=(math.radians(-5), 0, math.radians(-8))),
            key(34, rotation=(math.radians(-3), 0, math.radians(9))),
            key(52, rotation=(math.radians(-2), 0, math.radians(2))),
            key(attentive_end),
        ],
    )
    for side, direction in (("L", 1), ("R", -1)):
        animate_object(
            "Horse_Attentive",
            attentive_end,
            objects[f"Horse_EarPivot_{side}"],
            [
                neutral,
                key(14, rotation=(math.radians(-7), 0, math.radians(12 * direction))),
                key(34, rotation=(math.radians(5), 0, math.radians(-8 * direction))),
                key(52, rotation=(math.radians(-3), 0, math.radians(4 * direction))),
                key(attentive_end),
            ],
        )

    tail_end = 40
    for pivot_name, amount in (
        ("Horse_TailPivot_Base", 18),
        ("Horse_TailPivot_Mid", 30),
        ("Horse_TailPivot_Tip", 38),
    ):
        animate_object(
            "Horse_TailSwish",
            tail_end,
            objects[pivot_name],
            [
                neutral,
                key(8, rotation=(0, math.radians(-3), math.radians(amount))),
                key(20, rotation=(0, math.radians(4), math.radians(-amount))),
                key(32, rotation=(0, math.radians(-2), math.radians(amount * 0.35))),
                key(tail_end),
            ],
        )

    walk_end = 32
    animate_object(
        "Horse_Walk",
        walk_end,
        objects["Horse_BodyPivot"],
        [
            neutral,
            key(8, location=(0, 0, 0.018), rotation=(math.radians(1.2), 0, 0)),
            key(16),
            key(24, location=(0, 0, 0.018), rotation=(math.radians(-1.2), 0, 0)),
            key(walk_end),
        ],
    )
    animate_object(
        "Horse_Walk",
        walk_end,
        objects["Horse_HeadPivot"],
        [neutral, key(8, rotation=(math.radians(-3), 0, 0)), key(16), key(24, rotation=(math.radians(3), 0, 0)), key(walk_end)],
    )
    for leg_name, phase in (("FL", 1), ("FR", -1), ("RL", -1), ("RR", 1)):
        angle = math.radians(18 * phase)
        animate_object(
            "Horse_Walk",
            walk_end,
            objects[f"Horse_LegPivot_{leg_name}"],
            [
                key(1),
                key(8, rotation=(angle, 0, 0)),
                key(16),
                key(24, rotation=(-angle, 0, 0)),
                key(walk_end),
            ],
        )
        flex = math.radians(10 if phase > 0 else 4)
        animate_object(
            "Horse_Walk",
            walk_end,
            objects[f"Horse_KneePivot_{leg_name}"],
            [
                key(1),
                key(8, rotation=(math.radians(4), 0, 0)),
                key(16, rotation=(flex, 0, 0)),
                key(24, rotation=(math.radians(8) - flex * 0.25, 0, 0)),
                key(walk_end),
            ],
        )

    trot_end = 24
    animate_object(
        "Horse_Trot",
        trot_end,
        objects["Horse_BodyPivot"],
        [
            neutral,
            key(6, location=(0, 0, 0.045), rotation=(math.radians(1.8), 0, 0)),
            key(12),
            key(18, location=(0, 0, 0.045), rotation=(math.radians(-1.8), 0, 0)),
            key(trot_end),
        ],
    )
    animate_object(
        "Horse_Trot",
        trot_end,
        objects["Horse_NeckPivot"],
        [neutral, key(6, rotation=(math.radians(-3), 0, 0)), key(12), key(18, rotation=(math.radians(3), 0, 0)), key(trot_end)],
    )
    for leg_name, phase in (("FL", 1), ("FR", -1), ("RL", -1), ("RR", 1)):
        angle = math.radians(27 * phase)
        animate_object(
            "Horse_Trot",
            trot_end,
            objects[f"Horse_LegPivot_{leg_name}"],
            [
                key(1),
                key(6, rotation=(angle, 0, 0)),
                key(12),
                key(18, rotation=(-angle, 0, 0)),
                key(trot_end),
            ],
        )
        animate_object(
            "Horse_Trot",
            trot_end,
            objects[f"Horse_KneePivot_{leg_name}"],
            [
                key(1),
                key(6, rotation=(math.radians(6), 0, 0)),
                key(12, rotation=(math.radians(16), 0, 0)),
                key(18, rotation=(math.radians(7), 0, 0)),
                key(trot_end),
            ],
        )


def create_horse(output_path: Path) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = (
        "BLENDER_EEVEE"
        if bpy.app.version >= (5, 0, 0)
        else "BLENDER_EEVEE_NEXT"
    )
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene.render.fps = 30
    scene.frame_start = 1
    scene.frame_end = 84
    scene.world = bpy.data.worlds.new("Gredice World")
    scene.world.color = (0.055, 0.07, 0.06)
    scene["generated_by"] = "assets/scripts/generate-horse.py"
    scene["asset_name"] = "Horse"
    scene["runtime_forward_axis"] = "+Z"
    scene["horse_coat_palettes"] = json.dumps(
        COAT_PALETTES, ensure_ascii=False, sort_keys=True
    )
    scene["horse_coat_dark_factor"] = HORSE_COAT_DARK_FACTOR

    bay = COAT_PALETTES["bay"]
    coat = material("Material.Horse.Coat", hex_rgba(bay["coat"]))
    coat_dark = material(
        "Material.Horse.CoatDark",
        darken_linear_rgba(hex_rgba(bay["coat"]), HORSE_COAT_DARK_FACTOR),
        color_is_linear=True,
    )
    mane = material("Material.Horse.Mane", hex_rgba(bay["mane"]))
    # Marking meshes are present for runtime variants but blend into the
    # default bay coat until a variant palette gives them contrast.
    marking = material("Material.Horse.Marking", hex_rgba(bay["marking"]))
    muzzle = material("Material.Horse.Muzzle", hex_rgba(bay["muzzle"]))
    hoof = material("Material.Horse.Hoof", (0.12, 0.105, 0.09, 1))
    eye = material("Material.Horse.Eye", (0.025, 0.022, 0.018, 1), roughness=0.64)
    eye_glint = material(
        "Material.Horse.EyeGlint", (0.96, 0.91, 0.78, 1), roughness=0.42
    )

    root = empty("Horse_Root", (0, 0, 0))
    body_pivot = empty("Horse_BodyPivot", (0, -0.06, 0.92))
    neck_pivot = empty("Horse_NeckPivot", (0, 0.45, 1.08))
    head_pivot = empty("Horse_HeadPivot", (0, 0.69, 1.27))
    ear_left_pivot = empty("Horse_EarPivot_L", (-0.13, 0.77, 1.38))
    ear_right_pivot = empty("Horse_EarPivot_R", (0.13, 0.77, 1.38))
    tail_base_pivot = empty("Horse_TailPivot_Base", (0, -0.71, 1.05))
    tail_mid_pivot = empty("Horse_TailPivot_Mid", (0, -0.78, 0.82))
    tail_tip_pivot = empty("Horse_TailPivot_Tip", (0, -0.8, 0.57))
    leg_pivots = {
        "FL": empty("Horse_LegPivot_FL", (-0.26, 0.36, 0.85)),
        "FR": empty("Horse_LegPivot_FR", (0.26, 0.36, 0.85)),
        "RL": empty("Horse_LegPivot_RL", (-0.27, -0.42, 0.84)),
        "RR": empty("Horse_LegPivot_RR", (0.27, -0.42, 0.84)),
    }
    knee_pivots = {
        key_name: empty(
            f"Horse_KneePivot_{key_name}",
            (
                -0.26 if key_name.endswith("L") else 0.26,
                0.36 if key_name.startswith("F") else -0.42,
                0.43,
            ),
        )
        for key_name in leg_pivots
    }

    body_pivot.parent = root
    body_pivot.location = (0, -0.06, 0.92)
    neck_pivot.parent = body_pivot
    neck_pivot.location = (0, 0.51, 0.16)
    head_pivot.parent = neck_pivot
    head_pivot.location = (0, 0.24, 0.19)
    ear_left_pivot.parent = head_pivot
    ear_left_pivot.location = (-0.13, 0.08, 0.11)
    ear_right_pivot.parent = head_pivot
    ear_right_pivot.location = (0.13, 0.08, 0.11)
    tail_base_pivot.parent = body_pivot
    tail_base_pivot.location = (0, -0.65, 0.13)
    tail_mid_pivot.parent = tail_base_pivot
    tail_mid_pivot.location = (0, -0.07, -0.23)
    tail_tip_pivot.parent = tail_mid_pivot
    tail_tip_pivot.location = (0, -0.02, -0.25)
    for key_name, leg_pivot in leg_pivots.items():
        leg_pivot.parent = body_pivot
        leg_pivot.location = (
            -0.26 if key_name.endswith("L") else 0.26,
            0.42 if key_name.startswith("F") else -0.36,
            -0.07 if key_name.startswith("F") else -0.08,
        )
        knee_pivots[key_name].parent = leg_pivot
        knee_pivots[key_name].location = (
            0,
            0,
            -0.42 if key_name.startswith("F") else -0.41,
        )
    bpy.context.view_layer.update()

    body = add_ico_sphere(
        "Horse_Body", (0, -0.08, 0.91), (0.37, 0.69, 0.31), coat
    )
    chest = add_ico_sphere(
        "Horse_Chest", (0, 0.39, 0.92), (0.34, 0.3, 0.35), coat
    )
    haunch = add_ico_sphere(
        "Horse_Haunch", (0, -0.5, 0.91), (0.37, 0.33, 0.34), coat_dark
    )
    belly = add_ico_sphere(
        "Horse_Belly", (0, -0.04, 0.72), (0.28, 0.48, 0.15), coat_dark
    )
    neck = add_ico_sphere(
        "Horse_Neck",
        (0, 0.52, 1.16),
        (0.225, 0.39, 0.29),
        coat,
        rotation=(math.radians(27), 0, 0),
    )
    head = add_ico_sphere(
        "Horse_Head",
        (0, 0.78, 1.28),
        (0.205, 0.39, 0.18),
        coat,
        rotation=(math.radians(-5), 0, 0),
    )
    muzzle_mesh = add_ico_sphere(
        "Horse_Muzzle",
        (0, 1.095, 1.205),
        (0.155, 0.255, 0.12),
        muzzle,
        rotation=(math.radians(-7), 0, 0),
    )
    nostril_left = add_ico_sphere(
        "Horse_Nostril_L", (-0.07, 1.315, 1.22), (0.022, 0.014, 0.016), eye, subdivisions=1
    )
    nostril_right = add_ico_sphere(
        "Horse_Nostril_R", (0.07, 1.315, 1.22), (0.022, 0.014, 0.016), eye, subdivisions=1
    )

    eye_left = add_ico_sphere(
        "Horse_Eye_L", (-0.17, 0.985, 1.335), (0.038, 0.029, 0.043), eye
    )
    eye_right = add_ico_sphere(
        "Horse_Eye_R", (0.17, 0.985, 1.335), (0.038, 0.029, 0.043), eye
    )
    glint_left = add_ico_sphere(
        "Horse_EyeGlint_L", (-0.185, 1.008, 1.352), (0.011, 0.009, 0.011), eye_glint, subdivisions=1
    )
    glint_right = add_ico_sphere(
        "Horse_EyeGlint_R", (0.185, 1.008, 1.352), (0.011, 0.009, 0.011), eye_glint, subdivisions=1
    )
    ear_left = add_cone(
        "Horse_Ear_L",
        (-0.13, 0.79, 1.47),
        0.085,
        0.018,
        0.25,
        coat_dark,
        rotation=(math.radians(-8), math.radians(-7), math.radians(3)),
        vertices=6,
    )
    ear_right = add_cone(
        "Horse_Ear_R",
        (0.13, 0.79, 1.47),
        0.085,
        0.018,
        0.25,
        coat_dark,
        rotation=(math.radians(-8), math.radians(7), math.radians(-3)),
        vertices=6,
    )

    mane_parts = []
    for index in range(6):
        mane_parts.append(
            add_cone(
                f"Horse_ManeTuft_{index}",
                (0, 0.36 + index * 0.065, 1.22 + index * 0.035),
                0.065 - index * 0.004,
                0.018,
                0.135,
                mane,
                rotation=(math.radians(69), 0, 0),
                vertices=5,
            )
        )
    mane_mesh = join_objects(mane_parts, "Horse_Mane")
    forelock = add_cone(
        "Horse_Forelock",
        (0, 0.86, 1.43),
        0.095,
        0.018,
        0.23,
        mane,
        rotation=(math.radians(-18), 0, 0),
        vertices=5,
    )

    upper_legs: dict[str, bpy.types.Object] = {}
    lower_legs: dict[str, bpy.types.Object] = {}
    hooves: dict[str, bpy.types.Object] = {}
    for key_name in leg_pivots:
        x = -0.26 if key_name.endswith("L") else 0.26
        y = 0.36 if key_name.startswith("F") else -0.42
        upper_legs[key_name] = add_ico_sphere(
            f"Horse_UpperLeg_{key_name}",
            (x, y, 0.62),
            (0.09, 0.105, 0.3),
            coat_dark if key_name.startswith("R") else coat,
        )
        lower_legs[key_name] = add_ico_sphere(
            f"Horse_LowerLeg_{key_name}",
            (x, y + 0.012, 0.285),
            (0.064, 0.072, 0.24),
            coat_dark,
        )
        hooves[key_name] = add_ico_sphere(
            f"Horse_Hoof_{key_name}",
            (x, y + 0.05, 0.075),
            (0.105, 0.15, 0.075),
            hoof,
            subdivisions=1,
        )
        parent_keep_transform(upper_legs[key_name], leg_pivots[key_name])
        parent_keep_transform(lower_legs[key_name], knee_pivots[key_name])
        parent_keep_transform(hooves[key_name], knee_pivots[key_name])

    tail_base = add_ico_sphere(
        "Horse_Tail_Base",
        (0, -0.76, 0.94),
        (0.105, 0.19, 0.25),
        mane,
        rotation=(math.radians(-16), 0, 0),
    )
    tail_mid = add_ico_sphere(
        "Horse_Tail_Mid",
        (0, -0.8, 0.7),
        (0.12, 0.15, 0.25),
        mane,
        rotation=(math.radians(-5), 0, 0),
    )
    tail_tip = add_cone(
        "Horse_Tail_Tip",
        (0, -0.8, 0.48),
        0.145,
        0.055,
        0.34,
        mane,
        rotation=(0, 0, math.radians(180)),
        vertices=7,
    )

    blaze = add_ico_sphere(
        "Horse_Blaze", (0, 0.999, 1.345), (0.055, 0.1, 0.125), marking
    )
    pinto_left = add_ico_sphere(
        "Horse_PintoPatch_L", (-0.365, -0.1, 0.98), (0.025, 0.31, 0.2), marking
    )
    pinto_right = add_ico_sphere(
        "Horse_PintoPatch_R", (0.365, 0.18, 0.94), (0.025, 0.24, 0.18), marking
    )
    sock_fl = add_ico_sphere(
        "Horse_Sock_FL", (-0.261, 0.374, 0.285), (0.078, 0.089, 0.14), marking
    )
    sock_rr = add_ico_sphere(
        "Horse_Sock_RR", (0.271, -0.406, 0.285), (0.078, 0.089, 0.14), marking
    )

    for obj in (body, chest, haunch, belly):
        parent_keep_transform(obj, body_pivot)
    parent_keep_transform(neck, neck_pivot)
    parent_keep_transform(mane_mesh, neck_pivot)
    for obj in (
        head,
        muzzle_mesh,
        nostril_left,
        nostril_right,
        eye_left,
        eye_right,
        glint_left,
        glint_right,
        blaze,
        forelock,
    ):
        parent_keep_transform(obj, head_pivot)
    parent_keep_transform(ear_left, ear_left_pivot)
    parent_keep_transform(ear_right, ear_right_pivot)
    parent_keep_transform(tail_base, tail_base_pivot)
    parent_keep_transform(tail_mid, tail_mid_pivot)
    parent_keep_transform(tail_tip, tail_tip_pivot)
    parent_keep_transform(pinto_left, body_pivot)
    parent_keep_transform(pinto_right, body_pivot)
    parent_keep_transform(sock_fl, knee_pivots["FL"])
    parent_keep_transform(sock_rr, knee_pivots["RR"])

    # Blender +Y exports as runtime -Z. This matches the existing farm-animal
    # source convention and makes the runtime animal face +Z while moving.
    root.rotation_euler.z = math.pi
    # A slightly shortened cozy silhouette stays legible in the isometric
    # camera while fitting the intended two-cell placement footprint.
    root.scale = (0.96, 0.83, 0.9)
    bpy.context.view_layer.update()

    objects = {obj.name: obj for obj in scene.objects}
    add_animations(objects)

    expected_names = [
        "Horse_Root",
        "Horse_BodyPivot",
        "Horse_NeckPivot",
        "Horse_HeadPivot",
        "Horse_EarPivot_L",
        "Horse_EarPivot_R",
        "Horse_TailPivot_Base",
        "Horse_TailPivot_Mid",
        "Horse_TailPivot_Tip",
        "Horse_LegPivot_FL",
        "Horse_LegPivot_FR",
        "Horse_LegPivot_RL",
        "Horse_LegPivot_RR",
        "Horse_KneePivot_FL",
        "Horse_KneePivot_FR",
        "Horse_KneePivot_RL",
        "Horse_KneePivot_RR",
        "Horse_Body",
        "Horse_Chest",
        "Horse_Haunch",
        "Horse_Belly",
        "Horse_Neck",
        "Horse_Head",
        "Horse_Muzzle",
        "Horse_Nostril_L",
        "Horse_Nostril_R",
        "Horse_Eye_L",
        "Horse_Eye_R",
        "Horse_EyeGlint_L",
        "Horse_EyeGlint_R",
        "Horse_Ear_L",
        "Horse_Ear_R",
        "Horse_Mane",
        "Horse_Forelock",
        "Horse_UpperLeg_FL",
        "Horse_UpperLeg_FR",
        "Horse_UpperLeg_RL",
        "Horse_UpperLeg_RR",
        "Horse_LowerLeg_FL",
        "Horse_LowerLeg_FR",
        "Horse_LowerLeg_RL",
        "Horse_LowerLeg_RR",
        "Horse_Hoof_FL",
        "Horse_Hoof_FR",
        "Horse_Hoof_RL",
        "Horse_Hoof_RR",
        "Horse_Tail_Base",
        "Horse_Tail_Mid",
        "Horse_Tail_Tip",
        "Horse_Blaze",
        "Horse_PintoPatch_L",
        "Horse_PintoPatch_R",
        "Horse_Sock_FL",
        "Horse_Sock_RR",
    ]
    actual_names = {obj.name for obj in scene.objects}
    expected = set(expected_names)
    if actual_names != expected:
        raise RuntimeError(
            "Unexpected Horse objects; "
            f"missing={sorted(expected - actual_names)}, "
            f"unexpected={sorted(actual_names - expected)}"
        )

    mesh_objects = [obj for obj in scene.objects if obj.type == "MESH"]
    world_points = [
        obj.matrix_world @ Vector(corner)
        for obj in mesh_objects
        for corner in obj.bound_box
    ]
    dimensions = tuple(
        round(
            max(point[axis] for point in world_points)
            - min(point[axis] for point in world_points),
            4,
        )
        for axis in range(3)
    )
    scene["source_dimensions_m"] = json.dumps(dimensions)
    scene["animation_clips"] = json.dumps(
        [
            "Horse_Idle",
            "Horse_Graze",
            "Horse_Attentive",
            "Horse_TailSwish",
            "Horse_Walk",
            "Horse_Trot",
        ]
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path), compress=True)
    print(
        f"Saved {output_path} with {len(expected_names)} objects, "
        f"{len(bpy.data.actions)} actions, dimensions={dimensions}"
    )


if __name__ == "__main__":
    create_horse(parse_args().output.resolve())
