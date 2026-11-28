"""Slug: a soft little garden slug figurine.

The slug is posed in code (entities/slugs/Slugs.tsx, updateRig): the rear,
middle and mantle pivots swing about the vertical axis against each other
(the body wave), the middle and foot pivots stretch, the head dips while
feeding and the four feeler pivots wobble. Every pivot sits at the model
origin on the ground, so each part turns about the slug's centre, not about
its own joint. Design space is the stored pose: Blender world, +Z up, the
slug faces -Y, its L nodes are on +X. Runtime scale 0.21 (slugActorScale in
entities/slugs/slugBehavior.ts), so 0.03 game units is 0.143 model units.

One smooth tapered body from a single loft profile: a round face at the
front, a soft rounded tail tip that curls up a little at the back. Because
every pivot is at the origin, a ring of the body at y = 0 only slides along
the body when the parts turn, so the body is cut there: the head node is
the whole front half and the rear node the back half, starting just inside
the head's back, where the head's steep end cap crosses it on a clean ring.
The middle node, which swings hardest against everything, is a hidden nub.

The mantle is a shell-like pad built in the body's own surface coordinates
(along the body, around its section): a plateau a set height above the
body, a rolled rim, and an undercut that dives into the body. The rim's
lip stays clear of the body by more than the parts move against the mantle
(head yaw and feeding dip, rear yaw and roll), so the body never cuts
through it, and the only place the mantle meets the body is hidden under
the lip. Three big cream spots lie on its plateau. Chunky eye stalks splay
in a soft V to big ink eye balls with a round glint, the cheeks blush (on
the Mouth node). The Foot and lower feeler nodes are hidden nubs: a sole
read as a thin noisy line at this size, and short lower feelers as legs.
"""

import math

import bpy
from mathutils import Vector

PREFIX = "Slug_"
SCALE = 0.21  # slugActorScale in entities/slugs/slugBehavior.ts
BUDGET = 1800
# The model this design replaced, at rest: width x, length y, height z.
REFERENCE = (0.628, 2.013, 0.666)

M = {
    "body": "Material.Slug.Body",
    "body2": "Material.Slug.BodyLight",
    "foot": "Material.Slug.Foot",
    "mantle": "Material.Slug.Mantle",
    "spot": "Material.Slug.MantleSpot",
    "eye": "Material.Slug.Eye",
    "glint": "Material.Slug.EyeGlint",
}

# On-screen colour of a sunlit face, roughness band (GAME_ART.md). No
# runtime code recolours the slug (Slugs.tsx only fades its opacity).
COLOURS = {
    # warm amber: lighter and yellower than carrot orange (#ff8a1c), so a
    # tapered orange body never reads as a carrot
    M["body"]: ("#f2a64a", 0.42),
    M["body2"]: ("#f2a64a", 0.42),
    M["mantle"]: ("#c8703c", 0.45),
    M["spot"]: ("#f6dcae", 0.45),
    M["foot"]: ("#f7a99a", 0.5),  # the blush on the cheeks (the sole node is a hidden nub)
    M["eye"]: ("#5c4590", 0.35),
    M["glint"]: ("#fff4dc", 0.35),
}

SIDES = (("L", 1.0), ("R", -1.0))  # the slug's L nodes are on +X

# ------------------------------------------------------------------ body profile
# (y, half width, top) of the body between the face cap and the tail cap;
# the belly is flat on the ground and the widest line sits 42% of the way up.
CORE = [(-0.78, 0.256, 0.352), (-0.62, 0.268, 0.37), (-0.44, 0.264, 0.366), (-0.22, 0.257, 0.352),
        (0.0, 0.249, 0.33), (0.2, 0.242, 0.288), (0.4, 0.23, 0.232), (0.62, 0.205, 0.172)]
