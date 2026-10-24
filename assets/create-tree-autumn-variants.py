"""Author the seasonal Tree meshes in source-local coordinates, then export normally."""
from pathlib import Path
import bpy
import bmesh
from mathutils import Matrix, Vector

source = Path(__file__).resolve().parent / 'game-assets' / 'Tree.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
tree = bpy.data.objects['Tree 1']

def save_mesh(name, mesh, material):
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    data = bpy.data.meshes.new(name)
    mesh.to_mesh(data)
    mesh.free()
    data.materials.append(bpy.data.materials[material])
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.matrix_world = tree.matrix_world.copy()
    # Variants overlap intentionally; runtime selects a single canopy.
    obj.hide_set(True)

anchors = [(-2.5, -1.8, 2.6), (2.4, -1.6, 2.8), (-1.8, 2.4, 2.7), (2.2, 2.1, 2.9)]
for name, selected, scale in [
    ('Tree_AutumnThinning', anchors, (3.0, 3.1, 0.95)),
    ('Tree_AutumnSparse', [anchors[0], anchors[3]], (1.7, 1.8, 0.55)),
]:
    bm = bmesh.new()
    for center in selected:
        transform = Matrix.Translation(Vector(center)) @ Matrix.Diagonal((*scale, 1))
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1, matrix=transform)
    save_mesh(name, bm, 'Material.Leaves')

branches = bmesh.new()
for center in anchors:
    start = Vector((0, 0, 0.75))
    end = Vector(center)
    direction = end - start
    transform = Matrix.Translation((start + end) / 2) @ direction.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bmesh.ops.create_cone(branches, cap_ends=True, cap_tris=True, segments=5,
                         radius1=0.36, radius2=0.10, depth=direction.length, matrix=transform)
save_mesh('Tree_AutumnBranches', branches, 'Material.Planks')
bpy.ops.wm.save_as_mainfile(filepath=str(source))
