"""Horse: a bright plush toy pony.

The horse is animated by GLB clips only (Horse_Idle, Horse_Graze,
Horse_Walk, Horse_Trot, Horse_Attentive, Horse_TailSwish; entities/horses/
Horse.tsx writes no node offsets), so it is designed in the Horse_Idle pose
(frame 1): Blender world, +Z up, facing -Y, its L nodes on +X. Horse_Root
is scaled (0.96, 0.83, 0.9) in Blender, so every length here is in world
(design) units. The entity draws the GLB unscaled, so 0.03 game units is
0.03 design units.

A short round barrel (length about 1.4 times its height) whose low belly
hides the knees, a thick neck that flows from the withers into the back of
the head under one soft crest of mane, a big long-faced head (narrower than
the body) with a peach muzzle, tall ink eyes high on the face with a glint,
blush on the cheeks, a cream blaze, leaf ears curled into a cup, a forelock
swept onto the forehead, chunky stubby legs on the two-segment pivots
standing in hoof pucks, and one soft plume of a tail that flicks back above
the hocks.

Unlike the cow and cat the horse keeps a visible neck: Horse_Mane rides on
Horse_NeckPivot, which Horse_Graze pitches 67 degrees, so the mane needs a
neck under it. The neck is one smooth sweep, as wide as the head where it
meets it and flaring into the withers, and its shading blends into head and
body (`blend_normals`), so head, neck and body read as one soft form. Graze
pitches the face down, so the eyes sit high on the face and the forelock,
blaze and ears carry the crown.

Smooth across seams: parts cut into several nodes (the tail slices) and
parts that meet another (neck into head and body, tail root into the rump,
pinto patches on the body) carry custom normals, so no slice or junction
shows a shading band.

Colours: the runtime tints Coat, CoatDark, Mane, Marking and Muzzle per coat
(`horseAppearanceVariants` in packages/js/src/entityAppearanceVariants, via
entities/horses/horseAppearance.ts) and raises their roughness to 0.82,
except the muzzle, which keeps the face kit's 0.45 gloss. The
file authors the bay coat's albedo itself, so the file matches the game.
There is no pink material: the blush lies on the Muzzle node in the muzzle
colour, like the cow's. The ears have no lining (nothing else moves with
the ear pivots that Horse_Attentive turns); they are cupped instead. The
pinto patches show in the coat colour on every coat but the pinto, so they
carry the body's normals and vanish into it. There is no smile: the
triangles went to smoother silhouettes.

Known exception, from the clip: Horse_Trot lifts all four hooves up to 0.06
at the top of its bounce (the clip raises the body pivot 0.04).
"""

import math

import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

PREFIX = "Horse_"
SCALE = 1.0  # Horse.tsx draws the GLB unscaled; Horse_Root carries the rig's scale
BUDGET = 3000
# The model this design replaced, in Horse_Idle: width x, length y, height z.
REFERENCE = (0.746, 1.989, 1.478)

M = {
    "coat": "Material.Horse.Coat",
    "coat2": "Material.Horse.CoatDark",
    "eye": "Material.Horse.Eye",
    "glint": "Material.Horse.EyeGlint",
    "hoof": "Material.Horse.Hoof",
    "mane": "Material.Horse.Mane",
    "mark": "Material.Horse.Marking",
    "muzzle": "Material.Horse.Muzzle",
}

# The bay coat (variant 0) as albedo: these must equal the bay entry of
# horseAppearanceVariants (horseAsset.unit.ts checks it). Tinted materials
# get roughness 0.82 at runtime, so the file authors the same.
BAY = {"coat": "#7e472c", "mane": "#693c2f", "mark": "#9d8f7b", "muzzle": "#a3775c"}
COLOURS = {
    M["coat"]: (BAY["coat"], 0.82, "albedo"),
    M["coat2"]: (BAY["coat"], 0.82, "albedo"),
    M["mane"]: (BAY["mane"], 0.82, "albedo"),
    M["mark"]: (BAY["mark"], 0.82, "albedo"),
    # the face kit's gloss; Horse.tsx keeps it (fur is raised to 0.82)
    M["muzzle"]: (BAY["muzzle"], 0.45, "albedo"),
    M["hoof"]: ("#8e6f80", 0.55),
    M["eye"]: ("#5c4590", 0.35),
    M["glint"]: ("#fff4dc", 0.35),
}

SIDES = (("L", 1.0), ("R", -1.0))  # the horse's L nodes are on +X
LEGS = ("FL", "FR", "RL", "RR")

# body: a short round barrel; its low belly hides the knee pivots (z 0.387)
BODY_C = Vector((0.0, 0.0, 0.64))
BODY = dict(rx=0.355, ry=(0.49, 0.51), rz=(0.39, 0.33), ex=0.9, ey=(0.78, 0.8), ez=(0.62, 0.9), res=(5, 7, 5),
            taper={"y": ("x", 0.06)})
