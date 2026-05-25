import argparse
import json
import sys
from pathlib import Path

import bpy


ASSETS_DIR = Path(__file__).resolve().parent
MANIFEST_PATH = ASSETS_DIR / "game-assets.json"


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--skip-assets",
        action="store_true",
        help="Skip per-asset GLB export.",
    )
    parser.add_argument(
        "--types-output",
        help="Optional combined GLB output used only for TypeScript generation.",
    )
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def load_manifest():
    with MANIFEST_PATH.open("r", encoding="utf-8") as manifest_file:
        return json.load(manifest_file)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def purge_orphans():
    bpy.ops.outliner.orphans_purge(
        do_local_ids=True,
        do_linked_ids=True,
        do_recursive=True,
    )


def append_objects(source_blend, object_names):
    with bpy.data.libraries.load(str(source_blend), link=False) as (
        data_from,
        data_to,
    ):
        available = set(data_from.objects)
        missing = sorted(set(object_names) - available)
        if missing:
            raise RuntimeError(
                f"Missing objects in {source_blend}: {', '.join(missing)}"
            )
        data_to.objects = list(object_names)

    for obj in data_to.objects:
        if obj is not None:
            bpy.context.collection.objects.link(obj)


def export_glb(output_path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    export_options = {
        "filepath": str(output_path),
        "export_apply": True,
    }
    gltf_properties = bpy.ops.export_scene.gltf.get_rna_type().properties
    if "export_animation_mode" in gltf_properties:
        animation_modes = {
            item.identifier
            for item in gltf_properties["export_animation_mode"].enum_items
        }
        if "NLA_TRACKS" in animation_modes:
            export_options["export_animation_mode"] = "NLA_TRACKS"
    if "export_merge_animation" in gltf_properties:
        merge_modes = {
            item.identifier
            for item in gltf_properties["export_merge_animation"].enum_items
        }
        if "NLA_TRACK" in merge_modes:
            export_options["export_merge_animation"] = "NLA_TRACK"
    bpy.ops.export_scene.gltf(**export_options)
    print(f"Exported {output_path.relative_to(ASSETS_DIR.parent)}")


def export_asset(asset, source_dir, output_dir):
    source_path = source_dir / asset["source"]
    if not source_path.exists():
        raise RuntimeError(f"Missing split Blender file: {source_path}")

    bpy.ops.wm.open_mainfile(filepath=str(source_path))
    export_glb(output_dir / asset["output"])


def export_types_bundle(assets, source_dir, output_path):
    reset_scene()
    for asset in assets:
        source_path = source_dir / asset["source"]
        if not source_path.exists():
            raise RuntimeError(f"Missing split Blender file: {source_path}")
        append_objects(source_path, asset["objects"])
    purge_orphans()
    export_glb(output_path)


def export_assets():
    args = parse_args()
    manifest = load_manifest()
    source_dir = ASSETS_DIR / manifest["sourceDirectory"]
    output_dir = (ASSETS_DIR / manifest["outputDirectory"]).resolve()
    assets = manifest["assets"]

    if not args.skip_assets:
        for asset in assets:
            export_asset(asset, source_dir, output_dir)

    if args.types_output:
        export_types_bundle(assets, source_dir, Path(args.types_output).resolve())


if __name__ == "__main__":
    export_assets()
