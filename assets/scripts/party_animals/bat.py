"""Bat: a round fuzzy party bat with big ears and soft violet wings.

The bat is animated only by GLB clips (Bat_Flap and Bat_Glide in flight,
Bat_Roost while it hides; entities/bats/Bats.tsx moves and banks the whole
group). Every pivot of this rig sits at the model origin with an identity
rest: the body, head and tail pivots, and the root, elbow and hand pivots of
both wings. The .blend opens with Bat_Roost evaluated into those pivots, so
the bat is designed in the GLB rest (`rest_space`: every animated pivot at
identity), which is how it glides: Blender world, +Z up, facing -Y, its L
nodes on +X. Runtime scale 0.25 (batScale), so 0.03 game units is 0.12
model units: the membranes are 0.13 thick and every visible part is at
least 0.12 across.

The wing clips turn all three wing pivots about axes through that origin
(Bat_Flap lifts a wing root from -0.66 to +1.01 rad about the body's long
axis; the elbow and hand add up to 0.8 rad more and sweep back 0.45). The
old body sat 0.62 above the origin, so its wings swung off the body in every
flap. The body is centred on the wing axis instead, and each wing is one
rounded membrane on the root pivot, rooted along that axis inside the body:
however far the clips turn it, it stays rooted in the round body and its
exit slot only slides round it. A membrane on the elbow or hand pivot would
turn about the same origin and fan out of the wing as a spike at the top of
every flap, so those nodes are hidden nubs. Deep violet arm and finger
bones lie on the membrane (on the root pivot's arm node), so the wing reads
as a bat's. The bat centre sits on the flight path point (0.44 under the
flight clearance).

Head and body are one soft egg (a smooth union of a big round head and a
smaller rump, so there is no waist, crease or seam from any side), and the
whole egg is the head node: the head pivot sits at the origin, on the wing
axis, and only nods 5 degrees in flight, so the egg nods with the face on
it while the wing roots, the tail membrane and the feet stay buried in it.
Bat_Body is a hidden nub. Big rounded ears with a pink lining pad that
follows their outline, big ink eyes with a round glint set high for the
camera above, pink blush and nose on a caramel muzzle, a small tail membrane
with cream feet, and soft violet wings with a flat top that rolls over a
round rim. The fur is a light warm cocoa so the bat still reads
against the blue-violet night it flies in.
"""

import math

import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

PREFIX = "Bat_"
SCALE = 0.25  # batScale in entities/bats/Bats.tsx
BUDGET = 2000  # a small critter (GAME_ART "Budget and detail")
# The model this design replaced, in the GLB rest pose: width x, length y, height z.
REFERENCE = (2.8605, 1.5148, 1.3184)
# The repo GLB carries the rest pose three.js starts from (checks only).
REPO_GLB = "/Users/aleks/.t3/worktrees/gredice/t3-6a9f5637-6aced7a0ab10b50a/apps/garden/public/assets/models/Bat.glb"

M = {
    "fur": "Material.Bat.WarmCharcoal",
    "light": "Material.Bat.WarmBrown",
    "wing": "Material.Bat.WingMembrane",
    "wing2": "Material.Bat.WingMembraneLight",
    "pink": "Material.Bat.InnerEar",
    "claw": "Material.Bat.Claw",
    "eye": "Material.Bat.Eye",
    "glint": "Material.Bat.EyeGlint",
}

COLOURS = {
    M["fur"]: ("#c97f55", 0.8),  # warm cocoa fur, light enough to read at night
    M["light"]: ("#f0c47e", 0.8),  # caramel muzzle
    M["wing"]: ("#8c4cc8", 0.55),  # deep violet arm and finger bones
    M["wing2"]: ("#b06ae0", 0.55),  # soft violet membranes (wings and tail)
    M["pink"]: ("#f59a92", 0.55),
    M["claw"]: ("#f2d4ac", 0.5),  # warm cream: keeps 0.10 saturation under the cool night fill
    M["eye"]: ("#5c4590", 0.35),
    M["glint"]: ("#fff4dc", 0.35),
}

SIDES = (("L", 1.0), ("R", -1.0))  # the bat's L nodes are on +X

