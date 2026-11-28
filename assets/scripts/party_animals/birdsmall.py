"""BirdSmall: a round blue tit figurine.

The bird is animated by GLB clips (BirdSmall_Idle, BirdSmall_Flap) and by
code (entities/birds/Birds.tsx): the code swings the leg pivots, lifts and
pitches the feet on their own, and pitches the head pivot to peck. The GLB
rest pose is the Idle clip's first frame, so the bird is designed there
(`clip_pose_space`): Blender world, +Z up, facing -Y, its L nodes on +X.
Runtime scale 0.28 (birdScale), so 0.03 game units is 0.107 model units:
the legs, feet, beak tip and eye glints are all at least that across.

Every pivot of this rig sits about 0.37 above the part it carries (the
head pivot is above the crown, the leg pivots at the top of the back, the
wing and tail pivots above the back), so each part is a rigid form placed
in its pivot's frame where the rotations keep it attached:

- Legs are capsules whose buried top sits inside the body ahead of and
  below the hip pivot, so the top stays buried when the code swings the
  leg back 1.08 rad for flight and forward for a step.
- Feet are closed soft pads with a heel dome: the code lifts each foot 0.075 along the
  leg and pitches it about its own origin, so the leg ends 0.094 above the
  sole, inside the foot both at rest and lifted.
- Wings are soft pillows pressed into the flanks, their round front on the
  wing pivot's vertical axis, which the Flap clip and the distant flock's
  glide pose (distantBirdGeometry.ts) turn them about.
- The peck turns the head about a point 0.35 above it, so the head rocks
  back over the chest and tips its face down; the head is one round form
  so it stays clean while it does.

The blue tit's colour blocks, so head and body read as two parts of one
figure rather than two blue balls: a sunny yellow egg body (the rump the
widest part, the back rising a little into the nape) under a big azure
head that sinks into its front top, a little narrower than the body. An
azure collar on the body round the head carries the head's colour onto
the nape and the throat, so the colour change lies on one smooth outline
instead of the faceted seam where the two forms meet. Big ink eyes with a
glint sit high on the face over a short stubby beak; cobalt wings and a
short round tail are smooth pillows (`pillow`, an even 20-point outline)
so their outlines stay round up close.

Materials, one per node: Body is yellow (the Belly material), BellyPatch
is the azure collar (the Body material), Pupil_L carries both glints and
Pupil_R is a hidden nub (nothing animates the pupils). Beak and Leg are
tinted at runtime (birdBeakColor, birdLegColor), so the file authors those
albedos.
"""

import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

PREFIX = "BirdSmall_"
SCALE = 0.28  # birdScale in entities/birds/Birds.tsx
BUDGET = 2000  # a small critter on screen (0.19 game units tall)
# The model this design replaced, in BirdSmall_Idle frame 1: width x, length y, height z.
REFERENCE = (0.713, 1.2655, 0.6807)
# The repo GLB carries the rest pose three.js starts from.
REPO_GLB = Path(__file__).resolve().parents[3] / "apps/garden/public/assets/models/BirdSmall.glb"

M = {
    "azure": "Material.BirdSmall.Body",
    "yellow": "Material.BirdSmall.Belly",
    "wing": "Material.BirdSmall.Wing",
    "beak": "Material.BirdSmall.Beak",
    "leg": "Material.BirdSmall.Leg",
    "eye": "Material.BirdSmall.Eye",
    "glint": "Material.BirdSmall.Pupil",
}

COLOURS = {
    M["azure"]: ("#5ea8ec", 0.8),  # head and collar
    M["yellow"]: ("#f8d84e", 0.8),  # body (the brightest yellow the sunlit top can show)
    M["wing"]: ("#3f78d6", 0.8),  # wings and tail
    M["eye"]: ("#5c4590", 0.35),
    M["glint"]: ("#fff4dc", 0.35),
    # tinted at runtime (birdBeakColor, birdLegColor; roughness 0.55): author the albedo itself
    M["beak"]: ("#985721", 0.55, "albedo"),
    M["leg"]: ("#92572c", 0.55, "albedo"),
}

