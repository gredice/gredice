"""Bee: a round bumblebee figurine with a big friendly head.

The bee is posed in code (entities/bees/Bees.tsx, updateBeeRig): while it
flies or hovers, the wing pivots flap up 0.24 to 1.29 rad about the body's
long axis and pitch 0.08, and the body pivot bobs 0.012 and rocks 0.075
(pitch) and 0.09 (roll); on a flower everything rests at the stored pose.
Design space is that stored pose: Blender world, +Z up, the bee faces -Y,
its L nodes are on -X. The body pivot sits at the origin, which the game
puts on the flower top, so the belly stays where the old one was.

Runtime scale 0.095 (beeScale in entities/bees/Bees.tsx): the whole bee is
about 0.14 game units long, 14 pixels at the default zoom and about 70 at
the closest zoom (500). It reads by silhouette and colour blocks first
(GAME_ART "Proportions"): one round yellow body with two bold ink stripes
that wrap all the way round (`band_decal`), a yellow tail with an ink
stinger, one big round yellow head as large as the body and sunk 0.12 into
its front (so it reads as a chibi head, not two touching balls), and two
pale rounded wings standing out from the top of the back. The wings rise
only a little above the horizontal: a panel tilted less than the camera's
30 to 35 degrees never turns edge-on to it, and the flap's extra roll keeps
them on their own side of the midline. The face (tall ink eyes
with a glint, blush, a U smile) and the antennae with gold ball tips are
for close zooms; at 0.095 no part but the body and head can reach 0.03 game
units, so they are as chunky as the head allows.

Materials: the runtime sets Yellow and Gold to the albedos authored here,
turns every node named Bee_Wing* translucent (opacity 0.52) and gives every
other material roughness 0.55 (cloneBeeMaterial). The bee has no glint
material, so both glints live on Bee_BodyHighlight with the Wing material,
which the file keeps opaque; only the wing nodes become translucent. The
antenna tips moved from ink to Gold. Bee_Thorax and Bee_StripeBack are
hidden nubs: the head and the body meet directly, and a third stripe (or an
ink tail cap) made the 14-pixel bee read darker and busier.

Triangles go to the outlines (stripe rims, wing rims); the antenna tips are
res 2 (about 6 pixels at the closest zoom) and the legs leave their top cap
off inside the body.
"""

import math

import bpy
from mathutils import Vector

PREFIX = "Bee_"
SCALE = 0.095  # beeScale in entities/bees/Bees.tsx
BUDGET = 1900  # small critter: 1,500 to 2,000
# The model this design replaced, at rest: width x, length y, height z.
REFERENCE = (0.789, 1.487, 0.755)

M = {
    "yellow": "Material.Bee.Yellow",
    "gold": "Material.Bee.Gold",
    "ink": "Material.Bee.Black",
    "pink": "Material.Bee.Cheek",
    "wing": "Material.Bee.Wing",
}

COLOURS = {
    # set at runtime by cloneBeeMaterial: author the albedo itself
    M["yellow"]: ("#977812", 0.8, "albedo"),  # #f0c021 on screen
    M["gold"]: ("#976312", 0.8, "albedo"),  # #f0a021 on screen
    # the runtime gives these roughness 0.55 (wings 0.34)
    M["ink"]: ("#5c4590", 0.55),
    M["pink"]: ("#f59a92", 0.55),
    # the glint colour; the wings show it at 0.52 opacity, warm enough that
    # the film keeps some colour over grass and the violet stripes
    M["wing"]: ("#ffecc0", 0.34),
}

SIDES = (("L", -1.0), ("R", 1.0))  # the bee's L nodes are on -X

BODY_C = Vector((0.0, 0.12, 0.0))
BODY = dict(rx=0.34, ry=(0.31, 0.4), rz=(0.29, 0.31), ex=0.9, ey=(0.75, 0.9), ez=(0.8, 0.9), res=5,
            taper={"y": ("x", -0.06)})
HEAD_C = Vector((0.0, -0.365, 0.05))
HEAD = dict(rx=0.37, ry=(0.31, 0.31), rz=(0.31, 0.33), ex=0.9, ey=(0.92, 0.75), ez=0.9, res=5,
            taper={"z": ("x", -0.06)})
