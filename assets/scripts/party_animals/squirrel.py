"""Squirrel: a round red squirrel figurine with one big plume of a tail.

The squirrel is animated by GLB clips (Squirrel_Scamper, _Bound, _Sit,
_Forage, _Pause, _Flee); it waits in Squirrel_Pause, so it is designed in
that clip's first frame: Blender world, +Z up, facing -Y, its L nodes on +X.
The rig's root turns it half round, so a pivot's local +Y points forward;
the head is authored in its pivot's own frame turned back (`straight`), so
it stays symmetric about the head pivot, whose stored pose looks 9 degrees
to one side. Pause does not animate the legs, so they keep their stored
tuck (front legs 33 degrees back, hind legs 38 degrees forward); the legs
are short stubs and the paws gather under the body, so the tuck reads as a
crouch. Legs, paws, ears and tail slices are authored in their own pivot
frames, so every clip moves them cleanly. Runtime scale 0.2
(squirrelActorScale in entities/squirrels/Squirrel.tsx), so 0.03 game units
is 0.15 model units: every visible part, glints included, is at least that
across. No runtime colour overrides.

A small bean body, a big round head that sits on the
chest, big ink eyes with a glint at the upper left, pink blush, a cream
two-puff muzzle with a small pink button nose, flat rounded-triangle ears
with a pink lining and a dark brush tip, cream front paws and rust hind
feet, and one big S-curved plume of a tail in a light amber, so it reads
apart from the body, cut at its three pivots (the old tail was a stack of
lumps).

The plume is one surface at rest and in every clip (`plume`): a round
section, flat in radius where it is cut at a pivot, each cut ring shared
with a zone of a sphere centred on the pivot that fills the outside of a
bend, rings of twice the segments at every cut so a twist cannot saw-tooth
them through each other, and exact normals written as custom normals, so
the two sides of a cut shade as one surface.

The eyes are about half the head's height, more than GAME_ART's pets: at
this scale a glint 0.03 game units across is 0.15 model units, and on a
smaller eye it covered the eye like a fried egg. Squirrel_Forage lowers the
body 0.05 and pitches it 10 degrees down while the front legs dig, so the
front paws reach 0.06 to 0.11 into the ground there (the old model 0.065);
every other clip keeps the paws within 0.03 of the ground.
"""

import math

import bpy
from mathutils import Matrix, Vector

PREFIX = "Squirrel_"
SCALE = 0.2  # squirrelActorScale in entities/squirrels/Squirrel.tsx
BUDGET = 2000  # small critter; the tail is most of it
# The model this design replaced, in Squirrel_Pause frame 1: width x, length y, height z.
REFERENCE = (0.76, 1.607, 1.495)

M = {
    "rust": "Material.Squirrel.RustFur",
    "shadow": "Material.Squirrel.ShadowFur",
    "warm": "Material.Squirrel.WarmFur",
    "cream": "Material.Squirrel.CreamFur",
    "pink": "Material.Squirrel.EarPink",
    "ink": "Material.Squirrel.Charcoal",
    "glint": "Material.Squirrel.EyeGlint",
}

# On-screen colour of a sunlit face, roughness band (GAME_ART.md).
COLOURS = {
    M["rust"]: ("#e07838", 0.8),
    M["shadow"]: ("#c8622f", 0.8),
    M["warm"]: ("#f4a650", 0.8),  # the plume: light amber, so it reads apart from the rust body
    M["cream"]: ("#f2e0c0", 0.8),
    M["pink"]: ("#f59a92", 0.8),
    M["ink"]: ("#5c4590", 0.35),
    M["glint"]: ("#fff4dc", 0.35),
}

SIDES = (("L", 1.0), ("R", -1.0))  # the squirrel's L nodes are on +X

