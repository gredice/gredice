"""Butterfly: a plush toy butterfly with cushion wings.

Design space is the stored pose (entities/butterflies/Butterflies.tsx poses
the rig in code; there are no clips): Blender world, +Z up, the butterfly
faces -Y and its L nodes are on +X. Runtime scale 0.1077 (butterflyActorScale),
so 0.03 game units is 0.279 model units and the whole butterfly is about 21
pixels across at the default zoom.

A big round honey-cream head with tall ink eyes and a glint, ink antennae
that rise from the crown up and out to amber balls above and outside the
eyes (two feelers from the top-down camera, clear of the face and of the
wings at every flap angle), a round thorax that holds the wing roots and a
short abdomen with two clean amber stripes. Four big cushion wings, each a
closed lens 0.29 thick in the middle (0.03 game units) with a flat top that
rolls down to a round rim, thinning
toward the body so the wings folded up at rest clear each other above the
thorax. The fore and hind wing of a side lie in one plane and meet along a
seam from the body out to a small notch, like two stuffed lobes sewn side
by side (stacked cushions would need 0.16 between their planes).

At this scale the face, antennae and wing spots cannot reach 0.03 game
units without swallowing the head and wings (an eye that size is half the
head), so they are sized for the closest zoom, where the butterfly is about
110 pixels across; at the default zoom they read as colour blocks.

The runtime colours the wing nodes by name per variant
(entities/butterflies/butterflyBehavior.ts): WingFore, WingHind, WingEdge,
WingBand and WingSpot*, and shows or hides WingBand, WingSpotOuter and
WingSpotInner. The edge colour is the outer shoulder of each cushion: the
lens is split along a ring, so WingEdge and WingFore/WingHind share their
boundary vertices exactly (no decal, no extra triangles, no z-fighting).
The three marking sets never overlap, so every variant reads: outer spots on
the edge, the band across the outer forewing, inner spots on the forewing
base and the middle of the hind wing. The file authors the first variant's
albedos (adriatic-blue).

The code turns the wing pivots about the body axis (three.js local Z) to
flap and to fold the wings up at rest; the roots stay buried in the thorax
and the wing edges clear the head and abdomen at every extreme.
"""

import math

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

PREFIX = "Butterfly_"
SCALE = 0.10771717247127598  # butterflyActorScale in entities/butterflies/Butterflies.tsx
BUDGET = 2000  # small critter: 1,500 to 2,000
# The model this design replaced, at rest: width x, length y, height z.
REFERENCE = (1.98, 1.55, 0.379)
# Butterflies.unit.ts pins the rendered span at exactly 40% of the legacy
# butterfly, which is a model span of exactly 1.98.
HALF_SPAN = 0.99

M = {
    "body": "Material.Butterfly.Body",
    "warm": "Material.Butterfly.BodyWarm",
    "ink": "Material.Butterfly.Charcoal",
    "glint": "Material.Butterfly.EyeGlint",
    "fore": "Material.Butterfly.WingPrimary",
    "hind": "Material.Butterfly.WingSecondary",
    "edge": "Material.Butterfly.WingEdge",
    "band": "Material.Butterfly.WingBand",
    "spot": "Material.Butterfly.WingSpot",
}

# Wing colours are set per variant at runtime (by node name); the file
# carries the first variant's albedo, 'adriatic-blue', so it matches the game.
COLOURS = {
    M["body"]: ("#f5d896", 0.8),  # honey cream
    M["warm"]: ("#f09a38", 0.6),  # amber stripes and antenna balls
    M["ink"]: ("#5c4590", 0.35),
    M["glint"]: ("#fff4dc", 0.35),
    M["fore"]: ("#2c6698", 0.55, "albedo"),
    M["hind"]: ("#378377", 0.55, "albedo"),
    M["edge"]: ("#283e58", 0.55, "albedo"),
    M["band"]: ("#b6a580", 0.55, "albedo"),  # shows cream #f8e2b4 at noon, not near white
    M["spot"]: ("#b6a580", 0.55, "albedo"),
}