FACE_Y, FACE_CAP = CORE[0][0], 0.24  # the face rounds off over FACE_CAP in front of FACE_Y
TAIL_Y, TAIL_CAP = CORE[-1][0], 0.25  # the tail rounds off over TAIL_CAP behind TAIL_Y
TAIL_CURL = 0.045  # the tail tip lifts this much off the ground
SECTION = (0.88, 0.9, 0.6)  # superellipse exponents: sides, top, belly
SEGMENTS = 18  # around the body: the outline is the silhouette at every zoom
CUT = 0.0  # the head and the rear meet on this ring, where the parts only slide

# ------------------------------------------------------------------ mantle
MANTLE_Y = (-0.43, 0.30)  # front and back edge along the body
MANTLE_SIDE = 0.86  # how far down the side the rim reaches (1 = the widest line)
MANTLE_ROUND = 2.2  # superellipse exponent of the outline (2 = oval)
LIP = 0.028  # the lip's clearance over the body: more than the parts turn against the mantle
FRONT_LIP = 0.016  # more over the head's top at the front edge, where the feeding dip lifts it
SHELL = 0.056  # the rim's thickness; the plateau sits lip + SHELL above the body
DOME = 0.12  # and rises by this much more toward the middle
MANTLE_SEGMENTS = 26
SPOTS = {  # node: [(along y, around s, radius)] on the plateau, >= 0.06 game units across
    "Slug_MantleSpot_L": [(-0.2, 0.1, 0.146)],
    "Slug_MantleSpot_R": [(0.09, -0.09, 0.146)],
}

# ------------------------------------------------------------------ face
EYE_R = (0.122, 0.118, 0.158)  # eye ball radii x, y, z: a tall oval 0.24 wide, 0.32 tall
# Eye centres: the feeler wobble rolls each stalk up to 0.16 rad about the
# slug's long axis at the ground, which swings an eye 0.16 x its height
# sideways, and the two stalks swing independently, so at times both swing
# inward. The eyes sit low enough and far enough apart that they never touch.
EYE_X, EYE_Y, EYE_Z = 0.222, -0.84, 0.53
STALK_R = (0.086, 0.076)  # base, top: >= 0.0715 everywhere
GLINT = 0.21  # round glint, nominal: it wraps the ball and measures about 0.15 across


def _catmull(values, ys, y):
    """Catmull-Rom through (ys, values) at y, clamped at the ends."""
    n = len(ys)
    if y <= ys[0]:
        return values[0]
    if y >= ys[-1]:
        return values[-1]
    k = max(i for i in range(n - 1) if ys[i] <= y)
    y0, y1 = ys[k], ys[k + 1]
    t = (y - y0) / (y1 - y0)
    p0, p1, p2, p3 = (values[max(0, k - 1)], values[k], values[k + 1], values[min(n - 1, k + 2)])
    m1 = (p2 - p0) / 2
    m2 = (p3 - p1) / 2
    t2, t3 = t * t, t * t * t
    return (2 * t3 - 3 * t2 + 1) * p1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2 + (t3 - t2) * m2


def body_section(y):
    """(half width, top) of the core body at y."""
    ys = [r[0] for r in CORE]
    return _catmull([r[1] for r in CORE], ys, y), _catmull([r[2] for r in CORE], ys, y)


def _spow(x, e):
    return math.copysign(abs(x) ** e, x)


def _middle(top):
    """Height of a section's widest line (the belly is on the ground)."""
    return 0.42 * top


def section_point(w, top, alpha, shrink=1.0, lift=0.0):
    """Point (x, z) of a section at loft angle alpha (pi/2 is the top),
    scaled by `shrink` about its widest line and raised by `lift`."""
    ex, ezt, ezb = SECTION
    zm = _middle(top)
    c, sn = math.cos(alpha), math.sin(alpha)
    x = w * shrink * _spow(c, ex)
    z = zm + ((top - zm) * _spow(sn, ezt) if sn >= 0 else zm * _spow(sn, ezb)) * shrink
    return x, z + lift


