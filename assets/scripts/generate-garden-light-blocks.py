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
    light = material("Material.StoneWalkway.LightStone", "#504C46", roughness=0.9)
    middle = material("Material.StoneWalkway.MidStone", "#484A46", roughness=0.92)
    warm = material("Material.StoneWalkway.WarmStone", "#4D463F", roughness=0.92)

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
    role_order = ("light", "middle", "warm", "light", "middle", "warm")
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
    wood = material("Material.EnamelGardenLamp.Wood", "#8A5B32", roughness=0.86)
    enamel = material(
        "Material.EnamelGardenLamp.BlueEnamel",
        "#497A88",
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
        cylinder("post", 0.044, 0.97, (-0.07, 0, 0.585), wood, vertices=10),
        tube_between("arm", (-0.07, 0, 1.04), (0.075, 0, 1.27), 0.032, wood),
    ]
    limestone_parts = [
        box(
            "limestone_foot",
            (0.22, 0.22, 0.10),
            (-0.07, 0, 0.05),
            limestone,
            rotation=(0, 0, 0.08),
            bevel_width=0.028,
        ),
        cylinder("limestone_socket", 0.075, 0.055, (-0.07, 0, 0.115), limestone, vertices=10),
    ]
    shade_parts = [
        cone("shade", 0.175, 0.068, 0.12, (0.075, 0, 1.20), enamel, vertices=14),
        cylinder("shade_neck", 0.07, 0.04, (0.075, 0, 1.28), enamel, vertices=14),
    ]
    trim_parts = [
        torus("shade_rim", 0.177, 0.012, (0.075, 0, 1.14), metal),
        cylinder("shade_cap", 0.035, 0.055, (0.075, 0, 1.325), metal, vertices=10),
        sphere("shade_finial", (0.025, 0.025, 0.035), (0.075, 0, 1.375), metal),
    ]
    bulb_parts = [
        sphere("bulb", (0.065, 0.065, 0.078), (0.075, 0, 1.075), glow),
        cylinder("bulb_neck", 0.027, 0.035, (0.075, 0, 1.145), glow, vertices=10),
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


def generate_hazel_light_arch(output_dir: Path) -> None:
    name = "HazelLightArch"
    reset_scene(name)
    hazel = material("Material.HazelLightArch.HazelWood", "#8B5A32", roughness=0.9)
    terracotta = material(
        "Material.HazelLightArch.Terracotta", "#B75D3E", roughness=0.84
    )
    cord = material("Material.HazelLightArch.DarkCord", "#3A2A20", roughness=0.92)
    glow = material(
        "Material.HazelLightArch.Glow",
        "#FFD582",
        roughness=0.3,
        emission_strength=2.6,
    )

    poles: list[bpy.types.Object] = []
    arch_points = (
        (-0.36, 0.0),
        (-0.36, 0.94),
        (-0.30, 1.18),
        (-0.16, 1.39),
        (0.0, 1.50),
        (0.16, 1.39),
        (0.30, 1.18),
        (0.36, 0.94),
        (0.36, 0.0),
    )
    for frame_index, y in enumerate((-0.82, 0.82)):
        for segment_index, ((x1, z1), (x2, z2)) in enumerate(
            zip(arch_points, arch_points[1:])
        ):
            poles.append(
                tube_between(
                    f"arch_{frame_index}_{segment_index}",
                    (x1, y, z1),
                    (x2, y, z2),
                    0.031 if segment_index in (0, 7) else 0.027,
                    hazel,
                )
            )
    poles.extend(
        [
            tube_between("ridge", (0, -0.82, 1.50), (0, 0.82, 1.50), 0.03, hazel),
            tube_between("left_rail", (-0.36, -0.82, 0.94), (-0.36, 0.82, 0.94), 0.025, hazel),
            tube_between("right_rail", (0.36, -0.82, 0.94), (0.36, 0.82, 0.94), 0.025, hazel),
        ]
    )

    cords: list[bpy.types.Object] = []
    shades: list[bpy.types.Object] = []
    bulbs: list[bpy.types.Object] = []
    for index, y in enumerate((-0.56, 0, 0.56)):
        cords.append(
            tube_between(f"cord_{index}", (0, y, 1.48), (0, y, 1.285), 0.007, cord, vertices=6)
        )
        shades.extend(
            [
                cone(
                    f"shade_{index}",
                    0.12,
                    0.042,
                    0.085,
                    (0, y, 1.245),
                    terracotta,
                    vertices=12,
                ),
                torus(f"shade_rim_{index}", 0.121, 0.009, (0, y, 1.202), terracotta),
            ]
        )
        bulbs.append(sphere(f"bulb_{index}", (0.048, 0.048, 0.06), (0, y, 1.145), glow))

    final = [
        join_objects(poles, "HazelLightArch_Poles", hazel),
        join_objects(shades, "HazelLightArch_TerracottaShades", terracotta),
        join_objects(cords, "HazelLightArch_Cords", cord),
        join_objects(bulbs, "HazelLightArch_Bulbs", glow),
    ]
    save_asset(name, output_dir, final)


def tile_with_leaf_opening(
    name: str,
    normal_axis: str,
    sign: int,
    value: bpy.types.Material,
) -> bpy.types.Object:
    width = 0.30
    height = 0.29
    thickness = 0.038
    center_height = 0.205
    radius = 0.185
    lean = 0.045
    outer = (
        (-width / 2, -height / 2),
        (width / 2, -height / 2),
        (width / 2, height / 2),
        (-width / 2, height / 2),
    )
    inner = ((0, -0.065), (0.06, 0), (0, 0.075), (-0.06, 0))
    profile = outer + inner

    def point(u: float, v: float, shell_side: float) -> tuple[float, float, float]:
        normalized_u = 2 * u / width
        convex_bulge = 0.018 * max(0, 1 - normalized_u * normalized_u)
        outward = sign * (
            radius
            + convex_bulge
            - (v / height) * lean
            + shell_side * thickness / 2
        )
        if normal_axis == "y":
            return (u, outward, center_height + v)
        return (outward, u, center_height + v)

    vertices = [point(u, v, shell_side) for shell_side in (-1, 1) for u, v in profile]
    faces: list[tuple[int, ...]] = []
    for current in range(4):
        following = (current + 1) % 4
        inner_current = 4 + current
        inner_following = 4 + following
        back_outer_current = 8 + current
        back_outer_following = 8 + following
        back_inner_current = 12 + current
        back_inner_following = 12 + following

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
        tile_with_leaf_opening("tile_front", "y", -1, terracotta),
        tile_with_leaf_opening("tile_back", "y", 1, terracotta),
        tile_with_leaf_opening("tile_left", "x", -1, terracotta),
        tile_with_leaf_opening("tile_right", "x", 1, terracotta),
    ]
    core = [
        box("stone_base", (0.36, 0.36, 0.065), (0, 0, 0.0325), limestone, bevel_width=0.022),
        cylinder("stone_core", 0.135, 0.235, (0, 0, 0.175), limestone, vertices=8),
        box("stone_cap", (0.25, 0.25, 0.045), (0, 0, 0.3375), limestone, bevel_width=0.015),
    ]
    glow_parts = [sphere("ember_core", (0.105, 0.105, 0.13), (0, 0, 0.19), glow)]

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
    profile = ((0.17, 0.155), (0.245, 0.25), (0.238, 0.40), (0.19, 0.545), (0.07, 0.635))
    for rib_index in range(8):
        angle = rib_index * math.tau / 8
        points = [
            (radius * math.cos(angle), radius * math.sin(angle), z)
            for radius, z in profile
        ]
        for segment_index, (start, end) in enumerate(zip(points, points[1:])):
            wicker_parts.append(
                tube_between(
                    f"rib_{rib_index}_{segment_index}",
                    start,
                    end,
                    0.0135,
                    wicker,
                    vertices=7,
                )
            )
    wicker_parts.extend(
        [
            torus("weave_low", 0.252, 0.013, (0, 0, 0.245), wicker),
            torus("weave_mid", 0.245, 0.013, (0, 0, 0.405), wicker),
            torus("weave_high", 0.198, 0.013, (0, 0, 0.548), wicker),
            sphere("wicker_cap", (0.055, 0.055, 0.035), (0, 0, 0.655), wicker),
        ]
    )
    terracotta_parts = [
        cylinder("terracotta_base", 0.19, 0.11, (0, 0, 0.055), terracotta, vertices=12),
    ]
    limestone_parts = [
        cylinder("limestone_plinth", 0.205, 0.05, (0, 0, 0.135), limestone, vertices=12),
        torus("limestone_rim", 0.207, 0.014, (0, 0, 0.16), limestone),
    ]
    glow_parts = [sphere("honey_core", (0.115, 0.115, 0.16), (0, 0, 0.35), glow)]

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
    wood = material("Material.WoodenHandLantern.Wood", "#7B4D2B", roughness=0.88)
    metal = material(
        "Material.WoodenHandLantern.DarkMetal", "#343536", metallic=0.5, roughness=0.42
    )
    glass = material(
        "Material.WoodenHandLantern.Glass", "#CBE5E6", alpha=0.28, roughness=0.12
    )
    glow = material(
        "Material.WoodenHandLantern.Glow",
        "#FFD078",
        roughness=0.28,
        emission_strength=2.8,
    )

    frame = [
        box("base", (0.40, 0.34, 0.07), (0, 0, 0.035), wood, bevel_width=0.018),
        box("top", (0.33, 0.28, 0.055), (0, 0, 0.405), wood, bevel_width=0.014),
        cone("roof", 0.22, 0.085, 0.11, (0, 0, 0.485), wood, vertices=4, rotation=(0, 0, math.pi / 4)),
    ]
    for x in (-0.17, 0.17):
        for y in (-0.14, 0.14):
            frame.append(box(f"post_{x}_{y}", (0.032, 0.032, 0.34), (x, y, 0.235), wood, bevel_width=0.006))

    handle_points = ((-0.14, 0, 0.515), (-0.17, 0, 0.565), (-0.09, 0, 0.625), (0, 0, 0.645), (0.09, 0, 0.625), (0.17, 0, 0.565), (0.14, 0, 0.515))
    handle = [
        tube_between(f"handle_{index}", start, end, 0.013, wood, vertices=8)
        for index, (start, end) in enumerate(zip(handle_points, handle_points[1:]))
    ]

    glass_parts = [
        box("glass_front", (0.285, 0.008, 0.27), (0, -0.139, 0.235), glass, bevel_width=0.003),
        box("glass_back", (0.285, 0.008, 0.27), (0, 0.139, 0.235), glass, bevel_width=0.003),
        box("glass_left", (0.008, 0.235, 0.27), (-0.169, 0, 0.235), glass, bevel_width=0.003),
        box("glass_right", (0.008, 0.235, 0.27), (0.169, 0, 0.235), glass, bevel_width=0.003),
    ]
    metal_parts = [
        cylinder("candle_cup", 0.066, 0.035, (0, 0, 0.095), metal, vertices=10),
        cylinder("roof_vent", 0.045, 0.035, (0, 0, 0.552), metal, vertices=10),
        box("latch", (0.028, 0.012, 0.09), (0.185, -0.145, 0.32), metal, bevel_width=0.003),
    ]
    glow_parts = [
        sphere("lamp_glow", (0.075, 0.075, 0.125), (0, 0, 0.245), glow),
        cylinder("wick", 0.013, 0.045, (0, 0, 0.34), glow, vertices=8),
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
    wood = material("Material.MoonRainBarrel.Wood", "#765034", roughness=0.9)
    zinc = material(
        "Material.MoonRainBarrel.Zinc", "#7E8B8A", metallic=0.45, roughness=0.5
    )
    brass = material(
        "Material.MoonRainBarrel.Brass", "#A67A38", metallic=0.55, roughness=0.4
    )
    water = material(
        "Material.MoonRainBarrel.Water",
        "#6BAFCA",
        alpha=0.64,
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
    lid_location = Vector((-0.145, 0.145, 0.845))
    lid_rotation = (-0.32, -0.32, 0.08)
    lid_normal = Euler(lid_rotation).to_matrix() @ Vector((0, 0, 1))
    grip_location = lid_location + lid_normal * 0.045

    staves = [
        cone("barrel_lower", 0.27, 0.31, 0.26, (0, 0, 0.13), wood, vertices=16),
        cylinder("barrel_middle", 0.31, 0.30, (0, 0, 0.41), wood, vertices=16),
        cone("barrel_upper", 0.31, 0.27, 0.22, (0, 0, 0.67), wood, vertices=16),
    ]
    for index in range(16):
        angle = index * math.tau / 16
        staves.append(
            box(
                f"stave_seam_{index}",
                (0.018, 0.022, 0.70),
                (0.302 * math.cos(angle), 0.302 * math.sin(angle), 0.40),
                wood,
                rotation=(0, 0, angle),
                bevel_width=0.004,
            )
        )

    bands = [
        torus(f"band_{index}", 0.327, 0.019, (0, 0, z), zinc)
        for index, z in enumerate((0.14, 0.42, 0.70))
    ]
    bands.append(
        torus(
            "lid_band",
            0.293,
            0.014,
            tuple(lid_location),
            zinc,
            rotation=lid_rotation,
        )
    )

    lid_parts = [
        cylinder(
            "tilted_lid",
            0.285,
            0.045,
            tuple(lid_location),
            wood,
            vertices=16,
            rotation=lid_rotation,
        ),
        box(
            "lid_grip",
            (0.10, 0.035, 0.035),
            tuple(grip_location),
            wood,
            rotation=lid_rotation,
            bevel_width=0.008,
        ),
    ]

    tap_parts = [
        tube_between("tap_body", (0, -0.295, 0.35), (0, -0.385, 0.35), 0.025, brass, vertices=10),
        tube_between("tap_spout", (0, -0.385, 0.35), (0, -0.385, 0.285), 0.021, brass, vertices=10),
        cylinder("tap_knob", 0.052, 0.018, (0, -0.35, 0.405), brass, vertices=8, rotation=(math.pi / 2, 0, 0)),
        tube_between("tap_stem", (0, -0.34, 0.35), (0, -0.34, 0.405), 0.012, brass, vertices=8),
    ]

    water_parts = [
        cylinder("water_surface", 0.255, 0.009, (0, 0, 0.795), water, vertices=24, bevel_width=0),
    ]
    leaf_parts = [
        sphere(
            "floating_leaf",
            (0.090, 0.045, 0.010),
            (0.12, -0.10, 0.807),
            leaf,
            rotation=(0, 0, -0.35),
        ),
        tube_between(
            "leaf_stem",
            (0.075, -0.105, 0.81),
            (0.02, -0.14, 0.812),
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
            (0.075, -0.075, 0.778),
            moon_stone,
        )
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
    ]
    save_asset(name, output_dir, final)


GENERATORS: dict[str, Callable[[Path], None]] = {
    "StoneWalkway": generate_stone_walkway,
    "EnamelGardenLamp": generate_enamel_garden_lamp,
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
