"""Goat: a plush party figurine with golden horns, a beard and a collar.

Design space is the stored pose (`entities/farmAnimals/FarmAnimals.tsx`
poses the rig in code, updateGoatPose): Blender world, +Z up, the goat faces
-Y, its L nodes are on +X. Runtime scale 0.392 (goatConfig.scale), so 0.03
game units is 0.077 model units.

One soft loaf body with high withers and a low, flat belly on short chunky
legs (visible leg under 15% of the height), and one rounded long-faced head
with a soft snout that overlaps it. A short neck only shows at the throat,
where a narrow pink collar wraps it low, toward the chest, and a five-petal
sunflower charm hangs below it on the chest. Golden horns rise almost
upright with a little outward lean and only sweep back at the tip, which
still climbs, so they read as horns from every side, including from behind;
leaf ears stand out level from the sides of the head; a short cream
beard juts down and forward from the chin; a short cream tail stands up
against the dark rump patch. A saddle and a rump patch wrap over the back so the top-down
camera sees them.

The goat has no pink material, so the collar's material is pink and also
carries the nose and the blush (on the Goat_Muzzle node). There is no mouth:
an ink smile 0.03 game units thick reads as a moustache on the narrow snout.
Its ear pivots hold no node for a lining, so the ears are plain chocolate
leaves (`slab`, a smooth 18-point outline) that match the patches.

The face is tuned to the game camera: browsing pitches the neck 0.28 and the
head up to 0.74 rad down, so the eyes sit high on the face and the ears,
horns and collar keep reading from above. While browsing the head still
reaches 0.026 into the withers, and the neck fills the joint (0.27 or more
into both head and body). The charm sits in the gap the chin, beard and head
leave in front of the chest at every neck and head angle the code reaches,
so nothing cuts through it (check(): "charm clearance").

Triangles go to outlines: head and body at cube-sphere resolution 7, the
saddle outline at 22 segments; the leg and neck caps, which hide in the
hooves, body and head, use one ring (arc=1).
"""

import math

import bpy
from mathutils import Vector

PREFIX = "Goat_"
SCALE = 0.392  # goatConfig.scale in entities/farmAnimals/FarmAnimals.tsx
BUDGET = 3000
# The model this design replaced, at rest: width x, length y, height z.
REFERENCE = (1.297, 2.267, 1.836)

M = {
    "fur": "Material.Goat.CreamLight",
    "fur2": "Material.Goat.Cream",
    "dark": "Material.Goat.Charcoal",
    "eye": "Material.Goat.Eye",
    "glint": "Material.Goat.EyeGlint",
    "hoof": "Material.Goat.Hoof",
    "horn": "Material.Goat.Horn",
    "pink": "Material.Goat.Collar",
    "charm": "Material.Goat.SunflowerCharm",
}

# On-screen colour of a sunlit face, roughness band (GAME_ART.md). Cream is
# pinned by farmAnimalAssets.unit.ts as an 8-bit sRGB albedo, so it is
# authored as that albedo (screen_to_albedo("#eddab8") rounded to 8 bits).
COLOURS = {
    M["fur"]: ("#f2e0c0", 0.8),
    M["fur2"]: ("#938773", 0.8, "albedo"),
    M["dark"]: ("#a35c3c", 0.8),
    M["eye"]: ("#5c4590", 0.35),
    M["glint"]: ("#fff4dc", 0.35),
    M["hoof"]: ("#8e6f80", 0.55),
    M["horn"]: ("#efbd62", 0.55),
    M["pink"]: ("#f48c84", 0.55),
    M["charm"]: ("#ffd31c", 0.45),
}

BODY_C = Vector((0.0, 0.05, 0.78))
BODY = dict(rx=0.38, ry=(0.6, 0.68), rz=(0.49, 0.42), ex=0.86, ey=(0.78, 0.8), ez=(0.6, 0.85), res=(6, 8, 6),
            taper={"y": ("x", 0.03)})
HEAD_C = Vector((0.0, -0.66, 1.32))
HEAD = dict(rx=0.37, ry=(0.46, 0.42), rz=(0.4, 0.41), ex=0.9, ey=0.92, ez=0.9, res=7,
            taper={"z": ("x", -0.05)})
