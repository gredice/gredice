"""Restyle the animal homes for the toy-diorama look in GAME_ART.md.

Rebuilds the chicken coop, cow shelter, dog house, goat shelter, horse stable,
piglet pen, rabbit hutch and sheep fold as chunky rounded timber structures:
thicker posts and plank walls with modelled gaps, rounded roofs and ridges in
the bird house's roof red, shared by every home, soft straw mounds instead of
loose stalks, and real basins in troughs and bowls. Every edge the camera sees
is rounded, and every part is shaded smooth with weighted normals. Colours
are party_style roles; the roof and doorway colours are read from the
palette modules in packages/game/src/entities, which code uses too.

What stays the same, so the runtime keeps finding the same nodes:

- object names, parents, origins, rotations and scales, and the material
  slots of every object (one primitive per node where code reads a node's
  geometry by name);
- each home's footprint and its opening toward Blender +Y, where animals
  enter, and the bounds pinned in `animalHomeAssets.unit.ts`;
- the dog house's three wood colours, which `timberAssetPalette.unit.ts`
  pins; its runtime colours live in `DogHouse.tsx`.

Timber uses the shared walkway wood: warm for frames and posts, light for
boards and wattle. Meshes carry no UVs, since none of these materials is
textured, which keeps each GLB well under the 160 KB test cap.

Run from the repository root, then export the touched assets:

    /Applications/Blender.app/Contents/MacOS/Blender -b \
        --python assets/scripts/party-pass-homes.py
    (cd assets && Blender -b --python export-game-assets.py -- --asset DogHouse ...)

Pass `-- --asset DogHouse` to limit the run to one source file. The script
rebuilds every mesh from the numbers below, so it is safe to run again.
"""

import argparse
import math
import re
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import party_style  # noqa: E402

ASSETS_DIR = Path(__file__).resolve().parents[1] / "game-assets"

# ------------------------------------------------------------------ palette
# Each home colour is a role from party_style (SCREEN_ROLES or
# SEASONAL_ROLES, the tables in GAME_ART.md), with that role's roughness.
ROLE_NAMES = {
    "limewash": "cream",
    "stone": "stone",
    "straw": "hay",
    "enamel": "enamel_blue",
    "mud": "bed_soil",
    "salt": "cream",
}

# On-screen colour of a sunlit top face, and roughness by GAME_ART band, for
# the one colour without a reachable role: the water role is out of reach,
# so this is the closest clean blue.
SCREEN_COLOURS = {
    "water": ("#40b0f0", 0.12),
}

# Roof and doorway colours are shared with code, as linear albedo: the roof
# with the bird house (birdHousePalette.ts), the doorway with DogHouse.tsx
# (animalHomePalette.ts).
ENTITIES_DIR = Path(__file__).resolve().parents[2] / "packages" / "game" / "src" / "entities"


def ts_constant(file_name, name):
    """The value of `export const name = ...;` in a palette module."""
    text = (ENTITIES_DIR / file_name).read_text()
    match = re.search(rf"export const {name} = '?([#\w.]+)'?;", text)
    if match is None:
        raise RuntimeError(f"{file_name}: no constant {name}")
    return match.group(1)


CODE_COLOURS = {
    "roof": (
        party_style.hex_to_linear(ts_constant("birdHousePalette.ts", "birdHouseRoofColor")),
        float(ts_constant("birdHousePalette.ts", "birdHouseRoofRoughness")),
    ),
    "opening": (
        party_style.hex_to_linear(ts_constant("animalHomePalette.ts", "animalHomeDoorwayColor")),
        float(ts_constant("animalHomePalette.ts", "animalHomeDoorwayRoughness")),
    ),
}

# The shared walkway wood (`defaultGameWoodColor` and its light plank), as
# linear factors. Wood sits in the satin band.
WOOD_COLOURS = {
    "wood_warm": party_style.hex_to_linear("#875627"),
    "wood_light": party_style.hex_to_linear("#975f35"),
}
WOOD_ROUGHNESS = 0.55

# The dog house's runtime bowl colour from DogHouse.tsx, so the raw GLB
# matches what the game shows.
DOGHOUSE_BOWL = party_style.hex_to_linear("#2d70ad")

MATERIAL_ROLES = {
    "ChickenCoop": {
        "Material.ChickenCoop.Oak": "wood_warm",
        "Material.ChickenCoop.OakLight": "wood_light",
        "Material.ChickenCoop.Terracotta": "roof",
        "Material.ChickenCoop.Limewash": "limewash",
        "Material.ChickenCoop.Dark": "opening",
        "Material.ChickenCoop.Straw": "straw",
        "Material.ChickenCoop.Water": "water",
    },
    "CowShelter": {
        "Material.CowShelter.Enamel": "enamel",
        "Material.CowShelter.Limewash": "limewash",
        "Material.CowShelter.Roof": "roof",
        "Material.CowShelter.Stone": "stone",
        "Material.CowShelter.Timber": "wood_warm",
        "Material.CowShelter.Water": "water",
    },
    # The three dog house woods are pinned by timberAssetPalette.unit.ts.
    "DogHouse": {
        "Material.DogHouse.CharcoalRoof": "roof",
        "Material.DogHouse.BowlBlue": "doghouse_bowl",
        "Material.Water": "water",
    },
    "GoatShelter": {
        "Material.GoatShelter.LightWood": "wood_light",
        "Material.GoatShelter.Roof": "roof",
        "Material.GoatShelter.Salt": "salt",
        "Material.GoatShelter.Stone": "stone",
        "Material.GoatShelter.Timber": "wood_warm",
    },
    "HorseStable": {
        "Material.HorseStable.Enamel": "enamel",
        "Material.HorseStable.Oak": "wood_warm",
        "Material.HorseStable.Planks": "wood_light",
        "Material.HorseStable.Roof": "roof",
        "Material.HorseStable.Stone": "stone",
        "Material.HorseStable.Straw": "straw",
    },
    "PigletPen": {
        "Material.PigletPen.Enamel": "enamel",
        "Material.PigletPen.Hazel": "wood_light",
        "Material.PigletPen.Limewash": "limewash",
        "Material.PigletPen.Mud": "mud",
        "Material.PigletPen.Oak": "wood_warm",
        "Material.PigletPen.Roof": "roof",
        "Material.PigletPen.Stone": "stone",
        "Material.PigletPen.Straw": "straw",
    },
    "RabbitHutch": {
        "Material.RabbitHutch.Dark": "opening",
        "Material.RabbitHutch.Limewash": "limewash",
        "Material.RabbitHutch.Oak": "wood_warm",
        "Material.RabbitHutch.Roof": "roof",
        "Material.RabbitHutch.Straw": "straw",
        "Material.RabbitHutch.Timber": "wood_light",
    },
    "SheepFold": {
        "Material.SheepFold.Hazel": "wood_light",
        "Material.SheepFold.Roof": "roof",
        "Material.SheepFold.Stone": "stone",
        "Material.SheepFold.Straw": "straw",
        "Material.SheepFold.Timber": "wood_warm",
    },
}

