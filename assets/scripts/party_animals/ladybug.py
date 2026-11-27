"""Ladybug: a glossy party-toy beetle.

The ladybug is posed in code (entities/ladybugs/Ladybugs.tsx,
updateLadybugRig): the six leg pivots swing about the lateral axis while it
crawls and fold while it flies, the antenna pivots wobble, the elytra
pivots lift the shell halves for flight, the wing pivots flutter the
underwings (hidden at rest) and the body pivot bobs. Every pivot sits at the
model origin on the ground, so each part turns about the bug's centre, not
about its own joint. Design space is the stored pose: Blender world, +Z up,
the ladybug faces -Y, its L nodes are on +X. Runtime scale 0.085
(ladybugScale), so the whole bug is about 0.12 game units long.

One glossy red dome split down the middle into the two elytra, with a soft
groove at the seam and six big clean ink spots, three per half (a spot split
across the seam read as two brackets). A big round warm dark head sits in
front of the dome with big cream eyes, raised ink pupils and a glint, and
pink blush. Short chunky legs with round feet peek out under the shell rim,
and two antennae leave the upper sides of the head, bend up and end in ball
tips. The underwings are hidden at rest and lie folded back behind the shell,
so the flight roll lifts them behind it, clear of the shell and the ground.

At this scale 0.03 game units is 0.35 model units, a third of the shell:
the shell, head and spots carry the read at the default zoom (about 25 device
pixels long), while the legs, antennae and face parts stay under 0.03 and
read from about twice the default zoom. The elytra pivots turn about the
ground centre, so in flight the two shell halves cross over the top; that is
the rig, not the shell (see the open-pose checks below).

Face nodes: Eye_* carry the eye white and its glint (one cream material),
PronotumSpot_* carry the ink pupils, and Thorax carries the blush; the
ElytraHighlight nodes are hidden nubs (no painted highlights). Each node
keeps one material, and the rigid batches keep their 6 merges.
"""

import math

import bpy
from mathutils import Vector

PREFIX = "Ladybug_"
SCALE = 0.085  # ladybugScale = 0.17 * 0.5 in entities/ladybugs/Ladybugs.tsx
BUDGET = 2000
# The model this design replaced, at rest: width x, length y, height z.
REFERENCE = (1.184, 1.457, 0.637)

M = {
    "red": "Material.Ladybug.ShellRed",
    "ink": "Material.Ladybug.Charcoal",
    "dark": "Material.Ladybug.WarmBlack",
    "cream": "Material.Ladybug.PronotumCream",
    "blush": "Material.Ladybug.ShellHighlight",
    "wing": "Material.Ladybug.UnderwingAmber",
}

# On-screen colour of a sunlit face, roughness band (GAME_ART.md). The
# runtime keeps these colours; it sets roughness by node name (Elytra 0.35,
# Underwing 0.4 and transparent, everything else 0.78).
COLOURS = {
    M["red"]: ("#f23b2c", 0.35),  # ripe red
    M["ink"]: ("#5c4590", 0.35),  # spots and pupils
    # warm dark plum (head, underbody, legs, antennae); the cool fill turns
    # it violet, so it is authored redder than it shows (#8a5f6e at noon)
    M["dark"]: ("#8c5a64", 0.78),
    # eye whites and glints; warmer than the #fff4dc glint role, which read
    # 0.05 to 0.08 saturation on the lit side of the eye at noon
    M["cream"]: ("#fbe6c4", 0.35),
    M["blush"]: ("#f59a92", 0.78),
    M["wing"]: ("#f0a640", 0.4),
}

SIDES = (("L", 1.0), ("R", -1.0))  # the ladybug's L nodes are on +X

# shell: one dome, split at x = 0 into the two elytra
SHELL_C = Vector((0.0, 0.08, 0.2))
SHELL = dict(rx=0.5, ry=(0.52, 0.52), rz=(0.11, 0.44), ex=0.9, ey=0.88, ez=(0.45, 0.85), res=6,
             taper={"y": ("x", 0.06)})
SEAM_GAP = 0.006
GROOVE = (0.07, 0.03)  # width, depth of the soft groove along the seam