def loft(part, material, rings, front, back, segments=SEGMENTS):
    """A closed body through rings [(y, half width, top, shrink, lift)],
    closed on poles `front` and `back` ((y, z) each)."""
    verts, ring_ids = [], []
    for y, w, top, s, lift in rings:
        ids = []
        for j in range(segments):
            x, z = section_point(w, top, math.pi / 2 + 2 * math.pi * j / segments, s, lift)
            ids.append(len(verts))
            verts.append(Vector((x, y, z)))
        ring_ids.append(ids)
    first = len(verts)
    verts.append(Vector((0.0, front[0], front[1])))
    last = len(verts)
    verts.append(Vector((0.0, back[0], back[1])))
    faces = [[first, ring_ids[0][(j + 1) % segments], ring_ids[0][j]] for j in range(segments)]
    for lower, upper in zip(ring_ids, ring_ids[1:]):
        faces.extend([lower[j], lower[(j + 1) % segments], upper[(j + 1) % segments], upper[j]]
                     for j in range(segments))
    faces.extend([ring_ids[-1][j], ring_ids[-1][(j + 1) % segments], last] for j in range(segments))
    # orient outward: a side quad must face away from the body axis
    a, b, c = (verts[i] for i in faces[segments][:3])
    centre = Vector((0.0, a.y, _middle(rings[0][2])))
    if (b - a).cross(c - a).dot(a - centre) < 0:
        faces = [list(reversed(f)) for f in faces]
    return part.add(verts, faces, material)


def core_ring(y, shrink=1.0):
    w, top = body_section(y)
    return (y, w, top, shrink, 0.0)


def face_rings():
    """The round face: the section shrinks about its widest line toward a
    pole FACE_CAP in front of FACE_Y, so the chin rounds up too."""
    w, top = body_section(FACE_Y)
    out = []
    for phi in (72, 47, 22):
        f = math.radians(phi)
        out.append((FACE_Y - FACE_CAP * math.sin(f), w, top, math.cos(f), 0.0))
    return out, (FACE_Y - FACE_CAP, _middle(top))


def tail_rings():
    """A soft round tail tip that curls up a little."""
    w, top = body_section(TAIL_Y)
    out = []
    for phi in (28, 56):
        f = math.radians(phi)
        t = math.sin(f)
        out.append((TAIL_Y + TAIL_CAP * t, w, top, math.cos(f), TAIL_CURL * t * t))
    return out, (TAIL_Y + TAIL_CAP, _middle(top) + TAIL_CURL)


# ------------------------------------------------------------------ body-surface coordinates
class BodyMap:
    """The core body surface by (y, s): y along the body, s the arc length
    around the section from the top line (positive toward +X). `point`
    returns the surface point and outward normal."""

    def __init__(self):
        self.cache = {}

    def table(self, y):
        key = round(y, 4)
        if key not in self.cache:
            w, top = body_section(y)
            alphas = [math.pi / 2 - math.pi * k / 400 for k in range(301)]  # top, down the +X side
            pts = [section_point(w, top, a) for a in alphas]
            arc = [0.0]
            for p, q in zip(pts, pts[1:]):
                arc.append(arc[-1] + math.hypot(q[0] - p[0], q[1] - p[1]))
            widest = arc[200]  # alpha = 0
            self.cache[key] = (alphas, arc, widest, w, top)
        return self.cache[key]

    def widest(self, y):
        return self.table(y)[2]

    def surface(self, y, s):
        alphas, arc, _, w, top = self.table(y)
        d = abs(s)
        k = 0
        while k < len(arc) - 2 and arc[k + 1] < d:
            k += 1
        f = (d - arc[k]) / max(arc[k + 1] - arc[k], 1e-9)
        a = alphas[k] + (alphas[k + 1] - alphas[k]) * min(1.0, f)
        x, z = section_point(w, top, a)
        return Vector((math.copysign(x, s) if s != 0 else x, y, z))

    def point(self, y, s, h=0.0):
        p = self.surface(y, s)
        e = 1e-3
        dy = self.surface(y + e, s) - self.surface(y - e, s)
        ds = self.surface(y, s + e) - self.surface(y, s - e)
        n = dy.cross(ds).normalized()
        if n.dot(p - Vector((0.0, y, _middle(body_section(y)[1])))) < 0:
            n = -n
        return p + n * h, n


