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
        "--source",
        default=str(ASSETS_DIR / "GameAssets.blend"),
        help="Source Blender file to split.",
    )
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def load_manifest():
    with MANIFEST_PATH.open("r", encoding="utf-8") as manifest_file:
        return json.load(manifest_file)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


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


def split_assets():
    args = parse_args()
    source_blend = Path(args.source).resolve()
    manifest = load_manifest()
    output_dir = ASSETS_DIR / manifest["sourceDirectory"]
    output_dir.mkdir(parents=True, exist_ok=True)

    for asset in manifest["assets"]:
        reset_scene()
        append_objects(source_blend, asset["objects"])
        output_path = output_dir / asset["source"]
        bpy.ops.wm.save_as_mainfile(filepath=str(output_path))
        print(f"Saved {output_path.relative_to(ASSETS_DIR)}")


if __name__ == "__main__":
    split_assets()
