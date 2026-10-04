#!/usr/bin/env python3
"""Generate the original low-poly FishingBoat source asset.

Run with Blender, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python assets/scripts/generate-fishing-boat.py \
      -- --output-dir assets/game-assets

The model is an original, compact Adriatic working-boat interpretation made for
Gredice's isometric garden scale. Runtime weather overlays and ripple opacity
stay in React.
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
    parser.add_argument(
        "--output-dir",
        type=Path,
        required=True,
        help="Directory that receives FishingBoat.blend.",
    )
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def srgb_channel_to_linear(value: float) -> float:
    if value <= 0.04045:
        return value / 12.92
    return ((value + 0.055) / 1.055) ** 2.4


def rgba(hex_color: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    value = hex_color.removeprefix("#")
    channels = [int(value[index : index + 2], 16) / 255 for index in (0, 2, 4)]
    return (
        *(srgb_channel_to_linear(channel) for channel in channels),
        alpha,
    )


def material(
    name: str,
    color: str,
    *,
    alpha: float = 1.0,
    metallic: float = 0.0,
    roughness: float = 0.76,
) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    result.diffuse_color = rgba(color, alpha)
    result.metallic = metallic
    result.roughness = roughness

    principled = result.node_tree.nodes.get("Principled BSDF")
    if principled is not None:
        principled.inputs["Base Color"].default_value = rgba(color, alpha)
        principled.inputs["Metallic"].default_value = metallic
        principled.inputs["Roughness"].default_value = roughness
        principled.inputs["Alpha"].default_value = alpha

    if alpha < 1:
        try:
            result.surface_render_method = "DITHERED"
        except (AttributeError, TypeError):
            pass

    return result


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene["generated_by"] = "assets/scripts/generate-fishing-boat.py"
    scene["asset_name"] = "FishingBoat"


def activate(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_transforms(obj: bpy.types.Object) -> None:
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def bevel(obj: bpy.types.Object, width: float, segments: int = 1) -> None:
    if width <= 0:
        return
    activate(obj)
    modifier = obj.modifiers.new(name="Soft low-poly edges", type="BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def assign_material(obj: bpy.types.Object, value: bpy.types.Material) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(value)
    for polygon in obj.data.polygons:
        polygon.material_index = 0


def box(
    name: str,
    size: tuple[float, float, float],
    location: tuple[float, float, float],
    value: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0, 0, 0),
    bevel_width: float = 0.012,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = tuple(dimension / 2 for dimension in size)
    assign_material(obj, value)
    apply_transforms(obj)
    bevel(obj, min(bevel_width, min(size) * 0.22))
    return obj


def cylinder(
    name: str,
    radius: float,
    depth: float,
    location: tuple[float, float, float],
    value: bpy.types.Material,
    *,
    vertices: int = 10,
    rotation: tuple[float, float, float] = (0, 0, 0),
    bevel_width: float = 0.006,
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
    apply_transforms(obj)
    bevel(obj, min(bevel_width, radius * 0.24, depth * 0.18))
    return obj


def sphere(
    name: str,
    scale: tuple[float, float, float],
    location: tuple[float, float, float],
    value: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    assign_material(obj, value)
    apply_transforms(obj)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def torus(
    name: str,
    outer_radius: float,
    tube_radius: float,
    location: tuple[float, float, float],
    value: bpy.types.Material,
    *,
    scale: tuple[float, float, float] = (1, 1, 1),
    rotation: tuple[float, float, float] = (0, 0, 0),
    major_segments: int = 18,
    minor_segments: int = 6,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_segments=major_segments,
        minor_segments=minor_segments,
        major_radius=outer_radius - tube_radius,
        minor_radius=tube_radius,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    assign_material(obj, value)
    apply_transforms(obj)
    return obj


def tube_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    value: bpy.types.Material,
    *,
    vertices: int = 8,
) -> bpy.types.Object:
    start_vector = Vector(start)
    end_vector = Vector(end)
    direction = end_vector - start_vector
    midpoint = (start_vector + end_vector) / 2
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
    assign_material(obj, value)
    apply_transforms(obj)
    bevel(obj, radius * 0.16)
    return obj


def extruded_polygon(
    name: str,
    points: Iterable[tuple[float, float]],
    depth: float,
    z: float,
    value: bpy.types.Material,
    *,
    bevel_width: float = 0.005,
) -> bpy.types.Object:
    outline = list(points)
    half_depth = depth / 2
    vertices = [
        (x, y, z + z_offset)
        for z_offset in (-half_depth, half_depth)
        for x, y in outline
    ]
    count = len(outline)
    faces: list[tuple[int, ...]] = [
        tuple(reversed(range(count))),
        tuple(range(count, count * 2)),
    ]
    for index in range(count):
        following = (index + 1) % count
        faces.append((index, following, count + following, count + index))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    assign_material(obj, value)
    bevel(obj, bevel_width)
    return obj


def join_objects(
    objects: Iterable[bpy.types.Object],
    final_name: str,
    value: bpy.types.Material,
) -> bpy.types.Object:
    items = list(objects)
    if not items:
        raise ValueError(f"Cannot build empty object {final_name}")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in items:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = items[0]
    bpy.ops.object.join()
    result = bpy.context.object
    result.name = final_name
    result.data.name = f"{final_name}_Mesh"
    assign_material(result, value)
    apply_transforms(result)
    return result


def lower_hull(value: bpy.types.Material) -> bpy.types.Object:
    # Each ring travels from keel to port chine, port sheer, starboard sheer,
    # starboard chine. The closed top becomes a clean, shallow blue interior.
    sections = (
        (-0.84, 0.27, 0.15, 0.25, 0.33),
        (-0.58, 0.40, 0.07, 0.21, 0.31),
        (0.18, 0.43, 0.045, 0.20, 0.32),
        (0.60, 0.34, 0.10, 0.27, 0.40),
        (0.88, 0.045, 0.23, 0.39, 0.54),
    )
    vertices: list[tuple[float, float, float]] = []
    for y, half_width, keel_z, chine_z, sheer_z in sections:
        vertices.extend(
            (
                (0, y, keel_z),
                (-half_width * 0.93, y, chine_z),
                (-half_width, y, sheer_z),
                (half_width, y, sheer_z),
                (half_width * 0.93, y, chine_z),
            )
        )

    ring_size = 5
    faces: list[tuple[int, ...]] = []
    for section_index in range(len(sections) - 1):
        current = section_index * ring_size
        following = current + ring_size
        for point_index in range(ring_size):
            next_point = (point_index + 1) % ring_size
            faces.append(
                (
                    current + point_index,
                    current + next_point,
                    following + next_point,
                    following + point_index,
                )
            )
    faces.append(tuple(reversed(range(ring_size))))
    last_ring = (len(sections) - 1) * ring_size
    faces.append(tuple(last_ring + index for index in range(ring_size)))

    mesh = bpy.data.meshes.new("FishingBoat_HullWoodDark_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("FishingBoat_HullWoodDark", mesh)
    bpy.context.collection.objects.link(obj)
    assign_material(obj, value)
    bevel(obj, 0.012)
    return obj


def side_rail(
    name: str,
    side: int,
    value: bpy.types.Material,
) -> bpy.types.Object:
    sections = (
        (-0.78, 0.30, 0.32, 0.48),
        (-0.55, 0.41, 0.31, 0.49),
        (0.18, 0.43, 0.32, 0.51),
        (0.59, 0.34, 0.40, 0.57),
        (0.80, 0.14, 0.49, 0.62),
    )
    vertices: list[tuple[float, float, float]] = []
    for y, outer_width, bottom_z, top_z in sections:
        outer_x = side * outer_width
        inner_x = side * max(outer_width - 0.105, 0.055)
        vertices.extend(
            (
                (outer_x, y, bottom_z - 0.015),
                (outer_x, y, top_z),
                (inner_x, y, top_z - 0.035),
                (inner_x, y, bottom_z + 0.015),
            )
        )

    faces: list[tuple[int, ...]] = []
    ring_size = 4
    for section_index in range(len(sections) - 1):
        current = section_index * ring_size
        following = current + ring_size
        for point_index in range(ring_size):
            next_point = (point_index + 1) % ring_size
            faces.append(
                (
                    current + point_index,
                    current + next_point,
                    following + next_point,
                    following + point_index,
                )
            )
    faces.append(tuple(reversed(range(ring_size))))
    last_ring = (len(sections) - 1) * ring_size
    faces.append(tuple(last_ring + index for index in range(ring_size)))

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    assign_material(obj, value)
    bevel(obj, 0.009)
    return obj


def save_asset(output_dir: Path, objects: Iterable[bpy.types.Object]) -> None:
    items = list(objects)
    expected_names = {obj.name for obj in items}
    actual_names = {obj.name for obj in bpy.context.scene.objects}
    if actual_names != expected_names:
        raise RuntimeError(
            f"Unexpected FishingBoat objects: {sorted(actual_names ^ expected_names)}"
        )

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = (output_dir / "FishingBoat.blend").resolve()
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path), compress=True)
    corners = [
        obj.matrix_world @ Vector(corner)
        for obj in items
        for corner in obj.bound_box
    ]
    minimum = Vector(min(corner[index] for corner in corners) for index in range(3))
    maximum = Vector(max(corner[index] for corner in corners) for index in range(3))
    dimensions = maximum - minimum
    print(
        f"GENERATED FishingBoat: {output_path} "
        f"bounds=({minimum.x:.4f},{minimum.y:.4f},{minimum.z:.4f}).."
        f"({maximum.x:.4f},{maximum.y:.4f},{maximum.z:.4f}) "
        f"dimensions=({dimensions.x:.4f},{dimensions.y:.4f},{dimensions.z:.4f}) "
        f"objects={','.join(sorted(expected_names))}"
    )


def generate_fishing_boat(output_dir: Path) -> None:
    reset_scene()
    dark_warm_wood = material(
        "Material.FishingBoat.DarkWarmWood", "#55301F", roughness=0.9
    )
    hull_wood = material(
        "Material.FishingBoat.HullWood", "#724329", roughness=0.88
    )
    interior_wood = material(
        "Material.FishingBoat.InteriorWood", "#875637", roughness=0.9
    )
    warm_wood = material(
        "Material.FishingBoat.WarmWood", "#684027", roughness=0.9
    )
    rope = material("Material.FishingBoat.Rope", "#B99A63", roughness=0.94)
    net = material("Material.FishingBoat.Net", "#477A68", roughness=0.9)
    float_gold = material(
        "Material.FishingBoat.FloatGold", "#E0A83C", roughness=0.7
    )
    dark_metal = material(
        "Material.FishingBoat.DarkMetal",
        "#384447",
        metallic=0.38,
        roughness=0.5,
    )
    ripple = material(
        "Material.FishingBoat.Ripple", "#92CFD8", alpha=0.42, roughness=0.22
    )

    hull = lower_hull(dark_warm_wood)
    hull_parts = [
        side_rail("port_rail", -1, hull_wood),
        side_rail("starboard_rail", 1, hull_wood),
        extruded_polygon(
            "bow_cap",
            ((-0.15, 0.77), (0.15, 0.77), (0.045, 0.90), (-0.045, 0.90)),
            0.10,
            0.57,
            hull_wood,
            bevel_width=0.009,
        ),
        box(
            "stern_cap",
            (0.60, 0.11, 0.18),
            (0, -0.79, 0.42),
            hull_wood,
            bevel_width=0.015,
        ),
    ]

    interior = extruded_polygon(
        "FishingBoat_InteriorWood",
        (
            (-0.27, -0.57),
            (0.27, -0.57),
            (0.30, 0.32),
            (0.20, 0.57),
            (-0.20, 0.57),
            (-0.30, 0.32),
        ),
        0.018,
        0.335,
        interior_wood,
        bevel_width=0.004,
    )

    benches = [
        box("bench_stern", (0.64, 0.15, 0.055), (0, -0.46, 0.455), warm_wood),
        box("bench_bow", (0.57, 0.14, 0.055), (0, 0.34, 0.50), warm_wood),
    ]
    oars: list[bpy.types.Object] = []
    for side in (-1, 1):
        oars.extend(
            (
                tube_between(
                    f"oar_shaft_{side}",
                    (side * 0.25, -0.57, 0.525),
                    (side * 0.33, 0.57, 0.575),
                    0.017,
                    warm_wood,
                ),
                box(
                    f"oar_blade_{side}",
                    (0.115, 0.275, 0.032),
                    (side * 0.34, 0.69, 0.59),
                    warm_wood,
                    rotation=(0, 0, -side * 0.055),
                    bevel_width=0.018,
                ),
            )
        )

    rope_parts = [
        torus("rope_coil_outer", 0.12, 0.014, (0.13, 0.53, 0.605), rope),
        torus("rope_coil_inner", 0.077, 0.012, (0.13, 0.53, 0.61), rope),
        tube_between(
            "rope_tail",
            (0.05, 0.53, 0.61),
            (-0.03, 0.44, 0.575),
            0.011,
            rope,
            vertices=7,
        ),
    ]

    net_parts = [
        sphere("net_bundle_1", (0.12, 0.075, 0.07), (-0.15, -0.61, 0.43), net),
        sphere("net_bundle_2", (0.10, 0.07, 0.06), (-0.04, -0.64, 0.44), net),
        sphere("net_bundle_3", (0.085, 0.06, 0.055), (-0.20, -0.68, 0.46), net),
        torus(
            "net_cord",
            0.105,
            0.010,
            (-0.12, -0.63, 0.47),
            net,
            scale=(1.2, 0.7, 0.55),
        ),
    ]
    floats = [
        sphere(
            f"float_{index}",
            (0.026, 0.026, 0.026),
            (-0.26 + index * 0.06, -0.69 + (index % 2) * 0.035, 0.50),
            float_gold,
        )
        for index in range(5)
    ]
    metal_parts = [
        box("cleat_port", (0.085, 0.025, 0.025), (-0.25, 0.69, 0.59), dark_metal),
        box(
            "cleat_starboard",
            (0.085, 0.025, 0.025),
            (0.25, 0.69, 0.59),
            dark_metal,
        ),
        cylinder(
            "stern_ring",
            0.034,
            0.018,
            (0, -0.85, 0.49),
            dark_metal,
            vertices=10,
            rotation=(math.pi / 2, 0, 0),
        ),
    ]
    ripple_parts = [
        torus(
            "ripple_outer",
            0.62,
            0.012,
            (0, 0.03, 0.0042),
            ripple,
            scale=(0.76, 1.48, 0.35),
            major_segments=24,
        ),
        torus(
            "ripple_inner",
            0.51,
            0.009,
            (0, -0.02, 0.002728),
            ripple,
            scale=(0.72, 1.43, 0.35),
            major_segments=24,
        ),
    ]

    final = [
        hull,
        join_objects(hull_parts, "FishingBoat_HullWood", hull_wood),
        interior,
        join_objects(benches, "FishingBoat_Benches", warm_wood),
        join_objects(oars, "FishingBoat_Oars", warm_wood),
        join_objects(rope_parts, "FishingBoat_Rope", rope),
        join_objects(net_parts, "FishingBoat_Net", net),
        join_objects(floats, "FishingBoat_Floats", float_gold),
        join_objects(metal_parts, "FishingBoat_Metal", dark_metal),
        join_objects(ripple_parts, "FishingBoat_Ripples", ripple),
    ]
    save_asset(output_dir, final)


def main() -> None:
    args = parse_args()
    generate_fishing_boat(args.output_dir)


if __name__ == "__main__":
    main()
