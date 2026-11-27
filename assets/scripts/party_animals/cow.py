"""Cow: a plush party figurine on stubby legs.

Design space is the stored pose (`entities/Cow.tsx` and `entities/cows/`
pose the rig in code): Blender world, +Z up, the cow faces -Y, its L nodes
are on +X. Runtime scale 0.66, so 0.03 game units is 0.045 model units.

One soft loaf body and one big round head that overlaps it (no neck lump),
a wide pink muzzle with an ink smile, tall ink eyes with a glint, blush,
leaf ears with a lining, chunky horns, round legs standing in hoof pucks
and three bold patches that wrap over the back so the top-down camera sees
them.
Both coat nodes share one patch geometry (the runtime shows one of them).

The face is tuned to the game camera, not a front view: grazing pitches the
head 64 degrees down (entities/cows/cowPose.ts), so the camera sees the
crown. The eyes sit high on the face and the big ears stand out level from
the crown with their pink lining facing up, so a grazing cow still shows
eyes, pink and gold from above. The tail ends in a soft cream puff at hock
height (a dark tuft near the ground read as a fifth hoof).
"""

import math

import bpy
from mathutils import Vector

PREFIX = "Cow_"
SCALE = 0.66  # cowModelScale in entities/Cow.tsx
BUDGET = 3000
# The model this design replaced, at rest: width x, length y, height z.
REFERENCE = (1.68, 3.27, 2.03)

M = {
    "fur": "Material.Cow.CreamLight",
    "fur2": "Material.Cow.Cream",
    "brown": "Material.Cow.Brown",
    "black": "Material.Cow.Black",
    "eye": "Material.Cow.Eye",
    "glint": "Material.Cow.EyeGlint",
    "hoof": "Material.Cow.Hoof",
    "horn": "Material.Cow.Horn",
    "pink": "Material.Cow.InnerEar",
    "muzzle": "Material.Cow.Muzzle",
    "udder": "Material.Cow.Udder",
}

# On-screen colour of a sunlit face, roughness band (GAME_ART.md).
COLOURS = {
    # warm enough to keep saturation 0.10 or more on screen under the cool fill
    M["fur"]: ("#f2e0c0", 0.8),
    M["fur2"]: ("#eddab8", 0.8),
    M["brown"]: ("#c46c3a", 0.8),
    M["black"]: ("#73708f", 0.8),
    M["eye"]: ("#5c4590", 0.35),
    M["glint"]: ("#fff4dc", 0.35),
    M["hoof"]: ("#8e6f80", 0.55),
    M["horn"]: ("#efbd62", 0.55),
    M["pink"]: ("#f59a92", 0.8),
    M["muzzle"]: ("#f6a59a", 0.45),
    M["udder"]: ("#f6a59a", 0.55),
}

BODY_C = Vector((0.0, 0.07, 0.87))
BODY = dict(rx=0.49, ry=(0.88, 0.86), rz=(0.63, 0.58), ex=0.86, ey=(0.74, 0.8), ez=(0.56, 0.85), res=(5, 7, 5),
            taper={"y": ("x", 0.04)})
HEAD_C = Vector((0.0, -1.05, 1.44))
HEAD = dict(rx=0.62, ry=(0.52, 0.50), rz=(0.55, 0.53), ex=0.9, ey=0.92, ez=0.9, res=6,
            taper={"z": ("x", -0.06)})
MUZZLE_C = HEAD_C + Vector((0.0, -0.46, -0.33))
MUZZLE = dict(rx=0.46, ry=(0.28, 0.20), rz=(0.25, 0.23), ex=0.85, ey=0.9, ez=0.85, res=4)
EYE_X, EYE_Z = 0.34, HEAD_C.z + 0.2  # high, so the eyes still show when grazing
EYE_H, EYE_W = 0.31, 0.24  # 29% of the head height
LEG_INWARD = 0.12  # legs sit under the loaf; moved only along the swing axis
LEG_R, LEG_TOP_R = 0.145, 0.125  # a little wider at the hoof, like a toy
HOOF_R, HOOF_H = 0.19, 0.15

# Coat patches: (core y, direction from the core, angular radius, harmonics,
# squash, orientation hint). Big shapes that wrap over the back and flank.
PATCHES = [
    (0.35, (0.45, 0.15, 1.0), 0.62, ((2, 0.12, 0.4), (3, 0.07, 1.3)), (1.0, 1.15), (0, 1, 0)),
    (-0.30, (-1.0, -0.15, 0.6), 0.52, ((2, 0.13, 1.1), (3, 0.06, 0.2)), (1.0, 1.1), (0, 0, 1)),
    (-0.45, (1.0, -0.35, 0.35), 0.36, ((2, 0.1, 0.3), (3, 0.05, 2.0)), (1.0, 1.0), (0, 0, 1)),
]

SIDES = (("L", 1.0), ("R", -1.0))  # the cow's L nodes are on +X


