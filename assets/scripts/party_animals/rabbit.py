"""Rabbit: a round bunny figurine with big upright ears.

Design space is the stored pose: `entities/rabbits/Rabbit.tsx` poses the rig
in code and the file has no clips. Blender world, +Z up, the rabbit faces
-Y, its L nodes are on +X (Rabbit_Root is turned 180 degrees, so the leg
pivots' local +Y points backward). Runtime scale 0.55 * 0.6 = 0.33
(rabbitScale), so 0.03 game units is 0.091 model units: the rabbit is small
on screen, so every part is chunky.

One soft body whose back rises in one arc to a high round rump, one big
round head that overlaps the chest, two tall leaf ears splayed into a V
like the avatar's (`bunny_ear`: a pillow `slab` with a pink lining `pad`
that follows its outline, lined face forward), big ink eyes with a glint,
pink blush, a pink nose on two cream cheek puffs, short cream front socks,
long cream hind feet under a round haunch, and one cotton ball tail.

The haunch is the hind leg: a closed, domed oval lathe on the hip pivot,
longer along the body than tall, its axis close to the pivot's swing axis so
a hop turns it almost in place. The axis tilts a little up and back, so the
top of the oval sinks into the flank and its lower part bulges out: from
behind, rump and haunches read as one pear shape, not two plates. Its inner
side is rounded too, because the bottom shows under the belly. The foot's
heel sits inside it, so a kick never opens a gap.

Node jobs: Rabbit_Whiskers carries the two cheek puffs (whiskers 0.03 game
units thick would be 0.091 model units, thicker than the nose), so they
twitch with the nose; Rabbit_Muzzle carries the blush. Rabbit_Haunch_* and
Rabbit_Chest are hidden nubs: the haunch is the hind leg node, and the head
hides the chest from the game camera.

The runtime recolours FurPrimary, FurSecondary and InnerEar per coat
(`rabbitCoatPalettes` in Rabbit.tsx); the file authors coat 0's albedo
itself, so the file matches the game.
"""

import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

PREFIX = "Rabbit_"
SCALE = 0.33  # rabbitScale in entities/rabbits/Rabbit.tsx (0.55 * 0.6)
BUDGET = 3000
# The model this design replaced, at rest: width x, length y, height z.
REFERENCE = (0.88, 1.67, 1.475)

M = {
    "fur": "Material.Rabbit.FurPrimary",
    "light": "Material.Rabbit.FurSecondary",
    "pink": "Material.Rabbit.InnerEar",
    "ink": "Material.Rabbit.Charcoal",
    "glint": "Material.Rabbit.EyeGlint",
}

COLOURS = {
    # tinted at runtime (rabbitCoatPalettes[0]): author the albedo itself
    M["fur"]: ("#87532f", 0.8, "albedo"),
    M["light"]: ("#aa9c83", 0.8, "albedo"),
    M["pink"]: ("#a65f65", 0.8, "albedo"),
    M["ink"]: ("#5c4590", 0.35),
    M["glint"]: ("#fff4dc", 0.35),
}

SIDES = (("L", 1.0), ("R", -1.0))  # the rabbit's L nodes are on +X

BODY_C = Vector((0.0, 0.10, 0.42))
HEAD_C = Vector((0.0, -0.46, 0.72))
PUFF_C = Vector((0.0, -0.77, 0.575))
TAIL_C = Vector((0.0, 0.595, 0.50))

EYE_H, EYE_W = 0.24, 0.19  # about 37% of the head height: big from the game camera
GLINT = 0.105  # its 12-gon is >= 0.091 model units (0.03 game units) across

LEG_R = 0.066
PAW_R, PAW_H = 0.092, 0.14  # tall cream socks
# A paw whose sole nobody sees: five rings from the sole to the leg, the last
# one rounding the shoulder the camera sees.
PAW_PROFILE = [(0.0, 0.0), (PAW_R * 0.8, 0.004), (PAW_R, PAW_H * 0.4), (PAW_R * 0.93, PAW_H * 0.68),
               (PAW_R * 0.8, PAW_H * 0.87), (LEG_R, PAW_H)]
