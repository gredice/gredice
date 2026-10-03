"""A contained three-legged garden brazier with a separate dormant ember role."""
import importlib.util
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
ASSET='GardenBrazier'
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('cart_helpers',Path(__file__).with_name('generate-chestnut-cart.py'))
cart=importlib.util.module_from_spec(spec); spec.loader.exec_module(cart)
tea=cart.tea
helpers=cart.helpers
spec=importlib.util.spec_from_file_location('rake_helpers',Path(__file__).with_name('generate-leaf-rake.py'))
rake=importlib.util.module_from_spec(spec); spec.loader.exec_module(rake)


def generate():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version=0
    bpy.context.scene.unit_settings.system='METRIC'
    bpy.context.scene['asset_name']=ASSET
    bpy.context.scene['generated_by']='assets/scripts/generate-garden-brazier.py'
    bpy.context.scene['editing_note']='Three grounded legs, thick open steel bowl, hollow loop handles and separate coal/Embers material role. Runtime keeps emission disabled until #4980. Source empties reserve contained fire/smoke/sound anchors.'
    metal=tea.palette_material('BrazierMetal',.86); metal.name='Material.GardenBrazier.Metal'
    parts=[tea.lathe('SteelBowl',0,0,[(0,.22),(.15,.22),(.28,.31),(.34,.45),(.34,.485),(.30,.485),(.265,.335),(0,.305)],['47544D','526059','526059','76857B','859087','526059','3F4B44'],metal,12)]
    for i in range(3):
        angle=math.tau*i/3
        x,y=.205*math.cos(angle),.205*math.sin(angle)
        parts.append(cart.box(f'Leg{i}',(x,y,.145),(.065,.065,.29),'47544D',metal,.008))
        parts.append(cart.box(f'Foot{i}',(x,y,.018),(.10,.10,.036),'526059',metal,.008))
    for side in [-1,1]:
        points=[(side*(.377+.045*math.cos(math.tau*i/12)),0,.412+.045*math.sin(math.tau*i/12)) for i in range(12)]
        for i,point in enumerate(points):
            parts.append(rake.tube(f'Handle{side}_{i}',point,points[(i+1)%12],.013,'6C7B70',metal,6))
    helpers.shared.join_parts(parts,ASSET+'_Metal')
    embers=tea.palette_material('BrazierEmbers',.94); embers.name='Material.GardenBrazier.Embers'
    shader=embers.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Emission Color'].default_value=helpers.color('B95F28')
    shader.inputs['Emission Strength'].default_value=.2
    parts=[]
    for i,(x,y,z,angle) in enumerate([(-.11,-.07,.337,.15),(.08,-.10,.342,-.2),(.015,.07,.347,.8),(-.11,.09,.339,-.7)]):
        obj=cart.box(f'CharredBillet{i}',(x,y,z),(.19,.085,.065),'57483C' if i%2 else '665346',embers,.014)
        # Bake a small local yaw while keeping a stable base-centred source transform.
        center=Vector((x,y,z))
        from mathutils import Matrix
        obj.data.transform(Matrix.Translation(center) @ Matrix.Rotation(angle,4,'Z') @ Matrix.Translation(-center))
        parts.append(obj)
    helpers.shared.join_parts(parts,ASSET+'_Embers')
    for name,position,radius in [('Fire',(0,0,.395),.18),('Smoke',(0,0,.515),.14),('Sound',(0,0,.37),0)]:
        anchor=bpy.data.objects.new(ASSET+'_'+name,None)
        anchor.location=position
        anchor.empty_display_size=.03
        anchor['emitter_radius']=radius
        bpy.context.collection.objects.link(anchor)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'assets/game-assets/{ASSET}.blend'))


def audit():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'assets/game-assets/{ASSET}.blend'))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    assert {o.name for o in objects}=={ASSET+'_Metal',ASSET+'_Embers'}
    points=[o.matrix_world@Vector(c) for o in objects for c in o.bound_box]
    low=[min(p[i] for p in points) for i in range(3)]; high=[max(p[i] for p in points) for i in range(3)]
    assert all(low[i]>=-.45 and high[i]<=.45 for i in (0,1)),(low,high)
    assert abs(low[2])<.0001 and high[2]<=.50
    triangles={}
    for obj in objects:
        obj.data.calc_loop_triangles(); triangles[obj.name]=len(obj.data.loop_triangles)
        assert len(obj.data.materials)==1 and not obj.animation_data
        assert tuple(obj.location)==(0,0,0) and tuple(obj.scale)==(1,1,1)
    assert sum(triangles.values())<2200
    print(json.dumps({'asset':ASSET,'min':low,'max':high,'triangles':triangles,'meshes':2,'materials':2},indent=2))


if __name__=='__main__':
    if '--check' not in sys.argv:
        generate()
    audit()
