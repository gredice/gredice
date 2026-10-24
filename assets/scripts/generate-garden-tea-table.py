"""A first-party timber table with original thermos, enamel mugs and steam anchors."""
import importlib.util
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
ASSET = 'GardenTeaTable'
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('timber_helpers', Path(__file__).with_name('generate-fallen-log.py'))
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)
TOP = .67 * .96
MUGS = [('Left', -.20, -.13, 'E9DDC2', '536E78'), ('Right', .20, -.03, 'EEE5CF', 'A55C3A')]


def palette_material(role, roughness):
    mat = helpers.shared.material(f'Material.{ASSET}.{role}', 'FFFFFF')
    mat.roughness = roughness
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = roughness
    color = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    color.layer_name = 'Color'
    mat.node_tree.links.new(color.outputs['Color'], shader.inputs['Base Color'])
    return mat


def lathe(name, x, y, profile, shades, mat, segments=12):
    vertices = [(x + r * math.cos(i * math.tau / segments), y + r * math.sin(i * math.tau / segments), z)
                for r, z in profile for i in range(segments)]
    faces, palette = [], []
    for ring, shade in enumerate(shades):
        for i in range(segments):
            faces.append((ring * segments + i, ring * segments + (i + 1) % segments,
                          (ring + 1) * segments + (i + 1) % segments, (ring + 1) * segments + i))
            palette.append(shade)
    return helpers.part(name, vertices, faces, palette, mat)


def handle(name, x, y, z, shade, mat):
    # A broad C-shaped loop is visibly hollow at garden zoom.
    vertices = []
    for radius in [.061, .035]:
        for depth in [-.014, .014]:
            for i in range(9):
                angle = -math.pi / 2 + math.pi * i / 8
                vertices.append((x + radius * math.cos(angle), y + depth, z + radius * math.sin(angle)))
    faces = []
    for i in range(8):
        faces.extend([(i, i+1, i+10, i+9), (i+18, i+27, i+28, i+19),
                      (i, i+18, i+19, i+1), (i+9, i+10, i+28, i+27)])
    faces.extend([(0, 9, 27, 18), (8, 26, 35, 17)])
    return helpers.part(name, vertices, faces, [shade] * len(faces), mat)


def generate():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene['asset_name'] = ASSET
    bpy.context.scene['generated_by'] = 'assets/scripts/generate-garden-tea-table.py'
    bpy.context.scene['editing_note'] = 'First-party display table at 96% scale. Named timber, mug, rim, tea and thermos vertex groups. MugSteam empties are base-centred Blender Z-up authoring anchors; runtime uses matching Y-up coordinates.'
    with bpy.data.libraries.load(str(ROOT / 'assets/game-assets/OutletDisplayTable.blend'), link=False) as (source, target):
        target.objects = [name for name in source.objects if name.startswith('OutletDisplayTable_')]
    wood = palette_material('Timber', .88)
    parts = []
    for obj in target.objects:
        bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in target.objects:
        mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
        mesh.transform(Matrix.Scale(.96, 4) @ obj.matrix_world)
        colors = mesh.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
        for face in mesh.polygons:
            shade = mesh.materials[face.material_index].node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value
            for i in face.loop_indices:
                colors.data[i].color = shade
            face.material_index = 0
        mesh.materials.clear()
        mesh.materials.append(wood)
        copy = bpy.data.objects.new(obj.name.replace('OutletDisplayTable_', 'Timber_'), mesh)
        bpy.context.collection.objects.link(copy)
        copy.vertex_groups.new(name=obj.name).add(list(range(len(mesh.vertices))), 1, 'REPLACE')
        parts.append(copy)
    for obj in target.objects:
        bpy.data.objects.remove(obj, do_unlink=True)
    helpers.shared.join_parts(parts, ASSET + '_Timber')
    enamel = palette_material('Enamel', .83)
    parts = []
    for name, x, y, body, rim in MUGS:
        profile = [(0, TOP), (.052, TOP), (.063, TOP+.018), (.067, TOP+.142),
                   (.068, TOP+.154), (.051, TOP+.154), (.050, TOP+.130), (0, TOP+.130)]
        parts.append(lathe('Mug'+name, x, y, profile, [body,body,body,rim,rim,body,'784329'], enamel))
        parts.append(handle('Mug'+name+'Handle', x+.062, y, TOP+.08, rim, enamel))
        anchor = bpy.data.objects.new(ASSET+'_MugSteam'+name, None)
        anchor.location = (x, y, TOP+.164)
        anchor.empty_display_size = .03
        anchor['emitter_radius'] = .035
        bpy.context.collection.objects.link(anchor)
    # Cream shoulder band and lid distinguish the thermos from either mug.
    profile = [(0,TOP),(.073,TOP),(.079,TOP+.018),(.079,TOP+.235),(.062,TOP+.259),
               (.065,TOP+.267),(.065,TOP+.304),(.055,TOP+.312),(0,TOP+.312)]
    parts.append(lathe('Thermos', -.08, .16, profile,
                       ['435C52','435C52','657E68','D5D4B7','D5D4B7','435C52','536E59','536E59'], enamel))
    helpers.shared.join_parts(parts, ASSET + '_TeaSet')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / f'assets/game-assets/{ASSET}.blend'))


def audit():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / f'assets/game-assets/{ASSET}.blend'))
    objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    assert {o.name for o in objects} == {ASSET+'_Timber', ASSET+'_TeaSet'}
    points = [obj.matrix_world @ Vector(c) for obj in objects for c in obj.bound_box]
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    assert all(low[i] >= -.45 and high[i] <= .45 for i in (0,1)), (low,high)
    assert abs(low[2]) < .0001 and high[2] <= 1
    triangles = {}
    for obj in objects:
        assert tuple(obj.location) == (0,0,0) and tuple(obj.scale) == (1,1,1)
        assert len(obj.data.materials) == 1 and not obj.animation_data
        obj.data.calc_loop_triangles()
        triangles[obj.name] = len(obj.data.loop_triangles)
    assert sum(triangles.values()) < 3000
    for name,x,y,_,_ in MUGS:
        anchor = bpy.data.objects[ASSET+'_MugSteam'+name]
        assert (anchor.location - Vector((x,y,TOP+.164))).length < .00001
    print(json.dumps({'asset':ASSET,'min':low,'max':high,'triangles':triangles,'meshes':2,'materials':2},indent=2))


if __name__ == '__main__':
    if '--check' not in sys.argv:
        generate()
    audit()
