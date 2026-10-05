"""Original Croatian chestnut cart with composed paper servings and festive sign."""
import importlib.util
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
ASSET = 'ChestnutRoastingCart'
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('tea_helpers', Path(__file__).with_name('generate-garden-tea-table.py'))
tea = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tea)
helpers = tea.helpers


def bake(obj, name, shade, mat):
    obj.name = name
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    colors = obj.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    for entry in colors.data:
        entry.color = helpers.color(shade)
    obj.vertex_groups.new(name=name).add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    return obj


def box(name, center, size, shade, mat, bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('SoftEdges', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return bake(obj, name, shade, mat)


def nut(name, center, radius, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=center)
    obj = bpy.context.object
    obj.scale = (radius, radius*.88, radius*.77)
    obj = bake(obj, name, '79502E', mat)
    for face in obj.data.polygons:
        if face.normal.z > .45:
            for index in face.loop_indices:
                obj.data.color_attributes['Color'].data[index].color = helpers.color('B48455')
    return obj


def anchor(name, position, radius):
    obj = bpy.data.objects.new(ASSET+'_'+name, None)
    obj.location = position
    obj.empty_display_size = .035
    obj['emitter_radius'] = radius
    bpy.context.collection.objects.link(obj)


def generate():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene['asset_name'] = ASSET
    bpy.context.scene['generated_by'] = 'assets/scripts/generate-chestnut-cart.py'
    bpy.context.scene['editing_note'] = 'Editable named vertex groups for cart, wheels, sign, cones and chestnuts. Source empties author future steam/fire/sound positions. No live fire or attachments.'
    # Two deliberately restrained palette roles permit separate wetness treatment.
    wood = tea.palette_material('CartWoodPaper', .90)
    wood.name = 'Material.ChestnutRoastingCart.WoodPaper'
    metal = tea.palette_material('Roaster', .84)
    metal.name = 'Material.ChestnutRoastingCart.Roaster'
    parts = []
    parts.append(box('CartBody', (0,0,.55), (1.12,.57,.42), '966238', wood))
    for y in [-.29,.29]:
        for z in [.39,.58,.73]:
            parts.append(box('SidePlank', (0,y,z), (1.16,.035,.09), 'AB7C45' if z==.58 else '996A3C', wood))
    parts.append(box('ServingTop',(0,0,.79),(1.24,.67,.10),'D1A36B',wood))
    for x in [.40]:
        for y in [-.235,.235]:
            parts.append(box('SupportLeg',(x,y,.20),(.075,.075,.40),'725036',wood))
    for y in [-.23,.23]:
        parts.append(box('HandleRail',(.67,y,.72),(.32,.05,.06),'A27747',wood))
    parts.append(box('HandleGrip',(.82,0,.72),(.06,.51,.065),'6D5237',wood))
    for x in [-.40,.20]:
        parts.append(box('SignPost',(x,.27,1.065),(.035,.035,.47),'987145',wood))
    parts.append(box('SignBoard',(-.10,.27,1.31),(.77,.055,.22),'4F6B4D',wood))
    for y,yaw in [(.237,0),(.303,math.pi)]:
        bpy.ops.object.text_add(location=(-.1,y,1.29), rotation=(math.pi/2,0,yaw))
        text = bpy.context.object
        text.data.body = 'KESTENI'
        text.data.align_x = 'CENTER'
        text.data.size = .135
        text.data.extrude = .001
        text.data.resolution_u = 1
        bpy.ops.object.convert(target='MESH')
        parts.append(bake(bpy.context.object,'FestiveLettering','F3DEAF',wood))
    for i,x in enumerate([-.35,-.19,-.03,.13]):
        parts.append(helpers.part('Bunting',[(x-.055,.235,1.19),(x+.055,.235,1.19),(x,.235,1.09)],[(0,1,2)],['C0803E' if i%2 else 'A95D3C'],wood))
    for i,y in enumerate([-.17,.12]):
        x=.43
        parts.append(tea.lathe('PaperCone',x,y,[(.014,.845),(.11,1.01),(.096,1.02),(.06,.96),(0,.96)],['EAD5A8','F3E1B9','D6B47F','BC9257'],wood,8))
        for j,(dx,dy,dz) in enumerate([(-.04,-.015,0),(.035,-.025,0),(0,.035,.015)]):
            parts.append(nut(f'Serving{i}Nut{j}',(x+dx,y+dy,.999+dz),.042,wood))
    helpers.shared.join_parts(parts,ASSET+'_Cart')
    parts=[]
    for y in [-.345,.345]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=.225, depth=.065, location=(-.39,y,.225),rotation=(math.pi/2,0,0))
        parts.append(bake(bpy.context.object,'Wheel','444D43',metal))
        bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=.073,depth=.07,location=(-.39,y,.225),rotation=(math.pi/2,0,0))
        parts.append(bake(bpy.context.object,'WheelHub','B78A4F',metal))
    parts.append(box('FireDoor',(-.19,-.309,.54),(.39,.024,.23),'39423E',metal))
    parts.append(box('DoorHandle',(-.02,-.337,.55),(.09,.045,.024),'C29B66',metal))
    parts.append(tea.lathe('RoastingPan',-.16,0,[(0,.838),(.235,.838),(.285,.872),(.285,.93),(.253,.94),(.235,.886),(0,.886)],['404B45','404B45','536159','718078','536159','404B45'],metal,16))
    for i,(x,y) in enumerate([(-.16,0),(-.27,-.10),(-.12,-.13),(-.04,-.04),(-.06,.10),(-.20,.12),(-.31,.04)]):
        parts.append(nut(f'RoastingNut{i}',(x,y,.916),.052,metal))
    helpers.shared.join_parts(parts,ASSET+'_Roaster')
    anchor('Steam',(-.16,0,.986),.16)
    anchor('Fire',(-.16,0,.60),.18)
    anchor('Sound',(-.16,0,.72),0)
    # Base origin is centred on the complete cart, including its handles.
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            obj.data.transform(Matrix.Translation((-.115,0,0)))
        else:
            obj.location.x -= .115
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / f'assets/game-assets/{ASSET}.blend'))


def audit():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / f'assets/game-assets/{ASSET}.blend'))
    objects = [o for o in bpy.context.scene.objects if o.type=='MESH']
    assert {o.name for o in objects} == {ASSET+'_Cart',ASSET+'_Roaster'}
    points=[o.matrix_world @ Vector(c) for o in objects for c in o.bound_box]
    low=[min(p[i] for p in points) for i in range(3)]
    high=[max(p[i] for p in points) for i in range(3)]
    assert low[0]>=-.95 and high[0]<=.95 and low[1]>=-.45 and high[1]<=.45,(low,high)
    assert abs(low[2])<.0001 and high[2]<=1.45,(low,high)
    triangles={}
    for obj in objects:
        obj.data.calc_loop_triangles()
        triangles[obj.name]=len(obj.data.loop_triangles)
        assert len(obj.data.materials)==1 and not obj.animation_data
        assert tuple(obj.location)==(0,0,0) and tuple(obj.scale)==(1,1,1)
    assert sum(triangles.values())<5000
    print(json.dumps({'asset':ASSET,'min':low,'max':high,'triangles':triangles,'meshes':2,'materials':2},indent=2))


if __name__=='__main__':
    if '--check' not in sys.argv:
        generate()
    audit()
