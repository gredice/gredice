"""Three original bounded woodland decorations; no real foraging/edibility meaning."""
import importlib.util
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
ASSETS=('WoodlandAcorns','WoodlandConkers','WoodlandMushroomBasket')
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('woodland_helpers',Path(__file__).with_name('generate-chestnut-cart.py'))
cart=importlib.util.module_from_spec(spec);spec.loader.exec_module(cart)
tea=cart.tea;helpers=cart.helpers
spec=importlib.util.spec_from_file_location('woodland_rake',Path(__file__).with_name('generate-leaf-rake.py'))
rake=importlib.util.module_from_spec(spec);spec.loader.exec_module(rake)

def generate(asset):
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
    bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene['asset_name']=asset
    bpy.context.scene['generated_by']='assets/scripts/generate-woodland-arrangements.py'
    bpy.context.scene['editing_note']='Intentionally composed chunky woodland decorations, not real mushroom species or foraging inventory. Named part vertex groups and dormant Observation anchor.'
    mat=tea.palette_material('Woodland.Arrangement',.92);mat.name='Material.Woodland.Arrangement'
    parts=[]
    if asset!='WoodlandMushroomBasket':
        parts.append(tea.lathe('LeafBed',0,0,[(0,0),(.31,0),(.39,.012),(.34,.027),(0,.031)],['815932','986B3F','BC8D4B','B38442'],mat,10))
    if asset=='WoodlandAcorns':
        for i,(x,y,r) in enumerate([(-.16,-.11,.10),(.12,-.12,.115),(0,.13,.13)]):
            parts.append(tea.lathe(f'Acorn{i}Nut',x,y,[(0,.03),(r*.6,.045),(r,.12),(r*.95,.21),(0,.22)],['B87D35','D09A50','BE8642','AA7335'],mat,10))
            parts.append(tea.lathe(f'Acorn{i}Cap',x,y,[(0,.20),(r*1.08,.20),(r*1.12,.235),(r*.60,.275),(0,.285)],['826038','806039','927448','7B5935'],mat,10))
            parts.append(rake.tube(f'Acorn{i}Stem',(x,y,.27),(x+.025,y,.33),.014,'755331',mat,6))
        anchor=(0,.13,.34)
    elif asset=='WoodlandConkers':
        for i,(x,y,r) in enumerate([(-.17,-.12,.105),(.11,-.15,.12),(-.02,.13,.13),(.20,.09,.08)]):
            # Faceted round conkers, each with a broad pale hilum, do not use food labels.
            parts.append(tea.lathe(f'Conker{i}',x,y,[(0,.03),(r*.72,.045),(r,.10),(r*.8,.19),(r*.40,.22),(0,.223)],['764B2C','895334','A06A3E','C5A071','D6BC91'],mat,10))
        # Two composed open husk wedges separate this silhouette from the acorn caps.
        for i,x in enumerate([-.21,.23]):
            parts.append(helpers.part(f'OpenHusk{i}',[(x-.075,.18,.025),(x+.075,.18,.025),(x+.07,.28,.04),(x,.28,.17),(x-.07,.28,.04)],[(0,1,2,3,4),(4,3,2,1,0)],['8C8B48','A6A05D'],mat))
        anchor=(-.02,.13,.235)
    else:
        parts.append(tea.lathe('Basket',0,0,[(0,0),(.24,0),(.29,.04),(.34,.23),(.34,.27),(.30,.27),(.27,.08),(0,.08)],['8C633D','A47A49','B78F5B','8C663D','CCA574','A8804D','B68E58'],mat,12))
        for i,z in enumerate([.075,.145,.215]):
            radius=.29+(z-.04)*.05/.19
            parts.append(tea.lathe(f'BasketBand{i}',0,0,[(radius,z),(radius+.012,z+.008),(radius+.012,z+.025),(radius,z+.032)],['89643E','C09B66','A47B47'],mat,12))
        for i,(x,y,h,r) in enumerate([(-.13,-.10,.34,.115),(.13,-.09,.38,.12),(0,.13,.43,.13)]):
            parts.append(tea.lathe(f'Mushroom{i}Stem',x,y,[(.033,.08),(.036,h-.07),(0,h-.06)],['DDD0AE','C6B994'],mat,8))
            parts.append(tea.lathe(f'Mushroom{i}Cap',x,y,[(0,h-.065),(r,h-.065),(r*.86,h-.015),(r*.45,h+.025),(0,h+.035)],['E7DABD','C8A66E','B38B54','C19A62'],mat,10))
        for i in range(12):
            a=math.pi*i/12;b=math.pi*(i+1)/12
            start=(.31*math.cos(a),0,.245+.36*math.sin(a));end=(.31*math.cos(b),0,.245+.36*math.sin(b))
            parts.append(rake.tube(f'BasketHandle{i}',start,end,.026,'AD824D',mat,6))
        anchor=(0,.13,.49)
    helpers.shared.join_parts(parts,asset+'_Arrangement')
    obj=bpy.data.objects.new(asset+'_Observation',None);obj.location=anchor;obj.empty_display_size=.035;bpy.context.collection.objects.link(obj)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'assets/game-assets/{asset}.blend'))

def audit(asset):
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'assets/game-assets/{asset}.blend'))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];assert len(objects)==1
    obj=objects[0];assert obj.name==asset+'_Arrangement';assert len(obj.data.materials)==1 and not obj.animation_data
    points=[obj.matrix_world@Vector(c) for c in obj.bound_box];low=[min(p[i] for p in points) for i in range(3)];high=[max(p[i] for p in points) for i in range(3)]
    assert all(low[i]>=-.45 and high[i]<=.45 for i in [0,1]);assert abs(low[2])<.0001 and high[2]<=.65
    assert tuple(obj.location)==(0,0,0) and tuple(obj.scale)==(1,1,1)
    obj.data.calc_loop_triangles();assert len(obj.data.loop_triangles)<1600
    print(json.dumps({'asset':asset,'min':low,'max':high,'triangles':len(obj.data.loop_triangles),'meshes':1,'materials':1},indent=2))
if __name__=='__main__':
    for asset in ASSETS:
        if '--check' not in sys.argv:generate(asset)
        audit(asset)