def build(kit, party_style):
    objects = list(bpy.data.objects)
    space = kit.design_space(objects)

    def P(name):
        return space[name].translation.copy()

    parts = {o.name: kit.Part(o.name) for o in objects if o.type == "MESH"}

    # body: one soft loaf, belly low and flat, rump a little fuller
    kit.blob(parts["Cow_Body"], M["fur"], BODY_C, **BODY)
    body = kit.Surface(parts["Cow_Body"])
    kit.hidden_nub(parts["Cow_Chest"], M["fur"], BODY_C + Vector((0, -0.3, 0)), 0.05)
    kit.hidden_nub(parts["Cow_Shoulders"], M["fur2"], BODY_C + Vector((0, -0.2, 0.05)), 0.05)

    coat = kit.Part("coat")
    for core_y, direction, radius, harmonics, squash, up in PATCHES:
        kit.decal(coat, M["brown"], body, Vector((0.0, core_y, BODY_C.z - 0.1)), direction, radius,
                  harmonics=harmonics, squash=squash, up=up, rings=3, segments=20, inner_segments=12, lift=0.02,
                  tuck=0.014)
    parts["Cow_Coat_BrownPatches"] = coat.recoloured(M["brown"])
    parts["Cow_Coat_BlackPatches"] = coat.recoloured(M["black"])

    # udder: a small pink bean between the hind legs; teats hide inside it
    kit.blob(parts["Cow_Udder"], M["udder"], Vector((0.0, 0.38, 0.31)), 0.17, 0.15, 0.12, res=2)
    kit.hidden_nub(parts["Cow_Teats"], M["udder"], Vector((0.0, 0.38, 0.34)), 0.04)

    # legs: round legs whose top sphere sits on the hip pivot, standing in
    # hoof pucks that meet them on one clean circle
    for side in ("FL", "FR", "RL", "RR"):
        pivot = space[f"Cow_LegPivot_{side}"]
        hip = pivot.translation
        local_x = pivot.to_3x3() @ Vector((1.0, 0.0, 0.0))
        inward = Vector((-LEG_INWARD if hip.x > 0 else LEG_INWARD, 0.0, 0.0)).dot(local_x)
        kit.pivot_leg(parts[f"Cow_Leg_{side}"], M["fur2"], pivot, LEG_R, hip.z - HOOF_H, inward=inward,
                      top_radius=LEG_TOP_R, arc=1)
        kit.pivot_foot_rings(parts[f"Cow_Hoof_{side}"], M["hoof"], pivot, inward, -hip.z,
                             kit.hoof_profile(HOOF_R, HOOF_H, LEG_R), kit.HOOF_RINGS)

    # neck: hidden at rest, fills the joint between chest and head when grazing
    kit.blob(parts["Cow_Neck"], M["fur2"], Vector((0.0, -0.78, 1.04)), 0.32, 0.27, (0.3, 0.27), res=2)

    # head: one big soft form, a little fuller at the cheeks
    kit.blob(parts["Cow_Head"], M["fur"], HEAD_C, **HEAD)
    head = kit.Surface(parts["Cow_Head"])

    # muzzle: a wide glossy pink bean across the lower face
    kit.blob(parts["Cow_Muzzle"], M["muzzle"], MUZZLE_C, **MUZZLE)
    muzzle = kit.Surface(parts["Cow_Muzzle"])
    for _, sx in SIDES:
        kit.pad(parts["Cow_Nostrils"], M["eye"], muzzle, MUZZLE_C + Vector((sx * 0.17, -0.44, 0.08)), MUZZLE_C,
                0.05, 0.036, 0.008, u_hint=(0, 0, 1), rim=0.008, segments=8, rings=(0.0, 0.7, 1.0),
                lift=(1.0, 0.8, None))
    front = MUZZLE_C.y - 0.39
    smile = [Vector((x, front, MUZZLE_C.z - 0.12 + 1.6 * x * x)) for x in (-0.14, 0.0, 0.14)]
    kit.smile(parts["Cow_Nostrils"], M["eye"], muzzle, smile, 0.026, segments=5)

    # eyes, glints and blush (the Forehead node carries both cheeks)
    for side, sx in SIDES:
        kit.eye(parts[f"Cow_Eye_{side}"], parts[f"Cow_EyeGlint_{side}"], head,
                HEAD_C + Vector((sx * 0.06, 0.0, 0.0)), Vector((sx * EYE_X, HEAD_C.y - 0.7, EYE_Z)), EYE_H, EYE_W,
                M["eye"], M["glint"], glint_size=0.095, dome=0.03, segments=16, glint_segments=12)
        kit.blush(parts["Cow_Forehead"], M["pink"], head, HEAD_C,
                  HEAD_C + Vector((sx * 0.52, -0.52, -0.09)), 0.13, 0.2, segments=10)

    # horns: short chunky golden horns rising up and out, still climbing at
    # the tip (a tip that levels off hooks back toward the high game camera
    # and draws a ring with the head showing through); the root is buried in
    # the crown, so it stays open
    for side, sx in SIDES:
        pts = [HEAD_C + Vector((sx * 0.22, 0.05, 0.38)), HEAD_C + Vector((sx * 0.30, 0.04, 0.54)),
               HEAD_C + Vector((sx * 0.38, 0.02, 0.63)), HEAD_C + Vector((sx * 0.45, 0.0, 0.67))]
        curve, _ = kit.catmull_rom(pts, samples=2)
        kit.tube(parts[f"Cow_Horn_{side}"], M["horn"], curve, kit.lerp_radii([0.115, 0.1, 0.085, 0.072], len(curve)),
                 segments=6, cap_start=False)

    # ears: big soft leaves standing out level from the upper head, the
    # lined face up and a little forward, so the pink shows from the game
    # camera at rest and when grazing
    for side, sx in SIDES:
        kit.slab_leaf_ear(parts[f"Cow_Ear_{side}"], parts[f"Cow_InnerEar_{side}"], M["fur2"], M["pink"],
                          root=HEAD_C + Vector((sx * 0.41, 0.08, 0.24)), axis=(sx * 1.0, 0.12, -0.2),
                          face=(0.0, -0.45, 1.0), length=0.5, width=0.36, thickness=0.12, inner=(0.72, 0.64),
                          point=0.3, segments=22, inner_segments=20, rings=(0.7,), lining_height=0.012,
                          lining_rim=0.012)

    # tail: one rope from inside the rump through both pivots, ending in a
    # soft cream puff at hock height (light, so it never reads as a hoof)
    tb, tt = P("Cow_TailPivot_Base"), P("Cow_TailPivot_Tip")
    kit.sliced_tail([tb, tt + Vector((0, 0, 0.02))], lambda t: 0.056 - 0.008 * t, [(parts["Cow_Tail"], M["fur2"])],
                    lead_in=Vector((0.0, 0.80, 1.12)), samples=2, segments=6, cap_rings=2)
    kit.blob(parts["Cow_TailTuft"], M["fur"], tt + Vector((0.0, 0.015, -0.07)), 0.115, 0.115, (0.15, 0.1), res=3,
             ex=0.9, ey=0.9, taper={"z": ("x", -0.25)})

    kit.rebuild_all(parts, space)
    kit.apply_colours(party_style, COLOURS)


