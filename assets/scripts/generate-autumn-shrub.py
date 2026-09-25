"""Original low deciduous shrub with editable full, thinning and bud meshes.

Run with Blender --background --python-exit-code 1 --python <this file>.
Append -- --check to audit the saved source without rewriting it.
"""
import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
ASSET = "AutumnShrub"
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("shared", Path(__file__).with_name("generate-harvest-pumpkins.py"))
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)


def branch(start, end, radius, mat):
    direction = Vector(end) - Vector(start)
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=radius, radius2=radius * .55,
                                   depth=direction.length, location=(Vector(start) + Vector(end)) / 2)
    obj = bpy.context.object
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def clump(center, scale, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=center)
    obj = bpy.context.object
    obj.scale = scale
    obj.rotation_euler[2] = center[0] * 3
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def leaf(center, angle, size, mat):
    # A broad faceted leaf, with a central ridge and no alpha texture.
    def vertex(x, y, z):
        return (center[0] + size * (x * math.cos(angle) - y * math.sin(angle)),
                center[1] + size * (x * math.sin(angle) + y * math.cos(angle)), center[2] + size * z)
    vertices = [vertex(*v) for v in [(-.5, 0, 0), (0, -.32, .03), (.65, 0, .12),
                                     (0, .32, .03), (0, 0, .22), (0, 0, -.07)]]
    faces = [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4),
             (1, 0, 5), (2, 1, 5), (3, 2, 5), (0, 3, 5)]
    return shared.mesh("Leaf", vertices, faces, mat)


def generate():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene["asset_name"] = ASSET
    bpy.context.scene["generated_by"] = "assets/scripts/generate-autumn-shrub.py"
    bpy.context.scene["preview_note"] = "Show Wood plus exactly one foliage stage: Full, Thinning or Sparse. Winter is Wood only."
    wood = shared.material("Material.AutumnShrub.Wood", "79563C")
    gold = shared.material("Material.AutumnShrub.Gold", "D6B83F")
    russet = shared.material("Material.AutumnShrub.Russet", "B06A3D")
    for mat in (gold, russet):
        mat.roughness = .95
        mat.node_tree.nodes.get("Principled BSDF").inputs["Roughness"].default_value = .95
    # A spreading fan with five rounded lobes, rather than the existing Bush dome.
    centers = [(-.21, -.16, .34), (.20, -.15, .31), (-.20, .15, .39),
               (.19, .16, .38), (0, .015, .49)]
    scales = [(.23, .20, .19), (.23, .20, .18), (.22, .20, .21),
              (.23, .20, .19), (.24, .21, .21)]
    wood_parts = [branch((0, 0, .04), (0, 0, .42), .042, wood),
                  clump((0, 0, .036), (.075, .075, .038), wood)]
    # Flatten the root flare exactly onto the support plane.
    root_floor = min(vertex.co.z for vertex in wood_parts[1].data.vertices)
    for vertex in wood_parts[1].data.vertices:
        vertex.co.z -= root_floor
    for i, center in enumerate(centers):
        tip = (center[0] * 1.18, center[1] * 1.16, center[2] + .11)
        wood_parts.append(branch((0, 0, .11), center, .027, wood))
        wood_parts.append(branch(center, tip, .017, wood))
        side = (center[0] * .65 + .06, center[1] * .65 - .055, center[2] + .07)
        wood_parts.append(branch(Vector(center).lerp(Vector((0, 0, .11)), .35), side, .014, wood))
    shared.join_parts(wood_parts, ASSET + "_Wood")
    for stage, multiplier, leaf_count in [("Full", 1, 5), ("Thinning", .65, 3), ("Sparse", .22, 1)]:
        parts = [[], []]
        for i, (center, scale) in enumerate(zip(centers, scales)):
            mat = gold if i % 2 == 0 else russet
            parts[i % 2].append(clump(center, tuple(value * multiplier for value in scale), mat))
            for j in range(leaf_count):
                angle = j * math.tau / leaf_count + i * .77
                size = .145 * multiplier
                pos = (center[0] + math.cos(angle) * scale[0] * multiplier * .8,
                       center[1] + math.sin(angle) * scale[1] * multiplier * .8,
                       center[2] + scale[2] * multiplier * .5)
                parts[i % 2].append(leaf(pos, angle, size, mat))
        for group, suffix in zip(parts, ("Gold", "Russet")):
            shared.join_parts(group, ASSET + "_" + stage + suffix)
    for obj in bpy.context.scene.objects:
        for vertex in obj.data.vertices:
            vertex.co.x *= .94
            vertex.co.y *= .94
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / f"assets/game-assets/{ASSET}.blend"))


def audit():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / f"assets/game-assets/{ASSET}.blend"))
    objects = list(bpy.context.scene.objects)
    assert {o.name for o in objects} == {ASSET + "_Wood"} | {
        ASSET + "_" + stage + role for stage in ("Full", "Thinning", "Sparse") for role in ("Gold", "Russet")}
    points = [o.matrix_world @ Vector(c) for o in objects for c in o.bound_box]
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    assert all(low[i] >= -.45 and high[i] <= .45 for i in (0, 1)), (low, high)
    assert abs(low[2]) < .0001 and high[2] <= .72, (low, high)
    triangles = {}
    for obj in objects:
        assert tuple(obj.location) == (0, 0, 0)
        assert tuple(obj.scale) == (1, 1, 1)
        obj.data.calc_loop_triangles()
        triangles[obj.name] = len(obj.data.loop_triangles)
        assert len(obj.data.materials) == 1
        shader = obj.data.materials[0].node_tree.nodes.get("Principled BSDF")
        assert shader.inputs["Metallic"].default_value == 0
        assert shader.inputs["Roughness"].default_value >= .85
        assert shader.inputs["Emission Strength"].default_value == 0
    assert sum(triangles.values()) < 2500
    print(json.dumps({"asset": ASSET, "trianglesByMesh": triangles, "totalTriangles": sum(triangles.values()),
                      "meshes": 7, "materials": 3, "boundsBlender": [low, high]}))


if __name__ == "__main__":
    if "--check" not in sys.argv:
        generate()
    audit()
