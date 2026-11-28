"""Chicken: a round golden hen figurine.

The chicken is posed by code only (entities/farmAnimals/FarmAnimals.tsx,
updateChickenPose), so it is designed in its stored pose: Blender world, +Z
up, facing -Y, its L nodes on +X. Runtime scale 0.34 (chickenConfig), so
0.03 game units is 0.088 model units: every visible part, the toes, comb
lobes, beak tip and glints included, is at least that across.

One egg body and one big round head that sinks into its front top (no neck),
both golden. The body is the wider mass and its back sweeps up into the
tail, so from behind it reads as a hen rather than a ball under a ball.
Rust wings pressed into the flanks and one soft rust tail plume (a smooth
teardrop, no notches, so no creases), a red three-lobed comb and wattle, an
orange beak, big ink eyes with a glint and a pink blush, and short round
legs on chunky three-toed feet.

Materials, one per node: the wattle drop rides on the comb node (both red,
both under the head pivot), so Chicken_Wattle carries the two blush pads in
Material.Chicken.CreamLight, authored blush pink. The breast node is a
hidden nub in that material: under the big head a cream bib faced the
ground and only showed as a grey crescent.

The code flaps the wings by turning their pivots about the vertical axis
(rotation.y, dust bath and swimming); with the root turned half a turn the
wing tips swing in, so the wings are soft teardrops pressed into the flanks
whose back half sinks into the body while the front lifts out.
"""

import math

import bpy
from mathutils import Matrix, Vector

PREFIX = "Chicken_"
SCALE = 0.34  # chickenConfig.scale in entities/farmAnimals/FarmAnimals.tsx
BUDGET = 3000  # GAME_ART: about 3,000 per farm animal, spent on the outlines (wings, tail, comb, feet)
# The model this design replaced, at rest: width x, length y, height z.
REFERENCE = (0.947, 1.5, 1.291)

M = {
    "body": "Material.Chicken.Cream",
    "light": "Material.Chicken.CreamLight",
    "dark": "Material.Chicken.CreamDark",
    "orange": "Material.Chicken.Orange",
    "red": "Material.Chicken.Red",
    "eye": "Material.Chicken.Charcoal",
    "glint": "Material.Chicken.EyeGlint",
}

COLOURS = {
    # golden #f4b84a on screen, authored as its exact 8-bit albedo (the
    # farmAnimalAssets test pins it); #f2b660 read peach under the cool fill
    M["body"]: ("#a37a2f", 0.8, "albedo"),
    M["light"]: ("#f59a92", 0.8),  # blush pink (the hidden breast nub shares it)
    M["dark"]: ("#d97a3c", 0.8),
    M["orange"]: ("#f08a2c", 0.45),
    M["red"]: ("#f23b2c", 0.5),
    M["eye"]: ("#5c4590", 0.35),
    M["glint"]: ("#fff4dc", 0.35),
}

SIDES = (("L", 1.0), ("R", -1.0))  # the chicken's L nodes are on +X
FORWARD = Vector((0.0, -1.0, 0.0))

BODY_C = Vector((0.0, 0.07, 0.58))
BODY = dict(rx=0.4, ry=(0.38, 0.44), rz=(0.33, 0.35), ex=0.9, ey=(0.9, 0.85), ez=(0.72, 0.9), res=6,
            taper={"y": ("x", 0.1)})
BACK_RISE = 0.17  # the upper back sweeps up into the tail: a hen, not a ball under a ball
HEAD_C = Vector((0.0, -0.34, 0.83))
HEAD = dict(rx=0.34, ry=(0.35, 0.35), rz=(0.32, 0.33), ex=0.93, ey=0.95, ez=0.93, res=6,
            taper={"z": ("x", -0.05)})
EYE_H, EYE_W = 0.22, 0.17  # 34% of the head height
EYE_SIDE, EYE_UP = 0.46, 0.13  # direction of the eye centre from the head centre
GLINT = 0.125  # >= 0.088 model units (0.03 game units) where it shows
LEG_R = 0.062
LEG_INWARD = 0.0
FOOT_TOP = 0.08  # the leg's bottom sphere sits here, inside the foot
RIM = (0.55, 0.9)  # inner rings of the comb slab: a round rim, no faceted edge
TAIL_O = (0.0, 0.1, 0.16)  # fan centre from the tail pivot
TAIL_LEAN = 0.66  # radians back from vertical, so from the front it does not stand up behind the head like an ear
TAIL = dict(tip=0.33, root=0.26, width=0.38, taper=0.45, thickness=(0.16, 0.3), bend=0.06, top=0.75)
WING_OUT = 0.1  # wing centre outward from its pivot