# One egg: a big round head (the face end) and a smaller rump, joined by a
# smooth union.
HEAD_C = Vector((0.0, -0.30, 0.10))
HEAD = dict(rx=0.42, ry=(0.36, 0.32), rz=(0.34, 0.38), ex=0.92, ey=0.95, ez=0.92)
RUMP_C = Vector((0.0, 0.06, -0.05))
# a full back: both raised wings meet over it at the top of a flap, inside the fur
RUMP = dict(rx=0.37, ry=(0.38, 0.37), rz=(0.34, 0.33), ex=0.92, ey=0.92, ez=(0.85, 0.92))
BLEND = 0.26  # smooth-union radius: fills the neck so head and rump read as one form
EGG_C = Vector((0.0, -0.12, 0.0))  # rays to the egg surface start here (inside both forms)
EGG_GUIDE = dict(rx=0.42, ry=(0.54, 0.55), rz=(0.40, 0.48))  # vertex spacing follows this ellipsoid
EGG_RES = 6

EYE_H, EYE_W = 0.30, 0.235  # about 40% of the head height: big from the game camera
GLINT = 0.136  # round, about 55% of the eye width like the cat's; >= 0.12 model units (0.03 game units)
GLINT_OFFSET = (0.05, 0.025)  # up, and toward the viewer's left: ink shows all round it

MEMBRANE = 0.13  # thickness, >= 0.12 model units
WING_SEGMENTS = 32
WING_TOP_RINGS = (0.55, 0.88)  # the top stays flat to 0.55 and rolls over a band to the rim
WING_BOTTOM_RINGS = (0.8,)
WING_CAP = 5.0
# Outline of the L wing in the wing plane (x out, y back): the root runs
# along the wing axis inside the body, the leading edge out through the
# wrist to the tip, the trailing edge scalloped between the finger tips
# back to the flank.
WING_BACK = 0.06  # the whole wing sits this far behind the builder's first layout, clear of the ears
WRIST = Vector((0.84, -0.32 + WING_BACK))
TIPS = [Vector((1.42, -0.18 + WING_BACK)), Vector((1.26, 0.30 + WING_BACK)), Vector((0.84, 0.54 + WING_BACK))]
WING = [(0.16, 0.04 + WING_BACK), (0.40, -0.12 + WING_BACK), (0.86, -0.36 + WING_BACK), tuple(TIPS[0]),
        ("scallop", 0.15), tuple(TIPS[1]), ("scallop", 0.14), tuple(TIPS[2]), ("scallop", 0.12),
        (0.36, 0.48), (0.16, 0.28)]  # root 0.16 off the axis: raised wings never meet over the back
WING_ORIGIN = Vector((0.64, 0.10 + WING_BACK))
BONE_R = 0.066  # the stripe seen from above stays >= 0.12 model units (0.03 game units)

# Ears: rounded triangles, wide at the base, with a round tip.
EAR_R0, EAR_R1, EAR_LEN, EAR_FLAT = 0.24, 0.12, 0.42, 0.7
EAR_TILT = 0.58  # radians out from vertical
EAR_SEGMENTS = 12


def rest_space(objects):
    """World matrices in the GLB rest: every animated pivot at identity.

    The .blend opens with Bat_Roost evaluated into the pivots, so their
    stored transforms are not the rest three.js starts from; the GLB gives
    every pivot of this rig no translation, rotation or scale.
    """
    out = {}

    def world(o):
        if o.name not in out:
            animated = bool(o.animation_data and o.animation_data.nla_tracks)
            local = Matrix.Identity(4) if animated else o.matrix_parent_inverse @ o.matrix_basis
            out[o.name] = world(o.parent) @ local if o.parent else local
        return out[o.name]

    for o in objects:
        world(o)
    return out


# ------------------------------------------------------------------ one egg
def _pair(r):
    return (r, r) if isinstance(r, (int, float)) else r


def _form_distance(p, centre, spec):
    """Approximate signed distance to a blob-style superellipsoid (the
    implicit form of `kit.blob` without taper)."""
    q = p - centre
    total = 0.0
    radii = []
    for axis, value in zip("xyz", q):
        r = _pair(spec["r" + axis])
        e = _pair(spec.get("e" + axis, 1.0))
        side = 1 if value >= 0 else 0
        radius = r[side]
        radii.append(radius)
        total += abs(value / radius) ** (2.0 / e[side])
    return (total ** 0.5 - 1.0) * (sum(radii) / 3.0)


