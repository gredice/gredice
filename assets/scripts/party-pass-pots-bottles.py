"""Restyle the pots, the autumn aster pot and the liquid preparation bottles
for the toy-diorama look in GAME_ART.md.

Pots. All ten pots are one family: a smooth solid of revolution with a thick
rolled rim, rebuilt from a rounded profile at 28 segments, and a low domed
soil disc tucked into the rim. The pot meshes carry no material; their glazed
colours, roughness and the soil colour are set in code, in
`packages/game/src/entities/potPalette.ts`, which mirrors `POT_SCREEN` below.

Autumn aster pot. Reuses the rebuilt low bowl and soil exactly, as the release
audit in `generate-autumn-aster-pot.py` expects. The five asters become chunky
scalloped cushions with domed centres, and the sixteen thin leaves become one
lobed leaf mound with short stalks. Its colours come from the bright seasonal
roles (GAME_ART.md, decided 2026-11-23): a glazed terracotta bowl in the gloss
band, satin aster petals, centres and leaves, and matte bed soil; metalness
stays 0. Petal and centre colours per variant are set in code, from
`packages/js/src/autumnAsterPots`. Rebuild the release record afterwards with
`packages/game/scripts/build-autumn-aster-pots-release.ts`.

Bottles. The nine liquid preparation bottles share one template: a rounded
foot band, a straight body, a domed shoulder, a short neck and a chunky
fluted cap. The label keeps its exact angle, height and UV mapping on the
body, so the per-product artwork stays where it was. The body takes the
product colour from `liquid-preparation-labels/label-variants.json` (nudged
into the on-screen range); the three green products get a lemon, a lime and a
mint body so they differ even with the label turned away. The cap, neck and
foot band are a warm cream neutral, at the top of the neutral saturation range
so the game's cool fill does not turn it grey, and the label, with its cream
frame, is the accent. A cream body was tried first: under the game's cool fill
its shaded sides read grey.

Object names, origins, transforms and material names do not change.

Run from the repository root, then export the touched assets:

    /Applications/Blender.app/Contents/MacOS/Blender -b \\
        --python assets/scripts/party-pass-pots-bottles.py [-- --asset PotLowBowl ...]
    (cd assets && Blender -b --python export-game-assets.py -- --asset PotLowBowl ...)

The script is idempotent: it rebuilds every mesh from the numbers below.
Pass `-- --check` to only print bounds, triangles and materials.
"""

import argparse
import colorsys
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import party_style  # noqa: E402

ASSETS_DIR = Path(__file__).resolve().parents[1] / "game-assets"
LABEL_VARIANTS = ASSETS_DIR / "liquid-preparation-labels" / "label-variants.json"


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", action="append", default=[])
    parser.add_argument("--check", action="store_true")
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


# ------------------------------------------------------------------ profiles
def rounded_profile(points):
    """Turns (r, z[, fillet]) control points into a dense rounded polyline.

    Each corner with a fillet radius is replaced by a circular arc tangent to
    both neighbouring segments. A fillet never uses more than half of either
    segment, so neighbouring fillets cannot overlap. Small fillets get fewer
    arc steps: at the default zoom they are only a few pixels across.
    """
    out = [Vector(points[0][:2])]
    for index in range(1, len(points) - 1):
        p0 = Vector(points[index - 1][:2])
        p1 = Vector(points[index][:2])
        p2 = Vector(points[index + 1][:2])
        radius = points[index][2] if len(points[index]) > 2 else 0.0
        a = p0 - p1
        b = p2 - p1
        la, lb = a.length, b.length
        a.normalize()
        b.normalize()
        theta = math.acos(max(-1.0, min(1.0, a.dot(b))))
        if radius <= 0 or theta > math.pi - 1e-3:
            out.append(p1)
            continue
        distance = radius / math.tan(theta / 2)
        limit = 0.5 * min(la, lb)
        if distance > limit:
            distance = limit
            radius = distance * math.tan(theta / 2)
        start = p1 + a * distance
        end = p1 + b * distance
        centre = p1 + (a + b).normalized() * (radius / math.sin(theta / 2))
        turn = math.pi - theta
        step = math.radians(45 if radius <= 0.032 else 26)
        steps = max(1, math.ceil(turn / step - 1e-6))
        angle0 = math.atan2(*(reversed(start - centre)))
        angle1 = math.atan2(*(reversed(end - centre)))
        delta = (angle1 - angle0 + math.pi) % math.tau - math.pi
        for k in range(steps + 1):
            angle = angle0 + delta * k / steps
            out.append(centre + radius * Vector((math.cos(angle), math.sin(angle))))
    out.append(Vector(points[-1][:2]))
    dense = [out[0]]
    for point in out[1:]:
        if (point - dense[-1]).length > 1e-5:
            dense.append(point)
    return [(max(0.0, p.x), p.y) for p in dense]


