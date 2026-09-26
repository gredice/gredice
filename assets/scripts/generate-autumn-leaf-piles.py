"""Two owned decorative leaf piles, authored separately from ambient leaf effects."""
import importlib.util
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ['AutumnLeafPileMound', 'AutumnLeafPileCrescent']
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('timber_helpers', Path(__file__).with_name('generate-fallen-log.py'))
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)
shared = helpers.shared
PALETTE = ['B87536', 'CA9148', 'A15B30', 'C57E3D', '986037', 'D5A24F']


def mound_height(x, y):
    return max(.006, .105 * (1 - (x / .39) ** 2 - (y / .36) ** 2))


def crescent_height(x, y):
    radius = math.hypot(x, y)
    angle = abs(math.atan2(y, x))
    fade = max(0, min(1, (2.5 - angle) / .4))
    return .008 + .095 * max(0, 1 - abs(radius - .24) / .14) * fade


def leaf(name, x, y, angle, length, shade, height_at, mat):
    # Broad lobes and one folded centre ridge are legible without tiny veins.
    outline = [(-1, 0), (-.58, -.45), (-.18, -.52), (.30, -.43), (1, 0), (.3, .43), (-.18, .52), (-.58, .45)]
    vertices = []
    for a, b in outline + [(0, 0)]:
        px = x + length * (a * math.cos(angle) - b * math.sin(angle))
        py = y + length * (a * math.sin(angle) + b * math.cos(angle))
        vertices.append((px, py, height_at(px, py) + .018 + (.015 if a == b == 0 else 0)))
    faces = [(i, (i + 1) % 8, 8) for i in range(8)]
    return helpers.part(name, vertices, faces, [shade] * 4 + [PALETTE[(PALETTE.index(shade) + 1) % len(PALETTE)]] * 4, mat)


def generate(asset):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene['asset_name'] = asset
    bpy.context.scene['generated_by'] = 'assets/scripts/generate-autumn-leaf-piles.py'
    bpy.context.scene['editing_note'] = 'PileBase and Leaf_* groups are independently selectable. Baked corner Color palette; owned decoration, no seasonal deletion.'
    mat = shared.material(f'Material.{asset}.Palette', 'FFFFFF')
    mat.roughness = .94
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = .94
    colors = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    colors.layer_name = 'Color'
    mat.node_tree.links.new(colors.outputs['Color'], shader.inputs['Base Color'])
    parts = []
    if asset.endswith('Mound'):
        vertices = []
        for radius in [1, .62, 0]:
            for i in range(16):
                angle = math.tau * i / 16
                x, y = .40 * radius * math.cos(angle), .37 * radius * math.sin(angle)
                vertices.append((x, y, 0 if radius == 1 else mound_height(x, y)))
        faces = [(r * 16 + i, r * 16 + (i + 1) % 16, (r + 1) * 16 + (i + 1) % 16, (r + 1) * 16 + i) for r in range(2) for i in range(16)]
        faces.append(tuple(reversed(range(16))))
        parts.append(helpers.part('PileBase', vertices, faces, ['986037', 'A15B30', 'B87536', 'A15B30'] * 8 + ['986037'], mat))
        specs = [(0, 0, .15, .135)]
        for i in range(14):
            angle = math.tau * i / 14
            radius = .275 if i % 2 == 0 else .18
            specs.append((radius * math.cos(angle), radius * math.sin(angle) * .9, angle + .35, .10 if i % 2 else .11))
        height_at = mound_height
    else:
        # Swept horseshoe, open on the negative-X side, grounded around its perimeter.
        vertices = []
        for i in range(17):
            angle = -2.38 + 4.76 * i / 16
            for j, offset in enumerate([-1, -.45, 0, .45, 1]):
                radius = .24 + .135 * offset
                x, y = radius * math.cos(angle), radius * math.sin(angle)
                z = 0 if j in (0, 4) or i in (0, 16) else crescent_height(x, y)
                vertices.append((x, y, z))
        faces = [(i * 5 + j, (i + 1) * 5 + j, (i + 1) * 5 + j + 1, i * 5 + j + 1) for i in range(16) for j in range(4)]
        # Faces wind outward on top after moving along the arc and then outward radially.
        faces = [tuple(reversed(face)) for face in faces]
        parts.append(helpers.part('PileBase', vertices, faces, [PALETTE[i % 6] for i in range(len(faces))], mat))
        specs = []
        for i in range(15):
            angle = -2.15 + 4.30 * i / 14
            radius = .24 + (.025 if i % 2 else -.02)
            specs.append((radius * math.cos(angle), radius * math.sin(angle), angle + math.pi / 2 + .18, .09))
        height_at = crescent_height
    for i, (x, y, angle, length) in enumerate(specs):
        parts.append(leaf(f'Leaf_{i + 1:02d}', x, y, angle, length, PALETTE[i % 6], height_at, mat))
    shared.join_parts(parts, asset + '_Leaves')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / f'assets/game-assets/{asset}.blend'))


def audit(asset):
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / f'assets/game-assets/{asset}.blend'))
    objects = list(bpy.context.scene.objects)
    assert len(objects) == 1
    obj = objects[0]
    assert obj.name == asset + '_Leaves'
    assert tuple(obj.location) == (0, 0, 0) and tuple(obj.scale) == (1, 1, 1)
    assert len(obj.vertex_groups) == 16 and 'PileBase' in obj.vertex_groups
    points = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    assert all(low[i] >= -.45 and high[i] <= .45 for i in (0, 1))
    assert abs(low[2]) < .0001 and .08 < high[2] <= .18
    obj.data.calc_loop_triangles()
    assert len(obj.data.loop_triangles) < 400
    assert len(obj.data.materials) == 1 and not obj.animation_data
    mat = obj.data.materials[0]
    assert mat.roughness >= .9 and mat.metallic == 0
    assert not any(n.type == 'TEX_IMAGE' for n in mat.node_tree.nodes)
    print(json.dumps({'asset': asset, 'min': low, 'max': high, 'triangles': len(obj.data.loop_triangles), 'meshes': 1, 'materials': 1}, indent=2))


if __name__ == '__main__':
    for asset in ASSETS:
        if '--check' not in sys.argv:
            generate(asset)
        audit(asset)
