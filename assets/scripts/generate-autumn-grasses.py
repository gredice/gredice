"""Two original planted ornamental grass clusters with dormant wind-ready roles."""
import importlib.util
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
ASSETS=('AutumnGrassTuft','AutumnSeedHeads')
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('cart_helpers',Path(__file__).with_name('generate-chestnut-cart.py'))
cart=importlib.util.module_from_spec(spec); spec.loader.exec_module(cart)
tea=cart.tea; helpers=cart.helpers
spec=importlib.util.spec_from_file_location('rake_helpers',Path(__file__).with_name('generate-leaf-rake.py'))
rake=importlib.util.module_from_spec(spec); spec.loader.exec_module(rake)


def blade(name,x,y,angle,length,spread,mat,shade):
    direction=Vector((math.cos(angle),math.sin(angle),0))
    side=Vector((-math.sin(angle),math.cos(angle),0))
    vertices=[]
    for t,width in [(0,.015),(.36,.046),(.72,.035),(1,.001)]:
        center=Vector((x,y,.033+length*(t-.28*t*t)))+direction*spread*t*t
        vertices.extend([tuple(center-side*width/2),tuple(center+Vector((0,0,.009*math.sin(t*math.pi)))),tuple(center+side*width/2)])
    faces=[]
    for r in range(3):
        i=r*3
        faces.extend([(i,i+3,i+4,i+1),(i+1,i+4,i+5,i+2)])
    obj=helpers.part(name,vertices,faces,[shade]*len(faces),mat)
    # Give the folded blade a tiny solid back, avoiding transparent overdraw.
    solid=obj.modifiers.new('BladeThickness','SOLIDIFY');solid.thickness=.004
    bpy.context.view_layer.objects.active=obj; bpy.ops.object.modifier_apply(modifier=solid.name)
    group=obj.vertex_groups.new(name='WindWeight')
    for vertex in obj.data.vertices:
        group.add([vertex.index],max(0,min(1,(vertex.co.z-.033)/.5)),'REPLACE')
    return obj


def generate(asset):
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
    bpy.context.scene.unit_settings.system='METRIC'
    bpy.context.scene['asset_name']=asset
    bpy.context.scene['generated_by']='assets/scripts/generate-autumn-grasses.py'
    bpy.context.scene['editing_note']='Decorative gravel island and intentional three-clump grouping, distinct from live crops/weeds. Blades/seed heads use shared material roles and source WindWeight groups; runtime stays static until #4981.'
    static=tea.palette_material('GrassesGravel',.94);static.name='Material.AutumnGrasses.Gravel'
    base=tea.lathe('GravelIsland',0,0,[(0,0),(.29,0),(.34,.014),(.31,.031),(0,.032)],['897A5B','A89773','B5A581','A89773'],static,12)
    base.name=asset+'_Base';base.data.name=base.name
    foliage=tea.palette_material('GrassesBlades',.94);foliage.name='Material.AutumnGrasses.Blades'
    parts=[]
    for cluster,(x,y,phase) in enumerate([(-.10,-.09,.2),(.12,-.025,1.3),(-.01,.13,2.2)]):
        for i in range(7):
            angle=math.tau*i/7+phase
            length=(.29+.035*(i%3)) if asset=='AutumnGrassTuft' else (.23+.026*(i%3))
            parts.append(blade(f'Clump{cluster}Blade{i}',x,y,angle,length,.16 if asset=='AutumnGrassTuft' else .13,foliage,['B2934A','C3A65A','9A8748','BDA266'][i%4]))
        anchor=bpy.data.objects.new(asset+f'_WindRoot{cluster}',None);anchor.location=(x,y,.033);anchor.empty_display_size=.025;bpy.context.collection.objects.link(anchor)
    if asset=='AutumnSeedHeads':
        for i,(x,y,height) in enumerate([(-.14,-.10,.49),(-.08,.01,.58),(.11,-.05,.54),(.16,.045,.46),(-.02,.15,.52)]):
            parts.append(rake.tube(f'SeedStem{i}',(x,y,.033),(x+.035,y,height-.07),.009,'9B8C52',foliage,6))
            # Broad oval/tapered heads read as ornamental seed plumes at game zoom.
            parts.append(tea.lathe(f'SeedHead{i}',x+.035,y,[(0,height-.14),(.038,height-.10),(.048,height-.04),(.032,height+.015),(0,height+.065)],['B29A66','D6BF88','C6AE75','DDC794'],foliage,8))
    helpers.shared.join_parts(parts,asset+'_Foliage')
    obj=bpy.data.objects[asset+'_Foliage']
    group=obj.vertex_groups.get('WindWeight') or obj.vertex_groups.new(name='WindWeight')
    for vertex in obj.data.vertices:group.add([vertex.index],max(0,min(1,(vertex.co.z-.033)/.58)),'REPLACE')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'assets/game-assets/{asset}.blend'))


def audit(asset):
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'assets/game-assets/{asset}.blend'))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    assert {o.name for o in objects}=={asset+'_Base',asset+'_Foliage'}
    points=[o.matrix_world@Vector(c) for o in objects for c in o.bound_box]
    low=[min(p[i] for p in points) for i in range(3)];high=[max(p[i] for p in points) for i in range(3)]
    assert all(low[i]>=-.40 and high[i]<=.40 for i in (0,1)),(low,high)
    assert abs(low[2])<.0001 and high[2]<=.7
    triangles={}
    for obj in objects:
        obj.data.calc_loop_triangles();triangles[obj.name]=len(obj.data.loop_triangles)
        assert len(obj.data.materials)==1 and not obj.animation_data
        assert tuple(obj.location)==(0,0,0) and tuple(obj.scale)==(1,1,1)
    assert sum(triangles.values())<2000
    assert bpy.data.objects[asset+'_Foliage'].vertex_groups.get('WindWeight') is not None
    print(json.dumps({'asset':asset,'min':low,'max':high,'triangles':triangles,'meshes':2,'materials':2},indent=2))


if __name__=='__main__':
    for asset in ASSETS:
        if '--check' not in sys.argv:generate(asset)
        audit(asset)
