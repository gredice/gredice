import argparse
import sys
from pathlib import Path

import bpy


ASSETS_DIR = Path(__file__).resolve().parent / "game-assets"
RAISED_BED_PLANK_WIDTH = 0.08
RAISED_BED_SOIL_COLOR = (0.09, 0.041, 0.022, 1.0)
STOOL_SCALE = 0.8
STOOL_BASE_LOCAL_Z = -1.0
STOOL_BEVEL_GROUNDING_OFFSET = -0.002588


def parse_args():
    parser = argparse.ArgumentParser(
        description="Refine raised-bed and stool proportions.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Report proportion drift without saving Blender files.",
    )
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def values_match(left, right, epsilon=0.000_001):
    try:
        return all(
            abs(a - b) <= epsilon for a, b in zip(left, right, strict=True)
        )
    except TypeError:
        return abs(left - right) <= epsilon


def set_input(node_group, node_name, input_name, expected, drift):
    node = node_group.nodes.get(node_name)
    if node is None:
        raise RuntimeError(f"Missing node {node_name} in {node_group.name}")
    socket = node.inputs.get(input_name)
    if socket is None:
        raise RuntimeError(
            f"Missing input {input_name} on {node_name} in {node_group.name}",
        )
    if values_match(socket.default_value, expected):
        return
    drift.append(f"{node_group.name}/{node_name}/{input_name}")
    socket.default_value = expected


def get_geometry_group(object_name):
    obj = bpy.data.objects.get(object_name)
    if obj is None:
        raise RuntimeError(f"Missing object {object_name}")
    modifier = next((item for item in obj.modifiers if item.type == "NODES"), None)
    if modifier is None or modifier.node_group is None:
        raise RuntimeError(f"Missing geometry node modifier on {object_name}")
    return modifier.node_group


def get_principled_node(material):
    if material.node_tree is None:
        raise RuntimeError(f"Material {material.name} does not use nodes")
    for node in material.node_tree.nodes:
        if node.bl_idname == "ShaderNodeBsdfPrincipled":
            return node
    raise RuntimeError(f"Material {material.name} has no Principled BSDF")