def ellipse_points(centre, radii, start, end, count):
    """Points on an elliptical arc in the (r, z) plane, angles in degrees."""
    points = []
    for k in range(count):
        angle = math.radians(start + (end - start) * k / (count - 1))
        points.append(
            (centre[0] + radii[0] * math.cos(angle), centre[1] + radii[1] * math.sin(angle))
        )
    return points


def lathe(bm, profile, segments, radial=None, sharp_rings=(), smooth=True, phase=0.0):
    """Revolves an (r, z) profile around the z axis.

    The profile runs with the solid on its left, so faces point outward.
    Points with r == 0 become a single axis vertex (a fan). `radial(angle,
    r, z)` may reshape each ring; rings listed in `sharp_rings` get sharp
    edges so a hidden cap does not bend the normals of a visible side.
    """
    rings = []
    for r, z in profile:
        if r < 1e-6:
            rings.append([bm.verts.new((0.0, 0.0, z))])
            continue
        ring = []
        for k in range(segments):
            angle = math.tau * k / segments + phase
            rr = radial(angle, r, z) if radial else r
            ring.append(bm.verts.new((rr * math.cos(angle), rr * math.sin(angle), z)))
        rings.append(ring)
    faces = []
    for low, high in zip(rings, rings[1:]):
        for k in range(segments):
            k2 = (k + 1) % segments
            if len(low) == 1 and len(high) == 1:
                continue
            if len(low) == 1:
                verts = (low[0], high[k2], high[k])
            elif len(high) == 1:
                verts = (low[k], low[k2], high[0])
            else:
                verts = (low[k], low[k2], high[k2], high[k])
            face = bm.faces.new(verts)
            face.smooth = smooth
            faces.append(face)
    for index in sharp_rings:
        ring = rings[index]
        if len(ring) < 2:
            continue
        for k in range(segments):
            edge = bm.edges.get((ring[k], ring[(k + 1) % segments]))
            if edge:
                edge.smooth = False
    return faces, rings


def write_mesh(obj, bm):
    """Replaces the mesh of `obj`, keeping its name, transform and slots."""
    for face in bm.faces:
        face.material_index = 0
    bm.normal_update()
    bm.to_mesh(obj.data)
    bm.free()
    for modifier in list(obj.modifiers):
        obj.modifiers.remove(modifier)
    obj.data.update()


def inner_radius_at(profile, z):
    """Radius of the inner wall (after the highest point) at height z."""
    top = max(range(len(profile)), key=lambda i: (profile[i][1], -i))
    for (r0, z0), (r1, z1) in zip(profile[top:], profile[top + 1 :]):
        if min(z0, z1) <= z <= max(z0, z1) and abs(z1 - z0) > 1e-9:
            t = (z - z0) / (z1 - z0)
            return r0 + (r1 - r0) * t
    raise RuntimeError(f"no inner wall at z={z}")


# ---------------------------------------------------------------------- pots
POT_SEGMENTS = 28