# Bounds pinned by animalHomeAssets.unit.ts, in Blender axes:
# (half width, front +Y, back -Y, height).
TESTED_BOUNDS = {
    "RabbitHutch": (0.46, 0.63, 0.41, 0.98),
    "HorseStable": (0.95, 0.82, 0.92, 1.71),
    "CowShelter": (0.95, 0.8, 0.88, 1.5),
    "GoatShelter": (0.5, 0.51, 0.5, 1.01),
    "SheepFold": (0.87, 0.73, 0.81, 1.46),
}

# Bevel radii in metres, from the GAME_ART table.
R_LARGE = 0.06
R_TIMBER = 0.04
R_SMALL = 0.022
SEG = 2


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", action="append", default=[])
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def role_values(role):
    if role in WOOD_COLOURS:
        return WOOD_COLOURS[role], WOOD_ROUGHNESS
    if role == "doghouse_bowl":
        return DOGHOUSE_BOWL, 0.35
    if role in ROLE_NAMES:
        return party_style.seasonal_role_albedo(ROLE_NAMES[role])
    if role in CODE_COLOURS:
        return CODE_COLOURS[role]
    hex_value, roughness = SCREEN_COLOURS[role]
    return party_style.screen_to_albedo(hex_value), roughness


def apply_palette(asset):
    for material_name, role in MATERIAL_ROLES[asset].items():
        material = bpy.data.materials.get(material_name)
        if material is None:
            raise RuntimeError(f"{asset}: missing material {material_name}")
        albedo, roughness = role_values(role)
        party_style.set_flat_colour(material, albedo, roughness)
        material.diffuse_color = (*albedo[:3], 1.0)


# ------------------------------------------------------------------ shapes
def ordered(bm, elements):
    """BMesh elements in creation order.

    Sets of BMesh elements iterate in memory order, which changes from run to
    run; sorting them keeps the vertex order, and so the exported file and
    its version hash, the same every time the script runs.
    """
    bm.verts.index_update()
    bm.edges.index_update()
    bm.faces.index_update()
    return sorted(elements, key=lambda item: item.index)


def bevel_part(bm, faces, radius, segments=SEG, angle=30.0, sharp_down=True):
    """Rounds the edges of one closed part, like an angle-limited bevel.

    Edges flatter than `angle` stay, so pre-rounded profiles keep their arcs.
    With `sharp_down`, edges of downward faces stay sharp so a part sits flush
    on the ground or on the part below it.
    """
    faces = [face for face in faces if face.is_valid]
    face_set = set(faces)
    bm.normal_update()
    limit = math.radians(angle)
    down = Vector((0.0, 0.0, -1.0))
    edges = set()
    for face in faces:
        for edge in face.edges:
            linked = edge.link_faces
            if len(linked) != 2 or not all(item in face_set for item in linked):
                continue
            if sharp_down and any(item.normal.dot(down) > 0.9 for item in linked):
                continue
            if linked[0].normal.angle(linked[1].normal, 0.0) <= limit:
                continue
            edges.add(edge)
    if radius <= 0 or not edges:
        return faces
    before = set(bm.faces)
    bmesh.ops.bevel(
        bm,
        geom=ordered(bm, edges),
        offset=radius,
        offset_type="OFFSET",
        segments=segments,
        profile=0.5,
        affect="EDGES",
        clamp_overlap=True,
    )
    created = set(bm.faces) - before
    return [face for face in faces if face.is_valid] + ordered(bm, created)


def add_box(bm, low, high, radius=0.0, segments=3, sharp_sides=()):
    """party_style.add_box with its elements in creation order (see `ordered`).

    Rounds every edge except those of `sharp_sides` ("+x", "-z" and so on).
    """
    low, high = Vector(low), Vector(high)
    result = bmesh.ops.create_cube(bm, size=1.0)
    verts = result["verts"]
    bmesh.ops.scale(bm, vec=high - low, verts=verts)
    bmesh.ops.translate(bm, vec=(low + high) / 2, verts=verts)
    faces = ordered(bm, {face for vert in verts for face in vert.link_faces})
    if radius <= 0:
        return faces
    axes = {"x": 0, "y": 1, "z": 2}
    sharp_faces = set()
    for side in sharp_sides:
        axis = axes[side[1]]
        sign = 1 if side[0] == "+" else -1
        sharp_faces.update(face for face in faces if face.normal[axis] * sign > 0.9)
    edges = {
        edge
        for face in faces
        for edge in face.edges
        if not any(linked in sharp_faces for linked in edge.link_faces)
    }
    before = set(bm.faces)
    bmesh.ops.bevel(
        bm,
        geom=ordered(bm, edges),
        offset=radius,
        offset_type="OFFSET",
        segments=segments,
        profile=0.5,
        affect="EDGES",
        clamp_overlap=True,
    )
    created = set(bm.faces) - before
    return [face for face in faces if face.is_valid] + ordered(bm, created)


def box(bm, low, high, radius=R_TIMBER, segments=SEG, sharp_down=True):
    sharp = ("-z",) if sharp_down else ()
    return add_box(bm, low, high, radius, segments, sharp)


def tilted_box(bm, center, size, rotation, radius=R_TIMBER, segments=SEG):
    """A rounded box of `size` turned by Euler `rotation` around `center`."""
    half = Vector(size) / 2
    faces = add_box(bm, -half, half, radius, segments)
    verts = list({vert for face in faces for vert in face.verts})
    matrix = Matrix.Translation(center) @ Euler(rotation).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=matrix, verts=verts)
    return faces


def plank(bm, start, end, width, thickness, radius=R_SMALL, segments=SEG):
    """A board whose top surface runs from `start` to `end` in the YZ plane.

    `start` and `end` are (x, y, z); the board hangs `thickness` below that
    line and is `width` wide along X.
    """
    start, end = Vector(start), Vector(end)
    run = end - start
    pitch = math.atan2(run.z, run.y)
    length = run.length
    normal = Vector((0.0, -math.sin(pitch), math.cos(pitch)))
    center = (start + end) / 2 - normal * (thickness / 2)
    return tilted_box(
        bm, center, (width, length, thickness), (pitch, 0.0, 0.0), radius, segments
    )


def cleat(bm, start, end, t, width, depth=0.05, height=0.044, radius=0.016):
    """A small batten lying across a ramp, `t` of the way from start to end."""
    start, end = Vector(start), Vector(end)
    run = end - start
    pitch = math.atan2(run.z, run.y)
    normal = Vector((0.0, -math.sin(pitch), math.cos(pitch)))
    center = start.lerp(end, t) + normal * (height / 2 - 0.004)
    return tilted_box(bm, center, (width, depth, height), (pitch, 0.0, 0.0), radius, 1)