HEAD_C = Vector((0.0, -0.55, 0.27))
HEAD = dict(rx=0.36, ry=(0.27, 0.22), rz=(0.27, 0.27), ex=0.92, ey=0.9, ez=0.92, res=4,
            taper={"z": ("x", -0.06)})
ABDOMEN_C = Vector((0.0, 0.02, 0.15))

EYE_X, EYE_Z = 0.145, HEAD_C.z + 0.08
EYE_H, EYE_W = 0.23, 0.18
PUPIL = (0.62, 0.68, 0.14)  # height and width fraction, raise fraction
GLINT = 0.075

SPOT_LIFT = 0.013
# spots on the L half: (surface target, angular radius seen from SPOT_CORE)
SPOT_CORE = Vector((0.22, 0.08, 0.24))
# and outline segments (more where the spot meets the side silhouette; 12
# read as polygons at close zoom). The inner ring keeps SPOT_INNER points.
SPOTS = [
    (Vector((0.25, -0.25, 0.56)), 0.36, 16),  # front, behind the head
    (Vector((0.42, 0.06, 0.47)), 0.44, 18),  # middle, high on the side, clear of the silhouette
    (Vector((0.25, 0.42, 0.45)), 0.38, 16),  # rear
]
SPOT_INNER = 8

# legs: (node suffix, root, foot centre) for the L side (+X)
LEGS = [
    ("1", Vector((0.12, -0.1, 0.17)), Vector((0.44, -0.36, 0.064))),
    ("2", Vector((0.14, 0.04, 0.17)), Vector((0.5, 0.06, 0.064))),
    ("3", Vector((0.12, 0.18, 0.17)), Vector((0.44, 0.46, 0.064))),
]
LEG_R, FOOT_R = 0.055, 0.075

# antennae: where the stalk leaves the head (direction from HEAD_C, L side),
# root depth, straight run along the surface normal, bent run, bend toward
# vertical, stalk and ball radius (see antenna_centreline)
ANT_DIR = Vector((0.88, -0.3, 0.4))
ANT = dict(depth=0.2, out=0.06, length=0.18, bend=0.5, radius=0.044, ball=0.072)

# underwings, at rest: the code rolls each wing pivot 0.78 to 1.58 rad about
# the bug's long axis on the ground (the elytra roll 0.82 the same way), so a
# panel behind the shell's rear end (y > 0.6) never meets the shell, and one
# that is above the ground at rest stays above it at every angle. Folded
# back and down at rest, it is spread about 25 degrees up when flight starts
# and flutters up to about 70 degrees.
WING = dict(root=Vector((0.1, 0.52, 0.3)), tip=Vector((0.62, 0.92, 0.13)), normal=Vector((0.3, -0.1, 1.0)),
            width=0.3)


def mirror(v, sx):
    return Vector((v.x * sx, v.y, v.z))


def split_dome(kit, halves, material, centre, groove, gap, **shape):
    """One soft dome cut at x = 0 into two closed halves (L on +X).

    The full blob is built once (even `res`, so a vertex column lies on the
    seam), a soft groove is pressed along the top of the seam, and each half
    is capped with a flat wall and moved `gap / 2` off the seam, so the two
    walls never coincide.
    """
    width, depth = groove

    def press(p, d):
        if p.z > 0:
            p.z -= depth * math.exp(-(p.x / width) ** 2) * min(1.0, p.z / 0.15)
        return p

    whole = kit.Part("dome")
    kit.blob(whole, material, centre, deform=press, **shape)
    eps = 1e-6
    for part, sx in halves:
        keep = {i for i, v in enumerate(whole.verts) if v.x * sx >= -eps}
        index = {}
        for i in sorted(keep):
            index[i] = len(index)
        verts = [whole.verts[i] + Vector((sx * gap / 2, 0.0, 0.0)) for i in sorted(keep)]
        faces = [[index[i] for i in f] for f, _ in whole.faces if all(i in keep for i in f)]
        # cap: the seam ring, ordered round the dome centre
        ring = [index[i] for i in sorted(keep) if abs(whole.verts[i].x) <= eps]
        ring.sort(key=lambda k: math.atan2(verts[k].z - centre.z, verts[k].y - centre.y))
        hub = len(verts)
        verts.append(Vector((sx * gap / 2, centre.y, centre.z)))
        cap = [[hub, ring[j], ring[(j + 1) % len(ring)]] for j in range(len(ring))]
        a, b, c = (verts[k] for k in cap[0])
        if (b - a).cross(c - a).x * sx > 0:  # the wall faces the seam (-sx)
            cap = [list(reversed(f)) for f in cap]
        part.add(verts, faces + cap, material)


