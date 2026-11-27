"""Frog: a squat party-toy pond frog with two eye domes.

The frog is animated by GLB clips only (Frog_Idle, Frog_Hop, Frog_Croak,
Frog_Blink); entities/frogs/Frogs.tsx moves and turns the whole group and
never poses a node. It is designed in the Frog_Idle pose (frame 1), which is
its stored rest: Blender world, +Z up, facing +Y (runtime -Z, see
getFrogFacingYaw), its L nodes on -X. Runtime scale 0.21 (frogScale), so
0.03 game units is 0.143 model units. Nothing tints it at runtime.

Two soft forms, like the other figurines: a squat body bean (Frog_Body)
whose rump flares into smooth haunches and whose belly sits flat on the
ground, and a wide, low head (Frog_Head) that overlaps its front. Two round
eye domes sit high in the top of the head, as on the team's garden-frog
avatar: green balls set into it (their buried lower part open), so each
reads as one clean round form. Big ink eyes with a glint face forward and
out on the domes; eye and glint are exact caps of the dome's sphere, so
their outlines are clean even. The lower face is cream (Frog_Muzzle): its top edge, a
wide curve rising to both corners, is the frog's smile; at 0.21 an ink smile
tube 0.03 game units thick would be a sausage across the face. A cream
throat sac (Frog_Throat) sits under the chin and puffs out when Frog_Croak
scales its pivot. Two soft darker spots lie on the back. Short arms stand on rounded pad hands; the hind thighs hide in the
haunches at rest and swing out when Frog_Hop kicks; long rounded pad feet lie
beside the haunches.

Frog_Blink only slides Frog_Eyelid_* 0.07 straight down. A lid on a round
dome above an eye that faces the game camera sinks into the dome when it
moves down, and one standing in front of the eye would float, so the lids
stay hidden nubs inside the domes (as before); Frog_Pupil_* and Frog_Belly
are hidden nubs too (the eye is one ink pad, and the belly faces the ground).
"""

import math

import bpy
from mathutils import Vector

PREFIX = "Frog_"
SCALE = 0.21  # frogScale in entities/frogs/Frogs.tsx
BUDGET = 2000  # small critter: 1,500 to 2,000 (frogAsset.unit.ts allows 1,000 to 2,500)
# The model this design replaced, in Frog_Idle: width x, length y, height z.
REFERENCE = (1.08, 1.23, 0.67)

M = {
    "skin": "Material.Frog.MossGreen",
    "dark": "Material.Frog.MossDark",
    "light": "Material.Frog.MossLight",
    "gold": "Material.Frog.ThroatGold",
    "ink": "Material.Frog.Charcoal",
    "glint": "Material.Frog.EyeGlint",
}

# On-screen colour of a sunlit face, roughness band (GAME_ART.md). Greens
# lean yellow: the skin shows about H 119 at noon, between the canopy green
# and the grass, and stands off the grass (#7bd03a, H 95) by hue and value;
# the spots are the same hue, darker; hands and feet a light leaf green; the
# lower face and throat warm cream.
COLOURS = {
    M["skin"]: ("#4ec540", 0.5),
    M["dark"]: ("#2e9338", 0.5),
    M["light"]: ("#aadc46", 0.5),
    M["gold"]: ("#f2e0b0", 0.55),
    M["ink"]: ("#5c4590", 0.35),
    M["glint"]: ("#fff4dc", 0.35),
}

SIDES = (("L", -1.0), ("R", 1.0))  # the frog's L nodes are on -X

