"""Original low-poly fallen timber; -- --check audits the editable saved source."""
import importlib.util
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
ASSET = 'FallenLog'
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('shared', Path(__file__).with_name('generate-harvest-pumpkins.py'))
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)


def color(value):
    values = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values) + (1,)


def part(name, vertices, faces, palette, mat):
    obj = shared.mesh(name, vertices, faces, mat)
    colors = obj.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    for polygon, shade in zip(obj.data.polygons, palette):
        for index in polygon.loop_indices:
            colors.data[index].color = color(shade)
    obj.vertex_groups.new(name=name).add(list(range(len(vertices))), 1, 'REPLACE')
    return obj


def generate():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene['asset_name'] = ASSET
    bpy.context.scene['generated_by'] = 'assets/scripts/generate-fallen-log.py'
    bpy.context.scene['editing_note'] = 'Bark, CutEndLeft/Right, BranchStub and Moss vertex groups; corner Color attribute stores palette.'
    mat = shared.material('Material.FallenLog.Palette', 'FFFFFF')
    mat.roughness = .92
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = .92
    colors = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    colors.layer_name = 'Color'
    mat.node_tree.links.new(colors.outputs['Color'], shader.inputs['Base Color'])
    segments = 12
    # Cross-section has a broad, grounded underside and an irregular taper.
    rings = [(-.92, .95, -.014), (-.86, 1, -.014), (-.30, 1.03, .016), (.39, .94, -.006), (.88, .87, .008), (.92, .85, .008)]
    vertices = []
    for x, radius, bend in rings:
        for i in range(segments):
            a = math.tau * i / segments
            vertices.append((x, bend + .275 * radius * math.cos(a), max(0, .205 + .205 * radius * math.sin(a))))
    faces = []
    shades = []
    for r in range(len(rings) - 1):
        for i in range(segments):
            faces.append((r * segments + i, r * segments + (i + 1) % segments, (r + 1) * segments + (i + 1) % segments, (r + 1) * segments + i))
            shades.append(['79502F', '845933', '94653B', '805331', '6F492C', '754B2C'][i % 6])
    parts = [part('Bark', vertices, faces, shades, mat)]
    # Broad concentric cut rings, visibly lighter than bark; no texture dependency.
    for side, name, ring_index in [(-1, 'CutEndLeft', 0), (1, 'CutEndRight', -1)]:
        x, radius, bend = rings[ring_index]
        verts = []
        for fraction in [1, .84, .57, .47, .22, 0]:
            for i in range(segments):
                a = math.tau * i / segments
                verts.append((x + side * .001, bend + .275 * radius * fraction * math.cos(a), .205 + .205 * radius * fraction * math.sin(a)))
        faces = []
        shades = []
        for r, shade in enumerate(['644327', 'C0925C', 'AF7D49', 'D2A56F', 'BA8956']):
            for i in range(segments):
                face = (r * segments + i, r * segments + (i + 1) % segments, (r + 1) * segments + (i + 1) % segments, (r + 1) * segments + i)
                faces.append(tuple(reversed(face)) if side == -1 else face)
                shades.append(shade)
        parts.append(part(name, verts, faces, shades, mat))
    # One blunt broken branch creates an asymmetric silhouette without sharp twigs.
    base, end = Vector((.29, -.15, .22)), Vector((.39, -.37, .35))
    axis = (end - base).normalized()
    u = axis.cross(Vector((1, 0, 0))).normalized()
    v = axis.cross(u).normalized()
    verts = []
    for center, radius in [(base, .095), (end, .065)]:
        for i in range(8):
            a = math.tau * i / 8
            verts.append(tuple(center + radius * (math.cos(a) * u + math.sin(a) * v)))
    faces = [(i, (i + 1) % 8, (i + 1) % 8 + 8, i + 8) for i in range(8)] + [tuple(range(8, 16))]
    parts.append(part('BranchStub', verts, faces, ['79502F', '845933'] * 4 + ['C0925C'], mat))
    # Small angular patch follows the upper barrel; its thin volume avoids z fighting.
    verts = [(-.53, -.075, .405), (-.25, -.11, .405), (.06, -.068, .407), (.12, .025, .405), (-.08, .10, .402), (-.39, .105, .407), (-.58, .022, .410), (-.23, .012, .432)]
    faces = [(i, (i + 1) % 7, 7) for i in range(7)]
    parts.append(part('Moss', verts, faces, ['6C7944', '79854A', '66723E', '758048', '6C7944', '839050', '758048'], mat))
    shared.join_parts(parts, ASSET + '_Timber')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / f'assets/game-assets/{ASSET}.blend'))


def audit():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / f'assets/game-assets/{ASSET}.blend'))
    objects = list(bpy.context.scene.objects)
    assert len(objects) == 1
    obj = objects[0]
    assert obj.name == ASSET + '_Timber'
    assert tuple(obj.location) == (0, 0, 0) and tuple(obj.scale) == (1, 1, 1)
    assert {g.name for g in obj.vertex_groups} == {'Bark', 'CutEndLeft', 'CutEndRight', 'BranchStub', 'Moss'}
    points = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    assert low[0] >= -.95 and high[0] <= .95
    assert low[1] >= -.45 and high[1] <= .45
    assert abs(low[2]) < .0001 and high[2] <= .45
    obj.data.calc_loop_triangles()
    triangles = len(obj.data.loop_triangles)
    assert triangles < 600
    assert len(obj.data.materials) == 1 and not obj.animation_data
    mat = obj.data.materials[0]
    assert mat.roughness > .9 and mat.metallic == 0
    assert not any(n.type == 'TEX_IMAGE' for n in mat.node_tree.nodes)
    print(json.dumps({'asset': ASSET, 'min': low, 'max': high, 'triangles': triangles, 'meshes': 1, 'materials': 1}, indent=2))


if __name__ == '__main__':
    if '--check' not in sys.argv:
        generate()
    audit()