# Outer profile from the base centre, over the rolled rim and down the inner
# wall to a floor under the soil, as (r, z, fillet radius). Heights and the
# widest radius match the original pots, so footprints and hitboxes hold.
POTS = {
    "PotLowBowl": {
        "pot": "PotVariant_01_Low_Bowl",
        "soil": "PotVariant_Soil_01",
        "profile": [
            (0.0, 0.0),
            (0.125, 0.0, 0.03),
            (0.237, 0.108, 0.08),
            (0.252, 0.14, 0.012),
            (0.285, 0.152, 0.02),
            (0.285, 0.215, 0.03),
            (0.225, 0.215, 0.025),
            (0.214, 0.17),
            (0.206, 0.15),
            (0.0, 0.15),
        ],
        "soil_top": 0.192,
    },
    "PotRoundedBowl": {
        "pot": "PotVariant_02_Rounded_Bowl",
        "soil": "PotVariant_Soil_02",
        "profile": [
            (0.0, 0.0),
            (0.11, 0.0, 0.03),
            (0.244, 0.165, 0.13),
            (0.198, 0.29, 0.035),
            (0.235, 0.312, 0.02),
            (0.235, 0.39, 0.03),
            (0.175, 0.39, 0.025),
            (0.166, 0.345),
            (0.16, 0.32),
            (0.0, 0.32),
        ],
        "soil_top": 0.368,
    },
    "PotBulbousNeck": {
        "pot": "PotVariant_03_Bulbous_Neck",
        "soil": "PotVariant_Soil_03",
        "profile": [
            (0.0, 0.0),
            (0.14, 0.0, 0.02),
            # A round belly: an ellipse around the pot axis.
            *ellipse_points((0.0, 0.195), (0.28, 0.2), -60, 56, 10),
            (0.17, 0.374, 0.03),
            (0.205, 0.392, 0.02),
            (0.205, 0.465, 0.03),
            (0.145, 0.465, 0.025),
            (0.138, 0.42),
            (0.132, 0.398),
            (0.0, 0.398),
        ],
        "soil_top": 0.443,
    },
    "PotTallTapered": {
        "pot": "PotVariant_04_Tall_Tapered",
        "soil": "PotVariant_Soil_04",
        "profile": [
            (0.0, 0.0),
            (0.14, 0.0, 0.03),
            (0.205, 0.355, 0.02),
            (0.245, 0.372, 0.02),
            (0.245, 0.5, 0.03),
            (0.185, 0.5, 0.025),
            (0.176, 0.45),
            (0.17, 0.43),
            (0.0, 0.43),
        ],
        "soil_top": 0.478,
    },
    "PotHourglass": {
        "pot": "PotVariant_05_Hourglass",
        "soil": "PotVariant_Soil_05",
        "profile": [
            (0.0, 0.0),
            (0.12, 0.0, 0.03),
            (0.168, 0.085, 0.05),
            (0.112, 0.2, 0.06),
            (0.218, 0.3, 0.08),
            (0.255, 0.368, 0.025),
            (0.255, 0.43, 0.03),
            (0.195, 0.43, 0.025),
            (0.186, 0.39),
            (0.18, 0.37),
            (0.0, 0.37),
        ],
        "soil_top": 0.408,
    },
    "PotStraightShortTub": {
        "pot": "PotVariant_06_Straight_Short_Tub",
        "soil": "PotVariant_Soil_06",
        "profile": [
            (0.0, 0.0),
            (0.155, 0.0, 0.035),
            (0.185, 0.255, 0.02),
            (0.22, 0.272, 0.02),
            (0.22, 0.36, 0.03),
            (0.16, 0.36, 0.025),
            (0.154, 0.32),
            (0.15, 0.3),
            (0.0, 0.3),
        ],
        "soil_top": 0.338,
    },
    "PotNarrowFootBowl": {
        "pot": "PotVariant_07_Narrow_Foot_Bowl",
        "soil": "PotVariant_Soil_07",
        "profile": [
            (0.0, 0.0),
            (0.115, 0.0, 0.025),
            (0.1, 0.05, 0.02),
            (0.205, 0.125, 0.07),
            (0.27, 0.258, 0.015),
            (0.3, 0.272, 0.02),
            (0.3, 0.35, 0.03),
            (0.24, 0.35, 0.025),
            (0.232, 0.3),
            (0.224, 0.28),
            (0.0, 0.28),
        ],
        "soil_top": 0.328,
    },
    "PotSquatRidged": {
        "pot": "PotVariant_08_Squat_Ridged_Pot",
        "soil": "PotVariant_Soil_08",
        "profile": [
            (0.0, 0.0),
            (0.13, 0.0, 0.03),
            (0.226, 0.075, 0.045),
            (0.205, 0.14, 0.03),
            (0.252, 0.2, 0.045),
            (0.228, 0.262, 0.025),
            (0.26, 0.288, 0.02),
            (0.26, 0.375, 0.03),
            (0.2, 0.375, 0.025),
            (0.19, 0.33),
            (0.185, 0.31),
            (0.0, 0.31),
        ],
        "soil_top": 0.353,
    },
    "PotTallSlenderCone": {
        "pot": "PotVariant_09_Tall_Slender_Cone",
        "soil": "PotVariant_Soil_09",
        "profile": [
            (0.0, 0.0),
            (0.115, 0.0, 0.03),
            (0.178, 0.425, 0.02),
            (0.23, 0.445, 0.02),
            (0.23, 0.575, 0.03),
            (0.17, 0.575, 0.025),
            (0.161, 0.52),
            (0.155, 0.5),
            (0.0, 0.5),
        ],
        "soil_top": 0.553,
    },
    "PotWideLippedCup": {
        "pot": "PotVariant_10_Wide_Lipped_Cup",
        "soil": "PotVariant_Soil_10",
        "profile": [
            (0.0, 0.0),
            (0.13, 0.0, 0.03),
            (0.19, 0.17, 0.08),
            (0.245, 0.305, 0.025),
            (0.33, 0.37, 0.025),
            (0.33, 0.45, 0.03),
            (0.27, 0.45, 0.025),
            (0.26, 0.4),
            (0.25, 0.38),
            (0.0, 0.38),
        ],
        "soil_top": 0.428,
    },
}
SOIL_DOME = 0.016
# How far the soil edge tucks into the pot wall.
SOIL_TUCK = 0.005

