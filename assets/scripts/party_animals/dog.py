"""Dog: a friendly puppy figurine.

The dog's clips (Dog_Idle, Dog_Walk, Dog_LyingIdle, Dog_PreyWatch) animate
only Dog_Root; every mesh node is a direct child of the root and nothing
else animates except the legs and paws, which entities/dogs/Dogs.tsx poses
in code (poseDogLeg): it swings Dog_Leg_* about their own origin, half way
down the leg (rotation.x +-0.3, rotation.z +-0.024), and moves Dog_Paw_* on
their own (position.y + 0.045 lift, position.z - 0.055 * swing, rotation.x
- 0.42 * swing + 0.16 * lift). So the design space is Dog_Idle frame 1,
where the root is at rest: Blender world, +Z up, the dog faces +Y and its
L nodes are on -X. Runtime scale 0.46 (dogScale), so 0.03 game units is
0.065 model units.

A golden puppy: one big round head in front of a small bean body (body
length about 1.3 times its height, head and body about the same volume),
tall ink eyes with a glint, pink blush, a short cream double-puff muzzle
with a button nose and the tongue peeking out, big floppy dark ears, one
bold dark saddle over the back, a green collar, cream socks and a happy
tail with a cream tip. No smile: an ink tube 0.03 game units thick is a
fifth of this small muzzle and read as a moustache (the cat has none
either).

The body sits low on short legs: the belly is under 15% of the height and
nearly all that shows below it is sock. The legs are `mid_pivot_leg`s whose
top sits deep in the body and whose bottom sits in a closed, squat white
sock; the sock's top stays under the leg's swing origin and, lifted by the
code, under the belly, so the paw can lift, slide and tilt on its own
without the leg showing through it (`poke_report`) or the sock entering
the body.

One material per node; nodes without a job of their own carry the face
colours: Dog_Tag holds both eye glints (it would hang under the chin,
where no game view sees it, so Material.Dog.TagGold is authored as the
glint colour, as the cat's glints use Material.Cat.Whisker), and Dog_Tongue
the tongue and both blush ovals. Dog_Body keeps its two materials (fur and
the dark saddle) and Dog_Head its three, because GameAssets.tsx types their
primitives; the head's dark and cream slots are hidden nubs. The collar
follows the line where the head meets the body, so it also hides that seam.
Dog_ChestPatch, Dog_BellyPatch and Dog_Tail_Mid (the static tail is one
sweep on Dog_Tail_Base) are hidden nubs.

Only the kit's public helpers are used, so other modules can change the
kit's private ones freely.
"""

import math
from pathlib import Path

import bpy
from mathutils import Vector

PREFIX = "Dog_"
SCALE = 0.46  # dogScale in entities/dogs/Dogs.tsx
BUDGET = 3000
# The model this design replaced, in Dog_Idle: width x, length y, height z.
REFERENCE = (0.815, 1.649, 0.878)
# The exported GLB carries the rest pose three.js starts from (`check`).
GLB = Path(__file__).resolve().parents[3] / "apps" / "garden" / "public" / "assets" / "models" / "Dog.glb"

M = {
    "fur": "Material.Dog.WarmFur",
    "head": "Material.Dog.SoftFur",
    "dark": "Material.Dog.DarkFur",
    "cream": "Material.Dog.CreamPatch",
    "ink": "Material.Dog.DarkDetails",
    "collar": "Material.Dog.CollarGreen",
    "glint": "Material.Dog.TagGold",  # the tag is a hidden nub; its node carries the glints
    "pink": "Material.Dog.TonguePink",
}

# On-screen colour of a sunlit face, roughness band (GAME_ART.md). Nothing
# tints the dog at runtime: getDogMaterialTint in Dogs.tsx looks for
# Material.Dog.BlackFur*, which this asset does not have.
COLOURS = {
    # the cool fill takes about 0.11 saturation and 5 degrees of hue off the
    # fur on screen: #e8a862 showed #e6a97b (S 0.47) at noon, so these are
    # authored warmer to land at about S 0.58 (head top) on screen
    M["fur"]: ("#e39c44", 0.8),
    M["head"]: ("#eba849", 0.8),
    M["dark"]: ("#a35c29", 0.8),
    M["cream"]: ("#f2e0c0", 0.8),
    M["ink"]: ("#5c4590", 0.35),
    M["collar"]: ("#43b93a", 0.55),
    M["glint"]: ("#fff4dc", 0.35),
    M["pink"]: ("#f59a92", 0.5),
}