SIDES = (("L", 1.0), ("R", -1.0))  # the bird's L nodes are on +X

BODY_C = Vector((0.0, 0.07, 0.42))
BODY = dict(rx=0.265, ry=(0.28, 0.25), rz=(0.21, 0.215), ex=0.9, ey=(0.85, 0.85), ez=(0.75, 0.9), res=5,
            taper={"y": ("x", 0.045)})
NAPE = 0.04  # how far the back rises into the nape behind the head
HEAD_C = Vector((0.0, -0.165, 0.515))
HEAD = dict(rx=0.238, ry=(0.225, 0.215), rz=(0.215, 0.205), ex=0.93, ey=(0.85, 0.95), ez=0.93, res=6,
            taper={"z": ("x", -0.05)})
COLLAR_MARGIN = 0.16  # how far (radians seen from the body core) the collar reaches past the seam
EYE_H, EYE_W = 0.26, 0.21
EYE_SIDE, EYE_UP = 0.44, 0.14  # direction of the eye centre from the head centre
# Eyes and glints stand only a little proud of the head, so from behind
# they do not show past the head's outline.
EYE_LIFT, EYE_DOME, GLINT_LIFT = 0.004, 0.012, 0.005
GLINT = 0.122  # round, on the eye's plateau: 0.03 game units across
LEG_R, LEG_TOP_R = 0.056, 0.05
LEG_Y = 0.0  # the leg stands over the foot node's origin, 0.1 ahead of the hip pivot
LEG_TOP_Z, LEG_BOTTOM_Z = 0.47, 0.15  # buried top, bottom sphere centre (0.094 above the sole)
FOOT_TOP = 0.125
PILLOW_RINGS = (0.55, 0.88)  # wing and tail cross-section: a plump pillow with a round rim


def plane_frame(origin, along, normal):
    """Frame at `origin`: local x along `along`, local z along `normal`."""
    z = Vector(normal).normalized()
    x = Vector(along) - z * Vector(along).dot(z)
    x.normalize()
    y = z.cross(x)
    return Matrix(((x.x, y.x, z.x, origin[0]), (x.y, y.y, z.y, origin[1]), (x.z, y.z, z.z, origin[2]),
                   (0.0, 0.0, 0.0, 1.0)))


def pillow(kit, part, material, frame, outline, thickness, segments=20, deform=None):
    """`kit.slab` (a closed pillow with a rounded rim on an even, smoothed
    outline) bent by `deform(local point) -> local point` in the frame, so
    it hugs a round body. 10 * segments triangles."""
    tmp = kit.Part()
    kit.slab(tmp, material, frame, outline, thickness, segments=segments, rings=PILLOW_RINGS, cap=2.2)
    if deform:
        inv = frame.inverted()
        tmp.verts = [frame @ Vector(deform(inv @ v)) for v in tmp.verts]
    part.extend(tmp)


def teardrop(length, width, narrow, count=20):
    """Closed outline along local x: the round head at -x, a narrower round
    end at +x (`narrow` of the width there)."""
    pts = []
    for i in range(count):
        t = 2 * math.pi * i / count
        x = math.cos(t)
        k = 1.0 - narrow * (1.0 + x) / 2
        pts.append((length / 2 * x, width / 2 * math.sin(t) * k))
    return pts


def body_shape(p, d):
    """Fill the low chest forward under the head and lift the front of the
    back a little into the nape, so the back flows up into the head."""
    if d.y < 0:
        p.y *= 1.0 + 0.13 * (-d.y) * math.exp(-((d.z + 0.15) / 0.6) ** 2)
    p.z += NAPE * math.exp(-((d.y + 0.5) / 0.45) ** 2) * max(0.0, d.z) ** 1.5
    return p