def to_3d(axis, u, v, w):
    if axis == "y":
        return Vector((u, w, v))
    if axis == "x":
        return Vector((w, u, v))
    return Vector((u, v, w))


def prism(bm, profile, axis, w0, w1, radius, segments=SEG, sharp_down=True):
    """Extrudes a simple polygon and rounds its edges.

    For axis "y" or "x" the profile is (horizontal, z); for "z" it is (x, y).
    """
    low = [bm.verts.new(to_3d(axis, u, v, w0)) for u, v in profile]
    high = [bm.verts.new(to_3d(axis, u, v, w1)) for u, v in profile]
    faces = [bm.faces.new(low), bm.faces.new(list(reversed(high)))]
    count = len(profile)
    for index in range(count):
        following = (index + 1) % count
        faces.append(
            bm.faces.new((low[index], low[following], high[following], high[index]))
        )
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return bevel_part(bm, faces, radius, segments, sharp_down=sharp_down)


def clip_band(polygon, low, high):
    """Clips a convex (u, v) polygon to low <= v <= high."""

    def clip(points, inside, cross):
        result = []
        for index, current in enumerate(points):
            previous = points[index - 1]
            if inside(current):
                if not inside(previous):
                    result.append(cross(previous, current))
                result.append(current)
            elif inside(previous):
                result.append(cross(previous, current))
        return result

    def crossing(level):
        def cross(a, b):
            t = (level - a[1]) / (b[1] - a[1])
            return (a[0] + (b[0] - a[0]) * t, level)

        return cross

    points = clip(polygon, lambda p: p[1] >= low, crossing(low))
    if points:
        points = clip(points, lambda p: p[1] <= high, crossing(high))
    unique = []
    for point in points:
        if not unique or (Vector(point) - Vector(unique[-1])).length > 1e-5:
            unique.append(point)
    if len(unique) > 2 and (Vector(unique[0]) - Vector(unique[-1])).length < 1e-5:
        unique.pop()
    return unique


def plank_stack(bm, polygon, axis, w0, w1, bands, radius=0.03, sharp_bottom=True):
    """A wall of stacked planks cut from one convex outline.

    `bands` lists (bottom, top) heights; the gaps between bands read as plank
    seams on every face of the wall.
    """
    faces = []
    for index, (bottom, top) in enumerate(bands):
        outline = clip_band(polygon, bottom, top)
        if len(outline) < 3:
            continue
        faces += prism(
            bm,
            outline,
            axis,
            w0,
            w1,
            radius,
            sharp_down=sharp_bottom and index == 0,
        )
    return faces


def bands_between(bottom, top, count, gap=0.018):
    height = (top - bottom - gap * (count - 1)) / count
    return [
        (bottom + index * (height + gap), bottom + index * (height + gap) + height)
        for index in range(count)
    ]


def arc(center, radius, start_deg, end_deg, steps):
    return [
        (
            center[0] + radius * math.cos(math.radians(angle)),
            center[1] + radius * math.sin(math.radians(angle)),
        )
        for angle in (
            start_deg + (end_deg - start_deg) * index / steps for index in range(steps + 1)
        )
    ]


def arch_outline(half_width, bottom, spring, steps=8):
    """An arched doorway: straight jambs from `bottom`, a round top."""
    return [
        (half_width, bottom),
        *arc((0.0, spring), half_width, 0, 180, steps),
        (-half_width, bottom),
    ]


def arch_frame(outer, inner, bottom, spring, steps=8):
    """An inverted U: a door frame open at the bottom."""
    return [
        (outer, bottom),
        *arc((0.0, spring), outer, 0, 180, steps),
        (-outer, bottom),
        (-inner, bottom),
        *arc((0.0, spring), inner, 180, 0, steps),
        (inner, bottom),
    ]


class Gable:
    """A gable roof whose ridge runs along Y, built as one rounded mass."""

    def __init__(self, half_width, eave_top, pitch_deg, thickness, apex_radius):
        self.half_width = half_width
        self.pitch = math.radians(pitch_deg)
        self.slope = math.tan(self.pitch)
        self.thickness = thickness
        self.ridge = eave_top + self.slope * half_width
        self.drop = thickness / math.cos(self.pitch)
        self.apex_radius = apex_radius

    def underside(self, x):
        return self.ridge - self.slope * abs(x) - self.drop

    @property
    def apex_top(self):
        centre = self.ridge - self.apex_radius / math.cos(self.pitch)
        return centre + self.apex_radius

    def profile(self, steps=5):
        w = self.half_width
        top = self.ridge - self.slope * w
        sin, cos = math.sin(self.pitch), math.cos(self.pitch)
        eave_low = (w - self.thickness * sin, top - self.thickness * cos)
        centre = (0.0, self.ridge - self.apex_radius / cos)
        crown = arc(
            centre,
            self.apex_radius,
            90 - math.degrees(self.pitch),
            90 + math.degrees(self.pitch),
            steps,
        )
        return [
            eave_low,
            (w, top),
            *crown,
            (-w, top),
            (-eave_low[0], eave_low[1]),
            (0.0, self.ridge - self.drop),
        ]

    def build(self, bm, y0, y1, radius=0.035):
        return prism(bm, self.profile(), "y", y0, y1, radius, sharp_down=False)

    def house(self, half_width, bottom, clearance=0.006):
        """Outline of a wall that fills the gable under this roof."""
        side = self.underside(half_width) - clearance
        apex = self.underside(0.0) - clearance
        return [
            (-half_width, bottom),
            (half_width, bottom),
            (half_width, side),
            (0.0, apex),
            (-half_width, side),
        ]


class Lean:
    """A single-pitch roof slab tilted about X, lower at the front (+Y)."""

    def __init__(self, center, size, tilt_deg):
        self.center = Vector(center)
        self.size = Vector(size)
        self.tilt = math.radians(-abs(tilt_deg))

    def build(self, bm, radius=0.055):
        return tilted_box(
            bm, self.center, self.size, (self.tilt, 0.0, 0.0), radius, SEG
        )

    def underside(self, y):
        """Height of the slab's underside above (any x, y)."""
        normal_z = math.cos(self.tilt)
        offset = self.size.z / 2 / normal_z
        return self.center.z + math.tan(self.tilt) * (y - self.center.y) - offset