# Segments per profile ring: 16 on the widest rings, which draw the sock's
# outline, stepping down to the leg's 10 (a 10-sided paw read as a polygon).
PAW_RINGS = (1, 8, 16, 14, 12, 10)
# The toe reaches 0.03 forward, along the leg frame's +Y here (see above).
PAW_TOE = [(1.0, 1.18, 0.03), (1.0, 1.16, 0.028), (1.0, 1.1, 0.017), (1.0, 1.04, 0.007), (1.0, 1.01, 0.002),
           (1.0, 1.0, 0.0)]

# Haunch (hind leg) lathe: centre moved out along the swing axis and lifted,
# axis tilt (y, z) per unit x, its (radius, height) profile from the buried
# inner pole to the outer pole, and the scale of its section (along the body,
# up). 22 segments keep the oval's outline round at the closest zoom.
THIGH_OUT = 0.01
THIGH_TILT = (0.15, 0.25)
THIGH_PROFILE = [(0.0, -0.11), (0.17, -0.095), (0.245, -0.04), (0.25, 0.02), (0.215, 0.09), (0.135, 0.14),
                 (0.0, 0.16)]
THIGH_SEGMENTS = 22
THIGH_SCALE = (1.08, 0.88)
THIGH_LIFT = 0.01


def ear_frame(base, axis, face, half_length, k):
    """Frame at the ear's centre: X along the ear, Z the lined face."""
    u = Vector(axis).normalized()
    n = Vector(face) - u * Vector(face).dot(u)
    n.normalize()
    v = n.cross(u).normalized()
    o = Vector(base) + u * (half_length * (1 - k))
    return Matrix((
        (u.x, v.x, n.x, o.x),
        (u.y, v.y, n.y, o.y),
        (u.z, v.z, n.z, o.z),
        (0.0, 0.0, 0.0, 1.0),
    ))


def bunny_ear(kit, ear_part, lining_part, base, axis, face, length, width, thickness, k=0.12,
              lining=(0.74, 0.58), segments=24, lining_segments=20):
    """A tall leaf ear and a pink lining that follows its outline.

    The ear is a pillow `slab` from `base` (buried in the head) along `axis`,
    `length` long and `width` wide, a little wider toward the tip (`k`), its
    flat face toward `face`. The lining is a `pad` on that face with the same
    outline scaled by `lining` (length, width), so it reads as the ear's
    inside, not a sticker; its rim rolls under the ear surface.
    """
    ru, rv = length / 2, width / 2
    frame = ear_frame(base, axis, face, ru, k)

    def g(a):
        return 1.0 + k * math.cos(a)

    outline = [(ru * math.cos(a) * g(a), rv * math.sin(a) * g(a))
               for a in (2 * math.pi * i / 32 for i in range(32))]
    kit.slab(ear_part, M["fur"], frame, outline, thickness, segments=segments, rings=(0.55, 0.88), cap=2.4)
    surface = kit.Surface(ear_part)
    u = frame.to_3x3() @ Vector((1.0, 0.0, 0.0))
    n = frame.to_3x3() @ Vector((0.0, 0.0, 1.0))
    centre = frame.translation + u * (ru * 0.1)
    kit.pad(lining_part, M["pink"], surface, centre, centre + n * 0.4, ru * lining[0], rv * lining[1], 0.012,
            u_hint=u, rim=0.012, rings=(0.0, 0.6, 0.9, 1.0), lift=(1.0, 0.9, 0.45, None),
            segments=lining_segments, outline=g, project="parallel")
    return frame


