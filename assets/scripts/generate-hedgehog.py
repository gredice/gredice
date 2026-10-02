"""Original hedgehog with rigid idle/walk/sniff clips, and a compatible open shelter."""
import importlib.util,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[2]
def module(name,file):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(file));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
cart=module('cart','generate-chestnut-cart.py');animal=module('animal','generate-squirrel.py')

def reset(name):
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
    bpy.context.scene['asset_name']=name;bpy.context.scene['generated_by']='assets/scripts/generate-hedgehog.py'
    bpy.context.scene.render.fps=24
    mat=cart.tea.palette_material(name+'.Palette',.95);mat.name='Material.'+name+'.Palette';return mat

def ico(name,position,scale,shade,mat,subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions,radius=1,location=position);obj=bpy.context.object;obj.scale=scale;return cart.bake(obj,name,shade,mat)
def joined(parts,name,parent):
    cart.helpers.shared.join_parts(parts,name);obj=bpy.context.active_object;animal.parent_keep_transform(obj,parent);return obj

def hedgehog():
    mat=reset('Hedgehog');root=animal.empty('Hedgehog_Root',(0,0,0));body=animal.empty('Hedgehog_BodyPivot',(0,0,.1));animal.parent_keep_transform(body,root)
    parts=[ico('Body',(0,-.02,.125),(.12,.16,.108),'715339',mat,2)]
    for ring,(z,radius,count) in enumerate([(.17,.075,8),(.212,.035,5)]):
        for i in range(count):
            a=i*2*math.pi/count
            bpy.ops.mesh.primitive_cone_add(vertices=5,radius1=.035,radius2=0,depth=.056,location=(math.cos(a)*radius,-.028+math.sin(a)*radius*1.3,z),rotation=(.25*math.sin(a),-.25*math.cos(a),a));o=bpy.context.object
            parts.append(cart.bake(o,'Spines'+str(ring)+'_'+str(i),'9F8057' if i%2 else '806044',mat))
    joined(parts,'Hedgehog_Body',body)
    head=animal.empty('Hedgehog_HeadPivot',(0,.10,.105));animal.parent_keep_transform(head,root)
    parts=[ico('Face',(0,.13,.105),(.072,.10,.069),'C9AF83',mat,2),ico('Nose',(0,.235,.084),(.022,.019,.019),'303A35',mat)]
    for i,x in enumerate([-.056,.056]):
        parts.append(ico('Eye'+str(i),(x,.166,.132),(.013,.013,.013),'272F2C',mat))
        parts.append(ico('Ear'+str(i),(x,.08,.164),(.024,.018,.025),'AD895B',mat))
    joined(parts,'Hedgehog_Head',head)
    pivots=[body,head]
    for i,(x,y) in enumerate([(-.074,-.095),(.074,-.095),(-.074,.078),(.074,.078)]):
        pivot=animal.empty('Hedgehog_LegPivot'+str(i),(x,y,.052));animal.parent_keep_transform(pivot,root);pivots.append(pivot)
        joined([ico('Foot'+str(i),(x,y+.012,.034),(.026,.04,.034),'755C42',mat)],'Hedgehog_Foot'+str(i),pivot)
    for clip in ['HedgehogIdle','HedgehogWalk','HedgehogSniff']:
        end=49 if clip=='HedgehogIdle' else 25
        for i,pivot in enumerate(pivots):
            frames=[]
            for f,phase in [(1,0),(end//4+1,1),(end//2+1,0),(end*3//4+1,-1),(end,0)]:
                location=(0,0,0);rotation=(0,0,0);scale=(1,1,1)
                if clip=='HedgehogIdle' and i==0:scale=(1,1,1+.025*phase)
                if clip=='HedgehogWalk' and i>=2:
                    direction=1 if i in [2,5] else -1;rotation=(.28*phase*direction,0,0)
                if clip=='HedgehogWalk' and i==0:location=(0,0,.005*abs(phase))
                if clip=='HedgehogSniff' and i==1:rotation=(-.16*abs(phase),0,.07*phase);location=(0,.008*abs(phase),-.004*abs(phase))
                frames.append((f,location,rotation,scale))
            animal.animate_object(clip,pivot,frames)
    bpy.context.scene.frame_set(1);bpy.context.scene['editing_note']='One palette, six rigid mesh parts, six animated pivots. Idle breathing, alternating feet, sniffing head. Shared NLA names export three clips.'
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/game-assets/Hedgehog.blend'))

def shelter():
    mat=reset('HedgehogShelter');parts=[];steps=8;profile=[]
    for i in range(steps+1):
        a=math.pi*i/steps;profile.append((.4*math.cos(a),.18+.3*math.sin(a)))
    for i in range(steps,-1,-1):
        a=math.pi*i/steps;profile.append((.32*math.cos(a),.18+.22*math.sin(a)))
    n=len(profile);verts=[(x,y,z) for y in [-.37,.37] for x,z in profile]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    parts.append(cart.helpers.part('ArchedRoof',verts,faces,[['87613F','A77D4B','B18B56','916D46'][i%4] for i in range(len(faces))],mat))
    for i,x in enumerate([-.36,.36]):parts.append(cart.box('Side'+str(i),(x,0,.09),(.08,.74,.18),'946D43',mat,.009))
    parts.append(cart.box('Back',(0,-.33,.17),(.64,.08,.34),'8D683F',mat,.012))
    parts.append(cart.tea.lathe('Bedding',0,0,[(0,.004),(.25,.004),(.27,.018),(0,.026)],['A18E58','B9A266','C0AC76'],mat,10))
    cart.helpers.shared.join_parts(parts,'HedgehogShelter_Arrangement')
    bpy.context.scene['editing_note']='Arched roof and two side boards leave an open front corridor x=+-0.16, y=.15 to .6, z<.25 for the owned visitor. Back wall is closed. No water/feeding mechanics.'
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/game-assets/HedgehogShelter.blend'))

def audit(name):
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'assets/game-assets/{name}.blend'));meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];points=[];tris=0
    for o in meshes:o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles);points.extend(o.matrix_world@Vector(c) for c in o.bound_box)
    lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
    assert len(bpy.data.materials)==1 and tris<1500
    assert all(lo[i]>=-.45 and hi[i]<=.45 for i in [0,1]) and lo[2]>=-.005 and hi[2]<=.5
    print(json.dumps({'name':name,'triangles':tris,'bounds':[lo,hi],'meshes':len(meshes),'objects':[o.name for o in bpy.context.scene.objects]}))
if __name__=='__main__':
    if '--check' not in sys.argv:hedgehog();shelter()
    for name in ['Hedgehog','HedgehogShelter']:audit(name)
