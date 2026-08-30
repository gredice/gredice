#!/usr/bin/env python3
"""Generate the first modular Gredice garden structure kit.

Run with Blender, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup \
      --python assets/scripts/generate-garden-structure-kit-v1.py

The source uses metres, Blender +Z as up, and Blender +Y as the front of an
edge. Every exported object has its origin at the semantic base centre so floor,
edge, roof, and prop nodes can be instanced on the one-metre structure grid.
The model is an original low-poly Croatian allotment kit built only from Blender
primitives; it imports no external meshes or textures.
"""

from __future__ import annotations

import math
from collections.abc import Iterable
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = ROOT / "assets/game-assets/GardenStructureKitV1.blend"
ASSET_PREFIX = "GardenStructureKitV1"

OBJECT_NAMES = (
    f"{ASSET_PREFIX}_FloorLimestone",
    f"{ASSET_PREFIX}_FloorStone",
    f"{ASSET_PREFIX}_FloorTimber",
    f"{ASSET_PREFIX}_WallTimber",
    f"{ASSET_PREFIX}_WallPlaster",
    f"{ASSET_PREFIX}_WallGreenhouseFrame",
    f"{ASSET_PREFIX}_WallGreenhouseGlass",
    f"{ASSET_PREFIX}_DoorTimberWideOpen",
    f"{ASSET_PREFIX}_DoorHouseOpen",
    f"{ASSET_PREFIX}_DoorGreenhouseOpenFrame",
    f"{ASSET_PREFIX}_DoorGreenhouseOpenGlass",
    f"{ASSET_PREFIX}_WindowHouseFrame",
    f"{ASSET_PREFIX}_WindowHouseGlass",
    f"{ASSET_PREFIX}_RoofGable",
    f"{ASSET_PREFIX}_RoofShed",
    f"{ASSET_PREFIX}_RoofGreenhouseGableFrame",
    f"{ASSET_PREFIX}_RoofGreenhouseGableGlass",
    f"{ASSET_PREFIX}_PropTable",
    f"{ASSET_PREFIX}_PropWorkbench",
    f"{ASSET_PREFIX}_PropPlanter",
    f"{ASSET_PREFIX}_PropChair",
    f"{ASSET_PREFIX}_PropShelf",
    f"{ASSET_PREFIX}_PropCrate",
)


def srgb_channel_to_linear(value: float) -> float:
    if value <= 0.04045:
        return value / 12.92
    return ((value + 0.055) / 1.055) ** 2.4