def cylinder(
    bm,
    start,
    end,
    radius,
    segments=10,
    round_start=0.0,
    round_end=0.0,
    bevel_segments=SEG,
):
    """A round post or rail; `round_*` rounds that cap by a radius."""
    start, end = Vector(start), Vector(end)
    direction = end - start
    result = bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=segments,
        radius1=radius,
        radius2=radius,
        depth=direction.length,
    )
    verts = result["verts"]
    rotation = Vector((0.0, 0.0, 1.0)).rotation_difference(direction.normalized())
    matrix = Matrix.Translation((start + end) / 2) @ rotation.to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=matrix, verts=verts)
    faces = ordered(bm, {face for vert in verts for face in vert.link_faces})
    bm.normal_update()
    caps = [face for face in faces if len(face.verts) == segments]
    edges = []
    for cap in caps:
        at_start = (cap.calc_center_median() - start).length < (
            cap.calc_center_median() - end
        ).length
        amount = round_start if at_start else round_end
        if amount > 0:
            edges.append((cap, amount))
    for cap, amount in edges:
        if not cap.is_valid:
            continue
        before = set(bm.faces)
        bmesh.ops.bevel(
            bm,
            geom=list(cap.edges),
            offset=min(amount, radius * 0.9),
            offset_type="OFFSET",
            segments=bevel_segments,
            profile=0.5,
            affect="EDGES",
            clamp_overlap=True,
        )
        faces += ordered(bm, set(bm.faces) - before)
    return [face for face in faces if face.is_valid]


def lathe(bm, center, profile, segments=16, cap_first=True, cap_last=True, closed=False):
    """Spins an (r, z) profile around a vertical axis through `center`."""
    cx, cy, cz = center
    rings = []
    for radius, height in profile:
        rings.append(
            [
                bm.verts.new(
                    (
                        cx + radius * math.cos(math.tau * index / segments),
                        cy + radius * math.sin(math.tau * index / segments),
                        cz + height,
                    )
                )
                for index in range(segments)
            ]
        )
    faces = []
    pairs = list(zip(rings, rings[1:]))
    if closed:
        pairs.append((rings[-1], rings[0]))
    for lower, upper in pairs:
        for index in range(segments):
            following = (index + 1) % segments
            faces.append(
                bm.faces.new(
                    (lower[index], lower[following], upper[following], upper[index])
                )
            )
    if not closed:
        if cap_first:
            faces.append(bm.faces.new(rings[0]))
        if cap_last:
            faces.append(bm.faces.new(rings[-1]))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def mound(bm, center, radii, segments=14, rings=4, wobble=0.1, seed=0.0):
    """A soft pile resting flat on `center`: straw, hay or a mud wallow."""
    profile = []
    for ring in range(rings + 1):
        angle = (math.pi / 2) * ring / (rings + 0.6)
        profile.append((math.cos(angle), math.sin(angle)))
    cx, cy, cz = center
    layers = []
    for ring, (spread, rise) in enumerate(profile):
        layer = []
        for index in range(segments):
            theta = math.tau * index / segments
            lobe = 1.0 + wobble * (
                math.sin(theta * 3 + seed) * 0.6 + math.sin(theta * 5 + seed * 1.7) * 0.4
            )
            scale = spread * (lobe if ring < rings else 1.0 + (lobe - 1.0) * 0.5)
            layer.append(
                bm.verts.new(
                    (
                        cx + radii[0] * scale * math.cos(theta),
                        cy + radii[1] * scale * math.sin(theta),
                        cz + radii[2] * rise,
                    )
                )
            )
        layers.append(layer)
    faces = []
    for lower, upper in zip(layers, layers[1:]):
        for index in range(segments):
            following = (index + 1) % segments
            faces.append(
                bm.faces.new(
                    (lower[index], lower[following], upper[following], upper[index])
                )
            )
    faces.append(bm.faces.new(layers[0]))
    faces.append(bm.faces.new(layers[-1]))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def tub(bm, low, high, wall, depth, radius=0.025, segments=SEG):
    """An open box: a trough or tub with a real basin and rounded rim."""
    low, high = Vector(low), Vector(high)
    result = bmesh.ops.create_cube(bm, size=1.0)
    verts = result["verts"]
    bmesh.ops.scale(bm, vec=high - low, verts=verts)
    bmesh.ops.translate(bm, vec=(low + high) / 2, verts=verts)
    faces = ordered(bm, {face for vert in verts for face in vert.link_faces})
    bm.normal_update()
    top = max(faces, key=lambda face: face.normal.z)
    rim = bmesh.ops.inset_individual(bm, faces=[top], thickness=wall, depth=0.0)
    basin = bmesh.ops.inset_individual(bm, faces=[top], thickness=0.0, depth=-depth)
    faces = {face for vert in verts for face in vert.link_faces}
    faces |= set(rim["faces"]) | set(basin["faces"]) | {top}
    faces = ordered(bm, [face for face in faces if face.is_valid])
    return bevel_part(bm, faces, radius, segments)


# ------------------------------------------------------------------- homes
class Home:
    """Collects new geometry per role object, authored in world space."""

    def __init__(self, asset):
        self.asset = asset
        self.meshes = {}

    def add(self, object_name, material_name, faces):
        obj = bpy.data.objects[object_name]
        names = [slot.material.name if slot.material else None for slot in obj.material_slots]
        if material_name not in names:
            raise RuntimeError(f"{object_name}: no slot for {material_name}")
        party_style.assign(faces, names.index(material_name))

    def bm(self, object_name):
        if object_name not in self.meshes:
            if object_name not in bpy.data.objects:
                raise RuntimeError(f"{self.asset}: missing object {object_name}")
            self.meshes[object_name] = bmesh.new()
        return self.meshes[object_name]

    def finish(self):
        expected = {obj.name for obj in bpy.data.objects if obj.type == "MESH"}
        missing = expected - set(self.meshes)
        if missing:
            raise RuntimeError(f"{self.asset}: no new mesh for {sorted(missing)}")
        for object_name, bm in self.meshes.items():
            obj = bpy.data.objects[object_name]
            # Nothing may sink below the ground the home stands on.
            for vert in bm.verts:
                if vert.co.z < 0.0:
                    vert.co.z = 0.0
            bmesh.ops.transform(bm, matrix=obj.matrix_world.inverted(), verts=bm.verts)
            for face in bm.faces:
                face.smooth = True
            party_style.replace_mesh(obj, bm)
            for layer in list(obj.data.uv_layers):
                obj.data.uv_layers.remove(layer)


def part(home, object_name, material_name, builder, *args, **kwargs):
    faces = builder(home.bm(object_name), *args, **kwargs)
    home.add(object_name, material_name, faces)
    return faces