def rabbit_eye(kit, eye_part, glint_part, surface, core, target, height, width, glint_size, glint_up=0.19,
               glint_side=0.13, dome=0.016, segments=16):
    """`kit.eye` with the glint closer to the eye's centre: at the rabbit's
    scale the glint must be 0.091 model units across, half the eye's width,
    and `kit.eye`'s placement would push it over the eye's rim."""
    centre, normal = kit.pad(eye_part, M["ink"], surface, target, core, height / 2, width / 2, 0.01,
                             u_hint=(0, 0, 1), rim=0.012, dome=dome, segments=segments,
                             rings=(0.0, 0.6, 0.9, 1.0), lift=(1.0, 0.85, 0.35, None))
    up = Vector((0, 0, 1)) - normal * normal.z
    up.normalize()
    side = Vector((-1.0, 0.0, 0.0)) - normal * normal.dot(Vector((-1.0, 0.0, 0.0)))
    side = side - up * up.dot(side)
    side.normalize()
    glint_centre = centre + up * (height * glint_up) + side * (width * glint_side)
    kit.pad(glint_part, M["glint"], kit.Surface(eye_part), glint_centre, centre + normal * 0.4, glint_size * 0.56,
            glint_size / 2, 0.007, u_hint=(0, 0, 1), rim=0.006, segments=12, rings=(0.0, 0.7, 1.0),
            lift=(1.0, 0.75, None))
    return centre, normal


