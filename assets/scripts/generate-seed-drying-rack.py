"""Original decorative timber drying rack; no inventory or seed-production role."""
import importlib.util
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
ASSET='SeedDryingRack'
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('rack_helpers',Path(__file__).with_name('generate-chestnut-cart.py'))
cart=importlib.util.module_from_spec(spec);spec.loader.exec_module(cart)
tea=cart.tea;helpers=cart.helpers

def generate():
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
    bpy.context.scene.unit_settings.system='METRIC'
    bpy.context.scene['asset_name']=ASSET
    bpy.context.scene['generated_by']='assets/scripts/generate-seed-drying-rack.py'
    bpy.context.scene['editing_note']='Original four-foot timber rack, two broad mesh-free drying trays and three composed hanging heads. Editable named vertex groups; decoration only, no stored seeds or rewards.'
    mat=tea.palette_material('SeedDryingRack.Timber',.93)
    parts=[]
    for i,x in enumerate([-.30,.30]):
        for j,y in enumerate([-.24,.24]):
            parts.append(cart.box(f'Foot{i}{j}',(x,y,.035),(.11,.12,.07),'896440',mat))
            parts.append(cart.box(f'Post{i}{j}',(x,y,.42),(.065,.065,.84),'987344',mat))
        parts.append(cart.box(f'TopSide{i}',(x,0,.85),(.085,.58,.08),'B98F56',mat))
    parts.append(cart.box('HangingRail',(0,0,.90),(.74,.07,.07),'BB925C',mat))
    for i,z in enumerate([.25,.52]):
        parts.append(cart.box(f'Tray{i}Base',(0,0,z),(.64,.52,.035),'AD966C',mat))
        for side in [-1,1]:
            parts.append(cart.box(f'Tray{i}LongRim{side}',(0,side*.275,z+.045),(.70,.045,.10),'C29C64',mat))
            parts.append(cart.box(f'Tray{i}EndRim{side}',(side*.325,0,z+.045),(.045,.52,.10),'B48B54',mat))
        for j,x in enumerate([-.19,0,.19]):
            # Broad pale seed-head forms lie on the tray; intentionally no loose scatter.
            parts.append(cart.box(f'Tray{i}DryingBundle{j}',(x,.015,z+.035),(.11,.32,.035),['BDAC76','CFBD8B','AF995E'][j],mat,.015))
    for i,x in enumerate([-.19,0,.19]):
        parts.append(tea.lathe(f'HangingStem{i}',x,0,[(.010,.71),(.010,.87),(0,.87)],['99834E','99834E'],mat,6))
        parts.append(tea.lathe(f'HangingHead{i}',x,0,[(0,.61),(.043,.65),(.050,.72),(.032,.77),(0,.79)],['AF9053','C9AE70','DBC48B','BBA16A'],mat,8))
    helpers.shared.join_parts(parts,ASSET+'_Arrangement')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'assets/game-assets/{ASSET}.blend'))

def audit():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'assets/game-assets/{ASSET}.blend'))
    objects=list(bpy.context.scene.objects);assert len(objects)==1
    obj=objects[0];assert obj.name==ASSET+'_Arrangement'
    points=[obj.matrix_world@Vector(c) for c in obj.bound_box]
    low=[min(p[i] for p in points) for i in range(3)];high=[max(p[i] for p in points) for i in range(3)]
    assert all(low[i]>=-.45 and high[i]<=.45 for i in [0,1]);assert abs(low[2])<.0001 and high[2]<=1
    assert len(obj.data.materials)==1 and not obj.animation_data
    assert tuple(obj.location)==(0,0,0) and tuple(obj.scale)==(1,1,1)
    obj.data.calc_loop_triangles();assert len(obj.data.loop_triangles)<2000
    print(json.dumps({'asset':ASSET,'min':low,'max':high,'triangles':len(obj.data.loop_triangles),'meshes':1,'materials':1},indent=2))
if __name__=='__main__':
    if '--check' not in sys.argv:generate()
    audit()