# --------------------------------------------------------------- rabbit hutch
def build_rabbit_hutch():
    home = Home("RabbitHutch")
    m = "Material.RabbitHutch."
    roof = Gable(half_width=0.45, eave_top=0.69, pitch_deg=26, thickness=0.1, apex_radius=0.09)
    floor_top = 0.31
    # Corner posts stand proud of the walls and stop under the roof.
    for x in (-0.34, 0.34):
        for y in (-0.27, 0.21):
            top = roof.underside(abs(x) + 0.06) - 0.004
            part(home, "RabbitHutch_Oak", m + "Oak", box, (x - 0.06, y - 0.06, 0.0), (x + 0.06, y + 0.06, top))
    part(home, "RabbitHutch_Oak", m + "Oak", box, (-0.37, -0.31, 0.22), (0.37, 0.25, floor_top), 0.035)
    # Plank body, a house shape under the roof.
    body = roof.house(0.33, floor_top)
    part(
        home,
        "RabbitHutch_Walls",
        m + "Timber",
        plank_stack,
        body,
        "y",
        -0.31,
        0.17,
        bands_between(floor_top, roof.underside(0.0), 4),
    )
    # Painted front with an arched doorway.
    front = roof.house(0.285, floor_top)
    doorway = arch_outline(0.12, floor_top, 0.47)
    outline = [front[0], (-0.12, floor_top), *reversed(doorway[1:-1]), (0.12, floor_top), *front[1:]]
    part(home, "RabbitHutch_Walls", m + "Limewash", prism, outline, "y", 0.15, 0.25, 0.03)
    # The opening, set back inside the doorway.
    part(home, "RabbitHutch_EntranceRamp", m + "Dark", prism, arch_outline(0.145, floor_top, 0.47), "y", 0.165, 0.19, 0.012)
    part(home, "RabbitHutch_EntranceRamp", m + "Timber", plank, (0.0, 0.215, floor_top), (0.0, 0.585, 0.045), 0.26, 0.055, 0.022)
    for t in (0.35, 0.68):
        part(home, "RabbitHutch_EntranceRamp", m + "Timber", cleat, (0.0, 0.215, floor_top), (0.0, 0.585, 0.045), t, 0.24)
    part(home, "RabbitHutch_Roof", m + "Roof", roof.build, -0.4, 0.36)
    part(home, "RabbitHutch_Roof", m + "Roof", cylinder, (0.0, -0.4, roof.apex_top - 0.035), (0.0, 0.36, roof.apex_top - 0.035), 0.055, 12, 0.03, 0.03)
    # Bedding spills out over the doorway sill.
    part(home, "RabbitHutch_Straw", m + "Straw", mound, (0.0, 0.17, floor_top), (0.115, 0.075, 0.07), 12, 3, 0.1, 1.3)
    home.finish()


# --------------------------------------------------------------- goat shelter
def build_goat_shelter():
    home = Home("GoatShelter")
    m = "Material.GoatShelter."
    base_top = 0.14
    roof = Lean((0.0, 0.0, 0.875), (0.9, 0.9, 0.12), 8)
    part(home, "GoatShelter_Stone", m + "Stone", box, (-0.44, -0.43, 0.0), (0.44, 0.43, base_top), R_LARGE)
    # Climbing step with a salt lick on top, and a board up to it.
    part(home, "GoatShelter_Platform", m + "Stone", box, (0.06, 0.04, base_top), (0.36, 0.32, 0.3), 0.045)
    part(home, "GoatShelter_Stone", m + "Salt", box, (0.13, 0.11, 0.3), (0.29, 0.25, 0.39), 0.035)
    part(home, "GoatShelter_Platform", m + "LightWood", tilted_box, (-0.067, 0.18, 0.245), (0.37, 0.2, 0.055), (0.0, -math.atan2(0.16, 0.33), 0.0), 0.022)
    # Posts carry a beam front and back; the roof rests on the beams.
    for y, beam_y in ((-0.33, (-0.4, -0.26)), (0.33, (0.26, 0.4))):
        beam_top = roof.underside(max(beam_y)) - 0.004
        beam_bottom = beam_top - 0.12
        for x in (-0.36, 0.36):
            part(home, "GoatShelter_Frame", m + "Timber", box, (x - 0.06, y - 0.06, base_top), (x + 0.06, y + 0.06, beam_bottom + 0.02))
        part(home, "GoatShelter_Frame", m + "Timber", box, (-0.43, beam_y[0], beam_bottom), (0.43, beam_y[1], beam_top), R_TIMBER, SEG, False)
    back_beam_bottom = roof.underside(-0.26) - 0.124
    part(home, "GoatShelter_Walls", m + "LightWood", plank_stack, [(-0.3, base_top), (0.3, base_top), (0.3, back_beam_bottom - 0.01), (-0.3, back_beam_bottom - 0.01)], "y", -0.385, -0.285, bands_between(base_top, back_beam_bottom - 0.01, 3))
    part(home, "GoatShelter_Walls", m + "LightWood", plank_stack, [(-0.27, base_top), (0.27, base_top), (0.27, 0.62), (-0.27, 0.62)], "x", -0.41, -0.31, bands_between(base_top, 0.62, 3))
    part(home, "GoatShelter_Roof", m + "Roof", roof.build)
    home.finish()


# ---------------------------------------------------------------- cow shelter
def build_cow_shelter():
    home = Home("CowShelter")
    m = "Material.CowShelter."
    base_top = 0.15
    roof = Lean((0.0, -0.04, 1.335), (1.88, 1.66, 0.14), 5)
    part(home, "CowShelter_Stone", m + "Stone", box, (-0.88, -0.84, 0.0), (0.88, 0.68, base_top), R_LARGE)
    beams = {}
    for y, beam_y in ((-0.64, (-0.72, -0.56)), (0.58, (0.5, 0.66))):
        beam_top = roof.underside(max(beam_y)) - 0.004
        beams[y] = beam_top - 0.15
        for x in (-0.78, 0.78):
            part(home, "CowShelter_Timber", m + "Timber", box, (x - 0.08, y - 0.08, base_top), (x + 0.08, y + 0.08, beams[y] + 0.02))
        part(home, "CowShelter_Timber", m + "Timber", box, (-0.87, beam_y[0], beams[y]), (0.87, beam_y[1], beam_top), 0.045, SEG, False)
    # Limewashed walls on three sides, set back from the posts.
    part(home, "CowShelter_Walls", m + "Limewash", box, (-0.7, -0.7, base_top), (0.7, -0.6, beams[-0.64] - 0.01), 0.04)
    for sign in (-1, 1):
        part(home, "CowShelter_Walls", m + "Limewash", box, (sorted((sign * 0.73, sign * 0.83))[0], -0.56, base_top), (sorted((sign * 0.73, sign * 0.83))[1], 0.3, 0.95), 0.04)
    part(home, "CowShelter_Roof", m + "Roof", roof.build, 0.06)
    part(home, "CowShelter_Trough", m + "Enamel", tub, (-0.8, 0.25, base_top), (-0.14, 0.57, 0.42), 0.055, 0.12, 0.024)
    part(home, "CowShelter_Trough", m + "Water", box, (-0.74, 0.31, 0.33), (-0.2, 0.51, 0.355), 0.008, 1)
    home.finish()