def lip(y, s):
    """Clearance of the mantle's lip over the body at (y, s): LIP, plus
    FRONT_LIP over the top of the front edge."""
    from party_animals.kit import smoothstep
    return LIP + FRONT_LIP * smoothstep(-0.24, -0.44, y) * (1.0 - smoothstep(0.08, 0.26, abs(s)))


def mantle_rho(body, y, s):
    """Where (y, s) lies in the mantle outline: 0 at the centre, 1 on it."""
    yc = (MANTLE_Y[0] + MANTLE_Y[1]) / 2
    ay = (MANTLE_Y[1] - MANTLE_Y[0]) / 2
    n = MANTLE_ROUND
    return (abs((y - yc) / ay) ** n + abs(s / (MANTLE_SIDE * body.widest(y))) ** n) ** (1 / n)


def mantle_top(body, y, s):
    """Height of the mantle's top over the body: the lip and the rim's
    thickness, plus a soft dome toward the middle."""
    rho = min(1.0, mantle_rho(body, y, s))
    return lip(y, s) + SHELL + DOME * (1.0 - rho * rho) ** 1.5


def mantle_outline(kit, body, count):
    """Closed outline of the mantle in (y, s), evenly spaced, with outward
    normals in the same plane."""
    yc = (MANTLE_Y[0] + MANTLE_Y[1]) / 2
    ay = (MANTLE_Y[1] - MANTLE_Y[0]) / 2
    dense = []
    for k in range(720):
        t = 2 * math.pi * k / 720
        u = _spow(math.cos(t), 2 / MANTLE_ROUND)
        v = _spow(math.sin(t), 2 / MANTLE_ROUND)
        y = yc + ay * u
        dense.append(Vector((y, v * MANTLE_SIDE * body.widest(y), 0.0)))
    pts = kit._resample_closed(dense, count)
    out = []
    n = len(pts)
    for j, p in enumerate(pts):
        t = pts[(j + 1) % n] - pts[j - 1]
        normal = Vector((t.y, -t.x, 0.0)).normalized()
        if normal.dot(p - Vector((yc, 0.0, 0.0))) < 0:
            normal = -normal
        out.append((Vector((p.x, p.y)), Vector((normal.x, normal.y))))
    return out, Vector((yc, 0.0))


def build_mantle(kit, part, material, body):
    """The mantle shell: a domed plateau, a rolled rim, an undercut.

    Rings are (fraction of the outline from the centre, or None and an
    in-surface offset outward from the outline, then the height over the
    body: None for the domed top, or (times the local lip, plus)). The rim
    is a round lip: the plateau rolls over to the lip's outermost point and
    back under it to the lip's bottom, a clearance above the body, and the
    undercut dives steeply into the body, so the body only ever meets the
    mantle under the lip."""
    rings = [(0.36, 0.0, None), (0.7, 0.0, None), (None, -0.055, None), (None, -0.012, (1, SHELL - 0.012)),
             (None, 0.012, (1, SHELL * 0.5)), (None, -0.004, (1, 0.004)), (None, -0.034, (0, -0.05))]
    outline, centre = mantle_outline(kit, body, MANTLE_SEGMENTS)
    verts = [body.point(centre.x, centre.y, mantle_top(body, centre.x, centre.y))[0]]
    ids = [[0]]
    for frac, u, height in rings:
        ring = []
        for p, n in outline:
            q = centre + (p - centre) * frac if frac is not None else p + n * u
            h = mantle_top(body, q.x, q.y) if height is None else height[0] * lip(q.x, q.y) + height[1]
            ring.append(len(verts))
            verts.append(body.point(q.x, q.y, h)[0])
        ids.append(ring)
    count = len(outline)
    faces = [[0, ids[1][j], ids[1][(j + 1) % count]] for j in range(count)]
    for lower, upper in zip(ids[1:], ids[2:]):
        faces.extend([lower[j], upper[j], upper[(j + 1) % count], lower[(j + 1) % count]] for j in range(count))
    a, b, c = (verts[i] for i in faces[0])
    if (b - a).cross(c - a).z < 0:
        faces = [list(reversed(f)) for f in faces]
    return part.add(verts, faces, material)


