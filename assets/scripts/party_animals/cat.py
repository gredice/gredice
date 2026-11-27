"""Cat: a round tuxedo kitten figurine.

The cat is animated by GLB clips (Cat_Idle, Cat_Walk, Cat_LyingIdle,
Cat_PreyWatch, ...) and its stored pose is the end of a crouch, so it is
designed in the Cat_Idle pose (frame 1), which is how it stands in the game:
Blender world, +Z up, facing -Y, its L nodes on -X. Cat_Idle does not
animate the legs, so they keep their stored tuck of 0.663 rad; the legs are
short and the white socks sit under the body, so the tuck reads as a stance.
Legs,
paws and tail slices are authored in their own pivot frames, so every clip
moves them cleanly. Runtime scale 0.42 (entities/cats/Cats.tsx), so 0.03
game units is 0.071 model units. The runtime tints BlackFur and BlackFurSoft
to #454a59 and #4e5363; the file authors the same albedo.

A short round bean body (length about 1.35 times its height, high full
haunches; a long low body read as a log), a big round head that overlaps
the chest and reaches back over it, tall rounded-triangle ears with a
lining that follows them, green eyes with an ink pupil raised so the iris
shows as a crescent, a glint, pink blush and nose on a big two-puff white
muzzle, tall white socks and one smooth tail with a white tip, so the dark
cat keeps light accents at the face and the ends at night.

The face is tuned to the game camera (about 30 to 35 degrees above): the
eyes sit at the middle of the head and are 36% of its height, so from above
they do not shrink into the lower third of a dark head. Cat_ChestPatch and
Cat_BellyPatch are hidden nubs: the big head hides the chest from a camera
30 degrees up and the belly faces the ground, so no game view showed them.
"""

import math

import bpy
from mathutils import Vector

PREFIX = "Cat_"
SCALE = 0.42  # catScale in entities/cats/Cats.tsx
BUDGET = 3000
# The model this design replaced, in Cat_Idle: width x, length y, height z.
REFERENCE = (0.72, 1.71, 1.28)

M = {
    "fur": "Material.Cat.BlackFur",
    "fur_soft": "Material.Cat.BlackFurSoft",
    "white": "Material.Cat.WhiteFur",
    "white2": "Material.Cat.WhiteFurShadow",
    "iris": "Material.Cat.EyeGreen",
    "pupil": "Material.Cat.Pupil",
    "pink": "Material.Cat.Pink",
    "glint": "Material.Cat.Whisker",
}

COLOURS = {
    # warm enough to keep saturation 0.10 or more on screen under the cool fill
    M["white"]: ("#f2ddbe", 0.8),  # 0.13 to 0.15 on screen at noon; #f2e2c8 read 0.08 to 0.11
    M["white2"]: ("#e8d4b5", 0.8),
    M["pink"]: ("#f49aa6", 0.55),
    M["iris"]: ("#a8dd5a", 0.35),
    M["pupil"]: ("#5c4590", 0.35),
    M["glint"]: ("#fff4dc", 0.35),
    # tinted at runtime (catDarkFurColor, catSoftDarkFurColor): author the albedo itself
    M["fur"]: ("#454a59", 0.82, "albedo"),
    M["fur_soft"]: ("#4e5363", 0.82, "albedo"),
}

SIDES = (("L", -1.0), ("R", 1.0))  # the cat's L nodes are on -X
LEG_INWARD = 0.05
LEG_R = 0.085
# Sole 0.31 below the hip (pivot-local): paws meet the ground both tucked
# (Idle, 0.663 rad) and straight (Walk).
SOLE = -0.31
PAW_R, PAW_H = 0.11, 0.2  # tall white socks
# Legs and paws: 12 segments where the dark leg meets the white sock, 16 on
# the paw rings that draw its outline, 8 on the sole (`kit.lathe_rings`).
LEG_SEGMENTS = 12
PAW_RINGS = (1, 8, 16, 16, 16, 14, LEG_SEGMENTS)
EYE_H, EYE_W = 0.22, 0.18  # 36% of the head height: big from the game camera
GLINT = 0.095  # visible part >= 0.071 model units (0.03 game units)