# head: one long soft form from the round cranium down to the snout
CRANIUM = Vector((0.0, -0.72, 1.15))
SNOUT = Vector((0.0, -1.05, 0.9))
HEAD = dict(rx=0.32, rz=(0.315, 0.325), ex=0.92, ey=0.9, ez=0.92, res=6)
HEAD_BACK = 0.25  # behind the cranium centre; the neck fills the rest
MUZZLE = dict(rx=0.228, rz=0.18, ry=(0.2, 0.165), power=0.95)  # 72% of the head width
EYE_X, EYE_UP = 0.175, 0.075  # from the cranium centre
EYE_H, EYE_W = 0.19, 0.135  # about 31% of the head height
GLINT = 0.06
# neck: control points (y, z) from inside the withers into the back of the
# head, with (side, depth) radii
NECK = [((-0.373, 0.972), (0.235, 0.25)), ((-0.47, 1.06), (0.24, 0.255)), ((-0.55, 1.12), (0.26, 0.255)),
        ((-0.61, 1.17), (0.285, 0.26))]
NECK_SEGMENTS = 18
# legs: a thigh from the hip into the knee dome, a round lower leg on the
# knee pivot standing in a hoof puck
LEG_INWARD = 0.07
THIGH_R = (0.075, 0.083)  # at the hip and at the knee (inside the knee dome)
HIP_INWARD = 0.1  # the thigh's top ring sits deeper in the body than the knee
KNEE_R = 0.088  # the lower leg's top dome, centred on the knee pivot
LEG_R = 0.095  # the lower leg at the hoof
HOOF_R, HOOF_H = 0.128, 0.13
HOOF_SEGMENTS = 12
HOOF_RINGS = (8, 16, 16, 14, HOOF_SEGMENTS)  # `hoof_profile` without its sole pole
SOCK_TOP = 0.25  # above the ground
TAIL_SQUASH = 1.0  # side-to-side width over front-to-back depth


def axis_frame(origin, along, up=(0.0, 0.0, 1.0)):
    """Frame at `origin` with local +Y along `along` and +Z toward `up`
    (local X completes a right-handed frame)."""
    y = Vector(along).normalized()
    z = Vector(up) - y * Vector(up).dot(y)
    z.normalize()
    x = y.cross(z)
    return Matrix(((x.x, y.x, z.x, origin[0]), (x.y, y.y, z.y, origin[1]), (x.z, y.z, z.z, origin[2]),
                   (0.0, 0.0, 0.0, 1.0)))


def rounded_rect(n=3.0, taper=0.0):
    """`pad` outline factor for a rounded rectangle (superellipse exponent
    `n`), `taper` narrower toward -u."""
    def outline(a):
        c, s = abs(math.cos(a)), abs(math.sin(a))
        return (1.0 + taper * math.cos(a)) / max(1e-6, c ** n + s ** n) ** (1.0 / n)
    return outline


# ------------------------------------------------------------------ normals
def _design_verts(obj, space):
    matrix = space[obj.name]
    return [matrix @ v.co for v in obj.data.vertices]


def _set_normals(obj, space, normals):
    """Custom normals from design-space normals, one per vertex."""
    to_local = space[obj.name].to_3x3().transposed()  # normals: inverse transpose of local-to-design
    obj.data.normals_split_custom_set_from_vertices([(to_local @ n).normalized() for n in normals])


def _own_normals(obj, space):
    to_design = space[obj.name].to_3x3().inverted().transposed()
    return [(to_design @ v.normal).normalized() for v in obj.data.vertices]


def adopt_normals(obj, surface, space):
    """Give a decal node the smooth normals of the surface it lies on.

    A raised decal in the same colour as its body (pinto patches on every
    other coat) still shows its outline through shading; with the body's
    normals it shades exactly like the body, while a coloured patch keeps a
    crisp painted edge.
    """
    _set_normals(obj, space, [surface.nearest(p)[1] for p in _design_verts(obj, space)])


def shared_normals(objs, source, space, tolerance=1e-5):
    """Normals of one continuous `source` part on the nodes cut from it.

    The slices of a tail each compute their normals from their own faces, so
    where two slices meet on a shared ring the shading jumps (a band at every
    pivot). Every vertex that lies on the continuous source takes the
    source's smooth normal; the rest (caps hidden inside the next slice) keep
    their own.
    """
    surface = source if hasattr(source, "normals") else None
    tree = KDTree(len(surface.verts))
    for i, v in enumerate(surface.verts):
        tree.insert(v, i)
    tree.balance()
    for obj in objs:
        own = _own_normals(obj, space)
        out = []
        for p, n in zip(_design_verts(obj, space), own):
            _, index, dist = tree.find(p)
            out.append(surface.normals[index] if dist < tolerance else n)
        _set_normals(obj, space, out)


