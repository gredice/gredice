"""Keep the summer bush intact and author small, closed seasonal foliage clusters."""
from pathlib import Path
import bpy
import bmesh
from mathutils import Matrix, Vector

source = Path(__file__).resolve().parent / 'game-assets' / 'Bush.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
bush = bpy.data.objects['Bush 1']


def save_mesh(name, mesh, material, textured=False):
    old = bpy.data.objects.get(name)
    if old:
        old_mesh = old.data
        bpy.data.objects.remove(old, do_unlink=True)
        if old_mesh.users == 0:
            bpy.data.meshes.remove(old_mesh)
    data = bpy.data.meshes.new(name)
    mesh.to_mesh(data)
    mesh.free()
    data.materials.append(material)
    if textured:
        # Same green palette swatch as the original bush core.
        uv = data.uv_layers.new(name='UVMap')
        for loop in uv.data:
            loop.uv = (0.2795, 0.7068)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.matrix_world = bush.matrix_world.copy()
    obj.hide_set(True)


anchors = [(-0.42, -0.28, 0.55), (0.4, -0.25, 0.6),
           (-0.3, 0.4, 0.58), (0.35, 0.35, 0.68)]
for name, selected, scale in [
    ('Bush_AutumnThinning', anchors, (0.43, 0.43, 0.28)),
    ('Bush_AutumnSparse', [anchors[0], anchors[3]], (0.24, 0.24, 0.16)),
]:
    mesh = bmesh.new()
    for center in selected:
        transform = Matrix.Translation(Vector(center)) @ Matrix.Diagonal((*scale, 1))
        bmesh.ops.create_icosphere(mesh, subdivisions=1, radius=1, matrix=transform)
    save_mesh(name, mesh, bpy.data.materials['Material.ColorPaletteMain'], True)

material = bpy.data.materials.get('Material.BushBranches') or bpy.data.materials.new('Material.BushBranches')
material.use_nodes = True
shader = material.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value = (0.16, 0.08, 0.035, 1)
shader.inputs['Roughness'].default_value = 0.9
branches = bmesh.new()
for center in anchors:
    start, end = Vector((0, 0, 0.02)), Vector(center)
    direction = end - start
    transform = Matrix.Translation((start + end) / 2) @ direction.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bmesh.ops.create_cone(branches, cap_ends=True, cap_tris=True, segments=5,
                         radius1=0.075, radius2=0.025, depth=direction.length, matrix=transform)
save_mesh('Bush_AutumnBranches', branches, material)
bpy.ops.wm.save_as_mainfile(filepath=str(source))