def build_spot(part, material, body, y0, s0, radius, segments=16):
    """A round cream spot on the mantle's plateau: a flat top that follows
    the dome, a crisp shoulder and a rim tucked under the mantle."""
    lift, tuck, shoulder = 0.013, 0.014, 0.016
    verts = [body.point(y0, s0, mantle_top(body, y0, s0) + lift)[0]]
    ids = [[0]]
    for r, h in ((radius * 0.55, lift), (radius, lift), (radius + shoulder * 0.5, lift * 0.4),
                 (radius + shoulder, -tuck)):
        ring = []
        for j in range(segments):
            a = 2 * math.pi * j / segments
            y, s = y0 + r * math.cos(a), s0 + r * math.sin(a)
            ring.append(len(verts))
            verts.append(body.point(y, s, mantle_top(body, y, s) + h)[0])
        ids.append(ring)
    faces = [[0, ids[1][j], ids[1][(j + 1) % segments]] for j in range(segments)]
    for lower, upper in zip(ids[1:], ids[2:]):
        faces.extend([lower[j], upper[j], upper[(j + 1) % segments], lower[(j + 1) % segments]]
                     for j in range(segments))
    a, b, c = (verts[i] for i in faces[0])
    if (b - a).cross(c - a).z < 0:
        faces = [list(reversed(f)) for f in faces]
    return part.add(verts, faces, material)


