"""Piglet: a round, bouncy party-toy piglet.

Design space is the stored pose (the piglet has no clips;
`entities/farmAnimals/FarmAnimals.tsx` poses the rig in code): Blender
world, +Z up, the piglet faces -Y, its L nodes are on +X. Runtime scale
0.44 (pigletConfig.scale), so 0.03 game units is 0.068 model units.

One soft round body with a full low chest (it hides the front leg tops)
and shoulders that widen to the head, one big round head nested into it
(wider than the body, as round-faced animals may be), a big glossy snout
disc with ink nostrils, tall ink eyes with a glint, rosy blush, soft
floppy ears, short round legs standing in hoof pucks and a curly tail as
one smooth corkscrew.

Tuned to the game camera (about 30 degrees above): the eyes sit above the
snout disc, whose face tilts up; the ears stick out sideways and a little
forward, nearly level, with their faces up and their tips drooping. An ear
whose axis climbs at the camera's own angle points straight at the camera
in the front three-quarter view and shows only its edge from the side (it
read as a sausage there), and ears that stood up showed as horns from the
side; level ears show their leaf from every side. The corkscrew stands up
and back, so its curl shows from every side. Pig pink is authored warm,
since the cool fill and the shade veil shift it toward lilac on screen
(#f598ab read #f498bc at noon).

The rig has one material per node and no ear lining node, so the ears are
one soft cupped leaf in the body pink. Piglet_Belly and Piglet_TailTip are
hidden nubs: the belly faces the ground, and the tail is one curve on
Piglet_TailCurl. The nostrils use the eye ink (Charcoal), the cheeks carry
the blush (DarkPink).
"""

import math

import bpy
from mathutils import Matrix, Vector

PREFIX = "Piglet_"
SCALE = 0.44  # pigletConfig.scale in entities/farmAnimals/FarmAnimals.tsx
BUDGET = 3000
# The model this design replaced, at rest: width x, length y, height z.
REFERENCE = (1.01, 1.84, 1.21)

M = {
    "skin": "Material.Piglet.Pink",
    "snout": "Material.Piglet.LightPink",
    "blush": "Material.Piglet.DarkPink",
    "eye": "Material.Piglet.Charcoal",
    "glint": "Material.Piglet.EyeGlint",
    "hoof": "Material.Piglet.Hoof",
}

# On-screen colour of a sunlit face, roughness band (GAME_ART.md).
COLOURS = {
    # #f6929a on screen (#f7a0b0 at noon in the game), authored as its exact
    # 8-bit albedo because farmAnimalAssets.unit.ts pins it
    M["skin"]: ("#aa6268", 0.6, "albedo"),
    M["snout"]: ("#fbc3b8", 0.45),
    M["blush"]: ("#f0647f", 0.8),
    M["eye"]: ("#5c4590", 0.35),
    M["glint"]: ("#fff4dc", 0.35),
    M["hoof"]: ("#8e6f80", 0.55),
}

BODY_C = Vector((0.0, 0.07, 0.53))
BODY = dict(rx=0.4, ry=(0.56, 0.5), rz=(0.39, 0.39), ex=0.92, ey=(0.84, 0.88), ez=(0.62, 0.88), res=7,
            taper={"y": ("x", 0.03)})
HEAD_C = Vector((0.0, -0.53, 0.74))
HEAD = dict(rx=0.42, ry=(0.35, 0.35), rz=(0.36, 0.36), ex=0.9, ey=0.92, ez=0.9, res=7,
            taper={"z": ("x", -0.07)})
# snout: a short disc pushed forward from the lower face, its face tilted up
SNOUT_TILT = math.radians(10)
SNOUT_C = HEAD_C + Vector((0.0, -0.32, -0.17))
SNOUT_R = (0.21, 0.145, 0.12)  # width, height, depth (half sizes)
EYE_X, EYE_Z = 0.21, HEAD_C.z + 0.12
EYE_H, EYE_W = 0.25, 0.2  # 35% of the head height
GLINT = 0.09  # >= 0.068 model units (0.03 game units)
LEG_INWARD = 0.06
LEG_R, LEG_TOP_R = 0.1, 0.095
HOOF_R, HOOF_H = 0.13, 0.11
# the hoof rims are the first silhouette to show steps at close zoom
LEG_SEGMENTS = 12
# hoof wall and rim at 16 (its outline), sole 8, stepping down to the leg
HOOF_RINGS = (1, 8, 16, 16, 14, LEG_SEGMENTS)

