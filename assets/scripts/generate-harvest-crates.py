"""Author decorative harvest crates with Blender; -- --check audits saved sources.

blender --background --python-exit-code 1 --python assets/scripts/generate-harvest-crates.py
Contents are fixed decoration, independent of real harvest rewards or inventory.
"""

import json
import math
import runpy
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ("HarvestCrate", "HarvestCrateOrchard")
ROLES = ("Timber", "Frame", "ProducePrimary", "ProduceSecondary", "Stems")
shared = runpy.run_path(str(Path(__file__).with_name("generate-garden-light-blocks.py")))
pumpkins = runpy.run_path(str(Path(__file__).with_name("generate-harvest-pumpkins.py")))
box = shared["box"]


def crate(timber, frame):
    # Three floor planks, two broad side slats and chunky corner battens.
    # Short-side handles are true openings, readable without textures.
    for y in (-.224, 0, .224):
        box("floor", (.825, .214, .06), (0, y, .03), timber, bevel_width=.008)
    for x in (-.3825, .3825):
        for y in (-.315, .315):
            box("corner", (.060, .060, .31), (x, y, .155), frame, bevel_width=.007)
    for y in (-.33, .33):
        for z in (.115, .235):
            box("long-slat", (.825, .055, .09), (0, y, z), timber, bevel_width=.008)
    for x in (-.393, .393):
        box("short-slat", (.055, .60, .09), (x, 0, .115), timber, bevel_width=.007)
        for y in (-.1975, .1975):
            box("handle-side", (.055, .205, .09), (x, y, .235), timber, bevel_width=.006)
        box("handle-bottom", (.055, .60, .025), (x, 0, .20), timber, bevel_width=.005)
        box("handle-top", (.055, .60, .025), (x, 0, .2975), timber, bevel_width=.005)


def orchard_fruit(name, x, y, radius, height, pear, body, stem):
    # Broad, untextured orchard silhouettes: a dipped apple crown and a pear
    # with a rounded belly and leaning narrow neck. No crop model dependencies.
    profile = ([(0, .38), (.10, .80), (.28, 1), (.48, .93), (.66, .64),
                (.83, .37), (.96, .26), (1, .12)] if pear else
               [(0, .30), (.10, .69), (.30, .94), (.57, 1), (.80, .93),
                (.96, .66), (.90, .18)])
    vertices = []
    segments = 12
    for z, width in profile:
        for i in range(segments):
            angle = 2 * math.pi * i / segments
            bend = .025 * z ** 2 if pear else 0
            r = radius * width * (1 + .04 * math.cos(5 * angle))
            vertices.append((x + bend + r * math.cos(angle),
                             y + r * math.sin(angle), .06 + z * height))
    faces = [tuple(reversed(range(segments)))]
    for ring in range(len(profile) - 1):
        for i in range(segments):
            a, b = ring * segments + i, ring * segments + (i + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    faces.append(tuple(range((len(profile) - 1) * segments, len(profile) * segments)))
    fruit = pumpkins["mesh"](name, vertices, faces, body)
    shared["recalculate_outside_normals"](fruit)
    top_x = x + (.025 if pear else 0)
    top_z = .06 + profile[-1][0] * height
    shared["tube_between"]("fruit-stem", (top_x, y, top_z - .009),
                           (top_x + .02, y + .01, top_z + .047), .008, stem, vertices=5)
    # One broad leaf reads as a single accent, rather than many tiny details.
    leaf = pumpkins["mesh"]("leaf", [(top_x, y, top_z + .025),
                             (top_x + .055, y - .035, top_z + .034),
                             (top_x + .08, y - .012, top_z + .028),
                             (top_x + .037, y + .016, top_z + .017)], [(0, 1, 2), (0, 2, 3)], stem)
    # A thin closed leaf is visible from all four rotations.
    shared["activate"](leaf)
    modifier = leaf.modifiers.new(name="Leaf thickness", type="SOLIDIFY")
    modifier.thickness = .003
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def generate(asset):
    shared["reset_scene"](asset)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.scene["generated_by"] = "assets/scripts/generate-harvest-crates.py"
    orchard = asset.endswith("Orchard")
    palette = ("905935", "764024", "AA563D" if orchard else "E08A3C",
               "7D8F68" if orchard else "EEE3CB", "4E7F35")
    mats = {role: shared["material"](f"Material.{asset}.{role}", color, roughness=.86)
            for role, color in zip(ROLES, palette)}
    timber, frame, primary, secondary, stem = (mats[role] for role in ROLES)
    crate(timber, frame)
    if orchard:
        for index, (x, y, r, h, pear) in enumerate([
            (-.205, -.145, .135, .27, False), (.065, -.16, .14, .28, False),
            (.22, .095, .125, .255, False), (-.17, .135, .14, .385, True),
            (.07, .085, .115, .36, True),
        ]):
            orchard_fruit(f"fruit-{index}", x, y, r, h, pear,
                          secondary if pear else primary, stem)
    else:
        for index, (r, h, x, y, cream) in enumerate([
            (.19, .34, -.175, .06, False), (.165, .30, .185, .105, True),
            (.14, .265, .09, -.19, False),
        ]):
            pair = pumpkins["fruit"](f"pumpkin-{index}", r, h, x, y, index * .19,
                                     False, secondary if cream else primary, stem)
            for obj in pair:
                for vertex in obj.data.vertices:
                    vertex.co.z += .06
    for role in ROLES:
        parts = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"
                 and obj.data.materials[0] == mats[role]]
        pumpkins["join_parts"](parts, f"{asset}_{role}")
        shared["apply_transforms"](parts[0])
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "assets/game-assets" / f"{asset}.blend"))


def audit(asset):
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / "assets/game-assets" / f"{asset}.blend"))
    objects = list(bpy.context.scene.objects)
    assert {obj.name for obj in objects} == {f"{asset}_{role}" for role in ROLES}
    points = [obj.matrix_world @ vertex.co for obj in objects for vertex in obj.data.vertices]
    low = [min(point[i] for point in points) for i in range(3)]
    high = [max(point[i] for point in points) for i in range(3)]
    assert all(low[i] >= -.45 and high[i] <= .45 for i in (0, 1)), (asset, low, high)
    assert abs(low[2]) < .0001 and .35 <= high[2] <= .55, (asset, low, high)
    triangles = 0
    for obj in objects:
        assert tuple(obj.location) == (0, 0, 0) and tuple(obj.scale) == (1, 1, 1)
        assert obj.animation_data is None and len(obj.data.materials) == 1
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        shader = obj.data.materials[0].node_tree.nodes.get("Principled BSDF")
        assert shader.inputs["Metallic"].default_value == 0
        assert .85 <= shader.inputs["Roughness"].default_value <= .87
        assert shader.inputs["Emission Strength"].default_value == 0
    assert triangles < 4500, triangles
    print(json.dumps({"asset": asset, "boundsBlender": [low, high],
                      "triangles": triangles, "meshes": len(objects), "materials": len(ROLES)}))


for name in ASSETS:
    if "--check" not in sys.argv:
        generate(name)
    audit(name)