SIDES = (("L", -1.0), ("R", 1.0))  # the dog's L nodes are on -X
LEGS = ("FL", "FR", "RL", "RR")

BODY_C = Vector((0.0, -0.06, 0.34))
BODY = dict(rx=0.27, ry=(0.31, 0.3), rz=(0.21, 0.27), ex=0.88, ey=0.85, ez=(0.6, 0.9), res=6)
HEAD_C = Vector((0.0, 0.40, 0.615))
HEAD = dict(rx=0.35, ry=(0.29, 0.28), rz=(0.28, 0.28), ex=0.92, ey=0.95, ez=0.92, res=7,
            taper={"z": ("x", -0.06)})
MUZZLE_C = HEAD_C + Vector((0.0, 0.225, -0.12))
# tail control points from the body centre: back and up, a cream tip
TAIL = [(0.0, -0.28, 0.12), (0.0, -0.44, 0.2), (0.0, -0.555, 0.305), (0.0, -0.61, 0.375)]
TAIL_LEAD_IN = (0.0, -0.16, 0.06)

LEG_R, LEG_TOP_R = 0.08, 0.09
# sphere centres above / below the leg node origin (z 0.17): the top deep in
# the body (a higher top swings further and nearly leaves the chest), the
# bottom deep in the sock
LEG_TOP, LEG_BOTTOM = 0.13, -0.03
# squat white sock, revolved about the leg axis: (radius, height); closed at
# both ends, the leg enters through the domed top. The top stays under the
# leg's swing origin (z 0.17), so the paw's own tilt and slide never show
# the leg through its side, and more than the code's 0.045 paw lift under
# the belly above it, so a lifted paw never enters the body (`feet-clip`).
SOCK = [(0.0, 0.0), (0.082, 0.0), (0.112, 0.025), (0.114, 0.064), (0.093, 0.097), (0.0, 0.115)]
SOCK_SEGMENTS = 16  # the rims are a silhouette at close zoom
# per profile point (x scale, y scale, y offset): the toe reaches forward (+Y)
SOCK_TOE = [(1.0, 1.0, 0.0), (1.0, 1.16, 0.022), (1.0, 1.14, 0.019), (1.0, 1.05, 0.006), (1.0, 1.0, 0.0),
            (1.0, 1.0, 0.0)]
LEG_SEGMENTS = 10
EYE_H, EYE_W = 0.22, 0.165  # 39% of the head height, 24% of its width
EYE_X, EYE_Z = 0.155, 0.06  # from the head centre
# glint: kept whole on the eye (the kit's 0.095 at 0.24 and 0.2 ran over the
# eye's rim and was squeezed), set high so a side view, which foreshortens
# the eye, still shows ink below it, and big enough that thickness_report
# measures it 0.03 game units across (0.074 measured 0.027)
GLINT, GLINT_RAISE, GLINT_SIDE = 0.085, 0.27, 0.15
COLLAR_R, COLLAR_POINTS = 0.04, 12
SADDLE_SEGMENTS = 16


def soft_max0(x, k=0.15):
    """max(0, x) with its corner rounded over -k..k, so a deform built on it
    has no crease line under smooth shading."""
    if x <= -k:
        return 0.0
    if x >= k:
        return x
    return (x + k) ** 2 / (4 * k)


def front_point(surface, x, z, y0):
    """Where a ray from (x, y0, z) toward +Y (the front) leaves `surface`."""
    hit, normal = surface.hit(Vector((x, y0, z)), Vector((0.0, 1.0, 0.0)))
    if hit is None:
        hit, normal = surface.nearest(Vector((x, y0 + 1.0, z)))
    return hit, normal


def _exit(surface, point, direction):
    """Distance from `point` (inside `surface`) to where a ray along
    `direction` leaves it; 0 when the point is outside."""
    loc, normal = surface.nearest(point)
    if (point - loc).dot(normal) >= 0:
        return 0.0
    hit, _ = surface.hit(point, direction)
    return 0.0 if hit is None else (hit - point).length