BODY_C = Vector((0.0, 0.03, 0.46))
HEAD_C = Vector((0.0, -0.08, 0.095))  # in the straight head frame: -y forward
LEG_INWARD = 0.05
LEG_R = 0.08  # 0.032 game units across at the runtime scale
LEG_SEGMENTS = 10  # kit.LEG_SEGMENTS: legs and paws read round at the closest zoom
FRONT_SOLE, HIND_SOLE = -0.29, -0.305  # pivot-local: paws meet the ground in the Pause tuck
PAW_R, PAW_H = 0.1, 0.17
HIND_R, HIND_H = 0.11, 0.17
HIND_TOE = 0.0  # no forward reach: the hind legs tilt 38 degrees forward in Pause, which lifted a toe
EYE_H, EYE_W = 0.34, 0.28
# The glint pad's full width; its rim tucks under the eye, so about 0.15
# (0.03 game units) of it shows. Its centre sits up and to the viewer's
# left of the eye centre, by these fractions of the eye's height and width.
GLINT = 0.18
GLINT_UP, GLINT_SIDE = 0.18, 0.13
TAIL_SEGMENTS = 10
TAIL = "warm"  # a lighter plume reads apart from the body


def straight(kit, matrix):
    """A pivot's design-space frame turned half round, so that, like the
    world, +X is the squirrel's left, -Y forward and +Z up."""
    return kit.node_frame(matrix) @ Matrix.Rotation(math.pi, 4, "Z")


def stub_leg(kit, part, material, pivot, radius, length, inward):
    """kit.pivot_leg as a plain stub: a top cone hidden in the body and one
    band down to the paw's open top rim, where it ends open on the same
    circle (the paw closes it), so only the band shows."""
    profile = [(radius, 0.0), (radius, length), (0.0, length + radius)]
    return kit.lathe(part, material, kit._leg_frame(pivot, inward, -length), profile, LEG_SEGMENTS)


def paw(radius, height, leg_r):
    """A round mitten paw (kit.paw_profile with one ring fewer: the
    squirrel's paws are a few pixels across)."""
    return [(0.0, 0.0), (radius * 0.64, 0.0), (radius * 0.94, height * 0.17), (radius, height * 0.44),
            (radius * 0.86, height * 0.78), (leg_r, height)]


def toe(profile, forward, spread):
    """`lathe` sections that reach a paw's toe forward and widen it.

    The rig's pivots face +Y locally, so forward is +Y in the leg frame (the
    kit's PAW_TOE reaches -Y)."""
    top = profile[-1][1]
    out = []
    for _, z in profile:
        w = (1.0 - z / top) ** 1.2
        out.append((1.0, 1.0 + (spread - 1.0) * w, forward * w))
    return out


# The ear, its lining and its brush, as outlines in the ear's plane: x
# across, y up the ear from its centre, which sits EAR_RISE above the base
# point buried in the head (design units).
EAR_OUTLINE = [(0.0, -0.15), (0.16, -0.1), (0.15, 0.0), (0.1, 0.1), (0.045, 0.17), (0.0, 0.195), (-0.045, 0.17),
               (-0.1, 0.1), (-0.15, 0.0), (-0.16, -0.1)]
LINING_OUTLINE = [(0.0, -0.12), (0.095, -0.07), (0.08, 0.02), (0.04, 0.075), (0.0, 0.09), (-0.04, 0.075),
                  (-0.08, 0.02), (-0.095, -0.07)]
BRUSH_OUTLINE = [(0.0, 0.105), (0.08, 0.12), (0.07, 0.175), (0.038, 0.225), (0.0, 0.258), (-0.038, 0.225),
                 (-0.07, 0.175), (-0.08, 0.12)]
EAR_RISE = 0.13
EAR_THICK, LINING_THICK, BRUSH_THICK = 0.09, 0.05, 0.11


