import argparse
import sys
from pathlib import Path

import bpy


ASSETS_DIR = Path(__file__).resolve().parent / "game-assets"
REFERENCE_ASSET = "SmallWoodenBridge.blend"
REFERENCE_MATERIALS = {
    "deep": "Material.SmallWoodenBridge.DeepWood",
    "light": "Material.SmallWoodenBridge.LightWood",
    "warm": "Material.SmallWoodenBridge.WarmWood",
}
REFERENCE_PROFILE_INPUTS = (
    "Base Color",
    "Metallic",
    "Roughness",
    "IOR",
    "Specular IOR Level",
    "Coat Weight",
    "Coat Roughness",
    "Emission Color",
    "Emission Strength",
    "Alpha",
)
# The bridge's warm middle plank is the default in-game brown.
DEFAULT_WOOD_ROLE = "warm"
TARGET_MATERIALS = {
    "BeachChair.blend": {
        "BeachChair_LightWood": DEFAULT_WOOD_ROLE,
        "BeachChair_WarmWood": DEFAULT_WOOD_ROLE,
        "BeachChair_DarkWood": DEFAULT_WOOD_ROLE,
    },
    "BirdHouse.blend": {
        "BH_flat_light_wood": DEFAULT_WOOD_ROLE,
        "BH_flat_dark_wood": DEFAULT_WOOD_ROLE,
    },
    "Bucket.blend": {"Material.Planks": DEFAULT_WOOD_ROLE},
    "Composter.blend": {"Material.Planks": DEFAULT_WOOD_ROLE},
    "DogHouse.blend": {
        "Material.DogHouse.WarmTrim": DEFAULT_WOOD_ROLE,
        "Material.DogHouse.RedWood": DEFAULT_WOOD_ROLE,
        "Material.DogHouse.DarkRedWood": DEFAULT_WOOD_ROLE,
    },
    "Fence.blend": {"Material.Planks": DEFAULT_WOOD_ROLE},
    "GardenBox.blend": {"Material.Planks": DEFAULT_WOOD_ROLE},
    "IceCreamCart.blend": {
        "wood": DEFAULT_WOOD_ROLE,
        "wood_dark": DEFAULT_WOOD_ROLE,
    },
    "LemonadeStand.blend": {
        "tan": DEFAULT_WOOD_ROLE,
        "wood": DEFAULT_WOOD_ROLE,
        "wood_dark": DEFAULT_WOOD_ROLE,
        "wood_light": DEFAULT_WOOD_ROLE,
    },
    "RaisedBed.blend": {"Material.Planks": DEFAULT_WOOD_ROLE},
    "Shade.blend": {"Material.Planks": DEFAULT_WOOD_ROLE},
    "Stool.blend": {"Material.Planks": DEFAULT_WOOD_ROLE},
    "WaterWell.blend": {"Material.Planks": DEFAULT_WOOD_ROLE},
    "WoodenBench.blend": {
        "WoodenBench_LightWood": "light",
        "WoodenBench_WarmWood": "warm",
        "WoodenBench_DarkWood": "deep",
    },
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Apply the SmallWoodenBridge wood palette to timber props.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Report palette drift without saving Blender files.",
    )
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def get_principled_node(material):
    if not material.use_nodes or material.node_tree is None:
        raise RuntimeError(f"Material {material.name} does not use nodes")

    for node in material.node_tree.nodes:
        if node.bl_idname == "ShaderNodeBsdfPrincipled":
            return node

    raise RuntimeError(f"Material {material.name} has no Principled BSDF")


def load_reference_palette():
    bpy.ops.wm.open_mainfile(filepath=str(ASSETS_DIR / REFERENCE_ASSET), load_ui=False)
    palette = {}
    for role, material_name in REFERENCE_MATERIALS.items():
        material = bpy.data.materials.get(material_name)
        if material is None:
            raise RuntimeError(f"Missing reference material {material_name}")
        principled = get_principled_node(material)
        palette[role] = {}
        for input_name in REFERENCE_PROFILE_INPUTS:
            value = principled.inputs[input_name].default_value
            try:
                value = tuple(value)
            except TypeError:
                pass
            palette[role][input_name] = value
    return palette


def values_match(left, right, epsilon=0.000_001):
    try:
        return all(
            abs(a - b) <= epsilon for a, b in zip(left, right, strict=True)
        )
    except TypeError:
        return abs(left - right) <= epsilon


def sync_asset(filename, material_roles, palette, check_only):
    asset_path = ASSETS_DIR / filename
    bpy.ops.wm.open_mainfile(filepath=str(asset_path), load_ui=False)
    drift = []

    for material_name, role in material_roles.items():
        material = bpy.data.materials.get(material_name)
        if material is None:
            raise RuntimeError(f"Missing material {material_name} in {filename}")

        principled = get_principled_node(material)
        expected_profile = palette[role]
        material_drift = []
        for input_name, expected in expected_profile.items():
            socket = principled.inputs[input_name]
            if values_match(socket.default_value, expected):
                continue
            material_drift.append(input_name)
            if not check_only:
                socket.default_value = expected

        if not material_drift:
            continue

        drift.append(
            f"{material_name} -> {role} ({', '.join(material_drift)})",
        )
        if not check_only:
            material.diffuse_color = expected_profile["Base Color"]

    if drift and not check_only:
        bpy.ops.wm.save_as_mainfile(filepath=str(asset_path))

    status = "drift" if drift else "ok"
    details = ", ".join(drift) if drift else "palette already matches"
    print(f"WOOD_PALETTE {status}: {filename}: {details}")
    return bool(drift)


def main():
    args = parse_args()
    palette = load_reference_palette()
    has_drift = False

    for filename, material_roles in TARGET_MATERIALS.items():
        has_drift |= sync_asset(
            filename,
            material_roles,
            palette,
            check_only=args.check,
        )

    if args.check and has_drift:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