def build(kit, party_style):
    objects = list(bpy.data.objects)
    space = kit.design_space(objects)
    parts = {o.name: kit.Part(o.name) for o in objects if o.type == "MESH"}
    body = BodyMap()

    # head: the whole front of the body, from the round face to the cut,
    # ending in a steep cap just behind it (inside the rear)
    face, face_pole = face_rings()
    core = [core_ring(y) for y in (FACE_Y, -0.62, -0.42, -0.2, CUT)]
    cap = [(CUT + 0.026, *body_section(CUT + 0.026), 0.9, 0.0)]
    loft(parts["Slug_Head"], M["body2"], face + core + cap, face_pole, (CUT + 0.05, _middle(body_section(CUT)[1])))

    # rear: starts inside the head's back (shrunk under it, so no surface is
    # shared), reaches full size where the head's cap has dived in, and
    # tapers to the tail
    tail, tail_pole = tail_rings()
    rear = [core_ring(CUT, 0.975), core_ring(CUT + 0.045)] + [core_ring(y) for y in (0.17, 0.32, 0.47, TAIL_Y)]
    loft(parts["Slug_RearBody"], M["body"], rear + tail, (CUT - 0.05, _middle(body_section(CUT)[1])), tail_pole)

    # the middle swings hardest against every other part: a hidden nub
    kit.hidden_nub(parts["Slug_MiddleBody"], M["body2"], Vector((0.0, 0.0, 0.15)), 0.05)
    # sole: the body rests on the ground, so the foot node is a hidden nub
    kit.hidden_nub(parts["Slug_Foot"], M["foot"], Vector((0.0, -0.2, 0.15)), 0.04)

    build_mantle(kit, parts["Slug_Mantle"], M["mantle"], body)
    for name, items in SPOTS.items():
        for y0, s0, radius in items:
            build_spot(parts[name], M["spot"], body, y0, s0, radius)

    # eye stalks: one chunky stalk per side from deep in the head, splayed
    # in a soft V, to a big ink eye ball; the tip slice is the top of the
    # same stalk
    for side, sx in SIDES:
        base = Vector((sx * 0.08, -0.74, 0.18))
        mid = Vector((sx * 0.145, -0.79, 0.36))
        eye_c = Vector((sx * EYE_X, EYE_Y, EYE_Z))
        kit.sliced_tail([base, mid, eye_c], lambda t: STALK_R[0] + (STALK_R[1] - STALK_R[0]) * t,
                        [(parts[f"Slug_UpperFeeler_{side}"], M["body2"]),
                         (parts[f"Slug_UpperFeelerTip_{side}"], M["body2"])],
                        samples=1, segments=kit.LEG_SEGMENTS, cap_rings=1)
        kit.blob(parts[f"Slug_Eye_{side}"], M["eye"], eye_c, *EYE_R, ex=0.95, ey=0.95, ez=0.95, res=4)
        ball = kit.Surface(parts[f"Slug_Eye_{side}"])
        # a round glint up, forward and to the viewer's upper left (world
        # -X) on both eyes, toward the rim so most of the eye stays ink
        target = eye_c + Vector((-0.55, -0.6, 0.8)).normalized()
        kit.pad(parts[f"Slug_EyeGlint_{side}"], M["glint"], ball, target, eye_c, GLINT * 0.5, GLINT * 0.5, 0.012,
                u_hint=(0, 0, 1), rim=0.008, segments=16, rings=(0.0, 0.8, 1.0), lift=(1.0, 0.75, None))

    # lower feelers: hidden deep in the head (stubs read as legs at this size)
    head_c = Vector((0.0, -0.66, 0.17))
    for side, sx in SIDES:
        kit.hidden_nub(parts[f"Slug_LowerFeeler_{side}"], M["body2"], head_c + Vector((sx * 0.06, -0.05, 0.0)), 0.04)
        kit.hidden_nub(parts[f"Slug_LowerFeelerTip_{side}"], M["body2"], head_c + Vector((sx * 0.06, 0.02, 0.02)),
                       0.03)

    # blush: one soft pink oval on each cheek (the Mouth node carries both),
    # lifted more than on big animals: the slug renders at 0.21
    head = kit.Surface(parts["Slug_Head"])
    for side, sx in SIDES:
        kit.pad(parts["Slug_Mouth"], M["foot"], head, head_c + Vector((sx * 0.2, -0.3, -0.01)), head_c, 0.085, 0.11,
                0.014, u_hint=(0, 0, 1), rim=0.01, segments=12, rings=(0.0, 0.6, 1.0), lift=(1.0, 0.8, None))

    kit.rebuild_all(parts, space)
    kit.apply_colours(party_style, COLOURS)


def creep(w, glide):
    """updateRig offsets at wave phase w while creeping (blend 1)."""
    b = math.sin(w) * 0.1
    t = math.sin(w - 1.25) * 0.09
    return {
        "Slug_RearPivot": (0.0, -t, b * 0.45),
        "Slug_MiddlePivot": {"rot": (0.0, b, 0.0), "scale": (1 - glide * 0.18, 1 + glide, 1.0)},
        "Slug_MantlePivot": (0.0, -b * 0.7, -t * 0.35),
        "Slug_FootPivot": {"scale": (1 + glide * 0.2, 1 + glide * 0.8, 1 - glide * 0.22)},
        "Slug_HeadPivot": (0.0, t * 0.34, 0.0),
    }


