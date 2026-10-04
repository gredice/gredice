"""Author/audit the original static GardenScarecrow source with Blender.

blender --background --python-exit-code 1 --python assets/scripts/generate-garden-scarecrow.py
Append -- --check to audit the saved source without rewriting it.
"""

import json
import math
import runpy
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
ASSET = "GardenScarecrow"
ROLES = ("Timber", "Straw", "Linen", "Shirt", "Patch", "Face")
# Reuse the existing garden family's material conversion, bevels and primitives.
shared = runpy.run_path(str(Path(__file__).with_name("generate-garden-light-blocks.py")))
box, tube, sphere = (shared[key] for key in ("box", "tube_between", "sphere"))


def mesh(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(mat)
    shared["recalculate_outside_normals"](obj)
    return obj


def hat_ring(name, rings, mat):
    vertices = []
    for x, z, rx, ry, curl in rings:
        for index in range(12):
            angle = 2 * math.pi * index / 12
            vertices.append((x + rx * math.cos(angle), ry * math.sin(angle),
                             z + .035 * math.cos(angle) + curl * max(0, math.cos(angle))))
    faces = [tuple(reversed(range(12)))]
    for ring in range(len(rings) - 1):
        for index in range(12):
            a, b = ring * 12 + index, ring * 12 + (index + 1) % 12
            faces.append((a, b, b + 12, a + 12))
    faces.append(tuple(range((len(rings) - 1) * 12, len(rings) * 12)))
    return mesh(name, vertices, faces, mat)


def generate():
    shared["reset_scene"](ASSET)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.scene["generated_by"] = "assets/scripts/generate-garden-scarecrow.py"
    palette = ("905935", "D6B83F", "EEE3CB", "2F5E83", "AA563D", "313536")
    mats = {role: shared["material"](f"Material.{ASSET}.{role}", color,
                                    roughness=.86 if role == "Timber" else .95)
            for role, color in zip(ROLES, palette)}
    wood, straw, linen, shirt, patch, face = (mats[role] for role in ROLES)
    # A single crooked timber stake reaches the ground. The crossbar, cuffs and
    # forked hands are structural silhouettes, with no loose moving parts.
    tube("stake", (.055, -.015, .024), (-.025, -.015, 1.13), .034, wood)
    tube("crossbar", (-.31, -.015, .96), (.30, -.015, .88), .025, wood)
    for side, start, tip, fork in [
        ("left", (-.27, 0, .96), (-.416, .005, 1.005), (-.39, .005, 1.075)),
        ("right", (.26, 0, .885), (.417, 0, .85), (.385, .015, .915)),
    ]:
        tube(side, start, tip, .016, wood, vertices=6)
        midpoint = Vector(start).lerp(Vector(tip), .6)
        tube(side + "fork", tuple(midpoint), fork, .009, wood, vertices=6)
    # Tapered, uneven shirt hem; broad folds survive the far garden camera.
    outline = [(-.145, .60), (-.07, .62), (.01, .57), (.16, .61),
               (.14, .92), (.065, 1.015), (-.115, 1.04), (-.195, .97)]
    vertices = [(x, y, z) for y in (-.083, .092) for x, z in outline]
    n = len(outline)
    faces = [tuple(reversed(range(n))), tuple(range(n, n * 2))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    mesh("shirt-body", vertices, faces, shirt)
    box("left-sleeve", (.235, .19, .155), (-.225, 0, .95), shirt,
        rotation=(0, -.20, 0), bevel_width=.018)
    box("right-sleeve", (.23, .18, .15), (.215, 0, .905), shirt,
        rotation=(0, .25, 0), bevel_width=.018)
    # A cream sack head, three broad straw bundles at each sleeve and the hem.
    head = sphere("head", (.13, .118, .145), (-.045, .008, 1.14), linen)
    for polygon in head.data.polygons:
        polygon.use_smooth = False
    for side in (-1, 1):
        for i in range(3):
            x = side * .30
            z = (.964 if side < 0 else .89) + (i - 1) * .025
            tube("cuff-straw", (x, .026, z), (x + side * .061, .028, z - .01),
                 .009, straw, vertices=5)
    for i in range(5):
        x = -.09 + i * .045
        tube("hem-straw", (x, .016, .63), (x + .018, .016, .525 + (i % 2) * .026),
             .012, straw, vertices=5)
    hat_ring("hat-brim", [(-.045, 1.25, .245, .205, .025),
                           (-.045, 1.267, .244, .204, .025)], straw)
    hat_ring("hat-crown", [(-.045, 1.267, .142, .122, 0),
                            (-.064, 1.365, .112, .102, 0),
                            (-.093, 1.397, .071, .071, 0)], straw)
    hat_ring("hat-band", [(-.047, 1.275, .143, .123, 0),
                           (-.053, 1.305, .135, .118, 0)], patch)
    box("patch-front", (.093, .015, .104), (.075, .104, .735), patch,
        rotation=(0, -.14, 0), bevel_width=.004)
    box("patch-back", (.082, .012, .082), (-.085, -.092, .81), patch,
        rotation=(0, .18, 0), bevel_width=.003)
    # Scarf: a light folded collar and a short rust tail, away from the face.
    box("collar", (.20, .22, .042), (-.035, .005, 1.022), linen,
        rotation=(0, -.12, 0), bevel_width=.01)
    box("scarf-tail", (.065, .025, .14), (-.073, .116, .942), patch,
        rotation=(0, -.23, 0), bevel_width=.004)
    for z in (.89, .82):
        sphere("button", (.013, .009, .013), (-.008, .099, z), linen)
    for x, z in [(-.089, 1.164), (-.017, 1.17)]:
        sphere("eye", (.010, .006, .013), (x, .121, z), face)
    smile = [(-.083, .119, 1.113), (-.062, .126, 1.103),
             (-.042, .127, 1.104), (-.024, .123, 1.116)]
    for start, end in zip(smile, smile[1:]):
        tube("smile", start, end, .0045, face, vertices=5)
    # Merge by material role to keep six draw calls, all transforms baked and
    # origin at the supporting surface. Individual mesh islands stay editable.
    for role in ROLES:
        parts = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"
                 and obj.data.materials[0] == mats[role]]
        bpy.ops.object.select_all(action="DESELECT")
        for part in parts:
            part.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        if len(parts) > 1:
            bpy.ops.object.join()
        shared["apply_transforms"](parts[0])
        parts[0].name = parts[0].data.name = f"{ASSET}_{role}"
    # Exact ground contact for the sloped circular stake.
    bottom = min((obj.matrix_world @ vertex.co).z
                 for obj in bpy.context.scene.objects for vertex in obj.data.vertices)
    for obj in bpy.context.scene.objects:
        for vertex in obj.data.vertices:
            vertex.co.z -= bottom
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "assets/game-assets" / f"{ASSET}.blend"))