# body: a squat bean, flat on the ground, lower than the head, the rump
# flaring into haunches
BODY_C = Vector((0.0, -0.17, 0.21))
BODY = dict(rx=0.34, ry=(0.36, 0.36), rz=(0.2, 0.2), ex=0.9, ey=0.88, ez=(0.55, 0.9), res=(6, 6, 5))
HAUNCH = 0.2  # how much wider the low rear flanks are than the bean
# head: the big front mass, wide and a little flattened, over the front of
# the body
HEAD_C = Vector((0.0, 0.27, 0.32))
HEAD_R = (0.42, (0.36, 0.28), (0.21, 0.18))  # x, (back, front) y, (down, up) z
HEAD_E = (0.88, 0.9, (0.7, 0.9))
HEAD_RES = (8, 6, 5)
# eye domes: round green balls set into the top of the head (centre, x
# mirrored; radius); their buried lower part stays open. DOME_LATS are the
# ring latitudes in degrees from the buried rim to just under the pole.
DOME_C = Vector((0.21, 0.3, 0.5))
DOME_R = 0.15
DOME_LATS = (-30.0, 0.0, 30.0, 55.0, 76.0)
DOME_SEGMENTS = 14
# eyes: exact sphere caps on the domes (clean round outlines), facing
# forward and out; angular half height and width, and their heights over the
# dome at ring fractions (the last ring tucks under it)
EYE_DIR = Vector((0.42, 1.0, 0.4))  # out, forward, up (x mirrored)
EYE_ANG = (0.8, 0.74)
EYE_RINGS, EYE_LIFT = (0.0, 0.7, 0.92, 1.0), (0.024, 0.022, 0.015, -0.012)
# glint: up and toward the viewer's left (+X for a frog facing +Y), as
# fractions of the eye's half angles, its angular half sizes (0.148 model
# units, 0.03 game units, across) and heights
GLINT_AT, GLINT_ANG = (0.34, 0.26), (0.5, 0.46)
GLINT_LIFT = (0.031, 0.029, 0.014)
# lower face: a cream pad whose top edge is the smile (in the pad's plane:
# u up, v across; the smile rises SMILE_K * v^2 to the corners)
FACE_AT = Vector((0.0, 1.0, -0.45))  # from the head centre
FACE_U, FACE_V = 0.45, 0.44  # half height under the mouth line (ends under the chin), half width
SMILE_UP, SMILE_K = 0.12, 0.6  # mouth line above the pad centre, its curve
THROAT_R = (0.2, 0.13, 0.1)
# back spots: (direction from the body core, angular radius, squash, harmonics)
SPOTS = [((-0.5, -0.1, 1.0), 0.34, (1.0, 1.25), ((2, 0.14, 0.4), (3, 0.08, 1.1))),
         ((0.55, 0.05, 1.0), 0.28, (1.0, 1.15), ((2, 0.15, 1.5), (3, 0.07, 0.3)))]
ARM_R = 0.08  # 0.034 game units across
HAND = (0.12, 0.1, 0.05)  # pad hand half sizes x, y, z
THIGH_R = 0.085
FOOT = (0.12, 0.19, 0.05)  # pad foot half sizes x, y, z


def head_form(kit, part, material):
    """The head: one soft wide form, with the two eye domes set into its
    top (lathe balls about the vertical, open where they are buried)."""
    rx, ry, rz = HEAD_R
    ex, ey, ez = HEAD_E
    kit.blob(part, material, HEAD_C, rx, ry, rz, res=HEAD_RES, ex=ex, ey=ey, ez=ez)
    for _, sx in SIDES:
        dome = Vector((sx * DOME_C.x, DOME_C.y, DOME_C.z))
        profile = [(DOME_R * math.cos(math.radians(a)), DOME_R * math.sin(math.radians(a))) for a in DOME_LATS]
        kit.lathe(part, material, kit.translation(dome), profile + [(0.0, DOME_R)], DOME_SEGMENTS)


def pad_blob(kit, part, material, centre, half, res, along=(0.0, 1.0, 0.0), toe=0.0):
    """A rounded pad (hand or foot) with a flat sole on the ground, its
    long axis along `along`, the front end a little lower (`toe`)."""
    a = Vector(along).normalized()
    frame = kit.frame_from(centre, (0.0, 0.0, 1.0), a)  # local z up, local y along

    def lower_toe(p, d):
        if p.z > 0:
            p.z *= 1.0 - toe * max(0.0, d.y)
        return p

    return kit.blob(part, material, None, half[0], half[1], (half[2], half[2] * 1.2), res=res, frame=frame,
                    ex=0.85, ey=0.9, ez=(0.45, 0.9), deform=lower_toe)


def sphere_cap(kit, part, material, centre, axis, radius, ang_u, ang_v, rings, lifts, segments=16,
               up=(0.0, 0.0, 1.0)):
    """An oval patch on the sphere (centre, radius) round `axis`: ring k
    at fraction rings[k] of the angular half sizes (ang_u toward `up`,
    ang_v across), lifts[k] above the sphere (the last negative, tucked
    under it). On an exact sphere its outline is an exact, even ring."""
    a = Vector(axis).normalized()
    u = Vector(up) - a * Vector(up).dot(a)
    u.normalize()
    v = a.cross(u)
    verts, rows = [], []
    for t, lift in zip(rings, lifts):
        ids = []
        for j in range(1 if t == 0 else segments):
            phi = 2 * math.pi * j / segments
            ang = t * ang_u * ang_v / math.hypot(ang_v * math.cos(phi), ang_u * math.sin(phi))
            d = a * math.cos(ang) + (u * math.cos(phi) + v * math.sin(phi)) * math.sin(ang)
            ids.append(len(verts))
            verts.append(centre + d * (radius + lift))
        rows.append(ids)
    faces = []
    for lower, upper in zip(rows, rows[1:]):
        faces += kit._stitch(lower, upper)
    p0, p1, p2 = (verts[i] for i in faces[0])
    if (p1 - p0).cross(p2 - p0).dot(a) < 0:
        faces = [list(reversed(f)) for f in faces]
    part.add(verts, faces, material)