def bug_eye(kit, eye_part, pupil_part, surface, core, target, sx):
    """Cream eye white, a raised ink pupil and a glint, as pads lifted well
    off the head: at this scale a thin pad z-fights."""
    centre, normal = kit.pad(eye_part, M["cream"], surface, target, core, EYE_H / 2, EYE_W / 2, 0.03,
                             u_hint=(0, 0, 1), rim=0.02, dome=0.02, segments=12, rings=(0.0, 0.75, 1.0),
                             lift=(1.0, 0.7, None))
    up = Vector((0, 0, 1)) - normal * normal.z
    up.normalize()
    hu, wu, raise_by = PUPIL
    white = kit.Surface(eye_part)
    behind = centre - normal * 0.4
    pupil_c = centre + up * (EYE_H * raise_by) + Vector((-sx * 0.01, 0, 0))
    kit.pad(pupil_part, M["ink"], white, pupil_c, behind, EYE_H * hu / 2, EYE_W * wu / 2, 0.02,
            u_hint=(0, 0, 1), rim=0.012, segments=12, rings=(0.0, 0.75, 1.0), lift=(1.0, 0.8, None))
    layers = kit.Part()
    layers.extend(eye_part)
    layers.extend(pupil_part)
    side = Vector((-1.0, 0.0, 0.0))  # the viewer's upper left, same for both eyes
    side = side - normal * normal.dot(side) - up * up.dot(side)
    side.normalize()
    glint_c = centre + up * (EYE_H * 0.3) + side * (EYE_W * 0.18)
    kit.pad(eye_part, M["cream"], kit.Surface(layers), glint_c, centre + normal * 0.4, GLINT * 0.56, GLINT / 2,
            0.016, u_hint=(0, 0, 1), rim=0.01, segments=8, rings=(0.0, 0.7, 1.0), lift=(1.0, 0.75, None))
    return centre, normal


def antenna_centreline(kit, sx, head):
    """Control points of one antenna stalk, its ball centre and radius.

    The wobble turns the antenna pivot up to 0.18 about the bug's centre on
    the ground: rx swings the head end about 0.15 forward and down or back
    and up, rz about 0.08 in or out. A stalk only keeps its length where that
    motion runs along the head surface, so it leaves the upper side of the
    head along the surface normal, a little forward (the front of the crown
    turns toward the motion), then bends up to the ball. Out at the side, the
    inward swing never brings the stalk onto the eyes, and the root sits deep
    enough to stay inside the head at every extreme.
    """
    exit_dir = Vector((ANT_DIR.x * sx, ANT_DIR.y, ANT_DIR.z))
    exit_point, normal = head.hit(HEAD_C, exit_dir)
    tip_dir = (normal * (1 - ANT["bend"]) + Vector((0.0, 0.0, ANT["bend"]))).normalized()
    bend_point = exit_point + normal * ANT["out"]
    end = bend_point + tip_dir * ANT["length"]
    pts = [exit_point - normal * ANT["depth"], exit_point, bend_point, end]
    return pts, end + tip_dir * ANT["ball"] * 0.5, ANT["ball"]


def antenna(kit, part, sx, head):
    """A chunky stalk from deep in the head to a ball tip."""
    pts, ball, radius = antenna_centreline(kit, sx, head)
    curve, _ = kit.catmull_rom(pts, samples=2)
    kit.tube(part, M["dark"], curve, [ANT["radius"]] * len(curve), segments=6, cap_rings=2, cap_start=False)
    kit.blob(part, M["dark"], ball, radius, radius, radius, res=2)