# --------------------------------------------------------------- horse stable
def build_horse_stable():
    home = Home("HorseStable")
    m = "Material.HorseStable."
    base_top = 0.14
    roof = Gable(half_width=0.94, eave_top=1.21, pitch_deg=22, thickness=0.13, apex_radius=0.16)
    part(home, "HorseStable_Stone", m + "Stone", box, (-0.87, -0.86, 0.0), (0.87, 0.7, base_top), R_LARGE)
    eave_top = roof.underside(0.86) - 0.004
    eave_bottom = eave_top - 0.14
    for x in (-0.78, 0.78):
        for y in (-0.7, 0.62):
            part(home, "HorseStable_Frame", m + "Oak", box, (x - 0.08, y - 0.08, base_top), (x + 0.08, y + 0.08, eave_bottom + 0.02))
        # Eave beams carry the roof along both sides.
        part(home, "HorseStable_Frame", m + "Oak", box, (x - 0.08, -0.78, eave_bottom), (x + 0.08, 0.7, eave_top), 0.045, SEG, False)
    part(home, "HorseStable_Frame", m + "Oak", box, (-0.7, 0.54, eave_bottom), (0.7, 0.7, eave_top), 0.045, SEG, False)
    # A rounded partition between the two stalls.
    part(home, "HorseStable_Frame", m + "Oak", prism, [(-0.62, base_top), (0.46, base_top), (0.46, 0.82), *arc((0.36, 0.82), 0.1, 0, 90, 3)[1:], (-0.62, 0.92)], "x", -0.06, 0.06, 0.035)
    # Plank walls: the sides under the eave beams, a full gable at the back
    # and a small gable over the front beam.
    for sign in (-1, 1):
        low, high = sorted((sign * 0.73, sign * 0.83))
        part(home, "HorseStable_Walls", m + "Planks", plank_stack, [(-0.62, base_top), (0.54, base_top), (0.54, eave_bottom - 0.01), (-0.62, eave_bottom - 0.01)], "x", low, high, bands_between(base_top, eave_bottom - 0.01, 3))
    back = roof.house(0.7, base_top)
    part(home, "HorseStable_Walls", m + "Planks", plank_stack, back, "y", -0.77, -0.67, bands_between(base_top, roof.underside(0.0), 5, 0.02))
    front = roof.house(0.7, eave_top)
    part(home, "HorseStable_Walls", m + "Planks", prism, front, "y", 0.56, 0.65, 0.03)
    part(home, "HorseStable_Roof", m + "Roof", roof.build, -0.91, 0.81, 0.05)
    part(home, "HorseStable_Roof", m + "Roof", cylinder, (0.0, -0.91, roof.apex_top - 0.045), (0.0, 0.81, roof.apex_top - 0.045), 0.075, 14, 0.04, 0.04)
    # Manger with hay, and a hay bed in the right stall.
    part(home, "HorseStable_Trough", m + "Enamel", tub, (-0.72, 0.25, base_top), (-0.16, 0.53, 0.43), 0.05, 0.12, 0.024)
    part(home, "HorseStable_Trough", m + "Straw", mound, (-0.44, 0.39, 0.31), (0.22, 0.08, 0.16), 12, 3, 0.06, 2.1)
    part(home, "HorseStable_Straw", m + "Straw", mound, (0.4, -0.2, base_top), (0.27, 0.33, 0.12), seed=0.4)
    home.finish()


# ----------------------------------------------------------------- sheep fold
def build_sheep_fold():
    home = Home("SheepFold")
    m = "Material.SheepFold."
    base_top = 0.11
    part(home, "SheepFold_Stone", m + "Stone", box, (-0.86, -0.8, 0.0), (0.86, 0.72, base_top), 0.05)
    # Wattle: round stakes with three chunky woven rails per side.
    stakes = [
        (-0.78, -0.65), (0.78, -0.65), (-0.78, 0.65), (0.78, 0.65),
        (-0.78, -0.18), (-0.78, 0.25), (0.78, -0.18), (0.78, 0.25),
        (-0.26, -0.65), (0.26, -0.65), (-0.4, 0.65), (0.4, 0.65),
    ]
    for x, y in stakes:
        part(home, "SheepFold_Wattle", m + "Hazel", cylinder, (x, y, base_top), (x, y, 0.72), 0.058, 10, 0.0, 0.04)
    runs = [
        ("x", -0.78, (-0.69, 0.69)),
        ("x", 0.78, (-0.69, 0.69)),
        ("y", -0.65, (-0.82, 0.82)),
        ("y", 0.65, (-0.82, -0.32)),
        ("y", 0.65, (0.32, 0.82)),
    ]
    for axis, line, (start, end) in runs:
        for level, z in enumerate((0.29, 0.46, 0.63)):
            weave = 0.014 if level % 2 else -0.014
            across = (line + weave - 0.026, line + weave + 0.026)
            if axis == "x":
                low, high = (across[0], start, z - 0.035), (across[1], end, z + 0.035)
            else:
                low, high = (start, across[0], z - 0.035), (end, across[1], z + 0.035)
            part(home, "SheepFold_Wattle", m + "Hazel", box, low, high, R_SMALL, 1, False)
    # Lean-to over the straw bed in the back left.
    roof = Lean((-0.29, -0.28, 1.27), (1.0, 1.02, 0.12), 7)
    for y, beam_y in ((-0.55, (-0.62, -0.48)), (0.0, (-0.07, 0.07))):
        beam_top = roof.underside(max(beam_y)) - 0.004
        beam_bottom = beam_top - 0.12
        for x in (-0.68, 0.1):
            part(home, "SheepFold_ShelterFrame", m + "Timber", box, (x - 0.065, y - 0.065, base_top), (x + 0.065, y + 0.065, beam_bottom + 0.02))
        part(home, "SheepFold_ShelterFrame", m + "Timber", box, (-0.76, beam_y[0], beam_bottom), (0.18, beam_y[1], beam_top), R_TIMBER, SEG, False)
    part(home, "SheepFold_Roof", m + "Roof", roof.build)
    part(home, "SheepFold_Straw", m + "Straw", mound, (-0.29, -0.28, base_top), (0.33, 0.26, 0.15), seed=2.6)
    # An open gateway in the front fence, its posts at the 0.12 structural
    # minimum and wide enough to take the rail ends.
    for x in (-0.27, 0.27):
        part(home, "SheepFold_Gate", m + "Timber", box, (x - 0.065, 0.585, base_top), (x + 0.065, 0.715, 0.72))
    part(home, "SheepFold_Gate", m + "Timber", box, (-0.36, 0.58, 0.7), (0.36, 0.72, 0.8), 0.035, SEG, False)
    home.finish()