def seam_outline(body, head, core, centre, up, margin, count=24):
    """Angular radius (from `core`, around `centre`) of the body surface
    the head covers, at `count` angles, plus `margin`: the outline of a
    decal that just covers the seam. The angles follow `kit.decal` (0 along
    `up`, then toward centre x up)."""
    e1 = up - centre * up.dot(centre)
    e1.normalize()
    e2 = centre.cross(e1).normalized()

    def covered(theta, phi):
        d = centre * math.cos(theta) + (e1 * math.cos(phi) + e2 * math.sin(phi)) * math.sin(theta)
        point, _ = body.project(core, core + d)
        near, normal = head.nearest(point)
        return (point - near).dot(normal) < 0

    radii = []
    for i in range(count):
        phi = 2 * math.pi * i / count
        lo, hi = 0.0, 1.8
        if not covered(lo, phi):
            raise RuntimeError("collar: the head does not cover the collar centre")
        for _ in range(24):
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if covered(mid, phi) else (lo, mid)
        radii.append(lo + margin)
    return radii


def collar(kit, part, body, head):
    """An azure decal on the body that covers the head-body seam with a
    margin, its outline fitted to the seam with three smooth harmonics."""
    core = BODY_C + Vector((0.0, 0.03, 0.0))
    centre = (HEAD_C - core).normalized()
    up = Vector((0.0, 0.0, 1.0))
    radii = seam_outline(body, head, core, centre, up, COLLAR_MARGIN)
    n = len(radii)
    mean = sum(radii) / n
    harmonics = []
    for k in (1, 2, 3):
        a = 2 / n * sum((r / mean - 1) * math.cos(k * 2 * math.pi * i / n) for i, r in enumerate(radii))
        b = 2 / n * sum((r / mean - 1) * math.sin(k * 2 * math.pi * i / n) for i, r in enumerate(radii))
        harmonics.append((k, min(0.16, math.hypot(a, b)), math.atan2(-b, a)))
    kit.decal(part, M["azure"], body, core, centre, mean, harmonics=harmonics, up=up, rings=3, segments=16,
              lift=0.016, tuck=0.012)


def eye(kit, eye_part, glint_part, surface, core, target, height, width):
    """A tall glossy ink eye with more rings than `kit.eye` (its highlight
    must not show facets up close) and a shallow dome. The glint (a Pupil
    node) sits up and a little toward the viewer's left, wholly on the
    eye's plateau so it keeps its full size."""
    centre, normal = kit.pad(eye_part, M["eye"], surface, target, core, height / 2, width / 2, EYE_LIFT,
                             u_hint=(0, 0, 1), rim=0.012, dome=EYE_DOME, segments=14,
                             rings=(0.0, 0.42, 0.74, 0.92, 1.0), lift=(1.0, 0.95, 0.75, 0.35, None))
    up = Vector((0, 0, 1)) - normal * normal.z
    up.normalize()
    side = Vector((-1.0, 0.0, 0.0)) - normal * normal.dot(Vector((-1.0, 0.0, 0.0)))
    side = side - up * up.dot(side)
    side.normalize()
    spot = centre + up * (height * 0.2) + side * (width * 0.05)
    kit.pad(glint_part, M["glint"], kit.Surface(eye_part), spot, centre + normal * 0.4, GLINT / 2, GLINT / 2,
            GLINT_LIFT, u_hint=(0, 0, 1), rim=0.006, segments=12, rings=(0.0, 0.5, 0.8, 1.0),
            lift=(1.0, 0.95, 0.7, None))


def foot(kit, part, material, x):
    """A closed soft foot: a flat pad spread forward under the toes, rising
    to a low heel dome round the leg's end (about 60% of the old round
    mitten, which read as an orange pom-pom under the bird)."""
    centre = Vector((x, -0.02, 0.05))

    def toe(p, d):
        if p.z > 0:
            p.z *= 1.0 - 0.6 * max(0.0, -d.y) ** 0.8  # the top slopes down to flat toes
        return p

    return kit.blob(part, material, centre, 0.062, (0.11, 0.06), (0.05, FOOT_TOP - 0.05), res=(3, 4, 2), ex=0.9,
                    ey=(0.8, 0.9), ez=(0.4, 0.85), taper={"y": ("x", -0.18)}, deform=toe)