def lens(kit, part, material, frame, outline, thickness, segments):
    """kit.slab with no inner rings: a pole on each face and the rim, for a
    lining whose rim is buried in the ear (2 * segments triangles)."""
    pts = kit._resample_closed(kit._closed_catmull([Vector((x, y, 0.0)) for x, y in outline], 4), segments)
    verts = [frame @ Vector((0.0, 0.0, thickness / 2))] + [frame @ p for p in pts] + \
        [frame @ Vector((0.0, 0.0, -thickness / 2))]
    n = len(pts)
    faces = [[0, 1 + j, 1 + (j + 1) % n] for j in range(n)] + [[n + 1, 1 + (j + 1) % n, 1 + j] for j in range(n)]
    a, b, c = (verts[i] for i in faces[0])
    if (b - a).cross(c - a).dot(frame.to_3x3() @ Vector((0.0, 0.0, 1.0))) < 0:
        faces = [list(reversed(f)) for f in faces]
    return part.add(verts, faces, material)


def ear(kit, ear_part, inner_part, tuft_part, frame, base, tip, face, lean=math.radians(18)):
    """A flat rounded-triangle ear (a `slab`) standing up from the crown,
    with a pink lining that follows its outline and a dark brush on its tip.

    The ear's plane runs from `base` (buried in the head) toward `tip`,
    facing `face`; from the front it shows the lining, and from the side or
    behind it reads as a thin pointed flap. The lining is a `lens` 0.6 as
    big whose rim sits just under the ear's front and whose middle stands
    about 0.02 proud of it. The brush is a slightly thicker slab over the
    top of the ear, so it covers the tip on both faces and its rounded lower
    edge reads as a colour tip, and it leans back over the head by `lean`.
    Slab outlines are smooth curves, so the rims show no polygon steps."""
    hb, ht = frame @ base, frame @ tip
    axis = (ht - hb).normalized()
    f = frame.to_3x3() @ Vector(face)
    f = (f - axis * f.dot(axis)).normalized()
    centre = hb + axis * EAR_RISE
    plane = kit.frame_from(centre, f, axis)  # local z = face, local y = up the ear, local x across
    kit.slab(ear_part, M["rust"], plane, EAR_OUTLINE, EAR_THICK, segments=12, rings=(0.6,))
    # the lining's rim sits a little under the ear's front there (about 0.85
    # of the ear's half thickness), its middle stands proud
    lift = 0.75 * EAR_THICK / 2
    lens(kit, inner_part, M["pink"], plane @ kit.translation((0.0, 0.0, lift)), LINING_OUTLINE, LINING_THICK, 10)
    hinge = kit.translation((0.0, 0.15, 0.0)) @ Matrix.Rotation(-lean, 4, "X") @ kit.translation((0.0, -0.15, 0.0))
    kit.slab(tuft_part, M["shadow"], plane @ hinge, BRUSH_OUTLINE, BRUSH_THICK, segments=10, rings=(0.6,))


def eye(kit, eye_part, glint_part, surface, core, target, height, width, glint):
    """kit.eye with a round glint that keeps 0.03 game units across.

    At the runtime scale of 0.2 a glint 0.03 game units across is 0.15
    model units, about half the eye's width even on these big eyes; it sits
    up and to the viewer's left by GLINT_UP and GLINT_SIDE, as far as it
    can go before the eye's rim would fold it, so the eye reads as a dark
    eye with a highlight and not as a white eye with a violet rim. Its rim
    rolls down over the outer fifth only, so most of the pad shows."""
    centre, normal = kit.pad(eye_part, M["ink"], surface, target, core, height / 2, width / 2, 0.01,
                             u_hint=(0, 0, 1), rim=0.012, dome=0.02, segments=12, rings=(0.0, 0.6, 0.9, 1.0),
                             lift=(1.0, 0.85, 0.35, None))
    up = Vector((0, 0, 1)) - normal * normal.z
    up.normalize()
    side = Vector((-1.0, 0.0, 0.0)) - normal * normal.x - up * up.x
    side.normalize()
    glint_centre = centre + up * (height * GLINT_UP) + side * (width * GLINT_SIDE)
    kit.pad(glint_part, M["glint"], kit.Surface(eye_part), glint_centre, centre + normal * 0.4, glint / 2,
            glint / 2, 0.012, u_hint=(0, 0, 1), rim=0.006, segments=14, rings=(0.0, 0.8, 1.0),
            lift=(1.0, 0.9, None))
    return centre, normal