def build(kit, party_style):
    objects = list(bpy.data.objects)
    space = kit.design_space(objects)

    def P(name):
        return space[name].translation.copy()

    parts = {o.name: kit.Part(o.name) for o in objects if o.type == "MESH"}

    # body: one soft form, its back rising in one arc to a high round rump,
    # a little wider at the haunches, with a fuller low chest that holds the
    # front leg tops (the leg pivots fix how long it must be)
    def body_shape(p, d):
        if p.z > 0:
            p.z *= 0.84 + 0.3 * math.exp(-((d.y - 0.3) / 0.7) ** 2)
        p.y *= 1.0 + 0.2 * max(0.0, -d.y) * max(0.0, 0.5 - d.z) / 1.5
        p.x *= 1.0 + 0.12 * math.exp(-((d.y - 0.45) / 0.45) ** 2) * math.exp(-((d.z + 0.3) / 0.5) ** 2)
        return p

    kit.blob(parts["Rabbit_Body"], M["fur"], BODY_C, 0.30, (0.46, 0.44), (0.34, 0.34), ex=0.9, ey=(0.85, 0.95),
             ez=(0.6, 0.9), res=6, taper={"y": ("x", 0.1)}, deform=body_shape)
    for side, sx in SIDES:
        kit.hidden_nub(parts[f"Rabbit_Haunch_{side}"], M["fur"], BODY_C + Vector((sx * 0.1, 0.2, 0.0)))
    kit.hidden_nub(parts["Rabbit_Chest"], M["light"], BODY_C + Vector((0.0, -0.15, 0.0)))

    # front legs: short round legs on the hip pivots in tall cream socks
    for side, name in (("FL", "L"), ("FR", "R")):
        pivot = space[f"Rabbit_LegPivot_{side}"]
        hip = pivot.translation
        kit.pivot_leg(parts[f"Rabbit_FrontLeg_{name}"], M["light"], pivot, LEG_R, hip.z - PAW_H, arc=1)
        kit.pivot_foot_rings(parts[f"Rabbit_FrontPaw_{name}"], M["light"], pivot, 0.0, -hip.z, PAW_PROFILE,
                             PAW_RINGS, sections=PAW_TOE)

    # hind legs: a domed oval haunch on the hip pivot, sitting on a long cream
    # foot that lies flat on the ground, its heel inside the haunch
    for side, sx in SIDES:
        pivot = P(f"Rabbit_LegPivot_H{side}")
        frame = kit.frame_from(pivot + Vector((sx * THIGH_OUT, 0.0, THIGH_LIFT)),
                               (sx, THIGH_TILT[0], THIGH_TILT[1]), (0.0, 0.0, 1.0))
        kit.lathe(parts[f"Rabbit_HindLeg_{side}"], M["fur"], frame, THIGH_PROFILE, segments=THIGH_SEGMENTS,
                  scale_xy=THIGH_SCALE)
        kit.blob(parts[f"Rabbit_HindFoot_{side}"], M["light"], Vector((sx * 0.27, 0.07, 0.068)), 0.08,
                 (0.22, 0.21), (0.068, 0.07), ex=0.9, ey=0.9, ez=(0.5, 1.0), res=3, taper={"y": ("x", -0.14)})

    # tail: one cotton ball tucked into the rump
    kit.blob(parts["Rabbit_Tail"], M["light"], TAIL_C, 0.13, 0.12, 0.13, res=3, ex=0.95, ey=0.95, ez=0.95)

    # head: one big round form, a little fuller at the cheeks
    kit.blob(parts["Rabbit_Head"], M["fur"], HEAD_C, 0.39, (0.33, 0.32), (0.32, 0.33), ex=0.92, ey=0.95, ez=0.92,
             res=7, taper={"z": ("x", -0.08)})
    head = kit.Surface(parts["Rabbit_Head"])

    # cheek puffs on the nose pivot (they twitch with the nose) and a pink nose
    def two_puffs(p, d):
        if p.z < 0:
            p.z += 0.03 * math.exp(-(p.x / 0.045) ** 2) * (-p.z / 0.09)
        return p

    kit.blob(parts["Rabbit_Whiskers"], M["light"], PUFF_C, 0.17, (0.09, 0.08), (0.095, 0.09), ex=0.9, ez=0.9, res=4,
             deform=two_puffs)
    puffs = kit.Surface(parts["Rabbit_Whiskers"])
    nose_c, _ = puffs.project(PUFF_C, PUFF_C + Vector((0.0, -1.0, 0.75)))
    kit.blob(parts["Rabbit_Nose"], M["pink"], nose_c, 0.066, 0.042, (0.05, 0.056), res=3, taper={"z": ("x", 0.35)})

    # ears: tall leaves splayed into a V, leaning a little back, the lined
    # face forward so the pink shows from the game camera
    for side, sx in SIDES:
        bunny_ear(kit, parts[f"Rabbit_Ear_{side}"], parts[f"Rabbit_InnerEar_{side}"],
                  base=HEAD_C + Vector((sx * 0.14, 0.07, 0.18)), axis=(sx * 0.36, 0.14, 1.0),
                  face=(sx * 0.28, -1.0, 0.0), length=0.62, width=0.26, thickness=0.12)

    # eyes with glints, and blush on the Muzzle node
    for side, sx in SIDES:
        rabbit_eye(kit, parts[f"Rabbit_Eye_{side}"], parts[f"Rabbit_EyeGlint_{side}"], head,
                   HEAD_C + Vector((sx * 0.03, 0.0, 0.0)), HEAD_C + Vector((sx * 0.2, -0.3, 0.05)), EYE_H, EYE_W,
                   GLINT)
        kit.blush(parts["Rabbit_Muzzle"], M["pink"], head, HEAD_C, HEAD_C + Vector((sx * 0.27, -0.24, -0.11)),
                  0.1, 0.15, segments=12)

    kit.rebuild_all(parts, space)
    kit.apply_colours(party_style, COLOURS)


LEGS = ["Rabbit_FrontLeg_L", "Rabbit_FrontLeg_R", "Rabbit_HindLeg_L", "Rabbit_HindLeg_R"]
FEET = ["Rabbit_FrontPaw_L", "Rabbit_FrontPaw_R", "Rabbit_HindFoot_L", "Rabbit_HindFoot_R"]
JOINTS = [("Rabbit_Ear_L", "Rabbit_Head"), ("Rabbit_Ear_R", "Rabbit_Head"), ("Rabbit_Whiskers", "Rabbit_Head"),
          ("Rabbit_HindFoot_L", "Rabbit_HindLeg_L"), ("Rabbit_HindFoot_R", "Rabbit_HindLeg_R")]


