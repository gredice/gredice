"""Original decorative five-mushroom cluster, with one vertex-coloured material.

Run in Blender; append -- --check to audit the saved source without rewriting it.
Named vertex groups keep each cap and stem independently editable after joining.
"""
import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
ASSET = "WoodlandMushrooms"
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("shared", Path(__file__).with_name("generate-harvest-pumpkins.py"))
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)


def color(hex_value):
    values = [int(hex_value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values) + (1,)


def lathe(name, x, y, profile, colors, mat, lean=0):
    segments = 12
    vertices = []
    for height, radius in profile:
        for i in range(segments):
            angle = math.tau * i / segments
            vertices.append((x + lean * height + radius * math.cos(angle),
                             y + radius * math.sin(angle), height))
    faces = []
    for ring in range(len(profile) - 1):
        for i in range(segments):
            a = ring * segments + i
            b = ring * segments + (i + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    faces.extend([tuple(reversed(range(segments))),
                  tuple((len(profile) - 1) * segments + i for i in range(segments))])
    obj = shared.mesh(name, vertices, faces, mat)
    attribute = obj.data.color_attributes.new(name="Color", type="FLOAT_COLOR", domain="POINT")
    for index, point in enumerate(attribute.data):
        point.color = color(colors[index // segments])
    obj.vertex_groups.new(name=name).add(list(range(len(vertices))), 1, "REPLACE")
    return obj


def generate():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene["asset_name"] = ASSET
    bpy.context.scene["generated_by"] = "assets/scripts/generate-woodland-mushrooms.py"
    bpy.context.scene["mushroom_count"] = 5
    bpy.context.scene["editing_note"] = "Cap_1..5 and Stem_1..5 vertex groups select individual parts. Color stores the baked palette; all parts share one material."
    mat = shared.material("Material.WoodlandMushrooms.Palette", "FFFFFF")
    mat.roughness = .92
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = .92
    colors = mat.node_tree.nodes.new("ShaderNodeVertexColor")
    colors.layer_name = "Color"
    mat.node_tree.links.new(colors.outputs["Color"], shader.inputs["Base Color"])
    # x, y, stem height, cap radius, dome height, cap/edge colours.
    mushrooms = [(-.105, .015, .245, .19, .135, "895735", "A47149"),
                 (.205, .12, .17, .155, .11, "B08054", "C59869"),
                 (-.25, -.205, .105, .14, .09, "BCA578", "D5C29A"),
                 (.10, -.205, .085, .125, .085, "965D30", "B07947"),
                 (-.07, .285, .11, .12, .095, "79563C", "A47149")]
    parts = []
    for index, (x, y, stem, radius, dome, cap, edge) in enumerate(mushrooms, 1):
        lean = .045 if index % 2 else -.04
        parts.append(lathe(f"Stem_{index}", x, y,
                           [(0, radius * .29), (.025, radius * .30),
                            (stem * .65, radius * .22), (stem + .018, radius * .24)],
                           ["CFC19E", "E7D9B9", "EEE3CB", "EEE3CB"], mat, lean))
        # Solid cream underside, rounded thick lip and a broad flattened dome.
        parts.append(lathe(f"Cap_{index}", x + lean * stem, y,
                           [(stem - .012, radius * .22), (stem, radius * .94),
                            (stem + dome * .18, radius), (stem + dome * .62, radius * .78),
                            (stem + dome * .92, radius * .40), (stem + dome, radius * .12)],
                           ["D9C8A3", "E7D9B9", edge, cap, cap, cap], mat))
    shared.join_parts(parts, ASSET + "_Cluster")
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / f"assets/game-assets/{ASSET}.blend"))


def audit():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / f"assets/game-assets/{ASSET}.blend"))
    objects = list(bpy.context.scene.objects)
    assert len(objects) == 1 and objects[0].name == ASSET + "_Cluster"
    obj = objects[0]
    assert obj.type == "MESH" and tuple(obj.location) == (0, 0, 0)
    assert tuple(obj.scale) == (1, 1, 1)
    assert len(obj.data.materials) == 1
    assert len(obj.vertex_groups) == 10
    assert {g.name for g in obj.vertex_groups} == {f"{part}_{i}" for part in ("Cap", "Stem") for i in range(1, 6)}
    points = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    assert all(low[i] >= -.45 and high[i] <= .45 for i in (0, 1)), (low, high)
    assert abs(low[2]) < .0001 and high[2] <= .4, (low, high)
    for i in range(1, 6):
        group = obj.vertex_groups[f"Stem_{i}"].index
        points = [v.co.z for v in obj.data.vertices if any(g.group == group for g in v.groups)]
        assert min(points) == 0, (i, min(points))
    assert obj.data.color_attributes["Color"].domain == "POINT"
    obj.data.calc_loop_triangles()
    triangles = len(obj.data.loop_triangles)
    assert triangles < 1500
    assert not obj.animation_data
    mat = obj.data.materials[0]
    assert mat.roughness > .9 and mat.metallic == 0
    assert not any(n.type == "TEX_IMAGE" for n in mat.node_tree.nodes)
    print(json.dumps({"asset": ASSET, "min": low, "max": high, "triangles": triangles,
                      "meshes": 1, "materials": 1, "mushrooms": 5}, indent=2))


if "--check" not in sys.argv:
    generate()
audit()