def s_curve(base, mid, tip, reverse_radius, reverse_turn, samples=(4, 5), end_samples=5):
    """The tail's centre line: one circular arc through the three pivots,
    then an arc of `reverse_radius` that bends the other way for
    `reverse_turn` radians, tangent at the tip pivot (an S).

    A Catmull-Rom through the pivots put most of the 58 degree turn at the
    middle pivot, a bend tighter than the plume is thick, so the inside of
    the bend folded. A circle through three points spreads it evenly
    (radius 0.31 against a plume radius of 0.2 there). `samples` gives the
    points from the base to the middle pivot and from there to the tip
    pivot. Returns the points, their exact unit tangents and the index of
    each pivot."""
    a, b, c = Vector(base), Vector(mid), Vector(tip)
    ab, ac = b - a, c - a
    normal = ab.cross(ac)
    centre = a + (ac.length_squared * normal.cross(ab) + ab.length_squared * ac.cross(normal)) / (
        2 * normal.length_squared)
    normal.normalize()

    def angle_to(p):
        u, v = a - centre, p - centre
        return math.atan2(u.cross(v).dot(normal), u.dot(v))

    tb, tc = angle_to(b), angle_to(c)
    turn = 1.0 if tc > 0 else -1.0
    sa, sb = samples
    angles = [tb * k / sa for k in range(sa)] + [tb + (tc - tb) * k / sb for k in range(sb + 1)]
    curve = [centre + Matrix.Rotation(t, 3, normal) @ (a - centre) for t in angles]
    tangents = [(normal.cross(p - centre) * turn).normalized() for p in curve]
    centre2 = c + (c - centre).normalized() * reverse_radius
    for k in range(1, end_samples + 1):
        p = centre2 + Matrix.Rotation(-reverse_turn * k / end_samples, 3, normal) @ (c - centre2)
        curve.append(p)
        tangents.append((normal.cross(p - centre2) * -turn).normalized())
    return curve, tangents, [0, sa, sa + sb]


def knotted(kit, knots):
    """radius(t) through (t, r) knots, flat at every knot (smoothstep
    between), so the plume is a plain tube where a knot sits on a pivot.
    Returns radius(t) and its slope dr/dt."""
    def radius(t):
        for (t0, r0), (t1, r1) in zip(knots, knots[1:]):
            if t <= t1:
                return r0 + (r1 - r0) * kit.smoothstep(t0, t1, t)
        return knots[-1][1]

    def slope(t):
        for (t0, r0), (t1, r1) in zip(knots, knots[1:]):
            if t <= t1:
                x = min(1.0, max(0.0, (t - t0) / (t1 - t0)))
                return (r1 - r0) * 6 * x * (1 - x) / (t1 - t0)
        return 0.0
    return radius, slope


def stitch(lower, upper):
    """Faces between two rings (lists of vertex ids, a single id for a
    pole) whose counts are equal, or one twice the other, facing outward
    for rings that run counter-clockwise about the direction of travel."""
    m, n = len(lower), len(upper)
    if m == 1:
        return [[lower[0], upper[(j + 1) % n], upper[j]] for j in range(n)]
    if n == 1:
        return [[lower[j], lower[(j + 1) % m], upper[0]] for j in range(m)]
    if m == n:
        return [[lower[j], lower[(j + 1) % m], upper[(j + 1) % n], upper[j]] for j in range(m)]
    faces = []
    if n == 2 * m:  # coarse to fine: three triangles per coarse segment
        for j in range(m):
            l0, l1 = lower[j], lower[(j + 1) % m]
            u0, u1, u2 = upper[2 * j], upper[2 * j + 1], upper[(2 * j + 2) % n]
            faces += [[l0, l1, u1], [l0, u1, u0], [l1, u2, u1]]
        return faces
    if m == 2 * n:  # fine to coarse
        for j in range(n):
            l0, l1, l2 = lower[2 * j], lower[2 * j + 1], lower[(2 * j + 2) % m]
            u0, u1 = upper[j], upper[(j + 1) % n]
            faces += [[l0, l1, u0], [l1, l2, u1], [l1, u1, u0]]
        return faces
    raise ValueError("ring counts must match or double")