HEAD_C = Vector((0.0, -0.39, 0.352))
HEAD = dict(rx=0.28, ry=(0.24, 0.21), rz=(0.175, 0.18), ex=0.92, ey=0.95, ez=0.92, res=4)
THORAX_C = Vector((0.0, -0.07, 0.33))
THORAX = dict(rx=0.165, ry=(0.17, 0.16), rz=0.15, ex=0.92, ey=0.92, ez=0.92, res=3)
ABDOMEN_C = Vector((0.0, 0.29, 0.31))
ABDOMEN = dict(rx=0.145, ry=(0.26, 0.3), rz=0.13, ex=0.95, ey=(0.95, 0.8), ez=0.95, taper=-0.22)
# The abdomen is revolved about its long axis in rings (local y from its
# centre), so the two amber stripes are whole ring bands split off to
# AbdomenTip: the colours meet on shared vertices, with no decal to poke
# through. The first rings sit where the abdomen leaves the thorax.
ABDOMEN_RINGS = (-0.2, -0.14, -0.07, 0.03, 0.068, 0.105, 0.195, 0.25, 0.285)
STRIPES = ((-0.07, 0.03), (0.105, 0.195))
ABDOMEN_SEGMENTS = 12
EYE_H, EYE_W, GLINT = 0.22, 0.17, 0.09
TIP_R = 0.075
# Antenna, L side, from the head centre: root on the crown, the stalk rising
# up and out to an amber ball above and outside the eye, so the camera sees
# it clear of the face (GAME_ART: tune faces to the ~30-35 degree camera).
ANT_ROOT = (0.06, -0.1, 0.15)
ANT_MID = (0.12, -0.13, 0.21)
ANT_TIP = (0.24, -0.17, 0.22)

# Wings, L side (+X), absolute design-space XY; `centre` is the thickest
# point and `edge` the width of the edge colour, all round the outline.
FORE = dict(
    outline=[(0.04, -0.04), (0.2, -0.19), (0.4, -0.38), (0.48, -0.62), (0.58, -0.84), (0.75, -0.87),
             (0.9, -0.72), (0.99, -0.5), (0.96, -0.28), (0.8, -0.11), (0.55, -0.02), (0.3, 0.02),
             (0.12, 0.03)],
    centre=(0.62, -0.42), z=0.33, thickness=0.29, segments=18, edge=0.085)
HIND = dict(
    outline=[(0.06, -0.02), (0.25, -0.01), (0.5, -0.01), (0.68, 0.04), (0.81, 0.19), (0.82, 0.38),
             (0.72, 0.55), (0.56, 0.64), (0.42, 0.62), (0.3, 0.48), (0.22, 0.28), (0.13, 0.1)],
    centre=(0.5, 0.29), z=0.33, thickness=0.28, segments=16, edge=0.08)
CAP = 2.6  # superellipse profile: a flat cushion top rolling down to a round rim
# Wing roots thin toward the body, so the two wings folded up at rest (1.245
# rad each) clear each other above the thorax: half thickness at most
# ROOT_HALF + ROOT_SLOPE * (distance from the hinge).
ROOT_HALF, ROOT_SLOPE, HINGE_X = 0.035, 0.3, 0.045


def root_scale(x, h):
    t = max(0.0, ROOT_HALF + ROOT_SLOPE * max(0.0, abs(x) - HINGE_X)) / h
    return t / (1.0 + t ** 8) ** 0.125