def crease(body, head, origin, axis, count=20):
    """The closed line where the head's surface meets the body's, found
    round `axis` (body to head) through `origin`: on each half plane the
    point along the axis where the body's outline and the head's cross."""
    o, ax = Vector(origin), Vector(axis).normalized()
    e1 = Vector((0.0, 0.0, 1.0)) - ax * ax.z
    e1.normalize()
    e2 = ax.cross(e1).normalized()
    points, outs = [], []
    for k in range(count):
        a = 2 * math.pi * k / count
        d = e1 * math.cos(a) + e2 * math.sin(a)
        prev = None
        for i in range(81):
            t = -0.3 + 0.6 * i / 80
            p = o + ax * t
            f = _exit(body, p, d) - _exit(head, p, d)
            if prev is not None and prev[1] > 0 >= f:
                t0, f0 = prev
                u = t0 + (t - t0) * f0 / (f0 - f)
                q = o + ax * u
                points.append(q + d * _exit(body, q, d))
                outs.append(d)
                break
            prev = (t, f)
        else:
            raise RuntimeError(f"crease: no crossing at angle {a:.2f}")
    # one light smoothing pass
    smooth = [(points[k - 1] + points[k] * 2 + points[(k + 1) % count]) / 4 for k in range(count)]
    return smooth, outs


def ring_tube(part, material, centres, outs, radius, sink=0.5, segments=6):
    """A closed round tube through `centres` (a collar), pushed out along
    `outs` so `sink` of its radius sits inside the surface it rides on."""
    count = len(centres)
    centres = [c + o * (radius * (1 - sink)) for c, o in zip(centres, outs)]
    verts, faces = [], []
    for k, (c, out) in enumerate(zip(centres, outs)):
        t = (centres[(k + 1) % count] - centres[k - 1]).normalized()
        n = (out - t * out.dot(t)).normalized()
        b = t.cross(n).normalized()
        for j in range(segments):
            a = 2 * math.pi * j / segments
            verts.append(c + n * (radius * math.cos(a)) + b * (radius * math.sin(a)))
    for k in range(count):
        k2 = (k + 1) % count
        for j in range(segments):
            j2 = (j + 1) % segments
            faces.append([k * segments + j, k2 * segments + j, k2 * segments + j2, k * segments + j2])
    a, b, c = (verts[i] for i in faces[0][:3])
    if (b - a).cross(c - a).dot(verts[faces[0][0]] - centres[0]) < 0:
        faces = [list(reversed(f)) for f in faces]
    part.add(verts, faces, material)
    return centres


def static_tail(kit, fur_part, tip_part, fur, tip, points, lead_in, radius, tip_from, samples=2, segments=10):
    """One unbroken tail through `points` with a colour tip from control
    point `tip_from`.

    Nothing animates the dog's tail nodes, so unlike `kit.sliced_tail` the
    fur needs no joint between Dog_Tail_Base and Dog_Tail_Mid: it is one
    tube on the base node (a joint seam showed at close zoom). The tip
    starts with the kit's collar, 7% wider, on the tip node; the fur runs
    one sample on inside it, so the collar needs no cap of its own. Both
    open ends are buried: the fur's root in the body, the tip's root
    around the fur.
    """
    curve, index = kit.catmull_rom([Vector(lead_in)] + [Vector(p) for p in points], samples)
    index = index[1:]
    n = len(curve) - 1
    radii = [radius(i / n) for i in range(n + 1)]
    k = index[tip_from]
    kit.tube(fur_part, fur, curve[:k + 2], radii[:k + 2], segments=segments, cap_rings=2, cap_start=False,
             cap_end=False)
    # the tip's end cap is a silhouette from every side: four rings round it
    # (two left a flat, faceted cap at close zoom)
    kit.tube(tip_part, tip, curve[k:], [r * 1.07 for r in radii[k:]], segments=segments, cap_rings=4,
             cap_start=False, cap_end=True)
    return curve


def glint(kit, part, material, eye_part, centre, normal, height, width, size, raise_by, side_by, direction):
    """The eye's glint, like `kit.eye`'s but set `raise_by` of the eye
    height above its centre and `side_by` of its width toward `direction`
    (the kit uses 0.24 and 0.2)."""
    up = Vector((0.0, 0.0, 1.0)) - normal * normal.z
    up.normalize()
    side = Vector(direction) - normal * normal.dot(Vector(direction)) - up * up.dot(Vector(direction))
    side.normalize()
    target = centre + up * (height * raise_by) + side * (width * side_by)
    kit.pad(part, material, kit.Surface(eye_part), target, centre + normal * 0.4, size * 0.56, size / 2, 0.007,
            u_hint=(0, 0, 1), rim=0.006, segments=10, rings=(0.0, 0.7, 1.0), lift=(1.0, 0.75, None))