def plume(kit, curve, tangents, index, knots, slices, segments=10, end_rings=4, joint=20.0, inset=0.03, flare=0.03):
    """One bushy plume of one material through the tail pivots, cut into
    one round tube per pivot node, and the normals it should shade with.

    `knots` are (t, radius), t the fraction of the curve's length; put one
    on every pivot, where the radius is then flat. Each slice but the last
    runs on past its pivot in a zone of the sphere centred on that pivot,
    sharing the tube's last ring and receding `inset` by `joint` degrees;
    the next slice starts open on that ring. A clip turns the next slice
    about the pivot, so its open rim slides over the sphere and the outside
    of a bend shows the sphere between the two tube ends, which meet it
    with the same normal: no cap, seam ring or crease. The clips bend the
    Mid joint 17.4 degrees at most (Forage), and turn the Tip joint 15.9
    degrees in Pause, mostly a twist about the tail (its axis is 30 degrees
    off the tail); the section is round, so a twist only turns the rings.
    Every ring at a cut has twice the segments, so the turned rims stay
    within 1.2% of the sphere's radius and do not saw-tooth through each
    other. Past each cut the next slice grows `flare` wider, so where the
    two slices cross on the inside of a bend the outer one is always the
    next slice. The base pivot sits in the body, so the root needs only a
    pole.

    Returns {design-space vertex: unit normal}: the exact normals of the
    tube (radial, tilted by the radius slope) and of the joint spheres.
    Smooth shading from the faces would tilt each ring's normal by half the
    curve's turn between rings, differently on each side of a cut."""
    n = len(curve) - 1
    lengths = [0.0]
    for p, q in zip(curve, curve[1:]):
        lengths.append(lengths[-1] + (q - p).length)
    total = lengths[-1]
    radius, slope = knotted(kit, knots)
    normals = kit._transport_normals(curve, tangents, (0.0, 0.0, 1.0))
    starts = [0] + index[1:len(slices)]
    ends = index[1:len(slices)] + [n]
    shading = {}
    for k, ((part, material), a, b) in enumerate(zip(slices, starts, ends)):
        first, last = k == 0, k == len(slices) - 1
        verts, rings = [], []

        def ring(centre, tangent, normal, r, tilt, count):
            """A ring of `count` vertices; `tilt` turns each normal from
            radial toward the tangent (sphere latitude or radius slope)."""
            side = tangent.cross(normal).normalized()
            ids = []
            for j in range(count):
                ang = 2 * math.pi * j / count
                radial = normal * math.cos(ang) + side * math.sin(ang)
                ids.append(len(verts))
                verts.append((centre + radial * r, (radial * math.cos(tilt) + tangent * math.sin(tilt)).normalized()))
            return ids

        if first:
            verts.append((curve[a] - tangents[a] * radius(0.0), -tangents[a]))
            rings.append([0])
        for i in range(a, b + 1):
            t = lengths[i] / total
            grow = (1.0 + flare) ** (k - 1 if i == a else k) if k else 1.0
            cut = (i == a and not first) or (i == b and not last)
            rings.append(ring(curve[i], tangents[i], normals[i], radius(t) * grow, -math.atan(slope(t) / total),
                              2 * segments if cut else segments))
        r = radius(lengths[b] / total) * (1.0 + flare) ** k
        if not last:
            phi = math.radians(joint)
            rs = r * (1.0 - inset)
            rings.append(ring(curve[b] + tangents[b] * (rs * math.sin(phi)), tangents[b], normals[b],
                              rs * math.cos(phi), phi, 2 * segments))
        else:
            for m in range(1, end_rings):
                phi = math.pi / 2 * m / end_rings
                rings.append(ring(curve[b] + tangents[b] * (r * math.sin(phi)), tangents[b], normals[b],
                                  r * math.cos(phi), phi, segments))
            verts.append((curve[b] + tangents[b] * r, tangents[b]))
            rings.append([len(verts) - 1])
        faces = []
        for lower, upper in zip(rings, rings[1:]):
            faces += stitch(lower, upper)
        part.add([v for v, _ in verts], faces, material)
        for v, nrm in verts:
            shading[v.copy().freeze()] = nrm
    return shading