def feelers(sign_x, sign_z, extra=None):
    """Feeler wobble extremes: rot.x +-0.077, rot.z +-0.16 (left negative)."""
    out = dict(extra or {})
    for k, name in enumerate(("Upper", "Upper", "Lower", "Lower")):
        side = "L" if k % 2 == 0 else "R"
        flip = -1.0 if k % 2 == 0 else 1.0
        out[f"Slug_{name}FeelerPivot_{side}"] = (0.077 * sign_x, 0.0, 0.16 * sign_z * flip)
    return out


def island_report(names, scale, minimum):
    """Narrowest width across each island of `names` at the runtime scale
    (spots, glints, blush), as kit.thickness_report measures it."""
    import bmesh
    dirs = []
    for i in range(300):
        z = 1 - (i + 0.5) / 300
        r = math.sqrt(1 - z * z)
        a = i * 2.399963
        dirs.append(Vector((r * math.cos(a), r * math.sin(a), z)))
    out = []
    for name in names:
        bm = bmesh.new()
        bm.from_mesh(bpy.data.objects[name].data)
        bm.transform(bpy.data.objects[name].matrix_world)
        bm.faces.ensure_lookup_table()
        seen = set()
        for f in bm.faces:
            if f.index in seen:
                continue
            stack, island = [f], []
            while stack:
                g = stack.pop()
                if g.index in seen:
                    continue
                seen.add(g.index)
                island.append(g)
                stack.extend(h for e in g.edges for h in e.link_faces if h.index not in seen)
            pts = list({v.co.copy().freeze() for g in island for v in g.verts})
            widths = [(max(p.dot(d) for p in pts) - min(p.dot(d) for p in pts), d) for d in dirs]
            _, dmin = min(widths, key=lambda w: w[0])
            across = min(w for w, d in widths if abs(d.dot(dmin)) < 0.1) * scale
            out.append(f"{name} {across:.3f}" + ("" if across >= minimum else " <--"))
        bm.free()
    print(f"CHECK across (game units, at least {minimum}): " + ", ".join(out))


def pose_table():
    """Extremes of updateRig in entities/slugs/Slugs.tsx (three.js node-local
    offsets; see kit.apply_pose): creep at sixteen wave phases with the glide
    stretch at both ends, feeler wobble, and the feeding head dip (the body
    wave runs at 0.18 while feeding)."""
    poses = {"rest": {}}
    for k in range(16):
        w = k * math.pi / 8
        poses[f"creep {k * 22.5:5.1f} deg"] = creep(w, 0.07 if k % 2 == 0 else 0.0)
    for sx in (-1, 1):
        for sz in (-1, 1):
            poses[f"feelers x{sx:+d} z{sz:+d}"] = feelers(sx, sz, creep(math.pi / 2, 0.07))
    for dip in (-0.09, 0.09):
        for k in (0, 2):
            feed = {name: tuple(v * 0.18 for v in spec) if isinstance(spec, tuple)
                    else {**spec, "rot": tuple(v * 0.18 for v in spec.get("rot", (0.0, 0.0, 0.0)))}
                    for name, spec in creep(k * math.pi / 2, 0.0).items()}
            head = feed["Slug_HeadPivot"]
            feed["Slug_HeadPivot"] = (dip, head[1], head[2])
            poses[f"feed dip {dip:+.2f} w{k * 90}"] = feelers(1 if k else -1, 1 if k else -1, feed)
    return poses