def refine_raised_bed(check_only):
    asset_path = ASSETS_DIR / "RaisedBed.blend"
    bpy.ops.wm.open_mainfile(filepath=str(asset_path), load_ui=False)
    drift = []
    half_plank = RAISED_BED_PLANK_WIDTH / 2
    plank_center = 0.5 - half_plank
    closed_soil_half = 0.5 - RAISED_BED_PLANK_WIDTH
    open_soil_half = (0.5 + closed_soil_half) / 2
    open_soil_center = (0.5 - closed_soil_half) / 2

    group = get_geometry_group("Raised Bed O")
    set_input(group, "Transform Geometry.001", "Scale", (closed_soil_half, closed_soil_half, 0.125), drift)
    for node_name, position in (("Group.001", -plank_center), ("Group.002", plank_center)):
        set_input(group, node_name, "Thickness", RAISED_BED_PLANK_WIDTH, drift)
        set_input(group, node_name, "Translation", (0.0, position, -0.85), drift)
    for node_name, position in (("Group.003", -plank_center), ("Group.004", plank_center)):
        set_input(group, node_name, "Length", RAISED_BED_PLANK_WIDTH, drift)
        set_input(group, node_name, "Thickness", 2 * closed_soil_half, drift)
        set_input(group, node_name, "Translation", (position, 0.0, -0.85), drift)

    group = get_geometry_group("Raised Bed I")
    set_input(group, "Transform Geometry.001", "Scale", (closed_soil_half, 0.5, 0.125), drift)
    for node_name, position in (("Group.003", -plank_center), ("Group.004", plank_center)):
        set_input(group, node_name, "Length", RAISED_BED_PLANK_WIDTH, drift)
        set_input(group, node_name, "Translation", (position, 0.0, -0.85), drift)

    group = get_geometry_group("Raised Bed L")
    set_input(group, "Transform Geometry.001", "Translation", (open_soil_center, open_soil_center, -0.875), drift)
    set_input(group, "Transform Geometry.001", "Scale", (open_soil_half, open_soil_half, 0.125), drift)
    set_input(group, "Group.001", "Thickness", RAISED_BED_PLANK_WIDTH, drift)
    set_input(group, "Group.001", "Translation", (0.0, -plank_center, -0.85), drift)
    set_input(group, "Group.003", "Length", RAISED_BED_PLANK_WIDTH, drift)
    set_input(group, "Group.003", "Thickness", 0.5 + closed_soil_half, drift)
    set_input(group, "Group.003", "Translation", (-plank_center, open_soil_center, -0.85), drift)
    set_input(group, "Group.002", "Length", RAISED_BED_PLANK_WIDTH, drift)
    set_input(group, "Group.002", "Thickness", RAISED_BED_PLANK_WIDTH, drift)
    set_input(group, "Group.002", "Translation", (plank_center, plank_center, -0.85), drift)

    group = get_geometry_group("Raised Bed U")
    set_input(group, "Transform Geometry.001", "Translation", (open_soil_center, 0.0, -0.875), drift)
    set_input(group, "Transform Geometry.001", "Scale", (open_soil_half, closed_soil_half, 0.125), drift)
    for node_name, position in (("Group.001", -plank_center), ("Group.002", plank_center)):
        set_input(group, node_name, "Thickness", RAISED_BED_PLANK_WIDTH, drift)
        set_input(group, node_name, "Translation", (0.0, position, -0.85), drift)
    set_input(group, "Group.003", "Length", RAISED_BED_PLANK_WIDTH, drift)
    set_input(group, "Group.003", "Thickness", 2 * closed_soil_half, drift)
    set_input(group, "Group.003", "Translation", (-plank_center, 0.0, -0.85), drift)

    group = get_geometry_group("Raised Bed I Construction")
    for node_name in ("Group", "Group.001", "Group.002"):
        set_input(group, node_name, "Thickness", RAISED_BED_PLANK_WIDTH, drift)

    dirt = bpy.data.materials.get("Material.Dirt")
    if dirt is None:
        raise RuntimeError("Missing Material.Dirt in RaisedBed.blend")
    base_color = get_principled_node(dirt).inputs["Base Color"]
    if not values_match(base_color.default_value, RAISED_BED_SOIL_COLOR):
        drift.append("Material.Dirt/Base Color")
        base_color.default_value = RAISED_BED_SOIL_COLOR
        dirt.diffuse_color = RAISED_BED_SOIL_COLOR

    if drift and not check_only:
        bpy.ops.wm.save_as_mainfile(filepath=str(asset_path))
    print(
        f"TIMBER_PROPORTIONS {'drift' if drift else 'ok'}: RaisedBed.blend: "
        + (", ".join(drift) if drift else "geometry already matches"),
    )
    return bool(drift)


def refine_stool(check_only):
    asset_path = ASSETS_DIR / "Stool.blend"
    bpy.ops.wm.open_mainfile(filepath=str(asset_path), load_ui=False)
    drift = []
    group = get_geometry_group("Stool")
    output = group.nodes.get("Group Output")
    realized = group.nodes.get("Realize Instances")
    if output is None or realized is None:
        raise RuntimeError("Missing stool output geometry nodes")

    transform = group.nodes.get("TimberScale")
    if transform is None:
        drift.append("Geometry - Stool/TimberScale")
        transform = group.nodes.new("GeometryNodeTransform")
        transform.name = "TimberScale"
        transform.label = "Grounded 80% scale"

    set_input(
        group,
        "TimberScale",
        "Translation",
        (
            0.0,
            0.0,
            STOOL_BASE_LOCAL_Z * (1 - STOOL_SCALE)
            + STOOL_BEVEL_GROUNDING_OFFSET,
        ),
        drift,
    )
    set_input(group, "TimberScale", "Scale", (STOOL_SCALE,) * 3, drift)

    geometry_input = transform.inputs["Geometry"]
    if not geometry_input.is_linked or geometry_input.links[0].from_node != realized:
        drift.append("Geometry - Stool/Realize Instances -> TimberScale")
        group.links.new(realized.outputs["Geometry"], geometry_input)
    output_input = output.inputs["Geometry"]
    if not output_input.is_linked or output_input.links[0].from_node != transform:
        drift.append("Geometry - Stool/TimberScale -> Group Output")
        group.links.new(transform.outputs["Geometry"], output_input)

    if drift and not check_only:
        bpy.ops.wm.save_as_mainfile(filepath=str(asset_path))
    print(
        f"TIMBER_PROPORTIONS {'drift' if drift else 'ok'}: Stool.blend: "
        + (", ".join(drift) if drift else "geometry already matches"),
    )
    return bool(drift)


def main():
    args = parse_args()
    has_drift = refine_raised_bed(args.check)
    has_drift |= refine_stool(args.check)
    if args.check and has_drift:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