def set_shading(objects, shading, space):
    """Give each object's vertices the normals in `shading` (design space),
    as custom normals, so the exported GLB carries them."""
    from mathutils.kdtree import KDTree
    tree = KDTree(len(shading))
    keys = list(shading)
    for i, v in enumerate(keys):
        tree.insert(v, i)
    tree.balance()
    for obj in objects:
        m = space[obj.name]
        to_local = m.to_3x3().transposed()
        normals = []
        for v in obj.data.vertices:
            co, i, dist = tree.find(m @ v.co)
            if dist > 1e-5:
                raise RuntimeError(f"{obj.name}: no tail normal for a vertex ({dist:.6f} away)")
            normals.append((to_local @ shading[keys[i]]).normalized())
        obj.data.normals_split_custom_set_from_vertices(normals)


def build(kit, party_style):
    objects = list(bpy.data.objects)
    space = kit.clip_pose_space(objects, "Squirrel_Pause", 1)

    def P(name):
        return space[name].translation.copy()

    parts = {o.name: kit.Part(o.name) for o in objects if o.type == "MESH"}

    # body: a small bean, fuller and lower at the rump that holds the hind
    # leg tops, flatter on the belly
    kit.blob(parts["Squirrel_Body"], M["rust"], BODY_C, 0.27, (0.36, 0.38), (0.285, 0.3), ex=0.88, ey=0.85,
             ez=(0.72, 0.9), res=4, taper={"y": ("x", 0.12)})
    body = kit.Surface(parts["Squirrel_Body"])
    # no belly bib: the head sits on the chest and the belly faces the
    # ground, so a bib only showed as a thin pale plate between the front
    # legs in side views; the cream lives on the muzzle and front paws
    kit.hidden_nub(parts["Squirrel_Chest"], M["cream"], BODY_C + Vector((0.0, -0.05, 0.0)))
    for side, sx in SIDES:
        kit.hidden_nub(parts[f"Squirrel_Haunch_{side}"], M["warm"], BODY_C + Vector((sx * 0.08, 0.1, 0.0)))

    # legs: short round stubs on the hip pivots, standing in mitten paws
    # that meet them on one clean circle: cream hands in front, rust feet
    # behind
    for side in ("FL", "FR", "RL", "RR"):
        pivot = space[f"Squirrel_LegPivot_{side}"]
        local_x = pivot.to_3x3() @ Vector((1.0, 0.0, 0.0))
        inward = Vector((-LEG_INWARD if pivot.translation.x > 0 else LEG_INWARD, 0.0, 0.0)).dot(local_x.normalized())
        front = side[0] == "F"
        sole, radius, height = (FRONT_SOLE, PAW_R, PAW_H) if front else (HIND_SOLE, HIND_R, HIND_H)
        stub_leg(kit, parts[f"Squirrel_Leg_{side}"], M["shadow"], pivot, LEG_R, -(sole + height), inward)
        profile = paw(radius, height, LEG_R)
        kit.pivot_foot(parts[f"Squirrel_Paw_{side}"], M["cream"] if front else M["shadow"], pivot, inward, sole,
                       profile, segments=LEG_SEGMENTS,
                       sections=toe(profile, 0.03, 1.15) if front else toe(profile, HIND_TOE, 1.35))

    # tail: one big S-curved plume, rising behind the rump, arching over the
    # back and flicking up at the end, cut at its three pivots; thin where
    # it roots in the body, full from the middle pivot on, round at the end
    tb, tm, tt = P("Squirrel_TailPivot_Base"), P("Squirrel_TailPivot_Mid"), P("Squirrel_TailPivot_Tip")
    # more rings round the bends (4/5/5 showed facets along the arch)
    curve, tangents, index = s_curve(tb, tm, tt, 0.45, math.radians(55), samples=(5, 6), end_samples=6)
    lengths = [0.0]
    for p, q in zip(curve, curve[1:]):
        lengths.append(lengths[-1] + (q - p).length)
    t_mid, t_tip = lengths[index[1]] / lengths[-1], lengths[index[2]] / lengths[-1]
    # one swell: the plume fills out in the base slice, then holds nearly
    # level through the pivots (each knot is flat, so rising knots made a
    # staircase of bulges and waists) and rounds off at the end
    knots = [(0.0, 0.14), (t_mid, 0.226), (t_tip, 0.234), (t_tip + 0.45 * (1.0 - t_tip), 0.242), (1.0, 0.175)]
    tail = ["Squirrel_Tail_Base", "Squirrel_Tail_Mid", "Squirrel_Tail_Crown"]
    shading = plume(kit, curve, tangents, index, knots, [(parts[name], M[TAIL]) for name in tail],
                    segments=TAIL_SEGMENTS)
    kit.hidden_nub(parts["Squirrel_Tail_Tip"], M["cream"], tt)

    # head: one big round form, fuller at the cheeks, in the head pivot's
    # own frame
    H = straight(kit, space["Squirrel_HeadPivot"])

    def hp(x, y, z):
        return H @ Vector((x, y, z))

    head_c = hp(*HEAD_C)
    kit.blob(parts["Squirrel_Head"], M["rust"], None, 0.385, (0.295, 0.285), (0.3, 0.325), res=5,
             frame=H @ kit.translation(HEAD_C), ex=0.92, ey=0.95, ez=0.92, taper={"z": ("x", -0.08)})
    head = kit.Surface(parts["Squirrel_Head"])

    # muzzle: a cream two-puff snout with a small button nose on top
    muzzle_local = HEAD_C + Vector((0.0, -0.28, -0.15))

    def two_puffs(p, d):
        if p.z < 0:
            p.z += 0.03 * math.exp(-(p.x / 0.05) ** 2) * (-p.z / 0.1)
        return p

    kit.blob(parts["Squirrel_Muzzle"], M["cream"], None, 0.18, (0.11, 0.08), (0.1, 0.09), res=3,
             frame=H @ kit.translation(muzzle_local), ex=0.9, ez=0.9, deform=two_puffs)
    muzzle = kit.Surface(parts["Squirrel_Muzzle"])
    muzzle_c = H @ muzzle_local
    nose_c, _ = muzzle.project(muzzle_c, muzzle_c + H.to_3x3() @ Vector((0.0, -1.0, 0.6)))
    rot = H.to_3x3().to_4x4()
    kit.blob(parts["Squirrel_Nose"], M["pink"], None, 0.085, 0.045, (0.082, 0.084), res=2,
             frame=kit.translation(nose_c) @ rot, taper={"z": ("x", 0.15)})

    # ears: flat rounded triangles standing up from the crown, the pink
    # lining facing forward and up, with a dark brush tip
    for side, sx in SIDES:
        ear(kit, parts[f"Squirrel_Ear_{side}"], parts[f"Squirrel_InnerEar_{side}"],
            parts[f"Squirrel_EarTuft_{side}"], H, Vector((sx * 0.18, 0.0, 0.3)), Vector((sx * 0.29, 0.04, 0.58)),
            (sx * 0.15, -1.0, 0.35))

    # eyes: big ink ovals with a glint; blush on the Cheek nodes
    for side, sx in SIDES:
        eye(kit, parts[f"Squirrel_Eye_{side}"], parts[f"Squirrel_EyeGlint_{side}"], head,
            hp(*(HEAD_C + Vector((sx * 0.03, 0.0, 0.0)))), hp(*(HEAD_C + Vector((sx * 0.185, -0.5, 0.085)))),
            EYE_H, EYE_W, GLINT)
        kit.blush(parts[f"Squirrel_Cheek_{side}"], M["pink"], head, head_c,
                  hp(*(HEAD_C + Vector((sx * 0.26, -0.26, -0.11)))), 0.165, 0.22, segments=10)

    kit.rebuild_all(parts, space)
    set_shading([bpy.data.objects[name] for name in tail], shading, space)
    kit.apply_colours(party_style, COLOURS)


