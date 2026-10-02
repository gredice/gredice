"""Author the static, two-cell HarvestWheelbarrow; -- --check audits the source."""

import json
import math
import runpy
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
NAME = "HarvestWheelbarrow"
ROLES = ("Timber", "Frame", "Hardware", "Pumpkins", "Cream", "Stems")
shared = runpy.run_path(str(Path(__file__).with_name("generate-garden-light-blocks.py")))
pumpkins = runpy.run_path(str(Path(__file__).with_name("generate-harvest-pumpkins.py")))
box, tube = shared["box"], shared["tube_between"]


def generate():
    shared["reset_scene"](NAME)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.scene["generated_by"] = "assets/scripts/generate-harvest-wheelbarrow.py"
    mats = {role: shared["material"](f"Material.{NAME}.{role}", color, roughness=.86)
            for role, color in zip(ROLES, ("905935", "764024", "313536", "E08A3C", "EEE3CB", "4E7F35"))}
    timber, frame, hardware, orange, cream, stems = (mats[role] for role in ROLES)

    # One open, sixteen-sided timber wheel with a restrained charcoal band.
    # Its lowest point and the two rear feet share the exact support plane.
    wheel_x, wheel_z, radius = -.69, .24, .24
    vertices = []
    for y, r in [(-.052, radius), (.052, radius), (-.052, .178), (.052, .178)]:
        vertices += [(wheel_x + r * math.cos(i * math.tau / 16), y,
                      wheel_z + r * math.sin(i * math.tau / 16)) for i in range(16)]
    faces = []
    for a, b in [(0, 1), (1, 3), (3, 2), (2, 0)]:
        for i in range(16):
            j = (i + 1) % 16
            faces.append((a * 16 + i, a * 16 + j, b * 16 + j, b * 16 + i))
    band = pumpkins["mesh"]("wheel-band", vertices, faces, hardware)
    shared["recalculate_outside_normals"](band)
    for i in range(6):
        angle = i * math.tau / 6
        tube("wheel-spoke", (wheel_x, 0, wheel_z),
             (wheel_x + .19 * math.cos(angle), 0, wheel_z + .19 * math.sin(angle)),
             .026, frame, vertices=6)
    shared["cylinder"]("wheel-hub", .063, .19, (wheel_x, 0, wheel_z), timber,
                       vertices=12, rotation=(math.pi / 2, 0, 0))
    tube("axle", (wheel_x, -.265, wheel_z), (wheel_x, .265, wheel_z), .024, hardware)

    # Splayed rails rise towards the two handles. Square-ended grips and
    # diagonal feet keep it recognisably a parked wheelbarrow, not a cart.
    for side in (-1, 1):
        tube("running-rail", (-.71, side * .20, .265), (.89, side * .32, .55),
             .04, frame, vertices=4)
        box("grip", (.24, .085, .085), (.80, side * .32, .535), timber,
            rotation=(0, -.16, 0), bevel_width=.014)
        tube("rear-leg", (.23, side * .245, .43), (.38, side * .31, .04),
             .037, frame, vertices=4)
        box("foot", (.18, .085, .044), (.39, side * .31, .022), frame, bevel_width=.007)
    tube("rear-brace", (.25, -.245, .40), (.25, .245, .40), .025, frame, vertices=4)

    # Build a flared, open slatted tray and its load together, then pitch it
    # six degrees towards the wheel. The fruit rests on the floor, not in air.
    before_tray = set(bpy.context.scene.objects)
    for y in (-.18, 0, .18):
        box("tray-floor", (.88, .172, .055), (-.03, y, .0275), timber, bevel_width=.008)
    for side in (-1, 1):
        for z in (.12, .245):
            box("tray-side", (1.00, .05, .103), (-.03, side * (.272 + z * .28), z), timber,
                rotation=(side * -.24, 0, 0), bevel_width=.009)
        box("tray-rim", (1.08, .065, .055), (-.03, side * .356, .315), frame, bevel_width=.01)
    for x in (-.48, .42):
        for z in (.12, .245):
            box("tray-end", (.05, .57 + z * .53, .103), (x, 0, z), timber, bevel_width=.008)
    for i, (x, y, r, h, pale) in enumerate([
        (-.22, .035, .23, .39, False), (.22, .10, .175, .31, True),
        (.13, -.185, .155, .275, False),
    ]):
        pair = pumpkins["fruit"](f"pumpkin-{i}", r, h, x, y, i * .2, False,
                                 cream if pale else orange, stems)
        for obj in pair:
            for vertex in obj.data.vertices:
                vertex.co.z += .055
    tilt = Matrix.Translation(Vector((0, 0, .415))) @ Matrix.Rotation(-.105, 4, "Y")
    for obj in set(bpy.context.scene.objects) - before_tray:
        obj.data.transform(tilt)

    for role in ROLES:
        parts = [obj for obj in bpy.context.scene.objects
                 if obj.type == "MESH" and obj.data.materials[0] == mats[role]]
        pumpkins["join_parts"](parts, f"{NAME}_{role}")
        shared["apply_transforms"](parts[0])
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "assets/game-assets" / f"{NAME}.blend"))


def audit():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / "assets/game-assets" / f"{NAME}.blend"))
    objects = list(bpy.context.scene.objects)
    assert {obj.name for obj in objects} == {f"{NAME}_{role}" for role in ROLES}
    points = [obj.matrix_world @ v.co for obj in objects for v in obj.data.vertices]
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    assert low[0] >= -.95 and high[0] <= .95 and low[1] >= -.45 and high[1] <= .45, (low, high)
    assert abs(low[2]) < .0001 and high[2] <= .9, (low, high)
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
    assert triangles < 5000, triangles
    print(json.dumps({"asset": NAME, "boundsBlender": [low, high],
                      "triangles": triangles, "meshes": len(objects), "materials": len(ROLES)}))


if __name__ == "__main__":
    if "--check" not in sys.argv:
        generate()
    audit()
