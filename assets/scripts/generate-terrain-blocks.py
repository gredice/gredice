#!/usr/bin/env python3
"""Generate original low-poly stone, gravel, and stair terrain assets.

Run with Blender, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python assets/scripts/generate-terrain-blocks.py \
      -- --output-dir assets/game-assets

The generated meshes use Blender's Z axis as vertical. The glTF exporter maps
that axis to Three.js Y. All assets stay inside one garden tile. Angled assets
rise linearly from zero at local X=-0.5 to 0.4 at local X=0.5. Stone stairs
follow the same direction, with horizontal treads at 0.2 and 0.4.
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Callable, Iterable
from pathlib import Path

import bpy
from mathutils import Vector


TILE_HALF_SIZE = 0.5
TERRAIN_HEIGHT = 0.4


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


def rgba(hex_color: str) -> tuple[float, float, float, float]:
    value = hex_color.removeprefix("#")
    if len(value) != 6:
        raise ValueError(f"Expected six-digit hex color, got {hex_color!r}")
    channels = [int(value[index : index + 2], 16) / 255 for index in (0, 2, 4)]
    return (*(srgb_channel_to_linear(channel) for channel in channels), 1.0)


def material(
    name: str,
    color: str,
    *,
    roughness: float,
) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    result.diffuse_color = rgba(color)
    result.metallic = 0
    result.roughness = roughness

    principled = result.node_tree.nodes.get("Principled BSDF")
    if principled is not None:
        principled.inputs["Base Color"].default_value = rgba(color)
        principled.inputs["Metallic"].default_value = 0
        principled.inputs["Roughness"].default_value = roughness

    return result


def reset_scene(asset_name: str) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene["generated_by"] = "assets/scripts/generate-terrain-blocks.py"
    scene["asset_name"] = asset_name


def activate(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_transforms(obj: bpy.types.Object) -> None:
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def assign_material(obj: bpy.types.Object, value: bpy.types.Material) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(value)
    for polygon in obj.data.polygons:
        polygon.material_index = 0


def bevel(obj: bpy.types.Object, width: float) -> None:
    if width <= 0:
        return
    activate(obj)
    modifier = obj.modifiers.new(name="Soft low-poly edges", type="BEVEL")
    modifier.width = width
    modifier.segments = 1
    modifier.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def box(
    name: str,
    *,
    x_bounds: tuple[float, float],
    y_bounds: tuple[float, float],
    height: float,
    value: bpy.types.Material,
    bevel_width: float,
) -> bpy.types.Object:
    x_min, x_max = x_bounds
    y_min, y_max = y_bounds
    bpy.ops.mesh.primitive_cube_add(
        location=(
            (x_min + x_max) / 2,
            (y_min + y_max) / 2,
            height / 2,
        )
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = (
        (x_max - x_min) / 2,
        (y_max - y_min) / 2,
        height / 2,
    )
    assign_material(obj, value)
    apply_transforms(obj)
    bevel(obj, min(bevel_width, height * 0.2))
    return obj


def wedge_height(local_x: float, maximum: float = TERRAIN_HEIGHT) -> float:
    return maximum * (local_x + TILE_HALF_SIZE)


def wedge_segment(
    name: str,
    *,
    x_bounds: tuple[float, float],
    y_bounds: tuple[float, float],
    maximum_height: float,
    value: bpy.types.Material,
    bevel_width: float,
) -> bpy.types.Object:
    x_min, x_max = x_bounds
    y_min, y_max = y_bounds
    low_height = wedge_height(x_min, maximum_height)
    high_height = wedge_height(x_max, maximum_height)

    if abs(low_height) < 0.000_001:
        vertices = [
            (x_min, y_min, 0),
            (x_min, y_max, 0),
            (x_max, y_min, 0),
            (x_max, y_max, 0),
            (x_max, y_min, high_height),
            (x_max, y_max, high_height),
        ]
        faces = [
            (0, 1, 3, 2),
            (0, 2, 4),
            (2, 3, 5, 4),
            (1, 5, 3),
            (0, 4, 5, 1),
        ]
    else:
        vertices = [
            (x_min, y_min, 0),
            (x_min, y_max, 0),
            (x_max, y_min, 0),
            (x_max, y_max, 0),
            (x_min, y_min, low_height),
            (x_min, y_max, low_height),
            (x_max, y_min, high_height),
            (x_max, y_max, high_height),
        ]
        faces = [
            (0, 1, 3, 2),
            (0, 4, 5, 1),
            (2, 3, 7, 6),
            (0, 2, 6, 4),
            (1, 5, 7, 3),
            (4, 6, 7, 5),
        ]

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    assign_material(obj, value)
    bevel(obj, bevel_width)
    return obj


def pebble(
    name: str,
    *,
    location: tuple[float, float],
    scale: tuple[float, float, float],
    peak_height: float,
    rotation: float,
    value: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler.z = rotation
    assign_material(obj, value)
    apply_transforms(obj)

    current_peak = max(vertex.co.z for vertex in obj.data.vertices)
    shift = Vector((location[0], location[1], peak_height - current_peak))
    for vertex in obj.data.vertices:
        vertex.co += shift
    obj.data.update()
    return obj


def join_objects(
    objects: Iterable[bpy.types.Object],
    name: str,
    value: bpy.types.Material,
) -> bpy.types.Object:
    items = list(objects)
    if not items:
        raise ValueError(f"Cannot create empty object {name}")
    if len(items) == 1:
        joined = items[0]
    else:
        bpy.ops.object.select_all(action="DESELECT")
        for obj in items:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = items[0]
        bpy.ops.object.join()
        joined = bpy.context.object
    joined.name = name
    assign_material(joined, value)
    return joined


def object_bounds(objects: Iterable[bpy.types.Object]) -> tuple[Vector, Vector]:
    vertices = [
        obj.matrix_world @ vertex.co
        for obj in objects
        if obj.type == "MESH"
        for vertex in obj.data.vertices
    ]
    return (
        Vector(min(vertex[index] for vertex in vertices) for index in range(3)),
        Vector(max(vertex[index] for vertex in vertices) for index in range(3)),
    )


def validate_bounds(
    asset_name: str,
    objects: Iterable[bpy.types.Object],
    *,
    x_bounds: tuple[float, float] = (-TILE_HALF_SIZE, TILE_HALF_SIZE),
    y_bounds: tuple[float, float] = (-TILE_HALF_SIZE, TILE_HALF_SIZE),
) -> tuple[Vector, Vector]:
    minimum, maximum = object_bounds(objects)
    expected_minimum = Vector((x_bounds[0], y_bounds[0], 0))
    expected_maximum = Vector((x_bounds[1], y_bounds[1], TERRAIN_HEIGHT))
    for axis in range(3):
        if abs(minimum[axis] - expected_minimum[axis]) > 0.000_01:
            raise RuntimeError(
                f"{asset_name} minimum axis {axis} is {minimum[axis]:.6f}, "
                f"expected {expected_minimum[axis]:.6f}"
            )
        if abs(maximum[axis] - expected_maximum[axis]) > 0.000_01:
            raise RuntimeError(
                f"{asset_name} maximum axis {axis} is {maximum[axis]:.6f}, "
                f"expected {expected_maximum[axis]:.6f}"
            )
    return minimum, maximum


def save_asset(
    asset_name: str,
    output_dir: Path,
    objects: Iterable[bpy.types.Object],
    *,
    x_bounds: tuple[float, float] = (-TILE_HALF_SIZE, TILE_HALF_SIZE),
    y_bounds: tuple[float, float] = (-TILE_HALF_SIZE, TILE_HALF_SIZE),
) -> None:
    items = list(objects)
    expected_names = {obj.name for obj in items}
    actual_names = {obj.name for obj in bpy.context.scene.objects}
    if actual_names != expected_names:
        raise RuntimeError(
            f"Unexpected objects in {asset_name}: {sorted(actual_names ^ expected_names)}"
        )
    minimum, maximum = validate_bounds(
        asset_name,
        items,
        x_bounds=x_bounds,
        y_bounds=y_bounds,
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = (output_dir / f"{asset_name}.blend").resolve()
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path), compress=True)
    print(
        f"GENERATED {asset_name}: {output_path} "
        f"bounds=({minimum.x:.4f},{minimum.y:.4f},{minimum.z:.4f}).."
        f"({maximum.x:.4f},{maximum.y:.4f},{maximum.z:.4f}) "
        f"objects={','.join(sorted(expected_names))}"
    )


def stone_materials() -> dict[str, bpy.types.Material]:
    return {
        "large": material("Material.BlockStone.Large", "#6D7273", roughness=0.88),
        "mid": material("Material.BlockStone.Mid", "#5C6264", roughness=0.91),
        "dark": material("Material.BlockStone.Dark", "#4C5355", roughness=0.94),
    }


def generate_block_stone(output_dir: Path) -> None:
    name = "BlockStone"
    reset_scene(name)
    materials = stone_materials()
    roles: dict[str, list[bpy.types.Object]] = {
        "large": [],
        "mid": [],
        "dark": [],
    }
    specs = (
        ("large", (-0.5, -0.15), (-0.5, -0.007)),
        ("dark", (-0.136, 0.136), (-0.5, -0.007)),
        ("mid", (0.15, 0.5), (-0.5, -0.007)),
        ("mid", (-0.5, -0.23), (0.007, 0.5)),
        ("large", (-0.216, 0.196), (0.007, 0.5)),
        ("dark", (0.21, 0.5), (0.007, 0.5)),
    )
    for index, (role, x_bounds, y_bounds) in enumerate(specs):
        roles[role].append(
            box(
                f"stone_{index}",
                x_bounds=x_bounds,
                y_bounds=y_bounds,
                height=TERRAIN_HEIGHT,
                value=materials[role],
                bevel_width=0.022,
            )
        )
    final = [
        join_objects(roles["large"], "Block_Stone_Large", materials["large"]),
        join_objects(roles["mid"], "Block_Stone_Mid", materials["mid"]),
        join_objects(roles["dark"], "Block_Stone_Dark", materials["dark"]),
    ]
    save_asset(name, output_dir, final)


def generate_block_stone_angle(output_dir: Path) -> None:
    name = "BlockStoneAngle"
    reset_scene(name)
    materials = stone_materials()
    roles: dict[str, list[bpy.types.Object]] = {
        "large": [],
        "mid": [],
        "dark": [],
    }
    specs = (
        ("large", (-0.5, -0.15), (-0.5, -0.007)),
        ("dark", (-0.136, 0.136), (-0.5, -0.007)),
        ("mid", (0.15, 0.5), (-0.5, -0.007)),
        ("mid", (-0.5, -0.23), (0.007, 0.5)),
        ("large", (-0.216, 0.196), (0.007, 0.5)),
        ("dark", (0.21, 0.5), (0.007, 0.5)),
    )
    for index, (role, x_bounds, y_bounds) in enumerate(specs):
        roles[role].append(
            wedge_segment(
                f"stone_angle_{index}",
                x_bounds=x_bounds,
                y_bounds=y_bounds,
                maximum_height=TERRAIN_HEIGHT,
                value=materials[role],
                # Preserve the wedge's zero-height boundary exactly. Other
                # masonry pieces retain broad low-poly bevels.
                bevel_width=(
                    0
                    if x_bounds[0] == -0.5 or x_bounds[1] == 0.5
                    else 0.014
                ),
            )
        )
    final = [
        join_objects(
            roles["large"],
            "Block_Stone_Angle_Large",
            materials["large"],
        ),
        join_objects(
            roles["mid"],
            "Block_Stone_Angle_Mid",
            materials["mid"],
        ),
        join_objects(
            roles["dark"],
            "Block_Stone_Angle_Dark",
            materials["dark"],
        ),
    ]
    save_asset(name, output_dir, final)


def gravel_materials() -> dict[str, bpy.types.Material]:
    return {
        "base": material("Material.BlockGravel.Base", "#747A7B", roughness=0.97),
        "light": material(
            "Material.BlockGravel.PiecesLight",
            "#9AA0A0",
            roughness=0.92,
        ),
        "dark": material(
            "Material.BlockGravel.PiecesDark",
            "#505759",
            roughness=0.96,
        ),
    }


GRAVEL_PEBBLES = (
    ("light", -0.35, -0.31, 0.058, 0.041, 0.016, 0.39),
    ("dark", -0.16, -0.36, 0.044, 0.031, 0.018, 1.08),
    ("light", 0.07, -0.31, 0.069, 0.043, 0.019, 2.18),
    ("dark", 0.31, -0.35, 0.052, 0.037, 0.017, 0.72),
    ("dark", -0.29, -0.08, 0.066, 0.037, 0.018, 2.75),
    ("light", -0.02, -0.11, 0.048, 0.034, 0.016, 0.14),
    ("dark", 0.23, -0.08, 0.073, 0.044, 0.019, 1.62),
    ("light", 0.39, 0.04, 0.043, 0.031, 0.015, 2.35),
    ("light", -0.37, 0.24, 0.049, 0.036, 0.017, 1.32),
    ("dark", -0.13, 0.18, 0.078, 0.047, 0.021, 0.48),
    ("light", 0.13, 0.27, 0.057, 0.039, 0.017, 2.94),
    ("dark", 0.35, 0.31, 0.064, 0.04, 0.019, 1.91),
)


def generate_block_gravel(output_dir: Path) -> None:
    name = "BlockGravel"
    reset_scene(name)
    materials = gravel_materials()
    base = box(
        "Block_Gravel_Base",
        x_bounds=(-0.5, 0.5),
        y_bounds=(-0.5, 0.5),
        height=0.388,
        value=materials["base"],
        bevel_width=0.012,
    )
    pieces: dict[str, list[bpy.types.Object]] = {"light": [], "dark": []}
    for index, (role, x, y, width, depth, height, rotation) in enumerate(
        GRAVEL_PEBBLES
    ):
        pieces[role].append(
            pebble(
                f"gravel_{index}",
                location=(x, y),
                scale=(width, depth, height),
                peak_height=0.394 + (index % 4) * 0.002,
                rotation=rotation,
                value=materials[role],
            )
        )
    final = [
        base,
        join_objects(
            pieces["light"],
            "Block_Gravel_Pieces_Light",
            materials["light"],
        ),
        join_objects(
            pieces["dark"],
            "Block_Gravel_Pieces_Dark",
            materials["dark"],
        ),
    ]
    save_asset(name, output_dir, final)


def generate_block_gravel_angle(output_dir: Path) -> None:
    name = "BlockGravelAngle"
    reset_scene(name)
    materials = gravel_materials()
    base = wedge_segment(
        "Block_Gravel_Angle_Base",
        x_bounds=(-0.5, 0.5),
        y_bounds=(-0.5, 0.5),
        maximum_height=0.388,
        value=materials["base"],
        bevel_width=0,
    )
    pieces: dict[str, list[bpy.types.Object]] = {"light": [], "dark": []}
    angle_pebbles = [spec for spec in GRAVEL_PEBBLES if spec[1] >= -0.3]
    angle_pebbles.append(("light", 0.46, -0.22, 0.035, 0.028, 0.014, 0.72))
    for index, (role, x, y, width, depth, height, rotation) in enumerate(
        angle_pebbles
    ):
        pieces[role].append(
            pebble(
                f"gravel_angle_{index}",
                location=(x, y),
                scale=(width, depth, height),
                peak_height=TERRAIN_HEIGHT if x >= 0.45 else wedge_height(x),
                rotation=rotation,
                value=materials[role],
            )
        )
    final = [
        base,
        join_objects(
            pieces["light"],
            "Block_Gravel_Angle_Pieces_Light",
            materials["light"],
        ),
        join_objects(
            pieces["dark"],
            "Block_Gravel_Angle_Pieces_Dark",
            materials["dark"],
        ),
    ]
    save_asset(name, output_dir, final)


def generate_stairs(
    output_dir: Path,
    *,
    asset_name: str,
    object_prefix: str,
    half_width: bool,
) -> None:
    reset_scene(asset_name)
    materials = stone_materials()
    roles: dict[str, list[bpy.types.Object]] = {
        "large": [],
        "mid": [],
        "dark": [],
    }
    if half_width:
        specs = (
            ("large", (-0.5, 0), (0, 0.243), 0.2),
            ("dark", (-0.5, 0), (0.257, 0.5), 0.2),
            ("mid", (0, 0.5), (0, 0.5), 0.4),
        )
        # Blender Y exports as runtime -Z, producing the requested runtime
        # half-tile footprint Z=-0.5..0 with a center offset of -0.25.
        expected_y_bounds = (0, 0.5)
    else:
        specs = (
            ("large", (-0.5, 0), (-0.5, 0.063), 0.2),
            ("dark", (-0.5, 0), (0.077, 0.5), 0.2),
            ("mid", (0, 0.5), (-0.5, -0.127), 0.4),
            ("large", (0, 0.5), (-0.113, 0.5), 0.4),
        )
        expected_y_bounds = (-0.5, 0.5)

    for index, (role, x_bounds, y_bounds, height) in enumerate(specs):
        roles[role].append(
            box(
                f"stair_{index}",
                x_bounds=x_bounds,
                y_bounds=y_bounds,
                height=height,
                value=materials[role],
                bevel_width=0.018,
            )
        )
    final = [
        join_objects(
            roles["large"],
            f"{object_prefix}_Large",
            materials["large"],
        ),
        join_objects(roles["mid"], f"{object_prefix}_Mid", materials["mid"]),
        join_objects(
            roles["dark"],
            f"{object_prefix}_Dark",
            materials["dark"],
        ),
    ]
    save_asset(
        asset_name,
        output_dir,
        final,
        y_bounds=expected_y_bounds,
    )


def generate_block_stone_stairs(output_dir: Path) -> None:
    generate_stairs(
        output_dir,
        asset_name="BlockStoneStairs",
        object_prefix="Block_Stone_Stairs",
        half_width=False,
    )


def generate_block_stone_stairs_half(output_dir: Path) -> None:
    generate_stairs(
        output_dir,
        asset_name="BlockStoneStairsHalf",
        object_prefix="Block_Stone_Stairs_Half",
        half_width=True,
    )


GENERATORS: dict[str, Callable[[Path], None]] = {
    "BlockStone": generate_block_stone,
    "BlockStoneAngle": generate_block_stone_angle,
    "BlockGravel": generate_block_gravel,
    "BlockGravelAngle": generate_block_gravel_angle,
    "BlockStoneStairs": generate_block_stone_stairs,
    "BlockStoneStairsHalf": generate_block_stone_stairs_half,
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