def blend_normals(obj, space, targets, normals=None):
    """Blend a part's normals toward the parts it runs into.

    `targets` is [(Surface, width)]: within `width` of that surface a vertex
    turns its normal toward the surface's, fully at the surface. Where the
    neck runs into the head and body, both sides then shade alike, so the
    junction reads as one soft form instead of a crease line.
    """
    normals = list(normals) if normals is not None else _own_normals(obj, space)
    for i, p in enumerate(_design_verts(obj, space)):
        n = normals[i]
        for surface, width in targets:
            hit, normal = surface.nearest(p)
            w = 1.0 - _smooth(0.0, width, (p - hit).length)
            if w > 0.0:
                n = n.lerp(normal, w).normalized()
        normals[i] = n
    _set_normals(obj, space, normals)


def _smooth(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ parts
def _merged(kit, *parts):
    out = kit.Part()
    for part in parts:
        out.extend(part)
    return out


def crest(kit, part, material, surface, core, path, widths, heights, segments=10, spread=3.8, power=0.8,
          samples=2, away=None):
    """A soft ridge lying on `surface` along `path` (mane, forelock).

    Each section is an arch `widths[i]` wide either side and `heights[i]`
    tall above the surface, a superellipse (`power`) that rolls down past
    the surface on both sides (`spread` radians of arch), so its open
    underside is buried. The ends close with a fan. Every vertex is
    visible ridge: twice the resolution of a round tube for the same cost.
    The path lands on the surface along the ray from `core`, or, with
    `away`, straight down from outside (the outermost of merged shapes).
    """
    pts = [Vector(p) for p in path]
    curve, _ = kit.catmull_rom(pts, samples=samples)
    widths = kit.lerp_radii(widths, len(curve))
    heights = kit.lerp_radii(heights, len(curve))
    centres, normals = [], []
    for p in curve:
        if away is None:
            hit, normal = surface.project(core, p)
        else:
            hit, normal = surface.hit(p + Vector(away) * 0.6, -Vector(away))
            if hit is None:
                hit, normal = surface.nearest(p)
        centres.append(hit)
        normals.append(normal)
    n = len(centres) - 1
    verts, rows = [], []
    for i, c in enumerate(centres):
        t = (centres[min(n, i + 1)] - centres[max(0, i - 1)]).normalized()
        b = t.cross(normals[i]).normalized()
        up = b.cross(t).normalized()
        row = []
        for j in range(segments + 1):
            a = -spread / 2 + spread * j / segments
            sa, ca = math.sin(a), math.cos(a)
            lateral = math.copysign(abs(sa) ** power, sa) * widths[i]
            vertical = math.copysign(abs(ca) ** power, ca) * heights[i]
            row.append(len(verts))
            verts.append(c + b * lateral + up * vertical)
        rows.append((row, t, up))
    faces = []
    for (lo, _, _), (hi, _, _) in zip(rows, rows[1:]):
        faces.extend([lo[j], hi[j], hi[j + 1], lo[j + 1]] for j in range(segments))
    for end, sign in ((0, -1.0), (n, 1.0)):
        row, t, up = rows[end]
        pole = len(verts)
        verts.append(centres[end] + t * (sign * min(widths[end], heights[end]) * 0.6) + up * heights[end] * 0.2)
        fan = [[row[j], row[j + 1], pole] for j in range(segments)]
        faces.extend(fan if sign < 0 else [f[::-1] for f in fan])
    # orient outward: the first quad's normal points away from the path
    a, b, c = (verts[k] for k in faces[0][:3])
    centre = sum((verts[k] for k in faces[0]), Vector()) / 4
    if (b - a).cross(c - a).dot(centre - centres[0]) < 0:
        faces = [f[::-1] for f in faces]
    return part.add(verts, faces, material)


def sweep_neck(kit, part, material, points, radii, segments=16, cap_rings=(3, 2), samples=1):
    """One smooth neck: an elliptical section (side, depth radii) swept
    through `points`, with round ends of `cap_rings` (start, end) rings.
    The start is round in the pitch plane and centred on the first point
    (the neck pivot), so pitching the neck to graze leaves it in place."""
    curve, _ = kit.catmull_rom([Vector(p) for p in points], samples=samples)
    n = len(curve) - 1
    side = kit.lerp_radii([r[0] for r in radii], len(curve))
    depth = kit.lerp_radii([r[1] for r in radii], len(curve))
    tangents = [(curve[min(n, i + 1)] - curve[max(0, i - 1)]).normalized() for i in range(len(curve))]
    verts, rings = [], []

    def ring(centre, t, rs, rd):
        x = Vector((1.0, 0.0, 0.0))
        d = t.cross(x).normalized()  # in the YZ plane, across the neck
        ids = []
        for j in range(segments):
            a = 2 * math.pi * j / segments
            ids.append(len(verts))
            verts.append(centre + x * (rs * math.cos(a)) + d * (rd * math.sin(a)))
        return ids

    def cap(centre, t, rs, rd, sign, rings):  # round in the pitch plane
        out = []
        for k in range(1, rings):
            a = math.pi / 2 * k / rings
            out.append(ring(centre + t * (sign * rd * math.sin(a)), t, rs * math.cos(a), rd * math.cos(a)))
        verts.append(centre + t * (sign * rd))
        out.append([len(verts) - 1])
        return out

    start = cap(curve[0], tangents[0], side[0], depth[0], -1.0, cap_rings[0])[::-1]
    body = [ring(c, tangents[i], side[i], depth[i]) for i, c in enumerate(curve)]
    end = cap(curve[-1], tangents[-1], side[-1], depth[-1], 1.0, cap_rings[1])
    faces = []
    chain = start + body + end
    for lower, upper in zip(chain, chain[1:]):
        if len(lower) == 1:
            faces.extend([lower[0], upper[(j + 1) % segments], upper[j]] for j in range(segments))
        elif len(upper) == 1:
            faces.extend([lower[j], lower[(j + 1) % segments], upper[0]] for j in range(segments))
        else:
            faces.extend([lower[j], lower[(j + 1) % segments], upper[(j + 1) % segments], upper[j]]
                         for j in range(segments))
    return part.add(verts, kit._orient_outward(verts, faces, curve), material), curve


def _catmull(points, samples):
    """Catmull-Rom through `points` with `samples[i]` steps on span i.
    Returns (curve, index of each control point, u) where u runs 0..1 over
    the control points (each span the same share)."""
    pts = [Vector(p) for p in points]
    ext = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    out, index, u = [], [], []
    spans = len(pts) - 1
    for i in range(spans):
        p0, p1, p2, p3 = ext[i], ext[i + 1], ext[i + 2], ext[i + 3]
        index.append(len(out))
        for k in range(samples[i]):
            t = k / samples[i]
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t))
            u.append((i + t) / spans)
    index.append(len(out))
    out.append(pts[-1])
    u.append(1.0)
    return out, index, u