# On-screen glaze colours (sunlit top face), mirrored in potPalette.ts.
# PotLowBowl is the bowl of the autumn aster pot: seasonal terracotta.
POT_SCREEN = {
    "PotLowBowl": party_style.SEASONAL_ROLES["terracotta"][0],
    "PotRoundedBowl": "#4cbf86",
    "PotBulbousNeck": "#ec60a4",
    "PotTallTapered": "#f0bd38",
    "PotHourglass": "#5b8fe3",
    "PotStraightShortTub": "#9a5ce6",
    "PotNarrowFootBowl": "#ef7a63",
    "PotSquatRidged": "#35aab6",
    "PotTallSlenderCone": "#de4a63",
    "PotWideLippedCup": "#ec9436",
}
POT_GLAZE_ROUGHNESS = 0.38


def pot_profile(spec):
    # Pots stand on the ground: no fillet point may dip below it.
    return [(r, max(0.0, z)) for r, z in rounded_profile(spec["profile"])]


def soil_profile(spec, profile):
    top = spec["soil_top"]
    edge = inner_radius_at(profile, top) + SOIL_TUCK
    return [
        (edge, top),
        (edge * 0.62, top + SOIL_DOME * 0.62),
        (edge * 0.3, top + SOIL_DOME * 0.93),
        (0.0, top + SOIL_DOME),
    ]


def build_pot_meshes(spec):
    """Returns (pot bmesh, soil bmesh) for a pot spec."""
    profile = pot_profile(spec)
    pot = bmesh.new()
    lathe(pot, profile, POT_SEGMENTS)
    soil = bmesh.new()
    # An open dome: its edge is buried in the wall and nothing sees below.
    lathe(soil, soil_profile(spec, profile), POT_SEGMENTS)
    return pot, soil


def restyle_pot(name):
    spec = POTS[name]
    pot, soil = build_pot_meshes(spec)
    write_mesh(bpy.data.objects[spec["pot"]], pot)
    write_mesh(bpy.data.objects[spec["soil"]], soil)


