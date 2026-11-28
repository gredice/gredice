"""Sheep: a plush lamb figurine with one soft fleece cloud.

Design space is the stored pose (`entities/farmAnimals/FarmAnimals.tsx`,
`updateSheepPose`, poses the rig in code): Blender world, +Z up, the sheep
faces -Y, its L nodes are on +X. Runtime scale 0.46, so 0.03 game units is
0.065 model units.

The fleece is one smooth loaf: a clean dome over the back and the lit
sides, and round the hem a ring of eight soft scallops built into the same
mesh, so the lower outline reads as a cloud while the top the camera sees
first stays one calm form (no puffs on the surface). A big caramel head with
a small scalloped wool tuft on the crown, a light snout with a rounded ink
nose and a smile, tall ink eyes with a glint, blush, pillow ears standing
out level with a pink lining facing up, short caramel legs in hoof pucks
and a fleece puff for a tail. Caramel keeps the face, ears and legs warm
and well above the darkest on-screen value, and reads against the cream
fleece from far away.

The face is tuned to the game camera: grazing pitches the head about 47
degrees down (`getSheepHeadPitch`), so the camera sees the crown. The eyes
sit high on the face, the tuft stays on the crown above them, and the ears
stand out level with the lining up, so a grazing sheep still shows eyes,
pink and the tuft from above.

Nodes and their jobs (one material per node): Sheep_WoolCap is the tuft;
Sheep_Muzzle is the snout patch; Sheep_Nose carries the ink nose and smile;
Sheep_EyeGlint_L carries both glints and Sheep_EyeGlint_R both blush ovals
(nothing animates them); Sheep_Jaw is a soft chin roll under the snout, so
the code's cud chewing (it turns Sheep_JawPivot) shows; Sheep_WoolChest is a
hidden nub (the fleece is one form).
"""

import math

import bpy
from mathutils import Vector

PREFIX = "Sheep_"
SCALE = 0.46  # sheepModelScale in entities/Sheep.tsx, sheepConfig.scale in FarmAnimals.tsx
BUDGET = 3000
# The model this design replaced, at rest: width x, length y, height z.
REFERENCE = (1.25, 2.36, 1.43)

M = {
    "face": "Material.Sheep.Face",
    "pink": "Material.Sheep.InnerEar",
    "eye": "Material.Sheep.Eye",
    "glint": "Material.Sheep.EyeGlint",
    "muzzle": "Material.Sheep.Muzzle",
    "hoof": "Material.Sheep.Hoof",
    "wool": "Material.Sheep.Wool",
    "wool_light": "Material.Sheep.WoolLight",
    "wool_shadow": "Material.Sheep.WoolShadow",
}

# On-screen colour of a sunlit face, roughness band (GAME_ART.md).
COLOURS = {
    # white fur #f2ddbe on screen, warm enough to keep saturation 0.10 or
    # more under the cool fill. farmAnimalAssets.unit.ts pins the wool as an
    # 8-bit sRGB albedo, so both wools are authored as that albedo
    # (screen_to_albedo("#f2ddbe") rounded to 8 bits).
    M["wool"]: ("#9d8f7b", 0.8, "albedo"),
    M["wool_light"]: ("#9d8f7b", 0.8, "albedo"),
    M["wool_shadow"]: ("#e8d4b5", 0.8),
    M["face"]: ("#d09470", 0.8),
    M["muzzle"]: ("#eeb994", 0.45),
    M["pink"]: ("#f59a92", 0.8),
    M["eye"]: ("#5c4590", 0.35),
    M["glint"]: ("#fff4dc", 0.35),
    M["hoof"]: ("#8e6f80", 0.55),
}

# fleece: one loaf, belly flat but round at the hem, rump a little fuller
# (radii and exponents as (negative side, positive side), as in kit.blob)
FLEECE_C = Vector((0.0, 0.05, 0.85))
FLEECE = dict(rx=(0.53, 0.53), ry=(0.72, 0.76), rz=(0.53, 0.52), ex=(0.9, 0.9), ey=(0.84, 0.84),
              ez=(0.66, 0.88), taper=0.06)
