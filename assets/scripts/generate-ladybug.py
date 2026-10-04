#!/usr/bin/env python3
"""Generate the original low-poly Gredice Ladybug source asset.

Run with Blender, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python assets/scripts/generate-ladybug.py \
      -- --output assets/game-assets/Ladybug.blend
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


def material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    roughness: float = 0.78,
    metallic: float = 0,
) -> bpy.types.Material:
    linear = (*[srgb_channel_to_linear(channel) for channel in color[:3]], color[3])
    value = bpy.data.materials.new(name)
    value.diffuse_color = linear
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    if shader:
        shader.inputs["Base Color"].default_value = linear
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = metallic
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
    vertices: int = 7,
) -> bpy.types.Object:
    start_vector = Vector(start)
    end_vector = Vector(end)
    direction = end_vector - start_vector
    midpoint = (start_vector + end_vector) * 0.5
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


def join_objects(objects: Iterable[bpy.types.Object], name: str) -> bpy.types.Object:
    values = list(objects)
    if not values:
        raise ValueError(f"Cannot join empty object collection for {name}")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in values:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = values[0]
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


def parent_keep_transform(child: bpy.types.Object, parent: bpy.types.Object) -> None:
    world_matrix = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world_matrix


def create_leg(
    name: str,
    root: tuple[float, float, float],
    knee: tuple[float, float, float],
    foot: tuple[float, float, float],
    value: bpy.types.Material,
) -> bpy.types.Object:
    upper = add_cylinder_between(f"{name}_Upper", root, knee, 0.027, value)
    lower = add_cylinder_between(f"{name}_Lower", knee, foot, 0.023, value)
    toe = add_ico_sphere(f"{name}_Foot", foot, (0.045, 0.065, 0.025), value, subdivisions=1)
    return join_objects([upper, lower, toe], name)


def create_antenna(
    name: str,
    root: tuple[float, float, float],
    elbow: tuple[float, float, float],
    tip: tuple[float, float, float],
    value: bpy.types.Material,
) -> bpy.types.Object:
    base = add_cylinder_between(f"{name}_Base", root, elbow, 0.018, value)
    end = add_cylinder_between(f"{name}_End", elbow, tip, 0.014, value)
    bulb = add_ico_sphere(f"{name}_Tip", tip, (0.03, 0.04, 0.03), value, subdivisions=1)
    return join_objects([base, end, bulb], name)


def create_ladybug(output: Path) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene.world = bpy.data.worlds.new("Gredice World")
    scene.world.color = (0.055, 0.07, 0.06)
    scene["generated_by"] = "assets/scripts/generate-ladybug.py"
    scene["asset_name"] = "Ladybug"
    scene["design_note"] = (
        "Original Gredice low-poly ladybug; authored for isometric readability "
        "with no copied or extracted third-party geometry."
    )

    shell_red = material("Material.Ladybug.ShellRed", (0.82, 0.055, 0.035, 1), roughness=0.7)
    shell_highlight = material(
        "Material.Ladybug.ShellHighlight", (1.0, 0.16, 0.08, 1), roughness=0.62
    )
    charcoal = material("Material.Ladybug.Charcoal", (0.018, 0.022, 0.02, 1), roughness=0.76)
    warm_black = material("Material.Ladybug.WarmBlack", (0.045, 0.035, 0.025, 1), roughness=0.82)
    pronotum_cream = material("Material.Ladybug.PronotumCream", (0.93, 0.82, 0.61, 1), roughness=0.83)
    wing_amber = material(
        "Material.Ladybug.UnderwingAmber", (0.93, 0.55, 0.16, 0.78), roughness=0.52
    )

    root = empty("Ladybug_Root", (0, 0, 0))
    body_pivot = empty("Ladybug_BodyPivot", (0, 0, 0.23))
    head_pivot = empty("Ladybug_HeadPivot", (0, 0.43, 0.24))
    elytra_left_pivot = empty("Ladybug_ElytraPivot_L", (-0.025, -0.05, 0.32))
    elytra_right_pivot = empty("Ladybug_ElytraPivot_R", (0.025, -0.05, 0.32))
    wing_left_pivot = empty("Ladybug_WingPivot_L", (-0.035, -0.04, 0.285))
    wing_right_pivot = empty("Ladybug_WingPivot_R", (0.035, -0.04, 0.285))
    antenna_left_pivot = empty("Ladybug_AntennaPivot_L", (-0.13, 0.55, 0.29))
    antenna_right_pivot = empty("Ladybug_AntennaPivot_R", (0.13, 0.55, 0.29))

    leg_pivots: dict[str, bpy.types.Object] = {}
    for side in ("L", "R"):
        sign = -1 if side == "L" else 1
        for index, y in enumerate((0.22, -0.02, -0.26), start=1):
            leg_pivots[f"{side}{index}"] = empty(
                f"Ladybug_LegPivot_{side}{index}", (sign * 0.28, y, 0.15)
            )

    parent_keep_transform(body_pivot, root)
    for pivot in (
        head_pivot,
        elytra_left_pivot,
        elytra_right_pivot,
        wing_left_pivot,
        wing_right_pivot,
        antenna_left_pivot,
        antenna_right_pivot,
    ):
        parent_keep_transform(pivot, body_pivot)
    for pivot in leg_pivots.values():
        parent_keep_transform(pivot, body_pivot)

    abdomen = add_ico_sphere(
        "Ladybug_Abdomen", (0, -0.04, 0.25), (0.4, 0.52, 0.25), warm_black
    )
    thorax = add_ico_sphere(
        "Ladybug_Thorax", (0, 0.34, 0.25), (0.32, 0.3, 0.24), charcoal
    )
    head = add_ico_sphere(
        "Ladybug_Head", (0, 0.56, 0.23), (0.245, 0.22, 0.2), charcoal
    )
    eye_left = add_ico_sphere(
        "Ladybug_Eye_L", (-0.15, 0.735, 0.285), (0.055, 0.035, 0.055), pronotum_cream, subdivisions=1
    )
    eye_right = add_ico_sphere(
        "Ladybug_Eye_R", (0.15, 0.735, 0.285), (0.055, 0.035, 0.055), pronotum_cream, subdivisions=1
    )
    pronotum_left = add_ico_sphere(
        "Ladybug_PronotumSpot_L", (-0.16, 0.4, 0.41), (0.085, 0.075, 0.025), pronotum_cream, subdivisions=1
    )
    pronotum_right = add_ico_sphere(
        "Ladybug_PronotumSpot_R", (0.16, 0.4, 0.41), (0.085, 0.075, 0.025), pronotum_cream, subdivisions=1
    )
    parent_keep_transform(abdomen, body_pivot)
    parent_keep_transform(thorax, body_pivot)
    for obj in (head, eye_left, eye_right):
        parent_keep_transform(obj, head_pivot)
    parent_keep_transform(pronotum_left, body_pivot)
    parent_keep_transform(pronotum_right, body_pivot)

    elytra_left = add_ico_sphere(
        "Ladybug_Elytra_L", (-0.19, -0.055, 0.39), (0.255, 0.48, 0.235), shell_red
    )
    elytra_right = add_ico_sphere(
        "Ladybug_Elytra_R", (0.19, -0.055, 0.39), (0.255, 0.48, 0.235), shell_red
    )
    highlight_left = add_ico_sphere(
        "Ladybug_ElytraHighlight_L", (-0.245, 0.08, 0.585), (0.075, 0.17, 0.025), shell_highlight, subdivisions=1
    )
    highlight_right = add_ico_sphere(
        "Ladybug_ElytraHighlight_R", (0.245, 0.08, 0.585), (0.075, 0.17, 0.025), shell_highlight, subdivisions=1
    )
    for obj in (elytra_left, highlight_left):
        parent_keep_transform(obj, elytra_left_pivot)
    for obj in (elytra_right, highlight_right):
        parent_keep_transform(obj, elytra_right_pivot)

    spot_specs = {
        "L1": (-0.18, 0.16, 0.604, 0.085),
        "L2": (-0.28, -0.08, 0.61, 0.09),
        "L3": (-0.16, -0.32, 0.535, 0.082),
        "R1": (0.18, 0.16, 0.604, 0.085),
        "R2": (0.28, -0.08, 0.61, 0.09),
        "R3": (0.16, -0.32, 0.535, 0.082),
    }
    for key, (x, y, z, radius) in spot_specs.items():
        spot = add_ico_sphere(
            f"Ladybug_ElytraSpot_{key}",
            (x, y, z),
            (radius, radius * 1.05, 0.027),
            charcoal,
            subdivisions=1,
        )
        parent_keep_transform(
            spot, elytra_left_pivot if key.startswith("L") else elytra_right_pivot
        )

    wing_left = add_ico_sphere(
        "Ladybug_Underwing_L", (-0.14, -0.06, 0.33), (0.23, 0.43, 0.035), wing_amber
    )
    wing_right = add_ico_sphere(
        "Ladybug_Underwing_R", (0.14, -0.06, 0.33), (0.23, 0.43, 0.035), wing_amber
    )
    parent_keep_transform(wing_left, wing_left_pivot)
    parent_keep_transform(wing_right, wing_right_pivot)

    antenna_left = create_antenna(
        "Ladybug_Antenna_L",
        (-0.13, 0.56, 0.3),
        (-0.23, 0.71, 0.34),
        (-0.3, 0.82, 0.31),
        charcoal,
    )
    antenna_right = create_antenna(
        "Ladybug_Antenna_R",
        (0.13, 0.56, 0.3),
        (0.23, 0.71, 0.34),
        (0.3, 0.82, 0.31),
        charcoal,
    )
    parent_keep_transform(antenna_left, antenna_left_pivot)
    parent_keep_transform(antenna_right, antenna_right_pivot)

    for side in ("L", "R"):
        sign = -1 if side == "L" else 1
        for index, y in enumerate((0.22, -0.02, -0.26), start=1):
            sweep = 0.12 if index == 1 else (-0.02 if index == 2 else -0.13)
            leg = create_leg(
                f"Ladybug_Leg_{side}{index}",
                (sign * 0.27, y, 0.18),
                (sign * 0.43, y + sweep, 0.115),
                (sign * 0.55, y + sweep * 1.45, 0.055),
                charcoal,
            )
            parent_keep_transform(leg, leg_pivots[f"{side}{index}"])

    # Blender +Y exports as runtime -Z. Match the existing animal rigs so the
    # head faces runtime +Z, the direction used by procedural movement.
    root.rotation_euler.z = math.pi

    expected_names = {
        "Ladybug_Root",
        "Ladybug_BodyPivot",
        "Ladybug_HeadPivot",
        "Ladybug_ElytraPivot_L",
        "Ladybug_ElytraPivot_R",
        "Ladybug_WingPivot_L",
        "Ladybug_WingPivot_R",
        "Ladybug_AntennaPivot_L",
        "Ladybug_AntennaPivot_R",
        "Ladybug_Abdomen",
        "Ladybug_Thorax",
        "Ladybug_Head",
        "Ladybug_Eye_L",
        "Ladybug_Eye_R",
        "Ladybug_PronotumSpot_L",
        "Ladybug_PronotumSpot_R",
        "Ladybug_Elytra_L",
        "Ladybug_Elytra_R",
        "Ladybug_ElytraHighlight_L",
        "Ladybug_ElytraHighlight_R",
        "Ladybug_Underwing_L",
        "Ladybug_Underwing_R",
        "Ladybug_Antenna_L",
        "Ladybug_Antenna_R",
        *(f"Ladybug_ElytraSpot_{side}{index}" for side in ("L", "R") for index in range(1, 4)),
        *(f"Ladybug_LegPivot_{side}{index}" for side in ("L", "R") for index in range(1, 4)),
        *(f"Ladybug_Leg_{side}{index}" for side in ("L", "R") for index in range(1, 4)),
    }
    actual_names = {obj.name for obj in scene.objects}
    if actual_names != expected_names:
        raise RuntimeError(
            f"Unexpected Ladybug objects; missing={sorted(expected_names - actual_names)}, "
            f"unexpected={sorted(actual_names - expected_names)}"
        )

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    print(f"Saved {output}")


if __name__ == "__main__":
    create_ladybug(parse_args().output)