# --------------------------------------------------------------- chicken coop
def build_chicken_coop():
    """Raw scale: ChickenCoop.tsx draws the coop at 0.78.

    Sizes are raw, so a part is 0.78 of them in game: the 0.156 legs are the
    0.12 structural minimum, the run stakes about 0.10.
    """
    home = Home("ChickenCoop")
    m = "Material.ChickenCoop."
    floor_top = 0.25
    roof = Gable(half_width=0.47, eave_top=0.83, pitch_deg=28, thickness=0.1, apex_radius=0.09)
    for x in (-0.31, 0.31):
        for y in (-0.29, 0.2):
            part(home, "ChickenCoop_WoodDark", m + "Oak", box, (x - 0.078, y - 0.078, 0.0), (x + 0.078, y + 0.078, 0.17), 0.035)
    part(home, "ChickenCoop_WoodDark", m + "Oak", box, (-0.4, -0.37, 0.15), (0.4, 0.28, floor_top), 0.035, SEG, False)
    part(home, "ChickenCoop_WoodLight", m + "OakLight", plank_stack, roof.house(0.36, floor_top), "y", -0.33, 0.22, bands_between(floor_top, roof.underside(0.0), 4))
    part(home, "ChickenCoop_Trim", m + "Limewash", prism, arch_frame(0.2, 0.135, floor_top, 0.5), "y", 0.205, 0.28, 0.024)
    part(home, "ChickenCoop_Entrance", m + "Dark", prism, arch_outline(0.15, floor_top, 0.5), "y", 0.215, 0.25, 0.012)
    part(home, "ChickenCoop_Roof", m + "Terracotta", roof.build, -0.44, 0.38)
    part(home, "ChickenCoop_Roof", m + "Terracotta", cylinder, (0.0, -0.44, roof.apex_top - 0.035), (0.0, 0.38, roof.apex_top - 0.035), 0.06, 12, 0.032, 0.032)
    # Ramp down into the run, with cleats for little feet.
    ramp_top, ramp_end = (0.0, 0.25, floor_top), (0.0, 0.79, 0.055)
    part(home, "ChickenCoop_WoodLight", m + "OakLight", plank, ramp_top, ramp_end, 0.3, 0.055, 0.022)
    for t in (0.28, 0.52, 0.76):
        part(home, "ChickenCoop_WoodDark", m + "Oak", cleat, ramp_top, ramp_end, t, 0.32)
    # A wattle run on both sides of the ramp.
    for x in (-0.465, 0.465):
        for y in (0.24, 0.52, 0.8):
            part(home, "ChickenCoop_WoodDark", m + "Oak", cylinder, (x, y, 0.0), (x, y, 0.53), 0.064, 10, 0.0, 0.04)
        for level, z in enumerate((0.17, 0.31, 0.45)):
            weave = 0.012 if level % 2 else -0.012
            part(home, "ChickenCoop_WoodDark", m + "Oak", box, (x + weave - 0.028, 0.2, z - 0.035), (x + weave + 0.028, 0.84, z + 0.035), 0.02, 1, False)
    # A soft straw pile between the ramp and the run.
    part(home, "ChickenCoop_Straw", m + "Straw", mound, (0.29, 0.6, 0.0), (0.1, 0.15, 0.11), 12, 3, 0.1, 0.8)
    # A wooden water bowl standing on the ground.
    bowl = [(0.095, 0.0), (0.118, 0.016), (0.125, 0.055), (0.118, 0.085), (0.088, 0.085), (0.08, 0.058), (0.07, 0.048)]
    part(home, "ChickenCoop_Bowl", m + "Oak", lathe, (-0.3, 0.67, 0.0), bowl, 14)
    part(home, "ChickenCoop_Water", m + "Water", cylinder, (-0.3, 0.67, 0.058), (-0.3, 0.67, 0.068), 0.083, 14)
    home.finish()


# ----------------------------------------------------------------- piglet pen
def build_piglet_pen():
    """Raw scale: PigletPen.tsx draws the pen at 0.91.

    Sizes are raw, so a part is 0.91 of them in game: the 0.136 roof posts
    are the 0.12 structural minimum, the wattle stakes about 0.105. The roof
    and wattle stay inside the extents the pen had before the restyle.
    """
    home = Home("PigletPen")
    m = "Material.PigletPen."
    base_top = 0.14
    roof = Lean((-0.18, -0.185, 0.8), (0.8, 0.7, 0.12), 7)
    part(home, "PigletPen_Stone", m + "Stone", box, (-0.52, -0.49, 0.0), (0.14, 0.1, base_top), 0.05)
    wall_top = roof.underside(-0.04) - 0.006
    walls = [(-0.51, -0.48), (0.1, -0.48), (0.1, -0.38), (-0.41, -0.38), (-0.41, -0.04), (-0.51, -0.04)]
    part(home, "PigletPen_Limewash", m + "Limewash", prism, walls, "z", base_top, wall_top, 0.035)
    for x in (-0.45, 0.06):
        top = roof.underside(0.088) - 0.004
        part(home, "PigletPen_Wood", m + "Oak", box, (x - 0.068, -0.048, base_top), (x + 0.068, 0.088, top))
    part(home, "PigletPen_Roof", m + "Roof", roof.build, 0.05)
    # A rubbing post with a round head.
    part(home, "PigletPen_Wood", m + "Oak", cylinder, (0.26, -0.27, 0.0), (0.26, -0.27, 0.54), 0.07, 12, 0.0, 0.06)
    # Wattle around the front and right of the wallow. The front-left stays
    # open beside the trough, where piglets come in. The piglet waits at the
    # doorway anchor, 0.42 in front of the centre (homeDoorOffset in
    # farmAnimals/FarmAnimals.tsx), so the opening reaches past its body
    # (about 0.18 either side): the front fence starts at x = 0.27.
    front, side, opening = 0.425, 0.455, 0.27
    stakes = [(opening, front), (side, front), (side, -0.01), (side, -0.425)]
    for x, y in stakes:
        part(home, "PigletPen_Wattle", m + "Hazel", cylinder, (x, y, 0.0), (x, y, 0.62), 0.058, 10, 0.0, 0.04)
    for level, z in enumerate((0.2, 0.36, 0.52)):
        weave = 0.012 if level % 2 else -0.012
        part(home, "PigletPen_Wattle", m + "Hazel", box, (opening - 0.03, front + weave - 0.028, z - 0.034), (side + 0.03, front + weave + 0.028, z + 0.034), 0.02, 1, False)
        part(home, "PigletPen_Wattle", m + "Hazel", box, (side - weave - 0.028, -0.455, z - 0.034), (side - weave + 0.028, front + 0.03, z + 0.034), 0.02, 1, False)
    part(home, "PigletPen_Mud", m + "Mud", mound, (0.15, 0.12, 0.0), (0.25, 0.23, 0.06), 16, 3, 0.08, 0.5)
    part(home, "PigletPen_Trough", m + "Enamel", tub, (-0.47, 0.16, 0.0), (-0.07, 0.38, 0.18), 0.045, 0.08, 0.02)
    part(home, "PigletPen_Mud", m + "Mud", box, (-0.425, 0.205, 0.1), (-0.115, 0.335, 0.142), 0.012, 1)
    part(home, "PigletPen_Straw", m + "Straw", mound, (-0.2, -0.22, base_top), (0.24, 0.17, 0.08), 12, 3, 0.1, 3.3)
    home.finish()