def build(kit, party_style):
    objects = list(bpy.data.objects)
    space = kit.clip_pose_space(objects, "Dog_Idle", 1)
    parts = {o.name: kit.Part(o.name) for o in objects if o.type == "MESH"}

    # body: one small soft bean behind the big head, its back raised into a
    # haunch and a long low belly that holds the leg tops; every term ramps
    # in smoothly, so the surface has no crease line
    def bean(p, d):
        p.z *= 1.0 + 0.15 * soft_max0(-d.y) * kit.smoothstep(-0.15, 0.15, d.z)  # haunch
        p.y *= 1.0 + 0.08 * soft_max0(-d.z)  # long low belly
        # a full low chest under the head holds the front legs
        p.y *= 1.0 + 0.14 * soft_max0(d.y, 0.1) * soft_max0(0.4 - d.z)
        return p

    kit.blob(parts["Dog_Body"], M["fur"], BODY_C, deform=bean, **BODY)
    body = kit.Surface(parts["Dog_Body"])
    # saddle: one bold dark patch over the back, wrapping onto the flanks
    kit.decal(parts["Dog_Body"], M["dark"], body, BODY_C + Vector((0.0, -0.04, -0.05)), (0.0, -0.3, 1.0), 0.7,
              harmonics=((2, 0.12, 0.3), (3, 0.06, 1.4)), squash=(1.2, 1.0), up=(0.0, 1.0, 0.0), rings=3,
              segments=SADDLE_SEGMENTS, lift=0.015, tuck=0.014)
    kit.hidden_nub(parts["Dog_BellyPatch"], M["cream"], BODY_C)
    kit.hidden_nub(parts["Dog_ChestPatch"], M["cream"], BODY_C + Vector((0.0, 0.1, 0.0)))

    # legs: tops deep in the body, bottoms deep in squat closed white socks
    for leg in LEGS:
        node = space[f"Dog_Leg_{leg}"]
        kit.mid_pivot_leg(parts[f"Dog_Leg_{leg}"], M["fur"], node, LEG_R, LEG_TOP, LEG_BOTTOM,
                          top_radius=LEG_TOP_R, arc=1, segments=LEG_SEGMENTS)
        foot = node.translation
        frame = kit.frame_from((foot.x, foot.y, 0.0), (0.0, 0.0, 1.0), (0.0, 1.0, 0.0))
        kit.lathe(parts[f"Dog_Paw_{leg}"], M["cream"], frame, SOCK, SOCK_SEGMENTS, sections=SOCK_TOE)

    # tail: one smooth happy curve sweeping back and up, a cream tip
    tail = [BODY_C + Vector(p) for p in TAIL]

    def tail_radius(t):
        return 0.1 - 0.03 * t + 0.012 * kit.smoothstep(0.75, 1.0, t)

    static_tail(kit, parts["Dog_Tail_Base"], parts["Dog_Tail_Tip"], M["fur"], M["cream"], tail,
                BODY_C + Vector(TAIL_LEAD_IN), tail_radius, tip_from=2)
    kit.hidden_nub(parts["Dog_Tail_Mid"], M["fur"], tail[1], 0.04)

    # head: one big round form in front of the body, overlapping its chest
    head_part = parts["Dog_Head"]
    kit.blob(head_part, M["head"], HEAD_C, **HEAD)
    head = kit.Surface(head_part)
    # the head keeps its dark and cream material slots for the runtime
    kit.hidden_nub(head_part, M["dark"], HEAD_C, 0.06)
    kit.hidden_nub(head_part, M["cream"], HEAD_C + Vector((0.0, 0.05, 0.0)), 0.06)
    kit.HIDDEN.discard("Dog_Head")

    # eyes (ink), glints on Dog_Tag in the same world direction for both
    for side, sx in SIDES:
        target, _ = front_point(head, sx * EYE_X, HEAD_C.z + EYE_Z, HEAD_C.y)
        eye_part = parts[f"Dog_Eye_{side}"]
        centre, normal = kit.eye(eye_part, kit.Part("unused glint"), head, HEAD_C + Vector((sx * 0.03, 0.0, 0.0)),
                                 target, EYE_H, EYE_W, M["ink"], M["glint"], glint_size=GLINT, dome=0.018,
                                 segments=12)
        glint(kit, parts["Dog_Tag"], M["glint"], eye_part, centre, normal, EYE_H, EYE_W, GLINT, GLINT_RAISE,
              GLINT_SIDE, (1.0, 0.0, 0.0))

    # muzzle: two soft cream cheek puffs under a button nose, the tongue
    # peeking out between them. No smile: a tube 0.03 game units thick is a
    # fifth of this small muzzle and read as a moustache. The notch and the
    # crease are wide and ramp in smoothly, so the grid follows them.
    def two_puffs(p, d):
        w = math.exp(-(p.x / 0.07) ** 2)
        p.z += 0.03 * w * soft_max0(-p.z / 0.115, 0.2)  # a notch under the nose
        # a soft crease down the front between the cheeks
        p.y -= 0.03 * w * soft_max0(p.y / 0.12, 0.2) * kit.smoothstep(0.35, -0.35, d.z)
        return p

    kit.blob(parts["Dog_Muzzle"], M["cream"], MUZZLE_C, 0.175, (0.1, 0.12), (0.115, 0.1), ex=0.85, ey=0.85,
             ez=(0.85, 0.95), res=5, deform=two_puffs)
    muzzle = kit.Surface(parts["Dog_Muzzle"])
    nose_c, nose_n = muzzle.project(MUZZLE_C, MUZZLE_C + Vector((0.0, 1.0, 0.75)))
    nose_frame = kit.frame_from(nose_c + nose_n * 0.01, nose_n, (0.0, 0.0, 1.0))
    kit.blob(parts["Dog_Nose"], M["ink"], None, 0.07, 0.048, 0.042, res=4, frame=nose_frame,
             taper={"y": ("x", 0.3)})
    # tongue: a flat rounded tab hanging from the notch, tipped forward so
    # its face looks up at the game camera
    tongue_frame = kit.frame_from(MUZZLE_C + Vector((0.0, 0.075, -0.115)), (0.0, 0.75, 0.66), (0.0, 0.0, -1.0))
    kit.blob(parts["Dog_Tongue"], M["pink"], None, 0.05, 0.062, 0.026, res=3, frame=tongue_frame,
             taper={"y": ("x", 0.12)})
    for side, sx in SIDES:
        target, _ = front_point(head, sx * 0.24, HEAD_C.z - 0.06, HEAD_C.y)
        kit.blush(parts["Dog_Tongue"], M["pink"], head, HEAD_C, target, 0.08, 0.12, segments=8)

    # ears: soft floppy leaves hanging from the upper sides of the head
    spare = kit.Part("ear lining")
    for side, sx in SIDES:
        # a slab pillow: an even 20-point outline (the cube-sphere leaf showed
        # corners at close zoom) for fewer triangles; the lining is unused
        kit.slab_leaf_ear(parts[f"Dog_Ear_{side}"], spare, M["dark"], M["dark"],
                          root=HEAD_C + Vector((sx * 0.26, 0.02, 0.19)), axis=(sx * 0.32, 0.14, -1.0),
                          face=(sx * 1.0, 0.2, 0.35), length=0.38, width=0.3, thickness=0.1, point=-0.22,
                          segments=20, rings=(0.7,))

    # collar: a green ring along the line where the head meets the body,
    # so it also covers that seam
    neck = (HEAD_C - BODY_C).normalized()
    line, outs = crease(body, head, (BODY_C + HEAD_C) / 2, neck, count=COLLAR_POINTS)
    ring_tube(parts["Dog_Collar"], M["collar"], line, outs, COLLAR_R)

    kit.rebuild_all(parts, space)
    kit.apply_colours(party_style, COLOURS)