EYE_X, EYE_Z = 0.185, HEAD_C.z + 0.08
EYE_H, EYE_W = 0.24, 0.18  # 30% of the head height
GLINT = 0.115  # visible part >= 0.077 model units (0.03 game units)
LEG_INWARD = 0.05
LEG_R, LEG_TOP_R = 0.12, 0.11
HOOF_R, HOOF_H = 0.15, 0.12

# Coat patches: (core y, direction from the core, angular radius, harmonics,
# squash, orientation hint, outline segments). A saddle over the back and a
# rump patch; the saddle's long outline gets more segments, so no corner
# shows at close zoom.
PATCHES = [
    (0.0, (0.35, -0.1, 1.0), 0.64, ((2, 0.12, 0.6), (3, 0.06, 1.7)), (1.0, 1.3), (0, 1, 0), 22),
    (0.25, (-0.3, 0.75, 0.85), 0.4, ((2, 0.12, 1.4), (3, 0.06, 0.4)), (1.0, 1.15), (1, 0, 0), 18),
]

# Horn centre line from the buried root to the tip, about HEAD_C (x for the L
# side). Nearly upright with a little outward lean; only the last segment
# sweeps back, and the tip still rises, so seen end-on from behind the horn
# still shows most of its length.
HORN = ((0.11, -0.06, 0.3), (0.135, -0.06, 0.45), (0.165, -0.03, 0.56), (0.185, 0.03, 0.64))
COLLAR_AT, COLLAR_HALF = 0.3, 0.04  # along the neck from the chest; band half-width
# Sunflower charm: centre, facing and radius. It hangs below the collar on the
# chest, behind the space the chin, beard and jaw sweep through when the goat
# browses (head down 0.74 on the neck's 0.28), so they never cut through it.
CHARM_C, CHARM_N, CHARM_R = Vector((0.0, -0.665, 0.72)), Vector((0.0, -1.0, 0.05)), 0.14
# Beard: centre under the chin, axis (down and forward), half-length. Its top
# end stays buried in the chin; the forward tilt keeps it clear of the charm
# while the goat browses.
BEARD_C, BEARD_AXIS, BEARD_LEN = Vector((0.0, -0.466, -0.382)), Vector((0.0, -0.8, -1.0)), 0.105

SIDES = (("L", 1.0), ("R", -1.0))  # the goat's L nodes are on +X


def snout(p, d):
    """Push the lower front of the head out into a soft, narrower snout."""
    front = max(0.0, -d.y)
    low = 1.0 - max(0.0, min(1.0, (d.z + 0.2) / 0.8))
    k = front ** 1.6 * low
    p.y -= 0.2 * k
    p.x *= 1.0 - 0.18 * k
    p.z += 0.02 * k
    return p


def shoulders(p, d):
    """Raise the front of the back into high withers that hold the head."""
    p.z += 0.16 * max(0.0, -d.y) ** 1.5 * max(0.0, d.z)
    return p


def leaf(half_length, half_width):
    """Outline of a soft leaf ear along local y: round root, widest a little
    out from the head, rounded tip."""
    out = []
    for i in range(16):
        a = 2 * math.pi * i / 16
        y = math.sin(a)
        w = half_width * (1.0 - 0.28 * y) * (1.0 - 0.15 * max(0.0, -y))
        out.append((w * math.cos(a), half_length * y))
    return out


def flower(radius, petals=5, depth=0.32):
    """Outline of a flower: `petals` round lobes with short, soft notches."""
    out = []
    for i in range(petals * 8):
        a = 2 * math.pi * i / (petals * 8)
        r = radius * (1 - depth * abs(math.sin(petals * a / 2)) ** 6)
        out.append((r * math.cos(a), r * math.sin(a)))
    return out


