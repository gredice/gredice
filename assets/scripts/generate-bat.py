#!/usr/bin/env python3
"""Generate the original low-poly Gredice Bat source asset.

Run with Blender, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python assets/scripts/generate-bat.py \
      -- --output assets/game-assets/Bat.blend
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
    parser.add_argument("--output", required=True, type=Path)
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
    roughness: float = 0.84,
) -> bpy.types.Material:
    linear_color = linear_rgba(color)
    value = bpy.data.materials.new(name)
    value.diffuse_color = linear_color
    value.use_nodes = True
    value.use_backface_culling = False
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


def add_cone(
    name: str,
    location: tuple[float, float, float],
    radius1: float,
    radius2: float,
    depth: float,
    value: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0, 0, 0),
    vertices: int = 6,
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
    apply_scale(obj)
    assign_material(obj, value)
    return obj


def add_bone_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    value: bpy.types.Material,
) -> bpy.types.Object:
    start_vector = mathutils.Vector(start)
    end_vector = mathutils.Vector(end)
    direction = end_vector - start_vector
    midpoint = (start_vector + end_vector) / 2
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=7,
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


def add_membrane(
    name: str,
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, ...]],
    value: bpy.types.Material,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
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


def animate_rotation(
    obj: bpy.types.Object,
    clip_name: str,
    frame_end: int,
    keyframes: Iterable[tuple[int, tuple[float, float, float]]],
) -> None:
    obj.rotation_mode = "XYZ"
    obj.animation_data_create()
    action = bpy.data.actions.new(f"{clip_name}_{obj.name}")
    obj.animation_data.action = action
    for frame, rotation in keyframes:
        obj.rotation_euler = rotation
        obj.keyframe_insert(data_path="rotation_euler", frame=frame)
    action.use_frame_range = True
    action.frame_start = 1
    action.frame_end = frame_end
    track = obj.animation_data.nla_tracks.new()
    track.name = clip_name
    strip = track.strips.new(clip_name, 1, action)
    strip.action_frame_start = 1
    strip.action_frame_end = frame_end
    strip.extrapolation = "NOTHING"
    obj.animation_data.action = None
    obj.rotation_euler = (0, 0, 0)


def animate_location(
    obj: bpy.types.Object,
    clip_name: str,
    frame_end: int,
    base_location: tuple[float, float, float],
    keyframes: Iterable[tuple[int, tuple[float, float, float]]],
) -> None:
    obj.animation_data_create()
    action = bpy.data.actions.new(f"{clip_name}_{obj.name}")
    obj.animation_data.action = action
    for frame, offset in keyframes:
        obj.location = tuple(
            base_location[index] + offset[index] for index in range(3)
        )
        obj.keyframe_insert(data_path="location", frame=frame)
    action.use_frame_range = True
    action.frame_start = 1
    action.frame_end = frame_end
    track = obj.animation_data.nla_tracks.new()
    track.name = clip_name
    strip = track.strips.new(clip_name, 1, action)
    strip.action_frame_start = 1
    strip.action_frame_end = frame_end
    strip.extrapolation = "NOTHING"
    obj.animation_data.action = None
    obj.location = base_location


def mirror_x(point: tuple[float, float, float]) -> tuple[float, float, float]:
    return (-point[0], point[1], point[2])


def create_bat(output: Path) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.fps = 24
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene.world = bpy.data.worlds.new("Gredice Night Garden")
    scene.world.color = (0.025, 0.035, 0.055)
    scene["generated_by"] = "assets/scripts/generate-bat.py"
    scene["asset_name"] = "Bat"
    scene["style"] = "Original Gredice cozy low-poly European microbat"

    fur = material("Material.Bat.WarmCharcoal", (0.2, 0.13, 0.15, 1))
    fur_light = material("Material.Bat.WarmBrown", (0.38, 0.25, 0.2, 1))
    membrane = material("Material.Bat.WingMembrane", (0.24, 0.13, 0.22, 1))
    membrane_light = material(
        "Material.Bat.WingMembraneLight", (0.36, 0.19, 0.28, 1)
    )
    inner_ear = material("Material.Bat.InnerEar", (0.48, 0.24, 0.25, 1))
    eye = material("Material.Bat.Eye", (0.025, 0.02, 0.025, 1), roughness=0.58)
    eye_glint = material(
        "Material.Bat.EyeGlint", (0.92, 0.54, 0.17, 1), roughness=0.38
    )
    claw = material("Material.Bat.Claw", (0.42, 0.31, 0.25, 1))

    root = empty("Bat_Root", (0, 0, 0))
    body_pivot = empty("Bat_BodyPivot", (0, -0.04, 0.62))
    head_pivot = empty("Bat_HeadPivot", (0, 0.34, 0.82))
    wing_root_left = empty("Bat_WingRootPivot_L", (-0.22, 0.05, 0.76))
    wing_root_right = empty("Bat_WingRootPivot_R", (0.22, 0.05, 0.76))
    wing_elbow_left = empty("Bat_WingElbowPivot_L", (-0.67, 0.02, 0.72))
    wing_elbow_right = empty("Bat_WingElbowPivot_R", (0.67, 0.02, 0.72))
    wing_hand_left = empty("Bat_WingHandPivot_L", (-1.02, 0.11, 0.68))
    wing_hand_right = empty("Bat_WingHandPivot_R", (1.02, 0.11, 0.68))
    tail_pivot = empty("Bat_TailPivot", (0, -0.37, 0.5))

    parent_keep_transform(body_pivot, root)
    parent_keep_transform(head_pivot, body_pivot)
    parent_keep_transform(wing_root_left, body_pivot)
    parent_keep_transform(wing_root_right, body_pivot)
    parent_keep_transform(wing_elbow_left, wing_root_left)
    parent_keep_transform(wing_elbow_right, wing_root_right)
    parent_keep_transform(wing_hand_left, wing_elbow_left)
    parent_keep_transform(wing_hand_right, wing_elbow_right)
    parent_keep_transform(tail_pivot, body_pivot)

    body = add_ico_sphere(
        "Bat_Body", (0, -0.04, 0.62), (0.25, 0.39, 0.36), fur
    )
    chest = add_ico_sphere(
        "Bat_Chest", (0, 0.17, 0.68), (0.19, 0.24, 0.27), fur_light
    )
    head = add_ico_sphere(
        "Bat_Head", (0, 0.37, 0.83), (0.28, 0.27, 0.27), fur
    )
    muzzle = add_ico_sphere(
        "Bat_Muzzle", (0, 0.6, 0.77), (0.18, 0.13, 0.13), fur_light, subdivisions=1
    )
    nose = add_ico_sphere(
        "Bat_Nose", (0, 0.705, 0.78), (0.075, 0.045, 0.05), membrane, subdivisions=1
    )
    ear_left = add_cone(
        "Bat_Ear_L",
        (-0.17, 0.38, 1.08),
        0.16,
        0.025,
        0.46,
        fur_light,
        rotation=(math.radians(-7), math.radians(-13), math.radians(-8)),
        vertices=6,
    )
    ear_right = add_cone(
        "Bat_Ear_R",
        (0.17, 0.38, 1.08),
        0.16,
        0.025,
        0.46,
        fur_light,
        rotation=(math.radians(-7), math.radians(13), math.radians(8)),
        vertices=6,
    )
    inner_left = add_cone(
        "Bat_InnerEar_L",
        (-0.17, 0.397, 1.075),
        0.095,
        0.02,
        0.31,
        inner_ear,
        rotation=(math.radians(-7), math.radians(-13), math.radians(-8)),
        vertices=6,
    )
    inner_right = add_cone(
        "Bat_InnerEar_R",
        (0.17, 0.397, 1.075),
        0.095,
        0.02,
        0.31,
        inner_ear,
        rotation=(math.radians(-7), math.radians(13), math.radians(8)),
        vertices=6,
    )

    eye_left = add_ico_sphere(
        "Bat_Eye_L", (-0.185, 0.565, 0.89), (0.055, 0.035, 0.058), eye, subdivisions=1
    )
    eye_right = add_ico_sphere(
        "Bat_Eye_R", (0.185, 0.565, 0.89), (0.055, 0.035, 0.058), eye, subdivisions=1
    )
    glint_left = add_ico_sphere(
        "Bat_EyeGlint_L", (-0.2, 0.594, 0.91), (0.016, 0.011, 0.016), eye_glint, subdivisions=1
    )
    glint_right = add_ico_sphere(
        "Bat_EyeGlint_R", (0.2, 0.594, 0.91), (0.016, 0.011, 0.016), eye_glint, subdivisions=1
    )

    shoulder_left = (-0.21, 0.06, 0.76)
    elbow_left = (-0.67, 0.02, 0.72)
    wrist_left = (-1.02, 0.11, 0.68)
    tip_front_left = (-1.32, 0.38, 0.64)
    tip_mid_left = (-1.43, -0.03, 0.58)
    tip_back_left = (-1.22, -0.43, 0.5)
    body_back_left = (-0.14, -0.39, 0.46)

    wing_parts: list[bpy.types.Object] = []
    for side, mirror, pivots in (
        ("L", False, (wing_root_left, wing_elbow_left, wing_hand_left)),
        ("R", True, (wing_root_right, wing_elbow_right, wing_hand_right)),
    ):
        point = mirror_x if mirror else lambda value: value
        shoulder = point(shoulder_left)
        elbow = point(elbow_left)
        wrist = point(wrist_left)
        tip_front = point(tip_front_left)
        tip_mid = point(tip_mid_left)
        tip_back = point(tip_back_left)
        body_back = point(body_back_left)
        root_pivot, elbow_pivot, hand_pivot = pivots

        upper_arm = add_bone_between(
            f"Bat_UpperArm_{side}", shoulder, elbow, 0.035, fur_light
        )
        forearm = add_bone_between(
            f"Bat_Forearm_{side}", elbow, wrist, 0.03, fur_light
        )
        finger_front = add_bone_between(
            f"Bat_FingerFront_{side}", wrist, tip_front, 0.018, fur_light
        )
        finger_mid = add_bone_between(
            f"Bat_FingerMid_{side}", wrist, tip_mid, 0.016, fur_light
        )
        finger_back = add_bone_between(
            f"Bat_FingerBack_{side}", wrist, tip_back, 0.014, fur_light
        )
        inner_membrane = add_membrane(
            f"Bat_InnerMembrane_{side}",
            [shoulder, elbow, tip_back, body_back],
            [(0, 1, 2, 3)],
            membrane_light,
        )
        outer_membrane = add_membrane(
            f"Bat_OuterMembrane_{side}",
            [elbow, wrist, tip_front, tip_mid, tip_back],
            [(0, 1, 2, 3, 4)],
            membrane,
        )
        hand_membrane = add_membrane(
            f"Bat_HandMembrane_{side}",
            [wrist, tip_front, tip_mid, tip_back],
            [(0, 1, 2, 3)],
            membrane_light,
        )
        thumb = add_cone(
            f"Bat_ThumbClaw_{side}",
            point((-1.0, 0.2, 0.76)),
            0.035,
            0,
            0.16,
            claw,
            rotation=(math.radians(74), 0, math.radians(16 if mirror else -16)),
            vertices=5,
        )

        parent_keep_transform(upper_arm, root_pivot)
        parent_keep_transform(inner_membrane, root_pivot)
        parent_keep_transform(forearm, elbow_pivot)
        parent_keep_transform(outer_membrane, elbow_pivot)
        for wing_part in (finger_front, finger_mid, finger_back, hand_membrane, thumb):
            parent_keep_transform(wing_part, hand_pivot)
        wing_parts.extend(
            [
                upper_arm,
                forearm,
                finger_front,
                finger_mid,
                finger_back,
                inner_membrane,
                outer_membrane,
                hand_membrane,
                thumb,
            ]
        )

    leg_left = add_bone_between(
        "Bat_Leg_L", (-0.12, -0.24, 0.46), (-0.18, -0.45, 0.28), 0.025, fur_light
    )
    leg_right = add_bone_between(
        "Bat_Leg_R", (0.12, -0.24, 0.46), (0.18, -0.45, 0.28), 0.025, fur_light
    )
    foot_left = add_cone(
        "Bat_Foot_L",
        (-0.19, -0.49, 0.23),
        0.045,
        0.01,
        0.18,
        claw,
        rotation=(math.radians(72), 0, math.radians(-8)),
        vertices=5,
    )
    foot_right = add_cone(
        "Bat_Foot_R",
        (0.19, -0.49, 0.23),
        0.045,
        0.01,
        0.18,
        claw,
        rotation=(math.radians(72), 0, math.radians(8)),
        vertices=5,
    )
    tail_membrane = add_membrane(
        "Bat_TailMembrane",
        [
            (-0.18, -0.42, 0.3),
            (0, -0.66, 0.25),
            (0.18, -0.42, 0.3),
            (0.12, -0.25, 0.46),
            (-0.12, -0.25, 0.46),
        ],
        [(0, 1, 2, 3, 4)],
        membrane,
    )

    for obj in (body, chest):
        parent_keep_transform(obj, body_pivot)
    for obj in (
        head,
        muzzle,
        nose,
        ear_left,
        ear_right,
        inner_left,
        inner_right,
        eye_left,
        eye_right,
        glint_left,
        glint_right,
    ):
        parent_keep_transform(obj, head_pivot)
    for obj in (leg_left, leg_right, foot_left, foot_right, tail_membrane):
        parent_keep_transform(obj, tail_pivot)

    # Blender +Y exports as runtime -Z. Rotate the complete rig so the muzzle
    # faces runtime +Z, matching the shared animal movement convention.
    root.rotation_euler.z = math.pi

    flap_frames = [1, 7, 13, 19, 25]
    animate_rotation(
        wing_root_left,
        "Bat_Flap",
        25,
        zip(
            flap_frames,
            [
                (0, math.radians(12), math.radians(-4)),
                (0, math.radians(58), math.radians(10)),
                (0, math.radians(-38), math.radians(-9)),
                (0, math.radians(-4), math.radians(-2)),
                (0, math.radians(12), math.radians(-4)),
            ],
        ),
    )
    animate_rotation(
        wing_root_right,
        "Bat_Flap",
        25,
        zip(
            flap_frames,
            [
                (0, math.radians(-12), math.radians(4)),
                (0, math.radians(-58), math.radians(-10)),
                (0, math.radians(38), math.radians(9)),
                (0, math.radians(4), math.radians(2)),
                (0, math.radians(-12), math.radians(4)),
            ],
        ),
    )
    for pivot, sign in (
        (wing_elbow_left, 1),
        (wing_hand_left, 1),
        (wing_elbow_right, -1),
        (wing_hand_right, -1),
    ):
        amount = 18 if "Elbow" in pivot.name else 28
        animate_rotation(
            pivot,
            "Bat_Flap",
            25,
            zip(
                flap_frames,
                [
                    (0, 0, 0),
                    (0, math.radians(sign * amount), math.radians(sign * 13)),
                    (0, math.radians(sign * -6), math.radians(sign * -5)),
                    (0, math.radians(sign * 5), math.radians(sign * 2)),
                    (0, 0, 0),
                ],
            ),
        )
    animate_location(
        body_pivot,
        "Bat_Flap",
        25,
        tuple(body_pivot.location),
        [(1, (0, 0, 0)), (7, (0, 0, 0.035)), (13, (0, 0, -0.025)), (19, (0, 0, 0.015)), (25, (0, 0, 0))],
    )
    animate_rotation(
        head_pivot,
        "Bat_Flap",
        25,
        [(1, (0, 0, 0)), (7, (math.radians(-4), 0, 0)), (13, (math.radians(5), 0, 0)), (19, (math.radians(-2), 0, 0)), (25, (0, 0, 0))],
    )
    animate_rotation(
        tail_pivot,
        "Bat_Flap",
        25,
        [(1, (0, 0, 0)), (7, (math.radians(5), 0, 0)), (13, (math.radians(-7), 0, 0)), (19, (math.radians(2), 0, 0)), (25, (0, 0, 0))],
    )

    for pivot, sign in ((wing_root_left, 1), (wing_root_right, -1)):
        animate_rotation(
            pivot,
            "Bat_Glide",
            48,
            [(1, (0, math.radians(sign * 4), 0)), (24, (0, math.radians(sign * 8), math.radians(-sign * 2))), (48, (0, math.radians(sign * 4), 0))],
        )
    animate_location(
        body_pivot,
        "Bat_Glide",
        48,
        tuple(body_pivot.location),
        [(1, (0, 0, 0)), (24, (0, 0, 0.018)), (48, (0, 0, 0))],
    )
    animate_rotation(
        head_pivot,
        "Bat_Glide",
        48,
        [(1, (math.radians(-2), 0, 0)), (24, (math.radians(2), 0, 0)), (48, (math.radians(-2), 0, 0))],
    )

    for pivot, sign in (
        (wing_root_left, 1),
        (wing_root_right, -1),
        (wing_elbow_left, 1),
        (wing_elbow_right, -1),
        (wing_hand_left, 1),
        (wing_hand_right, -1),
    ):
        fold = 68 if "Root" in pivot.name else 42
        animate_rotation(
            pivot,
            "Bat_Roost",
            48,
            [(1, (0, math.radians(sign * fold), math.radians(sign * 10))), (24, (0, math.radians(sign * (fold + 3)), math.radians(sign * 8))), (48, (0, math.radians(sign * fold), math.radians(sign * 10)))],
        )
    animate_rotation(
        head_pivot,
        "Bat_Roost",
        48,
        [(1, (math.radians(8), 0, 0)), (24, (math.radians(5), 0, math.radians(2))), (48, (math.radians(8), 0, 0))],
    )

    expected_names = {
        "Bat_Root",
        "Bat_BodyPivot",
        "Bat_HeadPivot",
        "Bat_WingRootPivot_L",
        "Bat_WingRootPivot_R",
        "Bat_WingElbowPivot_L",
        "Bat_WingElbowPivot_R",
        "Bat_WingHandPivot_L",
        "Bat_WingHandPivot_R",
        "Bat_TailPivot",
        "Bat_Body",
        "Bat_Chest",
        "Bat_Head",
        "Bat_Muzzle",
        "Bat_Nose",
        "Bat_Ear_L",
        "Bat_Ear_R",
        "Bat_InnerEar_L",
        "Bat_InnerEar_R",
        "Bat_Eye_L",
        "Bat_Eye_R",
        "Bat_EyeGlint_L",
        "Bat_EyeGlint_R",
        "Bat_UpperArm_L",
        "Bat_UpperArm_R",
        "Bat_Forearm_L",
        "Bat_Forearm_R",
        "Bat_FingerFront_L",
        "Bat_FingerFront_R",
        "Bat_FingerMid_L",
        "Bat_FingerMid_R",
        "Bat_FingerBack_L",
        "Bat_FingerBack_R",
        "Bat_InnerMembrane_L",
        "Bat_InnerMembrane_R",
        "Bat_OuterMembrane_L",
        "Bat_OuterMembrane_R",
        "Bat_HandMembrane_L",
        "Bat_HandMembrane_R",
        "Bat_ThumbClaw_L",
        "Bat_ThumbClaw_R",
        "Bat_Leg_L",
        "Bat_Leg_R",
        "Bat_Foot_L",
        "Bat_Foot_R",
        "Bat_TailMembrane",
    }
    actual_names = {obj.name for obj in scene.objects}
    if actual_names != expected_names:
        raise RuntimeError(
            f"Unexpected Bat objects; missing={sorted(expected_names - actual_names)}, "
            f"unexpected={sorted(actual_names - expected_names)}"
        )

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    print(f"Saved {output}")


if __name__ == "__main__":
    import mathutils

    create_bat(parse_args().output.resolve())