def poses():
    """Extremes of animateRabbitRig in entities/rabbits/Rabbit.tsx, as the
    three.js node-local offsets it writes (see kit.apply_pose). A hop also
    lifts the whole rabbit 0.13 to 0.19 game units, so feet below 0 there
    never reach the ground."""
    def hop(stride, flee):
        out = {
            "Rabbit_BodyPivot": {"rot": (0.12 * stride, 0, 0), "pos": (0, 0.12 * abs(stride), 0)},
            "Rabbit_LegPivot_FL": (-0.5 * stride, 0, 0), "Rabbit_LegPivot_FR": (-0.5 * stride, 0, 0),
            "Rabbit_LegPivot_HL": (0.68 * stride, 0, 0), "Rabbit_LegPivot_HR": (0.68 * stride, 0, 0),
            "Rabbit_TailPivot": (-0.15 * stride, 0, 0),
        }
        if flee:
            out["Rabbit_EarPivot_L"] = (-0.72, 0, 0.18)
            out["Rabbit_EarPivot_R"] = (-0.66, 0, -0.18)
        return out

    def groom(turn):
        return {"Rabbit_HeadPivot": {"rot": (0.72, 0, turn), "pos": (0, -0.08, 0)},
                "Rabbit_LegPivot_FL": {"rot": (-0.82, 0, 0), "pos": (0, 0.09, 0)},
                "Rabbit_LegPivot_FR": {"rot": (-0.68, 0, 0), "pos": (0, 0.07, 0)},
                "Rabbit_EarPivot_L": (-0.2, 0, 0), "Rabbit_EarPivot_R": (-0.12, 0, 0)}

    def breathe(b):  # idleBreathingScale, animal amplitude 0.025
        return {"Rabbit_BodyPivot": {"scale": (1 - b / 2, 1 + b, 1 - b / 2)}}

    return {
        "rest": {},
        "hop +": hop(1.0, False),
        "hop -": hop(-1.0, False),
        "flee +": hop(1.0, True),
        "flee -": hop(-1.0, True),
        "groom +": groom(0.16),
        "groom -": groom(-0.16),
        "nibble, nose out": {"Rabbit_BodyPivot": (0.12, 0, 0),
                             "Rabbit_HeadPivot": {"rot": (0.5, 0, 0), "pos": (0, -0.055, 0)},
                             "Rabbit_NosePivot": {"scale": (1.055, 1.055, 1.055)}},
        "sniff, nose in": {"Rabbit_HeadPivot": (0.08, 0, 0), "Rabbit_NosePivot": {"scale": (0.945, 0.945, 0.945)}},
        "sit (feet sink)": {"Rabbit_BodyPivot": {"pos": (0, -0.025, 0)},
                            "Rabbit_LegPivot_HL": (0.12, 0, 0), "Rabbit_LegPivot_HR": (0.12, 0, 0)},
        "breathe in": breathe(0.025),
        "breathe out": breathe(-0.025),
        "ear twitch": {"Rabbit_EarPivot_L": (0.055, 0, 0.0385), "Rabbit_EarPivot_R": (-0.048, 0, 0.0336),
                       "Rabbit_TailPivot": (0.04, 0, 0)},
    }


def check(kit):
    # no clips, but pose from the rest the GLB carries (ROLLOUT notes)
    glb = Path(__file__).resolve().parents[3] / "apps/garden/public/assets/models/Rabbit.glb"
    print(f"CHECK rest pose: {kit.glb_rest_pose(glb)} nodes set from {glb.name}")
    kit.size_report(PREFIX, REFERENCE)
    kit.proportion_report("Rabbit_Body", ["Rabbit_Head", "Rabbit_Whiskers"])
    kit.triangle_report(PREFIX, BUDGET)
    kit.thickness_report(PREFIX, SCALE)
    kit.procedural_report("Rabbit_Body", "Rabbit_Head", LEGS, FEET, ["Rabbit_Tail"], poses(), joints=JOINTS)