def eye_on_dome(kit, eye_part, glint_part, dome, look):
    """A big ink eye on an eye dome and its glint, both exact sphere caps
    (`sphere_cap`): the eye is large for the dome's curve, so pads
    projected onto the faceted dome left a ragged glint."""
    sphere_cap(kit, eye_part, M["ink"], dome, look, DOME_R, *EYE_ANG, EYE_RINGS, EYE_LIFT, segments=16)
    u = Vector((0.0, 0.0, 1.0)) - look * look.z
    u.normalize()
    # +X is the viewer's left from the front of a frog facing +Y; the same
    # world direction on both eyes
    left = Vector((1.0, 0.0, 0.0)) - look * look.x - u * u.x
    left.normalize()
    axis = (look + u * math.tan(EYE_ANG[0] * GLINT_AT[0]) + left * math.tan(EYE_ANG[1] * GLINT_AT[1])).normalized()
    sphere_cap(kit, glint_part, M["glint"], dome, axis, DOME_R, *GLINT_ANG, (0.0, 0.7, 1.0), GLINT_LIFT,
               segments=12)


def smile_outline(a):
    """Radius of the lower-face pad at angle `a` (0 up): inside both the
    mouth line u <= SMILE_UP + SMILE_K v^2 and the ellipse under it."""
    cu, sv = math.cos(a), math.sin(a)
    lo, hi = 0.0, 1.0
    for _ in range(40):
        t = (lo + hi) / 2
        u, v = cu * t, sv * t
        inside = (u / FACE_U) ** 2 + (v / FACE_V) ** 2 <= 1.0 and u <= SMILE_UP + SMILE_K * v * v
        lo, hi = (t, hi) if inside else (lo, t)
    return lo