# Stripes: (node, centre y, half width): bold ink bands that stay clear of
# the rounded tail, where a band cast across the axis would miss the body
STRIPES = (("Bee_StripeFront", 0.02, 0.06), ("Bee_StripeMiddle", 0.27, 0.06))
STRIPE_SEGMENTS = 22
EYE_X, EYE_Z = 0.2, HEAD_C.z + 0.13
EYE_H, EYE_W = 0.25, 0.19
GLINT = 0.085
# Wings: rooted on top of the back, just inside the body at the wing pivot
# (offset x inward, y, z), each a round panel rising outward WING_ROLL
# (radians) above the horizontal and swept back WING_BACK from straight
# out, its flat face up, so it stands clear of the body and the stripes and
# a flap (0.24 to 1.29 rad more roll) never takes it past the midline. The
# chord stays 0.03 game units across (0.316 here).
WING_ROOT = (-0.05, 0.0, 0.065)
WING_LEN, WING_W, WING_ROLL, WING_BACK = 0.35, 0.34, 0.18, 0.55
WING_SEGMENTS = 18
# antennae: crown to tip, as (x outward, y, z) offsets from the head centre
ANTENNA = ((0.07, 0.0, 0.22), (0.11, -0.04, 0.33), (0.16, -0.08, 0.39), (0.21, -0.12, 0.4))


def build(kit, party_style):
    objects = list(bpy.data.objects)
    space = kit.design_space(objects)
    parts = {o.name: kit.Part(o.name) for o in objects if o.type == "MESH"}

    # body: one round bean, a little fuller at the back
    kit.blob(parts["Bee_Body"], M["yellow"], BODY_C, **BODY)
    body = kit.Surface(parts["Bee_Body"])
    kit.hidden_nub(parts["Bee_Thorax"], M["ink"], BODY_C + Vector((0.0, -0.1, 0.0)))
    for name, y, half in STRIPES:
        kit.band_decal(parts[name], M["ink"], body, Vector((0.0, y, BODY_C.z)), (0.0, 1.0, 0.0), half, lift=0.02,
                       tuck=0.014, shoulder=0.02, segments=STRIPE_SEGMENTS, rows=1)
    kit.hidden_nub(parts["Bee_StripeBack"], M["ink"], BODY_C + Vector((0.0, 0.2, 0.0)))

    # stinger: a short ink cone out of the tail, its root buried
    kit.beak(parts["Bee_Stinger"], M["ink"], BODY_C + Vector((0.0, 0.36, 0.02)), BODY_C + Vector((0.0, 0.53, -0.01)),
             0.075, 0.03, squash=1.0, segments=6, samples=2)

    # legs: six short round ink stubs tucked under the belly, leaning back
    for side, sx in SIDES:
        for k, y in enumerate((-0.1, 0.06, 0.22), start=1):
            top = Vector((sx * 0.15, y, -0.13))
            foot = Vector((sx * 0.2, y + 0.05, -0.255))
            stub_leg(kit, parts[f"Bee_Leg_{side}{k}"], M["ink"], foot, 0.044, top, 0.036)

    # wings: rounded teardrops on top of the back, rising out and swept back
    # (see WING_*); a flap rolls them up about the pivot
    roll, back = WING_ROLL, WING_BACK
    for side, sx in SIDES:
        pivot = space[f"Bee_WingPivot_{side}"].translation
        root = pivot + Vector((sx * WING_ROOT[0], WING_ROOT[1], WING_ROOT[2]))
        out = Vector((sx * math.cos(roll), 0.0, math.sin(roll)))
        axis = out * math.cos(back) + Vector((0.0, 1.0, 0.0)) * math.sin(back)
        # the face normal's sign sets which edge trails: flip it on the right
        # so both wings sweep back and mirror each other
        normal = Vector((-sx * math.sin(roll), 0.0, math.cos(roll))) * -sx
        kit.wing_panel(parts[f"Bee_Wing_{side}"], M["wing"], root, root + axis * WING_LEN, normal, WING_W, 0.03,
                       root_width=0.45, widest=0.5, sweep=0.12, segments=WING_SEGMENTS, rings=(0.7,))

    # head: one big round form, a little fuller at the cheeks
    kit.blob(parts["Bee_Head"], M["yellow"], HEAD_C, **HEAD)
    head = kit.Surface(parts["Bee_Head"])

    # eyes with their glints (both glints on BodyHighlight), blush, smile
    for side, sx in SIDES:
        kit.eye(parts[f"Bee_Eye_{side}"], parts["Bee_BodyHighlight"], head, HEAD_C + Vector((sx * 0.04, 0.0, 0.0)),
                HEAD_C + Vector((sx * EYE_X, -0.6, EYE_Z - HEAD_C.z)), EYE_H, EYE_W, M["ink"], M["wing"],
                glint_size=GLINT, dome=0.018, segments=12)
        kit.blush(parts[f"Bee_Cheek_{side}"], M["pink"], head, HEAD_C,
                  HEAD_C + Vector((sx * 0.33, -0.45, -0.1)), 0.1, 0.15, segments=10)
    front = HEAD_C.y - 0.32
    smile = [Vector((x, front, HEAD_C.z - 0.12 + 5.5 * x * x)) for x in (-0.085, 0.0, 0.085)]
    kit.smile(parts["Bee_Mouth"], M["ink"], head, smile, 0.022, segments=5)

    # antennae: short chunky stalks rising from the crown and splaying out,
    # with gold ball tips that stand clear of the head from the game camera
    for side, sx in SIDES:
        pts = [HEAD_C + Vector((sx * x, y, z)) for x, y, z in ANTENNA]
        curve, _ = kit.catmull_rom(pts, samples=1)
        kit.tube(parts[f"Bee_Antenna_{side}"], M["ink"], curve, [0.03] * len(curve), segments=6, cap_start=False,
                 cap_end=False)
        kit.blob(parts[f"Bee_AntennaTip_{side}"], M["gold"], pts[-1], 0.065, 0.065, 0.065, res=2)

    kit.rebuild_all(parts, space)
    kit.apply_colours(party_style, COLOURS)
    opaque_wing_material()