def _orient_by_vote(part, first_face, path):
    """Point the faces from `first_face` on away from `path` by majority.
    The kit orients a sweep by its first quad alone, which a short, fat
    slice can get wrong (its nearest path point is then another ring's)."""
    votes = 0
    for face, _ in part.faces[first_face:]:
        if len(face) != 4:
            continue
        a, b, c = (part.verts[i] for i in face[:3])
        centre = sum((part.verts[i] for i in face), Vector()) / 4
        nearest = min(path, key=lambda p: (p - centre).length)
        votes += 1 if (b - a).cross(c - a).dot(centre - nearest) > 0 else -1
    if votes < 0:
        part.faces[first_face:] = [(face[::-1], slot) for face, slot in part.faces[first_face:]]


def plume(kit, controls, radius, slices, samples, segments=10, end_rings=3, joint_rings=2, squash=1.0):
    """One soft tail through its pivots, cut into one tube per pivot node.

    Like `kit.sliced_tail` (rings shared at the pivots, a hemisphere centred
    on each pivot closing the proximal slice so a bend never opens), but the
    root is open and buried (the first control point is inside the body),
    the hidden joint caps are cheaper than the visible round tip, and it
    returns the continuous tube the slices were cut from, for
    `shared_normals`. `controls` are the buried root, the pivots, then any
    points of the last slice, with `samples[i]` steps on span i; `radius(u)`
    gives the radius, u running 0..1 over the control points.
    """
    curve, index, u = _catmull(controls, samples)
    index = index[1:]  # the root is not a pivot
    n = len(curve) - 1
    radii = [radius(x) for x in u]
    tangents = [(curve[min(n, i + 1)] - curve[max(0, i - 1)]).normalized() for i in range(len(curve))]
    normals = kit._transport_normals(curve, tangents, (0.0, 0.0, 1.0))
    starts = [0] + index[1:len(slices)]
    ends = index[1:len(slices)] + [n]
    for k, ((part, material), a, b) in enumerate(zip(slices, starts, ends)):
        last = k == len(slices) - 1
        first_face = len(part.faces)
        kit._sweep(part, material, curve[a:b + 1], tangents[a:b + 1], normals[a:b + 1], radii[a:b + 1], segments,
                   end_rings if last else joint_rings, cap_start=False, cap_end=True, squash=squash)
        _orient_by_vote(part, first_face, curve[a:b + 1])
    whole = kit.Part("tail")
    kit._sweep(whole, slices[0][1], curve, tangents, normals, radii, segments, end_rings, cap_start=False,
               cap_end=True, squash=squash)
    return whole


def bean(kit, part, material, origin, axis, up, rx, rz, ry, power=0.95, segments=20, lats=(-45, 0, 30, 55, 75)):
    """A soft bean around `axis` (muzzles): sections `rx` (side) by `rz`
    (toward `up`), `ry` (back, front) along the axis, a superellipse profile
    (`power`). It starts open at the first latitude, buried in the head, so
    every ring goes to the visible front and its outline: 20 segments round
    the snout for fewer triangles than a cube sphere's 16."""
    frame = kit.frame_from(origin, axis, up)
    profile = []
    for lat in lats:
        a = math.radians(lat)
        r = abs(math.cos(a)) ** power
        z = math.copysign(abs(math.sin(a)) ** power, a) * (ry[1] if a > 0 else ry[0])
        profile.append((rx * r, z))
    profile.append((0.0, ry[1]))
    return kit.lathe(part, material, frame, profile, segments, scale_xy=(1.0, rz / rx))