def build(kit, party_style):
    objects = list(bpy.data.objects)
    space = kit.clip_pose_space(objects, "BirdSmall_Idle", 1)
    parts = {o.name: kit.Part(o.name) for o in objects if o.type == "MESH"}

    # body: one yellow egg, the belly flatter, the rump the widest part
    kit.blob(parts["BirdSmall_Body"], M["yellow"], BODY_C, deform=body_shape, **BODY)
    body = kit.Surface(parts["BirdSmall_Body"])

    # head: one big azure round form sunk into the front top of the egg
    kit.blob(parts["BirdSmall_Head"], M["azure"], HEAD_C, **HEAD)
    head = kit.Surface(parts["BirdSmall_Head"])

    # collar (BellyPatch): the head's azure carried onto the nape and throat
    collar(kit, parts["BirdSmall_BellyPatch"], body, head)

    # beak: a short stubby cone from inside the face, its tip 0.03 game units
    # across both ways (0.12 wide, 0.108 tall)
    beak_base = HEAD_C + Vector((0.0, -0.17, -0.04))
    beak_tip = HEAD_C + Vector((0.0, -0.3, -0.055))
    kit.beak(parts["BirdSmall_Beak"], M["beak"], beak_base, beak_tip, 0.094, 0.06, curl=0.008, squash=0.9)

    # eyes; Pupil_L carries both glints (one material per node; nothing
    # animates the pupils), Pupil_R is unused
    for side, sx in SIDES:
        d = Vector((sx * EYE_SIDE, -1.0, EYE_UP)).normalized()
        eye(kit, parts[f"BirdSmall_Eye_{side}"], parts["BirdSmall_Pupil_L"], head,
            HEAD_C + Vector((sx * 0.04, 0.0, 0.0)), HEAD_C + d * 0.6, EYE_H, EYE_W)
    kit.hidden_nub(parts["BirdSmall_Pupil_R"], M["glint"], HEAD_C)

    # wings: soft pillows pressed into the flanks, the round front on the
    # wing pivot's vertical axis, the narrower round end back and down
    wing_l, wing_w, wing_t, wing_bend = 0.47, 0.27, 0.14, 0.06

    def hug(p):
        return Vector((p.x, p.y, p.z - wing_bend * ((p.x / (wing_l / 2)) ** 2 + 0.6 * (p.y / (wing_w / 2)) ** 2)))

    for side, sx in SIDES:
        frame = plane_frame(Vector((sx * 0.262, 0.17, 0.45)), (0.0, 1.0, -0.36), (sx * 1.0, 0.0, 0.5))
        pillow(kit, parts[f"BirdSmall_Wing_{side}"], M["wing"], frame, teardrop(wing_l, wing_w, 0.35), wing_t,
               deform=hug)

    # tail: a short round fan from inside the rump, nearly level, so from
    # the front it stays low behind the head
    tail_l, tail_w, tail_t = 0.4, 0.3, 0.13
    frame = plane_frame(Vector((0.0, 0.445, 0.46)), (0.0, 1.0, 0.08), (0.0, -0.08, 1.0))

    def fan(p):
        t = (p.x / (tail_l / 2) + 1.0) / 2  # 0 at the root, 1 at the end
        return Vector((p.x, p.y, p.z + 0.015 * t * t))

    narrow_root = [(-x, y) for x, y in teardrop(tail_l, tail_w, 0.5)]
    pillow(kit, parts["BirdSmall_Tail"], M["wing"], frame, narrow_root, tail_t, deform=fan)

    # legs: short round legs from inside the belly, buried deep enough that
    # every swing of the high hip pivot keeps the top inside the body, in
    # closed mitten feet the code lifts and pitches on their own
    for side, sx in SIDES:
        x = space[f"BirdSmall_LegPivot_{side}"].translation.x
        top, bottom = Vector((x, LEG_Y, LEG_TOP_Z)), Vector((x, LEG_Y, LEG_BOTTOM_Z))
        kit.capsule(parts[f"BirdSmall_Leg_{side}"], M["leg"], bottom, LEG_R, top, LEG_TOP_R, segments=10, arc=1,
                    mid=1, y_hint=(0.0, 1.0, 0.0))
        foot(kit, parts[f"BirdSmall_Foot_{side}"], M["leg"], x)

    kit.rebuild_all(parts, space)
    kit.apply_colours(party_style, COLOURS)