def _smooth_min(a, b, k):
    h = max(k - abs(a - b), 0.0) / k
    return min(a, b) - h * h * k * 0.25


def egg_distance(p):
    """The bat's head-and-body egg: head and rump joined with a smooth
    union, so there is no neck crease."""
    head = _form_distance(p, HEAD_C, HEAD)
    rump = _form_distance(p, RUMP_C, RUMP)
    return _smooth_min(head, rump, BLEND)


def egg(kit, part, material, res=EGG_RES):
    """Sample the egg along rays from `EGG_C`, with `kit.blob`'s even
    cube-sphere directions spread like the `EGG_GUIDE` ellipsoid; each ray
    takes the outermost crossing of the surface."""
    def deform(local, d):
        direction = local.normalized()
        t, step = 1.6, 0.02
        while t > 0 and egg_distance(EGG_C + direction * t) > 0:
            t -= step
        lo, hi = t, t + step
        for _ in range(30):
            mid = (lo + hi) / 2
            if egg_distance(EGG_C + direction * mid) > 0:
                hi = mid
            else:
                lo = mid
        return direction * ((lo + hi) / 2)

    kit.blob(part, material, EGG_C, res=res, deform=deform, **EGG_GUIDE)


# ------------------------------------------------------------------ wings
def outline_points(points, centre):
    """Closed outline with scalloped edges (bowing toward `centre`), in
    L-wing plane coordinates."""
    out = []
    pending = None
    for p in points:
        if isinstance(p[0], str):
            pending = p[1]
            continue
        q = Vector(p)
        if pending is not None:
            a = out[-1]
            for k in (1, 2, 3):
                t = k / 4
                m = a.lerp(q, t)
                inward = (centre - m).normalized()
                out.append(m + inward * (pending * math.sin(math.pi * t) * (q - a).length))
            pending = None
        out.append(q)
    return out


def pillow(kit, part, material, frame, outline, thickness, segments, top_rings, bottom_rings, cap):
    """`kit.slab` with its own ring sets for the top and the bottom.

    The top (the side the game camera sees) keeps a flat plateau out to
    `top_rings[0]` and rolls down over a band to the rim, so its fan from
    the centre shades flat instead of in radial spokes; the bottom, seen
    only on a raised far wing, gets fewer rings.
    """
    pts = kit._closed_catmull([Vector((p[0], p[1], 0.0)) for p in outline], 4)
    pts = kit._resample_closed(pts, segments)
    h = thickness / 2
    verts, faces = [], []

    def ring(f, z):
        ids = []
        for p in pts:
            ids.append(len(verts))
            verts.append(frame @ Vector((p.x * f, p.y * f, z)))
        return ids

    def height(f):
        return (1 - f ** cap) ** (1 / cap)

    top_pole = len(verts)
    verts.append(frame @ Vector((0.0, 0.0, h)))
    top = [ring(f, h * height(f)) for f in top_rings]
    rim = ring(1.0, 0.0)
    bottom = [ring(f, -h * height(f)) for f in reversed(bottom_rings)]
    bottom_pole = len(verts)
    verts.append(frame @ Vector((0.0, 0.0, -h)))
    n = len(pts)
    faces.extend([top_pole, top[0][j], top[0][(j + 1) % n]] for j in range(n))
    chain = top + [rim] + bottom
    for lower, upper in zip(chain, chain[1:]):
        faces.extend([lower[j], upper[j], upper[(j + 1) % n], lower[(j + 1) % n]] for j in range(n))
    faces.extend([bottom[-1][j], bottom_pole, bottom[-1][(j + 1) % n]] for j in range(n))
    a, b, c = (verts[i] for i in faces[0])
    if (b - a).cross(c - a).dot(frame.to_3x3() @ Vector((0.0, 0.0, 1.0))) < 0:
        faces = [list(reversed(f)) for f in faces]
    return part.add(verts, faces, material)


