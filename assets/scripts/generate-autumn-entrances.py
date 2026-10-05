"""Original supported wreath/garland and a decorated copy of the existing wooden gate."""
import importlib.util
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
ASSETS=('AutumnWreathPost','AutumnGarland','AutumnFenceGate')
sys.dont_write_bytecode=True

def load(name,file):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(file));mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
cart=load('entrance_helpers','generate-chestnut-cart.py');tea=cart.tea;helpers=cart.helpers
rake=load('entrance_rake','generate-leaf-rake.py')
pumpkins=load('entrance_pumpkins','generate-harvest-pumpkins.py')
PALETTE=['B86232','C49439','A77A3D','8F5931','B77738']

def leaf(name,x,z,angle,length,shade,mat,y=.07):
    outline=[(-1,0),(-.6,-.44),(-.15,-.55),(.35,-.4),(1,0),(.35,.4),(-.15,.55),(-.6,.44)]
    points=[]
    for side in [0,.009]:
        for a,b in outline+[(0,0)]:
            points.append((x+length*(a*math.cos(angle)-b*math.sin(angle)),y+side+(.018 if a==b==0 else 0),z+length*(a*math.sin(angle)+b*math.cos(angle))))
    faces=[(i,(i+1)%8,8) for i in range(8)]+[(i+9,17,(i+1)%8+9) for i in range(8)]+[(i,i+9,(i+1)%8+9,(i+1)%8) for i in range(8)]
    return helpers.part(name,points,faces,[shade]*len(faces),mat)

def anchor(asset,name,position):
    obj=bpy.data.objects.new(asset+'_'+name,None);obj.location=position;obj.empty_display_size=.025;bpy.context.collection.objects.link(obj)

def generate(asset):
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0;bpy.context.scene.unit_settings.system='METRIC'
    bpy.context.scene['asset_name']=asset;bpy.context.scene['generated_by']='assets/scripts/generate-autumn-entrances.py'
    if asset=='AutumnFenceGate':
        # Copy the first-party gate's mesh/material/hinge contracts without changing its source.
        with bpy.data.libraries.load(str(ROOT/'assets/game-assets/FenceGate.blend'),link=False) as (data_from,data_to):data_to.objects=['FenceGate_Posts','FenceGate_Leaf']
        for obj in data_to.objects:
            bpy.context.collection.objects.link(obj);obj.name=obj.name.replace('FenceGate','AutumnFenceGate');obj.data.name=obj.data.name.replace('FenceGate','AutumnFenceGate')
        mat=tea.palette_material('AutumnEntrance.Pumpkins',.90);mat.name='Material.AutumnEntrance.Pumpkins'
        skin=helpers.shared.material('TemporarySkin','C87430');stem=helpers.shared.material('TemporaryStem','665A34')
        parts=[]
        for i,(x,r,h) in enumerate([(-.43,.09,.17),(.43,.09,.15)]):
            before=set(bpy.context.scene.objects)
            pumpkins.fruit(f'PostPumpkin{i}',r,h,x,0,.2+i*.7,False,skin,stem)
            for obj in set(bpy.context.scene.objects)-before:
                for vertex in obj.data.vertices:vertex.co.z+=.55
                shade='665A34' if obj.data.materials[0]==stem else ['C87430','D59B48'][i]
                parts.append(cart.bake(obj,obj.name,shade,mat))
        helpers.shared.join_parts(parts,asset+'_Decor')
        bpy.context.scene['editing_note']='Exact first-party wooden gate posts and hinge-relative leaf. Two composed pumpkins on fixed post caps, above the leaf sweep. No decorations attached to the leaf.'
    else:
        wood=tea.palette_material('AutumnEntrance.Timber',.9);wood.name='Material.AutumnEntrance.Timber'
        foliage=tea.palette_material('AutumnEntrance.Leaves',.93);foliage.name='Material.AutumnEntrance.Leaves'
        support=[];decor=[]
        if asset=='AutumnWreathPost':
            support.append(cart.box('GroundFoot',(0,0,.035),(.30,.32,.07),'927044',wood))
            support.append(cart.box('Upright',(0,0,.47),(.09,.10,.94),'A77E4C',wood))
            for i in range(16):
                a=math.tau*i/16;b=math.tau*(i+1)/16
                decor.append(rake.tube(f'TwigRing{i}',(.21*math.cos(a),.07,.73+.21*math.sin(a)),(.21*math.cos(b),.07,.73+.21*math.sin(b)),.018,'825832',foliage,6))
                decor.append(leaf(f'WreathLeaf{i}',.21*math.cos(a),.73+.21*math.sin(a),a+.7,.092,PALETTE[i%5],foliage))
            anchor(asset,'SwayRoot',(0,.07,.73))
        else:
            for side in [-1,1]:
                support.append(cart.box(f'Foot{side}',(side*.34,0,.03),(.12,.25,.06),'927044',wood))
                support.append(cart.box(f'Post{side}',(side*.34,0,.45),(.075,.075,.9),'A77E4C',wood))
                anchor(asset,'SwayLeft' if side==-1 else 'SwayRight',(side*.34,.07,.84))
            for i in range(10):
                x=-.34+.68*i/10;nextX=-.34+.68*(i+1)/10
                z=.84-.19*math.sin(math.pi*i/10);nextZ=.84-.19*math.sin(math.pi*(i+1)/10)
                decor.append(rake.tube(f'Cord{i}',(x,.07,z),(nextX,.07,nextZ),.012,'825832',foliage,6))
                decor.append(leaf(f'GarlandLeaf{i}',(x+nextX)/2,(z+nextZ)/2-.035,-.85 if i%2 else -2.3,.083,PALETTE[i%5],foliage))
        helpers.shared.join_parts(support,asset+'_Support');helpers.shared.join_parts(decor,asset+'_Foliage')
        bpy.context.scene['editing_note']='Original supported seasonal composition. Fixed support mesh and separately named foliage role with dormant sway anchors. No arbitrary attachment or active motion.'
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'assets/game-assets/{asset}.blend'))

def audit(asset):
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'assets/game-assets/{asset}.blend'))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];points=[o.matrix_world@Vector(c) for o in objects for c in o.bound_box]
    low=[min(p[i] for p in points) for i in range(3)];high=[max(p[i] for p in points) for i in range(3)]
    if asset!='AutumnFenceGate':assert all(low[i]>=-.43 and high[i]<=.43 for i in [0,1]) and high[2]<=1.05,(low,high)
    assert abs(low[2])<.0001
    counts={}
    for obj in objects:obj.data.calc_loop_triangles();counts[obj.name]=len(obj.data.loop_triangles);assert not obj.animation_data
    assert sum(counts.values())<3000
    print(json.dumps({'asset':asset,'sourceMin':low,'sourceMax':high,'triangles':counts,'meshes':len(objects),'materials':len(set(m.name for o in objects for m in o.data.materials))},indent=2))
if __name__=='__main__':
    for asset in ASSETS:
        if '--check' not in sys.argv:generate(asset)
        audit(asset)
