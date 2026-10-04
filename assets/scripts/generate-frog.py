#!/usr/bin/env python3
"""Generate the original Gredice wetland frog source asset.

Run with Blender, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python assets/scripts/generate-frog.py \
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
    parser.add_argument(
        "--output-dir",
        type=Path,
        required=True,
        help="Directory that receives Frog.blend.",
    )
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.fps = 24
    scene.frame_start = 1
    scene.frame_end = 48
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene.world = bpy.data.worlds.new("Gredice World")
    scene.world.color = (0.045, 0.065, 0.045)
    scene["generated_by"] = "assets/scripts/generate-frog.py"
    scene["asset_name"] = "Frog"
    scene["style"] = "original cozy low-poly wetland animal"


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


def add_cube(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    value: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    apply_scale(obj)
    activate(obj)
    modifier = obj.modifiers.new(name="Soft bevel", type="BEVEL")
    modifier.width = min(dimensions) * 0.24
    modifier.segments = 2
    bpy.ops.object.modifier_apply(modifier=modifier.name)
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


def keyframe_transform(
    obj: bpy.types.Object,
    frame: int,
    *,
    location: tuple[float, float, float] | None = None,
    rotation: tuple[float, float, float] | None = None,
    scale: tuple[float, float, float] | None = None,
) -> None:
    if location is not None:
        obj.location = location
        obj.keyframe_insert(data_path="location", frame=frame)
    if rotation is not None:
        obj.rotation_euler = rotation
        obj.keyframe_insert(data_path="rotation_euler", frame=frame)
    if scale is not None:
        obj.scale = scale
        obj.keyframe_insert(data_path="scale", frame=frame)


def stash_action_as_clip(
    obj: bpy.types.Object, clip_name: str, frame_end: int
) -> None:
    animation_data = obj.animation_data
    if not animation_data or not animation_data.action:
        raise RuntimeError(f"No action created for {clip_name} on {obj.name}")

    action = animation_data.action
    action.name = f"{clip_name}_{obj.name}"
    action.use_fake_user = True

    track = animation_data.nla_tracks.new()
    track.name = clip_name
    strip = track.strips.new(action.name, 1, action)
    strip.action_frame_start = 1
    strip.action_frame_end = frame_end
    animation_data.action = None


def create_clip(
    obj: bpy.types.Object,
    clip_name: str,
    frame_end: int,
    keyframes: list[dict[str, object]],
) -> None:
    base_location = obj.location.copy()
    base_rotation = obj.rotation_euler.copy()
    base_scale = obj.scale.copy()
    for keyframe in keyframes:
        keyframe_transform(
            obj,
            int(keyframe["frame"]),
            location=keyframe.get("location"),
            rotation=keyframe.get("rotation"),
            scale=keyframe.get("scale"),
        )
    stash_action_as_clip(obj, clip_name, frame_end)
    obj.location = base_location
    obj.rotation_euler = base_rotation
    obj.scale = base_scale


def create_animations(parts: dict[str, bpy.types.Object]) -> None:
    body = parts["body_pivot"]
    head = parts["head_pivot"]
    throat = parts["throat_pivot"]
    eyelid_left = parts["eyelid_left"]
    eyelid_right = parts["eyelid_right"]
    front_left = parts["front_left_pivot"]
    front_right = parts["front_right_pivot"]
    rear_left = parts["rear_left_pivot"]
    rear_right = parts["rear_right_pivot"]

    body_location = tuple(body.location)
    body_scale = tuple(body.scale)
    head_rotation = tuple(head.rotation_euler)
    throat_scale = tuple(throat.scale)

    create_clip(
        body,
        "Frog_Idle",
        48,
        [
            {"frame": 1, "location": body_location, "scale": body_scale},
            {
                "frame": 24,
                "location": (body.location.x, body.location.y, body.location.z + 0.012),
                "scale": (1.018, 1.01, 1.035),
            },
            {"frame": 48, "location": body_location, "scale": body_scale},
        ],
    )
    create_clip(
        head,
        "Frog_Idle",
        48,
        [
            {"frame": 1, "rotation": head_rotation},
            {"frame": 24, "rotation": (-0.025, 0, 0.018)},
            {"frame": 48, "rotation": head_rotation},
        ],
    )
    create_clip(
        throat,
        "Frog_Idle",
        48,
        [
            {"frame": 1, "scale": throat_scale},
            {"frame": 24, "scale": (1.06, 1.09, 1.06)},
            {"frame": 48, "scale": throat_scale},
        ],
    )

    for eyelid in (eyelid_left, eyelid_right):
        open_location = tuple(eyelid.location)
        closed_location = (
            eyelid.location.x,
            eyelid.location.y,
            eyelid.location.z - 0.07,
        )
        create_clip(
            eyelid,
            "Frog_Blink",
            12,
            [
                {"frame": 1, "location": open_location},
                {"frame": 5, "location": closed_location},
                {"frame": 8, "location": closed_location},
                {"frame": 12, "location": open_location},
            ],
        )

    create_clip(
        body,
        "Frog_Hop",
        28,
        [
            {"frame": 1, "location": body_location, "scale": body_scale},
            {
                "frame": 6,
                "location": (body.location.x, body.location.y - 0.025, body.location.z - 0.045),
                "scale": (1.06, 1.08, 0.82),
            },
            {
                "frame": 12,
                "location": (body.location.x, body.location.y + 0.035, body.location.z + 0.055),
                "scale": (0.96, 1.02, 1.08),
            },
            {
                "frame": 22,
                "location": (body.location.x, body.location.y, body.location.z - 0.018),
                "scale": (1.045, 1.04, 0.9),
            },
            {"frame": 28, "location": body_location, "scale": body_scale},
        ],
    )
    create_clip(
        head,
        "Frog_Hop",
        28,
        [
            {"frame": 1, "rotation": head_rotation},
            {"frame": 6, "rotation": (0.12, 0, 0)},
            {"frame": 13, "rotation": (-0.11, 0, 0)},
            {"frame": 22, "rotation": (0.08, 0, 0)},
            {"frame": 28, "rotation": head_rotation},
        ],
    )
    for pivot, direction in (
        (rear_left, 1),
        (rear_right, 1),
        (front_left, -1),
        (front_right, -1),
    ):
        create_clip(
            pivot,
            "Frog_Hop",
            28,
            [
                {"frame": 1, "rotation": (0, 0, 0)},
                {"frame": 6, "rotation": (direction * 0.46, 0, 0)},
                {"frame": 13, "rotation": (-direction * 0.34, 0, 0)},
                {"frame": 22, "rotation": (direction * 0.2, 0, 0)},
                {"frame": 28, "rotation": (0, 0, 0)},
            ],
        )

    create_clip(
        throat,
        "Frog_Croak",
        36,
        [
            {"frame": 1, "scale": throat_scale},
            {"frame": 8, "scale": (1.16, 1.22, 1.14)},
            {"frame": 17, "scale": (1.42, 1.58, 1.38)},
            {"frame": 26, "scale": (1.3, 1.42, 1.28)},
            {"frame": 36, "scale": throat_scale},
        ],
    )
    create_clip(
        body,
        "Frog_Croak",
        36,
        [
            {"frame": 1, "scale": body_scale},
            {"frame": 17, "scale": (1.025, 1.015, 1.045)},
            {"frame": 36, "scale": body_scale},
        ],
    )
    create_clip(
        head,
        "Frog_Croak",
        36,
        [
            {"frame": 1, "rotation": head_rotation},
            {"frame": 17, "rotation": (-0.055, 0, 0)},
            {"frame": 36, "rotation": head_rotation},
        ],
    )


def create_frog(output_dir: Path) -> None:
    reset_scene()
    moss = material("Material.Frog.MossGreen", (0.28, 0.48, 0.19, 1))
    moss_light = material(
        "Material.Frog.MossLight", (0.49, 0.66, 0.25, 1)
    )
    moss_dark = material(
        "Material.Frog.MossDark", (0.13, 0.27, 0.12, 1)
    )
    throat_color = material(
        "Material.Frog.ThroatGold", (0.78, 0.72, 0.34, 1)
    )
    charcoal = material(
        "Material.Frog.Charcoal", (0.018, 0.025, 0.016, 1), roughness=0.68
    )
    eye_glint = material(
        "Material.Frog.EyeGlint", (0.96, 0.93, 0.72, 1), roughness=0.45
    )

    root = empty("Frog_Root", (0, 0, 0))
    body_pivot = empty("Frog_BodyPivot", (0, -0.05, 0.28))
    head_pivot = empty("Frog_HeadPivot", (0, 0.3, 0.36))
    throat_pivot = empty("Frog_ThroatPivot", (0, 0.44, 0.24))
    rear_left_pivot = empty("Frog_RearLegPivot_L", (-0.28, -0.16, 0.22))
    rear_right_pivot = empty("Frog_RearLegPivot_R", (0.28, -0.16, 0.22))
    front_left_pivot = empty("Frog_FrontLegPivot_L", (-0.2, 0.28, 0.2))
    front_right_pivot = empty("Frog_FrontLegPivot_R", (0.2, 0.28, 0.2))

    body = add_ico_sphere(
        "Frog_Body", (0, -0.08, 0.3), (0.39, 0.48, 0.25), moss
    )
    belly = add_ico_sphere(
        "Frog_Belly", (0, 0.11, 0.23), (0.29, 0.3, 0.14), moss_light
    )
    head = add_ico_sphere(
        "Frog_Head", (0, 0.33, 0.39), (0.34, 0.29, 0.22), moss
    )
    muzzle = add_ico_sphere(
        "Frog_Muzzle", (0, 0.52, 0.34), (0.27, 0.12, 0.1), moss_light
    )
    throat = add_ico_sphere(
        "Frog_Throat", (0, 0.47, 0.24), (0.22, 0.12, 0.14), throat_color
    )

    eye_left = add_ico_sphere(
        "Frog_Eye_L", (-0.19, 0.48, 0.52), (0.105, 0.095, 0.105), moss_light
    )
    eye_right = add_ico_sphere(
        "Frog_Eye_R", (0.19, 0.48, 0.52), (0.105, 0.095, 0.105), moss_light
    )
    pupil_left = add_ico_sphere(
        "Frog_Pupil_L", (-0.19, 0.557, 0.525), (0.048, 0.025, 0.059), charcoal
    )
    pupil_right = add_ico_sphere(
        "Frog_Pupil_R", (0.19, 0.557, 0.525), (0.048, 0.025, 0.059), charcoal
    )
    glint_left = add_ico_sphere(
        "Frog_EyeGlint_L", (-0.207, 0.574, 0.553), (0.014, 0.009, 0.015), eye_glint, subdivisions=1
    )
    glint_right = add_ico_sphere(
        "Frog_EyeGlint_R", (0.173, 0.574, 0.553), (0.014, 0.009, 0.015), eye_glint, subdivisions=1
    )
    eyelid_left = add_ico_sphere(
        "Frog_Eyelid_L", (-0.19, 0.563, 0.615), (0.112, 0.028, 0.035), moss
    )
    eyelid_right = add_ico_sphere(
        "Frog_Eyelid_R", (0.19, 0.563, 0.615), (0.112, 0.028, 0.035), moss
    )

    rear_thigh_left = add_ico_sphere(
        "Frog_RearThigh_L", (-0.31, -0.18, 0.23), (0.24, 0.3, 0.17), moss_dark
    )
    rear_thigh_right = add_ico_sphere(
        "Frog_RearThigh_R", (0.31, -0.18, 0.23), (0.24, 0.3, 0.17), moss_dark
    )
    rear_foot_left = add_cube(
        "Frog_RearFoot_L", (-0.36, -0.39, 0.09), (0.22, 0.34, 0.1), moss_light
    )
    rear_foot_right = add_cube(
        "Frog_RearFoot_R", (0.36, -0.39, 0.09), (0.22, 0.34, 0.1), moss_light
    )

    front_arm_left = add_cylinder(
        "Frog_FrontArm_L",
        (-0.2, 0.34, 0.16),
        0.055,
        0.28,
        moss,
        rotation=(-math.radians(55), 0, 0),
    )
    front_arm_right = add_cylinder(
        "Frog_FrontArm_R",
        (0.2, 0.34, 0.16),
        0.055,
        0.28,
        moss,
        rotation=(-math.radians(55), 0, 0),
    )
    front_toes_left = join_objects(
        [
            add_cube(
                f"Frog_FrontToe_L_{index}",
                (-0.245 + index * 0.045, 0.48, 0.065),
                (0.035, 0.17, 0.035),
                moss_light,
                rotation=(0, 0, (index - 1) * 0.18),
            )
            for index in range(3)
        ],
        "Frog_FrontFoot_L",
    )
    front_toes_right = join_objects(
        [
            add_cube(
                f"Frog_FrontToe_R_{index}",
                (0.155 + index * 0.045, 0.48, 0.065),
                (0.035, 0.17, 0.035),
                moss_light,
                rotation=(0, 0, (index - 1) * 0.18),
            )
            for index in range(3)
        ],
        "Frog_FrontFoot_R",
    )

    spots = join_objects(
        [
            add_ico_sphere(
                f"Frog_Spot_{index}", location, scale, moss_dark, subdivisions=1
            )
            for index, (location, scale) in enumerate(
                [
                    ((-0.17, -0.22, 0.49), (0.055, 0.04, 0.02)),
                    ((0.14, -0.28, 0.47), (0.045, 0.035, 0.018)),
                    ((-0.06, -0.4, 0.42), (0.038, 0.03, 0.016)),
                ]
            )
        ],
        "Frog_BackSpots",
    )

    for pivot in (
        body_pivot,
        head_pivot,
        throat_pivot,
        rear_left_pivot,
        rear_right_pivot,
        front_left_pivot,
        front_right_pivot,
    ):
        parent_keep_transform(pivot, root)

    for obj in (body, belly, spots):
        parent_keep_transform(obj, body_pivot)
    for obj in (
        head,
        muzzle,
        eye_left,
        eye_right,
        pupil_left,
        pupil_right,
        glint_left,
        glint_right,
        eyelid_left,
        eyelid_right,
    ):
        parent_keep_transform(obj, head_pivot)
    parent_keep_transform(throat, throat_pivot)
    for obj in (rear_thigh_left, rear_foot_left):
        parent_keep_transform(obj, rear_left_pivot)
    for obj in (rear_thigh_right, rear_foot_right):
        parent_keep_transform(obj, rear_right_pivot)
    for obj in (front_arm_left, front_toes_left):
        parent_keep_transform(obj, front_left_pivot)
    for obj in (front_arm_right, front_toes_right):
        parent_keep_transform(obj, front_right_pivot)

    parts = {
        "body_pivot": body_pivot,
        "head_pivot": head_pivot,
        "throat_pivot": throat_pivot,
        "eyelid_left": eyelid_left,
        "eyelid_right": eyelid_right,
        "front_left_pivot": front_left_pivot,
        "front_right_pivot": front_right_pivot,
        "rear_left_pivot": rear_left_pivot,
        "rear_right_pivot": rear_right_pivot,
    }
    create_animations(parts)

    expected_names = [
        "Frog_Root",
        "Frog_BodyPivot",
        "Frog_HeadPivot",
        "Frog_ThroatPivot",
        "Frog_RearLegPivot_L",
        "Frog_RearLegPivot_R",
        "Frog_FrontLegPivot_L",
        "Frog_FrontLegPivot_R",
        "Frog_Body",
        "Frog_Belly",
        "Frog_Head",
        "Frog_Muzzle",
        "Frog_Throat",
        "Frog_Eye_L",
        "Frog_Eye_R",
        "Frog_Pupil_L",
        "Frog_Pupil_R",
        "Frog_EyeGlint_L",
        "Frog_EyeGlint_R",
        "Frog_Eyelid_L",
        "Frog_Eyelid_R",
        "Frog_RearThigh_L",
        "Frog_RearThigh_R",
        "Frog_RearFoot_L",
        "Frog_RearFoot_R",
        "Frog_FrontArm_L",
        "Frog_FrontArm_R",
        "Frog_FrontFoot_L",
        "Frog_FrontFoot_R",
        "Frog_BackSpots",
    ]
    actual_names = {obj.name for obj in bpy.context.scene.objects}
    missing = sorted(set(expected_names) - actual_names)
    unexpected = sorted(actual_names - set(expected_names))
    if missing or unexpected:
        raise RuntimeError(
            f"Unexpected Frog.blend objects; missing={missing}, unexpected={unexpected}"
        )

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "Frog.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path), compress=True)
    print(f"Saved {output_path}")


if __name__ == "__main__":
    create_frog(parse_args().output_dir)
