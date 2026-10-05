"""Original compact maple: forked trunk, layered lobes and three opaque canopy states."""
import importlib.util
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('shrub', Path(__file__).with_name('generate-autumn-shrub.py'))
shrub = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shrub)
shared = shrub.shared
NAME = 'SeasonalMaple'

def generate():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.scene['preview_note'] = 'Wood plus exactly one Full/Thinning/Sparse canopy; source origin at support plane.'
    wood = shared.material('Material.SeasonalMaple.Wood', '79563C')
    leaves = shared.material('Material.SeasonalMaple.Leaves', '78A447')
    parts = [shrub.branch((0,0,0),(.025,0,.73),.08,wood)]
    centers = [(-.21,-.08,1.03),(.20,.03,1.12),(-.12,.19,1.28),(.12,-.16,1.39),(0,.025,1.57)]
    scales = [(.23,.25,.23),(.24,.26,.25),(.24,.23,.25),(.25,.23,.26),(.25,.24,.23)]
    for i,c in enumerate(centers):
        start=(.02,0,.42+i*.12)
        tip=(c[0]*.92,c[1]*.92,c[2]+.09)
        parts.append(shrub.branch(start,tip,.032,wood))
        parts.append(shrub.branch(Vector(start).lerp(Vector(tip),.7),(c[0]+.07,c[1]-.045,c[2]+.04),.015,wood))
    shared.join_parts(parts, NAME+'_Wood')
    for stage,factor,count in [('Full',1,3),('Thinning',.68,2),('Sparse',.25,1)]:
        parts=[]
        for i,(c,s) in enumerate(zip(centers,scales)):
            parts.append(shrub.clump(c,tuple(v*factor for v in s),leaves))
            for j in range(count):
                a=i*.9+j*math.tau/count
                pos=(c[0]+math.cos(a)*s[0]*factor*.65,c[1]+math.sin(a)*s[1]*factor*.65,c[2]+s[2]*factor*.3)
                # Broad five-point, ridge-folded maple blade. No alpha or texture.
                rim=[(-.5,0),(-.28,-.17),(-.34,-.48),(-.06,-.31),(.18,-.55),(.24,-.2),(.68,0),(.24,.2),(.18,.55),(-.06,.31),(-.34,.48),(-.28,.17)]
                size=.18*factor
                verts=[(pos[0]+size*(x*math.cos(a)-y*math.sin(a)),pos[1]+size*(x*math.sin(a)+y*math.cos(a)),pos[2]) for x,y in rim]
                verts += [(pos[0],pos[1],pos[2]+size*.18),(pos[0],pos[1],pos[2]-size*.08)]
                faces=[(k,(k+1)%12,12) for k in range(12)]+[((k+1)%12,k,13) for k in range(12)]
                parts.append(shared.mesh('MapleBlade',verts,faces,leaves))
        shared.join_parts(parts, NAME+'_'+stage)
    for obj in bpy.context.scene.objects:
        for v in obj.data.vertices:
            v.co.x *= .97; v.co.y *= .97; v.co.z=max(0,v.co.z)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'assets/game-assets/{NAME}.blend'))

def audit():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'assets/game-assets/{NAME}.blend'))
    triangles={}
    points=[]
    for obj in bpy.context.scene.objects:
        obj.data.calc_loop_triangles(); triangles[obj.name]=len(obj.data.loop_triangles)
        points.extend(obj.matrix_world@Vector(c) for c in obj.bound_box)
        assert tuple(obj.location)==(0,0,0)
        assert len(obj.data.materials)==1
    lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
    assert all(lo[i]>=-.45 and hi[i]<=.45 for i in (0,1)),(lo,hi)
    assert abs(lo[2])<.0001 and hi[2]<1.81,(lo,hi)
    assert sum(triangles.values())<1600
    print(json.dumps({'triangles':triangles,'bounds':[lo,hi]}))
if __name__=='__main__':
    if '--check' not in sys.argv: generate()
    audit()
