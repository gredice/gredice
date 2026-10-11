"""Author a decorative aster mound in the existing, unmodified low bowl.

Run with Blender --background --python-exit-code 1 --python <this file>.
Append -- --check to audit the saved source without rewriting it.
"""
import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
ASSET = "AutumnAsterPot"
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("pumpkin", Path(__file__).with_name("generate-harvest-pumpkins.py"))
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)


def flower(index, center, radius, tilt, petals, pollen, green):
    rotation = Matrix.Rotation(tilt[0], 4, "X") @ Matrix.Rotation(tilt[1], 4, "Y")

    def point(x, y, z):
        return Vector(center) + rotation @ Vector((x, y, z))

    parts = []
    for petal in range(10):
        angle = petal * math.tau / 10 + index * .23
        outline = [(.26, -.17, 0), (.72, -.21, .025), (1, -.09, .09),
                   (1, .09, .09), (.72, .21, .025), (.26, .17, 0)]
        vertices = []
        for lower in (False, True):
            for x, y, z in outline + [(.65, 0, .12)]:
                vertices.append(point(radius * (x * math.cos(angle) - y * math.sin(angle)),
                                      radius * (x * math.sin(angle) + y * math.cos(angle)),
                                      radius * z - (.014 if lower else 0)))
        faces = [(i, (i + 1) % 6, 6) for i in range(6)]
        faces += [(i + 7, 13, (i + 1) % 6 + 7) for i in range(6)]
        faces += [(i, i + 7, (i + 1) % 6 + 7, (i + 1) % 6) for i in range(6)]
        parts.append(shared.mesh(f"petal_{index}_{petal}", vertices, faces, petals))
    vertices = [point(math.cos(i * math.tau / 12) * radius * r,
                      math.sin(i * math.tau / 12) * radius * r, z)
                for r, z in [( .31, 0), (.30, .028), (.19, .043)] for i in range(12)]
    faces = [(j * 12 + i, j * 12 + (i + 1) % 12,
              (j + 1) * 12 + (i + 1) % 12, (j + 1) * 12 + i)
             for j in range(2) for i in range(12)]
    faces += [tuple(reversed(range(12))), tuple(range(24, 36))]
    disc = shared.mesh(f"disc_{index}", vertices, faces, pollen)
    bottom = Vector((center[0] * .3, center[1] * .3, .19))
    direction = Vector(center) - bottom
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=.018, radius2=.012,
                                   depth=direction.length, location=bottom + direction / 2)
    stalk = bpy.context.object
    stalk.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    stalk.data.materials.append(green)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return parts, disc, stalk


def generate():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene["asset_name"] = ASSET
    bpy.context.scene["generated_by"] = "assets/scripts/generate-autumn-aster-pot.py"
    bpy.context.scene["pot_profile"] = "PotLowBowl: original mesh and dimensions"
    with bpy.data.libraries.load(str(ROOT / "assets/game-assets/PotLowBowl.blend"), link=False) as (source, target):
        target.objects = ["PotVariant_01_Low_Bowl", "PotVariant_Soil_01"]
    for obj in target.objects:
        bpy.context.collection.objects.link(obj)
        soil = obj.name == "PotVariant_Soil_01"
        obj.name = ASSET + ("_Soil" if soil else "_Pot")
        obj.data.name = obj.name
        obj.data.materials.clear()
        obj.data.materials.append(shared.material("Material.AutumnAster." + ("Soil" if soil else "Terracotta"),
                                                 "3F2A1C" if soil else "C56C45"))
    petals = shared.material("Material.AutumnAster.Petals", "9B709C")
    pollen = shared.material("Material.AutumnAster.Centers", "D6B83F")
    green = shared.material("Material.AutumnAster.Foliage", "4E7F35")
    petals.node_tree.nodes.get("Principled BSDF").inputs["Roughness"].default_value = .95
    petals.roughness = .95
    all_petals, discs, foliage = [], [], []
    specs = [((0, 0, .555), .15, (0, 0)),
             ((-.19, -.15, .435), .14, (.24, -.25)),
             ((.18, -.16, .46), .14, (.24, .25)),
             ((-.16, .18, .475), .14, (-.24, -.25)),
             ((.18, .17, .425), .14, (-.24, .25))]
    for index, (center, radius, tilt) in enumerate(specs):
        bloom, disc, stalk = flower(index, center, radius, tilt, petals, pollen, green)
        all_petals.extend(bloom)
        discs.append(disc)
        foliage.append(stalk)
    # Broad lance-shaped leaves form a low mound without hiding the familiar rim.
    for i in range(16):
        angle = i * math.tau / 16
        outer = .27 if i % 2 else .30
        base = Vector((math.cos(angle) * .075, math.sin(angle) * .075, .23))
        tip = Vector((math.cos(angle) * outer, math.sin(angle) * outer, .34 + .025 * (i % 3)))
        mid = base.lerp(tip, .56)
        cross = Vector((-math.sin(angle) * .045, math.cos(angle) * .045, -.015))
        ridge = mid + Vector((0, 0, .03))
        vertices = [base, mid + cross, tip, mid - cross, ridge, mid - Vector((0, 0, .02))]
        faces = [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4),
                 (1, 0, 5), (2, 1, 5), (3, 2, 5), (0, 3, 5)]
        foliage.append(shared.mesh(f"leaf_{i}", vertices, faces, green))
    shared.join_parts(all_petals, ASSET + "_Petals")
    shared.join_parts(discs, ASSET + "_Centers")
    shared.join_parts(foliage, ASSET + "_Foliage")
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / f"assets/game-assets/{ASSET}.blend"))


def audit():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / f"assets/game-assets/{ASSET}.blend"))
    objects = list(bpy.context.scene.objects)
    assert {o.name for o in objects} == {ASSET + "_" + role for role in ("Pot", "Soil", "Foliage", "Petals", "Centers")}
    points = [o.matrix_world @ Vector(c) for o in objects for c in o.bound_box]
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    assert all(low[i] >= -.36 and high[i] <= .36 for i in (0, 1)), (low, high)
    assert abs(low[2]) < .0001 and high[2] <= .61, (low, high)
    triangles = 0
    for obj in objects:
        assert tuple(obj.location) == (0, 0, 0)
        assert tuple(obj.scale) == (1, 1, 1)
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        assert len(obj.data.materials) == 1
        shader = obj.data.materials[0].node_tree.nodes.get("Principled BSDF")
        assert shader.inputs["Metallic"].default_value == 0
        assert shader.inputs["Roughness"].default_value >= .85
        assert shader.inputs["Emission Strength"].default_value == 0
    assert triangles < 2500
    # Prove that the original pot geometry was copied, never remodelled or overwritten.
    with bpy.data.libraries.load(str(ROOT / "assets/game-assets/PotLowBowl.blend"), link=False) as (source, target):
        target.objects = ["PotVariant_01_Low_Bowl", "PotVariant_Soil_01"]
    for original, role in zip(target.objects, ("Pot", "Soil")):
        copied = bpy.data.objects[ASSET + "_" + role]
        assert [tuple(v.co) for v in original.data.vertices] == [tuple(v.co) for v in copied.data.vertices]
        assert [tuple(p.vertices) for p in original.data.polygons] == [tuple(p.vertices) for p in copied.data.polygons]
    print(json.dumps({"asset": ASSET, "triangles": triangles, "meshes": 5, "materials": 5, "boundsBlender": [low, high], "originalPotGeometryPreserved": True}))


if __name__ == "__main__":
    if "--check" not in sys.argv:
        generate()
    audit()