def build(kit, party_style):
    objects = list(bpy.data.objects)
    space = kit.design_space(objects)

    def P(name):
        return space[name].translation.copy()

    parts = {o.name: kit.Part(o.name) for o in objects if o.type == "MESH"}

    # body: one soft loaf, belly low and flat, rump a little fuller
    kit.blob(parts["Goat_Body"], M["fur"], BODY_C, deform=shoulders, **BODY)
    body = kit.Surface(parts["Goat_Body"])
    kit.hidden_nub(parts["Goat_Chest"], M["fur"], BODY_C + Vector((0.0, -0.3, 0.0)), 0.05)

    coat = parts["Goat_CoatPatches"]
    for core_y, direction, radius, harmonics, squash, up, segments in PATCHES:
        kit.decal(coat, M["dark"], body, Vector((0.0, core_y, BODY_C.z - 0.1)), direction, radius,
                  harmonics=harmonics, squash=squash, up=up, rings=3, segments=segments, inner_segments=12, lift=0.02,
                  tuck=0.014)

    # legs: round legs on the hip pivots, standing in hoof pucks that meet
    # them on one clean circle
    for side in ("FL", "FR", "RL", "RR"):
        pivot = space[f"Goat_LegPivot_{side}"]
        hip = pivot.translation
        local_x = pivot.to_3x3() @ Vector((1.0, 0.0, 0.0))
        inward = Vector((-LEG_INWARD if hip.x > 0 else LEG_INWARD, 0.0, 0.0)).dot(local_x)
        # arc=1: both ends hide (in the hoof and the body), so the caps need
        # no rings; the triangles go to the head and body outlines
        kit.pivot_leg(parts[f"Goat_Leg_{side}"], M["fur2"], pivot, LEG_R, hip.z - HOOF_H, inward=inward,
                      top_radius=LEG_TOP_R, arc=1)
        # 16 segments on the hoof wall and rim, which draw its outline
        kit.pivot_foot_rings(parts[f"Goat_Hoof_{side}"], M["hoof"], pivot, inward, -hip.z,
                             kit.hoof_profile(HOOF_R, HOOF_H, LEG_R), kit.HOOF_RINGS)

    # neck: a short column from inside the chest to inside the head; only
    # the throat shows, where the collar wraps it
    neck_a, neck_b = P("Goat_NeckPivot") + Vector((0.0, -0.03, 0.0)), P("Goat_HeadPivot") + Vector((0.0, -0.03, 0.0))
    kit.capsule(parts["Goat_Neck"], M["fur2"], neck_a, 0.25, neck_b, 0.23, segments=8, arc=1)
    neck = kit.Surface(parts["Goat_Neck"])
    collar_o = neck_a.lerp(neck_b, COLLAR_AT)
    axis = (neck_b - neck_a).normalized()
    kit.band_decal(parts["Goat_Collar"], M["pink"], neck, collar_o, axis, COLLAR_HALF, lift=0.03, tuck=0.014,
                   shoulder=0.025, segments=16, rows=1)
    frame = kit.frame_from(CHARM_C, CHARM_N, (0.0, 0.0, 1.0))
    kit.slab(parts["Goat_SunflowerCharm"], M["charm"], frame, flower(CHARM_R), 0.08,
             segments=20, rings=(0.7,))

    # head: one soft long-faced form with a snout
    kit.blob(parts["Goat_Head"], M["fur"], HEAD_C, deform=snout, **HEAD)
    head = kit.Surface(parts["Goat_Head"])

    # chin under the snout, on the jaw pivot, so chewing moves it
    kit.blob(parts["Goat_Jaw"], M["fur2"], HEAD_C + Vector((0.0, -0.44, -0.27)), 0.11, 0.1, 0.065, res=2,
             ex=0.9, ey=0.9)

    # nose: a pink rounded triangle on the front of the snout, pointing down
    tip = HEAD_C + Vector((0.0, -0.62, -0.1))
    # (no mouth: an ink smile 0.03 game units thick reads as a moustache on
    # the narrow snout)
    kit.pad(parts["Goat_Muzzle"], M["pink"], head, tip, HEAD_C + Vector((0.0, -0.1, -0.1)), 0.07, 0.1, 0.016,
            u_hint=(0, 0, 1), rim=0.012, segments=14, rings=(0.0, 0.55, 0.85, 1.0), lift=(1.0, 0.9, 0.5, None),
            dome=0.014, wobble=((3, 0.1, -math.pi / 2),))

    # eyes, glints and blush (the blush is on the Muzzle node with the nose)
    for side, sx in SIDES:
        kit.eye(parts[f"Goat_Eye_{side}"], parts[f"Goat_EyeGlint_{side}"], head,
                HEAD_C + Vector((sx * 0.04, 0.0, 0.0)), Vector((sx * EYE_X, HEAD_C.y - 0.7, EYE_Z)), EYE_H, EYE_W,
                M["eye"], M["glint"], glint_size=GLINT, dome=0.025, segments=14)
        kit.blush(parts["Goat_Muzzle"], M["pink"], head, HEAD_C,
                  HEAD_C + Vector((sx * 0.32, -0.44, -0.09)), 0.095, 0.14, segments=10)

    # horns: chunky golden horns rising almost upright, sweeping back only at
    # the tip, which still climbs, so they never fold into a ring or a nub
    # from the camera; roots buried
    for side, sx in SIDES:
        pts = [HEAD_C + Vector((sx * x, y, z)) for x, y, z in HORN]
        curve, _ = kit.catmull_rom(pts, samples=2)
        kit.tube(parts[f"Goat_Horn_{side}"], M["horn"], curve,
                 kit.lerp_radii([0.098, 0.084, 0.066, 0.05], len(curve)), segments=6, cap_start=False)

    # ears: soft dark leaves standing out level from the sides of the head
    for side, sx in SIDES:
        root = P(f"Goat_EarPivot_{side}") + Vector((-sx * 0.02, 0.02, 0.0))
        axis = Vector((sx * 1.0, 0.15, -0.22)).normalized()
        frame = kit.frame_from(root + axis * 0.23, Vector((0.0, -0.4, 1.0)), axis)  # local y along the ear
        kit.slab(parts[f"Goat_Ear_{side}"], M["dark"], frame, leaf(0.24, 0.13), 0.1, segments=18, rings=(0.6,))

    # beard: a short soft cream tuft from the chin, narrowing to a point. It
    # is cream, not the chocolate of the ears: its lower half always faces
    # away from the key light, and chocolate there read V 0.38 to 0.44 on
    # screen (below the 0.55 darks floor); cream reads 0.67 to 0.92
    beard_frame = kit.frame_from(HEAD_C + BEARD_C, BEARD_AXIS, (0.0, -1.0, 0.0))
    kit.blob(parts["Goat_Beard"], M["fur2"], None, 0.085, 0.075, BEARD_LEN, res=3, frame=beard_frame, ex=0.9, ey=0.9,
             taper={"z": ("x", -0.45)})

    # tail: a short cream flag rising up and back from inside the rump, light
    # against the dark rump patch behind it
    tp = P("Goat_TailPivot")
    pts = [tp + Vector((0.0, -0.12, -0.06)), tp + Vector((0.0, 0.0, 0.04)), tp + Vector((0.0, 0.08, 0.16)),
           tp + Vector((0.0, 0.11, 0.25))]
    curve, _ = kit.catmull_rom(pts, samples=1)
    kit.tube(parts["Goat_Tail"], M["fur"], curve, kit.lerp_radii([0.075, 0.075, 0.065, 0.05], len(curve)),
             segments=8, cap_start=False, squash=0.75)

    kit.rebuild_all(parts, space)
    kit.apply_colours(party_style, COLOURS)


