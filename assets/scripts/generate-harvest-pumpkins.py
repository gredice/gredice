"""Author the decorative HarvestPumpkin family (Blender, not system Python).

Run: blender --background --python assets/scripts/generate-harvest-pumpkins.py
Audit saved sources without rewriting: append -- --check
The crop and harvest-reward assets are deliberately independent of these sources.
"""

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ("HarvestPumpkinSquat", "HarvestPumpkinGourd", "HarvestPumpkinGroup")


def material(name, hex_color):
    def linear(channel):
        value = int(channel, 16) / 255
        return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4

    color = tuple(linear(hex_color[i:i + 2]) for i in (0, 2, 4)) + (1,)
    result = bpy.data.materials.new(name)
    result.diffuse_color = color
    result.use_nodes = True
    result.roughness = 0.86
    result.metallic = 0
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = 0.86
    shader.inputs["Metallic"].default_value = 0
    return result


def mesh(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(mat)
    return obj


def fruit(name, radius, height, x, y, phase, gourd, skin, stem):
    # Eight broad ribs echo the crop's vocabulary, with a wider, flattened base
    # and a pronounced recessed crown. The gourd has a curved, narrow neck.
    profile = (
        [(0, .3), (.07, .76), (.21, 1), (.38, .98), (.53, .72),
         (.67, .40), (.82, .30), (.94, .32), (1, .21)]
        if gourd else
        [(0, .35), (.07, .73), (.22, .97), (.46, 1), (.69, .95),
         (.86, .76), (.95, .48), (.92, .20), (.89, .08)]
    )
    segments = 40
    vertices = []
    for z, ring_radius in profile:
        bend = .07 * z ** 3 if gourd else 0
        for i in range(segments):
            angle = 2 * math.pi * i / segments + phase
            rib = 1 - .14 * (1 - math.cos(8 * (angle - phase))) / 2
            r = radius * ring_radius * rib
            vertices.append((x + bend + r * math.cos(angle),
                             y + r * math.sin(angle), z * height))
    faces = []
    for ring in range(len(profile) - 1):
        for i in range(segments):
            a = ring * segments + i
            b = ring * segments + (i + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    faces.append(tuple(reversed(range(segments))))
    faces.append(tuple((len(profile) - 1) * segments + i for i in range(segments)))
    body = mesh(name + "_Body", vertices, faces, skin)

    top_z = profile[-1][0] * height
    top_x = x + (.07 if gourd else 0)
    stem_radius = radius * .11
    stem_height = .075 if gourd else height * .24
    vertices = []
    for level, offset, width in [(0, 0, 1.25), (.4, .007, 1), (.8, .025, .8), (1, .04, .72)]:
        for i in range(6):
            angle = 2 * math.pi * i / 6
            vertices.append((top_x + offset + stem_radius * width * math.cos(angle),
                             y + offset * .35 + stem_radius * width * math.sin(angle),
                             top_z - .008 + level * stem_height))
    faces = []
    for ring in range(3):
        for i in range(6):
            a = ring * 6 + i
            b = ring * 6 + (i + 1) % 6
            faces.append((a, b, b + 6, a + 6))
    faces.extend([tuple(reversed(range(6))), tuple(range(18, 24))])
    stalk = mesh(name + "_Stem", vertices, faces, stem)
    return body, stalk


def join_parts(parts, name):
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    parts[0].name = name
    parts[0].data.name = name


def generate(asset):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene["asset_name"] = asset
    bpy.context.scene["generated_by"] = "assets/scripts/generate-harvest-pumpkins.py"
    skin = material("Material.HarvestPumpkin.Skin", "E08A3C")
    stem = material("Material.HarvestPumpkin.Stem", "4E7F35")
    if asset == "HarvestPumpkinGroup":
        specs = [(.245, .36, -.17, .13, .12),
                 (.19, .265, .22, .055, .32),
                 (.17, .235, -.055, -.255, .0)]
    elif asset == "HarvestPumpkinGourd":
        specs = [(.235, .47, 0, 0, .18)]
    else:
        specs = [(.35, .37, 0, 0, .12)]
    parts = [fruit(f"{asset}_{i}", *spec, asset.endswith("Gourd"), skin, stem)
             for i, spec in enumerate(specs)]
    join_parts([pair[0] for pair in parts], asset + "_Body")
    join_parts([pair[1] for pair in parts], asset + "_Stem")
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "assets/game-assets" / f"{asset}.blend"))


def audit(asset):
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / "assets/game-assets" / f"{asset}.blend"))
    objects = list(bpy.context.scene.objects)
    assert {obj.name for obj in objects} == {asset + "_Body", asset + "_Stem"}
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    low = [min(point[i] for point in points) for i in range(3)]
    high = [max(point[i] for point in points) for i in range(3)]
    assert all(low[i] >= -.45 and high[i] <= .45 for i in (0, 1)), (asset, low, high)
    assert abs(low[2]) < .0001 and high[2] <= .55, (asset, low, high)
    triangles = 0
    for obj in objects:
        assert tuple(obj.location) == (0, 0, 0)
        assert tuple(obj.scale) == (1, 1, 1)
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        assert len(obj.data.materials) == 1
        for mat in obj.data.materials:
            shader = mat.node_tree.nodes.get("Principled BSDF")
            assert shader.inputs["Metallic"].default_value == 0
            assert .8 <= shader.inputs["Roughness"].default_value <= .9
            assert shader.inputs["Emission Strength"].default_value == 0
    assert triangles <= (2400 if asset.endswith("Group") else 800)
    print(json.dumps({"asset": asset, "boundsBlender": [low, high],
                      "triangles": triangles, "meshes": len(objects), "materials": 2}))


if __name__ == "__main__":
    for name in ASSETS:
        if "--check" not in sys.argv:
            generate(name)
        audit(name)
