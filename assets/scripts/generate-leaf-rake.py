"""A chunky garden rake leaning into a small owned leaf mound. Static art only."""
import importlib.util
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
ASSET = 'LeafRake'
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('timber_helpers', Path(__file__).with_name('generate-fallen-log.py'))
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)


def tube(name, start, end, radius, shade, mat, segments=8):
    start, end = Vector(start), Vector(end)
    axis = (end - start).normalized()
    basis = Vector((0, 0, 1)) if abs(axis.z) < .9 else Vector((1, 0, 0))
    u = axis.cross(basis).normalized()
    v = axis.cross(u).normalized()
    vertices = []
    for center in [start, end]:
        for i in range(segments):
            angle = math.tau * i / segments
            vertices.append(tuple(center + radius * (math.cos(angle) * u + math.sin(angle) * v)))
    faces = [(i, (i + 1) % segments, (i + 1) % segments + segments, i + segments) for i in range(segments)]
    faces += [tuple(reversed(range(segments))), tuple(range(segments, segments * 2))]
    return helpers.part(name, vertices, faces, [shade] * len(faces), mat)


def generate():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene['asset_name'] = ASSET
    bpy.context.scene['generated_by'] = 'assets/scripts/generate-leaf-rake.py'
    bpy.context.scene['editing_note'] = 'Reuses the first-party AutumnLeafPileMound geometry at 82 percent scale. Leaf groups plus Handle, Ferrule, HeadBrace and Tine_* groups remain editable. No actual garden operation.'
    # Append local source data without modifying or resaving its original .blend.
    with bpy.data.libraries.load(str(ROOT / 'assets/game-assets/AutumnLeafPileMound.blend'), link=False) as (source, target):
        target.objects = ['AutumnLeafPileMound_Leaves']
    mound = target.objects[0]
    bpy.context.collection.objects.link(mound)
    for vertex in mound.data.vertices:
        vertex.co *= .82
    mat = mound.data.materials[0]
    mat.name = 'Material.LeafRake.Palette'
    mat.roughness = .92
    mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = .92
    parts = [mound]
    parts.append(tube('Handle', (0, .105, .15), (-.155, -.105, 1.045), .032, 'AF814E', mat))
    parts.append(tube('HandleTip', (-.144, -.09, .99), (-.155, -.105, 1.045), .034, 'C49A65', mat))
    parts.append(tube('Ferrule', (.006, .113, .12), (-.012, .090, .205), .038, '536367', mat))
    parts.append(tube('HeadBrace', (-.245, .253, .073), (.245, .253, .073), .018, '536367', mat))
    for i in range(7):
        x = -.24 + .08 * i
        parts.append(tube(f'Tine_{i + 1:02d}', (x * .16, .12, .145), (x, .267, .070), .0125, '45575D', mat, 6))
        parts.append(tube(f'TineTip_{i + 1:02d}', (x, .267, .070), (x, .322, .015), .013, '45575D', mat, 6))
    helpers.shared.join_parts(parts, ASSET + '_Arrangement')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / f'assets/game-assets/{ASSET}.blend'))


def audit():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / f'assets/game-assets/{ASSET}.blend'))
    objects = list(bpy.context.scene.objects)
    assert len(objects) == 1 and objects[0].name == ASSET + '_Arrangement'
    obj = objects[0]
    assert tuple(obj.location) == (0, 0, 0) and tuple(obj.scale) == (1, 1, 1)
    assert {'Handle', 'Ferrule', 'HeadBrace', 'PileBase'}.issubset({g.name for g in obj.vertex_groups})
    assert sum(g.name.startswith('Tine_') for g in obj.vertex_groups) == 7
    points = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    assert all(low[i] >= -.45 and high[i] <= .45 for i in (0, 1)), (low, high)
    assert abs(low[2]) < .0001 and high[2] <= 1.1
    obj.data.calc_loop_triangles()
    assert len(obj.data.loop_triangles) < 800
    assert len(obj.data.materials) == 1 and not obj.animation_data
    print(json.dumps({'asset': ASSET, 'min': low, 'max': high, 'triangles': len(obj.data.loop_triangles), 'meshes': 1, 'materials': 1}, indent=2))


if __name__ == '__main__':
    if '--check' not in sys.argv:
        generate()
    audit()