def stub_leg(kit, part, material, foot, foot_radius, top, top_radius, segments=5):
    """A round leg stub: a ball foot on a short taper, its top left open
    deep inside the body (a capsule with no hidden top cap)."""
    profile = kit.capsule_profile(foot_radius, top_radius, (top - foot).length, arc=2, mid=0)[:-2]
    kit.lathe(part, material, kit.frame_from(foot, top - foot, (0.0, 0.0, 1.0)), profile, segments)


def opaque_wing_material():
    """Keep Material.Bee.Wing opaque in the file: it also colours the
    glints, and the runtime makes only the wing nodes translucent."""
    material = bpy.data.materials[M["wing"]]
    for node in material.node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            node.inputs["Alpha"].default_value = 1.0
    if hasattr(material, "surface_render_method"):
        material.surface_render_method = "DITHERED"
    if hasattr(material, "blend_method"):
        material.blend_method = "OPAQUE"


def flap(lift, pitch, bob=0.0, rock=(0.0, 0.0)):
    """updateBeeRig offsets (three.js node-local, see kit.apply_pose)."""
    out = {"Bee_WingPivot_L": (pitch, 0.0, -lift), "Bee_WingPivot_R": (pitch, 0.0, lift)}
    if bob or rock != (0.0, 0.0):
        out["Bee_BodyPivot"] = {"pos": (0.0, bob, 0.0), "rot": (rock[0], 0.0, rock[1])}
    return out


def check(kit):
    kit.size_report(PREFIX, REFERENCE)
    kit.proportion_report("Bee_Body", ["Bee_Head"])
    kit.triangle_report(PREFIX, BUDGET)
    print("      per node: " + ", ".join(f"{o.name[4:]} {sum(len(p.vertices) - 2 for p in o.data.polygons)}"
                                         for o in kit.mesh_objects(PREFIX)))
    kit.thickness_report(PREFIX, SCALE)
    legs = [f"Bee_Leg_{s}{k}" for s in "LR" for k in (1, 2, 3)]
    poses = {
        "rest (on a flower)": {},
        "flap low": flap(0.24, 0.08, 0.012, (0.075, 0.09)),
        "flap low b": flap(0.24, -0.08, -0.012, (-0.075, -0.09)),
        "flap high": flap(1.29, 0.08, 0.012, (-0.075, 0.09)),
        "flap high b": flap(1.29, -0.08, -0.012, (0.075, -0.09)),
    }
    joints = [("Bee_Wing_L", "Bee_Body"), ("Bee_Wing_R", "Bee_Body"), ("Bee_Antenna_L", "Bee_Head"),
              ("Bee_Antenna_R", "Bee_Head"), ("Bee_Antenna_L", "Bee_AntennaTip_L"),
              ("Bee_Antenna_R", "Bee_AntennaTip_R")]
    kit.procedural_report("Bee_Body", "Bee_Head", legs, legs, ["Bee_Stinger"], poses, joints=joints)
