"""Original open tray bird feeder; no spawning, feeding or inventory behavior."""
import importlib.util
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
ASSET='BirdFeeder'
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('rack_helpers',Path(__file__).with_name('generate-chestnut-cart.py'))
cart=importlib.util.module_from_spec(spec);spec.loader.exec_module(cart)
tea=cart.tea;helpers=cart.helpers

def generate():
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
    bpy.context.scene.unit_settings.system='METRIC'
    bpy.context.scene['asset_name']=ASSET
    bpy.context.scene['generated_by']='assets/scripts/generate-bird-feeder.py'
    bpy.context.scene['editing_note']='Open octagonal tray, two perches and cross-foot pedestal. Editable named vertex groups. No bird attraction or feeding economy.'
    mat=tea.palette_material('BirdFeeder.Timber',.93)
    mat.name='Material.BirdFeeder.Timber'
    parts=[cart.box('FootX',(0,0,.04),(.64,.13,.08),'735139',mat),cart.box('FootY',(0,0,.04),(.13,.64,.08),'85603D',mat),cart.box('Post',(0,0,.395),(.12,.12,.69),'A17A49',mat)]
    parts.append(tea.lathe('Tray',0,0,[(0,.73),(.28,.73),(.34,.77),(.34,.835),(.295,.835),(.265,.785),(0,.785)],['9C794B','BD9660','D3AD70','CFA66A','B98E56','AD8851'],mat,8))
    for i in range(2):
        parts.append(cart.box('Perch'+str(i),(0,0,.765),(.82 if i==0 else .04,.04 if i==0 else .82,.045),'B78D57',mat,.009))
    for i,(x,y) in enumerate([(-.13,-.08),(.05,-.13),(.14,.06),(-.06,.10),(0,0)]):
        parts.append(tea.lathe('Seed'+str(i),x,y,[(0,.783),(.035,.796),(.027,.81),(0,.825)],['C9AF70','D4C18E','BBA060'],mat,6))
    helpers.shared.join_parts(parts,ASSET+'_Arrangement')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'assets/game-assets/{ASSET}.blend'))

def audit():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'assets/game-assets/{ASSET}.blend'))
    objects=list(bpy.context.scene.objects);assert len(objects)==1
    obj=objects[0];assert obj.name==ASSET+'_Arrangement'
    points=[obj.matrix_world@Vector(c) for c in obj.bound_box]
    low=[min(p[i] for p in points) for i in range(3)];high=[max(p[i] for p in points) for i in range(3)]
    assert all(low[i]>=-.45 and high[i]<=.45 for i in [0,1]);assert abs(low[2])<.0001 and high[2]<=.85
    assert len(obj.data.materials)==1 and not obj.animation_data
    assert tuple(obj.location)==(0,0,0) and tuple(obj.scale)==(1,1,1)
    obj.data.calc_loop_triangles();assert len(obj.data.loop_triangles)<2000
    print(json.dumps({'asset':ASSET,'min':low,'max':high,'triangles':len(obj.data.loop_triangles),'meshes':1,'materials':1},indent=2))
if __name__=='__main__':
    if '--check' not in sys.argv:generate()
    audit()