# ears (the L ear; x is mirrored for R): root from the head centre, axis
# and face in design space; the axis climbs only about 13 degrees (see the
# module notes), the tip is pointed and the rim cups up
EAR = dict(root=(0.2, 0.02, 0.26), axis=(0.65, -0.55, 0.2), face=(0.3, -0.25, 1.0), length=0.39, width=0.36,
           thickness=0.1, fold=-0.5, fold_at=0.42, cup=0.08, tip=0.4)
# the snout disc is revolved about its axis, so its rim, the face's focal
# outline, is an even ring of SNOUT_SEGMENTS; latitudes in degrees from the
# buried back (-90) to the face (+90), dense where the rim rolls over
SNOUT_SEGMENTS = 24
SNOUT_LATITUDES = (-45, 0, 12, 25, 40, 58)
NOSTRIL_SEGMENTS = 12
# blush on the cheek, below and outside the eye (direction from HEAD_C)
BLUSH = dict(at=(0.28, -0.4, -0.03), height=0.11, width=0.17)
# the tip stays 0.07 model units (0.031 game units) across
TAIL = dict(tube_radius=0.038, taper=0.08, samples=14, segments=7)
# shoulders: the front of the back widens to the head, so from behind the
# head nests into the body instead of sitting on it like a snowman
SHOULDER = dict(widen=0.12, front=(-0.3, 0.7), top=(-0.2, 0.8))

SIDES = (("L", 1.0), ("R", -1.0))  # the piglet's L nodes are on +X


def frame_axes(origin, x_axis, y_axis):
    """A frame at `origin` with local X along `x_axis` and local Y as close
    to `y_axis` as possible (Z completes it)."""
    x = Vector(x_axis).normalized()
    y = Vector(y_axis) - x * Vector(y_axis).dot(x)
    y.normalize()
    z = x.cross(y)
    return Matrix((
        (x.x, y.x, z.x, origin[0]),
        (x.y, y.y, z.y, origin[1]),
        (x.z, y.z, z.z, origin[2]),
        (0.0, 0.0, 0.0, 1.0),
    ))


def floppy_ear(kit, part, material, root, axis, face, length, width, thickness, fold, fold_at, cup,
               tip=0.55, segments=22):
    """A soft leaf ear as one pillow (`kit.slab`) folded in its own frame.

    It rises from `root` (buried in the head) along `axis` for `length`,
    its face toward `face`. From `fold_at` (a fraction of the length) the
    ear bends round a circle until the tip has turned `fold` radians:
    positive folds it over toward its face, negative droops it away. The
    edges curl `cup` toward the face, so it reads as a soft hollow.
    """
    axis = Vector(axis).normalized()
    f = Vector(face) - axis * Vector(face).dot(axis)
    f.normalize()
    side = axis.cross(f).normalized()
    origin = Vector(root) + axis * (length * 0.4)
    # local X across the ear, local Y along it, local Z toward the face
    frame = frame_axes(origin, side, axis)
    half = width / 2
    y0, y1 = -length * 0.4, length * 0.6
    outline = [
        (0.0, y1),
        (half * tip, y1 - length * 0.2),
        (half * 0.92, y0 + length * 0.45),
        (half * 0.97, y0 + length * 0.14),
        (half * 0.6, y0 - 0.01),
        (0.0, y0 - 0.03),
        (-half * 0.6, y0 - 0.01),
        (-half * 0.97, y0 + length * 0.14),
        (-half * 0.92, y0 + length * 0.45),
        (-half * tip, y1 - length * 0.2),
    ]
    leaf = kit.Part()
    kit.slab(leaf, material, Matrix.Identity(4), outline, thickness, segments=segments, rings=(0.55, 0.85))
    yb = y0 + length * fold_at
    radius = (y1 - yb) / fold
    for v in leaf.verts:
        t = max(0.0, (v.y - y0) / length)
        z = v.z + cup * (v.x / half) ** 2 * (0.4 + 0.6 * t)
        if v.y > yb:
            a = (v.y - yb) / radius
            v.y, v.z = yb + (radius - z) * math.sin(a), radius - (radius - z) * math.cos(a)
        else:
            v.z = z
    leaf.verts = [frame @ v for v in leaf.verts]
    part.extend(leaf)
    return frame