def check(kit):
    kit.size_report(PREFIX, REFERENCE)
    kit.proportion_report("Cow_Body", ["Cow_Head", "Cow_Muzzle"])
    kit.triangle_report(PREFIX, BUDGET, hidden={"Cow_Coat_BlackPatches"})
    kit.thickness_report(PREFIX, SCALE)
    xs = [v.co.x for v in bpy.data.objects["Cow_Body"].data.vertices]
    print(f"CHECK Cow_Body width {max(xs) - min(xs):.3f} (cowAsset test: <= 1.04)")
    legs = [f"Cow_Leg_{s}" for s in ("FL", "FR", "RL", "RR")]
    feet = [f"Cow_Hoof_{s}" for s in ("FL", "FR", "RL", "RR")]
    step = lambda a: {"Cow_LegPivot_FL": (a, 0, 0), "Cow_LegPivot_FR": (-a, 0, 0),  # noqa: E731
                      "Cow_LegPivot_RL": (-a, 0, 0), "Cow_LegPivot_RR": (a, 0, 0)}
    # extremes of entities/cows/cowPose.ts (three.js node-local offsets, as
    # Cow.tsx writes them; see kit.apply_pose)
    trot_bob = step(0.52 * math.sqrt(0.5))  # the bob peaks half way through a stride
    trot_bob["Cow_BodyPivot"] = {"pos": (0.0, 0.045, 0.0)}
    poses = {
        "rest": {},
        "walk +": step(0.34),
        "walk -": step(-0.34),
        "trot +": step(0.52),
        "trot -": step(-0.52),
        "trot bob (feet lift)": trot_bob,
        "breathe in (feet sink)": {"Cow_BodyPivot": {"scale": (0.9875, 1.025, 0.9875)}},
        "graze": {"Cow_NeckPivot": (-0.5, 0, 0), "Cow_HeadPivot": (-0.62, 0, 0)},
        "graze, chew, ears": {"Cow_NeckPivot": (-0.5, 0, 0), "Cow_HeadPivot": (-0.62, 0, 0.055),
                              "Cow_JawPivot": (0, 0.095, 0), "Cow_EarPivot_L": (0, 0, 0.145),
                              "Cow_EarPivot_R": (0, 0, -0.145)},
        "look around": {"Cow_HeadPivot": (0.035, 0, 0.055)},
        "tail flick +": {"Cow_TailPivot_Base": (0, 0.56, 0), "Cow_TailPivot_Tip": (0, 0.72, 0)},
        "tail flick -": {"Cow_TailPivot_Base": (0, -0.56, 0), "Cow_TailPivot_Tip": (0, -0.72, 0)},
    }
    kit.procedural_report("Cow_Body", "Cow_Head", legs, feet, ["Cow_Tail"], poses)