# ------------------------------------------------------------------ checks
def walk_offsets(s, amount=1.0):
    """poseDogLeg offsets at walk phase sin = `s` (Dogs.tsx updateDogWalkPose)."""
    out = {}
    for legs, sign in ((("FL", "RR"), 1.0), (("FR", "RL"), -1.0)):
        swing = sign * s * 0.3 * amount
        lift = max(0.0, sign * s) * amount
        for leg in legs:
            out[f"Dog_Leg_{leg}"] = {"rot": (swing, 0.0, swing * 0.08)}
            out[f"Dog_Paw_{leg}"] = {"pos": (0.0, lift * 0.045, -swing * 0.055),
                                     "rot": (-swing * 0.42 + lift * 0.16, 0.0, 0.0)}
    return out


def world_mesh(obj):
    """World-space vertices and polygons of `obj` as posed (no modifiers)."""
    m = obj.evaluated_get(bpy.context.evaluated_depsgraph_get()).matrix_world
    return [m @ v.co for v in obj.data.vertices], [tuple(p.vertices) for p in obj.data.polygons]


def poke_report(kit, label):
    """Leg vertices outside their sock but below its top: a leg showing
    through the side or sole of the sock."""
    from mathutils.bvhtree import BVHTree
    worst = 0.0
    for leg in LEGS:
        pv, pp = world_mesh(bpy.data.objects[f"Dog_Paw_{leg}"])
        bvh = BVHTree.FromPolygons(pv, pp)
        top = max(v.z for v in pv)
        lv, _ = world_mesh(bpy.data.objects[f"Dog_Leg_{leg}"])
        for v in lv:
            if v.z > top - 0.03:
                continue
            loc, normal, _, dist = bvh.find_nearest(v)
            if loc is not None and (v - loc).dot(normal) > 0:
                worst = max(worst, dist)
    flag = "  <-- LEG SHOWS THROUGH SOCK" if worst > 0.002 else ""
    print(f"POKE {label:24s} leg outside sock below its top: {worst:.3f}{flag}")