# ------------------------------------------------------------------ wing lens
class Lens:
    """A closed cushion wing over a smooth outline (kit.slab's shape with its
    own rings), split into a middle and an edge-coloured outer band.

    The outline is smoothed through a closed Catmull-Rom and resampled to
    `segments` even points around `centre`, the thickest point. The height
    over the radial fraction f (0 at the centre, 1 on the outline) is a
    superellipse, so the top is flat and the rim round edge on. Top rings sit
    half way to the edge (so the dome stays close to the analytic surface
    and markings cast on it stay above it), `edge` in from the outline
    (where the edge colour starts, so the band is even all round) and at
    0.92, under the rim; two bottom rings round the underside.
    """

    EDGE_BANDS = (1, 2)  # the quad bands from the edge ring to the rim

    def __init__(self, kit, outline, centre, z, thickness, segments, edge, cap=CAP):
        self.c = Vector((centre[0], centre[1], z))
        rel = [Vector((p[0] - centre[0], p[1] - centre[1], 0.0)) for p in outline]
        pts = kit._resample_closed(kit._closed_catmull(rel, 4), segments)
        area = sum(pts[i].x * pts[(i + 1) % len(pts)].y - pts[(i + 1) % len(pts)].x * pts[i].y
                   for i in range(len(pts)))
        if area < 0:  # counter-clockwise seen from +Z
            pts.reverse()
        self.pts = [Vector((p.x, p.y)) for p in pts]
        self.n = len(pts)
        self.h = thickness / 2
        self.cap = cap
        self.edge = edge

    def g(self, f):
        f = min(max(f, 0.0), 1.0)
        return max(0.0, 1.0 - f ** self.cap) ** (1.0 / self.cap)

    def point(self, j, f, side):
        p = self.pts[j % self.n] * f
        x = self.c.x + p.x
        return Vector((x, self.c.y + p.y, self.c.z + side * self.h * self.g(f) * root_scale(x, self.h)))

    def at(self, theta, f):
        """2D point at angle `theta` (degrees, about the centre) and ring
        fraction f, on the resampled outline."""
        d = Vector((math.cos(math.radians(theta)), math.sin(math.radians(theta))))
        best = None
        for j in range(self.n):
            a, b = self.pts[j], self.pts[(j + 1) % self.n]
            e = b - a
            den = d.x * e.y - d.y * e.x
            if abs(den) < 1e-9:
                continue
            t = (a.x * e.y - a.y * e.x) / den  # distance along d
            s = (a.x * d.y - a.y * d.x) / den  # fraction along the segment
            if t > 0 and -1e-6 <= s <= 1 + 1e-6 and (best is None or t < best):
                best = t
        return (self.c.x + d.x * best * f, self.c.y + d.y * best * f)

    def at_inset(self, theta, inset):
        """2D point at angle `theta` (degrees), `inset` in from the outline."""
        x, y = self.at(theta, 1.0)
        r = math.hypot(x - self.c.x, y - self.c.y)
        return self.at(theta, 1.0 - inset / r)

    def inside(self, p):
        """How deep design-space point `p` lies inside the analytic lens
        (negative outside)."""
        d = Vector((p.x - self.c.x, p.y - self.c.y))
        if d.length < 1e-9:
            return self.h - abs(p.z - self.c.z)
        x, y = self.at(math.degrees(math.atan2(d.y, d.x)), 1.0)
        f = d.length / math.hypot(x - self.c.x, y - self.c.y)
        if f >= 1.0:
            return -(f - 1.0)
        return self.h * self.g(f) * root_scale(p.x, self.h) - abs(p.z - self.c.z)

    def build(self, part, material, edge_part, edge_material):
        """The middle and underside go to `part`, the outer top band to
        `edge_part`; both get their own copy of the shared boundary vertices,
        so the seam between the colours is exact."""
        verts = []

        def ring(fs, side):
            ids = []
            for j in range(self.n):
                ids.append(len(verts))
                verts.append(self.point(j, fs[j], side))
            return ids

        n = self.n
        edge = [1.0 - self.edge / self.pts[j].length for j in range(n)]
        top_pole = len(verts)
        verts.append(self.point(0, 0.0, 1))
        chain = [ring([0.5 * e for e in edge], 1), ring(edge, 1), ring([max(0.92, e + 0.06) for e in edge], 1),
                 ring([1.0] * n, 0), ring([0.95] * n, -1), ring([0.78] * n, -1)]
        bottom_pole = len(verts)
        verts.append(self.point(0, 0.0, -1))
        owner = []  # (face, to edge?)
        for j in range(n):
            owner.append(([top_pole, chain[0][j], chain[0][(j + 1) % n]], False))
        for band, (lower, upper) in enumerate(zip(chain, chain[1:])):
            for j in range(n):
                quad = [lower[j], upper[j], upper[(j + 1) % n], lower[(j + 1) % n]]
                owner.append((quad, band in self.EDGE_BANDS))
        for j in range(n):
            owner.append(([chain[-1][j], bottom_pole, chain[-1][(j + 1) % n]], False))
        a, b, c = (verts[i] for i in owner[0][0])
        flip = (b - a).cross(c - a).z < 0  # the top fan faces +Z
        for target, mat, edge in ((part, material, False), (edge_part, edge_material, True)):
            used = sorted({i for f, e in owner if e == edge for i in f})
            remap = {i: k for k, i in enumerate(used)}
            fs = [[remap[i] for i in (reversed(f) if flip else f)] for f, e in owner if e == edge]
            target.add([verts[i] for i in used], fs, mat)