def wing(kit, part, material, sx):
    """The whole wing as one rounded pillow in the plane through the wing
    axis, rooted along the axis inside the body."""
    outline = outline_points(WING, WING_ORIGIN)
    frame = Matrix.Translation((sx * WING_ORIGIN.x, WING_ORIGIN.y, 0.0))
    local = [(sx * (p.x - WING_ORIGIN.x), p.y - WING_ORIGIN.y) for p in outline]
    if sx < 0:
        local.reverse()
    pillow(kit, part, material, frame, local, MEMBRANE, WING_SEGMENTS, WING_TOP_RINGS, WING_BOTTOM_RINGS, WING_CAP)


def bones(kit, part, material, sx):
    """Arm along the leading edge to the wrist and fingers to the tips,
    standing a little proud of the membrane's top."""
    z = 0.03

    def P(v):
        return Vector((sx * v[0], v[1], z))

    arm = [P((0.24, -0.043 + WING_BACK)), P((0.44, -0.12 + WING_BACK)), P(WRIST)]
    kit.tube(part, material, arm, [BONE_R * 1.15, BONE_R * 1.05, BONE_R], segments=6, cap_start=False)
    for tip in TIPS[:2]:
        end = WRIST.lerp(tip, 0.86)
        kit.tube(part, material, [P(WRIST), P(end)], [BONE_R, BONE_R * 0.97], segments=6, cap_start=False)


# ------------------------------------------------------------------ ears
def _ear_frame(base, tip, face):
    axis = (tip - base).normalized()
    f = Vector(face) - axis * Vector(face).dot(axis)
    f.normalize()
    side = axis.cross(f).normalized()
    return axis, f, side


def ear(kit, ear_part, inner_part, base, tip, face):
    """A big rounded-triangle ear and a pink lining pad on its front face.

    The ear is the tangent hull of a wide base sphere (buried in the head)
    and a round tip, flattened front to back; its buried base closes with
    one pole instead of a full hemisphere, so the triangles go to the part
    the camera sees. The lining is a pad cast straight onto the ear's front
    face with the same rounded-triangle outline, a little smaller, and its
    rim tucked under the fur, so its edge is one smooth curve.
    """
    base, tip = Vector(base), Vector(tip)
    axis, f, side = _ear_frame(base, tip, face)
    length = (tip - base).length
    prof = kit.capsule_profile(EAR_R0, EAR_R1, length, arc=3, mid=0)
    prof = [(0.0, -EAR_R0 * 0.55)] + prof[2:]  # buried base: a pole instead of the lower arc
    kit.lathe(ear_part, M["fur"], kit.frame_from(base, axis, side), prof, EAR_SEGMENTS, (EAR_FLAT, 1.0))

    surface = kit.Surface(ear_part)
    s = math.asin(max(-0.95, min(0.95, (EAR_R0 - EAR_R1) / length)))
    # lining outline in the ear plane: discs along the axis, k times the ear's own half width
    z0, z1, k = 0.10 * length, 0.74 * length, 0.62

    def half_width(z):
        t = max(0.0, min(1.0, z / length))
        return (EAR_R0 + (EAR_R1 - EAR_R0) * t) / math.cos(s)

    discs = [(z0 + (z1 - z0) * i / 24, k * half_width(z0 + (z1 - z0) * i / 24)) for i in range(25)]
    zc = 0.36 * length

    def inside(x, z):
        return any((z - dz) ** 2 + x * x <= r * r for dz, r in discs)

    def reach(angle):
        cu, cv = math.cos(angle), math.sin(angle)
        lo, hi = 0.0, length
        for _ in range(24):
            mid = (lo + hi) / 2
            if inside(mid * cv, zc + mid * cu):
                lo = mid
            else:
                hi = mid
        return lo

    centre = base + axis * zc + f * (EAR_R0 * EAR_FLAT)
    kit.pad(inner_part, M["pink"], surface, centre, centre + f * 0.6, 1.0, 1.0, 0.018, u_hint=axis, rim=0.012,
            rings=(0.0, 0.5, 0.86, 1.0), lift=(1.0, 0.97, 0.55, None), segments=16,
            project="parallel", outline=reach)


