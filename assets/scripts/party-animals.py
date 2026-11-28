"""Rebuild animals as party-toy characters from their design modules.

Each animal has a design module, `assets/scripts/party_animals/<name>.py`,
that rebuilds every mesh node of `assets/game-assets/<Name>.blend` from the
shared kit (`party_animals/kit.py`) and sets its colours. Node names,
transforms, parents, animations and material names never change. The rules
are in GAME_ART.md, "Animals".

Run from the repository root, then export the asset as usual:

    /Applications/Blender.app/Contents/MacOS/Blender -b \\
        --python assets/scripts/party-animals.py -- --asset Cow --asset Cat
    (cd assets && Blender -b --python export-game-assets.py -- --asset Cow)

Options:
    --asset Name   animal to rebuild (repeatable, required)
    --out-dir DIR  save the rebuilt .blend there instead of over the source
    --glb-dir DIR  also export <Name>.glb there with the repo's settings
                   (for scratch reviews; the repo GLB comes from
                   export-game-assets.py)
    --no-checks    skip the grounding, attachment, size and thickness report

The build starts from scratch every time (it reads only the rig, never the
current meshes), so running it again gives the same result.
"""

import argparse
import importlib
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

import party_style  # noqa: E402
from party_animals import kit  # noqa: E402

ASSETS_DIR = SCRIPTS.parent / "game-assets"


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", action="append", default=[], required=True)
    parser.add_argument("--out-dir")
    parser.add_argument("--glb-dir")
    parser.add_argument("--no-checks", action="store_true")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(argv)


def run(name, args):
    module = importlib.import_module(f"party_animals.{name.lower()}")
    source = ASSETS_DIR / f"{name}.blend"
    bpy.ops.wm.open_mainfile(filepath=str(source))
    kit.REBUILT.clear()
    module.build(kit, party_style)
    prefix = module.PREFIX
    missing = [o.name for o in kit.mesh_objects(prefix) if o.name not in kit.REBUILT]
    if missing:
        raise RuntimeError(f"{name}: these mesh nodes were not rebuilt: {', '.join(missing)}")
    kit.remove_party_sources(prefix)
    bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

    target = Path(args.out_dir) / f"{name}.blend" if args.out_dir else source
    target.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(target))
    backup = target.with_suffix(".blend1")
    if backup.exists():
        backup.unlink()
    print(f"Rebuilt {name} -> {target}")
    if args.glb_dir:
        glb = Path(args.glb_dir) / f"{name}.glb"
        glb.parent.mkdir(parents=True, exist_ok=True)
        kit.export_glb(glb)
        print(f"Exported {glb}")
    if not args.no_checks:
        # Checks pose the rig; they run after saving and nothing is saved after.
        module.check(kit)


def main():
    args = parse_args()
    for name in args.asset:
        run(name, args)


if __name__ == "__main__":
    main()