def rgba(hex_color: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    value = hex_color.removeprefix("#")
    if len(value) != 6:
        raise ValueError(f"Expected a six-digit colour, got {hex_color!r}")
    channels = [int(value[index : index + 2], 16) / 255 for index in (0, 2, 4)]
    return (
        *(srgb_channel_to_linear(channel) for channel in channels),
        alpha,
    )


def material(
    name: str,
    color: str,
    *,
    roughness: float,
    alpha: float = 1.0,
    metallic: float = 0.0,
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
        ior = principled.inputs.get("IOR")
        if ior is not None:
            ior.default_value = 1.45

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
    scene["generated_by"] = "assets/scripts/generate-garden-structure-kit-v1.py"
    scene["asset_name"] = ASSET_PREFIX
    scene["kit_key"] = "gredice-buildings"
    scene["kit_version"] = "1"
    scene["tile_edge_metres"] = 1.0
    scene["up_axis"] = "Blender +Z"
    scene["front_direction"] = "Blender +Y"
    scene["origin_convention"] = "semantic base centre"
    scene["originality_note"] = (
        "Original Gredice primitive model; no external meshes or textures imported"
    )


def activate(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def assign_material(obj: bpy.types.Object, value: bpy.types.Material) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(value)
    for polygon in obj.data.polygons:
        polygon.material_index = 0
        polygon.use_smooth = False


def apply_transforms(obj: bpy.types.Object) -> None:
    activate(obj)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def bevel(obj: bpy.types.Object, width: float) -> None:
    if width <= 0:
        return
    activate(obj)
    modifier = obj.modifiers.new(name="Kit soft edge", type="BEVEL")
    modifier.width = width
    modifier.segments = 1
    modifier.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier=modifier.name)


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
    obj.dimensions = size
    apply_transforms(obj)
    assign_material(obj, value)
    bevel(obj, min(bevel_width, min(size) * 0.18))
    return obj


def cylinder(
    name: str,
    radius: float,
    depth: float,
    location: tuple[float, float, float],
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
    apply_transforms(obj)
    assign_material(obj, value)
    bevel(obj, min(0.008, radius * 0.12))
    return obj


def compact_material_slots(obj: bpy.types.Object) -> None:
    materials: list[bpy.types.Material] = []
    material_indexes: dict[str, int] = {}
    polygon_material_names = [
        obj.data.materials[polygon.material_index].name
        for polygon in obj.data.polygons
    ]
    for value in obj.data.materials:
        if value.name not in material_indexes:
            material_indexes[value.name] = len(materials)
            materials.append(value)
    obj.data.materials.clear()
    for value in materials:
        obj.data.materials.append(value)
    for polygon, material_name in zip(
        obj.data.polygons, polygon_material_names, strict=True
    ):
        polygon.material_index = material_indexes[material_name]


def join_at_origin(
    objects: Iterable[bpy.types.Object],
    name: str,
    *,
    semantic_id: str,
    transparency: str = "opaque",
) -> bpy.types.Object:
    items = list(objects)
    if not items:
        raise ValueError(f"Cannot create empty kit node {name}")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in items:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = items[0]
    if len(items) > 1:
        bpy.ops.object.join()
    result = bpy.context.object
    result.name = name
    result.data.name = f"{name}_Mesh"
    compact_material_slots(result)
    # The kit has no textures. Removing primitive-generated UVs also prevents
    # irrelevant one-ULP bevel UV differences from changing the GLB hash.
    while result.data.uv_layers:
        result.data.uv_layers.remove(result.data.uv_layers[0])
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    result["semantic_id"] = semantic_id
    result["anchor"] = "base-centre"
    result["transparency"] = transparency
    return result


def generate_floors(materials: dict[str, bpy.types.Material]) -> list[bpy.types.Object]:
    limestone_parts: list[bpy.types.Object] = []
    for row in range(3):
        for column in range(3):
            width = 0.326 if column != 1 else 0.328
            depth = 0.326 if row != 1 else 0.328
            limestone_parts.append(
                box(
                    f"limestone_{row}_{column}",
                    (width, depth, 0.08),
                    (
                        -0.337 + column * 0.337,
                        -0.337 + row * 0.337,
                        0.04,
                    ),
                    materials["limestone"],
                    bevel_width=0.008,
                )
            )

    stone_parts = [
        box(
            f"stone_{index}",
            (0.494, 0.494, 0.08),
            (x, y, 0.04),
            materials["stone"],
            bevel_width=0.009,
        )
        for index, (x, y) in enumerate(
            ((-0.252, -0.252), (0.252, -0.252), (-0.252, 0.252), (0.252, 0.252))
        )
    ]

    timber_parts = [
        box(
            f"timber_plank_{index}",
            (0.194, 1.0, 0.08),
            (-0.402 + index * 0.201, 0, 0.04),
            materials["wood" if index % 2 == 0 else "wood_light"],
            bevel_width=0.006,
        )
        for index in range(5)
    ]

    return [
        join_at_origin(
            limestone_parts,
            f"{ASSET_PREFIX}_FloorLimestone",
            semantic_id="floor.limestone",
        ),
        join_at_origin(
            stone_parts,
            f"{ASSET_PREFIX}_FloorStone",
            semantic_id="floor.stone",
        ),
        join_at_origin(
            timber_parts,
            f"{ASSET_PREFIX}_FloorTimber",
            semantic_id="floor.timber",
        ),
    ]


def generate_walls(materials: dict[str, bpy.types.Material]) -> list[bpy.types.Object]:
    timber_parts = [
        box(
            f"timber_wall_board_{index}",
            (0.9, 0.09, 0.285),
            (0, 0, 0.19 + index * 0.29),
            materials["wood" if index % 2 == 0 else "wood_light"],
            bevel_width=0.008,
        )
        for index in range(8)
    ]
    timber_parts.extend(
        [
            box("timber_wall_post_left", (0.09, 0.12, 2.4), (-0.455, 0, 1.2), materials["wood_dark"]),
            box("timber_wall_post_right", (0.09, 0.12, 2.4), (0.455, 0, 1.2), materials["wood_dark"]),
            box("timber_wall_plinth", (1.0, 0.13, 0.12), (0, 0, 0.06), materials["limestone"]),
        ]
    )

    plaster_parts = [
        box("plaster_wall_body", (0.88, 0.1, 2.28), (0, 0, 1.26), materials["plaster"], bevel_width=0.018),
        box("plaster_wall_plinth", (1.0, 0.13, 0.16), (0, 0, 0.08), materials["limestone"]),
        box("plaster_wall_left_trim", (0.06, 0.12, 2.24), (-0.47, 0, 1.28), materials["green"]),
        box("plaster_wall_right_trim", (0.06, 0.12, 2.24), (0.47, 0, 1.28), materials["green"]),
    ]

    greenhouse_frame = [
        box("greenhouse_wall_left", (0.075, 0.08, 2.4), (-0.4625, 0, 1.2), materials["green"]),
        box("greenhouse_wall_right", (0.075, 0.08, 2.4), (0.4625, 0, 1.2), materials["green"]),
        box("greenhouse_wall_bottom", (0.85, 0.08, 0.075), (0, 0, 0.0375), materials["green"]),
        box("greenhouse_wall_middle", (0.85, 0.065, 0.055), (0, 0, 1.2), materials["green"]),
        box("greenhouse_wall_top", (0.85, 0.08, 0.075), (0, 0, 2.3625), materials["green"]),
    ]
    greenhouse_glass = [
        box("greenhouse_wall_glass", (0.84, 0.025, 2.28), (0, 0, 1.2), materials["glass"], bevel_width=0),
    ]

    return [
        join_at_origin(
            timber_parts,
            f"{ASSET_PREFIX}_WallTimber",
            semantic_id="wall.timber",
        ),
        join_at_origin(
            plaster_parts,
            f"{ASSET_PREFIX}_WallPlaster",
            semantic_id="wall.plaster",
        ),
        join_at_origin(
            greenhouse_frame,
            f"{ASSET_PREFIX}_WallGreenhouseFrame",
            semantic_id="wall.greenhouse-panel",
        ),
        join_at_origin(
            greenhouse_glass,
            f"{ASSET_PREFIX}_WallGreenhouseGlass",
            semantic_id="wall.greenhouse-panel",
            transparency="transparent",
        ),
    ]


def open_door_frame(
    prefix: str,
    opening_width: float,
    height: float,
    frame_material: bpy.types.Material,
) -> list[bpy.types.Object]:
    side_width = (1.0 - opening_width) / 2
    return [
        box(
            f"{prefix}_left",
            (side_width, 0.12, height),
            (-0.5 + side_width / 2, 0, height / 2),
            frame_material,
        ),
        box(
            f"{prefix}_right",
            (side_width, 0.12, height),
            (0.5 - side_width / 2, 0, height / 2),
            frame_material,
        ),
        box(
            f"{prefix}_lintel",
            (opening_width, 0.12, 2.4 - height),
            (0, 0, height + (2.4 - height) / 2),
            frame_material,
        ),
    ]


def generate_doors(materials: dict[str, bpy.types.Material]) -> list[bpy.types.Object]:
    timber = open_door_frame("timber_door", 0.88, 2.2, materials["wood_dark"])
    timber.extend(
        [
            box("timber_door_plinth", (1.0, 0.14, 0.08), (0, 0, 0.04), materials["limestone"]),
            box("timber_door_leaf", (0.055, 0.82, 2.08), (-0.415, 0.43, 1.04), materials["wood"]),
            box("timber_door_crossbrace", (0.07, 0.76, 0.08), (-0.382, 0.43, 1.05), materials["wood_light"], rotation=(0, math.radians(18), 0)),
            cylinder("timber_door_handle", 0.028, 0.08, (-0.365, 0.74, 1.04), materials["metal"], rotation=(0, math.pi / 2, 0), vertices=8),
        ]
    )

    house = open_door_frame("house_door", 0.82, 2.15, materials["plaster"])
    house.extend(
        [
            box("house_door_left_trim", (0.055, 0.14, 2.2), (-0.4375, 0, 1.1), materials["green"]),
            box("house_door_right_trim", (0.055, 0.14, 2.2), (0.4375, 0, 1.1), materials["green"]),
            box("house_door_top_trim", (0.82, 0.14, 0.055), (0, 0, 2.1775), materials["green"]),
            box("house_door_leaf", (0.052, 0.76, 2.03), (-0.39, 0.4, 1.015), materials["wood_light"]),
            cylinder("house_door_handle", 0.025, 0.075, (-0.35, 0.68, 1.0), materials["metal"], rotation=(0, math.pi / 2, 0), vertices=8),
        ]
    )

    greenhouse_frame = open_door_frame(
        "greenhouse_door", 0.84, 2.15, materials["green"]
    )
    greenhouse_frame.extend(
        [
            box("greenhouse_door_leaf_left", (0.055, 0.78, 2.05), (-0.405, 0.41, 1.025), materials["green"]),
            box("greenhouse_door_leaf_right", (0.055, 0.78, 2.05), (-0.345, 0.41, 1.025), materials["green"]),
            box("greenhouse_door_leaf_bottom", (0.11, 0.78, 0.055), (-0.375, 0.41, 0.0275), materials["green"]),
            box("greenhouse_door_leaf_top", (0.11, 0.78, 0.055), (-0.375, 0.41, 2.0225), materials["green"]),
            cylinder("greenhouse_door_handle", 0.022, 0.08, (-0.30, 0.7, 1.02), materials["metal"], rotation=(0, math.pi / 2, 0), vertices=8),
        ]
    )
    greenhouse_glass = [
        box(
            "greenhouse_door_glass_leaf",
            (0.025, 0.68, 1.89),
            (-0.375, 0.41, 1.025),
            materials["glass"],
            bevel_width=0,
        )
    ]

    return [
        join_at_origin(
            timber,
            f"{ASSET_PREFIX}_DoorTimberWideOpen",
            semantic_id="door.timber-wide-open",
        ),
        join_at_origin(
            house,
            f"{ASSET_PREFIX}_DoorHouseOpen",
            semantic_id="door.house-open",
        ),
        join_at_origin(
            greenhouse_frame,
            f"{ASSET_PREFIX}_DoorGreenhouseOpenFrame",
            semantic_id="door.greenhouse-open",
        ),
        join_at_origin(
            greenhouse_glass,
            f"{ASSET_PREFIX}_DoorGreenhouseOpenGlass",
            semantic_id="door.greenhouse-open",
            transparency="transparent",
        ),
    ]


def generate_window(materials: dict[str, bpy.types.Material]) -> list[bpy.types.Object]:
    frame = [
        box("window_house_lower", (1.0, 0.1, 0.7), (0, 0, 0.35), materials["plaster"], bevel_width=0.016),
        box("window_house_upper", (1.0, 0.1, 0.7), (0, 0, 2.05), materials["plaster"], bevel_width=0.016),
        box("window_house_left", (0.16, 0.1, 1.0), (-0.42, 0, 1.2), materials["plaster"]),
        box("window_house_right", (0.16, 0.1, 1.0), (0.42, 0, 1.2), materials["plaster"]),
        box("window_house_trim_left", (0.045, 0.14, 1.0), (-0.3025, 0, 1.2), materials["green"]),
        box("window_house_trim_right", (0.045, 0.14, 1.0), (0.3025, 0, 1.2), materials["green"]),
        box("window_house_trim_bottom", (0.56, 0.14, 0.045), (0, 0, 0.7225), materials["green"]),
        box("window_house_trim_top", (0.56, 0.14, 0.045), (0, 0, 1.6775), materials["green"]),
        box("window_house_mullion", (0.035, 0.135, 0.91), (0, 0, 1.2), materials["green"]),
        box("window_house_sill", (0.7, 0.18, 0.08), (0, 0.03, 0.7), materials["limestone"]),
    ]
    glass = [
        box("window_house_glass", (0.55, 0.024, 0.91), (0, 0, 1.2), materials["glass"], bevel_width=0)
    ]
    return [
        join_at_origin(
            frame,
            f"{ASSET_PREFIX}_WindowHouseFrame",
            semantic_id="window.house",
        ),
        join_at_origin(
            glass,
            f"{ASSET_PREFIX}_WindowHouseGlass",
            semantic_id="window.house",
            transparency="transparent",
        ),
    ]


def generate_roofs(materials: dict[str, bpy.types.Material]) -> list[bpy.types.Object]:
    gable_angle = math.atan2(0.65, 0.52)
    gable_slope = math.hypot(0.52, 0.65) + 0.06
    gable = [
        box(
            "gable_roof_left",
            (gable_slope, 1.08, 0.065),
            (-0.27, 0, 2.73),
            materials["terracotta"],
            rotation=(0, -gable_angle, 0),
            bevel_width=0.01,
        ),
        box(
            "gable_roof_right",
            (gable_slope, 1.08, 0.065),
            (0.27, 0, 2.73),
            materials["terracotta"],
            rotation=(0, gable_angle, 0),
            bevel_width=0.01,
        ),
        cylinder(
            "gable_roof_ridge",
            0.055,
            1.1,
            (0, 0, 3.065),
            materials["terracotta_dark"],
            rotation=(math.pi / 2, 0, 0),
            vertices=8,
        ),
    ]

    shed_rise = 0.46
    shed_angle = math.atan2(shed_rise, 1.0)
    shed = [
        box(
            "shed_roof_panel",
            (math.hypot(1.08, shed_rise), 1.08, 0.065),
            (0, 0, 2.59),
            materials["terracotta"],
            rotation=(0, -shed_angle, 0),
            bevel_width=0.01,
        ),
        box(
            "shed_roof_high_fascia",
            (0.065, 1.09, 0.13),
            (-0.5, 0, 2.82),
            materials["wood_dark"],
            bevel_width=0.008,
        ),
        box(
            "shed_roof_low_fascia",
            (0.065, 1.09, 0.13),
            (0.5, 0, 2.36),
            materials["wood_dark"],
            bevel_width=0.008,
        ),
    ]

    greenhouse_frame = [
        box(
            f"greenhouse_roof_rail_{side}",
            (0.055, 1.08, 0.055),
            (x, 0, z),
            materials["green"],
            rotation=(0, angle, 0),
            bevel_width=0.006,
        )
        for side, x, z, angle in (
            ("left", -0.28, 2.72, -gable_angle),
            ("right", 0.28, 2.72, gable_angle),
        )
    ]
    greenhouse_frame.extend(
        [
            cylinder("greenhouse_roof_ridge", 0.035, 1.1, (0, 0, 3.065), materials["green"], rotation=(math.pi / 2, 0, 0), vertices=8),
            box("greenhouse_roof_eave_left", (0.06, 1.1, 0.06), (-0.54, 0, 2.4), materials["green"], bevel_width=0.006),
            box("greenhouse_roof_eave_right", (0.06, 1.1, 0.06), (0.54, 0, 2.4), materials["green"], bevel_width=0.006),
            box("greenhouse_roof_cross_left", (gable_slope, 0.05, 0.05), (-0.27, 0, 2.73), materials["green"], rotation=(0, -gable_angle, 0), bevel_width=0.006),
            box("greenhouse_roof_cross_right", (gable_slope, 0.05, 0.05), (0.27, 0, 2.73), materials["green"], rotation=(0, gable_angle, 0), bevel_width=0.006),
        ]
    )
    greenhouse_glass = [
        box(
            "greenhouse_roof_glass_left",
            (gable_slope - 0.08, 1.0, 0.025),
            (-0.27, 0, 2.73),
            materials["glass"],
            rotation=(0, -gable_angle, 0),
            bevel_width=0,
        ),
        box(
            "greenhouse_roof_glass_right",
            (gable_slope - 0.08, 1.0, 0.025),
            (0.27, 0, 2.73),
            materials["glass"],
            rotation=(0, gable_angle, 0),
            bevel_width=0,
        ),
    ]

    return [
        join_at_origin(
            gable,
            f"{ASSET_PREFIX}_RoofGable",
            semantic_id="roof.gable",
        ),
        join_at_origin(
            shed,
            f"{ASSET_PREFIX}_RoofShed",
            semantic_id="roof.shed",
        ),
        join_at_origin(
            greenhouse_frame,
            f"{ASSET_PREFIX}_RoofGreenhouseGableFrame",
            semantic_id="roof.greenhouse-gable",
        ),
        join_at_origin(
            greenhouse_glass,
            f"{ASSET_PREFIX}_RoofGreenhouseGableGlass",
            semantic_id="roof.greenhouse-gable",
            transparency="transparent",
        ),
    ]


def table_parts(materials: dict[str, bpy.types.Material]) -> list[bpy.types.Object]:
    parts = [
        box("table_top", (0.74, 0.74, 0.08), (0, 0, 0.76), materials["wood_light"]),
        box("table_apron_front", (0.62, 0.06, 0.12), (0, 0.31, 0.67), materials["wood"]),
        box("table_apron_back", (0.62, 0.06, 0.12), (0, -0.31, 0.67), materials["wood"]),
    ]
    parts.extend(
        box(
            f"table_leg_{index}",
            (0.075, 0.075, 0.72),
            (x, y, 0.36),
            materials["wood_dark"],
            bevel_width=0.009,
        )
        for index, (x, y) in enumerate(
            ((-0.29, -0.29), (0.29, -0.29), (-0.29, 0.29), (0.29, 0.29))
        )
    )
    return parts


def generate_props(materials: dict[str, bpy.types.Material]) -> list[bpy.types.Object]:
    workbench = [
        box("workbench_top", (0.82, 0.5, 0.08), (0, 0, 0.88), materials["wood_light"]),
        box("workbench_lower_shelf", (0.72, 0.4, 0.055), (0, 0, 0.28), materials["wood"]),
        box("workbench_back_rail", (0.72, 0.055, 0.16), (0, -0.22, 0.76), materials["green"]),
    ]
    workbench.extend(
        box(
            f"workbench_leg_{index}",
            (0.075, 0.075, 0.86),
            (x, y, 0.43),
            materials["wood_dark"],
            bevel_width=0.009,
        )
        for index, (x, y) in enumerate(
            ((-0.35, -0.18), (0.35, -0.18), (-0.35, 0.18), (0.35, 0.18))
        )
    )

    planter = [
        box("planter_bottom", (0.64, 0.56, 0.07), (0, 0, 0.07), materials["wood_dark"]),
        box("planter_front", (0.72, 0.07, 0.48), (0, 0.285, 0.26), materials["wood"]),
        box("planter_back", (0.72, 0.07, 0.48), (0, -0.285, 0.26), materials["wood"]),
        box("planter_left", (0.07, 0.5, 0.48), (-0.325, 0, 0.26), materials["wood_light"]),
        box("planter_right", (0.07, 0.5, 0.48), (0.325, 0, 0.26), materials["wood_light"]),
        box("planter_soil", (0.61, 0.49, 0.045), (0, 0, 0.47), materials["soil"], bevel_width=0.006),
    ]

    chair = [
        box("chair_seat", (0.46, 0.44, 0.065), (0, 0, 0.46), materials["green"]),
        box("chair_back_top", (0.46, 0.06, 0.075), (0, -0.19, 0.82), materials["wood_light"]),
        box("chair_back_middle", (0.38, 0.05, 0.06), (0, -0.19, 0.67), materials["wood_light"]),
    ]
    chair.extend(
        box(
            f"chair_leg_{index}",
            (0.055, 0.055, 0.46 if index < 2 else 0.86),
            (x, y, (0.46 if index < 2 else 0.86) / 2),
            materials["wood_dark"],
            bevel_width=0.007,
        )
        for index, (x, y) in enumerate(
            ((-0.18, 0.17), (0.18, 0.17), (-0.18, -0.17), (0.18, -0.17))
        )
    )

    shelf = [
        box("shelf_left", (0.065, 0.3, 1.6), (-0.3575, 0, 0.8), materials["wood_dark"]),
        box("shelf_right", (0.065, 0.3, 1.6), (0.3575, 0, 0.8), materials["wood_dark"]),
        box("shelf_back_cross", (0.66, 0.04, 0.06), (0, -0.13, 0.83), materials["green"], rotation=(0, math.radians(-58), 0)),
    ]
    shelf.extend(
        box(
            f"shelf_board_{index}",
            (0.78, 0.3, 0.055),
            (0, 0, height),
            materials["wood_light" if index % 2 == 0 else "wood"],
        )
        for index, height in enumerate((0.12, 0.58, 1.04, 1.5))
    )

    crate = [
        box("crate_bottom", (0.43, 0.37, 0.05), (0, 0, 0.04), materials["wood_dark"]),
    ]
    for side, y in (("front", 0.185), ("back", -0.185)):
        crate.extend(
            box(
                f"crate_{side}_slat_{index}",
                (0.48, 0.045, 0.075),
                (0, y, 0.09 + index * 0.115),
                materials["wood_light" if index % 2 == 0 else "wood"],
                bevel_width=0.006,
            )
            for index in range(3)
        )
    for side, x in (("left", -0.2175), ("right", 0.2175)):
        crate.extend(
            box(
                f"crate_{side}_slat_{index}",
                (0.045, 0.33, 0.075),
                (x, 0, 0.09 + index * 0.115),
                materials["wood"],
                bevel_width=0.006,
            )
            for index in range(3)
        )

    return [
        join_at_origin(table_parts(materials), f"{ASSET_PREFIX}_PropTable", semantic_id="prop.table"),
        join_at_origin(workbench, f"{ASSET_PREFIX}_PropWorkbench", semantic_id="prop.workbench"),
        join_at_origin(planter, f"{ASSET_PREFIX}_PropPlanter", semantic_id="prop.planter"),
        join_at_origin(chair, f"{ASSET_PREFIX}_PropChair", semantic_id="prop.chair"),
        join_at_origin(shelf, f"{ASSET_PREFIX}_PropShelf", semantic_id="prop.shelf"),
        join_at_origin(crate, f"{ASSET_PREFIX}_PropCrate", semantic_id="prop.crate"),
    ]


def save_asset(objects: Iterable[bpy.types.Object]) -> None:
    items = list(objects)
    actual_names = {obj.name for obj in bpy.context.scene.objects}
    expected_names = set(OBJECT_NAMES)
    if actual_names != expected_names:
        raise RuntimeError(
            f"Unexpected kit objects; missing={sorted(expected_names - actual_names)}, "
            f"extra={sorted(actual_names - expected_names)}"
        )
    if any(obj.type != "MESH" for obj in items):
        raise RuntimeError("Garden structure kit must contain mesh objects only")
    for obj in items:
        if any(abs(value) > 0.000_001 for value in obj.location):
            raise RuntimeError(f"{obj.name} origin is not base-centred: {obj.location}")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_PATH), compress=True)
    triangles = sum(len(obj.data.loop_triangles) for obj in items)
    print(
        f"GENERATED {OUTPUT_PATH.relative_to(ROOT)} "
        f"objects={len(items)} materials={len(bpy.data.materials)} "
        f"triangles={triangles}"
    )


def main() -> None:
    reset_scene()
    materials = {
        "wood": material(f"Material.{ASSET_PREFIX}.WarmWood", "#8A5128", roughness=0.86),
        "wood_light": material(f"Material.{ASSET_PREFIX}.HoneyWood", "#B47B3D", roughness=0.84),
        "wood_dark": material(f"Material.{ASSET_PREFIX}.DarkWood", "#51301D", roughness=0.89),
        "plaster": material(f"Material.{ASSET_PREFIX}.LimePlaster", "#D8CBA8", roughness=0.93),
        "limestone": material(f"Material.{ASSET_PREFIX}.Limestone", "#B7A77E", roughness=0.91),
        "stone": material(f"Material.{ASSET_PREFIX}.GreyStone", "#777B74", roughness=0.94),
        "terracotta": material(f"Material.{ASSET_PREFIX}.Terracotta", "#A94C2E", roughness=0.88),
        "terracotta_dark": material(f"Material.{ASSET_PREFIX}.TerracottaDark", "#763621", roughness=0.9),
        "green": material(f"Material.{ASSET_PREFIX}.AllotmentGreen", "#426B50", roughness=0.82),
        "glass": material(f"Material.{ASSET_PREFIX}.Glass", "#A9D8D1", roughness=0.2, alpha=0.34),
        "metal": material(f"Material.{ASSET_PREFIX}.DarkMetal", "#343837", roughness=0.64, metallic=0.28),
        "soil": material(f"Material.{ASSET_PREFIX}.Soil", "#4A2F20", roughness=0.97),
    }
    objects = [
        *generate_floors(materials),
        *generate_walls(materials),
        *generate_doors(materials),
        *generate_window(materials),
        *generate_roofs(materials),
        *generate_props(materials),
    ]
    save_asset(objects)


if __name__ == "__main__":
    main()