def thigh(kit, part, material, hip, knee, inward, hip_inward, r_hip, r_knee, segments=10):
    """The upper half of a two-segment leg: an open frustum from a ring on
    the hip pivot (inside the body) to a ring on the knee pivot, smaller
    than the lower leg's knee dome, so both ends stay buried in every pose
    and the knee reads as one round ball joint."""
    p0 = kit.node_frame(hip) @ Vector((hip_inward, 0.0, 0.0))
    p1 = kit.node_frame(knee) @ Vector((inward, 0.0, 0.0))
    axis = p0 - p1
    y_hint = kit.node_frame(hip).to_3x3() @ Vector((0.0, 1.0, 0.0))
    return kit.lathe(part, material, kit.frame_from(p1, axis, y_hint), [(r_knee, 0.0), (r_hip, axis.length)],
                     segments)


def lower_leg(kit, part, material, knee, inward, kz, segments=10, dome=(40,)):
    """The lower half of a two-segment leg in the knee pivot's frame: an
    open frustum from inside the hoof up to a round dome centred on the
    knee pivot (the ball joint the thigh runs into)."""
    bottom = HOOF_H - 0.03
    profile = [(LEG_R, bottom), (KNEE_R, kz)]
    profile += [(KNEE_R * math.cos(math.radians(a)), kz + KNEE_R * math.sin(math.radians(a))) for a in dome]
    profile.append((0.0, kz + KNEE_R))
    kit.lathe(part, material, kit._leg_frame(knee, inward, -kz), profile, segments)

    def radius_at(h):  # the lower leg's radius h above the sole
        t = min(1.0, max(0.0, (h - bottom) / (kz - bottom)))
        return LEG_R + (KNEE_R - LEG_R) * t
    return radius_at


def sock(kit, part, material, pivot, inward, sole_z, bottom, top, radius_at, lift=0.013, tuck=0.008, segments=10):
    """A white sock: an open band around the lower leg from inside the hoof
    top up to `top` (heights above the sole), lifted `lift` off the leg with
    a rolled top edge that ends `tuck` under the leg surface."""
    profile = [
        (radius_at(bottom) + lift, bottom - 0.012),
        (radius_at(top) + lift, top - 0.014),
        (radius_at(top) + lift * 0.45, top - 0.003),
        (radius_at(top) - tuck, top + 0.006),
    ]
    return kit.lathe(part, material, kit._leg_frame(pivot, inward, sole_z), profile, segments)