def check(kit):
    objects = list(bpy.data.objects)
    idle = kit.clip_pose_space(objects, "BirdSmall_Idle", 1)
    kit.size_report(PREFIX, REFERENCE, space=idle)
    kit.proportion_report("BirdSmall_Body", ["BirdSmall_Head"], space=idle)
    kit.triangle_report(PREFIX, BUDGET)
    kit.thickness_report(PREFIX, SCALE)
    # the .blend opens with the Idle clip evaluated into the pivots; three.js
    # starts from the GLB rest (the runner has saved already)
    print(f"CHECK rest pose from GLB: {kit.glb_rest_pose(REPO_GLB)} nodes")
    body, head = "BirdSmall_Body", "BirdSmall_Head"
    legs = ["BirdSmall_Leg_L", "BirdSmall_Leg_R"]
    feet = ["BirdSmall_Foot_L", "BirdSmall_Foot_R"]
    tails = ["BirdSmall_Tail"]
    joints = [("BirdSmall_Leg_L", "BirdSmall_Foot_L"), ("BirdSmall_Leg_R", "BirdSmall_Foot_R"),
              ("BirdSmall_Wing_L", body), ("BirdSmall_Wing_R", body)]
    kit.clip_report(body, head, legs, feet, tails, joints=joints)

    # extremes of updateBirdLegPose and updateGroundPeckPose (three.js
    # node-local offsets, as Birds.tsx writes them; see kit.apply_pose)
    def walk(s):
        left_step, right_step = max(0.0, s), max(0.0, -s)
        swing = 0.32 * s
        return {
            "BirdSmall_LegPivot_L": (swing - 0.12 * left_step, 0, 0),
            "BirdSmall_LegPivot_R": (-swing - 0.12 * right_step, 0, 0),
            "BirdSmall_Foot_L": {"pos": (0.0, 0.075 * left_step, 0.0),
                                 "rot": (0.28 * left_step + 0.08 * right_step, 0, 0)},
            "BirdSmall_Foot_R": {"pos": (0.0, 0.075 * right_step, 0.0),
                                 "rot": (0.28 * right_step + 0.08 * left_step, 0, 0)},
        }

    def flight(pulse):
        return {
            "BirdSmall_LegPivot_L": (1.08 + pulse, 0, 0.08),
            "BirdSmall_LegPivot_R": (1.08 + pulse, 0, -0.08),
            "BirdSmall_Foot_L": (-0.42, 0, 0),
            "BirdSmall_Foot_R": (-0.42, 0, 0),
        }

    poses = {
        "rest": {},
        "walk +": walk(1.0),
        "walk -": walk(-1.0),
        "walk mid +": walk(math.sqrt(0.5)),
        "walk mid -": walk(-math.sqrt(0.5)),
        "flight": flight(0.0),
        "flight pulse +": flight(0.045),
        "flight pulse -": flight(-0.045),
        "peck": {"BirdSmall_HeadPivot": (0.62, 0, 0)},
        "peck, walk": {**walk(1.0), "BirdSmall_HeadPivot": (0.62, 0, 0)},
    }
    kit.procedural_report(body, head, legs, feet, tails, poses, joints=joints)
    # the Idle clip keeps playing while the bird walks and pecks
    kit.clip_report(body, head, legs, feet, tails, samples=4, joints=joints, offsets=walk(-1.0))