# ------------------------------------------------------------------ face
def glint(kit, part, eye_part, centre, normal):
    """A round glint well inside the eye, up and to the viewer's left (the
    same world direction for both eyes), so ink shows all round it. It
    stands 0.012 off the eye, clear of the eye's dome facets."""
    up = Vector((0.0, 0.0, 1.0)) - normal * normal.z
    up.normalize()
    left = Vector((-1.0, 0.0, 0.0))
    side = left - normal * normal.dot(left) - up * up.dot(left)
    side.normalize()
    target = centre + up * GLINT_OFFSET[0] + side * GLINT_OFFSET[1]
    kit.pad(part, M["glint"], kit.Surface(eye_part), target, centre + normal * 0.4, GLINT / 2, GLINT / 2, 0.012,
            u_hint=(0, 0, 1), rim=0.006, segments=12, rings=(0.0, 0.7, 1.0), lift=(1.0, 0.8, None))


# ------------------------------------------------------------------ build
def build(kit, party_style):
    objects = list(bpy.data.objects)
    space = rest_space(objects)
    parts = {o.name: kit.Part(o.name) for o in objects if o.type == "MESH"}

    # head and body: one egg on the head node (see the module notes); the
    # body and chest nodes are nubs inside it
    egg(kit, parts["Bat_Head"], M["fur"])
    head = kit.Surface(parts["Bat_Head"])
    kit.hidden_nub(parts["Bat_Body"], M["fur"], RUMP_C)
    kit.hidden_nub(parts["Bat_Chest"], M["light"], RUMP_C + Vector((0.0, -0.08, 0.0)))

    # wings: the whole wing on the root pivot; the elbow and hand pivots
    # turn about the same origin, so a panel on them would fan out of the
    # wing as a spike at the top of every flap (their nodes are nubs)
    for side, sx in SIDES:
        wing(kit, parts[f"Bat_InnerMembrane_{side}"], M["wing2"], sx)
        bones(kit, parts[f"Bat_UpperArm_{side}"], M["wing"], sx)
        nubs = (("OuterMembrane", M["wing"]), ("HandMembrane", M["wing2"]), ("Forearm", M["fur"]),
                ("FingerFront", M["fur"]), ("FingerMid", M["fur"]), ("FingerBack", M["fur"]), ("ThumbClaw", M["claw"]))
        for name, mat in nubs:
            kit.hidden_nub(parts[f"Bat_{name}_{side}"], mat, RUMP_C + Vector((sx * 0.1, 0.0, 0.0)))

    # tail membrane and feet, rooted in the rump under the tail pivot
    tail = [(-0.10, 0.16), (0.10, 0.16), (0.19, 0.40), (0.17, 0.56), (0.07, 0.62), (0.0, 0.58), (-0.07, 0.62),
            (-0.17, 0.56), (-0.19, 0.40)]
    kit.slab(parts["Bat_TailMembrane"], M["wing2"], Matrix.Translation((0.0, 0.36, -0.2)),
             [(x, y - 0.36) for x, y in tail], MEMBRANE, segments=12, rings=(0.8,), cap=WING_CAP)
    for side, sx in SIDES:
        kit.hidden_nub(parts[f"Bat_Leg_{side}"], M["fur"], RUMP_C + Vector((sx * 0.1, 0.2, -0.1)))
        kit.blob(parts[f"Bat_Foot_{side}"], M["claw"], Vector((sx * 0.16, 0.57, -0.2)), 0.08, 0.08, 0.07, res=2)

    # muzzle: a light puff low on the face, a pink nose on top
    muzzle_c = HEAD_C + Vector((0.0, -0.30, -0.09))
    kit.blob(parts["Bat_Muzzle"], M["light"], muzzle_c, 0.19, (0.11, 0.08), (0.11, 0.12), ex=0.9, ez=0.9, res=2)
    muzzle = kit.Surface(parts["Bat_Muzzle"])
    nose_c, _ = muzzle.project(muzzle_c, muzzle_c + Vector((0.0, -1.0, 0.8)))
    kit.blob(parts["Bat_Nose"], M["pink"], nose_c, 0.09, 0.064, 0.07, res=2, taper={"z": ("x", 0.3)})

    # ears: big rounded triangles with a pink lining facing forward and up
    for side, sx in SIDES:
        base = HEAD_C + Vector((sx * 0.2, -0.06, 0.24))
        tip = base + Vector((sx * EAR_LEN * math.sin(EAR_TILT), -0.02, EAR_LEN * math.cos(EAR_TILT)))
        ear(kit, parts[f"Bat_Ear_{side}"], parts[f"Bat_InnerEar_{side}"], base, tip, face=(0.0, -1.0, 0.45))

    # eyes with glints; the blush shares the ear lining's node and material
    for side, sx in SIDES:
        eye_part = parts[f"Bat_Eye_{side}"]
        centre, normal = kit.eye(eye_part, kit.Part("unused glint"), head, HEAD_C + Vector((sx * 0.03, 0.0, 0.0)),
                                 HEAD_C + Vector((sx * 0.18, -0.5, 0.13)), EYE_H, EYE_W, M["eye"], M["glint"],
                                 glint_size=GLINT, dome=0.012, segments=12)
        glint(kit, parts[f"Bat_EyeGlint_{side}"], eye_part, centre, normal)
        blush = kit.Part(f"blush_{side}")
        kit.blush(blush, M["pink"], head, HEAD_C, HEAD_C + Vector((sx * 0.28, -0.27, -0.04)), 0.13, 0.17,
                  segments=10)
        parts[f"Bat_InnerEar_{side}"].extend(blush)

    kit.rebuild_all(parts, space)
    kit.apply_colours(party_style, COLOURS)


