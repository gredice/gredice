"""Two original carved faces in the approved ribbed HarvestPumpkin family."""
import importlib.util,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('pumpkins',Path(__file__).with_name('generate-harvest-pumpkins.py'))
pumpkins=importlib.util.module_from_spec(spec);spec.loader.exec_module(pumpkins)
ASSETS=['PumpkinLanternSmile','PumpkinLanternWink']

def subtract(body,cutter):
    bpy.context.view_layer.objects.active=body
    modifier=body.modifiers.new('AuthoredCarving','BOOLEAN');modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=cutter
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter,do_unlink=True)

def face_cut(name,points,mat):
    count=len(points)
    vertices=[(x,y,z+.7*(y-.28)) for y in [.03,.5] for x,z in points]
    faces=[tuple(reversed(range(count))),tuple(range(count,count*2))]+[(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    obj=pumpkins.mesh(name,vertices,faces,mat)
    # Consistent outward normals for boolean solids.
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
    return obj

def generate(name):
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
    bpy.context.scene['editing_note']='Original ribbed HarvestPumpkin shell with applied cavity and face booleans. Body, stem and opaque interior glow remain editable. No embedded lights.'
    skin=pumpkins.material('Material.PumpkinLantern.Skin','E08A3C');stem=pumpkins.material('Material.PumpkinLantern.Stem','4E7F35');glow=pumpkins.material('Material.PumpkinLantern.Glow','734820')
    shader=glow.node_tree.nodes.get('Principled BSDF');shader.inputs['Emission Color'].default_value=(1,.34,.035,1);shader.inputs['Emission Strength'].default_value=.2
    body,stalk=pumpkins.fruit(name,.35,.49,0,0,.12,False,skin,stem)
    body.name=name+'_Body';stalk.name=name+'_Stem'
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=10,radius=1,location=(0,0,.245));cavity=bpy.context.object;cavity.scale=(.285,.285,.205)
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);subtract(body,cavity)
    eyes=[[(-.19,.285),(-.045,.285),(-.115,.395)],[(.045,.285),(.19,.285),(.115,.395)]]
    mouth=[(-.195,.235),(-.1,.205),(0,.19),(.1,.205),(.195,.235),(.15,.13),(0,.105),(-.15,.13)]
    if name.endswith('Wink'):
        eyes[1]=[(.045,.325),(.11,.365),(.20,.335),(.17,.305),(.11,.325),(.065,.30)]
        mouth=[(-.19,.24),(-.095,.21),(-.075,.235),(-.025,.22),(-.04,.175),(.095,.20),(.195,.255),(.15,.125),(0,.105),(-.15,.14)]
    mouth=[(x,z+.04) for x,z in mouth]
    for i,points in enumerate([*eyes,mouth]):subtract(body,face_cut('FaceCut'+str(i),points,skin))
    body.data.materials.clear();body.data.materials.append(skin)
    for poly in body.data.polygons:poly.material_index=0
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=(0,.02,.245));inside=bpy.context.object;inside.name=name+'_Glow';inside.scale=(.25,.24,.19);inside.data.materials.append(glow)
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    # Mesh names are also stable in glTF.
    for obj in bpy.context.scene.objects:
        obj.data.name=obj.name
        obj.data.transform(Matrix.Rotation(math.pi/4,4,'Z'))
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'assets/game-assets/{name}.blend'))

def audit(name):
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'assets/game-assets/{name}.blend'))
    tris={};points=[]
    assert {o.name for o in bpy.context.scene.objects}=={name+'_'+role for role in ['Body','Stem','Glow']}
    for obj in bpy.context.scene.objects:
        obj.data.calc_loop_triangles();tris[obj.name]=len(obj.data.loop_triangles);points.extend(obj.matrix_world@Vector(c) for c in obj.bound_box)
        assert len(obj.data.materials)==1 and not obj.modifiers
    lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
    assert all(lo[i]>=-.45 and hi[i]<=.45 for i in [0,1]);assert abs(lo[2])<.0001 and hi[2]<=.55
    assert sum(tris.values())<3500
    print(json.dumps({'name':name,'triangles':tris,'bounds':[lo,hi]}))
if __name__=='__main__':
    for name in ASSETS:
        if '--check' not in sys.argv:generate(name)
        audit(name)