def build(kit, party_style):
    objects = list(bpy.data.objects)
    space = kit.design_space(objects)
    parts = {o.name: kit.Part(o.name) for o in objects if o.type == "MESH"}

    # shell: one dome, split into the two elytra along a soft groove
    split_dome(kit, [(parts["Ladybug_Elytra_L"], 1.0), (parts["Ladybug_Elytra_R"], -1.0)], M["red"], SHELL_C,
               GROOVE, SEAM_GAP, **SHELL)
    for side, sx in SIDES:
        shell = kit.Surface(parts[f"Ladybug_Elytra_{side}"])
        core = mirror(SPOT_CORE, sx)
        for k, (target, radius, segments) in enumerate(SPOTS, start=1):
            # kit.spot's decal, with a coarser inner ring for a finer outline
            kit.decal(parts[f"Ladybug_ElytraSpot_{side}{k}"], M["ink"], shell, core, mirror(target, sx) - core,
                      radius, rings=2, segments=segments, inner_segments=SPOT_INNER, lift=SPOT_LIFT, tuck=0.012,
                      shoulder=min(0.035, radius * 0.25))
        kit.hidden_nub(parts[f"Ladybug_ElytraHighlight_{side}"], M["blush"],
                       SHELL_C + Vector((sx * 0.2, 0.0, 0.15)))

    # underbody: a flat warm dark bean under the dome that holds the leg
    # roots and meets the head
    kit.blob(parts["Ladybug_Abdomen"], M["dark"], ABDOMEN_C, 0.4, (0.5, 0.5), (0.12, 0.12), ex=0.9, ey=0.9,
             ez=(0.7, 0.9), res=3)

    # legs: short chunky pegs from deep in the underbody to a round foot
    for side, sx in SIDES:
        for suffix, root, foot in LEGS:
            kit.capsule(parts[f"Ladybug_Leg_{side}{suffix}"], M["dark"], mirror(root, sx), LEG_R, mirror(foot, sx),
                        FOOT_R, segments=6, arc=2, mid=1)

    # head: one big round warm dark form in front of the dome
    kit.blob(parts["Ladybug_Head"], M["dark"], HEAD_C, **HEAD)
    head = kit.Surface(parts["Ladybug_Head"])
    for side, sx in SIDES:
        bug_eye(kit, parts[f"Ladybug_Eye_{side}"], parts[f"Ladybug_PronotumSpot_{side}"], head,
                HEAD_C + Vector((sx * 0.05, 0.0, 0.0)), Vector((sx * EYE_X, HEAD_C.y - 0.6, EYE_Z)), sx)
        kit.blush(parts["Ladybug_Thorax"], M["blush"], head, HEAD_C,
                  HEAD_C + Vector((sx * 0.265, -0.4, -0.075)), 0.1, 0.145, segments=8)
        antenna(kit, parts[f"Ladybug_Antenna_{side}"], sx, head)

    # underwings: hidden at rest, so they are authored folded back behind
    # the shell (see WING)
    for side, sx in SIDES:
        kit.wing_panel(parts[f"Ladybug_Underwing_{side}"], M["wing"], mirror(WING["root"], sx),
                       mirror(WING["tip"], sx), mirror(WING["normal"], sx), WING["width"], 0.04, root_width=0.35,
                       widest=0.5, sweep=0.1, segments=14, rings=(0.7,))

    kit.rebuild_all(parts, space)
    kit.apply_colours(party_style, COLOURS)


def wing_offsets(amount, flutter=0.0):
    """Wing and elytra pivot offsets of updateLadybugRig at `amount` open."""
    swing = amount * (0.78 + flutter * 0.8)
    return {"Ladybug_WingPivot_L": (0.08 * amount, 0.0, -swing), "Ladybug_WingPivot_R": (0.08 * amount, 0.0, swing),
            "Ladybug_ElytraPivot_L": (-0.16 * amount, 0.0, -0.82 * amount),
            "Ladybug_ElytraPivot_R": (-0.16 * amount, 0.0, 0.82 * amount)}


