"""Six original chunky split logs in a stable three-two-one stack."""
import importlib.util
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
ASSET = 'StackedFirewood'
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('timber_helpers', Path(__file__).with_name('generate-fallen-log.py'))
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)


def log(name, x, y, z, length, mat):
    # Flat split faces give each billet a stable base and broad angular cut ends.
    profile = [(-.115,0),(.115,0),(.13,.07),(.075,.145),(-.075,.145),(-.13,.07)]
    verts=[(x+a,y+side*length/2,z+b) for side in [-1,1] for a,b in profile]
    faces=[(i,i+6,(i+1)%6+6,(i+1)%6) for i in range(6)]
    shades=['B38B57','795536','6C4C32','CBA16B','815C38','705136']
    # End-grain is broad geometry: outer pale ring, one darker stripe, solid core.
    for side in [-1,1]:
        offset=len(verts)
        for scale in [1,.76,.62]:
            verts.extend((x+a*scale,y+side*(length/2+.001),z+.068+(b-.068)*scale) for a,b in profile)
        for ring,shade in enumerate(['D4AF77','AC804B']):
            for i in range(6):
                face=(offset+ring*6+i,offset+ring*6+(i+1)%6,offset+(ring+1)*6+(i+1)%6,offset+(ring+1)*6+i)
                faces.append(face if side==-1 else tuple(reversed(face)))
                shades.append(shade)
        face=tuple(offset+12+i for i in range(6))
        faces.append(face if side==-1 else tuple(reversed(face)))
        shades.append('E0BD87')
    return helpers.part(name,verts,faces,shades,mat)


def generate():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version=0
    bpy.context.scene.unit_settings.system='METRIC'
    bpy.context.scene['asset_name']=ASSET
    bpy.context.scene['generated_by']='assets/scripts/generate-stacked-firewood.py'
    bpy.context.scene['editing_note']='Six editable SplitLog vertex groups. Flat bases, broad light end grain and bark/split planes share a corner Color palette. No textures or active effects.'
    mat=helpers.shared.material('Material.StackedFirewood.Timber','FFFFFF')
    mat.roughness=.93
    shader=mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value=.93
    colors=mat.node_tree.nodes.new('ShaderNodeVertexColor'); colors.layer_name='Color'
    mat.node_tree.links.new(colors.outputs['Color'],shader.inputs['Base Color'])
    specs=[(-.25,0,0,.65),(0,-.018,0,.69),(.25,.012,0,.62),(-.125,.02,.14,.64),(.125,-.015,.14,.67),(0,0,.28,.60)]
    parts=[log(f'SplitLog{i}',*coords,mat) for i,coords in enumerate(specs)]
    helpers.shared.join_parts(parts,ASSET+'_Timber')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'assets/game-assets/{ASSET}.blend'))


def audit():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'assets/game-assets/{ASSET}.blend'))
    objects=list(bpy.context.scene.objects)
    assert len(objects)==1 and objects[0].name==ASSET+'_Timber'
    obj=objects[0]
    points=[obj.matrix_world@Vector(c) for c in obj.bound_box]
    low=[min(p[i] for p in points) for i in range(3)]
    high=[max(p[i] for p in points) for i in range(3)]
    assert all(low[i]>=-.45 and high[i]<=.45 for i in (0,1)),(low,high)
    assert abs(low[2])<.0001 and high[2]<=.45
    assert {g.name for g in obj.vertex_groups}=={f'SplitLog{i}' for i in range(6)}
    assert tuple(obj.location)==(0,0,0) and tuple(obj.scale)==(1,1,1)
    assert len(obj.data.materials)==1 and not obj.animation_data
    obj.data.calc_loop_triangles()
    assert len(obj.data.loop_triangles)<600
    print(json.dumps({'asset':ASSET,'min':low,'max':high,'triangles':len(obj.data.loop_triangles),'meshes':1,'materials':1},indent=2))


if __name__=='__main__':
    if '--check' not in sys.argv:
        generate()
    audit()
