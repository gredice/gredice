#!/usr/bin/env python3
"""Generate the original Gredice squirrel model and animation clips.

Run with Blender, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python assets/scripts/generate-squirrel.py \
      -- --output assets/game-assets/Squirrel.blend

The model is built entirely from Blender primitives. Public wildlife references
are used only for broad Eurasian red-squirrel anatomy and ground-motion cues;
no third-party geometry, textures, or animation data are imported.
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


def animate_object(
    clip_name: str,
    obj: bpy.types.Object,
    frames: Iterable[
        tuple[
            int,
            tuple[float, float, float] | None,
            tuple[float, float, float] | None,
            tuple[float, float, float] | None,
        ]
    ],
) -> None:
    base_location = obj.location.copy()
    base_rotation = obj.rotation_euler.copy()
    base_scale = obj.scale.copy()
    action = bpy.data.actions.new(f"{clip_name}_{obj.name}")
    obj.animation_data_create()
    obj.animation_data.action = action

    for frame, location_offset, rotation_offset, scale_factor in frames:
        obj.location = base_location
        obj.rotation_euler = base_rotation
        obj.scale = base_scale
        if location_offset:
            obj.location.x += location_offset[0]
            obj.location.y += location_offset[1]
            obj.location.z += location_offset[2]
        if rotation_offset:
            obj.rotation_euler.x += rotation_offset[0]
            obj.rotation_euler.y += rotation_offset[1]
            obj.rotation_euler.z += rotation_offset[2]
        if scale_factor:
            obj.scale.x *= scale_factor[0]
            obj.scale.y *= scale_factor[1]
            obj.scale.z *= scale_factor[2]
        obj.keyframe_insert(data_path="location", frame=frame)
        obj.keyframe_insert(data_path="rotation_euler", frame=frame)
        obj.keyframe_insert(data_path="scale", frame=frame)

    obj.animation_data.action = None
    track = obj.animation_data.nla_tracks.new()
    track.name = clip_name
    first_frame = min(frame for frame, *_ in frames)
    strip = track.strips.new(clip_name, first_frame, action)
    strip.name = clip_name
    strip.extrapolation = "HOLD"
    obj.location = base_location
    obj.rotation_euler = base_rotation
    obj.scale = base_scale


def cycle_frames(
    values: Iterable[
        tuple[
            int,
            tuple[float, float, float] | None,
            tuple[float, float, float] | None,
            tuple[float, float, float] | None,
        ]
    ],
) -> list[
    tuple[
        int,
        tuple[float, float, float] | None,
        tuple[float, float, float] | None,
        tuple[float, float, float] | None,
    ]
]:
    return list(values)


def build_animations(rig: dict[str, bpy.types.Object]) -> None:
    body = rig["body"]
    head = rig["head"]
    ear_left = rig["ear_left"]
    ear_right = rig["ear_right"]
    tail_base = rig["tail_base"]
    tail_mid = rig["tail_mid"]
    tail_tip = rig["tail_tip"]
    leg_fl = rig["leg_fl"]
    leg_fr = rig["leg_fr"]
    leg_rl = rig["leg_rl"]
    leg_rr = rig["leg_rr"]

    scamper_frames = (1, 7, 13, 19, 25)
    animate_object(
        "Squirrel_Scamper",
        body,
        cycle_frames(
            (
                (frame, (0, 0, 0.035 if index % 2 else 0), (0.03 if index % 2 else -0.02, 0, 0), None)
                for index, frame in enumerate(scamper_frames)
            )
        ),
    )
    for pivot, phase in ((leg_fl, 1), (leg_rr, 1), (leg_fr, -1), (leg_rl, -1)):
        animate_object(
            "Squirrel_Scamper",
            pivot,
            cycle_frames(
                (
                    (frame, None, (phase * (0.42 if index % 2 else -0.42), 0, 0), None)
                    for index, frame in enumerate(scamper_frames)
                )
            ),
        )
    animate_object(
        "Squirrel_Scamper",
        tail_base,
        [(1, None, (0.06, 0, -0.1), None), (13, None, (-0.04, 0, 0.12), None), (25, None, (0.06, 0, -0.1), None)],
    )
    animate_object(
        "Squirrel_Scamper",
        tail_mid,
        [(1, None, (0, 0.08, 0), None), (13, None, (0, -0.1, 0), None), (25, None, (0, 0.08, 0), None)],
    )

    bound_frames = [
        (1, (0, 0, 0), (-0.08, 0, 0), None),
        (7, (0, 0, 0.12), (0.13, 0, 0), None),
        (13, (0, 0, 0.02), (-0.11, 0, 0), None),
        (19, (0, 0, 0.13), (0.14, 0, 0), None),
        (25, (0, 0, 0), (-0.08, 0, 0), None),
    ]
    animate_object("Squirrel_Bound", body, bound_frames)
    for pivot in (leg_fl, leg_fr):
        animate_object(
            "Squirrel_Bound",
            pivot,
            [(1, None, (-0.42, 0, 0), None), (7, None, (0.48, 0, 0), None), (13, None, (-0.42, 0, 0), None), (19, None, (0.48, 0, 0), None), (25, None, (-0.42, 0, 0), None)],
        )
    for pivot in (leg_rl, leg_rr):
        animate_object(
            "Squirrel_Bound",
            pivot,
            [(1, None, (0.5, 0, 0), None), (7, None, (-0.5, 0, 0), None), (13, None, (0.5, 0, 0), None), (19, None, (-0.5, 0, 0), None), (25, None, (0.5, 0, 0), None)],
        )
    animate_object(
        "Squirrel_Bound",
        tail_base,
        [(1, None, (-0.22, 0, 0), None), (7, None, (0.16, 0, 0), None), (13, None, (-0.24, 0, 0), None), (19, None, (0.18, 0, 0), None), (25, None, (-0.22, 0, 0), None)],
    )

    sit_body = [(1, (0, -0.03, 0.1), (0.48, 0, 0), None), (33, (0, -0.03, 0.115), (0.5, 0, 0), None), (65, (0, -0.03, 0.1), (0.48, 0, 0), None)]
    animate_object("Squirrel_Sit", body, sit_body)
    animate_object(
        "Squirrel_Sit",
        head,
        [(1, (0, 0.02, 0.02), (-0.35, 0, 0), None), (33, (0, 0.02, 0.025), (-0.3, 0, 0.04), None), (65, (0, 0.02, 0.02), (-0.35, 0, 0), None)],
    )
    for pivot, roll in ((leg_fl, -0.1), (leg_fr, 0.1)):
        animate_object(
            "Squirrel_Sit",
            pivot,
            [(1, (0, 0.02, 0.18), (-0.9, 0, roll), None), (65, (0, 0.02, 0.18), (-0.9, 0, roll), None)],
        )
    for pivot in (leg_rl, leg_rr):
        animate_object(
            "Squirrel_Sit",
            pivot,
            [(1, (0, -0.03, -0.03), (0.32, 0, 0), None), (65, (0, -0.03, -0.03), (0.32, 0, 0), None)],
        )
    animate_object(
        "Squirrel_Sit",
        tail_base,
        [(1, None, (0.1, 0, -0.06), None), (25, None, (0.16, 0.04, 0.06), None), (45, None, (0.08, -0.04, -0.04), None), (65, None, (0.1, 0, -0.06), None)],
    )
    animate_object(
        "Squirrel_Sit",
        tail_tip,
        [(1, None, (0, 0.08, -0.02), None), (25, None, (0, -0.12, 0.07), None), (45, None, (0, 0.1, -0.05), None), (65, None, (0, 0.08, -0.02), None)],
    )

    animate_object(
        "Squirrel_Forage",
        body,
        [(1, (0, 0.02, -0.035), (-0.14, 0, 0), None), (15, (0, 0.04, -0.05), (-0.2, 0, 0), None), (29, (0, 0.02, -0.035), (-0.14, 0, 0), None), (43, (0, 0.04, -0.05), (-0.2, 0, 0), None), (57, (0, 0.02, -0.035), (-0.14, 0, 0), None)],
    )
    animate_object(
        "Squirrel_Forage",
        head,
        [(1, (0, 0.04, -0.04), (-0.34, 0, -0.07), None), (15, (0, 0.07, -0.1), (-0.5, 0, 0.09), None), (29, (0, 0.04, -0.04), (-0.34, 0, -0.05), None), (43, (0, 0.07, -0.1), (-0.5, 0, 0.08), None), (57, (0, 0.04, -0.04), (-0.34, 0, -0.07), None)],
    )
    animate_object(
        "Squirrel_Forage",
        leg_fl,
        [(1, None, (-0.18, 0, 0), None), (15, None, (0.24, 0, 0), None), (29, None, (-0.18, 0, 0), None), (43, None, (0.24, 0, 0), None), (57, None, (-0.18, 0, 0), None)],
    )
    animate_object(
        "Squirrel_Forage",
        leg_fr,
        [(1, None, (0.24, 0, 0), None), (15, None, (-0.18, 0, 0), None), (29, None, (0.24, 0, 0), None), (43, None, (-0.18, 0, 0), None), (57, None, (0.24, 0, 0), None)],
    )
    animate_object(
        "Squirrel_Forage",
        tail_mid,
        [(1, None, (0, -0.06, -0.06), None), (19, None, (0, 0.1, 0.07), None), (37, None, (0, -0.09, -0.03), None), (57, None, (0, -0.06, -0.06), None)],
    )

    animate_object(
        "Squirrel_Pause",
        body,
        [(1, None, (0.04, 0, 0), None), (37, (0, 0, 0.012), (0.06, 0, 0), None), (73, None, (0.04, 0, 0), None)],
    )
    animate_object(
        "Squirrel_Pause",
        head,
        [(1, None, (0, 0, -0.16), None), (19, None, (-0.05, 0, 0.17), None), (37, None, (0.02, 0, 0.04), None), (55, None, (-0.03, 0, -0.12), None), (73, None, (0, 0, -0.16), None)],
    )
    animate_object(
        "Squirrel_Pause",
        ear_left,
        [(1, None, (0, 0.03, 0), None), (19, None, (0, -0.13, 0.04), None), (37, None, (0, 0.05, 0), None), (73, None, (0, 0.03, 0), None)],
    )
    animate_object(
        "Squirrel_Pause",
        ear_right,
        [(1, None, (0, -0.03, 0), None), (19, None, (0, 0.12, -0.04), None), (37, None, (0, -0.05, 0), None), (73, None, (0, -0.03, 0), None)],
    )
    animate_object(
        "Squirrel_Pause",
        tail_tip,
        [(1, None, (0, -0.08, -0.05), None), (13, None, (0, 0.18, 0.1), None), (25, None, (0, -0.16, -0.07), None), (49, None, (0, 0.14, 0.04), None), (73, None, (0, -0.08, -0.05), None)],
    )

    flee_frames = (1, 6, 11, 16, 21)
    animate_object(
        "Squirrel_Flee",
        body,
        cycle_frames(
            (
                (frame, (0, 0, 0.15 if index % 2 else 0), (0.17 if index % 2 else -0.13, 0, 0), None)
                for index, frame in enumerate(flee_frames)
            )
        ),
    )
    for pivot, phase in ((leg_fl, 1), (leg_fr, 1), (leg_rl, -1), (leg_rr, -1)):
        animate_object(
            "Squirrel_Flee",
            pivot,
            cycle_frames(
                (
                    (frame, None, (phase * (0.64 if index % 2 else -0.62), 0, 0), None)
                    for index, frame in enumerate(flee_frames)
                )
            ),
        )
    animate_object(
        "Squirrel_Flee",
        tail_base,
        [(1, None, (-0.42, 0, -0.05), None), (11, None, (-0.29, 0, 0.09), None), (21, None, (-0.42, 0, -0.05), None)],
    )
    animate_object(
        "Squirrel_Flee",
        tail_mid,
        [(1, None, (-0.24, -0.08, 0), None), (11, None, (-0.18, 0.11, 0), None), (21, None, (-0.24, -0.08, 0), None)],
    )


def create_squirrel(output_path: Path) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene.render.film_transparent = True
    scene.world = bpy.data.worlds.new("Gredice World")
    scene.world.color = (0.055, 0.07, 0.06)
    scene["generated_by"] = "assets/scripts/generate-squirrel.py"
    scene["asset_name"] = "Squirrel"
    scene["gameplay_role"] = "Environment-spawned ground animal; never purchasable"
    scene["model_brief"] = "Small base-centered actor, 0.75-block runtime footprint, default-camera readability, horizontal terrain navigation only"
    scene["reference_notes"] = "Eurasian red squirrel: compact body, tufted ears, long tail; ground travel alternates bounds with alert upright sniffing; tail flag/twitch cues caution"
    scene["reference_sources"] = "animaldiversity.org/accounts/Sciurus_vulgaris/; wildlifeonline.me.uk/animals/article/squirrel-behaviour-locomotion; roam.macewan.ca/items/577cd127-cec4-4400-ab38-c32ae0a18ec5"
    scene["originality_note"] = "Original Gredice procedural primitive model; no external meshes, textures, rigs, or motion were imported"
    scene.render.fps = 24
    scene.frame_start = 1
    scene.frame_end = 73

    rust = material("Material.Squirrel.RustFur", (0.68, 0.24, 0.08, 1))
    warm_rust = material("Material.Squirrel.WarmFur", (0.83, 0.38, 0.12, 1))
    shadow_rust = material("Material.Squirrel.ShadowFur", (0.38, 0.12, 0.045, 1))
    cream = material("Material.Squirrel.CreamFur", (0.9, 0.75, 0.5, 1))
    pink = material("Material.Squirrel.EarPink", (0.72, 0.31, 0.27, 1))
    charcoal = material("Material.Squirrel.Charcoal", (0.025, 0.02, 0.017, 1), roughness=0.62)
    glint = material("Material.Squirrel.EyeGlint", (1, 0.94, 0.75, 1), roughness=0.38)

    root = empty("Squirrel_Root", (0, 0, 0))
    body_pivot = empty("Squirrel_BodyPivot", (0, -0.02, 0.48))
    head_pivot = empty("Squirrel_HeadPivot", (0, 0.35, 0.66))
    ear_left_pivot = empty("Squirrel_EarPivot_L", (-0.18, 0.36, 0.88))
    ear_right_pivot = empty("Squirrel_EarPivot_R", (0.18, 0.36, 0.88))
    leg_pivots = {
        "FL": empty("Squirrel_LegPivot_FL", (-0.19, 0.25, 0.3)),
        "FR": empty("Squirrel_LegPivot_FR", (0.19, 0.25, 0.3)),
        "RL": empty("Squirrel_LegPivot_RL", (-0.22, -0.27, 0.3)),
        "RR": empty("Squirrel_LegPivot_RR", (0.22, -0.27, 0.3)),
    }
    tail_base_pivot = empty("Squirrel_TailPivot_Base", (0, -0.34, 0.55))
    tail_mid_pivot = empty("Squirrel_TailPivot_Mid", (0, -0.55, 0.78))
    tail_tip_pivot = empty("Squirrel_TailPivot_Tip", (0, -0.54, 1.08))

    parent_keep_transform(body_pivot, root)
    parent_keep_transform(head_pivot, body_pivot)
    parent_keep_transform(ear_left_pivot, head_pivot)
    parent_keep_transform(ear_right_pivot, head_pivot)
    for pivot in leg_pivots.values():
        parent_keep_transform(pivot, body_pivot)
    parent_keep_transform(tail_base_pivot, body_pivot)
    parent_keep_transform(tail_mid_pivot, tail_base_pivot)
    parent_keep_transform(tail_tip_pivot, tail_mid_pivot)

    body = add_ico_sphere("Squirrel_Body", (0, -0.03, 0.5), (0.3, 0.43, 0.34), rust)
    chest = add_ico_sphere("Squirrel_Chest", (0, 0.22, 0.49), (0.23, 0.27, 0.27), cream)
    haunch_left = add_ico_sphere("Squirrel_Haunch_L", (-0.21, -0.24, 0.39), (0.19, 0.24, 0.22), warm_rust, subdivisions=1)
    haunch_right = add_ico_sphere("Squirrel_Haunch_R", (0.21, -0.24, 0.39), (0.19, 0.24, 0.22), warm_rust, subdivisions=1)
    head = add_ico_sphere("Squirrel_Head", (0, 0.37, 0.7), (0.27, 0.27, 0.27), rust)
    muzzle = add_ico_sphere("Squirrel_Muzzle", (0, 0.61, 0.64), (0.18, 0.17, 0.14), cream)
    nose = add_ico_sphere("Squirrel_Nose", (0, 0.76, 0.66), (0.07, 0.055, 0.055), charcoal, subdivisions=1)
    cheek_left = add_ico_sphere("Squirrel_Cheek_L", (-0.16, 0.53, 0.62), (0.11, 0.1, 0.09), cream, subdivisions=1)
    cheek_right = add_ico_sphere("Squirrel_Cheek_R", (0.16, 0.53, 0.62), (0.11, 0.1, 0.09), cream, subdivisions=1)
    eye_left = add_ico_sphere("Squirrel_Eye_L", (-0.19, 0.56, 0.77), (0.068, 0.045, 0.072), charcoal)
    eye_right = add_ico_sphere("Squirrel_Eye_R", (0.19, 0.56, 0.77), (0.068, 0.045, 0.072), charcoal)
    glint_left = add_ico_sphere("Squirrel_EyeGlint_L", (-0.212, 0.593, 0.797), (0.018, 0.012, 0.018), glint, subdivisions=1)
    glint_right = add_ico_sphere("Squirrel_EyeGlint_R", (0.212, 0.593, 0.797), (0.018, 0.012, 0.018), glint, subdivisions=1)

    ear_left = add_cone("Squirrel_Ear_L", (-0.18, 0.38, 0.96), 0.13, 0.018, 0.32, rust, rotation=(math.radians(-6), math.radians(-11), math.radians(7)))
    ear_right = add_cone("Squirrel_Ear_R", (0.18, 0.38, 0.96), 0.13, 0.018, 0.32, rust, rotation=(math.radians(-6), math.radians(11), math.radians(-7)))
    inner_ear_left = add_cone("Squirrel_InnerEar_L", (-0.18, 0.4, 0.95), 0.075, 0.012, 0.23, pink, rotation=(math.radians(-6), math.radians(-11), math.radians(7)))
    inner_ear_right = add_cone("Squirrel_InnerEar_R", (0.18, 0.4, 0.95), 0.075, 0.012, 0.23, pink, rotation=(math.radians(-6), math.radians(11), math.radians(-7)))
    tuft_left = add_cone("Squirrel_EarTuft_L", (-0.205, 0.36, 1.13), 0.055, 0, 0.2, shadow_rust, rotation=(0, math.radians(-8), math.radians(8)), vertices=6)
    tuft_right = add_cone("Squirrel_EarTuft_R", (0.205, 0.36, 1.13), 0.055, 0, 0.2, shadow_rust, rotation=(0, math.radians(8), math.radians(-8)), vertices=6)

    legs: list[bpy.types.Object] = []
    paws: list[bpy.types.Object] = []
    for key, pivot in leg_pivots.items():
        x = -0.19 if key.endswith("L") else 0.19
        front = key.startswith("F")
        y = 0.25 if front else -0.28
        leg = add_cylinder(
            f"Squirrel_Leg_{key}",
            (x, y, 0.23 if front else 0.25),
            0.055 if front else 0.075,
            0.25 if front else 0.29,
            shadow_rust,
            rotation=(math.radians(8 if front else -8), 0, 0),
        )
        paw = add_ico_sphere(
            f"Squirrel_Paw_{key}",
            (x, y + 0.055, 0.085),
            (0.075 if front else 0.1, 0.13 if front else 0.16, 0.065),
            cream if front else shadow_rust,
            subdivisions=1,
        )
        parent_keep_transform(leg, pivot)
        parent_keep_transform(paw, pivot)
        legs.append(leg)
        paws.append(paw)

    tail_base = add_ico_sphere("Squirrel_Tail_Base", (0, -0.48, 0.69), (0.18, 0.28, 0.22), shadow_rust, rotation=(math.radians(-24), 0, 0))
    tail_mid = add_ico_sphere("Squirrel_Tail_Mid", (0, -0.61, 0.91), (0.24, 0.34, 0.32), rust, rotation=(math.radians(-7), 0, 0))
    tail_crown = add_ico_sphere("Squirrel_Tail_Crown", (0, -0.55, 1.19), (0.3, 0.3, 0.38), warm_rust, rotation=(math.radians(13), 0, 0))
    tail_tip = add_ico_sphere("Squirrel_Tail_Tip", (0, -0.36, 1.37), (0.22, 0.26, 0.27), cream, rotation=(math.radians(32), 0, 0))

    for obj in (body, chest, haunch_left, haunch_right):
        parent_keep_transform(obj, body_pivot)
    for obj in (head, muzzle, nose, cheek_left, cheek_right, eye_left, eye_right, glint_left, glint_right):
        parent_keep_transform(obj, head_pivot)
    for obj in (ear_left, inner_ear_left, tuft_left):
        parent_keep_transform(obj, ear_left_pivot)
    for obj in (ear_right, inner_ear_right, tuft_right):
        parent_keep_transform(obj, ear_right_pivot)
    parent_keep_transform(tail_base, tail_base_pivot)
    parent_keep_transform(tail_mid, tail_mid_pivot)
    parent_keep_transform(tail_crown, tail_tip_pivot)
    parent_keep_transform(tail_tip, tail_tip_pivot)

    # Blender +Y exports as runtime -Z. Rotate the whole rig so the muzzle and
    # authored gait face runtime +Z, matching the existing animal convention.
    root.rotation_euler.z = math.pi

    build_animations(
        {
            "body": body_pivot,
            "head": head_pivot,
            "ear_left": ear_left_pivot,
            "ear_right": ear_right_pivot,
            "tail_base": tail_base_pivot,
            "tail_mid": tail_mid_pivot,
            "tail_tip": tail_tip_pivot,
            "leg_fl": leg_pivots["FL"],
            "leg_fr": leg_pivots["FR"],
            "leg_rl": leg_pivots["RL"],
            "leg_rr": leg_pivots["RR"],
        }
    )

    expected_names = {
        "Squirrel_Root",
        "Squirrel_BodyPivot",
        "Squirrel_HeadPivot",
        "Squirrel_EarPivot_L",
        "Squirrel_EarPivot_R",
        "Squirrel_LegPivot_FL",
        "Squirrel_LegPivot_FR",
        "Squirrel_LegPivot_RL",
        "Squirrel_LegPivot_RR",
        "Squirrel_TailPivot_Base",
        "Squirrel_TailPivot_Mid",
        "Squirrel_TailPivot_Tip",
        "Squirrel_Body",
        "Squirrel_Chest",
        "Squirrel_Haunch_L",
        "Squirrel_Haunch_R",
        "Squirrel_Head",
        "Squirrel_Muzzle",
        "Squirrel_Nose",
        "Squirrel_Cheek_L",
        "Squirrel_Cheek_R",
        "Squirrel_Eye_L",
        "Squirrel_Eye_R",
        "Squirrel_EyeGlint_L",
        "Squirrel_EyeGlint_R",
        "Squirrel_Ear_L",
        "Squirrel_Ear_R",
        "Squirrel_InnerEar_L",
        "Squirrel_InnerEar_R",
        "Squirrel_EarTuft_L",
        "Squirrel_EarTuft_R",
        "Squirrel_Leg_FL",
        "Squirrel_Leg_FR",
        "Squirrel_Leg_RL",
        "Squirrel_Leg_RR",
        "Squirrel_Paw_FL",
        "Squirrel_Paw_FR",
        "Squirrel_Paw_RL",
        "Squirrel_Paw_RR",
        "Squirrel_Tail_Base",
        "Squirrel_Tail_Mid",
        "Squirrel_Tail_Crown",
        "Squirrel_Tail_Tip",
    }
    actual_names = {obj.name for obj in scene.objects}
    if actual_names != expected_names:
        raise RuntimeError(
            f"Unexpected Squirrel objects; missing={sorted(expected_names - actual_names)}, unexpected={sorted(actual_names - expected_names)}"
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path), compress=True)
    print(f"Saved {output_path}")


def main() -> None:
    args = parse_args()
    create_squirrel(args.output.resolve())


if __name__ == "__main__":
    main()