# ------------------------------------------------------------ autumn asters
# Material -> (seasonal or base role, roughness). The petal and centre colours
# here are the Mauve variant; code sets each variant's own. Petals and centres
# share the satin aster roughness (AutumnAsterPot.tsx).
ASTER_PETAL_ROUGHNESS = party_style.SEASONAL_ROLES["aster_violet"][1]
ASTER_MATERIALS = {
    "Material.AutumnAster.Terracotta": ("terracotta", party_style.SEASONAL_ROLES["terracotta"][1]),
    "Material.AutumnAster.Soil": ("bed_soil", party_style.SCREEN_ROLES["bed_soil"][1]),
    "Material.AutumnAster.Foliage": ("crop_leaf", party_style.SCREEN_ROLES["crop_leaf"][1]),
    "Material.AutumnAster.Petals": ("aster_violet", ASTER_PETAL_ROUGHNESS),
    "Material.AutumnAster.Centers": ("autumn_gold", ASTER_PETAL_ROUGHNESS),
}
# (centre, radius, tilt about x and y), as in generate-autumn-aster-pot.py.
ASTER_FLOWERS = [
    ((0.0, 0.0, 0.52), 0.152, (0.0, 0.0)),
    ((-0.185, -0.148, 0.44), 0.142, (0.24, -0.25)),
    ((0.176, -0.156, 0.462), 0.142, (0.24, 0.25)),
    ((-0.156, 0.176, 0.474), 0.142, (-0.24, -0.25)),
    ((0.176, 0.166, 0.43), 0.142, (-0.24, 0.25)),
]
ASTER_PETALS = 10
ASTER_PETAL_SAMPLES = 4
ASTER_CUSHION_HEIGHT = 0.045
ASTER_CENTRE_RADIUS = 0.36
ASTER_CENTRE_HEIGHT = 0.036
ASTER_STALK_RADIUS = 0.021
# Leaf mound: (r, z, fillet), resting in the soil and spilling over the rim.
ASTER_MOUND = [
    (0.196, 0.17),
    (0.21, 0.205),
    (0.252, 0.24),
    (0.262, 0.275),
    (0.238, 0.322),
    (0.17, 0.366),
    (0.0, 0.388),
]
ASTER_MOUND_SEGMENTS = 18
ASTER_MOUND_LOBES = 6


def petal_outline(angle, offset):
    """Radius factor of a scalloped aster: full at a petal tip, 0.74 between."""
    position = ((angle - offset) * ASTER_PETALS / math.tau) % 1.0
    tip = abs(math.cos(math.pi * position))
    return 0.74 + 0.26 * tip**0.8


def flower_frame(centre, tilt):
    rotation = Matrix.Rotation(tilt[0], 4, "X") @ Matrix.Rotation(tilt[1], 4, "Y")
    return Matrix.Translation(centre) @ rotation


def build_aster_petals(bm):
    """One chunky scalloped cushion per flower."""
    segments = ASTER_PETALS * ASTER_PETAL_SAMPLES
    height = ASTER_CUSHION_HEIGHT
    for index, (centre, radius, tilt) in enumerate(ASTER_FLOWERS):
        offset = index * 0.23
        before = set(bm.verts)
        profile = [
            (0.0, -0.008),
            (radius, height * 0.38),
            (radius * 0.86, height * 0.9),
            (0.0, height),
        ]
        lathe(
            bm,
            profile,
            segments,
            radial=lambda angle, r, z, o=offset: r * petal_outline(angle, o),
        )
        verts = [v for v in bm.verts if v not in before]
        bmesh.ops.transform(bm, matrix=flower_frame(centre, tilt), verts=verts)


def build_aster_centres(bm):
    """A domed disc on each flower."""
    for centre, radius, tilt in ASTER_FLOWERS:
        before = set(bm.verts)
        rc = radius * ASTER_CENTRE_RADIUS
        base = ASTER_CUSHION_HEIGHT * 0.86
        profile = [
            (rc, base),
            (rc * 0.7, base + ASTER_CENTRE_HEIGHT * 0.8),
            (0.0, base + ASTER_CENTRE_HEIGHT),
        ]
        lathe(bm, profile, 10)
        verts = [v for v in bm.verts if v not in before]
        bmesh.ops.transform(bm, matrix=flower_frame(centre, tilt), verts=verts)