def abdomen(body_part, body_material, stripe_part, stripe_material):
    """kit.blob's superellipsoid for ABDOMEN, parameterised in rings along
    its axis instead of a cube sphere: ring bands inside a STRIPES interval go
    to `stripe_part`, the rest (and both pole fans) to `body_part`; each part
    gets its own copy of the shared seam vertices."""
    a = ABDOMEN

    def spow(x, e):
        return math.copysign(abs(x) ** e, x)

    def ring(y):
        ry, ey = (a["ry"][0], a["ey"][0]) if y < 0 else (a["ry"][1], a["ey"][1])
        dy = spow(y / ry, 1.0 / ey)
        s = math.sqrt(max(0.0, 1.0 - dy * dy))
        out = []
        for j in range(ABDOMEN_SEGMENTS):
            t = 2 * math.pi * j / ABDOMEN_SEGMENTS
            x = spow(s * math.cos(t), a["ex"]) * a["rx"] * (1.0 + a["taper"] * dy)
            z = spow(s * math.sin(t), a["ez"]) * a["rz"]
            out.append(ABDOMEN_C + Vector((x, y, z)))
        return out

    verts, rings = [], []
    verts.append(ABDOMEN_C + Vector((0.0, -a["ry"][0], 0.0)))
    rings.append(([0], None))
    for y in ABDOMEN_RINGS:
        rings.append((list(range(len(verts), len(verts) + ABDOMEN_SEGMENTS)), y))
        verts.extend(ring(y))
    verts.append(ABDOMEN_C + Vector((0.0, a["ry"][1], 0.0)))
    rings.append(([len(verts) - 1], None))
    n = ABDOMEN_SEGMENTS
    owner = []
    for (lower, y0), (upper, y1) in zip(rings, rings[1:]):
        stripe = (y0 is not None and y1 is not None
                  and any(lo - 1e-9 <= y0 and y1 <= hi + 1e-9 for lo, hi in STRIPES))
        if len(lower) == 1:
            owner.extend(([lower[0], upper[(j + 1) % n], upper[j]], stripe) for j in range(n))
        elif len(upper) == 1:
            owner.extend(([lower[j], lower[(j + 1) % n], upper[0]], stripe) for j in range(n))
        else:
            owner.extend(([lower[j], lower[(j + 1) % n], upper[(j + 1) % n], upper[j]], stripe) for j in range(n))
    # outward: the first side quad faces away from the axis
    f = next(f for f, _ in owner if len(f) == 4)
    p, q, r = (verts[i] for i in f[:3])
    centre = sum((verts[i] for i in f), Vector()) / 4
    axis_point = Vector((ABDOMEN_C.x, centre.y, ABDOMEN_C.z))
    flip = (q - p).cross(r - p).dot(centre - axis_point) < 0
    for target, mat, stripe in ((body_part, body_material, False), (stripe_part, stripe_material, True)):
        used = sorted({i for f, s in owner if s == stripe for i in f})
        remap = {i: k for k, i in enumerate(used)}
        fs = [[remap[i] for i in (reversed(f) if flip else f)] for f, s in owner if s == stripe]
        target.add([verts[i] for i in used], fs, mat)


