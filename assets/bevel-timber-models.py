import argparse
import math
import sys
from pathlib import Path

import bpy


ASSETS_DIR = Path(__file__).resolve().parent / "game-assets"
MODIFIER_NAME = "Timber Bevel"
WEIGHT_NODE_NAME = "Timber Bevel Weight"
WEIGHT_ATTRIBUTE_NAME = "bevel_weight_edge"
BEVEL_SEGMENTS = 1
BEVEL_ANGLE = math.radians(30)
WEIGHTED_PLANK_GROUPS = {
    "Composter.blend": ("Plank",),
    "Fence.blend": ("Plank",),
    "RaisedBed.blend": ("Plank",),
    "Shade.blend": ("Plank", "Plank.001"),
    "Stool.blend": ("Plank",),
}
TARGET_OBJECTS = {
    "Bucket.blend": {"Bucket": 0.006},
    "Composter.blend": {"Composter": 0.008},
    "Fence.blend": {
        "Fence Corner": 0.01,
        "Fence Cross": 0.01,
        "Fence Middle": 0.01,
        "Fence Single": 0.01,
        "Fence Solo": 0.01,
        "Fence T": 0.01,
    },
    "GardenBox.blend": {
        "GardenBox_Body_Planks": 0.012,
        "GardenBox_Lid_HingeOrigin": 0.012,
    },
    "RaisedBed.blend": {
        "Raised Bed I": 0.008,
        "Raised Bed I Construction": 0.008,
        "Raised Bed L": 0.008,
        "Raised Bed O": 0.008,
        "Raised Bed U": 0.008,
    },
    "Shade.blend": {
        "Shade E": 0.008,
        "Shade Middle": 0.008,
        "Shade N": 0.008,
        "Shade S": 0.008,
        "Shade Single Left": 0.008,
        "Shade Single Right": 0.008,
        "Shade Solo": 0.008,
        "Shade W": 0.008,
    },
    "Stool.blend": {"Stool": 0.01},
    "WaterWell.blend": {"WaterWell_Wood_Frame": 0.012},
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Add soft bevels to older structural timber models.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Report bevel drift without saving Blender files.",
    )
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def values_match(left, right, epsilon=0.000_001):
    return abs(left - right) <= epsilon


def configure_plank_weight(node_group_name, drift):
    node_group = bpy.data.node_groups.get(node_group_name)
    if node_group is None:
        raise RuntimeError(f"Missing geometry node group {node_group_name}")

    output = next(
        (
            node
            for node in node_group.nodes
            if node.bl_idname == "NodeGroupOutput"
        ),
        None,
    )
    if output is None:
        raise RuntimeError(f"Missing Group Output in {node_group_name}")
    output_input = output.inputs.get("Geometry")
    if output_input is None or not output_input.is_linked:
        raise RuntimeError(f"Missing output geometry in {node_group_name}")

    weight_node = node_group.nodes.get(WEIGHT_NODE_NAME)
    if weight_node is None:
        drift.append(f"{node_group_name}/{WEIGHT_NODE_NAME}")
        weight_node = node_group.nodes.new("GeometryNodeStoreNamedAttribute")
        weight_node.name = WEIGHT_NODE_NAME
        weight_node.label = "Bevel structural timber edges"
    elif weight_node.bl_idname != "GeometryNodeStoreNamedAttribute":
        raise RuntimeError(
            f"{node_group_name}/{WEIGHT_NODE_NAME} is {weight_node.bl_idname}",
        )

    for property_name, expected_value in (
        ("data_type", "FLOAT"),
        ("domain", "EDGE"),
    ):
        if getattr(weight_node, property_name) == expected_value:
            continue
        drift.append(f"{node_group_name}/{WEIGHT_NODE_NAME}/{property_name}")
        setattr(weight_node, property_name, expected_value)

    for input_name, expected_value in (
        ("Selection", True),
        ("Name", WEIGHT_ATTRIBUTE_NAME),
        ("Value", 1.0),
    ):
        socket = weight_node.inputs[input_name]
        if socket.default_value == expected_value:
            continue
        drift.append(f"{node_group_name}/{WEIGHT_NODE_NAME}/{input_name}")
        socket.default_value = expected_value

    output_link = output_input.links[0]
    if output_link.from_node == weight_node:
        if not weight_node.inputs["Geometry"].is_linked:
            raise RuntimeError(
                f"Missing input geometry on {node_group_name}/{WEIGHT_NODE_NAME}",
            )
        return

    drift.append(f"{node_group_name}/{WEIGHT_NODE_NAME}/links")
    source_socket = output_link.from_socket
    node_group.links.remove(output_link)
    for link in tuple(weight_node.inputs["Geometry"].links):
        node_group.links.remove(link)
    node_group.links.new(source_socket, weight_node.inputs["Geometry"])
    node_group.links.new(weight_node.outputs["Geometry"], output_input)


def configure_bevel(obj, width, use_edge_weights, drift):
    modifier = obj.modifiers.get(MODIFIER_NAME)
    if modifier is None:
        drift.append(f"{obj.name}/{MODIFIER_NAME}")
        modifier = obj.modifiers.new(MODIFIER_NAME, "BEVEL")
    elif modifier.type != "BEVEL":
        raise RuntimeError(
            f"{obj.name}/{MODIFIER_NAME} is {modifier.type}, expected BEVEL",
        )

    expected = {
        "affect": "EDGES",
        "angle_limit": BEVEL_ANGLE,
        "harden_normals": True,
        "edge_weight": WEIGHT_ATTRIBUTE_NAME,
        "limit_method": "WEIGHT" if use_edge_weights else "ANGLE",
        "miter_outer": "MITER_ARC",
        "segments": BEVEL_SEGMENTS,
        "use_clamp_overlap": True,
        "width": width,
    }
    for property_name, expected_value in expected.items():
        actual_value = getattr(modifier, property_name)
        matches = (
            values_match(actual_value, expected_value)
            if isinstance(expected_value, float)
            else actual_value == expected_value
        )
        if matches:
            continue
        drift.append(f"{obj.name}/{MODIFIER_NAME}/{property_name}")
        setattr(modifier, property_name, expected_value)

    if obj.modifiers[-1] != modifier:
        drift.append(f"{obj.name}/{MODIFIER_NAME}/order")
        while obj.modifiers[-1] != modifier:
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.modifier_move_down(modifier=modifier.name)


def sync_asset(filename, object_widths, check_only):
    asset_path = ASSETS_DIR / filename
    bpy.ops.wm.open_mainfile(filepath=str(asset_path), load_ui=False)
    drift = []

    plank_groups = WEIGHTED_PLANK_GROUPS.get(filename, ())
    for node_group_name in plank_groups:
        configure_plank_weight(node_group_name, drift)

    for object_name, width in object_widths.items():
        obj = bpy.data.objects.get(object_name)
        if obj is None:
            raise RuntimeError(f"Missing object {object_name} in {filename}")
        configure_bevel(obj, width, bool(plank_groups), drift)

    if drift and not check_only:
        bpy.ops.wm.save_as_mainfile(filepath=str(asset_path))

    status = "drift" if drift else "ok"
    details = ", ".join(drift) if drift else "bevels already match"
    print(f"TIMBER_BEVEL {status}: {filename}: {details}")
    return bool(drift)


def main():
    args = parse_args()
    has_drift = False

    for filename, object_widths in TARGET_OBJECTS.items():
        has_drift |= sync_asset(
            filename,
            object_widths,
            check_only=args.check,
        )

    if args.check and has_drift:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