def build_aster_foliage(bm):
    """One lobed leaf mound and a short stalk under each flower."""
    lobe_phase = 0.4

    def lobes(angle, r, z):
        return r * (1.0 + 0.085 * math.cos(ASTER_MOUND_LOBES * angle + lobe_phase))

    lathe(bm, ASTER_MOUND, ASTER_MOUND_SEGMENTS, radial=lobes)
    for centre, radius, tilt in ASTER_FLOWERS:
        top = flower_frame(centre, tilt) @ Vector((0.0, 0.0, 0.0))
        bottom = Vector((top.x * 0.55, top.y * 0.55, 0.3))
        direction = top - bottom
        before = set(bm.verts)
        bmesh.ops.create_cone(
            bm,
            cap_ends=False,
            segments=6,
            radius1=ASTER_STALK_RADIUS,
            radius2=ASTER_STALK_RADIUS * 0.85,
            depth=direction.length,
        )
        verts = [v for v in bm.verts if v not in before]
        rotation = direction.to_track_quat("Z", "Y").to_matrix().to_4x4()
        bmesh.ops.transform(
            bm,
            matrix=Matrix.Translation(bottom + direction / 2) @ rotation,
            verts=verts,
        )
    for face in bm.faces:
        face.smooth = True


def restyle_autumn_aster_pot():
    spec = POTS["PotLowBowl"]
    pot, soil = build_pot_meshes(spec)
    write_mesh(bpy.data.objects["AutumnAsterPot_Pot"], pot)
    write_mesh(bpy.data.objects["AutumnAsterPot_Soil"], soil)
    for name, builder in (
        ("AutumnAsterPot_Petals", build_aster_petals),
        ("AutumnAsterPot_Centers", build_aster_centres),
        ("AutumnAsterPot_Foliage", build_aster_foliage),
    ):
        obj = bpy.data.objects[name]
        bm = bmesh.new()
        builder(bm)
        write_mesh(obj, bm)
        # Keep the single slot; drop the leftover UV map of the old leaves.
        for layer in list(obj.data.uv_layers):
            obj.data.uv_layers.remove(layer)
    for name, (role, roughness) in ASTER_MATERIALS.items():
        albedo, _ = party_style.seasonal_role_albedo(role)
        party_style.set_flat_colour(bpy.data.materials[name], albedo, roughness)


# -------------------------------------------------------------------- bottles
BOTTLE_SEGMENTS = 32
BOTTLE_NECK_SEGMENTS = 24
BOTTLE_BODY_RADIUS = 0.345
# The label keeps its original placement: a band of the cylinder at this
# radius, between these angles (degrees) and heights, with u running along
# the angle and v up the height.
LABEL_RADIUS = 0.351
LABEL_ANGLES = (-151.8794417522762, -28.12055824772383)
LABEL_HEIGHTS = (0.25, 0.715)
LABEL_COLUMNS = 33

BOTTLE_BASE = [
    (0.0, 0.0),
    (0.29, 0.0, 0.04),
    (0.353, 0.055, 0.06),
    (0.353, 0.15, 0.012),
    (0.335, 0.162),
    (0.0, 0.162),
]
BOTTLE_BODY = [(0.0, 0.13), (BOTTLE_BODY_RADIUS, 0.13), (BOTTLE_BODY_RADIUS, 0.765), (0.0, 0.765)]
BOTTLE_SHOULDER_BASE = 0.765
BOTTLE_SHOULDER_TOP = 0.945
BOTTLE_SHOULDER_NECK = 0.16
BOTTLE_NECK = [(0.0, 0.9), (0.165, 0.9), (0.165, 1.0), (0.0, 1.0)]
BOTTLE_CAP = [
    (0.0, 0.968),
    (0.226, 0.968, 0.016),
    (0.248, 0.99, 0.02),
    (0.248, 1.165, 0.05),
    (0.2, 1.225, 0.045),
    (0.0, 1.225),
]
BOTTLE_CAP_FLUTES = 8
BOTTLE_CAP_FLUTE_DEPTH = 0.07

