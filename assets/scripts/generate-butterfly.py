#!/usr/bin/env python3
"""Generate the original low-poly Gredice butterfly source asset.

Run with Blender, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python assets/scripts/generate-butterfly.py \
      -- --output assets/game-assets/Butterfly.blend
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
    roughness: float = 0.78,
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
    apply_transforms(obj)
    assign_material(obj, value)
    return obj


def add_wing_polygon(
    name: str,
    points: list[tuple[float, float]],
    z: float,
    value: bpy.types.Material,
    *,
    thickness: float = 0.018,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata([(x, y, z) for x, y in points], [], [list(range(len(points)))])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    assign_material(obj, value)
    activate(obj)
    bevel_modifier = obj.modifiers.new(name="Wing edge bevel", type="BEVEL")
    bevel_modifier.width = 0.015
    bevel_modifier.segments = 2
    solidify_modifier = obj.modifiers.new(name="Wing thickness", type="SOLIDIFY")
    solidify_modifier.thickness = thickness
    bpy.ops.object.modifier_apply(modifier=bevel_modifier.name)
    bpy.ops.object.modifier_apply(modifier=solidify_modifier.name)
    return obj


def join_objects(
    objects: Iterable[bpy.types.Object], name: str
) -> bpy.types.Object:
    items = list(objects)
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
    bpy.context.view_layer.update()
    world_matrix = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world_matrix
    bpy.context.view_layer.update()


def mirror_points(
    points: list[tuple[float, float]],
) -> list[tuple[float, float]]:
    return [(-x, y) for x, y in points]


def save_asset(output: Path, expected_names: list[str]) -> None:
    present_names = {obj.name for obj in bpy.context.scene.objects}
    missing_names = sorted(set(expected_names) - present_names)
    if missing_names:
        raise RuntimeError(f"Missing generated objects: {', '.join(missing_names)}")

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output.resolve()))
    print(f"Saved {output}")


def create_butterfly(output: Path) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene.world = bpy.data.worlds.new("Gredice World")
    scene.world.color = (0.055, 0.07, 0.06)
    scene["generated_by"] = "assets/scripts/generate-butterfly.py"
    scene["asset_name"] = "Butterfly"
    scene["style"] = "Original Gredice cozy low-poly wildlife"

    charcoal = material("Material.Butterfly.Charcoal", (0.075, 0.055, 0.045, 1))
    body_brown = material("Material.Butterfly.Body", (0.22, 0.12, 0.075, 1))
    body_warm = material("Material.Butterfly.BodyWarm", (0.42, 0.23, 0.1, 1))
    eye_glint = material(
        "Material.Butterfly.EyeGlint", (0.96, 0.86, 0.55, 1), roughness=0.38
    )
    wing_primary = material(
        "Material.Butterfly.WingPrimary", (0.92, 0.55, 0.18, 1), roughness=0.72
    )
    wing_secondary = material(
        "Material.Butterfly.WingSecondary", (0.32, 0.16, 0.46, 1), roughness=0.72
    )
    wing_edge = material(
        "Material.Butterfly.WingEdge", (0.12, 0.075, 0.08, 1), roughness=0.75
    )
    wing_band = material(
        "Material.Butterfly.WingBand", (0.96, 0.82, 0.48, 1), roughness=0.68
    )
    wing_spot = material(
        "Material.Butterfly.WingSpot", (0.94, 0.91, 0.78, 1), roughness=0.68
    )

    root = empty("Butterfly_Root", (0, 0, 0))
    body_pivot = empty("Butterfly_BodyPivot", (0, 0, 0.31))
    head_pivot = empty("Butterfly_HeadPivot", (0, 0.28, 0.32))
    wing_left_pivot = empty("Butterfly_WingPivot_L", (-0.045, 0.02, 0.32))
    wing_right_pivot = empty("Butterfly_WingPivot_R", (0.045, 0.02, 0.32))

    parent_keep_transform(body_pivot, root)
    parent_keep_transform(head_pivot, body_pivot)
    parent_keep_transform(wing_left_pivot, body_pivot)
    parent_keep_transform(wing_right_pivot, body_pivot)

    abdomen = add_ico_sphere(
        "Butterfly_Abdomen", (0, -0.08, 0.31), (0.06, 0.27, 0.06), body_brown
    )
    abdomen_tip = add_ico_sphere(
        "Butterfly_AbdomenTip",
        (0, -0.32, 0.31),
        (0.04, 0.09, 0.04),
        charcoal,
        subdivisions=1,
    )
    thorax = add_ico_sphere(
        "Butterfly_Thorax", (0, 0.08, 0.32), (0.095, 0.14, 0.09), body_warm
    )
    head = add_ico_sphere(
        "Butterfly_Head", (0, 0.29, 0.33), (0.08, 0.075, 0.08), body_brown
    )
    eye_left = add_ico_sphere(
        "Butterfly_Eye_L", (-0.062, 0.335, 0.35), (0.027, 0.03, 0.03), charcoal
    )
    eye_right = add_ico_sphere(
        "Butterfly_Eye_R", (0.062, 0.335, 0.35), (0.027, 0.03, 0.03), charcoal
    )
    glint_left = add_ico_sphere(
        "Butterfly_EyeGlint_L",
        (-0.071, 0.357, 0.364),
        (0.008, 0.008, 0.008),
        eye_glint,
        subdivisions=1,
    )
    glint_right = add_ico_sphere(
        "Butterfly_EyeGlint_R",
        (0.071, 0.357, 0.364),
        (0.008, 0.008, 0.008),
        eye_glint,
        subdivisions=1,
    )

    antenna_left = add_cylinder_between(
        "Butterfly_Antenna_L",
        (-0.035, 0.34, 0.38),
        (-0.14, 0.57, 0.49),
        0.007,
        charcoal,
        vertices=6,
    )
    antenna_right = add_cylinder_between(
        "Butterfly_Antenna_R",
        (0.035, 0.34, 0.38),
        (0.14, 0.57, 0.49),
        0.007,
        charcoal,
        vertices=6,
    )
    antenna_tip_left = add_ico_sphere(
        "Butterfly_AntennaTip_L",
        (-0.142, 0.58, 0.495),
        (0.016, 0.021, 0.016),
        body_warm,
        subdivisions=1,
    )
    antenna_tip_right = add_ico_sphere(
        "Butterfly_AntennaTip_R",
        (0.142, 0.58, 0.495),
        (0.016, 0.021, 0.016),
        body_warm,
        subdivisions=1,
    )

    legs: list[bpy.types.Object] = []
    for side, sign in (("L", -1), ("R", 1)):
        for index, (start_y, end_y) in enumerate(
            ((0.16, 0.27), (0.07, 0.05), (-0.01, -0.14)), start=1
        ):
            leg = add_cylinder_between(
                f"Butterfly_Leg_{side}{index}",
                (sign * 0.05, start_y, 0.285),
                (sign * (0.16 + index * 0.02), end_y, 0.17),
                0.006,
                charcoal,
                vertices=5,
            )
            legs.append(leg)

    fore_left_points = [
        (-0.04, 0.12),
        (-0.3, 0.64),
        (-0.82, 0.83),
        (-0.99, 0.43),
        (-0.75, 0.0),
        (-0.14, -0.04),
    ]
    hind_left_points = [
        (-0.05, 0.06),
        (-0.35, -0.08),
        (-0.79, -0.17),
        (-0.86, -0.58),
        (-0.48, -0.72),
        (-0.11, -0.38),
    ]
    edge_left_points = [
        (-0.6, 0.05),
        (-0.83, 0.28),
        (-0.93, 0.46),
        (-0.8, 0.71),
        (-0.65, 0.78),
        (-0.77, 0.48),
        (-0.65, 0.19),
    ]
    band_left_points = [
        (-0.13, 0.06),
        (-0.4, 0.52),
        (-0.54, 0.61),
        (-0.43, 0.1),
        (-0.29, -0.32),
        (-0.12, -0.26),
    ]

    wing_objects: list[bpy.types.Object] = []
    for side, points, pivot in (
        ("L", fore_left_points, wing_left_pivot),
        ("R", mirror_points(fore_left_points), wing_right_pivot),
    ):
        wing = add_wing_polygon(
            f"Butterfly_WingFore_{side}", points, 0.32, wing_primary
        )
        parent_keep_transform(wing, pivot)
        wing_objects.append(wing)
    for side, points, pivot in (
        ("L", hind_left_points, wing_left_pivot),
        ("R", mirror_points(hind_left_points), wing_right_pivot),
    ):
        wing = add_wing_polygon(
            f"Butterfly_WingHind_{side}", points, 0.315, wing_secondary
        )
        parent_keep_transform(wing, pivot)
        wing_objects.append(wing)
    for side, points, pivot in (
        ("L", edge_left_points, wing_left_pivot),
        ("R", mirror_points(edge_left_points), wing_right_pivot),
    ):
        edge = add_wing_polygon(
            f"Butterfly_WingEdge_{side}", points, 0.336, wing_edge, thickness=0.012
        )
        parent_keep_transform(edge, pivot)
        wing_objects.append(edge)
    for side, points, pivot in (
        ("L", band_left_points, wing_left_pivot),
        ("R", mirror_points(band_left_points), wing_right_pivot),
    ):
        band = add_wing_polygon(
            f"Butterfly_WingBand_{side}", points, 0.34, wing_band, thickness=0.012
        )
        parent_keep_transform(band, pivot)
        wing_objects.append(band)

    for side, sign, pivot in (
        ("L", -1, wing_left_pivot),
        ("R", 1, wing_right_pivot),
    ):
        outer_spots = [
            add_ico_sphere(
                f"Butterfly_WingSpotOuter_{side}_{index}",
                (sign * x, y, 0.355),
                (0.07, 0.105, 0.012),
                wing_spot,
                subdivisions=1,
            )
            for index, (x, y) in enumerate(((0.72, 0.56), (0.63, -0.35)), start=1)
        ]
        inner_spots = [
            add_ico_sphere(
                f"Butterfly_WingSpotInner_{side}_{index}",
                (sign * x, y, 0.356),
                (0.05, 0.072, 0.012),
                wing_spot,
                subdivisions=1,
            )
            for index, (x, y) in enumerate(((0.39, 0.34), (0.35, -0.18)), start=1)
        ]
        outer = join_objects(outer_spots, f"Butterfly_WingSpotOuter_{side}")
        inner = join_objects(inner_spots, f"Butterfly_WingSpotInner_{side}")
        parent_keep_transform(outer, pivot)
        parent_keep_transform(inner, pivot)
        wing_objects.extend((outer, inner))

    for obj in (abdomen, abdomen_tip, thorax, *legs):
        parent_keep_transform(obj, body_pivot)
    for obj in (
        head,
        eye_left,
        eye_right,
        glint_left,
        glint_right,
        antenna_left,
        antenna_right,
        antenna_tip_left,
        antenna_tip_right,
    ):
        parent_keep_transform(obj, head_pivot)

    # Blender +Y exports as runtime -Z. Match the established animal convention
    # where runtime +Z is forward.
    root.rotation_euler.z = math.pi

    expected_names = [
        "Butterfly_Root",
        "Butterfly_BodyPivot",
        "Butterfly_HeadPivot",
        "Butterfly_WingPivot_L",
        "Butterfly_WingPivot_R",
        "Butterfly_Abdomen",
        "Butterfly_AbdomenTip",
        "Butterfly_Thorax",
        "Butterfly_Head",
        "Butterfly_Eye_L",
        "Butterfly_Eye_R",
        "Butterfly_EyeGlint_L",
        "Butterfly_EyeGlint_R",
        "Butterfly_Antenna_L",
        "Butterfly_Antenna_R",
        "Butterfly_AntennaTip_L",
        "Butterfly_AntennaTip_R",
        "Butterfly_Leg_L1",
        "Butterfly_Leg_L2",
        "Butterfly_Leg_L3",
        "Butterfly_Leg_R1",
        "Butterfly_Leg_R2",
        "Butterfly_Leg_R3",
        "Butterfly_WingFore_L",
        "Butterfly_WingFore_R",
        "Butterfly_WingHind_L",
        "Butterfly_WingHind_R",
        "Butterfly_WingEdge_L",
        "Butterfly_WingEdge_R",
        "Butterfly_WingBand_L",
        "Butterfly_WingBand_R",
        "Butterfly_WingSpotOuter_L",
        "Butterfly_WingSpotOuter_R",
        "Butterfly_WingSpotInner_L",
        "Butterfly_WingSpotInner_R",
    ]
    save_asset(output, expected_names)


if __name__ == "__main__":
    create_butterfly(parse_args().output)