def build(kit, party_style):
    objects = list(bpy.data.objects)
    space = kit.clip_pose_space(objects, "Cat_Idle", 1)

    def P(name):
        return space[name].translation.copy()

    parts = {o.name: kit.Part(o.name) for o in objects if o.type == "MESH"}
    body_c = P("Cat_BodyPivot") + Vector((0.0, 0.04, -0.02))
    head_c = P("Cat_HeadPivot") + Vector((0.0, -0.07, 0.11))

    # body: a short round bean, its back raised into a full haunch and its
    # chest rising into the head; the leg pivots fix the length, so the
    # bean reads short by height, not by cutting the ends
    def bean(p, d):
        if p.z > 0:
            p.z *= 1.0 + 0.14 * d.y  # high, full haunch
        # a full low chest under the head that holds the front leg tops
        p.y *= 1.0 + 0.12 * max(0.0, -d.y) * max(0.0, 0.5 - d.z) / 1.5
        return p

    kit.blob(parts["Cat_Body"], M["fur_soft"], body_c, 0.285, (0.45, 0.42), (0.23, 0.44), ex=0.9, ey=(0.85, 0.85),
             ez=(0.72, 0.9), res=6, taper={"y": ("x", 0.1)}, deform=bean)
    # no bib or belly patch: the head hides the chest and the belly faces
    # the ground, so the light accents live on the muzzle, socks and tail tip
    kit.hidden_nub(parts["Cat_ChestPatch"], M["white"], body_c + Vector((0.0, -0.1, 0.05)))
    kit.hidden_nub(parts["Cat_BellyPatch"], M["white2"], body_c + Vector((0.0, 0.0, 0.05)))

    # legs: short round legs on the hip pivots, standing in white mitten
    # paws that meet them on one clean circle
    for side in ("FL", "FR", "RL", "RR"):
        pivot = space[f"Cat_LegPivot_{side}"]
        inward = -LEG_INWARD if pivot.translation.x > 0 else LEG_INWARD
        kit.pivot_leg(parts[f"Cat_Leg_{side}"], M["fur"], pivot, LEG_R, -(SOLE + PAW_H), inward=inward,
                      segments=LEG_SEGMENTS, arc=1)
        kit.pivot_foot_rings(parts[f"Cat_Paw_{side}"], M["white"], pivot, inward, SOLE,
                             kit.paw_profile(PAW_R, PAW_H, LEG_R), PAW_RINGS, sections=kit.PAW_TOE)

    # tail: one smooth curve through the three pivots, cut per pivot, with
    # a white club tip that curls a little forward
    tb, tm, tt = P("Cat_TailPivot_Base"), P("Cat_TailPivot_Mid"), P("Cat_TailPivot_Tip")
    tip_end = tt + (tt - tm).normalized() * 0.1 + Vector((0.0, -0.07, 0.01))
    lead_in = body_c + Vector((0.0, 0.32, 0.08))

    def tail_radius(t):
        return 0.072 - 0.012 * t + 0.012 * kit.smoothstep(0.82, 1.0, t)

    kit.sliced_tail([tb, tm, tt, tip_end], tail_radius,
                    [(parts["Cat_Tail_Base"], M["fur_soft"]), (parts["Cat_Tail_Mid"], M["fur_soft"]),
                     (parts["Cat_Tail_Tip"], M["white"])],
                    lead_in=lead_in, samples=3, segments=10, cap_rings=2, collar="ring")

    # head: one big round form, a little wider at the cheeks, reaching back
    # over the chest so the body behind it reads short
    kit.blob(parts["Cat_Head"], M["fur_soft"], head_c, 0.375, (0.31, 0.38), (0.31, 0.33), ex=0.92, ey=0.95, ez=0.92,
             res=6, taper={"z": ("x", -0.08)})
    head = kit.Surface(parts["Cat_Head"])

    # muzzle: a big white puff that frames the nose
    muzzle_c = head_c + Vector((0.0, -0.235, -0.11))

    def two_puffs(p, d):
        # a soft notch under the nose splits the muzzle into two cheek puffs
        if p.z < 0:
            p.z += 0.03 * math.exp(-(p.x / 0.045) ** 2) * (-p.z / 0.095)
        return p

    kit.blob(parts["Cat_Muzzle"], M["white"], muzzle_c, 0.17, (0.11, 0.07), (0.095, 0.085), ex=0.9, ez=0.9, res=4,
             deform=two_puffs)
    muzzle = kit.Surface(parts["Cat_Muzzle"])
    nose_c, _ = muzzle.project(muzzle_c, muzzle_c + Vector((0.0, -1.0, 0.75)))
    kit.blob(parts["Cat_Nose"], M["pink"], nose_c, 0.058, 0.04, (0.036, 0.042), res=2, taper={"z": ("x", 0.35)})

    # ears: tall rounded triangles with a pink lining that follows them
    for side, sx in SIDES:
        base = head_c + Vector((sx * 0.19, 0.03, 0.19))
        tip = base + Vector((sx * 0.1, 0.03, 0.3))
        kit.cone_ear(parts[f"Cat_Ear_{side}"], parts[f"Cat_InnerEar_{side}"], M["fur_soft"], M["pink"], base, tip,
                     0.145, 0.045, face=(0.0, -1.0, 0.15), flatten=0.55, inner=(0.62, 0.62), segments=14)

    # eyes: green iris, ink pupil raised so the iris shows as a crescent,
    # glint on the Eyelid node; blush on Whisker_1; Whisker_2/3 are unused
    for side, sx in SIDES:
        kit.eye(parts[f"Cat_Eye_{side}"], parts[f"Cat_Eyelid_{side}"], head, head_c + Vector((sx * 0.03, 0.0, 0.0)),
                head_c + Vector((sx * 0.155, -0.5, 0.065)), EYE_H, EYE_W, M["iris"], M["glint"], glint_size=GLINT,
                dome=0.014, segments=12, pupil=(parts[f"Cat_Pupil_{side}"], M["pupil"], 0.6, 0.62, 0.18))
        kit.blush(parts[f"Cat_Whisker_{side}_1"], M["pink"], head, head_c,
                  head_c + Vector((sx * 0.26, -0.24, -0.08)), 0.085, 0.115, segments=12)
        for k in (2, 3):
            kit.hidden_nub(parts[f"Cat_Whisker_{side}_{k}"], M["glint"], head_c + Vector((sx * 0.08, 0.0, -0.02 * k)))

    kit.rebuild_all(parts, space)
    kit.apply_colours(party_style, COLOURS)


def check(kit):
    objects = list(bpy.data.objects)
    idle = kit.clip_pose_space(objects, "Cat_Idle", 1)
    kit.size_report(PREFIX, REFERENCE, space=idle)
    kit.proportion_report("Cat_Body", ["Cat_Head", "Cat_Muzzle"], space=idle)
    kit.triangle_report(PREFIX, BUDGET)
    kit.thickness_report(PREFIX, SCALE)
    legs = [f"Cat_Leg_{s}" for s in ("FL", "FR", "RL", "RR")]
    feet = [f"Cat_Paw_{s}" for s in ("FL", "FR", "RL", "RR")]
    kit.clip_report("Cat_Body", "Cat_Head", legs, feet, ["Cat_Tail_Base"])