def build(kit, party_style):
    objects = list(bpy.data.objects)
    space = kit.clip_pose_space(objects, "Frog_Idle", 1)

    def P(name):
        return space[name].translation.copy()

    parts = {o.name: kit.Part(o.name) for o in objects if o.type == "MESH"}

    # body: one squat bean; the low rear flanks flare into the haunches and
    # the back rises a little toward the rump
    def haunches(p, d):
        flare = math.exp(-((d.y + 0.45) / 0.45) ** 2) * kit.smoothstep(0.45, -0.35, d.z)
        p.x *= 1.0 + HAUNCH * flare
        if p.z > 0:
            p.z *= 1.0 + 0.1 * max(0.0, -d.y)
        return p

    kit.blob(parts["Frog_Body"], M["skin"], BODY_C, deform=haunches, **BODY)
    body = kit.Surface(parts["Frog_Body"])
    kit.hidden_nub(parts["Frog_Belly"], M["gold"], BODY_C + Vector((0.0, 0.0, -0.05)))
    core = BODY_C + Vector((0.0, 0.0, -0.08))
    for direction, radius, squash, harmonics in SPOTS:
        kit.decal(parts["Frog_BackSpots"], M["dark"], body, core, direction, radius, squash=squash,
                  harmonics=harmonics, rings=2, segments=12, inner_segments=6, lift=0.014, tuck=0.012,
                  shoulder=0.03)

    # head with its eye domes
    head_form(kit, parts["Frog_Head"], M["skin"])
    head = kit.Surface(parts["Frog_Head"])

    # eyes, glints; lids and pupils are hidden nubs inside the domes
    for side, sx in SIDES:
        dome = Vector((sx * DOME_C.x, DOME_C.y, DOME_C.z))
        look = Vector((sx * EYE_DIR.x, EYE_DIR.y, EYE_DIR.z)).normalized()
        eye_on_dome(kit, parts[f"Frog_Eye_{side}"], parts[f"Frog_EyeGlint_{side}"], dome, look)
        kit.hidden_nub(parts[f"Frog_Pupil_{side}"], M["ink"], dome)
        kit.hidden_nub(parts[f"Frog_Eyelid_{side}"], M["skin"], dome + Vector((0.0, -0.03, 0.0)))

    # lower face: cream, its top edge the smile
    face_core = HEAD_C + Vector((0.0, 0.0, 0.02))
    face_at = HEAD_C + FACE_AT.normalized()
    kit.pad(parts["Frog_Muzzle"], M["gold"], head, face_at, face_core, 1.0, 1.0, 0.012, u_hint=(0, 0, 1),
            rim=0.012, segments=22, rings=(0.0, 0.3, 0.55, 0.75, 0.9, 1.0), lift=(1.0, 1.0, 1.0, 0.95, 0.6, None),
            outline=smile_outline)

    # throat sac under the chin, on the throat pivot (Frog_Croak puffs it)
    tc = P("Frog_ThroatPivot")
    kit.blob(parts["Frog_Throat"], M["gold"], tc + Vector((0.0, 0.03, 0.0)), *THROAT_R, res=(3, 2, 2), ex=0.95,
             ey=0.95, ez=0.95)

    # arms and pad hands on the front leg pivots
    for side, sx in SIDES:
        pivot = P(f"Frog_FrontLegPivot_{side}")
        # close in front of the pivot: Frog_Hop turns the arm 0.42 rad, and a
        # hand far ahead of it would dig into the ground
        hand = Vector((sx * 0.25, 0.335, HAND[2] + 0.008))
        kit.capsule(parts[f"Frog_FrontArm_{side}"], M["skin"], pivot, ARM_R, hand + Vector((0.0, -0.03, 0.03)),
                    ARM_R * 0.9, segments=8, arc=1, mid=1)
        pad_blob(kit, parts[f"Frog_FrontFoot_{side}"], M["light"], hand + Vector((sx * 0.01, 0.02, 0.0)), HAND,
                 (3, 2, 2), along=(sx * 0.3, 1.0, 0.0), toe=0.4)

    # hind legs: a thigh from the hip pivot through the haunch to the heel
    # (it shows when Frog_Hop kicks), and a long pad foot along the flank,
    # its heel close under the pivot so the crouch's 0.42 rad turn does not
    # dig it into the ground
    for side, sx in SIDES:
        # moved in along the pivot's swing axis (X), so the hip ball stays in
        # the haunch however Frog_Hop turns it
        hip = P(f"Frog_RearLegPivot_{side}") + Vector((-sx * 0.06, 0.0, 0.0))
        knee = Vector((sx * 0.33, -0.24, 0.075))  # the heel, inside the foot
        kit.capsule(parts[f"Frog_RearThigh_{side}"], M["skin"], hip, THIGH_R, knee, THIGH_R * 0.85, segments=8,
                    arc=1, mid=1)
        pad_blob(kit, parts[f"Frog_RearFoot_{side}"], M["light"], Vector((sx * 0.4, -0.1, FOOT[2])), FOOT,
                 (3, 3, 2), along=(sx * 0.35, 1.0, 0.0), toe=0.45)

    kit.rebuild_all(parts, space)
    kit.apply_colours(party_style, COLOURS)


def check(kit):
    objects = list(bpy.data.objects)
    idle = kit.clip_pose_space(objects, "Frog_Idle", 1)
    kit.size_report(PREFIX, REFERENCE, space=idle)
    kit.proportion_report("Frog_Body", ["Frog_Head"], space=idle)
    kit.triangle_report(PREFIX, BUDGET)
    kit.thickness_report(PREFIX, SCALE)
    legs = [f"Frog_RearThigh_{s}" for s in ("L", "R")]
    feet = [f"Frog_FrontFoot_{s}" for s in ("L", "R")] + [f"Frog_RearFoot_{s}" for s in ("L", "R")]
    # the arms hang from the chest under the head, the hands and feet from
    # their arms and thighs, the throat sac from the chin
    joints = [("Frog_FrontArm_L", "Frog_Head"), ("Frog_FrontArm_R", "Frog_Head"),
              ("Frog_FrontArm_L", "Frog_FrontFoot_L"), ("Frog_FrontArm_R", "Frog_FrontFoot_R"),
              ("Frog_RearThigh_L", "Frog_RearFoot_L"), ("Frog_RearThigh_R", "Frog_RearFoot_R"),
              ("Frog_Throat", "Frog_Head")]
    kit.clip_report("Frog_Body", "Frog_Head", legs, feet, [], joints=joints)