def lip_report(kit, poses):
    """How far the body reaches through the visible mantle (lip, rim and
    plateau) in each pose: the vertices outside the head and rear at rest
    must stay outside (positive clearance), and the undercut's open edge,
    inside them at rest, must stay inside (negative)."""
    from mathutils.bvhtree import BVHTree
    O = bpy.data.objects
    rest = {o.name: o.matrix_basis.copy() for o in O}
    mantle = O["Slug_Mantle"]
    visible = None
    out, hidden = [], []
    for label, offsets in poses.items():
        for o in O:
            o.matrix_basis = rest[o.name]
        kit.apply_pose(offsets)
        dg = bpy.context.evaluated_depsgraph_get()
        trees = []
        for name in ("Slug_Head", "Slug_RearBody"):
            verts, polys = kit._world_mesh(O[name], dg)
            trees.append(BVHTree.FromPolygons(verts, polys))
        pts = [mantle.matrix_world @ v.co for v in mantle.data.vertices]

        def clearance(p):
            best = 1e9
            for tree in trees:
                loc, normal, _, dist = tree.find_nearest(p)
                if loc is not None:
                    best = min(best, -dist if (p - loc).dot(normal) < 0 else dist)
            return best

        values = [clearance(p) for p in pts]
        if visible is None:
            visible = [i for i, v in enumerate(values) if v > 0.0]
            buried = [i for i, v in enumerate(values) if v <= 0.0]
        worst = min(values[i] for i in visible)
        out.append((worst, label))
        hidden.append((max(values[i] for i in buried), label))
    for o in O:
        o.matrix_basis = rest[o.name]
    bpy.context.view_layer.update()
    out.sort()
    print("CHECK mantle clearance (model units, visible mantle vertices; worst first): "
          + ", ".join(f"{label.strip()} {v:+.3f}" for v, label in out[:6])
          + (" <-- BODY THROUGH MANTLE" if out[0][0] < -0.004 else ""))
    hidden.sort(reverse=True)
    print("CHECK mantle undercut edge inside the body (model units; worst first): "
          + ", ".join(f"{label.strip()} {v:+.3f}" for v, label in hidden[:4])
          + (" <-- UNDERCUT SHOWS" if hidden[0][0] > 0.0 else ""))


def check(kit):
    kit.size_report(PREFIX, REFERENCE)
    island_report(["Slug_MantleSpot_L", "Slug_MantleSpot_R"], SCALE, 0.06)
    island_report(["Slug_EyeGlint_L", "Slug_EyeGlint_R", "Slug_Mouth"], SCALE, 0.03)
    kit.proportion_report("Slug_RearBody", ["Slug_Head"])
    kit.triangle_report(PREFIX, BUDGET)
    kit.thickness_report(PREFIX, SCALE)
    # The slug has no legs: "legs" is how deep the rear reaches into the
    # head, "head" how deep the head reaches into the rear, "foot" the
    # lowest point of the head, "tail" the mantle in the rear.
    poses = pose_table()
    joints = [("Slug_UpperFeeler_L", "Slug_Head"), ("Slug_UpperFeeler_R", "Slug_Head"),
              ("Slug_RearBody", "Slug_Head"), ("Slug_MiddleBody", "Slug_Head")]
    kit.procedural_report("Slug_RearBody", "Slug_Head", ["Slug_Head"], ["Slug_Head"], ["Slug_Mantle"], poses,
                          joints=joints)
    lip_report(kit, poses)
    eye_gap_report(kit)


def eye_gap_report(kit):
    """Closest approach of the two eyes when both feelers swing inward
    (and outward), as the independent feeler wobbles can line up."""
    O = bpy.data.objects
    rest = {o.name: o.matrix_basis.copy() for o in O}
    out = []
    for label, sign in (("inward", 1), ("outward", -1)):
        for sx in (-1, 1):
            kit.apply_pose(feelers(sx, sign))
            m = kit.pose_metrics("Slug_Head", None, ["Slug_RearBody"], ["Slug_Head"],
                                 joints=[("Slug_Eye_L", "Slug_Eye_R")])
            gap = -m["joints"][0]  # pose_metrics: positive = reaching inside
            out.append(f"{label} x{sx:+d} {gap:+.3f}" + (" <-- EYES TOUCH" if gap < 0.01 else ""))
            for o in O:
                o.matrix_basis = rest[o.name]
            bpy.context.view_layer.update()
    print("CHECK eye gap (model units): " + ", ".join(out))