def spot_on(kit, part, material, surface, centre, z_top, radius, squash=1.0, height=0.012, rim=0.014,
            segments=10, rotate=0.0, outline=None, rings=((0.0, 1.0), (0.75, 0.75), (1.0, None))):
    """A marking cast straight down onto a wing (kit.pad, parallel); `rings`
    are (fraction, lift) pairs, more of them for a long band on the dome."""
    c = Vector((centre[0], centre[1], z_top))
    kit.pad(part, material, surface, c, c + Vector((0.0, 0.0, 1.0)), radius, radius * squash, height,
            u_hint=(1.0, 0.0, 0.0), rim=rim, segments=segments, rings=tuple(r for r, _ in rings),
            lift=tuple(v for _, v in rings),
            project="parallel", rotate=rotate, outline=outline)


def mirrored(kit, part, name):
    """The R side of an L part: x negated, winding reversed."""
    out = kit.Part(name)
    out.materials = list(part.materials)
    out.verts = [Vector((-v.x, v.y, v.z)) for v in part.verts]
    out.faces = [(list(reversed(f)), s) for f, s in part.faces]
    return out


def superellipse(n):
    return lambda a: (abs(math.cos(a)) ** n + abs(math.sin(a)) ** n) ** (-1.0 / n)


# ------------------------------------------------------------------ build
def build(kit, party_style):
    objects = list(bpy.data.objects)
    space = kit.design_space(objects)
    P = {o.name: kit.Part(o.name) for o in objects if o.type == "MESH"}

    # body: a round thorax that holds the wing roots and a short abdomen
    # tapering back, its two amber stripes split off to the AbdomenTip node
    kit.blob(P["Butterfly_Thorax"], M["body"], THORAX_C, **THORAX)
    abdomen(P["Butterfly_Abdomen"], M["body"], P["Butterfly_AbdomenTip"], M["warm"])
    for k, side in enumerate(("L1", "L2", "L3", "R1", "R2", "R3")):
        sx = 1.0 if side[0] == "L" else -1.0
        kit.hidden_nub(P[f"Butterfly_Leg_{side}"], M["ink"],
                       THORAX_C + Vector((sx * 0.06, -0.06 + 0.06 * (k % 3), -0.05)))

    # head: one big round form overlapping the thorax
    kit.blob(P["Butterfly_Head"], M["body"], HEAD_C, **HEAD)
    head = kit.Surface(P["Butterfly_Head"])

    for side, sx in (("L", 1.0), ("R", -1.0)):
        # tall eyes above the middle of the face, glint to the viewer's upper left
        kit.eye(P[f"Butterfly_Eye_{side}"], P[f"Butterfly_EyeGlint_{side}"], head,
                HEAD_C + Vector((sx * 0.03, 0.0, 0.0)), HEAD_C + Vector((sx * 0.155, -0.5, 0.08)),
                EYE_H, EYE_W, M["ink"], M["glint"], glint_size=GLINT, dome=0.012, segments=10)
        # antenna: an ink stalk that rises from the crown up and out to an
        # amber ball above and outside the eye; the ball stays within 0.33 of
        # the wing hinge, where the forewing (whose front edge sweeps forward
        # further out) never reaches it at any flap or fold angle
        root = HEAD_C + Vector((sx * ANT_ROOT[0], ANT_ROOT[1], ANT_ROOT[2]))
        tip = HEAD_C + Vector((sx * ANT_TIP[0], ANT_TIP[1], ANT_TIP[2]))
        stalk = [root, HEAD_C + Vector((sx * ANT_MID[0], ANT_MID[1], ANT_MID[2])), tip]
        curve, _ = kit.catmull_rom(stalk, samples=2)
        kit.tube(P[f"Butterfly_Antenna_{side}"], M["ink"], curve, [0.042] * len(curve), segments=6,
                 cap_rings=1, cap_start=False)
        kit.blob(P[f"Butterfly_AntennaTip_{side}"], M["warm"], tip, TIP_R, TIP_R, TIP_R, res=2)

    # wings, built on the L side and mirrored
    fore = Lens(kit, **FORE)
    hind = Lens(kit, **HIND)
    L = {k: kit.Part(f"Butterfly_{k}_L") for k in ("WingFore", "WingHind", "WingEdge", "WingBand",
                                                     "WingSpotOuter", "WingSpotInner")}
    fore.build(L["WingFore"], M["fore"], L["WingEdge"], M["edge"])
    hind.build(L["WingHind"], M["hind"], L["WingEdge"], M["edge"])
    whole = kit.Part()
    for key in ("WingFore", "WingHind", "WingEdge"):
        whole.extend(L[key])
    wing = kit.Surface(whole)
    above = fore.c.z + 0.5
    # outer spots along the margin, centred on the inner rim of the edge band:
    # two at the forewing tip, one on the hind wing
    for lens, theta in ((fore, -96.0), (fore, -36.0), (hind, 28.0)):
        spot_on(kit, L["WingSpotOuter"], M["spot"], wing, lens.at_inset(theta, lens.edge * 1.05), above,
                0.06, segments=10)  # 6 read as hexagons at close zoom
    # band across the outer forewing, inside the edge
    spot_on(kit, L["WingBand"], M["band"], wing, (0.66, -0.5), above, 0.2, squash=0.52,
            rotate=math.radians(37), segments=14, outline=superellipse(2.6),
            rings=((0.0, 1.0), (0.55, 1.0), (0.88, 0.75), (1.0, None)), height=0.022, rim=0.016)
    # inner spots: forewing base and the middle of the hind wing
    # (lifted 0.022 like the cow's patches: the domed cushion is coarser than a pad)
    for c, r in (((0.44, -0.29), 0.1), (hind.at(10.0, 0.05), 0.13)):
        spot_on(kit, L["WingSpotInner"], M["spot"], wing, c, above, r, height=0.022, rim=0.016, segments=12,
                rings=((0.0, 1.0), (0.6, 0.95), (1.0, None)))
    # the two lobes of a side meet on a seam: report how far each pokes into the other
    SEAM.clear()
    SEAM.append(max(fore.inside(v) for v in L["WingHind"].verts if v.x > THORAX["rx"]))
    SEAM.append(max(hind.inside(v) for v in L["WingFore"].verts if v.x > THORAX["rx"]))

    # the outermost point sits exactly at the pinned half span
    reach = max(v.x for part in L.values() for v in part.verts)
    k = HALF_SPAN / reach
    for part in L.values():
        for v in part.verts:
            v.x *= k
    for key, part in L.items():
        P[f"Butterfly_{key}_L"] = part
        P[f"Butterfly_{key}_R"] = mirrored(kit, part, f"Butterfly_{key}_R")

    kit.rebuild_all(P, space)
    kit.apply_colours(party_style, COLOURS)