# Warmer and more saturated than the cream role (#f2e4c6): in game the cool
# fill takes about half the saturation off a pale warm neutral.
BOTTLE_CREAM_SCREEN = "#f0dab4"
# Bodies that do not follow the label primary: the three green labels would
# give three near-identical yellow-greens.
BOTTLE_BODY_SCREEN = {
    "LiquidPreparationBottleBeetleControl": "#5ee08c",
    "LiquidPreparationBottleDiseaseControl": "#e1e64e",
}
BOTTLE_BODY_ROUGHNESS = 0.5
BOTTLE_CAP_ROUGHNESS = 0.35
BOTTLE_LABEL_ROUGHNESS = 0.5


def shoulder_profile():
    centre_r = BOTTLE_SHOULDER_NECK
    radius_r = BOTTLE_BODY_RADIUS - centre_r
    radius_z = BOTTLE_SHOULDER_TOP - BOTTLE_SHOULDER_BASE
    points = [(0.0, BOTTLE_SHOULDER_BASE)]
    for k in range(8):
        angle = math.radians(90 * k / 7)
        points.append(
            (
                centre_r + radius_r * math.cos(angle),
                BOTTLE_SHOULDER_BASE + radius_z * math.sin(angle),
            )
        )
    points.append((0.0, BOTTLE_SHOULDER_TOP))
    return points


def cap_radial(angle, r, z):
    """Eight soft flutes on the side of the cap, fading over the top edge."""
    side = max(0.0, min(1.0, (r - 0.2) / 0.048))
    wave = math.cos(BOTTLE_CAP_FLUTES * angle)
    return r * (1.0 + BOTTLE_CAP_FLUTE_DEPTH * 0.5 * (wave - 1.0) * side)


def build_label(bm):
    layer = bm.loops.layers.uv.verify()
    a0, a1 = (math.radians(a) for a in LABEL_ANGLES)
    z0, z1 = LABEL_HEIGHTS
    columns = []
    for i in range(LABEL_COLUMNS):
        u = i / (LABEL_COLUMNS - 1)
        angle = a0 + (a1 - a0) * u
        column = [
            bm.verts.new((LABEL_RADIUS * math.cos(angle), LABEL_RADIUS * math.sin(angle), z))
            for z in (z0, z1)
        ]
        columns.append((u, column))
    for (u0, c0), (u1, c1) in zip(columns, columns[1:]):
        face = bm.faces.new((c0[0], c1[0], c1[1], c0[1]))
        face.smooth = True
        for loop, uv in zip(face.loops, ((u0, 0.0), (u1, 0.0), (u1, 1.0), (u0, 1.0))):
            loop[layer].uv = uv


def screen_albedo(target):
    return party_style.screen_to_albedo(target)


def product_screen_colour(primary):
    """The label's primary colour, nudged into the on-screen range."""
    r, g, b = (int(primary[i : i + 2], 16) / 255 for i in (1, 3, 5))
    hue, saturation, value = colorsys.rgb_to_hsv(r, g, b)
    saturation = min(0.8, max(0.6, saturation))
    # The body is mostly seen from its shaded side, where yellows and greens
    # turn olive unless they stay bright and lean warm.
    if 0.09 < hue < 0.3:
        hue -= 0.012
        value_floor = 0.9
    else:
        value_floor = 0.84
    value = min(0.93, max(value_floor, value))
    r, g, b = colorsys.hsv_to_rgb(hue, saturation, value)
    return "#" + "".join(f"{round(channel * 255):02x}" for channel in (r, g, b))


def label_variant(asset_name):
    variants = json.loads(LABEL_VARIANTS.read_text())
    return next(v for v in variants if v["assetName"] == asset_name)