def clearance_report(kit, part, others, poses):
    """Smallest gap between `part` and each of `others` over `poses`
    (`kit.apply_pose` offsets, from the stored pose, restored afterwards).
    "CUTS THROUGH" means the meshes intersect in that pose."""
    from mathutils.bvhtree import BVHTree

    objects = bpy.data.objects
    rest = {o.name: o.matrix_basis.copy() for o in objects}

    def mesh(name):
        o = objects[name]
        verts = [o.matrix_world @ v.co for v in o.data.vertices]
        return verts, BVHTree.FromPolygons(verts, [tuple(p.vertices) for p in o.data.polygons])

    worst = {name: (math.inf, "") for name in others}
    for label, offsets in poses.items():
        for o in objects:
            o.matrix_basis = rest[o.name]
        kit.apply_pose(offsets)
        verts_a, tree_a = mesh(part)
        for name in others:
            verts_b, tree_b = mesh(name)
            if tree_a.overlap(tree_b):
                gap = -1.0
            else:
                gap = min(min(tree_b.find_nearest(v)[3] for v in verts_a),
                          min(tree_a.find_nearest(v)[3] for v in verts_b))
            if gap < worst[name][0]:
                worst[name] = (gap, label)
    for o in objects:
        o.matrix_basis = rest[o.name]
    bpy.context.view_layer.update()
    print(f"CHECK {part.removeprefix(PREFIX)} clearance: " + ", ".join(
        f"{name.removeprefix(PREFIX)} " + ("CUTS THROUGH" if gap < 0 else f"{gap:.3f}") + f" ({label})"
        for name, (gap, label) in worst.items()))