# ------------------------------------------------------------------ checks
def _bvh(obj, dg):
    ev = obj.evaluated_get(dg)
    me = ev.to_mesh()
    verts = [ev.matrix_world @ v.co for v in me.vertices]
    polys = [tuple(p.vertices) for p in me.polygons]
    ev.to_mesh_clear()
    return verts, BVHTree.FromPolygons(verts, polys)


def _inside(bvh, v):
    """Parity of ray hits along a fixed odd direction: inside a closed mesh."""
    d = Vector((0.5773, 0.5774, 0.5775)).normalized()
    origin, hits = v.copy(), 0
    for _ in range(64):
        loc, _, _, _ = bvh.ray_cast(origin, d)
        if loc is None:
            break
        hits += 1
        origin = loc + d * 1e-5
    return hits % 2 == 1


def _union(names, dg):
    verts, polys = [], []
    for name in names:
        ev = bpy.data.objects[name].evaluated_get(dg)
        me = ev.to_mesh()
        base = len(verts)
        verts.extend(ev.matrix_world @ v.co for v in me.vertices)
        polys.extend(tuple(base + i for i in p.vertices) for p in me.polygons)
        ev.to_mesh_clear()
    return verts, BVHTree.FromPolygons(verts, polys)


def clash(pairs, hidden_in=("Butterfly_Thorax",)):
    """For each (a, b) (tuples of node names): how deep a's vertices reach
    into the closed mesh b, ignoring vertices buried in `hidden_in` (wing
    roots in the thorax)."""
    dg = bpy.context.evaluated_depsgraph_get()
    hide = [_union([h], dg)[1] for h in hidden_in]
    out = []
    for a, b in pairs:
        va, _ = _union(a, dg)
        _, bb = _union(b, dg)
        deepest = 0.0
        for v in va:
            if not _inside(bb, v) or any(_inside(h, v) for h in hide):
                continue
            deepest = max(deepest, bb.find_nearest(v)[3])
        out.append(deepest)
    return out