def walk_report(kit, body, head, legs, feet, tails, joints, samples=8):
    """Dog_Walk at `samples` frames with the code's leg pose at both
    diagonal extremes and in between."""
    scene = bpy.context.scene
    objs = list(bpy.data.objects)
    rest = {o.name: o.matrix_basis.copy() for o in objs}
    mutes = {(o.name, t.name): t.mute for o in objs if o.animation_data for t in o.animation_data.nla_tracks}
    for o in objs:
        if o.animation_data:
            for t in o.animation_data.nla_tracks:
                t.mute = t.name != "Dog_Walk"
    for k in range(samples):
        f = 1 + round(31 * k / (samples - 1))
        s = math.sin(2 * math.pi * k / (samples - 1))  # code phase, independent of the clip
        for phase in (s, 1.0, -1.0):
            for o in objs:
                o.matrix_basis = rest[o.name]
            scene.frame_set(f)
            kit.apply_pose(walk_offsets(phase))
            label = f"Dog_Walk f={f:2d} sin={phase:+.2f}"
            print(f"WALK {label:24s} " + kit.format_metrics(kit.pose_metrics(body, head, legs, feet, tails, joints)))
            if phase in (1.0, -1.0) and k == 0:
                poke_report(kit, label)
    for o in objs:
        if o.animation_data:
            for t in o.animation_data.nla_tracks:
                t.mute = mutes[(o.name, t.name)]
    scene.frame_set(1)
    for o in objs:
        o.matrix_basis = rest[o.name]
    bpy.context.view_layer.update()


def check(kit):
    objects = list(bpy.data.objects)
    idle = kit.clip_pose_space(objects, "Dog_Idle", 1)
    kit.size_report(PREFIX, REFERENCE, space=idle)
    kit.proportion_report("Dog_Body", ["Dog_Head", "Dog_Muzzle"], space=idle)
    kit.triangle_report(PREFIX, BUDGET)
    kit.thickness_report(PREFIX, SCALE)
    legs = [f"Dog_Leg_{s}" for s in LEGS]
    feet = [f"Dog_Paw_{s}" for s in LEGS]
    joints = list(zip(legs, feet))
    kit.clip_report("Dog_Body", "Dog_Head", legs, feet, ["Dog_Tail_Base"], joints=joints)
    walk_report(kit, "Dog_Body", "Dog_Head", legs, feet, ["Dog_Tail_Base"], joints)
    # the code also poses the legs while a clip fades out; check its leg and
    # paw offsets on the GLB rest pose as well
    kit.glb_rest_pose(str(GLB))
    poses = {"rest": {}, "walk +": walk_offsets(1.0), "walk -": walk_offsets(-1.0),
             "walk half +": walk_offsets(0.5), "walk half -": walk_offsets(-0.5)}
    kit.procedural_report("Dog_Body", "Dog_Head", legs, feet, ["Dog_Tail_Base"], poses, joints=joints)
    for label, offsets in (("rest", {}), ("walk +", walk_offsets(1.0)), ("walk -", walk_offsets(-1.0))):
        rest = {o.name: o.matrix_basis.copy() for o in bpy.data.objects}
        kit.apply_pose(offsets)
        poke_report(kit, label)
        for o in bpy.data.objects:
            o.matrix_basis = rest[o.name]
        bpy.context.view_layer.update()