def leg_frame(kit, pivot, inward, z):
    """Frame on the leg axis at pivot-local height `z`: +Z up the leg, +Y the
    pivot's local Y, the same frame `pivot_leg` builds the leg in, so leg and
    foot line up (kit._leg_frame, kept here so a private kit change cannot
    move the feet)."""
    frame = kit.node_frame(pivot)
    return kit.frame_from(frame @ Vector((inward, 0.0, z)), frame.to_3x3() @ Vector((0.0, 0.0, 1.0)),
                          frame.to_3x3() @ Vector((0.0, 1.0, 0.0)))


def lobed_foot(kit, part, material, pivot, inward, sole_z, base_r, toes, rings, segments=20, warp=0.5, rocker=0.0):
    """A closed round foot with soft toes, revolved about the leg axis.

    `toes` are (angle from forward in radians, reach from the axis, angular
    width); `rings` are (height above the sole, round scale, toe scale) from
    the sole up, closed by poles at both ends. Samples are packed toward the
    front (`warp`), where the toes are. `rocker` lifts the toe tips off the
    ground, so a swinging leg does not dig its toes in.
    """
    frame = leg_frame(kit, pivot, inward, sole_z)
    rot = frame.to_3x3().inverted()
    fwd = rot @ FORWARD
    a0 = math.atan2(fwd.y, fwd.x)

    def reach(phi):
        r = base_r
        for angle, length, width in toes:
            d = math.atan2(math.sin(phi - angle), math.cos(phi - angle))
            r = max(r, base_r + (length - base_r) * math.exp(-(d / width) ** 2))
        return r

    phis = []
    for j in range(segments):
        t = 2 * math.pi * j / segments - math.pi
        phis.append(t - warp * math.sin(t))  # dense near t = 0 (forward)
    verts, faces = [Vector((0.0, 0.0, rings[0][0]))], []
    ring_ids = [[0]]
    longest = max(length for _, length, _ in toes)
    for z, round_s, toe_s in rings:
        ids = []
        for phi in phis:
            r = round_s * base_r + toe_s * (reach(phi) - base_r)
            lift = rocker * max(0.0, (r - base_r) / (longest - base_r)) ** 2 * (1.0 - z / rings[-1][0])
            ids.append(len(verts))
            verts.append(Vector((r * math.cos(phi + a0), r * math.sin(phi + a0), z + lift)))
        ring_ids.append(ids)
    verts.append(Vector((0.0, 0.0, rings[-1][0] + 0.012)))
    ring_ids.append([len(verts) - 1])
    n = segments
    for lower, upper in zip(ring_ids, ring_ids[1:]):
        if len(lower) == 1:
            faces.extend([lower[0], upper[(j + 1) % n], upper[j]] for j in range(n))
        elif len(upper) == 1:
            faces.extend([lower[j], lower[(j + 1) % n], upper[0]] for j in range(n))
        else:
            faces.extend([lower[j], lower[(j + 1) % n], upper[(j + 1) % n], upper[j]] for j in range(n))
    return part.add([frame @ v for v in verts], faces, material)


def tail_plume(kit, part, material, origin, lean, tip, root, width, taper, thickness, bend=0.0, top=0.95, res=6):
    """The tail: one soft rust fan in the mid plane, a flattened teardrop on
    the even cube-sphere grid (no poles and no notches, so no creases).

    Its axis leans `lean` radians back from vertical; it reaches `tip` up
    from `origin` and `root` down into the rump, `width` wide across,
    widening toward the top by `taper`, its top end squared off to the
    superellipse exponent `top`, so it reads as a fan rather than an egg.
    The thickness grows smoothly from `thickness[0]` at the root to
    `thickness[1]` at the top, so from behind it reads as a fan, not a
    blade. `bend` curls the top back.
    """
    a = Vector((0.0, math.sin(lean), math.cos(lean)))  # up the fan
    frame = kit.frame_from(origin, a, (1.0, 0.0, 0.0))  # local y across the chicken, local x toward the head
    length = root + tip

    def shape(p, d):
        t = (p.z + root) / length  # 0 at the root, 1 at the top
        k = thickness[0] + (thickness[1] - thickness[0]) * kit.smoothstep(0.0, 0.85, t)
        return Vector((p.x - bend * t * t, p.y * k / thickness[1], p.z))

    return kit.blob(part, material, None, width / 2, thickness[1] / 2, (root, tip), res=res, frame=frame, ex=0.9,
                    ey=0.85, ez=(0.9, top), taper={"z": ("x", taper)}, deform=shape)