def _clip_frames(samples=8):
    """Yield (track, frame) with only that NLA track playing, as three.js
    plays one clip and leaves every other node at its (GLB) rest."""
    scene = bpy.context.scene
    objs = list(bpy.data.objects)
    rest = {o.name: (o.location.copy(), o.rotation_euler.copy(), o.scale.copy()) for o in objs}
    tracks = sorted({t.name for o in objs if o.animation_data for t in o.animation_data.nla_tracks})
    mutes = {(o.name, t.name): t.mute for o in objs if o.animation_data for t in o.animation_data.nla_tracks}
    for track in tracks:
        for o in objs:
            if o.animation_data:
                for t in o.animation_data.nla_tracks:
                    t.mute = t.name != track
        end = max(int(s.frame_end) for o in objs if o.animation_data for t in o.animation_data.nla_tracks
                  if t.name == track for s in t.strips)
        for k in range(samples):
            f = 1 + round((end - 1) * k / (samples - 1))
            for o in objs:
                o.location, o.rotation_euler, o.scale = rest[o.name]
            scene.frame_set(f)
            yield track, f
    for o in objs:
        if o.animation_data:
            for t in o.animation_data.nla_tracks:
                t.mute = mutes[(o.name, t.name)]
        o.location, o.rotation_euler, o.scale = rest[o.name]
    scene.frame_set(1)
    for o in objs:
        o.location, o.rotation_euler, o.scale = rest[o.name]
    bpy.context.view_layer.update()


def _mesh(name, dg):
    ev = bpy.data.objects[name].evaluated_get(dg)
    me = ev.to_mesh()
    verts = [ev.matrix_world @ v.co for v in me.vertices]
    tris = []
    for p in me.polygons:
        for i in range(1, len(p.vertices) - 1):
            tris.append((p.vertices[0], p.vertices[i], p.vertices[i + 1]))
    ev.to_mesh_clear()
    return verts, tris, BVHTree.FromPolygons(verts, tris)


def clash_report(pairs, hide_in="Bat_Head", samples=8):
    """Triangles of part a that cut through part b in every clip frame,
    counting only crossings outside `hide_in` (the egg hides the rest),
    with how far outside the egg the worst one lies. For parts that must
    never meet, such as a raised wing and the ears."""
    worst = {}
    for track, f in _clip_frames(samples):
        dg = bpy.context.evaluated_depsgraph_get()
        cache = {}
        for n in {n for pair in pairs for n in pair} | {hide_in}:
            cache[n] = _mesh(n, dg)
        hv, _, hbvh = cache[hide_in]
        line = []
        for a, b in pairs:
            av, at, abvh = cache[a]
            hits, far = 0, 0.0
            for i, _ in abvh.overlap(cache[b][2]):
                c = sum((av[k] for k in at[i]), Vector()) / 3
                loc, normal, _, dist = hbvh.find_nearest(c)
                if loc is not None and (c - loc).dot(normal) < 0:
                    continue  # inside the body: hidden
                hits += 1
                far = max(far, dist)
            line.append(f"{hits:3d}/{far:.2f}")
            if track != "Bat_Roost":
                h, d = worst.get((a, b), (0, 0.0))
                worst[(a, b)] = (max(h, hits), max(d, far))
        print(f"CLASH {track:10s} f={f:3d} " + " ".join(line))
    for (a, b), (h, d) in worst.items():
        flag = "  <-- CUTS THROUGH" if h else ""
        print(f"CLASH worst in flight {a} x {b}: {h} triangles, up to {d:.2f} outside the egg{flag}")