def glossy_eye(kit, eye_part, glint_part, surface, core, target, height, width, eye_material, glint_material,
               glint_size, glint_dir=(-1.0, 0.0, 0.0), glint_at=(0.22, 0.12), dome=0.02, segments=18,
               glint_segments=14):
    """`kit.eye` with the glint kept on the eye's plateau.

    The kit puts the glint 0.2 eye widths to the side; on an eye this
    narrow the outer glint then reaches the rolled rim, where the eye shows
    through it. `glint_at` is (up, side) in eye heights and widths.
    """
    centre, normal = kit.pad(eye_part, eye_material, surface, target, core, height / 2, width / 2, 0.01,
                             u_hint=(0, 0, 1), rim=0.012, dome=dome, segments=segments,
                             rings=(0.0, 0.6, 0.9, 1.0), lift=(1.0, 0.85, 0.35, None))
    up = Vector((0, 0, 1)) - normal * normal.z
    up.normalize()
    side = Vector(glint_dir) - normal * normal.dot(Vector(glint_dir)) - up * up.dot(Vector(glint_dir))
    side.normalize()
    glint_centre = centre + up * (height * glint_at[0]) + side * (width * glint_at[1])
    kit.pad(glint_part, glint_material, kit.Surface(eye_part), glint_centre, centre + normal * 0.4,
            glint_size * 0.56, glint_size / 2, 0.007, u_hint=(0, 0, 1), rim=0.006, segments=glint_segments,
            rings=(0.0, 0.7, 1.0), lift=(1.0, 0.75, None))
    return centre, normal


def snout_disc(part, material, frame, rx, ry, rz, ex, ey, ez, latitudes, segments, flare=0.0):
    """A superellipsoid disc revolved about the frame's local +Z (its face).

    The same form as `kit.blob(..., ex, ey, ez)`, built from rings round the
    face axis instead of a cube sphere: the rim the camera sees as the
    snout's outline is an even ring of `segments`, and the latitudes put the
    rings where the rim rolls over onto the flat face. Poles close the back
    (buried in the head) and the face. `ez` is (back, face). `flare` widens
    the face side (1 + flare * sin(latitude)).
    """
    def spow(x, e):
        return math.copysign(abs(x) ** e, x)

    verts, faces, rings = [Vector((0.0, 0.0, -rz))], [], []
    for lat in latitudes:
        t = math.radians(lat)
        c, s = math.cos(t), math.sin(t)
        k = 1.0 + flare * s
        z = rz * spow(s, ez[1] if s >= 0 else ez[0])
        ring = []
        for j in range(segments):
            a = 2 * math.pi * j / segments
            ring.append(len(verts))
            verts.append(Vector((rx * k * spow(c, ex) * spow(math.cos(a), ex),
                                 ry * k * spow(c, ey) * spow(math.sin(a), ey), z)))
        rings.append(ring)
    verts.append(Vector((0.0, 0.0, rz)))
    back, front = 0, len(verts) - 1
    faces.extend([back, rings[0][(j + 1) % segments], rings[0][j]] for j in range(segments))
    for lower, upper in zip(rings, rings[1:]):
        faces.extend([lower[j], lower[(j + 1) % segments], upper[(j + 1) % segments], upper[j]]
                     for j in range(segments))
    faces.extend([rings[-1][j], rings[-1][(j + 1) % segments], front] for j in range(segments))
    return part.add([frame @ v for v in verts], faces, material)


def curly_tail(kit, part, material, start, pivot, centre, radius, turns, rise, axis, tube_radius, samples=14,
               taper=0.12, segments=8):
    """A pig's curl: from inside the rump through the pivot, out into a
    spiral of `turns` about `axis` around `centre`, one smooth tube."""
    axis = Vector(axis).normalized()
    u = (Vector(pivot) - Vector(centre))
    u = u - axis * u.dot(axis)
    u.normalize()
    v = axis.cross(u)
    spiral = []
    for k in range(samples + 1):
        t = k / samples
        a = 2 * math.pi * turns * t
        r = radius * (1.0 - 0.35 * t)
        spiral.append(Vector(centre) + u * (r * math.cos(a)) + v * (r * math.sin(a)) + axis * (rise * t))
    # buried start, the pivot, a point easing into the spiral, the spiral
    pts = [Vector(start), Vector(pivot), Vector(pivot).lerp(spiral[0], 0.55)] + spiral
    curve, _ = kit.catmull_rom(pts, samples=1)
    radii = [tube_radius * (1.0 - taper * i / (len(curve) - 1)) for i in range(len(curve))]
    kit.tube(part, material, curve, radii, segments=segments, cap_rings=2)
    return curve


