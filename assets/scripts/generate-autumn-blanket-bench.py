"""A separate bench identity with a folded cream/rust throw and exposed timber."""
import importlib.util
import json
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
ASSET = 'AutumnBlanketBench'
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('timber_helpers', Path(__file__).with_name('generate-fallen-log.py'))
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)


def palette_material(role, roughness):
    mat = helpers.shared.material(f'Material.{ASSET}.{role}', 'FFFFFF')
    mat.roughness = roughness
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = roughness
    color = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    color.layer_name = 'Color'
    mat.node_tree.links.new(color.outputs['Color'], shader.inputs['Base Color'])
    return mat


def generate():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene['asset_name'] = ASSET
    bpy.context.scene['generated_by'] = 'assets/scripts/generate-autumn-blanket-bench.py'
    bpy.context.scene['editing_note'] = 'First-party WoodenBench at its runtime 0.52 scale, grounded by removing the source 0.013 foot gap. Timber keeps named source-part vertex groups; separate Textile mesh has broad folded panels.'
    with bpy.data.libraries.load(str(ROOT / 'assets/game-assets/WoodenBench.blend'), link=False) as (source, target):
        target.objects = [name for name in source.objects if name.startswith('WoodenBench_')]
    wood = palette_material('Timber', .87)
    parts = []
    for obj in target.objects:
        bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in target.objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(evaluated)
        matrix = Matrix.Translation((0, 0, -.013)) @ Matrix.Scale(.52, 4) @ obj.matrix_world
        mesh.transform(matrix)
        colors = mesh.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
        for face in mesh.polygons:
            original = mesh.materials[face.material_index]
            shade = original.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value
            for index in face.loop_indices:
                colors.data[index].color = shade
            face.material_index = 0
        mesh.materials.clear()
        mesh.materials.append(wood)
        copy = bpy.data.objects.new(obj.name.replace('WoodenBench_', 'Timber_'), mesh)
        bpy.context.collection.objects.link(copy)
        copy.vertex_groups.new(name=obj.name).add(list(range(len(mesh.vertices))), 1, 'REPLACE')
        parts.append(copy)
    for obj in target.objects:
        bpy.data.objects.remove(obj, do_unlink=True)
    helpers.shared.join_parts(parts, ASSET + '_Timber')
    cloth = palette_material('Textile', .98)
    columns = [.04, .095, .13, .325, .36, .42]
    profile = [(-.245, .19), (-.242, .32), (-.18, .400), (-.10, .420), (0, .412), (.10, .416), (.18, .401), (.225, .29), (.22, .20)]
    vertices = []
    for x in columns:
        for y, z in profile:
            vertices.append((x, y, z + (.002 if x > .32 else 0)))
    faces, shades = [], []
    for col in range(len(columns) - 1):
        for row in range(len(profile) - 1):
            a = col * len(profile) + row
            faces.append((a, a + len(profile), a + len(profile) + 1, a + 1))
            shades.append('A85835' if col in (1, 3) else ('E7D9BB' if row % 2 else 'EEE3CB'))
    textile = helpers.part('FoldedThrow', vertices, faces, shades, cloth)
    # A thin solid edge makes the folded throw readable from below and oblique angles.
    solidify = textile.modifiers.new(name='HemThickness', type='SOLIDIFY')
    solidify.thickness = .008
    solidify.offset = -1
    bpy.context.view_layer.objects.active = textile
    bpy.ops.object.modifier_apply(modifier=solidify.name)
    textile.name = ASSET + '_Textile'
    textile.data.name = textile.name
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / f'assets/game-assets/{ASSET}.blend'))


def audit():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / f'assets/game-assets/{ASSET}.blend'))
    objects = list(bpy.context.scene.objects)
    assert {o.name for o in objects} == {ASSET + '_Timber', ASSET + '_Textile'}
    points = [obj.matrix_world @ Vector(c) for obj in objects for c in obj.bound_box]
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    assert low[0] >= -.60 and high[0] <= .60
    assert low[1] >= -.30 and high[1] <= .30
    assert abs(low[2]) < .0001 and high[2] <= .45
    triangles = {}
    for obj in objects:
        assert tuple(obj.location) == (0, 0, 0) and tuple(obj.scale) == (1, 1, 1)
        assert len(obj.data.materials) == 1 and not obj.animation_data
        obj.data.calc_loop_triangles()
        triangles[obj.name] = len(obj.data.loop_triangles)
    assert sum(triangles.values()) < 2500
    print(json.dumps({'asset': ASSET, 'min': low, 'max': high, 'triangles': triangles, 'meshes': 2, 'materials': 2}, indent=2))


if __name__ == '__main__':
    if '--check' not in sys.argv:
        generate()
    audit()