LOBES = 8  # scallops round the girth (even, so the pattern is mirror symmetric)
LOBE_VERTS = 6  # ring vertices per scallop; the crease falls on a vertex
LOBE_AMP = 0.14  # scallop depth, a fraction of the radius
LOBE_SHARP = 0.9  # |cos|^p: below 1 rounds the lobes and narrows the creases
LOBE_IN = (-84.0, -60.0)  # latitude (degrees) where the scallops grow in under the hem
LOBE_OUT = (-28.0, 2.0)  # and where they fade out, below the light, so the lit sides stay calm
BAND_LATS = (-62.0, -52.0, -42.0, -31.0, -17.0, 0.0, 15.0, 30.0, 44.0)  # rings at the full girth count
TOP_LATS = (58.0, 73.0)  # rings at half the count over the smooth dome
BOTTOM_LATS = (-76.0,)  # and under the belly

HEAD_C = Vector((0.0, -0.97, 0.91))
HEAD = dict(rx=0.49, ry=(0.54, 0.5), rz=(0.52, 0.49), ex=0.92, ey=0.92, ez=0.9, res=6,
            taper={"z": ("x", 0.08)})  # a soft pear: wide at the eyes, narrower at the snout
TUFT_UP = Vector((0.0, 0.05, 1.0))  # the crown, between the ears
TUFT_LIFT, TUFT_DOME = 0.05, 0.07
TUFT_LOBES = 6
EYE_X, EYE_Z = 0.22, HEAD_C.z + 0.14  # high, so the eyes still show when grazing
EYE_H, EYE_W = 0.29, 0.21  # 29% of the head height, 21% of its width
GLINT = 0.09  # >= 0.065 model units (0.03 game units)
LEG_SEGMENTS = 12  # leg and hoof rims are silhouettes at close zoom
# hoof wall and rim at 16 (its outline), sole 8, stepping down to the leg
HOOF_RINGS = (1, 8, 16, 16, LEG_SEGMENTS, LEG_SEGMENTS)
CHIN_R, CHIN_HALF, CHIN_SINK = 0.065, 0.1, 0.0  # the chin roll on Sheep_Jaw
LEG_R, LEG_TOP_R = 0.1, 0.092
HOOF_R, HOOF_H = 0.135, 0.12
SMILE_R = 0.033  # 0.03 game units thick at scale 0.46

SIDES = (("L", 1.0), ("R", -1.0))  # the sheep's L nodes are on +X