# ------------------------------------------------------------------ build
def build(kit, party_style):
    objects = list(bpy.data.objects)
    space = kit.clip_pose_space(objects, "Horse_Idle", 1)

    def P(name):
        return space[name].translation.copy()

    parts = {o.name: kit.Part(o.name) for o in objects if o.type == "MESH"}

    # body: one soft barrel, the belly flat and low, the rump a little fuller
    kit.blob(parts["Horse_Body"], M["coat"], BODY_C, **BODY)
    body = kit.Surface(parts["Horse_Body"])
    for name, offset in (("Horse_Belly", (0.0, 0.0, -0.1)), ("Horse_Chest", (0.0, -0.25, 0.0)),
                         ("Horse_Haunch", (0.0, 0.25, 0.0))):
        kit.hidden_nub(parts[name], M["coat2"], BODY_C + Vector(offset), 0.05)

    # pinto patches: two bold shapes that wrap over the back. The runtime
    # shows them in the coat colour on every coat but the pinto, so they
    # take the body's normals (see `adopt_normals`) and vanish into it.
    core = BODY_C + Vector((0.0, 0.0, -0.05))
    kit.decal(parts["Horse_PintoPatch_L"], M["mark"], body, core + Vector((0.0, -0.12, 0.0)), (0.6, -0.3, 0.8),
              0.56, harmonics=((2, 0.12, 0.5), (3, 0.06, 1.7)), squash=(1.0, 1.1), up=(0, 1, 0), rings=3, segments=18,
              inner_segments=12, lift=0.016, tuck=0.014)
    kit.decal(parts["Horse_PintoPatch_R"], M["mark"], body, core + Vector((0.0, 0.15, 0.0)), (-0.6, 0.4, 0.75),
              0.52, harmonics=((2, 0.13, 1.2), (3, 0.06, 0.3)), squash=(1.0, 1.1), up=(0, 1, 0), rings=3,
              segments=18, inner_segments=12, lift=0.016, tuck=0.014)

    # legs: a thigh from the hip into the knee dome inside the belly, a round
    # lower leg on the knee pivot standing in a hoof puck
    for side in LEGS:
        hip, knee = space[f"Horse_LegPivot_{side}"], space[f"Horse_KneePivot_{side}"]
        local_x = hip.to_3x3().normalized() @ Vector((1.0, 0.0, 0.0))
        inward = Vector((-LEG_INWARD if hip.translation.x > 0 else LEG_INWARD, 0.0, 0.0)).dot(local_x)
        thigh(kit, parts[f"Horse_UpperLeg_{side}"], M["coat2"], hip, knee, inward, inward * HIP_INWARD / LEG_INWARD,
              *THIGH_R)
        kz = knee.translation.z
        radius_at = lower_leg(kit, parts[f"Horse_LowerLeg_{side}"], M["coat2"], knee, inward, kz)
        # the hoof wall and rim are silhouettes: 16 segments, stepping down to
        # a 12-segment top ring inside the 10-sided leg's flats so the two
        # never zig-zag; the sole is never seen, so it stays open
        top = radius_at(HOOF_H) * math.cos(math.pi / 10)
        hoof = kit.hoof_profile(HOOF_R, HOOF_H, top)[1:]
        kit.pivot_foot_rings(parts[f"Horse_Hoof_{side}"], M["hoof"], knee, inward, -kz, hoof, HOOF_RINGS)
        if f"Horse_Sock_{side}" in parts:
            sock(kit, parts[f"Horse_Sock_{side}"], M["mark"], knee, inward, -kz, HOOF_H, SOCK_TOP, radius_at)

    # head: one long soft form, round at the cranium, narrowing down the
    # snout; local +Y runs from the cranium toward the snout
    along = (SNOUT - CRANIUM).normalized()
    hf = axis_frame(CRANIUM, along, (0.0, -0.2, 1.0))
    face_up = hf.to_3x3() @ Vector((0.0, 0.0, 1.0))
    reach = (SNOUT - CRANIUM).length

    def snout(p, d):
        t = kit.smoothstep(-0.1, 1.0, d.y)
        p.x *= 1.0 - 0.3 * t
        p.z *= 1.0 - 0.3 * t
        return p

    kit.blob(parts["Horse_Head"], M["coat"], None, ry=(HEAD_BACK, reach + 0.04), frame=hf, deform=snout, **HEAD)
    head = kit.Surface(parts["Horse_Head"])

    # neck: one smooth sweep from inside the withers into the back of the
    # head, as wide as the head where it meets it
    neck_pts = [Vector((0.0, y, z)) for (y, z), _ in NECK]
    _, neck_curve = sweep_neck(kit, parts["Horse_Neck"], M["coat"], neck_pts, [r for _, r in NECK],
                               segments=NECK_SEGMENTS)
    neck = kit.Surface(parts["Horse_Neck"])

    # muzzle: a wide soft peach bean over the end of the snout; the blush
    # pads share its node and colour
    muzzle_c = SNOUT.copy()
    bean(kit, parts["Horse_Muzzle"], M["muzzle"], muzzle_c, along, face_up, **MUZZLE)
    muzzle = kit.Surface(parts["Horse_Muzzle"])
    for side, sx in SIDES:
        kit.blush(parts["Horse_Muzzle"], M["muzzle"], head, CRANIUM + Vector((sx * 0.05, 0.0, 0.0)),
                  CRANIUM + Vector((sx * 0.42, -0.45, -0.2)), 0.095, 0.135, segments=10)

    # nostrils high on the front of the muzzle, where the camera sees them
    for side, sx in SIDES:
        kit.pad(parts[f"Horse_Nostril_{side}"], M["eye"], muzzle,
                muzzle_c + along * 0.2 + face_up * 0.27 + Vector((sx * 0.125, 0.0, 0.0)), muzzle_c,
                0.05, 0.03, 0.008, u_hint=face_up, rim=0.008, segments=8, rings=(0.0, 0.7, 1.0),
                lift=(1.0, 0.8, None), rotate=sx * 0.45)

    # eyes: tall ink ovals high on the face, glint at the upper left
    for side, sx in SIDES:
        kit.eye(parts[f"Horse_Eye_{side}"], parts[f"Horse_EyeGlint_{side}"], head,
                CRANIUM + Vector((sx * 0.05, 0.0, 0.0)), CRANIUM + Vector((sx * EYE_X, -0.6, EYE_UP)),
                EYE_H, EYE_W, M["eye"], M["glint"], glint_size=GLINT, dome=0.02, segments=14)

    # blaze: a broad cream stripe down the nose, from under the forelock to
    # the muzzle
    blaze_c = CRANIUM + along * 0.18 + face_up * 0.27
    kit.pad(parts["Horse_Blaze"], M["mark"], head, blaze_c, CRANIUM + along * 0.12, 0.22, 0.068, 0.01,
            u_hint=-along, rim=0.012, segments=12, rings=(0.0, 0.6, 0.9, 1.0), lift=(1.0, 0.95, 0.5, None),
            outline=rounded_rect(2.6, 0.08))

    # ears: leaf-shaped pillows standing up from the crown, curled into a
    # soft cup that faces forward; the root is buried at the ear pivot
    for side, sx in SIDES:
        root = P(f"Horse_EarPivot_{side}") + Vector((sx * 0.02, -0.02, 0.07))
        axis = Vector((sx * 0.35, -0.08, 1.0)).normalized()
        length, width = 0.3, 0.17
        frame = axis_frame(root + axis * (length / 2), axis, (0.0, -1.0, 0.35))
        leaf = [(0.0, 0.5), (0.3, 0.3), (0.5, 0.0), (0.46, -0.3), (0.22, -0.5), (-0.22, -0.5), (-0.46, -0.3),
                (-0.5, 0.0), (-0.3, 0.3)]
        ids = kit.slab(parts[f"Horse_Ear_{side}"], M["coat2"], frame, [(x * width, y * length) for x, y in leaf], 0.075,
                       segments=16, rings=(0.7,))
        inverse = frame.inverted()
        ear = parts[f"Horse_Ear_{side}"]
        for i in ids:  # curl the sides forward: a cupped ear
            q = inverse @ ear.verts[i]
            q.z += 0.045 * (q.x / (width * 0.5)) ** 2 * kit.smoothstep(-0.5 * length, 0.0, q.y)
            ear.verts[i] = frame @ q

    # forelock: one soft swoop from between the ears onto the forehead,
    # curling a little to one side
    fl = [CRANIUM + Vector((0.0, 0.04, 0.3)), CRANIUM + Vector((0.0, -0.1, 0.3)),
          CRANIUM + Vector((-0.03, -0.2, 0.25)), CRANIUM + Vector((-0.06, -0.26, 0.19))]
    crest(kit, parts["Horse_Forelock"], M["mane"], head, CRANIUM, fl, [0.075, 0.08, 0.065, 0.03],
          [0.06, 0.065, 0.05, 0.025], segments=5, samples=2)

    # mane: one chunky soft crest from the poll down the back of the neck
    # into the withers, laid on the outer surface of head, neck and body
    back = Vector((0.0, 0.75, 0.66)).normalized()
    crest_pts = [CRANIUM + Vector((0.0, 0.12, 0.29))]
    crest_pts += [neck_curve[i] + back * 0.2 for i in (len(neck_curve) * 3 // 4, len(neck_curve) // 2,
                                                        len(neck_curve) // 4)]
    crest_pts.append(Vector((0.0, -0.21, 0.99)))
    mane_surface = kit.Surface(_merged(kit, parts["Horse_Neck"], parts["Horse_Head"], parts["Horse_Body"]))
    crest(kit, parts["Horse_Mane"], M["mane"], mane_surface, neck_curve[len(neck_curve) // 2], crest_pts,
          [0.07, 0.09, 0.095, 0.08, 0.035], [0.07, 0.12, 0.125, 0.1, 0.025], segments=8, samples=2,
          away=(0.0, 0.6, 0.8))

    # tail: one soft teardrop plume from inside the rump through the three
    # pivots: a slim dock, full in the middle, a round end above the hocks
    tb, tm, tt = P("Horse_TailPivot_Base"), P("Horse_TailPivot_Mid"), P("Horse_TailPivot_Tip")
    end = tt + (tt - tm).normalized() * 0.035

    def tail_radius(u):
        return 0.062 + 0.058 * kit.smoothstep(0.15, 0.55, u) - 0.045 * kit.smoothstep(0.55, 0.85, u)

    tail = plume(kit, [Vector((0.0, 0.38, 0.86)), tb, tm, tt, end], tail_radius,
                 [(parts["Horse_Tail_Base"], M["mane"]), (parts["Horse_Tail_Mid"], M["mane"]),
                  (parts["Horse_Tail_Tip"], M["mane"])], samples=(1, 2, 2, 2), segments=10, end_rings=3,
                 joint_rings=2, squash=TAIL_SQUASH)

    kit.rebuild_all(parts, space)
    O = bpy.data.objects
    for name in ("Horse_PintoPatch_L", "Horse_PintoPatch_R"):
        adopt_normals(O[name], body, space)
    shared_normals([O["Horse_Tail_Base"], O["Horse_Tail_Mid"], O["Horse_Tail_Tip"]], kit.Surface(tail), space)
    blend_normals(O["Horse_Neck"], space, [(head, 0.06)])
    kit.apply_colours(party_style, COLOURS)


# ------------------------------------------------------------------ checks
def _world_tree(name, steps=1):
    """World vertices (with `steps` > 1 also points along every edge, so a
    long face with no inner vertices is still sampled) and a BVH tree."""
    dg = bpy.context.evaluated_depsgraph_get()
    ob = bpy.data.objects[name].evaluated_get(dg)
    me = ob.to_mesh()
    verts = [ob.matrix_world @ v.co for v in me.vertices]
    polys = [tuple(p.vertices) for p in me.polygons]
    samples = list(verts)
    for e in me.edges if steps > 1 else ():
        a, b = verts[e.vertices[0]], verts[e.vertices[1]]
        samples.extend(a.lerp(b, k / steps) for k in range(1, steps))
    ob.to_mesh_clear()
    return samples, BVHTree.FromPolygons(verts, polys)


def _outside(tree, point):
    loc, normal, _, dist = tree.find_nearest(point)
    return dist if (point - loc).dot(normal) > 0 else -dist


def exposure_report(rest_knee, samples=12):
    """How far the thighs poke out of body and lower leg, and how low the
    tail hangs against the hind knees, in every clip at `samples` frames.

    A thigh vertex outside both reads as a shard (the old 6-sided thighs);
    the limit is 0.01. The surface between the vertices (sampled along every
    edge) shows where the round thigh itself is in view: at the swing
    extremes of Walk and Trot the knee ball leaves the belly and a short
    round thigh, as wide as the knee, joins it to the body."""
    scene = bpy.context.scene
    objs = list(bpy.data.objects)
    rest = {o.name: (o.location.copy(), o.rotation_euler.copy(), o.rotation_quaternion.copy(), o.scale.copy())
            for o in objs}
    mutes = {(o.name, t.name): t.mute for o in objs if o.animation_data for t in o.animation_data.nla_tracks}
    tracks = sorted({t.name for o in objs if o.animation_data for t in o.animation_data.nla_tracks})
    worst_vertex, worst_surface, worst_tail = 0.0, 0.0, 9.0
    for track in tracks:
        for o in objs:
            if o.animation_data:
                for t in o.animation_data.nla_tracks:
                    t.mute = t.name != track
        end = max(int(s.frame_end) for o in objs if o.animation_data for t in o.animation_data.nla_tracks
                  if t.name == track for s in t.strips)
        for f in sorted({1 + round((end - 1) * k / (samples - 1)) for k in range(samples)}):
            for o in objs:
                o.location, o.rotation_euler, o.rotation_quaternion, o.scale = rest[o.name]
            scene.frame_set(f)
            _, body = _world_tree("Horse_Body")
            vertex, surface = [], []
            for s in LEGS:
                corners, _ = _world_tree(f"Horse_UpperLeg_{s}")
                points, _ = _world_tree(f"Horse_UpperLeg_{s}", steps=12)
                _, lower = _world_tree(f"Horse_LowerLeg_{s}")
                vertex.append(max(0.0, max(min(_outside(body, v), _outside(lower, v)) for v in corners)))
                surface.append(max(0.0, max(min(_outside(body, v), _outside(lower, v)) for v in points)))
            tail = min(v.z for n in ("Horse_Tail_Base", "Horse_Tail_Mid", "Horse_Tail_Tip")
                       for v in _world_tree(n)[0])
            knee = rest_knee
            worst_vertex, worst_surface = max(worst_vertex, max(vertex)), max(worst_surface, max(surface))
            if track != "Horse_Graze":  # grazing lowers the whole body
                worst_tail = min(worst_tail, tail - knee)
            flag = "  <-- THIGH SHARD" if max(vertex) > 0.01 else ""
            print(f"EXPOSE {track:15s} f={f:3d} thigh vertices out {' '.join(f'{v:.3f}' for v in vertex)}, "
                  f"surface {' '.join(f'{v:.3f}' for v in surface)}; tail low {tail:.3f} "
                  f"(hind knee at rest {knee:.3f}){flag}")
    for o in objs:
        if o.animation_data:
            for t in o.animation_data.nla_tracks:
                t.mute = mutes[(o.name, t.name)]
        o.location, o.rotation_euler, o.rotation_quaternion, o.scale = rest[o.name]
    scene.frame_set(1)
    print(f"CHECK exposure: thigh vertices at most {worst_vertex:.3f} outside body and lower leg (limit 0.01); "
          f"round thigh surface in view up to {worst_surface:.3f}; tail at least {worst_tail:+.3f} above the "
          f"hind knee (all clips but Graze)")


def check(kit):
    objects = list(bpy.data.objects)
    idle = kit.clip_pose_space(objects, "Horse_Idle", 1)
    kit.size_report(PREFIX, REFERENCE, space=idle)
    kit.proportion_report("Horse_Body", ["Horse_Head", "Horse_Muzzle"], space=idle)
    kit.triangle_report(PREFIX, BUDGET)
    kit.thickness_report(PREFIX, SCALE)
    legs = [f"Horse_UpperLeg_{s}" for s in LEGS]
    feet = [f"Horse_Hoof_{s}" for s in LEGS]
    # the neck joins head and body: "head-in" is the neck in the body, and
    # the joints cover the knees, the head in the neck and the mane
    joints = [(f"Horse_LowerLeg_{s}", f"Horse_UpperLeg_{s}") for s in LEGS]
    joints += [("Horse_Head", "Horse_Neck"), ("Horse_Mane", "Horse_Neck")]
    kit.clip_report("Horse_Body", "Horse_Neck", legs, feet, ["Horse_Tail_Base"], joints=joints)
    exposure_report(min(idle[f"Horse_KneePivot_{s}"].translation.z for s in ("RL", "RR")))