# ------------------------------------------------------------------ dog house
def build_dog_house():
    """Raw scale: DogHouse.tsx draws the house at 0.72 and owns its colours."""
    home = Home("DogHouse")
    m = "Material.DogHouse."
    slab_size = (0.58, 0.94, 0.11)
    slabs = {}
    for name in ("DogHouse_Roof_Left", "DogHouse_Roof_Right"):
        obj = bpy.data.objects[name]
        slabs[name] = (obj.matrix_world.to_translation(), obj.matrix_world.to_euler())
        part(home, name, m + "CharcoalRoof", tilted_box, slabs[name][0], slab_size, slabs[name][1], 0.042)

    def underside(x):
        center, rotation = slabs["DogHouse_Roof_Left" if x <= 0 else "DogHouse_Roof_Right"]
        matrix = Matrix.Translation(center) @ rotation.to_matrix().to_4x4()
        a = matrix @ Vector((-0.2, 0.0, -slab_size[2] / 2))
        b = matrix @ Vector((0.2, 0.0, -slab_size[2] / 2))
        return a.z + (b.z - a.z) * (x - a.x) / (b.x - a.x)

    walls = [
        (-0.39, 0.0),
        (0.39, 0.0),
        (0.39, underside(0.39) - 0.006),
        (0.0, underside(0.0) - 0.006),
        (-0.39, underside(-0.39) - 0.006),
    ]
    part(home, "DogHouse_Walls", m + "RedWood", plank_stack, walls, "y", -0.34, 0.34, bands_between(0.0, walls[3][1], 4, 0.016))
    part(home, "DogHouse_Door", m + "DarkRedWood", add_box, (-0.13, 0.32, 0.0), (0.13, 0.356, 0.33), 0.012, 1, ("-z", "+z"))
    part(home, "DogHouse_DoorTop", m + "DarkRedWood", prism, [*arc((0.0, 0.33), 0.13, 0, 180, 8)], "y", 0.32, 0.356, 0.012)
    part(home, "DogHouse_Threshold", m + "WarmTrim", box, (-0.19, 0.33, 0.0), (0.19, 0.44, 0.065), 0.028)
    part(home, "DogHouse_NamePlate", m + "WarmTrim", box, (-0.16, 0.33, 0.5), (0.16, 0.385, 0.6), 0.024)
    for name, x in (("DogHouse_Trim_Left", -0.4), ("DogHouse_Trim_Right", 0.4)):
        top = underside(x + (0.045 if x < 0 else -0.045)) - 0.005
        part(home, name, m + "WarmTrim", box, (x - 0.045, 0.3, 0.0), (x + 0.045, 0.39, top), 0.03)
    # A round vent high on the back gable.
    part(home, "DogHouse_BackShadow", m + "DarkRedWood", cylinder, (0.0, -0.33, 0.47), (0.0, -0.366, 0.47), 0.085, 14, 0.0, 0.012, 1)
    ridge_z = max(underside(-0.01), underside(0.01)) + slab_size[2] / math.cos(math.radians(27.5)) - 0.02
    part(home, "DogHouse_RidgeCap", m + "WarmTrim", cylinder, (0.0, -0.475, ridge_z - 0.01), (0.0, 0.475, ridge_z - 0.01), 0.068, 12, 0.035, 0.035)
    # Enamel bowl with a wooden rim, standing on the ground.
    bowl = [(0.115, 0.0), (0.14, 0.018), (0.145, 0.06), (0.135, 0.075), (0.112, 0.074), (0.103, 0.05), (0.09, 0.044)]
    part(home, "DogHouse_Bowl", m + "BowlBlue", lathe, (0.66, 0.5, 0.0), bowl, 16)
    rim = [(0.127 + 0.022 * math.cos(math.tau * i / 6), 0.08 + 0.022 * math.sin(math.tau * i / 6)) for i in range(6)]
    part(home, "DogHouse_Bowl_Rim", m + "WarmTrim", lathe, (0.66, 0.5, 0.0), rim, 18, closed=True)
    water = home.bm("DogHouse_Bowl_Water")
    ring = [water.verts.new((0.66 + 0.105 * math.cos(math.tau * i / 18), 0.5 + 0.105 * math.sin(math.tau * i / 18), 0.068)) for i in range(18)]
    face = water.faces.new(ring)
    face.normal_update()
    if face.normal.z < 0:
        face.normal_flip()
    home.add("DogHouse_Bowl_Water", "Material.Water", [face])
    home.finish()


BUILDERS = {
    "ChickenCoop": build_chicken_coop,
    "CowShelter": build_cow_shelter,
    "DogHouse": build_dog_house,
    "GoatShelter": build_goat_shelter,
    "HorseStable": build_horse_stable,
    "PigletPen": build_piglet_pen,
    "RabbitHutch": build_rabbit_hutch,
    "SheepFold": build_sheep_fold,
}


def report(asset):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    low = Vector((math.inf,) * 3)
    high = Vector((-math.inf,) * 3)
    total = 0
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        for vert in mesh.vertices:
            point = obj.matrix_world @ vert.co
            low = Vector(map(min, low, point))
            high = Vector(map(max, high, point))
        total += sum(len(polygon.vertices) - 2 for polygon in mesh.polygons)
        evaluated.to_mesh_clear()
    print(
        f"{asset}: {total} triangles, bounds "
        f"({low.x:.3f}, {low.y:.3f}, {low.z:.4f})..({high.x:.3f}, {high.y:.3f}, {high.z:.3f})"
    )
    limits = TESTED_BOUNDS.get(asset)
    if limits:
        half_width, front, back, height = limits
        problems = []
        if abs(low.z) > 1e-5:
            problems.append(f"floor {low.z}")
        if low.x < -half_width or high.x > half_width:
            problems.append("width")
        if high.y > front or low.y < -back:
            problems.append("depth")
        if high.z > height:
            problems.append("height")
        if problems:
            raise RuntimeError(f"{asset} is outside its tested bounds: {problems}")


def main():
    args = parse_args()
    wanted = args.asset or list(BUILDERS)
    for asset in wanted:
        path = ASSETS_DIR / f"{asset}.blend"
        bpy.ops.wm.open_mainfile(filepath=str(path), load_ui=False)
        apply_palette(asset)
        BUILDERS[asset]()
        report(asset)
        bpy.ops.wm.save_mainfile(filepath=str(path), compress=True)
        backup = path.with_suffix(".blend1")
        if backup.exists():
            backup.unlink()
        print(f"Restyled {asset}")


if __name__ == "__main__":
    main()