def build(kit, party_style):
    objects = list(bpy.data.objects)
    space = kit.design_space(objects)

    def P(name):
        return space[name].translation.copy()

    parts = {o.name: kit.Part(o.name) for o in objects if o.type == "MESH"}

    # body: one round bean, belly low and flat, rump a little fuller
    def shoulder(p, d):
        w = kit.smoothstep(*SHOULDER["front"], -d.y) * kit.smoothstep(*SHOULDER["top"], d.z)
        p.x *= 1.0 + SHOULDER["widen"] * w
        return p

    kit.blob(parts["Piglet_Body"], M["skin"], BODY_C, deform=shoulder, **BODY)
    kit.hidden_nub(parts["Piglet_Belly"], M["snout"], BODY_C + Vector((0.0, 0.0, -0.05)), 0.05)

    # legs: short round legs whose top sphere sits on the hip pivot, in hoof
    # pucks that meet them on one clean circle
    for side in ("FL", "FR", "RL", "RR"):
        pivot = space[f"Piglet_LegPivot_{side}"]
        hip = pivot.translation
        local_x = pivot.to_3x3() @ Vector((1.0, 0.0, 0.0))
        inward = Vector((-LEG_INWARD if hip.x > 0 else LEG_INWARD, 0.0, 0.0)).dot(local_x)
        kit.pivot_leg(parts[f"Piglet_Leg_{side}"], M["skin"], pivot, LEG_R, hip.z - HOOF_H, inward=inward,
                      top_radius=LEG_TOP_R, segments=LEG_SEGMENTS, arc=1)
        kit.pivot_foot_rings(parts[f"Piglet_Hoof_{side}"], M["hoof"], pivot, inward, -hip.z,
                             kit.hoof_profile(HOOF_R, HOOF_H, LEG_R, bevel=0.03), HOOF_RINGS)

    # head: one big round form, full at the cheeks
    kit.blob(parts["Piglet_Head"], M["skin"], HEAD_C, **HEAD)
    head = kit.Surface(parts["Piglet_Head"])

    # snout: a big glossy disc, flat face tilted up toward the game camera
    snout_axis = Vector((0.0, -math.cos(SNOUT_TILT), math.sin(SNOUT_TILT)))
    snout_frame = kit.frame_from(SNOUT_C, snout_axis, (0.0, 0.0, 1.0))
    sw, sh, sd = SNOUT_R

    # a little wider at the face
    snout_disc(parts["Piglet_Snout"], M["snout"], snout_frame, sw, sh, sd, 0.9, 0.9, (0.8, 0.5), SNOUT_LATITUDES,
               SNOUT_SEGMENTS, flare=0.08)
    snout = kit.Surface(parts["Piglet_Snout"])
    face = snout_frame @ Vector((0.0, 0.0, sd))
    up = snout_frame.to_3x3() @ Vector((0.0, 1.0, 0.0))
    right = snout_frame.to_3x3() @ Vector((1.0, 0.0, 0.0))
    for side, sx in SIDES:
        kit.pad(parts[f"Piglet_Nostril_{side}"], M["eye"], snout, face + right * (sx * 0.082) + snout_axis * 0.2,
                SNOUT_C, 0.056, 0.038, 0.008, u_hint=up, rim=0.008, segments=NOSTRIL_SEGMENTS, rings=(0.0, 0.7, 1.0),
                lift=(1.0, 0.8, None))

    # eyes, glints and blush (the Cheek nodes)
    for side, sx in SIDES:
        glossy_eye(kit, parts[f"Piglet_Eye_{side}"], parts[f"Piglet_EyeGlint_{side}"], head,
                   HEAD_C + Vector((sx * 0.04, 0.0, 0.0)), Vector((sx * EYE_X, HEAD_C.y - 0.7, EYE_Z)), EYE_H,
                   EYE_W, M["eye"], M["glint"], glint_size=GLINT)
        bx, by, bz = BLUSH["at"]
        kit.blush(parts[f"Piglet_Cheek_{side}"], M["blush"], head, HEAD_C, HEAD_C + Vector((sx * bx, by, bz)),
                  BLUSH["height"], BLUSH["width"], segments=16)

    # ears: soft leaves on the upper head pointing forward and out, faces
    # up, tips drooping
    for side, sx in SIDES:
        root, axis, face = (Vector(v) for v in (EAR["root"], EAR["axis"], EAR["face"]))
        root.x *= sx
        axis.x *= sx
        face.x *= sx
        floppy_ear(kit, parts[f"Piglet_Ear_{side}"], M["skin"], root=HEAD_C + root, axis=axis, face=face,
                   **{k: v for k, v in EAR.items() if k not in ("root", "axis", "face")})

    # tail: one smooth corkscrew from inside the rump through the pivot,
    # standing up and back
    tp = P("Piglet_TailPivot")
    curly_tail(kit, parts["Piglet_TailCurl"], M["skin"], start=tp + Vector((0.0, -0.12, -0.02)), pivot=tp,
               centre=tp + Vector((0.0, 0.1, 0.1)), radius=0.075, turns=1.5, rise=0.12,
               axis=(0.0, 0.45, 0.89), **TAIL)
    kit.hidden_nub(parts["Piglet_TailTip"], M["blush"], tp + Vector((0.0, -0.1, 0.0)), 0.03)

    kit.rebuild_all(parts, space)
    kit.apply_colours(party_style, COLOURS)