SEAM = []


def check(kit):
    kit.size_report(PREFIX, REFERENCE)
    if SEAM:
        print(f"CHECK wing seam: hind reaches {SEAM[0]:.3f} into the fore wing, fore {SEAM[1]:.3f} into the hind")
    kit.proportion_report("Butterfly_Thorax", ["Butterfly_Head"])
    kit.triangle_report(PREFIX, BUDGET)
    kit.thickness_report(PREFIX, SCALE)

    wings = [f"Butterfly_Wing{k}_{s}" for s in ("L", "R") for k in ("Fore", "Hind")]
    O = bpy.data.objects
    rest = {o.name: o.matrix_basis.copy() for o in O}

    def wing(amount):
        return {"Butterfly_WingPivot_L": (0.0, 0.0, -amount), "Butterfly_WingPivot_R": (0.0, 0.0, amount)}

    # Butterflies.tsx updateButterflyRig: resting 1.2 +- 0.045 with the body
    # pitched 0.12 and the head nodding +-0.08; flight flaps +-0.78..1.1 with
    # the body bobbing +-0.018; landing flap * 0.42 + 0.36.
    poses = {
        "rest": {},
        "resting 1.245 nod+": {**wing(1.245), "Butterfly_BodyPivot": {"rot": (0.12, 0.0, 0.0)},
                               "Butterfly_HeadPivot": (0.08, 0.0, 0.0)},
        "resting 1.155 nod-": {**wing(1.155), "Butterfly_BodyPivot": {"rot": (0.12, 0.0, 0.0)},
                               "Butterfly_HeadPivot": (-0.08, 0.0, 0.0)},
        "flap up 1.1": {**wing(1.1), "Butterfly_BodyPivot": {"rot": (-0.04, 0.0, 0.0), "pos": (0.0, 0.018, 0.0)}},
        "flap down 1.1": {**wing(-1.1), "Butterfly_BodyPivot": {"rot": (-0.04, 0.0, 0.0),
                                                                "pos": (0.0, -0.018, 0.0)}},
        "landing 0.82": wing(0.82),
        "landing -0.1": wing(-0.1),
    }
    # the flap sweeps through every angle in between
    for k in range(-11, 13, 2):
        poses[f"sweep {k / 10:+.1f}"] = wing(k / 10)
    wing_l = tuple(f"Butterfly_Wing{k}_L" for k in ("Fore", "Hind", "Edge"))
    wing_r = tuple(f"Butterfly_Wing{k}_R" for k in ("Fore", "Hind", "Edge"))
    antenna_l = ("Butterfly_Antenna_L", "Butterfly_AntennaTip_L")
    named = {"wingL": wing_l, "wingR": wing_r, "head": ("Butterfly_Head",),
             "abdomen": ("Butterfly_Abdomen", "Butterfly_AbdomenTip"), "antennaL": antenna_l}
    pairs = [("wingL", "head"), ("head", "wingL"), ("wingL", "abdomen"), ("abdomen", "wingL"),
             ("wingL", "wingR"), ("antennaL", "wingL"), ("wingL", "antennaL")]
    for label, offsets in poses.items():
        for o in O:
            o.matrix_basis = rest[o.name]
        kit.apply_pose(offsets)
        m = kit.pose_metrics("Butterfly_Thorax", "Butterfly_Head", wings, ["Butterfly_Abdomen"],
                             ["Butterfly_Abdomen"])
        depths = clash([(named[a], named[b]) for a, b in pairs])
        bad = [f"{a}>{b} {d:.3f}" for (a, b), d in zip(pairs, depths) if d > 0.004]
        print(f"POSE {label:20s} wing roots in thorax " + "/".join(f"{d:.2f}" for d in m["legs"])
              + f" head-in {m['head']:.3f} abdomen-in {m['tail'][0]:.3f}"
              + ("  CLASH " + ", ".join(bad) if bad else "  no clash"))
    for o in O:
        o.matrix_basis = rest[o.name]
    bpy.context.view_layer.update()