def buried_report(nodes, egg="Bat_Head", samples=8):
    """How far inside the egg the shallowest vertex of each hidden nub
    stays in every clip frame (negative: it shows)."""
    worst = {n: 1e9 for n in nodes}
    for _track, _f in _clip_frames(samples):
        dg = bpy.context.evaluated_depsgraph_get()
        _, _, bvh = _mesh(egg, dg)
        for n in nodes:
            verts, _, _ = _mesh(n, dg)
            for v in verts:
                loc, normal, _, dist = bvh.find_nearest(v)
                depth = dist if (v - loc).dot(normal) < 0 else -dist
                worst[n] = min(worst[n], depth)
    shallow = min(worst.values())
    flag = "" if shallow > 0.02 else "  <-- SHOWS"
    name = min(worst, key=worst.get)
    print(f"CHECK hidden nubs inside the egg in every clip: shallowest {shallow:.3f} ({name}){flag}")


def check(kit):
    objects = list(bpy.data.objects)
    rest = rest_space(objects)
    kit.size_report(PREFIX, REFERENCE, space=rest)
    egg_obj = bpy.data.objects["Bat_Head"]
    pts = [rest["Bat_Head"] @ v.co for v in egg_obj.data.vertices]
    ext = [max(p[i] for p in pts) - min(p[i] for p in pts) for i in range(3)]
    print(f"CHECK egg (head and body): width {ext[0]:.3f}, length {ext[1]:.3f}, height {ext[2]:.3f}, "
          f"length / height {ext[1] / ext[2]:.2f}")
    kit.triangle_report(PREFIX, BUDGET)
    kit.thickness_report(PREFIX, SCALE)
    # the .blend opens with Bat_Roost evaluated into the pivots; three.js
    # starts from the GLB rest (the runner has saved already)
    print(f"CHECK rest pose from GLB: {kit.glb_rest_pose(REPO_GLB)} nodes")
    egg = "Bat_Head"  # the whole head-and-body egg
    joints = [("Bat_InnerMembrane_L", egg), ("Bat_InnerMembrane_R", egg), ("Bat_UpperArm_L", egg),
              ("Bat_UpperArm_R", egg), ("Bat_TailMembrane", egg), ("Bat_Foot_L", "Bat_TailMembrane"),
              ("Bat_Foot_R", "Bat_TailMembrane")]
    kit.clip_report(egg, None, ["Bat_Leg_L", "Bat_Leg_R"], ["Bat_Foot_L", "Bat_Foot_R"], ["Bat_TailMembrane"],
                    joints=joints)
    nubs = [o.name for o in kit.mesh_objects(PREFIX) if o.name in kit.HIDDEN]
    buried_report(nubs, egg)
    # parts that must never cut through each other in flight (Roost is
    # printed but not counted: the bat is hidden while it roosts)
    print("CLASH columns (triangles/outside egg): wing L x R, L x ear L, L x lining L, L x ear R, L x eye L, "
          "L x tail, L x foot L, L x muzzle")
    clash_report([("Bat_InnerMembrane_L", "Bat_InnerMembrane_R"), ("Bat_InnerMembrane_L", "Bat_Ear_L"),
                  ("Bat_InnerMembrane_L", "Bat_InnerEar_L"), ("Bat_InnerMembrane_L", "Bat_Ear_R"),
                  ("Bat_InnerMembrane_L", "Bat_Eye_L"), ("Bat_InnerMembrane_L", "Bat_TailMembrane"),
                  ("Bat_InnerMembrane_L", "Bat_Foot_L"), ("Bat_InnerMembrane_L", "Bat_Muzzle")], hide_in=egg)
