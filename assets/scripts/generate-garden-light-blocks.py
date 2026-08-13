#!/usr/bin/env python3
"""Generate the approved low-poly garden lighting and walkway source assets.

Run with Blender, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python assets/scripts/generate-garden-light-blocks.py \
      -- --output-dir assets/game-assets

Each generated file contains only the stable, manifest-listed mesh objects.
Runtime point lights, animated water, glass, and weather overlays stay in React.
"""

from __future__ import annotations

import argparse
import bmesh
import math
import sys
from collections.abc import Callable, Iterable
from pathlib import Path

import bpy
from mathutils import Euler, Vector


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output-dir",
        type=Path,
        required=True,
        help="Directory that receives one .blend file per asset.",
    )
    parser.add_argument(
        "--asset",
        action="append",
        dest="assets",
        help="Generate only this asset name. May be supplied more than once.",
    )
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def srgb_channel_to_linear(value: float) -> float:
    if value <= 0.04045:
        return value / 12.92
    return ((value + 0.055) / 1.055) ** 2.4


def rgba(hex_color: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    value = hex_color.removeprefix("#")
    if len(value) != 6:
        raise ValueError(f"Expected six-digit hex color, got {hex_color!r}")
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
    roughness: float = 0.72,
    emission_strength: float = 0.0,
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
        emission_input = principled.inputs.get("Emission Color") or principled.inputs.get(
            "Emission"
        )
        if emission_input is not None:
            emission_input.default_value = rgba(color, 1.0)
        emission_strength_input = principled.inputs.get("Emission Strength")
        if emission_strength_input is not None:
            emission_strength_input.default_value = emission_strength

    if alpha < 1:
        try:
            result.surface_render_method = "DITHERED"
        except (AttributeError, TypeError):
            pass

    return result


def reset_scene(asset_name: str) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene["generated_by"] = "assets/scripts/generate-garden-light-blocks.py"
    scene["asset_name"] = asset_name


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


def recalculate_outside_normals(obj: bpy.types.Object) -> None:
    editable_mesh = bmesh.new()
    editable_mesh.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(editable_mesh, faces=editable_mesh.faces)
    editable_mesh.to_mesh(obj.data)
    editable_mesh.free()
    obj.data.update()


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
    vertices: int = 12,
    rotation: tuple[float, float, float] = (0, 0, 0),
    bevel_width: float = 0.008,
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
    bevel(obj, min(bevel_width, radius * 0.25, depth * 0.18))
    return obj


def cone(
    name: str,
    radius_bottom: float,
    radius_top: float,
    depth: float,
    location: tuple[float, float, float],
    value: bpy.types.Material,
    *,
    vertices: int = 12,
    rotation: tuple[float, float, float] = (0, 0, 0),
    bevel_width: float = 0.006,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_bottom,
        radius2=radius_top,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    assign_material(obj, value)
    apply_transforms(obj)
    bevel(obj, min(bevel_width, min(radius_bottom, radius_top or radius_bottom) * 0.25))
    return obj


def sphere(
    name: str,
    scale: tuple[float, float, float],
    location: tuple[float, float, float],
    value: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = rotation
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
    rotation: tuple[float, float, float] = (0, 0, 0),
    major_segments: int = 16,
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
    bevel(obj, radius * 0.18)
    return obj


def extruded_polygon(
    name: str,
    points: Iterable[tuple[float, float]],
    depth: float,
    location: tuple[float, float, float],
    value: bpy.types.Material,
) -> bpy.types.Object:
    outline = list(points)
    if len(outline) < 3:
        raise ValueError(f"Expected at least three polygon points for {name}")
    half_depth = depth / 2
    vertices = [
        (x + location[0], y + location[1], location[2] + z)
        for z in (-half_depth, half_depth)
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
    bevel(obj, min(depth * 0.22, 0.006))
    return obj


def ribbon_along_points(
    name: str,
    points: Iterable[tuple[float, float, float]],
    width: float,
    thickness: float,
    value: bpy.types.Material,
) -> bpy.types.Object:
    """Create a broad, closed low-poly band along a domed centerline."""
    centers = [Vector(point) for point in points]
    if len(centers) < 2:
        raise ValueError(f"Expected at least two ribbon points for {name}")
    vertices: list[tuple[float, float, float]] = []
    for index, center in enumerate(centers):
        previous = centers[max(0, index - 1)]
        following = centers[min(len(centers) - 1, index + 1)]
        tangent = (following - previous).normalized()
        radial = Vector((center.x, center.y, 0))
        normal = Vector((radial.x / 0.25**2, radial.y / 0.25**2, (center.z - 0.17) / 0.48**2))
        if normal.length < 1e-6:
            normal = Vector((0, 0, 1))
        normal.normalize()
        side = normal.cross(tangent).normalized()
        for surface_offset in (-thickness / 2, thickness / 2):
            for side_offset in (-width / 2, width / 2):
                vertex = center + normal * surface_offset + side * side_offset
                vertices.append(tuple(vertex))

    faces: list[tuple[int, ...]] = []
    for index in range(len(centers) - 1):
        current = index * 4
        following = current + 4
        faces.extend(
            [
                (current, following, following + 1, current + 1),
                (current + 2, current + 3, following + 3, following + 2),
                (current, current + 2, following + 2, following),
                (current + 1, following + 1, following + 3, current + 3),
            ]
        )
    last = len(vertices) - 4
    faces.extend([(0, 2, 3, 1), (last, last + 1, last + 3, last + 2)])
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    assign_material(obj, value)
    recalculate_outside_normals(obj)
    return obj


def cylindrical_ribbon_along_points(
    name: str,
    points: Iterable[tuple[float, float, float]],
    width: float,
    thickness: float,
    value: bpy.types.Material,
) -> bpy.types.Object:
    """Create a closed helical band kept tangent to a cylindrical cage."""
    centers = [Vector(point) for point in points]
    if len(centers) < 2:
        raise ValueError(f"Expected at least two ribbon points for {name}")
    vertices: list[tuple[float, float, float]] = []
    for center in centers:
        normal = Vector((center.x, center.y, 0)).normalized()
        side = Vector((-normal.y, normal.x, 0))
        for surface_offset in (-thickness / 2, thickness / 2):
            for side_offset in (-width / 2, width / 2):
                vertices.append(
                    tuple(center + normal * surface_offset + side * side_offset)
                )

    faces: list[tuple[int, ...]] = []
    for index in range(len(centers) - 1):
        current = index * 4
        following = current + 4
        faces.extend(
            [
                (current, following, following + 1, current + 1),
                (current + 2, current + 3, following + 3, following + 2),
                (current, current + 2, following + 2, following),
                (current + 1, following + 1, following + 3, current + 3),
            ]
        )
    last = len(vertices) - 4
    faces.extend([(0, 2, 3, 1), (last, last + 1, last + 3, last + 2)])
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    assign_material(obj, value)
    recalculate_outside_normals(obj)
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


def source_bounds(objects: Iterable[bpy.types.Object]) -> tuple[Vector, Vector]:
    corners = [
        obj.matrix_world @ Vector(corner)
        for obj in objects
        for corner in obj.bound_box
    ]
    return (
        Vector(min(corner[index] for corner in corners) for index in range(3)),
        Vector(max(corner[index] for corner in corners) for index in range(3)),
    )


def save_asset(
    asset_name: str,
    output_dir: Path,
    objects: Iterable[bpy.types.Object],
) -> None:
    items = list(objects)
    expected_names = {obj.name for obj in items}
    actual_names = {obj.name for obj in bpy.context.scene.objects}
    if actual_names != expected_names:
        raise RuntimeError(
            f"Unexpected objects in {asset_name}: {sorted(actual_names ^ expected_names)}"
        )
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = (output_dir / f"{asset_name}.blend").resolve()
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path), compress=True)
    minimum, maximum = source_bounds(items)
    dimensions = maximum - minimum
    print(
        f"GENERATED {asset_name}: {output_path} "
        f"bounds=({minimum.x:.4f},{minimum.y:.4f},{minimum.z:.4f}).."
        f"({maximum.x:.4f},{maximum.y:.4f},{maximum.z:.4f}) "
        f"dimensions=({dimensions.x:.4f},{dimensions.y:.4f},{dimensions.z:.4f}) "
        f"objects={','.join(sorted(expected_names))}"
    )


def generate_stone_walkway(output_dir: Path) -> None:
    name = "StoneWalkway"
    reset_scene(name)
    # The catalog environment is intentionally bright, so these source colors
    # are considerably deeper than the desired on-screen honey limestone.
    light = material("Material.StoneWalkway.LightStone", "#A77D45", roughness=0.88)
    middle = material("Material.StoneWalkway.MidStone", "#9E713C", roughness=0.9)
    warm = material("Material.StoneWalkway.WarmStone", "#936333", roughness=0.9)

    positions = (
        (-0.27, -0.333),
        (0.23, -0.333),
        (-0.23, 0),
        (0.27, 0),
        (-0.26, 0.333),
        (0.24, 0.333),
    )
    sizes = (
        (0.46, 0.334),
        (0.54, 0.334),
        (0.54, 0.332),
        (0.46, 0.332),
        (0.48, 0.334),
        (0.52, 0.334),
    )
    roles: dict[str, list[bpy.types.Object]] = {"light": [], "middle": [], "warm": []}
    role_materials = {"light": light, "middle": middle, "warm": warm}
    # Keep adjacent pavers close in value and avoid a checkerboard read from the
    # catalog camera.  The three limestone mixes still remain separately
    # addressable for subtle material variation.
    role_order = ("light", "middle", "middle", "warm", "warm", "middle")
    for index, (x, y) in enumerate(positions):
        width, depth = sizes[index]
        height = 0.058 + (index % 3) * 0.003
        role = role_order[index]
        roles[role].append(
            box(
                f"stone_{index}",
                (width, depth, height),
                (x, y, height / 2),
                role_materials[role],
                bevel_width=0.018,
            )
        )

    final = [
        join_objects(roles["light"], "StoneWalkway_StonesLight", light),
        join_objects(roles["middle"], "StoneWalkway_StonesMid", middle),
        join_objects(roles["warm"], "StoneWalkway_StonesWarm", warm),
    ]
    save_asset(name, output_dir, final)


def generate_enamel_garden_lamp(output_dir: Path) -> None:
    name = "EnamelGardenLamp"
    reset_scene(name)
    wood = material("Material.EnamelGardenLamp.Wood", "#71431F", roughness=0.86)
    enamel = material(
        "Material.EnamelGardenLamp.BlueEnamel",
        "#2F5E83",
        metallic=0.08,
        roughness=0.32,
    )
    metal = material(
        "Material.EnamelGardenLamp.DarkMetal",
        "#313536",
        metallic=0.55,
        roughness=0.38,
    )
    limestone = material(
        "Material.EnamelGardenLamp.Limestone", "#D5C6A3", roughness=0.9
    )
    glow = material(
        "Material.EnamelGardenLamp.Glow",
        "#FFD88A",
        roughness=0.28,
        emission_strength=2.5,
    )

    wood_parts = [
        box("post", (0.125, 0.125, 1.08), (-0.08, 0, 0.65), wood, bevel_width=0.017),
        cone("post_cap", 0.086, 0.065, 0.07, (-0.08, 0, 1.225), wood, vertices=8),
    ]
    limestone_parts = [
        box(
            "limestone_foot",
            (0.265, 0.265, 0.12),
            (-0.08, 0, 0.06),
            limestone,
            rotation=(0, 0, 0.08),
            bevel_width=0.028,
        ),
        cone("limestone_socket", 0.10, 0.075, 0.075, (-0.08, 0, 0.155), limestone, vertices=8),
    ]
    shade_parts = [
        cone("shade", 0.17, 0.068, 0.13, (0.13, 0, 1.15), enamel, vertices=14),
        cylinder("shade_neck", 0.068, 0.04, (0.13, 0, 1.235), enamel, vertices=14),
    ]
    trim_parts = [
        tube_between("hook_rise", (-0.08, 0, 1.16), (-0.025, 0, 1.34), 0.027, metal, vertices=9),
        tube_between("hook_curve_a", (-0.025, 0, 1.34), (0.085, 0, 1.39), 0.027, metal, vertices=9),
        tube_between("hook_curve_b", (0.085, 0, 1.39), (0.13, 0, 1.31), 0.027, metal, vertices=9),
        tube_between("hook_drop", (0.13, 0, 1.31), (0.13, 0, 1.255), 0.027, metal, vertices=9),
        torus("shade_rim", 0.173, 0.012, (0.13, 0, 1.085), metal),
        cylinder("shade_cap", 0.040, 0.045, (0.13, 0, 1.272), metal, vertices=10),
    ]
    bulb_parts = [
        sphere("bulb", (0.078, 0.078, 0.105), (0.13, 0, 0.945), glow),
        cylinder("bulb_neck", 0.032, 0.055, (0.13, 0, 1.037), glow, vertices=10),
    ]

    final = [
        join_objects(wood_parts, "EnamelGardenLamp_WoodPost", wood),
        join_objects(
            limestone_parts,
            "EnamelGardenLamp_LimestoneFoot",
            limestone,
        ),
        join_objects(shade_parts, "EnamelGardenLamp_EnamelShade", enamel),
        join_objects(trim_parts, "EnamelGardenLamp_MetalTrim", metal),
        join_objects(bulb_parts, "EnamelGardenLamp_Bulb", glow),
    ]
    save_asset(name, output_dir, final)


def generate_double_garden_light_pole(output_dir: Path) -> None:
    """Build the symmetric 1x1 Outlet and garden path light pole."""
    name = "DoubleGardenLightPole"
    reset_scene(name)
    limestone = material(
        "Material.DoubleGardenLightPole.Limestone", "#D5C6A3", roughness=0.9
    )
    # Match Material.WoodenWalkway.WarmWood, the repository's canonical
    # timber profile. This keeps the pole visually related to the Outlet's
    # tables and benches instead of reading as brown-painted metal.
    warm_wood = material(
        "Material.DoubleGardenLightPole.WarmWood", "#7D4422", roughness=0.78
    )
    # WoodenWalkway predates the shared hex helper and stores this canonical
    # linear surface profile directly. Preserve those exact values so timber
    # assets remain interchangeable instead of accumulating near-identical
    # brown materials after GLB export.
    canonical_wood_linear = (0.205, 0.058, 0.016, 1.0)
    warm_wood.diffuse_color = canonical_wood_linear
    warm_wood_principled = warm_wood.node_tree.nodes.get("Principled BSDF")
    if warm_wood_principled is not None:
        warm_wood_principled.inputs["Base Color"].default_value = (
            canonical_wood_linear
        )
    warm_enamel = material(
        "Material.DoubleGardenLightPole.WarmEnamel",
        "#DCA861",
        roughness=0.68,
        metallic=0.12,
    )
    dark_metal = material(
        "Material.DoubleGardenLightPole.DarkMetal",
        "#4B4843",
        roughness=0.7,
        metallic=0.48,
    )
    glow = material(
        "Material.DoubleGardenLightPole.Glow",
        "#FFD88A",
        roughness=0.28,
        emission_strength=2.5,
    )

    base = join_objects(
        [
            cylinder("base lower", 0.19, 0.10, (0, 0, 0.05), limestone, vertices=8),
            cylinder("base upper", 0.145, 0.10, (0, 0, 0.145), limestone, vertices=8),
        ],
        f"{name}_LimestoneBase",
        limestone,
    )
    pole = join_objects(
        [
            cylinder("upright", 0.052, 1.91, (0, 0, 1.105), warm_wood, vertices=8),
            cylinder(
                "crossarm",
                0.043,
                0.70,
                (0, 0, 2.10),
                warm_wood,
                vertices=8,
                rotation=(0, math.radians(90), 0),
            ),
            cylinder("left drop", 0.035, 0.18, (-0.32, 0, 2.015), warm_wood, vertices=8),
            cylinder("right drop", 0.035, 0.18, (0.32, 0, 2.015), warm_wood, vertices=8),
            box(
                "center brace",
                (0.16, 0.11, 0.12),
                (0, 0, 2.085),
                warm_wood,
                bevel_width=0.025,
            ),
        ],
        f"{name}_Wood",
        warm_wood,
    )
    shades = join_objects(
        [
            cone("left shade", 0.145, 0.065, 0.15, (-0.32, 0, 1.92), warm_enamel),
            cone("right shade", 0.145, 0.065, 0.15, (0.32, 0, 1.92), warm_enamel),
        ],
        f"{name}_Shades",
        warm_enamel,
    )
    trim = join_objects(
        [
            cylinder("base collar", 0.067, 0.055, (0, 0, 0.215), dark_metal),
            cylinder("top cap", 0.062, 0.05, (0, 0, 2.16), dark_metal),
            cylinder("left rim", 0.151, 0.025, (-0.32, 0, 1.85), dark_metal),
            cylinder("right rim", 0.151, 0.025, (0.32, 0, 1.85), dark_metal),
        ],
        f"{name}_DarkMetal",
        dark_metal,
    )
    left_bulb = sphere(
        f"{name}_BulbLeft",
        (0.061, 0.061, 0.078),
        (-0.32, 0, 1.82),
        glow,
    )
    right_bulb = sphere(
        f"{name}_BulbRight",
        (0.061, 0.061, 0.078),
        (0.32, 0, 1.82),
        glow,
    )

    save_asset(
        name,
        output_dir,
        [base, pole, shades, trim, left_bulb, right_bulb],
    )


def generate_hazel_light_arch(output_dir: Path) -> None:
    name = "HazelLightArch"
    reset_scene(name)
    hazel = material("Material.HazelLightArch.HazelWood", "#754A25", roughness=0.9)
    terracotta = material(
        "Material.HazelLightArch.Terracotta", "#B75D3E", roughness=0.84
    )
    cord = material("Material.HazelLightArch.DarkCord", "#C8AA72", roughness=0.92)
    glow = material(
        "Material.HazelLightArch.Glow",
        "#FFD582",
        roughness=0.3,
        emission_strength=2.6,
    )

    # One gateway in the local Y/Z plane. Its outer posts span almost the full
    # tile so the arch reads as a passage while retaining a 1x1 footprint.
    poles: list[bpy.types.Object] = []
    for side_index, sign in enumerate((-1, 1)):
        y = 0.443 * sign
        knee_y = 0.423 * sign
        shoulder_y = 0.373 * sign
        poles.extend(
            [
                tube_between(
                    f"leg_{side_index}",
                    (0, y, 0),
                    (0, y, 0.82),
                    0.052,
                    hazel,
                    vertices=9,
                ),
                tube_between(
                    f"bent_knee_{side_index}",
                    (0, y, 0.82),
                    (0, knee_y, 1.10),
                    0.050,
                    hazel,
                    vertices=9,
                ),
                tube_between(
                    f"bent_shoulder_{side_index}",
                    (0, knee_y, 1.10),
                    (0, shoulder_y, 1.36),
                    0.047,
                    hazel,
                    vertices=9,
                ),
            ]
        )
    poles.extend(
        [
            tube_between("top_rod_upper", (0, -0.415, 1.50), (0, 0.415, 1.50), 0.047, hazel, vertices=9),
            tube_between("top_rod_lower", (0, -0.415, 1.37), (0, 0.415, 1.37), 0.044, hazel, vertices=9),
            tube_between("left_top_join", (0, -0.373, 1.36), (0, -0.415, 1.50), 0.044, hazel, vertices=9),
            tube_between("right_top_join", (0, 0.373, 1.36), (0, 0.415, 1.50), 0.044, hazel, vertices=9),
        ]
    )

    cords: list[bpy.types.Object] = []
    shades: list[bpy.types.Object] = []
    bulbs: list[bpy.types.Object] = []
    # Broad rope loops visibly bind the paired rods at both shoulders and in
    # the middle; the three lamp cords hang from the lower rod.
    for index, y in enumerate((-0.22, 0, 0.22)):
        cords.extend(
            [
                torus(
                    f"top_lashing_{index}_a",
                    0.066,
                    0.009,
                    (0, y - 0.012, 1.435),
                    cord,
                    rotation=(math.pi / 2, 0, 0),
                    major_segments=10,
                    minor_segments=5,
                ),
                torus(
                    f"top_lashing_{index}_b",
                    0.066,
                    0.009,
                    (0, y + 0.012, 1.435),
                    cord,
                    rotation=(math.pi / 2, 0, 0),
                    major_segments=10,
                    minor_segments=5,
                ),
            ]
        )
        cords.append(
            tube_between(f"cord_{index}", (0, y, 1.37), (0, y, 1.325), 0.007, cord, vertices=6)
        )
        shades.extend(
            [
                cone(
                    f"shade_{index}",
                    0.095,
                    0.036,
                    0.075,
                    (0, y, 1.285),
                    terracotta,
                    vertices=12,
                ),
                torus(f"shade_rim_{index}", 0.096, 0.008, (0, y, 1.247), terracotta),
            ]
        )
        bulbs.append(sphere(f"bulb_{index}", (0.052, 0.052, 0.045), (0, y, 1.205), glow))

    for side_index, y in enumerate((-0.443, 0.443)):
        cords.extend(
            [
                torus(
                    f"foot_lashing_{side_index}_a",
                    0.047,
                    0.009,
                    (0, y, 0.105),
                    cord,
                    major_segments=10,
                    minor_segments=5,
                ),
                torus(
                    f"foot_lashing_{side_index}_b",
                    0.047,
                    0.009,
                    (0, y, 0.135),
                    cord,
                    major_segments=10,
                    minor_segments=5,
                ),
            ]
        )

    final = [
        join_objects(poles, "HazelLightArch_Poles", hazel),
        join_objects(shades, "HazelLightArch_TerracottaShades", terracotta),
        join_objects(cords, "HazelLightArch_Cords", cord),
        join_objects(bulbs, "HazelLightArch_Bulbs", glow),
    ]
    save_asset(name, output_dir, final)


def tile_with_leaf_opening(
    name: str,
    radial_angle: float,
    value: bpy.types.Material,
) -> bpy.types.Object:
    height = 0.315
    thickness = 0.026
    outer = (
        (0.000, 0.000),
        (0.087, 0.035),
        (0.111, 0.095),
        (0.120, 0.205),
        (0.108, 0.270),
        (0.077, 0.315),
        (0.000, 0.294),
        (-0.077, 0.315),
        (-0.108, 0.270),
        (-0.120, 0.205),
        (-0.111, 0.095),
        (-0.087, 0.035),
    )
    inner = (
        (0.000, 0.100),
        (0.014, 0.113),
        (0.027, 0.140),
        (0.034, 0.166),
        (0.029, 0.194),
        (0.016, 0.218),
        (0.000, 0.235),
        (-0.016, 0.218),
        (-0.029, 0.194),
        (-0.034, 0.166),
        (-0.027, 0.140),
        (-0.014, 0.113),
    )
    profile = outer + inner

    def point(u: float, v: float, shell_side: float) -> tuple[float, float, float]:
        t = max(0.0, min(1.0, v / height))
        smooth_t = t * t * (3 - 2 * t)
        transverse_crown = 0.012 * max(0, 1 - (u / 0.120) ** 2)
        radial = (
            0.128
            + 0.029 * smooth_t
            + 0.010 * t**3
            + transverse_crown
            + shell_side * thickness / 2
        )
        # Place the four petals on diagonal radial axes. Their narrow tangent
        # profiles leave genuine corner seams instead of intersecting into a
        # square shell while preserving a scooped/flared terracotta silhouette.
        cosine = math.cos(radial_angle)
        sine = math.sin(radial_angle)
        return (
            radial * cosine - u * sine,
            radial * sine + u * cosine,
            0.06 + v,
        )

    vertices = [point(u, v, shell_side) for shell_side in (-1, 1) for u, v in profile]
    faces: list[tuple[int, ...]] = []
    count = len(outer)
    shell_stride = len(profile)
    for current in range(count):
        following = (current + 1) % count
        inner_current = count + current
        inner_following = count + following
        back_outer_current = shell_stride + current
        back_outer_following = shell_stride + following
        back_inner_current = shell_stride + count + current
        back_inner_following = shell_stride + count + following

        # Four non-overlapping annular quads on each shell preserve the opening.
        faces.append((current, following, inner_following, inner_current))
        faces.append(
            (
                back_outer_current,
                back_inner_current,
                back_inner_following,
                back_outer_following,
            )
        )
        # Close the outer perimeter and the diamond-shaped inner opening.
        faces.append(
            (
                current,
                back_outer_current,
                back_outer_following,
                following,
            )
        )
        faces.append(
            (
                inner_current,
                inner_following,
                back_inner_following,
                back_inner_current,
            )
        )

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    assign_material(obj, value)
    recalculate_outside_normals(obj)
    bevel(obj, 0.004)
    return obj


def generate_roof_tile_lantern(output_dir: Path) -> None:
    name = "RoofTileLantern"
    reset_scene(name)
    terracotta = material(
        "Material.RoofTileLantern.Terracotta", "#A94D36", roughness=0.87
    )
    limestone = material(
        "Material.RoofTileLantern.Limestone", "#D8C9A7", roughness=0.9
    )
    glow = material(
        "Material.RoofTileLantern.Glow",
        "#FFB65C",
        roughness=0.32,
        emission_strength=2.8,
    )

    tiles = [
        tile_with_leaf_opening(f"tile_{index}", index * math.pi / 2, terracotta)
        for index in range(4)
    ]
    core = [
        box("stone_base", (0.44, 0.44, 0.065), (0, 0, 0.0325), limestone, bevel_width=0.022),
        cylinder("stone_core", 0.040, 0.17, (0, 0, 0.15), limestone, vertices=8),
    ]
    glow_parts = [sphere("ember_core", (0.047, 0.047, 0.09), (0, 0, 0.16), glow)]

    final = [
        join_objects(tiles, "RoofTileLantern_Tiles", terracotta),
        join_objects(core, "RoofTileLantern_LimestoneCore", limestone),
        join_objects(glow_parts, "RoofTileLantern_Glow", glow),
    ]
    save_asset(name, output_dir, final)


def generate_wicker_garden_lantern(output_dir: Path) -> None:
    name = "WickerGardenLantern"
    reset_scene(name)
    wicker = material("Material.WickerGardenLantern.Wicker", "#A8753F", roughness=0.92)
    terracotta = material(
        "Material.WickerGardenLantern.Terracotta", "#B86643", roughness=0.86
    )
    limestone = material(
        "Material.WickerGardenLantern.Limestone", "#D7C8A5", roughness=0.9
    )
    glow = material(
        "Material.WickerGardenLantern.Glow",
        "#FFC86E",
        roughness=0.28,
        emission_strength=2.7,
    )

    wicker_parts: list[bpy.types.Object] = []
    bands_per_direction = 6
    angular_spacing = math.tau / bands_per_direction
    twist = 2.25
    for hand in (-1, 1):
        for band_index in range(bands_per_direction):
            phase_start = (
                band_index * angular_spacing
                + (angular_spacing / 2 if hand < 0 else 0)
            )
            points: list[tuple[float, float, float]] = []
            for sample_index in range(61):
                progress = sample_index / 60
                phase = phase_start + hand * twist * progress
                dome_progress = math.sin(progress * math.pi / 2)
                radius = 0.225 + (0.100 - 0.225) * dome_progress**1.35
                # Both families share deterministic crossing levels. Equal-
                # height centerlines remain separated radially to suggest an
                # alternating woven over/under order without mesh collisions.
                crossing_wave = math.cos(
                    math.pi * (2 * twist * progress / angular_spacing - 0.5)
                )
                radial_relief = 0.014 * hand * crossing_wave
                radius += radial_relief
                points.append(
                    (
                        radius * math.cos(phase),
                        radius * math.sin(phase),
                        0.17 + 0.485 * dome_progress,
                    )
                )
            wicker_parts.append(
                cylindrical_ribbon_along_points(
                    f"woven_band_{hand}_{band_index}",
                    points,
                    0.027,
                    0.008,
                    wicker,
                )
            )
    wicker_parts.append(torus("weave_anchor", 0.247, 0.014, (0, 0, 0.17), wicker))
    terracotta_parts = [
        cylinder("terracotta_base", 0.19, 0.11, (0, 0, 0.055), terracotta, vertices=12),
    ]
    limestone_parts = [
        cylinder("limestone_plinth", 0.205, 0.05, (0, 0, 0.135), limestone, vertices=12),
        torus("limestone_rim", 0.207, 0.014, (0, 0, 0.16), limestone),
    ]
    glow_parts = [
        cylinder("frosted_core", 0.115, 0.31, (0, 0, 0.355), glow, vertices=12, bevel_width=0.018),
        sphere("frosted_cap", (0.112, 0.112, 0.085), (0, 0, 0.50), glow),
    ]

    final = [
        join_objects(wicker_parts, "WickerGardenLantern_Wicker", wicker),
        join_objects(terracotta_parts, "WickerGardenLantern_TerracottaBase", terracotta),
        join_objects(limestone_parts, "WickerGardenLantern_LimestoneBase", limestone),
        join_objects(glow_parts, "WickerGardenLantern_Glow", glow),
    ]
    save_asset(name, output_dir, final)


def generate_wooden_hand_lantern(output_dir: Path) -> None:
    name = "WoodenHandLantern"
    reset_scene(name)
    wood = material("Material.WoodenHandLantern.Wood", "#663A1D", roughness=0.88)
    metal = material(
        "Material.WoodenHandLantern.DarkMetal", "#5E4B37", metallic=0.25, roughness=0.55
    )
    glass = material(
        "Material.WoodenHandLantern.Glass", "#F2DCAD", alpha=0.68, roughness=0.48
    )
    glow = material(
        "Material.WoodenHandLantern.Glow",
        "#FFD078",
        roughness=0.28,
        emission_strength=2.8,
    )
    body_drop = 0.0425

    frame = [
        box("base", (0.38, 0.32, 0.065), (0, 0, 0.075 - body_drop), wood, bevel_width=0.016),
        box("lower_crossbar_front", (0.35, 0.045, 0.065), (0, -0.139, 0.12 - body_drop), wood, bevel_width=0.009),
        box("lower_crossbar_back", (0.35, 0.045, 0.065), (0, 0.139, 0.12 - body_drop), wood, bevel_width=0.009),
        box("lower_crossbar_left", (0.045, 0.24, 0.065), (-0.164, 0, 0.12 - body_drop), wood, bevel_width=0.009),
        box("lower_crossbar_right", (0.045, 0.24, 0.065), (0.164, 0, 0.12 - body_drop), wood, bevel_width=0.009),
        box("top", (0.35, 0.29, 0.07), (0, 0, 0.405 - body_drop), wood, bevel_width=0.014),
        cone("roof", 0.215, 0.09, 0.12, (0, 0, 0.50 - body_drop), wood, vertices=4, rotation=(0, 0, math.pi / 4)),
    ]
    for x in (-0.164, 0.164):
        for y in (-0.139, 0.139):
            frame.extend(
                [
                    box(
                        f"post_{x}_{y}",
                        (0.045, 0.045, 0.33),
                        (x, y, 0.25 - body_drop),
                        wood,
                        bevel_width=0.007,
                    ),
                    box(
                        f"foot_{x}_{y}",
                        (0.075, 0.075, 0.105),
                        (x, y, 0.0975 - body_drop),
                        wood,
                        bevel_width=0.010,
                    ),
                ]
            )

    handle_points = tuple(
        (x, y, z - body_drop)
        for x, y, z in (
            (-0.14, 0, 0.465),
            (-0.18, 0, 0.535),
            (-0.12, 0, 0.600),
            (0, 0, 0.632),
            (0.12, 0, 0.600),
            (0.18, 0, 0.535),
            (0.14, 0, 0.465),
        )
    )
    handle = [
        tube_between(f"handle_{index}", start, end, 0.026, wood, vertices=8)
        for index, (start, end) in enumerate(zip(handle_points, handle_points[1:]))
    ]

    glass_parts = [
        box("glass_front", (0.275, 0.010, 0.235), (0, -0.138, 0.255 - body_drop), glass, bevel_width=0.003),
        box("glass_back", (0.275, 0.010, 0.235), (0, 0.138, 0.255 - body_drop), glass, bevel_width=0.003),
        box("glass_left", (0.010, 0.225, 0.235), (-0.163, 0, 0.255 - body_drop), glass, bevel_width=0.003),
        box("glass_right", (0.010, 0.225, 0.235), (0.163, 0, 0.255 - body_drop), glass, bevel_width=0.003),
    ]
    metal_parts = [
        box("latch", (0.025, 0.012, 0.075), (0.180, -0.145, 0.30 - body_drop), metal, bevel_width=0.003),
        cylinder(
            "handle_socket_left",
            0.040,
            0.060,
            (-0.14, 0, 0.485 - body_drop),
            metal,
            vertices=10,
            rotation=(math.pi / 2, 0, 0),
        ),
        cylinder(
            "handle_socket_right",
            0.040,
            0.060,
            (0.14, 0, 0.485 - body_drop),
            metal,
            vertices=10,
            rotation=(math.pi / 2, 0, 0),
        ),
    ]
    glow_parts = [
        cylinder("lamp_glow", 0.10, 0.225, (0, 0, 0.255 - body_drop), glow, vertices=12, bevel_width=0.018),
    ]

    final = [
        join_objects(frame, "WoodenHandLantern_Frame", wood),
        join_objects(handle, "WoodenHandLantern_Handle", wood),
        join_objects(metal_parts, "WoodenHandLantern_Metal", metal),
        join_objects(glass_parts, "WoodenHandLantern_Glass", glass),
        join_objects(glow_parts, "WoodenHandLantern_Glow", glow),
    ]
    save_asset(name, output_dir, final)


def generate_moon_rain_barrel(output_dir: Path) -> None:
    name = "MoonRainBarrel"
    reset_scene(name)
    wood = material("Material.MoonRainBarrel.Wood", "#86562C", roughness=0.9)
    zinc = material(
        "Material.MoonRainBarrel.Zinc", "#777570", metallic=0.28, roughness=0.62
    )
    brass = material(
        "Material.MoonRainBarrel.Brass", "#A67A38", metallic=0.55, roughness=0.4
    )
    water = material(
        "Material.MoonRainBarrel.Water",
        "#42B7D5",
        alpha=0.76,
        metallic=0.05,
        roughness=0.18,
        emission_strength=0.35,
    )
    leaf = material("Material.MoonRainBarrel.Leaf", "#66854C", roughness=0.84)
    moon_stone = material(
        "Material.MoonRainBarrel.MoonStone",
        "#E7DDBF",
        roughness=0.72,
        emission_strength=0.18,
    )
    limestone = material(
        "Material.MoonRainBarrel.Limestone", "#D8C9A7", roughness=0.9
    )
    lid_location = Vector((0.0, 0.25, 0.73))
    lid_rotation = (1.22, 0.0, 0.0)
    lid_normal = Euler(lid_rotation).to_matrix() @ Vector((0, 0, 1))
    grip_location = lid_location + lid_normal * 0.045

    staves: list[bpy.types.Object] = []
    half_angle = math.pi / 8 - 0.018
    stave_layers = ((0.08, 0.265), (0.39, 0.31), (0.78, 0.272))
    for index in range(8):
        angle = index * math.tau / 8
        vertices: list[tuple[float, float, float]] = []
        for z, outer_radius in stave_layers:
            inner_radius = outer_radius - 0.065
            vertices.extend(
                [
                    (outer_radius * math.cos(angle - half_angle), outer_radius * math.sin(angle - half_angle), z),
                    (outer_radius * math.cos(angle + half_angle), outer_radius * math.sin(angle + half_angle), z),
                    (inner_radius * math.cos(angle + half_angle), inner_radius * math.sin(angle + half_angle), z),
                    (inner_radius * math.cos(angle - half_angle), inner_radius * math.sin(angle - half_angle), z),
                ]
            )
        faces: list[tuple[int, ...]] = [(0, 3, 2, 1), (8, 9, 10, 11)]
        for layer in range(len(stave_layers) - 1):
            current = layer * 4
            following = current + 4
            faces.extend(
                [
                    (current, current + 1, following + 1, following),
                    (current + 3, following + 3, following + 2, current + 2),
                    (current, following, following + 3, current + 3),
                    (current + 1, current + 2, following + 2, following + 1),
                ]
            )
        mesh = bpy.data.meshes.new(f"barrel_stave_{index}_Mesh")
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        stave = bpy.data.objects.new(f"barrel_stave_{index}", mesh)
        bpy.context.collection.objects.link(stave)
        assign_material(stave, wood)
        bevel(stave, 0.006)
        staves.append(stave)

    bands: list[bpy.types.Object] = []
    # Two restrained zinc hoops let the warm, bulged staves dominate.  Each
    # hoop remains eight discrete flat panels with a visible fastening bolt.
    for band_index, z in enumerate((0.22, 0.59)):
        for panel_index in range(8):
            angle = panel_index * math.tau / 8
            bands.append(
                box(
                    f"band_{band_index}_{panel_index}",
                    (0.032, 0.225, 0.032),
                    (0.304 * math.cos(angle), 0.304 * math.sin(angle), z),
                    zinc,
                    rotation=(0, 0, angle),
                    bevel_width=0.006,
                )
            )
            bands.append(
                sphere(
                    f"band_bolt_{band_index}_{panel_index}",
                    (0.009, 0.009, 0.009),
                    (0.322 * math.cos(angle), 0.322 * math.sin(angle), z),
                    zinc,
                )
            )

    lid_parts: list[bpy.types.Object] = []
    lid_tangent_x = Euler(lid_rotation).to_matrix() @ Vector((1, 0, 0))
    lid_tangent_y = Euler(lid_rotation).to_matrix() @ Vector((0, 1, 0))
    for lid_index, x in enumerate((-0.21, -0.15, -0.09, -0.03, 0.03, 0.09, 0.15, 0.21)):
        half_width = 0.033
        half_length = math.sqrt(max(0.0, 0.25**2 - x**2))
        center = lid_location + lid_tangent_x * x
        plank = box(
            f"lid_plank_{lid_index}",
            (half_width * 2, half_length * 2, 0.045),
            tuple(center),
            wood,
            rotation=lid_rotation,
            bevel_width=0.008,
        )
        lid_parts.append(plank)
    lid_parts.extend(
        [
            box(
                "lid_batten_left",
                (0.032, 0.36, 0.030),
                tuple(lid_location - lid_tangent_x * 0.125 + lid_normal * 0.034),
                wood,
                rotation=lid_rotation,
                bevel_width=0.006,
            ),
            box(
                "lid_batten_right",
                (0.032, 0.36, 0.030),
                tuple(lid_location + lid_tangent_x * 0.125 + lid_normal * 0.034),
                wood,
                rotation=lid_rotation,
                bevel_width=0.006,
            ),
        box(
            "lid_grip",
            (0.11, 0.040, 0.035),
            tuple(grip_location),
            wood,
            rotation=lid_rotation,
            bevel_width=0.008,
        ),
        ]
    )

    tap_parts = [
        tube_between("tap_body", (0, -0.30, 0.34), (0, -0.39, 0.34), 0.027, brass, vertices=10),
        tube_between("tap_spout", (0, -0.39, 0.34), (0, -0.39, 0.27), 0.023, brass, vertices=10),
        cylinder("tap_knob", 0.055, 0.020, (0, -0.355, 0.405), brass, vertices=8, rotation=(math.pi / 2, 0, 0)),
        tube_between("tap_stem", (0, -0.345, 0.34), (0, -0.345, 0.405), 0.013, brass, vertices=8),
    ]

    water_parts = [
        cylinder("water_surface", 0.238, 0.008, (0, 0, 0.705), water, vertices=24, bevel_width=0),
    ]
    leaf_parts = [
        sphere(
            "floating_leaf",
            (0.090, 0.045, 0.010),
            (0.10, -0.07, 0.714),
            leaf,
            rotation=(0, 0, -0.35),
        ),
        tube_between(
            "leaf_stem",
            (0.055, -0.075, 0.717),
            (0.00, -0.11, 0.719),
            0.006,
            leaf,
            vertices=6,
        ),
    ]
    outer_arc = [
        (
            0.115 * math.cos(math.radians(60 + index * 30)),
            0.115 * math.sin(math.radians(60 + index * 30)),
        )
        for index in range(9)
    ]
    inner_arc = [
        (
            0.040 + 0.080 * math.cos(math.radians(300 - index * 30)),
            0.080 * math.sin(math.radians(300 - index * 30)),
        )
        for index in range(9)
    ]
    moon_stone_parts = [
        extruded_polygon(
            "submerged_crescent",
            (*outer_arc, *inner_arc),
            0.018,
            (-0.09, -0.08, 0.707),
            moon_stone,
        )
    ]
    limestone_parts = [
        box("support_left", (0.16, 0.18, 0.10), (-0.22, -0.08, 0.05), limestone, rotation=(0, 0, -0.08), bevel_width=0.025),
        box("support_right", (0.16, 0.18, 0.10), (0.22, -0.08, 0.05), limestone, rotation=(0, 0, 0.08), bevel_width=0.025),
    ]

    final = [
        join_objects(staves, "MoonRainBarrel_Staves", wood),
        join_objects(bands, "MoonRainBarrel_Bands", zinc),
        join_objects(tap_parts, "MoonRainBarrel_Tap", brass),
        join_objects(lid_parts, "MoonRainBarrel_Lid", wood),
        join_objects(water_parts, "MoonRainBarrel_Water", water),
        join_objects(leaf_parts, "MoonRainBarrel_Leaf", leaf),
        join_objects(
            moon_stone_parts,
            "MoonRainBarrel_MoonStone",
            moon_stone,
        ),
        join_objects(
            limestone_parts,
            "MoonRainBarrel_LimestoneFeet",
            limestone,
        ),
    ]
    save_asset(name, output_dir, final)


GENERATORS: dict[str, Callable[[Path], None]] = {
    "StoneWalkway": generate_stone_walkway,
    "EnamelGardenLamp": generate_enamel_garden_lamp,
    "DoubleGardenLightPole": generate_double_garden_light_pole,
    "HazelLightArch": generate_hazel_light_arch,
    "RoofTileLantern": generate_roof_tile_lantern,
    "WickerGardenLantern": generate_wicker_garden_lantern,
    "WoodenHandLantern": generate_wooden_hand_lantern,
    "MoonRainBarrel": generate_moon_rain_barrel,
}


def main() -> None:
    args = parse_args()
    requested = args.assets or list(GENERATORS)
    unknown = sorted(set(requested) - set(GENERATORS))
    if unknown:
        raise ValueError(f"Unknown assets: {', '.join(unknown)}")
    for asset_name in requested:
        GENERATORS[asset_name](args.output_dir)


if __name__ == "__main__":
    main()