def smoothstep(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def _spow(x, e):
    return math.copysign(abs(x) ** e, x)


def _side(pair, value):
    return pair[1] if value >= 0 else pair[0]


def fleece_shape(t, lat):
    """Local point of the plain loaf at azimuth `t` (0 toward +X, pi/2
    toward the rump) and latitude `lat` (radians)."""
    f = FLEECE
    d = Vector((math.cos(lat) * math.cos(t), math.cos(lat) * math.sin(t), math.sin(lat)))
    p = Vector((_spow(d.x, _side(f["ex"], d.x)) * _side(f["rx"], d.x),
                _spow(d.y, _side(f["ey"], d.y)) * _side(f["ry"], d.y),
                _spow(d.z, _side(f["ez"], d.z)) * _side(f["rz"], d.z)))
    p.x *= 1.0 + f["taper"] * d.y
    return p


def girth_azimuths(count):
    """`count` azimuths evenly spaced along the girth outline, starting at
    the rump, so every scallop is the same size round the body."""
    n = 4000
    ts = [2 * math.pi * i / n for i in range(n + 1)]
    pts = [fleece_shape(t, 0.0) for t in ts]
    lengths = [0.0]
    for a, b in zip(pts, pts[1:]):
        lengths.append(lengths[-1] + (b - a).length)
    total = lengths[-1]
    start = lengths[n // 4]  # t = pi / 2, the rump
    out, i = [], 0
    for k in range(count):
        target = (start + total * k / count) % total
        i = 0 if target < lengths[i] else i
        while lengths[i + 1] < target:
            i += 1
        f = (target - lengths[i]) / max(lengths[i + 1] - lengths[i], 1e-12)
        out.append(ts[i] + (ts[i + 1] - ts[i]) * f)
    return out


def scallop_weight(lat_deg):
    return smoothstep(LOBE_IN[0], LOBE_IN[1], lat_deg) * (1.0 - smoothstep(LOBE_OUT[0], LOBE_OUT[1], lat_deg))


def fleece(part, material, centre):
    """The fleece: one closed mesh, a lathe of rings round +Z. The girth band
    carries LOBES * LOBE_VERTS vertices per ring for the scallops; the top
    dome and the belly, which stay smooth, use every other one."""
    count = LOBES * LOBE_VERTS
    ts = girth_azimuths(count)
    lobe = [abs(math.cos(math.pi * k / LOBE_VERTS)) ** LOBE_SHARP for k in range(count)]
    mean = sum(lobe) / count
    verts = []

    def ring(lat_deg, step):
        ids = []
        lat = math.radians(lat_deg)
        w = scallop_weight(lat_deg)
        for k in range(0, count, step):
            p = fleece_shape(ts[k], lat) * (1.0 + LOBE_AMP * w * (lobe[k] - mean))
            ids.append(len(verts))
            verts.append(centre + p)
        return ids

    bottom_pole = len(verts)
    verts.append(centre + Vector((0.0, 0.0, -FLEECE["rz"][0])))
    rings = [(ring(lat, 2), 2) for lat in BOTTOM_LATS] + [(ring(lat, 1), 1) for lat in BAND_LATS] + \
        [(ring(lat, 2), 2) for lat in TOP_LATS]
    top_pole = len(verts)
    verts.append(centre + Vector((0.0, 0.0, FLEECE["rz"][1])))

    faces = []
    first = rings[0][0]
    faces.extend([first[j], bottom_pole, first[(j + 1) % len(first)]] for j in range(len(first)))
    for (lower, ls), (upper, us) in zip(rings, rings[1:]):
        n = len(lower)
        if ls == us:
            faces.extend([lower[j], lower[(j + 1) % n], upper[(j + 1) % n], upper[j]] for j in range(n))
        elif ls == 1:  # fine below, coarse above
            m = len(upper)
            for j in range(m):
                f0, f1, f2 = lower[2 * j], lower[2 * j + 1], lower[(2 * j + 2) % n]
                c0, c1 = upper[j], upper[(j + 1) % m]
                faces.extend([[f0, f1, c0], [f1, f2, c1], [c0, f1, c1]])
        else:  # coarse below, fine above
            m = len(upper)
            for j in range(n):
                c0, c1 = lower[j], lower[(j + 1) % n]
                f0, f1, f2 = upper[2 * j], upper[2 * j + 1], upper[(2 * j + 2) % m]
                faces.extend([[c0, c1, f1], [c0, f1, f0], [c1, f2, f1]])
    last = rings[-1][0]
    faces.extend([last[j], last[(j + 1) % len(last)], top_pole] for j in range(len(last)))
    return part.add(verts, faces, material)


def tuft_radius(phi):
    """Angular radius of the tuft round TUFT_UP (phi 0 toward the face):
    down onto the forehead above the eyes, above the ears at the sides, over
    the back of the crown, with a rim of TUFT_LOBES soft scallops."""
    base = 0.76 - 0.05 * math.cos(2 * phi)
    return base * (1.0 + 0.1 * (abs(math.cos(TUFT_LOBES * phi / 2)) ** 0.8 - 0.6))


def tuft(part, material, surface, core, up, front, radius, lift, dome, tuck=0.012, segments=36,
         rings=(0.5, 0.82, 0.95)):
    """A soft wool tuft hugging a head: a shell `lift` above `surface` round
    the direction `up` (seen from `core`), domed `dome` higher in the middle,
    whose outline is the angular radius `radius(phi)` (phi 0 toward
    `front`). It rolls down over the last rings to a rim `tuck` under the
    surface, so the edge is a rounded, scalloped lip with no seam."""
    core, c = Vector(core), Vector(up).normalized()
    e1 = Vector(front) - c * Vector(front).dot(c)
    e1.normalize()
    e2 = c.cross(e1).normalized()

    def point(theta, phi, height):
        d = c * math.cos(theta) + (e1 * math.cos(phi) + e2 * math.sin(phi)) * math.sin(theta)
        hit, normal = surface.hit(core, d)
        if hit is None:
            hit, normal = surface.nearest(core + d)
        return hit + normal * height

    phis = [2 * math.pi * k / segments for k in range(segments)]
    verts = [point(0.0, 0.0, lift + dome)]
    ring_ids = [[0]]
    for t in list(rings) + [1.0]:
        ids = []
        for phi in phis:
            height = -tuck if t >= 1.0 else (lift + dome * (1.0 - t * t)) * (1.0 - t ** 6) ** 0.5
            ids.append(len(verts))
            verts.append(point(radius(phi) * t, phi, height))
        ring_ids.append(ids)
    faces = []
    for lower, upper in zip(ring_ids, ring_ids[1:]):
        if len(lower) == 1:
            faces.extend([lower[0], upper[j], upper[(j + 1) % segments]] for j in range(segments))
        else:
            faces.extend([lower[j], upper[j], upper[(j + 1) % segments], lower[(j + 1) % segments]]
                         for j in range(segments))
    a, b, cc = verts[faces[0][0]], verts[faces[0][1]], verts[faces[0][2]]
    if (b - a).cross(cc - a).dot(verts[0] - core) < 0:
        faces = [list(reversed(f)) for f in faces]
    return part.add(verts, faces, material)


def pillow_ear(kit, ear_part, inner_part, ear_material, inner_material, root, axis, face, length, width,
               thickness, point=0.3, segments=20, inner=(0.64, 0.62), inner_segments=16):
    """A soft leaf ear as one pillow (`kit.slab`) with a smooth outline of
    `segments` points, and a pink lining that follows that outline: a
    thinner pillow of the same leaf scaled by `inner`, sunk into the face
    that looks toward `face` so only its top shows, its rim tucked under the
    ear's surface. Runs from `root` (buried in the head) along `axis`."""
    axis = Vector(axis).normalized()
    f = Vector(face) - axis * Vector(face).dot(axis)
    f.normalize()
    centre = Vector(root) + axis * (length / 2)

    def leaf(scale_l, scale_w, n=24):
        return [(math.cos(a) * width / 2 * scale_w * (1.0 - point * math.sin(a)), math.sin(a) * length / 2 * scale_l)
                for a in (2 * math.pi * i / n for i in range(n))]

    kit.slab(ear_part, ear_material, kit.frame_from(centre, f, axis), leaf(1.0, 1.0), thickness, segments=segments,
             rings=(0.75,))
    half = thickness / 2
    inner_centre = centre + axis * (length * 0.03) + f * (half * 0.5)
    kit.slab(inner_part, inner_material, kit.frame_from(inner_centre, f, axis), leaf(*inner), half * 1.4,
             segments=inner_segments, rings=(0.7,))


def build(kit, party_style):
    objects = list(bpy.data.objects)
    space = kit.design_space(objects)

    def P(name):
        return space[name].translation.copy()

    parts = {o.name: kit.Part(o.name) for o in objects if o.type == "MESH"}

    # body: one soft fleece cloud
    fleece(parts["Sheep_WoolBody"], M["wool"], FLEECE_C)
    kit.hidden_nub(parts["Sheep_WoolChest"], M["wool_shadow"], FLEECE_C + Vector((0.0, -0.3, 0.0)), 0.05)

    # legs: short round legs whose top sphere sits on the hip pivot (both
    # caps are buried, in the fleece and the hoof, so no middle ring),
    # standing in hoof pucks that meet them on one clean circle
    for side in ("FL", "FR", "RL", "RR"):
        pivot = space[f"Sheep_LegPivot_{side}"]
        length = pivot.translation.z - HOOF_H
        axes = kit.node_frame(pivot)
        frame = kit.frame_from(axes @ Vector((0.0, 0.0, -length)), axes.to_3x3() @ Vector((0.0, 0.0, 1.0)),
                               axes.to_3x3() @ Vector((0.0, 1.0, 0.0)))
        kit.lathe(parts[f"Sheep_Leg_{side}"], M["face"], frame,
                  kit.capsule_profile(LEG_R, LEG_TOP_R, length, arc=1, mid=0), LEG_SEGMENTS)
        kit.pivot_foot_rings(parts[f"Sheep_Hoof_{side}"], M["hoof"], pivot, 0.0, -pivot.translation.z,
                             kit.hoof_profile(HOOF_R, HOOF_H, LEG_R), HOOF_RINGS)

    # tail: a fleece puff on the rump, its root buried in the fleece
    tail_c = P("Sheep_TailPivot") + Vector((0.0, 0.1, 0.06))
    kit.blob(parts["Sheep_Tail"], M["wool_light"], tail_c, 0.14, 0.13, 0.14, res=3, ex=0.9, ey=0.9, ez=0.9)

    # head: one big round form, a little wider at the eyes, the face running
    # forward and a little down to the snout
    def long_face(p, d):
        p.z -= 0.2 * max(0.0, -p.y)
        return p

    kit.blob(parts["Sheep_Head"], M["face"], HEAD_C, deform=long_face, **HEAD)
    head = kit.Surface(parts["Sheep_Head"])

    # tuft: a small scalloped wool cloud on the crown, above the eyes and ears
    tuft(parts["Sheep_WoolCap"], M["wool_light"], head, HEAD_C, TUFT_UP, (0.0, -1.0, 0.0), tuft_radius, TUFT_LIFT,
         TUFT_DOME)

    # snout: a light, softly domed oval on the lower face
    snout_core = HEAD_C + Vector((0.0, 0.0, -0.1))
    snout, snout_n = kit.pad(parts["Sheep_Muzzle"], M["muzzle"], head, HEAD_C + Vector((0.0, -0.6, -0.2)),
                             snout_core, 0.2, 0.31, 0.03, u_hint=(0, 0, 1), rim=0.012, segments=18,
                             rings=(0.0, 0.45, 0.75, 0.92, 1.0), lift=(1.0, 0.95, 0.75, 0.35, None), dome=0.05)
    muzzle = kit.Surface(parts["Sheep_Muzzle"])
    # chin: a soft roll in the snout colour just under the snout, half in the
    # head, on the jaw pivot the code turns while chewing the cud, so the
    # chew reads (a hidden nub showed no jaw motion at all)
    chin, chin_n = head.project(snout_core, snout_core + Vector((0.0, -0.5, -0.56)))
    chin = chin - chin_n * CHIN_SINK
    kit.capsule(parts["Sheep_Jaw"], M["muzzle"], chin + Vector((-CHIN_HALF, 0.0, 0.0)), CHIN_R,
                chin + Vector((CHIN_HALF, 0.0, 0.0)), CHIN_R, segments=6, arc=1, mid=1, y_hint=(0.0, 0.0, 1.0))
    # a rounded ink nose pointing down, and a small smile under it
    kit.pad(parts["Sheep_Nose"], M["eye"], muzzle, snout + Vector((0.0, -0.05, 0.065)), snout_core,
            0.055, 0.075, 0.01, u_hint=(0, 0, 1), rim=0.008, segments=12, rings=(0.0, 0.7, 1.0),
            lift=(1.0, 0.8, None), dome=0.008, outline=lambda a: 1.0 - 0.14 * math.cos(3 * a))
    smile = [snout + Vector((x, -0.08, -0.045 + 2.4 * x * x)) for x in (-0.09, 0.0, 0.09)]
    kit.smile(parts["Sheep_Nose"], M["eye"], muzzle, smile, SMILE_R, segments=5)

    # eyes, glints (both on EyeGlint_L) and blush (both on EyeGlint_R)
    for side, sx in SIDES:
        kit.eye(parts[f"Sheep_Eye_{side}"], parts["Sheep_EyeGlint_L"], head,
                HEAD_C + Vector((sx * 0.05, 0.0, 0.0)), Vector((sx * EYE_X, HEAD_C.y - 0.7, EYE_Z)), EYE_H, EYE_W,
                M["eye"], M["glint"], glint_size=GLINT, dome=0.025, segments=14)
        kit.blush(parts["Sheep_EyeGlint_R"], M["pink"], head, HEAD_C,
                  HEAD_C + Vector((sx * 0.31, -0.5, -0.1)), 0.11, 0.16, segments=12)

    # ears: soft pillows standing out level from the upper head just under
    # the tuft, the lined face up and a little forward, so the pink shows
    # from the game camera at rest and when grazing
    for side, sx in SIDES:
        pillow_ear(kit, parts[f"Sheep_Ear_{side}"], parts[f"Sheep_InnerEar_{side}"], M["face"], M["pink"],
                   root=HEAD_C + Vector((sx * 0.3, 0.14, 0.2)), axis=(sx * 1.0, 0.22, -0.14), face=(0.0, -0.4, 1.0),
                   length=0.38, width=0.28, thickness=0.11)

    kit.rebuild_all(parts, space)
    kit.apply_colours(party_style, COLOURS)


def check(kit):
    kit.size_report(PREFIX, REFERENCE)
    # the tuft is an open shell, so the head volume is the head alone
    kit.proportion_report("Sheep_WoolBody", ["Sheep_Head"])
    kit.triangle_report(PREFIX, BUDGET)
    kit.thickness_report(PREFIX, SCALE)
    legs = [f"Sheep_Leg_{s}" for s in ("FL", "FR", "RL", "RR")]
    feet = [f"Sheep_Hoof_{s}" for s in ("FL", "FR", "RL", "RR")]

    def step(a):  # FL and RR swing together, FR and RL opposite (updateSheepPose)
        return {"Sheep_LegPivot_FL": (a, 0, 0), "Sheep_LegPivot_FR": (-a, 0, 0),
                "Sheep_LegPivot_RL": (-a, 0, 0), "Sheep_LegPivot_RR": (a, 0, 0)}

    # extremes of updateSheepPose (three.js node-local offsets; kit.apply_pose)
    trot_bob = step(0.62 * math.sqrt(0.5))  # the gait lift peaks half way through a stride
    trot_bob["Sheep_BodyPivot"] = {"pos": (0.0, 0.045 + 0.012, 0.0), "rot": (0.0, 0.0, 0.025)}
    trot = step(0.62)
    trot["Sheep_BodyPivot"] = {"rot": (0.0, 0.0, -0.025)}
    poses = {
        "rest": {},
        "walk +": step(0.43),
        "walk -": step(-0.43),
        "trot +": step(0.62),
        "trot - sway": trot,
        "trot bob (feet lift)": trot_bob,
        "breathe out (feet sink)": {"Sheep_BodyPivot": {"pos": (0.0, -0.012, 0.0)}},
        "graze low": {"Sheep_HeadPivot": (-0.89, 0, 0)},
        "graze high, chew": {"Sheep_HeadPivot": (-0.75, 0, 0), "Sheep_JawPivot": (0.21, 0.045, 0)},
        "walk head up": {"Sheep_HeadPivot": (0.045, 0, 0)},
        "look around": {"Sheep_HeadPivot": (0.055, 0.11, 0.06)},
        "look around -": {"Sheep_HeadPivot": (-0.055, -0.11, -0.06)},
        "ears": {"Sheep_EarPivot_L": (0.055, 0, 0.13), "Sheep_EarPivot_R": (-0.055, 0, -0.13)},
        "ears -": {"Sheep_EarPivot_L": (-0.055, 0, 0.0), "Sheep_EarPivot_R": (0.055, 0, 0.0)},
        "tail wag +": {"Sheep_TailPivot": (0, 0.48, 0)},
        "tail wag -": {"Sheep_TailPivot": (0, -0.48, 0)},
    }
    joints = [("Sheep_Ear_L", "Sheep_Head"), ("Sheep_Ear_R", "Sheep_Head"), ("Sheep_Jaw", "Sheep_Head")]
    kit.procedural_report("Sheep_WoolBody", "Sheep_Head", legs, feet, ["Sheep_Tail"], poses, joints=joints)