def leaf_blob(kit, part, material, centre, axis, face, length, width, thickness, point=0.3, res=3, bend=0.0):
    """A soft teardrop (wings): local z along `axis` toward the narrow tip,
    the flat face toward `face`. `bend` curls both ends back against the
    face's opposite side, so the panel hugs a round body."""
    frame = kit.frame_from(centre, axis, face)

    def curl(p, d):
        return Vector((p.x, p.y - bend * ((p.z / (length / 2)) ** 2 + 0.6 * (p.x / (width / 2)) ** 2), p.z))

    return kit.blob(part, material, None, width / 2, thickness / 2, length / 2, res=res, frame=frame, ex=0.9,
                    ey=0.9, ez=0.85, taper={"z": ("x", -point)}, deform=curl if bend else None)


def side_frame(origin):
    """Frame in the chicken's mid plane: local x back (+Y), local y up, local
    z toward +X, for flat fins (comb, tail)."""
    return Matrix((
        (0.0, 0.0, 1.0, origin[0]),
        (1.0, 0.0, 0.0, origin[1]),
        (0.0, 1.0, 0.0, origin[2]),
        (0.0, 0.0, 0.0, 1.0),
    ))


def build(kit, party_style):
    objects = list(bpy.data.objects)
    space = kit.design_space(objects)

    def P(name):
        return space[name].translation.copy()

    parts = {o.name: kit.Part(o.name) for o in objects if o.type == "MESH"}

    # body: one round egg, the belly flatter, the back a little fuller. Head
    # and body meet on one crisp crease: a smooth-union fillet made them meet
    # at a shallow angle, and the intersection turned into a wavy seam
    def back_rise(p, d):
        return Vector((p.x, p.y, p.z + BACK_RISE * kit.smoothstep(0.0, 0.9, d.y) * kit.smoothstep(-0.3, 0.8, d.z)))

    kit.blob(parts["Chicken_Body"], M["body"], BODY_C, deform=back_rise, **BODY)
    # no bib: the breast sits under the big head and faces down, so a cream
    # bib only showed as a grey crescent in shade
    kit.hidden_nub(parts["Chicken_Breast"], M["light"], BODY_C)

    # head: one big round form sunk into the front top of the egg
    kit.blob(parts["Chicken_Head"], M["body"], HEAD_C, **HEAD)
    head = kit.Surface(parts["Chicken_Head"])

    # beak: a short rounded cone from inside the face, curling a little down
    beak_base = HEAD_C + Vector((0.0, -0.23, -0.05))
    beak_tip = HEAD_C + Vector((0.0, -0.46, -0.08))
    kit.beak(parts["Chicken_Beak"], M["orange"], beak_base, beak_tip, 0.11, 0.056, curl=0.03, squash=0.8)

    # wattle: one soft red drop hanging under the beak root, at the throat. It
    # rides on the comb node (same red, same head pivot), so the wattle node
    # can carry the pink blush in its own material
    wattle_c = HEAD_C + Vector((0.0, -0.3, -0.22))
    kit.blob(parts["Chicken_Comb"], M["red"], wattle_c, 0.058, 0.05, (0.095, 0.05), res=3,
             taper={"z": ("x", -0.25)})

    # comb: a red fin of three round lobes standing on the crown
    comb_o = HEAD_C + Vector((0.0, -0.02, 0.27))
    comb = [(-0.17, -0.08), (-0.19, 0.03), (-0.18, 0.1), (-0.12, 0.155), (-0.07, 0.125), (-0.05, 0.11),
            (-0.04, 0.17), (0.01, 0.2), (0.055, 0.165), (0.07, 0.125), (0.09, 0.15), (0.14, 0.13), (0.16, 0.07),
            (0.14, -0.06), (0.0, -0.1)]
    kit.slab(parts["Chicken_Comb"], M["red"], side_frame(comb_o), comb, 0.14, segments=28, rings=RIM)

    # eyes and glints; the pink blush rides on the wattle node
    for side, sx in SIDES:
        d = Vector((sx * EYE_SIDE, -1.0, EYE_UP)).normalized()
        kit.eye(parts[f"Chicken_Eye_{side}"], parts[f"Chicken_EyeGlint_{side}"], head,
                HEAD_C + Vector((sx * 0.04, 0.0, 0.0)), HEAD_C + d * 0.6, EYE_H, EYE_W, M["eye"], M["glint"],
                glint_size=GLINT, dome=0.02, segments=14)
        c = Vector((sx * 0.85, -1.0, -0.42)).normalized()
        kit.blush(parts["Chicken_Wattle"], M["light"], head, HEAD_C, HEAD_C + c * 0.6, 0.1, 0.13, segments=12)

    # wings: soft rust teardrops pressed into the flanks, tips back and down
    for side, sx in SIDES:
        pivot = P(f"Chicken_WingPivot_{side}")
        centre = pivot + Vector((sx * WING_OUT, 0.12, -0.01))
        leaf_blob(kit, parts[f"Chicken_Wing_{side}"], M["dark"], centre, (sx * -0.12, 1.0, -0.35),
                  (sx * 1.0, 0.0, 0.3), 0.5, 0.32, 0.14, point=0.35, res=5, bend=0.07)

    # tail: one soft rust plume rising up and back from inside the rump,
    # widening and thickening toward its squared top so it reads as a fan of
    # feathers from behind too
    tail_o = P("Chicken_TailPivot") + Vector(TAIL_O)
    tail_plume(kit, parts["Chicken_TailFan"], M["dark"], tail_o, TAIL_LEAN, **TAIL)

    # legs: short round orange legs on the hip pivots, standing in closed
    # three-toed feet that hide the leg's bottom sphere
    toes = [(0.0, 0.2, 0.3), (0.72, 0.18, 0.28), (-0.72, 0.18, 0.28), (math.pi, 0.14, 0.4)]
    rings = [(0.0, 0.78, 0.78), (0.022, 1.0, 1.0), (0.06, 0.96, 0.92), (0.092, 0.72, 0.4), (0.118, 0.5, 0.0)]
    for side in ("L", "R"):
        pivot = space[f"Chicken_LegPivot_{side}"]
        hip = pivot.translation
        kit.pivot_leg(parts[f"Chicken_Leg_{side}"], M["orange"], pivot, LEG_R, hip.z - FOOT_TOP, inward=LEG_INWARD)
        lobed_foot(kit, parts[f"Chicken_Foot_{side}"], M["orange"], pivot, LEG_INWARD, -hip.z, 0.11, toes, rings,
                   segments=18, rocker=0.035)

    kit.rebuild_all(parts, space)
    kit.apply_colours(party_style, COLOURS)