def size_report(kit):
    """`kit.size_report` without the underwings, which the runtime hides
    at rest (they reach back behind the shell)."""
    lo = Vector((1e9, 1e9, 1e9))
    hi = -lo
    for o in kit.mesh_objects(PREFIX):
        if "Underwing" in o.name:
            continue
        for v in o.data.vertices:
            p = o.matrix_world @ v.co
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
    size = hi - lo
    parts = [f"{label} {now:.2f} ({now / ref - 1:+.0%}){'' if abs(now / ref - 1) <= 0.1 else ' <--'}"
             for label, now, ref in zip(("width", "length", "height"), size, REFERENCE)]
    print(f"CHECK size vs {REFERENCE} (underwings hidden at rest): " + ", ".join(parts)
          + f"; lowest point z {lo.z:+.3f}")


def check(kit):
    size_report(kit)
    O = bpy.data.objects
    shell = sum(kit._mesh_volume(O[f"Ladybug_Elytra_{s}"]) for s in ("L", "R"))
    print(f"CHECK proportions: head / shell volume {kit._mesh_volume(O['Ladybug_Head']) / shell:.2f}")
    kit.triangle_report(PREFIX, BUDGET, hidden={"Ladybug_Underwing_L", "Ladybug_Underwing_R"})
    kit.thickness_report(PREFIX, SCALE)
    legs = [f"Ladybug_Leg_{s}{i}" for s in ("L", "R") for i in (1, 2, 3)]
    joints = [("Ladybug_Antenna_L", "Ladybug_Head"), ("Ladybug_Antenna_R", "Ladybug_Head")]

    def legs_pose(rx_l, rx_r, rz=0.0, alternate=True):
        out = {}
        for i in (1, 2, 3):
            sign = -1 if alternate and i == 2 else 1
            out[f"Ladybug_LegPivot_L{i}"] = (rx_l * sign, 0.0, -rz)
            out[f"Ladybug_LegPivot_R{i}"] = (rx_r * sign, 0.0, rz)
        return out

    def antennae(ax, az):
        return {"Ladybug_AntennaPivot_L": (ax, 0.0, -az), "Ladybug_AntennaPivot_R": (ax, 0.0, az)}

    # extremes of updateLadybugRig (three.js node-local offsets; see
    # kit.apply_pose): crawl step 0.3 with the legs in antiphase and a body
    # bob of 0.018, idle step 0.035, antenna wobble 0.18 (0.08 in flight),
    # flight with the legs folded (-0.2, 0.16), shell lifted and wings
    # fluttering from 0.78 to 1.58
    crawl = legs_pose(0.3, -0.3)
    crawl["Ladybug_BodyPivot"] = {"pos": (0.0, 0.018, 0.0)}
    crawl_back = legs_pose(-0.3, 0.3)
    fly = legs_pose(-0.2, -0.2, 0.16, alternate=False)
    fly.update(wing_offsets(1.0, 0.5))
    fly.update(antennae(0.08, 0.08))
    poses = {
        "rest": {},
        "crawl +": crawl,
        "crawl - (feet sink)": crawl_back,
        "idle": legs_pose(0.035, -0.035),
        "antennae up out": antennae(0.18, 0.18),
        "antennae up in": antennae(0.18, -0.18),
        "antennae down out": antennae(-0.18, 0.18),
        "antennae down in": antennae(-0.18, -0.18),
        "wings opening": wing_offsets(0.5),
        "fly": fly,
    }
    kit.procedural_report("Ladybug_Abdomen", "Ladybug_Head", legs, legs, [], poses, joints=joints)
    wing_report(kit)


def wing_report(kit):
    """Lowest underwing point over the range where the runtime shows them:
    opening (flutter 0), flight (flutter 0 to 1) and landing."""
    O = bpy.data.objects
    rest = {o.name: o.matrix_basis.copy() for o in O}
    lowest = []
    for amount, flutter in ((0.03, 0.0), (0.3, 0.0), (0.6, 0.0), (1.0, 0.0), (1.0, 0.5), (1.0, 1.0), (0.3, 1.0)):
        kit.apply_pose(wing_offsets(amount, flutter))
        low = min((O[n].matrix_world @ v.co).z for n in ("Ladybug_Underwing_L", "Ladybug_Underwing_R")
                  for v in O[n].data.vertices)
        lowest.append(f"{amount:.2f}/{flutter:.1f} {low:+.3f}")
        for o in O:
            o.matrix_basis = rest[o.name]
        bpy.context.view_layer.update()
    print("CHECK underwing lowest z (open/flutter): " + ", ".join(lowest))