def restyle_bottle(asset_name):
    prefix = asset_name
    parts = {
        "Base_Rim": lambda bm: lathe(bm, rounded_profile(BOTTLE_BASE), BOTTLE_SEGMENTS, sharp_rings=(-2,)),
        "Body": lambda bm: lathe(bm, BOTTLE_BODY, BOTTLE_SEGMENTS, sharp_rings=(1, 2)),
        "Shoulder": lambda bm: lathe(bm, shoulder_profile(), BOTTLE_SEGMENTS, sharp_rings=(1,)),
        "Neck": lambda bm: lathe(bm, BOTTLE_NECK, BOTTLE_NECK_SEGMENTS, sharp_rings=(1, 2)),
        "Cap": lambda bm: lathe(
            bm,
            rounded_profile(BOTTLE_CAP),
            BOTTLE_CAP_FLUTES * 4,
            radial=cap_radial,
        ),
        "Label": build_label,
    }
    for part, builder in parts.items():
        obj = bpy.data.objects[f"{prefix}_{part}"]
        bm = bmesh.new()
        builder(bm)
        if part == "Label":
            # Keep the existing UV map name.
            uv_name = obj.data.uv_layers[0].name if obj.data.uv_layers else "LabelUV"
            write_mesh(obj, bm)
            obj.data.uv_layers[0].name = uv_name
        else:
            write_mesh(obj, bm)

    variant = label_variant(asset_name)
    product = screen_albedo(
        BOTTLE_BODY_SCREEN.get(asset_name) or product_screen_colour(variant["primary"])
    )
    cream = screen_albedo(BOTTLE_CREAM_SCREEN)
    materials = {
        "Body": (product, BOTTLE_BODY_ROUGHNESS),
        "NeckShadow": (cream, BOTTLE_CAP_ROUGHNESS),
        "BaseShadow": (cream, BOTTLE_CAP_ROUGHNESS),
        "Cap": (cream, BOTTLE_CAP_ROUGHNESS),
    }
    for suffix, (albedo, roughness) in materials.items():
        material = bpy.data.materials[f"Material.{prefix}.{suffix}"]
        party_style.set_flat_colour(material, albedo, roughness)
    party_style.set_surface(bpy.data.materials[f"Material.{prefix}.Label"], BOTTLE_LABEL_ROUGHNESS)


BOTTLES = [
    "LiquidPreparationBottleAphidControl",
    "LiquidPreparationBottleBeetleControl",
    "LiquidPreparationBottleDiseaseControl",
    "LiquidPreparationBottleFertilizer",
    "LiquidPreparationBottlePestControl",
    "LiquidPreparationBottleSlugControl",
    "LiquidPreparationBottleTomatoEggplantResistance",
    "LiquidPreparationBottleVoleControl",
    "LiquidPreparationBottleWeevilControl",
]

RESTYLERS = {name: (lambda n=name: restyle_pot(n)) for name in POTS}
RESTYLERS["AutumnAsterPot"] = restyle_autumn_aster_pot
RESTYLERS.update({name: (lambda n=name: restyle_bottle(n)) for name in BOTTLES})


# --------------------------------------------------------------------- audit
def report(asset):
    total = 0
    low = Vector((math.inf,) * 3)
    high = Vector((-math.inf,) * 3)
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        triangles = party_style.evaluated_triangles(obj)
        total += triangles
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            low = Vector(map(min, low, point))
            high = Vector(map(max, high, point))
        print(f"  {obj.name}: {triangles} tris, dims {tuple(round(d, 3) for d in obj.dimensions)}")
    for material in bpy.data.materials:
        if party_style.principled(material) is not None and material.users:
            print("  " + party_style.describe_material(material))
    print(
        f"{asset}: {total} tris, bounds {tuple(round(v, 3) for v in low)}"
        f" .. {tuple(round(v, 3) for v in high)}"
    )


def main():
    args = parse_args()
    names = args.asset or list(RESTYLERS)
    # The aster pot copies the low bowl, so the bowl is always built first.
    names.sort(key=lambda name: name != "PotLowBowl")
    for name in names:
        path = ASSETS_DIR / f"{name}.blend"
        bpy.ops.wm.open_mainfile(filepath=str(path))
        if not args.check:
            RESTYLERS[name]()
            bpy.context.preferences.filepaths.save_version = 0
            bpy.ops.wm.save_mainfile(filepath=str(path))
            print(f"Restyled {name}")
        report(name)


if __name__ == "__main__":
    main()