def check(kit):
    kit.size_report(PREFIX, REFERENCE)
    kit.proportion_report("Chicken_Body", ["Chicken_Head"])
    kit.triangle_report(PREFIX, BUDGET)
    kit.thickness_report(PREFIX, SCALE)
    legs = ["Chicken_Leg_L", "Chicken_Leg_R"]
    feet = ["Chicken_Foot_L", "Chicken_Foot_R"]

    def step(a):
        return {"Chicken_LegPivot_L": (a, 0, 0), "Chicken_LegPivot_R": (-a, 0, 0)}

    def swim(a):
        pose = {"Chicken_LegPivot_L": (-0.42 + a, 0, 0), "Chicken_LegPivot_R": (-0.42 - a, 0, 0),
                "Chicken_BodyPivot": {"pos": (0.0, 0.028, 0.0), "rot": (-0.08, 0, 0)},
                "Chicken_HeadPivot": (-0.12, 0, 0),
                "Chicken_WingPivot_L": (0, 0.52, 0), "Chicken_WingPivot_R": (0, -0.52, 0)}
        return pose

    bob = step(0.52 * math.sqrt(0.5))  # the bob peaks half way through a stride
    bob["Chicken_BodyPivot"] = {"pos": (0.0, 0.025, 0.0)}
    # extremes of updateChickenPose (three.js node-local offsets; kit.apply_pose)
    poses = {
        "rest": {},
        "walk +": step(0.52),
        "walk -": step(-0.52),
        "walk bob (feet lift)": bob,
        "swim +": swim(0.3),
        "swim -": swim(-0.3),
        "peck": {"Chicken_HeadPivot": (-0.78, 0, 0)},
        "roam head tilt +": {"Chicken_HeadPivot": (0, 0, 0.16)},
        "roam head tilt -": {"Chicken_HeadPivot": (0, 0, -0.16)},
        "dust +": {"Chicken_BodyPivot": (0, 0, 0.16), "Chicken_HeadPivot": (-0.28, 0, 0),
                   "Chicken_WingPivot_L": (0, 0.68, 0), "Chicken_WingPivot_R": (0, -0.68, 0)},
        "dust -": {"Chicken_BodyPivot": (0, 0, -0.16), "Chicken_HeadPivot": (-0.28, 0, 0),
                   "Chicken_WingPivot_L": (0, 0.08, 0), "Chicken_WingPivot_R": (0, -0.08, 0)},
        "tail +": {"Chicken_TailPivot": (0.08, 0, 0)},
        "tail -": {"Chicken_TailPivot": (-0.08, 0, 0)},
    }
    joints = [("Chicken_Wing_L", "Chicken_Body"), ("Chicken_Wing_R", "Chicken_Body")]
    kit.procedural_report("Chicken_Body", "Chicken_Head", legs, feet, ["Chicken_TailFan"], poses, joints=joints)