def check(kit):
    kit.size_report(PREFIX, REFERENCE)
    kit.proportion_report("Piglet_Body", ["Piglet_Head", "Piglet_Snout"])
    kit.triangle_report(PREFIX, BUDGET)
    kit.thickness_report(PREFIX, SCALE)
    legs = [f"Piglet_Leg_{s}" for s in ("FL", "FR", "RL", "RR")]
    feet = [f"Piglet_Hoof_{s}" for s in ("FL", "FR", "RL", "RR")]

    def gait(diagonal, base=0.0):
        # updatePigletPose: legs 0 (FL) and 3 (RR) take +diagonal
        return {"Piglet_LegPivot_FL": (base + diagonal, 0, 0), "Piglet_LegPivot_FR": (base - diagonal, 0, 0),
                "Piglet_LegPivot_RL": (base - diagonal, 0, 0), "Piglet_LegPivot_RR": (base + diagonal, 0, 0)}

    # extremes of updatePigletPose and getPigletHeadPitch (three.js
    # node-local offsets, as FarmAnimals.tsx writes them; see kit.apply_pose)
    bob = gait(0.42 * math.sqrt(0.5))  # the bob peaks half way through a stride
    bob["Piglet_BodyPivot"] = {"pos": (0.0, 0.018, 0.0)}
    swim = gait(0.62, -0.28)
    swim["Piglet_BodyPivot"] = {"pos": (0.0, 0.037, 0.0), "rot": (-0.06, 0.0, 0.0)}
    swim["Piglet_HeadPivot"] = (-0.1, 0, 0)
    swim_back = gait(-0.62, -0.28)
    swim_back["Piglet_BodyPivot"] = {"pos": (0.0, 0.037, 0.0), "rot": (-0.06, 0.0, 0.0)}
    poses = {
        "rest": {},
        "walk +": gait(0.42),
        "walk -": gait(-0.42),
        "walk bob (feet lift)": bob,
        "swim +": swim,
        "swim -": swim_back,
        "root (head down)": {"Piglet_HeadPivot": (-0.56, 0, 0)},
        "look +": {"Piglet_HeadPivot": (0, 0, 0.1)},
        "look -": {"Piglet_HeadPivot": (0, 0, -0.1)},
        "wallow +": {"Piglet_BodyPivot": (0, 0, 0.2), "Piglet_HeadPivot": (-0.12, 0, 0)},
        "wallow -": {"Piglet_BodyPivot": (0, 0, -0.2), "Piglet_HeadPivot": (-0.12, 0, 0)},
        "ears +": {"Piglet_EarPivot_L": (0, 0, 0.11), "Piglet_EarPivot_R": (0, 0, -0.11)},
        "ears -": {"Piglet_EarPivot_L": (0, 0, -0.11), "Piglet_EarPivot_R": (0, 0, 0.11)},
        "tail +": {"Piglet_TailPivot": (0, 0.45, 0)},
        "tail -": {"Piglet_TailPivot": (0, -0.45, 0)},
    }
    kit.procedural_report("Piglet_Body", "Piglet_Head", legs, feet, ["Piglet_TailCurl"], poses,
                          joints=[("Piglet_Ear_L", "Piglet_Head"), ("Piglet_Ear_R", "Piglet_Head"),
                                  ("Piglet_Snout", "Piglet_Head")])