def audit():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / "assets/game-assets" / f"{ASSET}.blend"))
    objects = list(bpy.context.scene.objects)
    assert {obj.name for obj in objects} == {f"{ASSET}_{role}" for role in ROLES}
    points = [obj.matrix_world @ vertex.co for obj in objects for vertex in obj.data.vertices]
    low = [min(point[i] for point in points) for i in range(3)]
    high = [max(point[i] for point in points) for i in range(3)]
    assert all(low[i] >= -.45 and high[i] <= .45 for i in (0, 1)), (low, high)
    assert abs(low[2]) < .0001 and 1.2 <= high[2] <= 1.5, (low, high)
    triangles = 0
    for obj in objects:
        assert tuple(obj.location) == (0, 0, 0) and tuple(obj.scale) == (1, 1, 1)
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        assert len(obj.data.materials) == 1 and obj.animation_data is None
        shader = obj.data.materials[0].node_tree.nodes.get("Principled BSDF")
        assert shader.inputs["Metallic"].default_value == 0
        assert .85 <= shader.inputs["Roughness"].default_value <= .96
        assert shader.inputs["Emission Strength"].default_value == 0
    assert triangles < 2500, triangles
    print(json.dumps({"asset": ASSET, "boundsBlender": [low, high],
                      "triangles": triangles, "meshes": len(objects), "materials": len(ROLES)}))


if "--check" not in sys.argv:
    generate()
audit()