def ground_report(kit, feet, samples=8):
    """Per clip, the lowest point of each paw (min..max over the clip) and
    of every other part (the head dips when foraging, the body tilts when
    sitting): below -0.03 cuts the ground."""
    scene = bpy.context.scene
    objs = list(bpy.data.objects)
    meshes = [o for o in kit.mesh_objects(PREFIX) if o.name not in kit.HIDDEN]
    rest = {o.name: (o.location.copy(), o.rotation_mode, o.rotation_euler.copy(), o.rotation_quaternion.copy(),
                     o.scale.copy()) for o in objs}
    tracks = sorted({t.name for o in objs if o.animation_data for t in o.animation_data.nla_tracks})
    mutes = {(o.name, t.name): t.mute for o in objs if o.animation_data for t in o.animation_data.nla_tracks}

    def restore():
        for o in objs:
            loc, mode, eul, quat, scl = rest[o.name]
            o.location, o.rotation_mode, o.rotation_euler, o.rotation_quaternion, o.scale = loc, mode, eul, quat, scl

    for track in tracks:
        for o in objs:
            if o.animation_data:
                for t in o.animation_data.nla_tracks:
                    t.mute = t.name != track
        end = max(int(s.frame_end) for o in objs if o.animation_data for t in o.animation_data.nla_tracks
                  if t.name == track for s in t.strips)
        low = (1e9, "")
        paws = {f: [] for f in feet}
        for k in range(samples):
            restore()
            scene.frame_set(1 + round((end - 1) * k / (samples - 1)))
            dg = bpy.context.evaluated_depsgraph_get()
            for o in meshes:
                m = o.evaluated_get(dg).matrix_world
                z = min((m @ v.co).z for v in o.data.vertices)
                if o.name in paws:
                    paws[o.name].append(z)
                else:
                    low = min(low, (z, o.name))
        flag = "  <-- CUTS THE GROUND" if low[0] < -0.03 else ""
        feet_text = " ".join(f"{f[-2:]} {min(z):+.3f}..{max(z):+.3f}" for f, z in paws.items())
        print(f"CHECK ground {track:17s} paws {feet_text} | other parts {low[0]:+.3f} ({low[1]}){flag}")
    for o in objs:
        if o.animation_data:
            for t in o.animation_data.nla_tracks:
                t.mute = mutes[(o.name, t.name)]
    restore()
    scene.frame_set(1)
    restore()
    bpy.context.view_layer.update()


def check(kit):
    objects = list(bpy.data.objects)
    pause = kit.clip_pose_space(objects, "Squirrel_Pause", 1)
    kit.size_report(PREFIX, REFERENCE, space=pause)
    kit.proportion_report("Squirrel_Body", ["Squirrel_Head", "Squirrel_Muzzle"], space=pause)
    kit.triangle_report(PREFIX, BUDGET)
    kit.thickness_report(PREFIX, SCALE)
    legs = [f"Squirrel_Leg_{s}" for s in ("FL", "FR", "RL", "RR")]
    feet = [f"Squirrel_Paw_{s}" for s in ("FL", "FR", "RL", "RR")]
    kit.clip_report("Squirrel_Body", "Squirrel_Head", legs, feet, ["Squirrel_Tail_Base"])
    ground_report(kit, feet)
