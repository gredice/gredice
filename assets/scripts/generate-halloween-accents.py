"""Original friendly sheet ornament and small supported web. All opaque geometry."""
import importlib.util,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector,Matrix
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[2]
# This file lives in assets/scripts when executed.
spec=importlib.util.spec_from_file_location('cart',Path(__file__).with_name('generate-chestnut-cart.py'))
cart=importlib.util.module_from_spec(spec);spec.loader.exec_module(cart)
spec=importlib.util.spec_from_file_location('rake',Path(__file__).with_name('generate-leaf-rake.py'))
rake=importlib.util.module_from_spec(spec);spec.loader.exec_module(rake)
ASSETS=['FriendlyGhost','SupportedCobweb']

def generate(name):
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
    bpy.context.scene['asset_name']=name
    bpy.context.scene['generated_by']='assets/scripts/generate-halloween-accents.py'
    bpy.context.scene['editing_note']='Opaque named vertex groups preserve authored cloth/face/frame/strands. No textures, animation or transparent picking plane.'
    mat=cart.tea.palette_material(name+'.Palette',.95);mat.name='Material.'+name+'.Palette'
    if name=='FriendlyGhost':
        parts=[cart.box('FootX',(0,-.08,.035),(.6,.12,.07),'805737',mat),cart.box('FootY',(0,-.08,.035),(.12,.44,.07),'976B43',mat),cart.box('Pole',(0,-.22,.46),(.065,.065,.92),'A47C4C',mat),cart.box('CrossArm',(0,-.1,.82),(.065,.26,.065),'BE965F',mat)]
        vertices=[];segments=16
        profile=[(.29,.26,.17),(.43,.24,.16),(.59,.34,.17),(.77,.19,.135),(.89,.125,.095),(.955,.025,.025)]
        for j,(z,rx,ry) in enumerate(profile):
            for i in range(segments):
                a=2*math.pi*i/segments
                ripple=.028*(.5+.5*math.cos(a*4)) if j==0 else 0
                fold=1-.07*(i%2)
                vertices.append((rx*math.cos(a)*fold,ry*math.sin(a)*fold,z+ripple))
        faces=[]
        for j in range(len(profile)-1):
            for i in range(segments):
                a=j*segments+i;b=j*segments+(i+1)%segments;faces.append((a,b,b+segments,a+segments))
        faces.extend([tuple(reversed(range(segments))),tuple(range(80,96))])
        parts.append(cart.helpers.part('Sheet',vertices,faces,['F2E9CC','E5DABB','FAF0D5'],mat))
        for i,x in enumerate([-.065,.065]):
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,.137,.78));o=bpy.context.object;o.scale=(.025,.012,.033);parts.append(cart.bake(o,'Eye'+str(i),'394546',mat))
        mouth=[(-.052,.166,.70),(-.029,.176,.68),(0,.18,.673),(.029,.176,.68),(.052,.166,.70)]
        for i in range(len(mouth)-1):parts.append(rake.tube('Smile'+str(i),mouth[i],mouth[i+1],.008,'46504A',mat,5))
    else:
        parts=[cart.box('Foot',(-.12,0,.035),(.62,.32,.07),'805737',mat),cart.box('Post',(-.29,0,.48),(.075,.075,.96),'A47C4C',mat),cart.box('TopBeam',(0,0,.915),(.66,.075,.075),'B98E5A',mat)]
        center=Vector((-.25,.035,.865));segments=5
        def point(r,a):return center+Vector((math.cos(a)*r,0,-math.sin(a)*r))
        for i in range(segments):
            a=(math.pi/2)*i/(segments-1)
            parts.append(rake.tube('Spoke'+str(i),center,point(.53,a),.009,'F0E5C9',mat,5))
        for j,r in enumerate([.17,.34,.53]):
            for i in range(segments-1):
                a=(math.pi/2)*i/(segments-1);b=(math.pi/2)*(i+1)/(segments-1)
                start=point(r,a);end=point(r,b);mid=(start+end)*.5+Vector((-.014,0,.014))
                parts.append(rake.tube('Arc'+str(j)+'_'+str(i)+'a',start,mid,.008,'E9DDC3',mat,5))
                parts.append(rake.tube('Arc'+str(j)+'_'+str(i)+'b',mid,end,.008,'E9DDC3',mat,5))
    cart.helpers.shared.join_parts(parts,name+'_Arrangement')
    obj=bpy.context.active_object
    # Front points into the default garden camera; catalogue uses the reverse view.
    obj.data.transform(Matrix.Rotation(math.pi/4,4,'Z'))
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'assets/game-assets/{name}.blend'))

def audit(name):
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'assets/game-assets/{name}.blend'))
    objects=list(bpy.context.scene.objects);assert len(objects)==1
    obj=objects[0];assert obj.name==name+'_Arrangement'
    points=[obj.matrix_world@Vector(c) for c in obj.bound_box];lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
    assert all(lo[i]>=-.45 and hi[i]<=.45 for i in [0,1]);assert abs(lo[2])<.0001 and hi[2]<=1
    assert len(obj.data.materials)==1 and not obj.animation_data
    obj.data.calc_loop_triangles();assert len(obj.data.loop_triangles)<1800
    print(json.dumps({'asset':name,'min':lo,'max':hi,'triangles':len(obj.data.loop_triangles),'meshes':1,'materials':1}))
if __name__=='__main__':
    for name in ASSETS:
        if '--check' not in sys.argv:generate(name)
        audit(name)