def check(kit):
    kit.size_report(PREFIX, REFERENCE)
    kit.proportion_report("Goat_Body", ["Goat_Head", "Goat_Jaw"])
    kit.triangle_report(PREFIX, BUDGET)
    kit.thickness_report(PREFIX, SCALE)
    legs = [f"Goat_Leg_{s}" for s in ("FL", "FR", "RL", "RR")]
    feet = [f"Goat_Hoof_{s}" for s in ("FL", "FR", "RL", "RR")]

    def step(a, front=0.0, rear=0.0):
        # updateGoatPose: FL and RR take the diagonal, FR and RL its opposite
        return {"Goat_LegPivot_FL": (front + a, 0, 0), "Goat_LegPivot_FR": (front - a, 0, 0),
                "Goat_LegPivot_RL": (rear - a, 0, 0), "Goat_LegPivot_RR": (rear + a, 0, 0)}

    walk_bob = step(0.48 * math.sqrt(0.5))
    walk_bob["Goat_BodyPivot"] = {"pos": (0.0, 0.022, 0.0)}
    hop = step(0.0, front=-0.72, rear=0.26)
    hop.update({"Goat_BodyPivot": {"pos": (0.0, 0.14, 0.0), "rot": (-0.2, 0.0, 0.0)},
                "Goat_NeckPivot": (0.16, 0, 0)})
    swim = step(0.56, front=-0.24, rear=-0.24)
    swim.update({"Goat_BodyPivot": {"pos": (0.0, 0.037, 0.0), "rot": (-0.05, 0.0, 0.0)},
                 "Goat_HeadPivot": (-0.08, 0, 0)})
    # extremes of updateGoatPose (three.js node-local offsets; kit.apply_pose)
    poses = {
        "rest": {},
        "walk +": step(0.48),
        "walk -": step(-0.48),
        "walk bob": walk_bob,
        "swim": swim,
        "play-hop peak": hop,
        "browse": {"Goat_NeckPivot": (-0.28, 0, 0), "Goat_HeadPivot": (-0.74, 0, 0)},
        "browse, chew, ears": {"Goat_NeckPivot": (-0.28, 0, 0), "Goat_HeadPivot": (-0.74, 0, 0),
                               "Goat_JawPivot": (0.21, 0.035, 0), "Goat_EarPivot_L": (0, 0.055, -0.18),
                               "Goat_EarPivot_R": (0, -0.055, 0.18)},
        "curious": {"Goat_HeadPivot": (0.145, 0, 0.055), "Goat_EarPivot_L": (0, -0.055, 0.06),
                    "Goat_EarPivot_R": (0, 0.055, -0.06)},
        "look around": {"Goat_HeadPivot": (0.045, 0.14, 0)},
        "tail wag +": {"Goat_TailPivot": (0.08, 0.32, 0)},
        "tail wag -": {"Goat_TailPivot": (-0.08, -0.32, 0)},
    }
    joints = [("Goat_Neck", "Goat_Body"), ("Goat_Neck", "Goat_Head"), ("Goat_Jaw", "Goat_Head"),
              ("Goat_Ear_L", "Goat_Head"), ("Goat_Ear_R", "Goat_Head")]
    kit.procedural_report("Goat_Body", "Goat_Head", legs, feet, ["Goat_Tail"], poses, joints=joints)

    # the charm hangs on the neck; the head, chin and beard swing past it and
    # the chest comes closer as the neck pitches, so sweep every neck and head
    # angle the code combines (browse, curious, hop), with chewing and looking
    sweep = {"play-hop peak": hop}
    for neck in (0.16, 0.0, -0.14, -0.28):
        for head in (0.145, 0.0, -0.25, -0.5, -0.74):
            for jaw, yaw in ((0.0, 0.0), (0.21, 0.14), (0.21, -0.14)):
                sweep[f"neck {neck:+.2f} head {head:+.3f} jaw {jaw:.2f} yaw {yaw:+.2f}"] = {
                    "Goat_NeckPivot": (neck, 0, 0), "Goat_HeadPivot": (head, yaw, 0), "Goat_JawPivot": (jaw, 0.035, 0)}
    clearance_report(kit, "Goat_SunflowerCharm", ["Goat_Beard", "Goat_Jaw", "Goat_Head", "Goat_Muzzle", "Goat_Body",
                                                  "Goat_Leg_FL", "Goat_Leg_FR"], sweep)
