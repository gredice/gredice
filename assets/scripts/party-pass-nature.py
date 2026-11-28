"""Restyle trees, plants, flowers, cacti and desert stones for GAME_ART.md.

Rebuilds the pine, palm, dead trees, cacti, desert stones, rose, tulip,
sunflower, garden flower, stake (`Stick`) and seed as chunky, smooth,
rounded shapes, and moves their materials to on-screen colour roles. The
tree and bush live in `generate-party-core.py`.

Object names, origins, transforms and material slots stay as they were, so
the runtime keeps finding the same nodes. Shapes are authored in world
metres (Blender Z up, ground at Z = 0) and written back through each
object's inverse world matrix. The script only rebuilds from constants, so it
is safe to run again.

Run from the repository root, then export the touched assets:

    /Applications/Blender.app/Contents/MacOS/Blender -b \
        --python assets/scripts/party-pass-nature.py -- --asset Pine
    (cd assets && Blender -b --python export-game-assets.py -- --asset Pine)

Without `--asset` every file in RESTYLERS is rebuilt.
"""

import argparse
import importlib.util
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))
import party_style as ps  # noqa: E402

_core_spec = importlib.util.spec_from_file_location(
    "generate_party_core", SCRIPTS_DIR / "generate-party-core.py"
)
core = importlib.util.module_from_spec(_core_spec)
_core_spec.loader.exec_module(core)

ASSETS_DIR = SCRIPTS_DIR.parent / "game-assets"

# Colour of each part, as a role from GAME_ART.md (party_style.SCREEN_ROLES
# and SEASONAL_ROLES): the on-screen colour of a sunlit top face.
ROLES = {
    "canopy": "canopy",
    "canopy_light": "canopy_light",
    "leaf": "crop_leaf",
    "trunk": "trunk",
    "dead_bark": "trunk",
    "palm_trunk": "path",
    "palm_band": "trunk",
    "coconut": "trunk",
    "cactus": "crop_leaf",
    "areole": "cream",
    "flower_centre": "bed_soil",
    # A warm tan seed that stands out on the dark bed soil.
    "seed": "path",
}
# Colours GAME_ART.md has no role for yet: desert sand, rose red, and the
# sunflower petal, whose role colours (#ffd31c, #ffb300) cannot be reached
# through the tone mapper, so these sit just below that ceiling. Each one
# round-trips through party_style exactly.
ONE_OFF = {
    "desert_stone": "#dcc5a8",
    "desert_pebble": "#ccb59a",
    "rose_outer": "#ee3a5c",
    "rose_inner": "#f25f77",
    "rose_centre": "#c8243c",
    "petal_yellow": "#f0c21d",
    "petal_amber": "#eda514",
    "flower_seeds": "#a8622f",
}


def part_albedo(part):
    """Linear albedo for a part, from its role or its one-off colour."""
    role = ROLES.get(part)
    if role:
        return ps.seasonal_role_albedo(role)[0]
    return ps.screen_to_albedo(ONE_OFF[part])


# Painted bark from assets/game-textures, with the linear average colour the
# texture was corrected to (as generate-party-core.py's TEXTURED_ROLES).
BARK = ("bark.webp", (0.462, 0.145, 0.045))
BARK_DENSITY = core.TEXTURE_DENSITY


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", action="append", default=[])
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


# ----------------------------------------------------------------- material
def paint(material_name, role, roughness):
    material = bpy.data.materials[material_name]
    ps.set_flat_colour(material, part_albedo(role), roughness)


def paint_bark(material_name, role, roughness=0.6):
    """Bark texture multiplied down to the role's albedo."""
    material = bpy.data.materials[material_name]
    albedo = part_albedo(role)
    shader = ps.principled(material)
    ps.set_surface(material, roughness)
    core.apply_texture(material, shader, albedo, *BARK)


def palette_material(material_name, tint, roughness):
    """A palette-atlas material: tint multiplies the atlas, metalness 0."""
    material = bpy.data.materials[material_name]
    core.tint_textured_material(material, tint)
    ps.set_surface(material, roughness)


# --------------------------------------------------------------------- mesh
def write_world(obj, bm, weighted_normals=False):
    """Writes a bmesh authored in world space into `obj`'s local space."""
    bm.transform(obj.matrix_world.inverted())
    if obj.data.users > 1:
        obj.data = obj.data.copy()
    core.replace_mesh(obj, bm)
    if not weighted_normals:
        obj.modifiers.clear()
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def set_uv(bm, faces, uv):
    layer = bm.loops.layers.uv.verify()
    for face in faces:
        for loop in face.loops:
            loop[layer].uv = uv


def revolve(
    bm,
    profile,
    segments,
    centre=(0.0, 0.0, 0.0),
    modulate=None,
    uv_density=None,
    uv_wraps=1,
    phase=0.0,
):
    """A smooth surface of revolution around Z.

    `profile` lists (radius, height) from bottom to top. A radius of 0 at
    either end closes the surface with a pole. `modulate(theta, index, r, z)`
    may return a reshaped (r, z) for lobes and scallops.
    """
    centre = Vector(centre)
    rings = []
    poles = {}
    heights = []
    for index, (radius, height) in enumerate(profile):
        heights.append(height)
        if radius <= 1e-6 and index in (0, len(profile) - 1):
            poles[index] = bm.verts.new(centre + Vector((0.0, 0.0, height)))
            rings.append(None)
            continue
        ring = []
        for side in range(segments):
            theta = side / segments * math.tau + phase
            r, z = radius, height
            if modulate:
                r, z = modulate(theta, index, r, z)
            ring.append(
                bm.verts.new(
                    centre + Vector((math.cos(theta) * r, math.sin(theta) * r, z))
                )
            )
        rings.append(ring)
    faces = []
    corners = []
    for index in range(len(profile) - 1):
        low, high = rings[index], rings[index + 1]
        for side in range(segments):
            following = (side + 1) % segments
            if low is None:
                face = bm.faces.new((poles[index], high[following], high[side]))
                corners.append(((index, side + 0.5), (index + 1, side + 1), (index + 1, side)))
            elif high is None:
                face = bm.faces.new((low[side], low[following], poles[index + 1]))
                corners.append(((index, side), (index, side + 1), (index + 1, side + 0.5)))
            else:
                face = bm.faces.new(
                    (low[side], low[following], high[following], high[side])
                )
                corners.append(
                    (
                        (index, side),
                        (index, side + 1),
                        (index + 1, side + 1),
                        (index + 1, side),
                    )
                )
            faces.append(face)
    if uv_density:
        layer = bm.loops.layers.uv.verify()
        for face, face_corners in zip(faces, corners):
            for loop, (ring, column) in zip(face.loops, face_corners):
                loop[layer].uv = (
                    heights[ring] * uv_density,
                    column / segments * uv_wraps,
                )
    return faces


def add_tube(
    bm,
    path,
    widths,
    thicknesses,
    sides=8,
    width_axis=None,
    fold=0.0,
    tip=True,
    base_cap=False,
):
    """A flattened tube: leaves, fronds, petals on a path.

    The cross-section is an ellipse `widths` wide and `thicknesses` deep. Its
    width runs along `width_axis` (projected off the path). `fold` drops the
    edges below the midrib, as a leaf droops. A rounded tip closes the end.
    """
    path = [Vector(point) for point in path]
    count = len(path)
    tangents = [
        (path[min(i + 1, count - 1)] - path[max(i - 1, 0)]).normalized()
        for i in range(count)
    ]
    widest = max(widths)
    rings = []
    frames = []
    for i, (centre, tangent) in enumerate(zip(path, tangents)):
        axis = Vector(width_axis) if width_axis else tangent.orthogonal()
        u = (axis - tangent * axis.dot(tangent)).normalized()
        v = tangent.cross(u).normalized()
        if width_axis and v.z < 0:
            u, v = -u, -v
        frames.append((u, v))
        droop = fold * widths[i] / widest
        ring = []
        for side in range(sides):
            phi = side / sides * math.tau
            offset = u * (math.cos(phi) * widths[i] / 2) + v * (
                math.sin(phi) * thicknesses[i] / 2 - droop * math.cos(phi) ** 2
            )
            ring.append(bm.verts.new(centre + offset))
        rings.append(ring)
    faces = []
    for i in range(count - 1):
        for side in range(sides):
            following = (side + 1) % sides
            faces.append(
                bm.faces.new(
                    (rings[i][side], rings[i][following], rings[i + 1][following], rings[i + 1][side])
                )
            )
    if tip:
        end, tangent = path[-1], tangents[-1]
        u, v = frames[-1]
        reach = max(widths[-1], thicknesses[-1]) * 0.5
        ring = []
        for side in range(sides):
            phi = side / sides * math.tau
            ring.append(
                bm.verts.new(
                    end
                    + tangent * reach * 0.6
                    + u * (math.cos(phi) * widths[-1] * 0.3)
                    + v * (math.sin(phi) * thicknesses[-1] * 0.3)
                )
            )
        apex = bm.verts.new(end + tangent * reach)
        for side in range(sides):
            following = (side + 1) % sides
            faces.append(
                bm.faces.new((rings[-1][side], rings[-1][following], ring[following], ring[side]))
            )
            faces.append(bm.faces.new((ring[side], ring[following], apex)))
    if base_cap:
        centre = bm.verts.new(path[0] - tangents[0] * thicknesses[0] * 0.25)
        for side in range(sides):
            following = (side + 1) % sides
            faces.append(bm.faces.new((rings[0][following], rings[0][side], centre)))
    return faces


def add_ellipsoid(bm, centre, axes, radii, subdivisions=2, cup=0.0):
    """An ellipsoid on three axes. `cup` bends it along its first axis.

    The bend lifts both ends of the first axis toward the third, so a petal
    or leaf curves up like a shallow spoon.
    """
    result = bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=1.0)
    centre = Vector(centre)
    axes = [Vector(axis).normalized() for axis in axes]
    for vert in result["verts"]:
        p = vert.co.normalized()
        lift = cup * p.x * p.x
        vert.co = (
            centre
            + axes[0] * (p.x * radii[0])
            + axes[1] * (p.y * radii[1])
            + axes[2] * (p.z * radii[2] + lift)
        )
    return list({face for vert in result["verts"] for face in vert.link_faces})


def add_flat_ellipsoid(bm, centre, axes, radii, segments=16, rings=4, cup=0.0):
    """An ellipsoid with its poles on the thin third axis, for leaves and petals.

    Its outline is one full ring of `segments` vertices, so a flat leaf keeps
    a smooth silhouette for fewer triangles than an icosphere. `cup` lifts
    both ends of the first axis toward the third, as in `add_ellipsoid`.
    """
    centre = Vector(centre)
    axes = [Vector(axis).normalized() for axis in axes]

    def point(x, y, z):
        lift = cup * x * x
        return centre + axes[0] * (x * radii[0]) + axes[1] * (y * radii[1]) + axes[2] * (z * radii[2] + lift)

    top = bm.verts.new(point(0.0, 0.0, 1.0))
    bottom = bm.verts.new(point(0.0, 0.0, -1.0))
    bands = []
    for ring in range(1, rings):
        phi = math.pi * ring / rings
        bands.append(
            [
                bm.verts.new(
                    point(
                        math.cos(side / segments * math.tau) * math.sin(phi),
                        math.sin(side / segments * math.tau) * math.sin(phi),
                        math.cos(phi),
                    )
                )
                for side in range(segments)
            ]
        )
    faces = []
    for side in range(segments):
        following = (side + 1) % segments
        faces.append(bm.faces.new((top, bands[0][side], bands[0][following])))
        for upper, lower in zip(bands, bands[1:]):
            faces.append(bm.faces.new((upper[side], lower[side], lower[following], upper[following])))
        faces.append(bm.faces.new((bands[-1][following], bands[-1][side], bottom)))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def add_boulder(bm, centre, radii, roundness=2.6, bump=0.0, seed=0.0, floor=None, subdivisions=3):
    """A rounded-box rock: a superellipsoid, softly lumpy, cut flat at `floor`.

    `roundness` 2 is an ellipsoid; higher values square off the sides and top
    while every edge stays round.
    """
    result = bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=1.0)
    centre = Vector(centre)
    for vert in result["verts"]:
        d = vert.co.normalized()
        scale = (abs(d.x) ** roundness + abs(d.y) ** roundness + abs(d.z) ** roundness) ** (-1 / roundness)
        if bump:
            scale *= 1 + bump * (
                math.sin(d.x * 3.1 + seed) * math.sin(d.y * 2.7 + seed * 1.7)
                + 0.7 * math.sin(d.z * 4.3 + seed * 0.6)
            )
        vert.co = centre + Vector((d.x * radii[0], d.y * radii[1], d.z * radii[2])) * scale
        if floor is not None and vert.co.z < floor:
            vert.co.z = floor
    return list({face for vert in result["verts"] for face in vert.link_faces})


def add_stud(bm, base, normal, radius, height, sides=6):
    """A small rounded bump standing on a surface (areoles, seeds)."""
    base = Vector(base)
    normal = Vector(normal).normalized()
    u = normal.orthogonal().normalized()
    v = normal.cross(u)
    bottom = base - normal * radius * 0.4

    def ring(at, r):
        return [
            bm.verts.new(
                at + (u * math.cos(side / sides * math.tau) + v * math.sin(side / sides * math.tau)) * r
            )
            for side in range(sides)
        ]

    low = ring(bottom, radius)
    mid = ring(base + normal * height * 0.55, radius * 0.82)
    apex = bm.verts.new(base + normal * height)
    faces = []
    for side in range(sides):
        following = (side + 1) % sides
        faces.append(bm.faces.new((low[side], low[following], mid[following], mid[side])))
        faces.append(bm.faces.new((mid[side], mid[following], apex)))
    return faces


def lerp(a, b, t):
    return a + (b - a) * t


# --------------------------------------------------------------------- pine
# The pine draws at scale (0.09, 1, 0.09) with its origin one metre up, like
# the object. Its single palette material carries both colours: a tint
# multiplies the atlas, and each part's UVs sit on the atlas pixel that the
# tint turns into the role colour (canopy #43b93a, trunk #b56a3c).
PINE_TINT = (0.3384, 0.2224, 0.0348)
PINE_FOLIAGE_UV = (0.03516, 0.79297)
PINE_TRUNK_UV = (0.23828, 0.91797)
# (rim radius, rim height, top height, top radius, lobes, lobe phase)
PINE_TIERS = [
    (0.5, 0.3, 1.02, 0.13, 8, 0.0),
    (0.41, 0.76, 1.46, 0.1, 6, 0.5),
    (0.31, 1.2, 2.08, 0.0, 6, 0.0),
]


def pine_tier_profile(rim, base, top, top_radius):
    """Soft tier: rounded underside and rim, gently swelling cone above."""
    profile = [
        (0.0, base + 0.15),
        (0.35 * rim, base + 0.08),
        (0.72 * rim, base + 0.02),
        (0.93 * rim, base + 0.005),
        (rim, base + 0.05),
        (0.95 * rim, base + 0.11),
    ]
    weights = [0.0, 0.0, 0.5, 1.0, 1.0, 0.8]
    start_radius, start_height = profile[-1]
    for t in (0.3, 0.6, 0.85) if top_radius > 0 else (0.3, 0.6):
        profile.append(
            (
                lerp(start_radius, top_radius, t) + 0.05 * rim * math.sin(math.pi * t),
                lerp(start_height, top, t),
            )
        )
        weights.append(max(0.0, 0.5 - t))
    if top_radius > 0:
        profile += [(top_radius, top), (0.0, top + 0.03)]
        weights += [0.0, 0.0]
    else:
        # A rounded tip, not a spike.
        profile += [(0.065, top - 0.075), (0.032, top - 0.022), (0.0, top)]
        weights += [0.0, 0.0, 0.0]
    return profile, weights


def restyle_pine():
    obj = bpy.data.objects["Tree 2"]
    palette_material("Material.ColorPaletteMain", PINE_TINT, 0.55)
    bm = bmesh.new()
    trunk = revolve(
        bm,
        [(0.0, -0.02), (0.115, -0.02), (0.105, 0.04), (0.085, 0.12), (0.08, 0.5), (0.0, 0.5)],
        10,
    )
    set_uv(bm, trunk, PINE_TRUNK_UV)
    for rim, base, top, top_radius, lobes, phase in PINE_TIERS:
        profile, weights = pine_tier_profile(rim, base, top, top_radius)

        def scallop(theta, index, r, z, weights=weights, lobes=lobes, phase=phase):
            wave = math.cos(lobes * theta + phase * math.pi)
            w = weights[index]
            return r * (1 + 0.085 * w * wave), z - 0.03 * w * wave

        tier = revolve(bm, profile, 24, modulate=scallop)
        set_uv(bm, tier, PINE_FOLIAGE_UV)
    write_world(obj, bm)


# --------------------------------------------------------------------- palm
PALM_CROWN = Vector((0.0, 0.0, 3.3))
# Frond name: (tip, midpoint, width, material order unchanged).
PALM_FRONDS = {
    "PalmTree_FrondBackTop": ((0.0, 1.62, 3.98), (0.0, 0.84, 4.1), 0.66),
    "PalmTree_FrondFrontCenter": ((-0.006, -1.66, 3.3), (0.007, -0.83, 3.62), 0.66),
    "PalmTree_FrondFrontLeft": ((1.34, -1.4, 3.56), (0.64, -0.68, 3.84), 0.66),
    "PalmTree_FrondFrontRight": ((-1.34, -1.4, 3.6), (-0.68, -0.75, 3.87), 0.66),
    "PalmTree_FrondLeftHigh": ((2.06, 0.24, 3.93), (1.05, 0.085, 4.12), 0.78),
    "PalmTree_FrondLeftLower": ((1.7, -0.58, 3.46), (0.83, -0.3, 3.7), 0.68),
    "PalmTree_FrondRearLeft": ((1.08, 1.34, 3.92), (0.56, 0.72, 4.1), 0.62),
    "PalmTree_FrondRearRight": ((-1.08, 1.34, 3.92), (-0.56, 0.72, 4.1), 0.62),
    "PalmTree_FrondRightHigh": ((-2.06, 0.24, 3.93), (-1.04, 0.075, 4.12), 0.78),
    "PalmTree_FrondRightLower": ((-1.7, -0.57, 3.46), (-0.83, -0.32, 3.7), 0.68),
}
# Joint heights between trunk segments, the base radius at each, and the
# trunk centre, which leans slightly.
PALM_JOINTS = [0.0, 0.42, 0.84, 1.26, 1.675, 2.095, 2.51, 2.93, 3.35]
PALM_RADII = [0.28, 0.26, 0.24, 0.222, 0.205, 0.19, 0.175, 0.162, 0.15]


def palm_centre(height):
    return Vector((-0.012 * height / 3.35, -0.006 * height / 3.35, 0.0))


def restyle_palm():
    # One green with its highlight, one tan and one brown accent: the dark
    # leaf and light trunk materials keep their names but share a colour.
    paint("PalmTree_Leaf", "canopy", 0.55)
    paint("PalmTree_LeafLight", "canopy_light", 0.55)
    paint("PalmTree_LeafDark", "canopy", 0.55)
    paint("PalmTree_TrunkLight", "palm_trunk", 0.6)
    paint("PalmTree_Trunk", "palm_trunk", 0.6)
    paint("PalmTree_TrunkDark", "palm_band", 0.6)
    paint("PalmTree_Coconut", "coconut", 0.55)

    # Chunky barrel segments that swell between darker rings.
    for index in range(8):
        z0, z1 = PALM_JOINTS[index], PALM_JOINTS[index + 1]
        r0, r1 = PALM_RADII[index], PALM_RADII[index + 1]
        h = z1 - z0
        bm = bmesh.new()
        revolve(
            bm,
            [
                (0.0, z0 + 0.01),
                (r0 * 0.9, z0),
                (r0 * 1.02, z0 + 0.3 * h),
                (lerp(r0, r1, 0.7) * 1.06, z0 + 0.68 * h),
                (r1 * 0.95, z1),
                (0.0, z1 + 0.01),
            ],
            9,
            centre=palm_centre((z0 + z1) / 2),
        )
        write_world(bpy.data.objects[f"PalmTree_TrunkSegment{index + 1:02d}"], bm)
    for index in range(8):
        z = PALM_JOINTS[index + 1] - 0.01
        r = PALM_RADII[index + 1]
        bm = bmesh.new()
        revolve(
            bm,
            [
                (r * 0.88, z - 0.06),
                (r * 1.1, z - 0.035),
                (r * 1.14, z + 0.01),
                (r * 1.06, z + 0.05),
                (r * 0.86, z + 0.065),
            ],
            9,
            centre=palm_centre(z),
        )
        write_world(bpy.data.objects[f"PalmTree_TrunkBand{index + 1:02d}"], bm)

    # Large coconuts hang in a ring just under the crown, low enough to
    # show below the fronds from the game camera.
    for index, (angle, z, radius) in enumerate(
        [(3.6, 3.1, 0.19), (1.45, 3.05, 0.18), (5.6, 3.08, 0.185)]
    ):
        x = math.cos(angle) * 0.27
        y = math.sin(angle) * 0.27
        bm = bmesh.new()
        core.add_blob(bm, (x, y, z), (radius, radius * 0.95, radius * 1.05), subdivisions=2)
        write_world(bpy.data.objects[f"PalmTree_Coconut{index + 1:02d}"], bm)

    # Fronds: thick, softly scalloped blades that arch up and droop.
    for name, (tip, middle, width) in PALM_FRONDS.items():
        tip, middle = Vector(tip), Vector(middle)
        control = middle * 2 - (PALM_CROWN + tip) / 2
        steps = 9
        path = core.bezier_points(PALM_CROWN, control, tip, steps)
        widths = []
        for i in range(steps):
            t = i / (steps - 1)
            w = 0.12 + (width - 0.12) * math.sin(math.pi * min(1.0, t * 0.92)) ** 0.7
            w *= 0.86 + 0.14 * math.cos(math.tau * 2 * t)
            widths.append(max(0.1, w))
        thick = [lerp(0.1, 0.075, i / (steps - 1)) for i in range(steps)]
        across = Vector((tip.x, tip.y, 0.0)).normalized().cross(Vector((0, 0, 1)))
        bm = bmesh.new()
        add_tube(bm, path, widths, thick, sides=8, width_axis=across, fold=0.06)
        write_world(bpy.data.objects[name], bm)


# --------------------------------------------------------------- dead trees
def resample(values, count):
    """`count` values spread evenly along the piecewise-linear `values`."""
    result = []
    for index in range(count):
        at = index / (count - 1) * (len(values) - 1)
        low = min(int(at), len(values) - 2)
        result.append(lerp(values[low], values[low + 1], at - low))
    return result


def dead_limb(obj_name, start, control, end, base_radius, tip_radius, sides=12):
    """A smooth tapered branch; enough rings and sides to stay round."""
    bm = bmesh.new()
    points = core.bezier_points(start, control, end, 6)
    radii = [lerp(base_radius, tip_radius, i / 5) for i in range(6)]
    core.add_limb(bm, points, radii, sides=sides, uv_density=BARK_DENSITY)
    write_world(bpy.data.objects[obj_name], bm)


def restyle_dead_tree_tall():
    paint_bark("Material.DeadTree.Bark", "dead_bark")
    # A tapered, slightly leaning trunk with a rounded top.
    bm = bmesh.new()
    path = core.bezier_points((0.0, 0.0, -0.02), (0.03, 0.0, 0.95), (0.13, 0.03, 1.72), 12)
    # The first radius flares the root where the trunk meets the ground.
    # The resampled flare keeps the base rounded instead of a cone step.
    radii = [0.25, 0.205] + resample([0.18, 0.155, 0.135, 0.115, 0.1, 0.088], 10)
    core.add_limb(bm, path, radii, sides=16, base_cap=True, uv_density=BARK_DENSITY, uv_wraps=2)
    write_world(bpy.data.objects["DeadTreeTall_Trunk"], bm)
    # Branch reach stays inside the 0.9 tile at the entity's 0.92 scale:
    # about 0.48 m either side of the pivot.
    dead_limb("DeadTreeTall_LeftBranch", (0.02, 0.02, 0.78), (-0.16, 0.06, 0.98), (-0.35, 0.09, 1.14), 0.078, 0.056)
    dead_limb("DeadTreeTall_LeftSubBranch", (-0.25, 0.07, 1.04), (-0.37, 0.02, 1.24), (-0.43, -0.04, 1.44), 0.052, 0.04)
    dead_limb("DeadTreeTall_LeftTip", (-0.32, 0.08, 1.12), (-0.3, 0.13, 1.38), (-0.27, 0.17, 1.6), 0.048, 0.036)
    dead_limb("DeadTreeTall_RightBranch", (0.08, 0.02, 1.02), (0.22, 0.09, 1.2), (0.36, 0.15, 1.27), 0.074, 0.052)
    dead_limb("DeadTreeTall_RightSubBranch", (0.29, 0.12, 1.22), (0.38, 0.13, 1.44), (0.42, 0.13, 1.62), 0.05, 0.038)
    dead_limb("DeadTreeTall_RightTip", (0.35, 0.14, 1.26), (0.4, 0.24, 1.34), (0.43, 0.33, 1.42), 0.044, 0.035)


def restyle_dead_tree_stump():
    paint_bark("Material.DeadTree.Bark", "dead_bark")
    paint_bark("Material.DeadTree.Bark.001", "dead_bark")

    def wobble(theta, index, r, z):
        return r * (1 + 0.05 * math.sin(3 * theta + 0.4) + 0.03 * math.sin(5 * theta)), z

    bm = bmesh.new()
    revolve(
        bm,
        [
            (0.0, -0.02),
            (0.25, -0.02),
            (0.242, 0.02),
            (0.23, 0.05),
            (0.214, 0.11),
            (0.2, 0.18),
            (0.191, 0.3),
            (0.185, 0.45),
            (0.175, 0.64),
            (0.168, 0.69),
            (0.155, 0.72),
            (0.12, 0.745),
            (0.06, 0.742),
            (0.0, 0.73),
        ],
        24,
        modulate=wobble,
        uv_density=BARK_DENSITY,
        uv_wraps=2,
    )
    write_world(bpy.data.objects["DeadTreeStump_Trunk"], bm)
    # Splintered top and a broken side branch, all with rounded ends.
    dead_limb("DeadTreeStump_BrokenTop", (0.03, -0.05, 0.6), (0.04, -0.1, 0.74), (0.06, -0.15, 0.84), 0.1, 0.045)
    dead_limb("DeadTreeStump_BrokenTop.001", (0.02, 0.06, 0.34), (0.015, 0.22, 0.44), (0.0, 0.35, 0.56), 0.07, 0.048)
    dead_limb("DeadTreeStump_SideStub", (0.0, 0.02, 0.46), (-0.1, 0.05, 0.54), (-0.2, 0.08, 0.62), 0.065, 0.05)


# -------------------------------------------------------------------- cacti
def ribbed(ribs, amount):
    def modulate(theta, index, r, z):
        return r * (1 + amount * math.cos(ribs * theta)), z

    return modulate


def column_profile(radius, height):
    """A capsule column: flat base, straight sides, dome top."""
    profile = [(0.0, -0.03), (radius * 0.94, -0.03), (radius, 0.05)]
    dome = radius * 0.95
    for angle in (0.0, 0.35, 0.7, 1.05, 1.3):
        profile.append(
            (radius * math.cos(angle), height - dome + dome * math.sin(angle))
        )
    profile.append((0.0, height))
    return profile


def column_point(centre, radius, height, theta, z):
    """A point on a column's surface, for placing areoles."""
    dome_base = height - radius * 0.95
    r = radius
    if z > dome_base:
        r = radius * math.cos(math.asin(min(1.0, (z - dome_base) / (radius * 0.95))))
    normal = Vector((math.cos(theta), math.sin(theta), 0.25 if z > dome_base else 0.0))
    return Vector(centre) + Vector((math.cos(theta) * r, math.sin(theta) * r, z)), normal


def restyle_cactus_barrel():
    paint("Material.Cactus.Body", "cactus", 0.55)
    paint("Material.Cactus.Spines", "areole", 0.8)
    ribs = 12
    # Enough rings that the rounded outline stays smooth up close.
    profile = [
        (0.0, -0.02),
        (0.26, -0.02),
        (0.3, 0.0),
        (0.33, 0.05),
        (0.352, 0.11),
        (0.363, 0.18),
        (0.366, 0.255),
        (0.363, 0.33),
        (0.35, 0.4),
        (0.33, 0.46),
        (0.295, 0.515),
        (0.25, 0.56),
        (0.19, 0.592),
        (0.13, 0.61),
        (0.065, 0.618),
        (0.0, 0.62),
    ]

    def barrel(theta, index, r, z):
        fade = min(1.0, r / 0.25)
        return r * (1 + 0.065 * fade * math.cos(ribs * theta)), z

    bm = bmesh.new()
    revolve(bm, profile, 48, modulate=barrel)
    write_world(bpy.data.objects["Cactus_Barrel_Body"], bm)
    # Cream areoles along the rib crests.
    bm = bmesh.new()
    for rib in range(ribs):
        theta = rib / ribs * math.tau
        for z, r in ((0.2, 0.387), (0.38, 0.38)) if rib % 2 == 0 else ((0.29, 0.389), (0.47, 0.345)):
            base = Vector((math.cos(theta) * r, math.sin(theta) * r, z))
            add_stud(bm, base, (math.cos(theta), math.sin(theta), 0.2), 0.028, 0.026, sides=8)
    write_world(bpy.data.objects["Cactus_Barrel_Spines"], bm)


CACTUS_COLUMNS = [
    # (centre x, y, radius, height)
    (0.027, -0.029, 0.165, 1.08),
    (-0.245, -0.15, 0.146, 0.75),
    (0.233, 0.15, 0.155, 0.88),
    (-0.057, 0.248, 0.108, 0.63),
]


def restyle_cactus_columns():
    paint("Material.Cactus.Body", "cactus", 0.55)
    paint("Material.Cactus.Spines", "areole", 0.8)
    bm = bmesh.new()
    for x, y, radius, height in CACTUS_COLUMNS:
        # Four sides per rib keeps the ribs soft within the prop budget.
        revolve(
            bm,
            column_profile(radius, height),
            32,
            centre=(x, y, 0.0),
            modulate=ribbed(8, 0.07),
        )
    write_world(bpy.data.objects["Cactus_ColumnCluster_Body"], bm)
    bm = bmesh.new()
    for index, (x, y, radius, height) in enumerate(CACTUS_COLUMNS):
        for rib in range(8):
            theta = rib / 8 * math.tau
            levels = (0.3, 0.6) if rib % 2 == index % 2 else (0.45,)
            for level in levels:
                point, normal = column_point(
                    (x, y, 0.0), radius * 1.07, height, theta, height * level
                )
                add_stud(bm, point, normal, 0.026, 0.024, sides=8)
    write_world(bpy.data.objects["Cactus_ColumnCluster_Spines"], bm)


# Pads as (centre, length axis, width axis, half length, half width, half
# thickness), fitted to the original pads.
PRICKLY_PADS = [
    ((0.0, 0.0, 0.32), (-0.07, -0.035, 0.997), (-0.998, 0.0, -0.07), 0.33, 0.22, 0.1),
    ((-0.19, -0.08, 0.59), (-0.243, -0.161, 0.957), (-0.864, 0.485, -0.138), 0.25, 0.175, 0.09),
    ((0.21, 0.09, 0.6), (0.034, 0.27, 0.962), (-0.882, -0.445, 0.155), 0.26, 0.18, 0.09),
    ((0.015, -0.03, 0.84), (0.135, -0.163, 0.977), (0.989, 0.086, -0.122), 0.2, 0.15, 0.085),
]


def restyle_cactus_prickly_pear():
    paint("Material.Cactus.Body", "cactus", 0.55)
    paint("Material.Cactus.Spines", "areole", 0.8)
    bm = bmesh.new()
    pads = []
    for centre, length_axis, width_axis, half_length, half_width, half_thick in PRICKLY_PADS:
        length_axis = Vector(length_axis).normalized()
        width_axis = Vector(width_axis)
        width_axis = (width_axis - length_axis * width_axis.dot(length_axis)).normalized()
        thick_axis = length_axis.cross(width_axis).normalized()
        pads.append((Vector(centre), length_axis, width_axis, thick_axis, half_length, half_width, half_thick))
        add_ellipsoid(
            bm,
            centre,
            (width_axis, thick_axis, length_axis),
            (half_width, half_thick, half_length),
            subdivisions=3,
        )
    # The base pad meets the ground flat.
    for vert in bm.verts:
        vert.co.z = max(vert.co.z, -0.02)
    write_world(bpy.data.objects["Cactus_PricklyPear_Body"], bm)
    bm = bmesh.new()
    spots = [(-0.45, 0.35), (0.45, 0.3), (0.0, -0.1), (-0.4, -0.45), (0.42, -0.5)]
    for centre, length_axis, width_axis, thick_axis, half_length, half_width, half_thick in pads:
        for side in (1, -1):
            for across, along in spots:
                # A point on the pad face, from the ellipsoid equation.
                depth = math.sqrt(max(0.0, 1 - across * across - along * along))
                normal = (
                    width_axis * (across / half_width)
                    + thick_axis * (side * depth / half_thick)
                    + length_axis * (along / half_length)
                )
                point = (
                    centre
                    + width_axis * (across * half_width)
                    + thick_axis * (side * depth * half_thick)
                    + length_axis * (along * half_length)
                )
                if point.z < 0.06:
                    continue
                add_stud(bm, point, normal, 0.024, 0.022, sides=8)
    write_world(bpy.data.objects["Cactus_PricklyPear_Spines"], bm)


# ------------------------------------------------------------ desert stones
# Original rock bounds (x and y min/max, height), so the footprint and height
# stay as they were.
DESERT_BOUNDS = {
    "DesertStoneSmall": ((-1.273, 1.273), (-0.909, 0.909), 1.194),
    "DesertStoneMedium": ((-1.356, 1.441), (-1.073, 1.073), 1.197),
    "DesertStoneLarge": ((-1.597, 1.483), (-0.928, 0.859), 1.472),
}


def restyle_desert_stone(prefix, seed):
    paint("Material.DesertStone.Body", "desert_stone", 0.6)
    paint("Material.DesertStone.Groove", "desert_pebble", 0.6)
    body = bpy.data.objects[f"{prefix}_Body"]
    (x0, x1), (y0, y1), height = DESERT_BOUNDS[prefix]
    centre = Vector(((x0 + x1) / 2, (y0 + y1) / 2, 0.0))
    half_x, half_y = (x1 - x0) / 2, (y1 - y0) / 2
    bm = bmesh.new()
    # Subdivision 4 keeps the outline and broad faces smooth up close.
    add_boulder(
        bm,
        (centre.x, centre.y, height * 0.4),
        (half_x * 0.88, half_y * 0.88, height * 0.58),
        roundness=2.7,
        bump=0.06,
        seed=seed,
        floor=0.0,
        subdivisions=4,
    )
    rock = [vert.co.copy() for vert in bm.verts]
    write_world(body, bm)
    # Two pebbles at the foot, out in the corners the rounded rock leaves
    # free, so they read as pebbles and stay inside the old bounds.
    bm = bmesh.new()
    pebble = min(half_x, half_y) * 0.3
    for angle, scale in ((-0.7, 1.0), (2.5, 0.8)):
        radius = pebble * scale
        direction = Vector((math.cos(angle), math.sin(angle), 0.0))
        # How far the rock reaches within the pebble's lane, at any height.
        reach = max(
            (co - centre).dot(direction)
            for co in rock
            if abs((co - centre).cross(direction).z) < radius
        )
        at = centre + direction * (reach + radius * 0.3)
        at.x = min(max(at.x, x0 + radius), x1 - radius)
        at.y = min(max(at.y, y0 + radius * 0.85), y1 - radius * 0.85)
        core.add_blob(
            bm,
            (at.x, at.y, radius * 0.45),
            (radius, radius * 0.85, radius * 0.7),
            subdivisions=3,
            bump=0.06,
            seed=seed + angle,
            floor=0.0,
        )
    write_world(bpy.data.objects[f"{prefix}_Crevices"], bm)


# --------------------------------------------------------------------- rose
ROSE_HEADS = [
    (-0.2, 0.02, 0.792),
    (0.2, 0.05, 0.892),
    (0.02, -0.1, 1.032),
    (-0.29, -0.1, 0.552),
    (0.31, -0.04, 0.652),
]
ROSE_STEM_BASES = [
    (-0.03, 0.01, -0.01),
    (0.03, 0.02, -0.01),
    (0.0, -0.02, -0.01),
    (-0.04, -0.03, -0.01),
    (0.04, -0.02, -0.01),
]
# Leaf (height, direction in the ground plane), on the nearest stem.
ROSE_LEAVES = [
    (0.35, (0.943, 0.333)),
    (0.51, (-0.943, 0.333)),
    (0.38, (-0.943, -0.333)),
    (0.57, (0.943, -0.333)),
    (0.66, (-0.6, 0.8)),
    (0.26, (-0.8, -0.6)),
    (0.3, (0.9, 0.44)),
    (0.45, (0.2, -0.98)),
]


def rose_stem_path(index):
    head = Vector(ROSE_HEADS[index])
    base = Vector(ROSE_STEM_BASES[index])
    end = head - Vector((0.0, 0.0, 0.07))
    control = Vector((lerp(base.x, end.x, 0.25), lerp(base.y, end.y, 0.25), end.z * 0.55))
    return core.bezier_points(base, control, end, 5)


def restyle_rose():
    paint("Rose_Stem_Material", "canopy", 0.55)
    paint("Rose_Leaf_Material", "leaf", 0.5)
    paint("Rose_Petal_Outer_Material", "rose_outer", 0.45)
    paint("Rose_Petal_Inner_Material", "rose_inner", 0.45)
    paint("Rose_Center_Material", "rose_centre", 0.45)

    stems = bmesh.new()
    paths = []
    for index in range(len(ROSE_HEADS)):
        path = rose_stem_path(index)
        paths.append(path)
        core.add_limb(stems, path, [0.024, 0.023, 0.022, 0.021, 0.02], sides=6, tip=False)
    write_world(bpy.data.objects["Rose_Stems"], stems)

    leaves = bmesh.new()
    for height, (dx, dy) in ROSE_LEAVES:
        # Attach each leaf to the stem point nearest its height.
        stem = min(
            (point for path in paths for point in path[1:4]),
            key=lambda point: abs(point.z - height) + 0.3 * abs(point.x * dx + point.y * dy),
        )
        out = Vector((dx, dy, 0.0)).normalized()
        along = (out + Vector((0.0, 0.0, 0.35))).normalized()
        across = Vector((-dy, dx, 0.0)).normalized()
        up = along.cross(across).normalized()
        if up.z < 0:
            up = -up
        add_ellipsoid(
            leaves,
            stem + along * 0.11,
            (along, across, up),
            (0.12, 0.058, 0.017),
            cup=0.02,
        )
    write_world(bpy.data.objects["Rose_Leaves"], leaves)

    outer, inner, centres = bmesh.new(), bmesh.new(), bmesh.new()
    rim = [0.0, 0.0, 0.3, 0.7, 1.0, 1.0, 0.6, 0.0]
    for index, head in enumerate(ROSE_HEADS):
        x, y, z = head
        phase = index * 0.9

        def petals(theta, i, r, height, phase=phase):
            wave = math.cos(5 * theta + phase)
            return r * (1 + 0.13 * rim[i] * wave), height + 0.022 * rim[i] * wave

        revolve(
            outer,
            [
                (0.0, z - 0.07),
                (0.06, z - 0.066),
                (0.115, z - 0.04),
                (0.15, z - 0.005),
                (0.162, z + 0.025),
                (0.145, z + 0.045),
                (0.1, z + 0.04),
                (0.0, z + 0.03),
            ],
            20,
            centre=(x, y, 0.0),
            modulate=petals,
        )
        # The bud: a soft three-lobed swirl, lighter than the outer petals.
        core.add_lobed_blob(
            inner,
            (x, y, z + 0.045),
            (0.092, 0.092, 0.055),
            [
                ((math.cos(phase + k * 2.1), math.sin(phase + k * 2.1), 0.5), 0.22)
                for k in range(3)
            ],
            subdivisions=2,
        )
        core.add_blob(centres, (x, y, z + 0.088), (0.042, 0.042, 0.028), subdivisions=2)
    write_world(bpy.data.objects["Rose_Petals_Outer"], outer)
    write_world(bpy.data.objects["Rose_Petals_Inner"], inner)
    write_world(bpy.data.objects["Rose_Centers"], centres)


# -------------------------------------------------------------------- tulip
# One palette material carries the red cup (#f23b2c) and green stem.
TULIP_TINT = (0.3315, 0.3433, 0.0309)
TULIP_PETAL_UV = (0.21484, 0.98828)
TULIP_STEM_UV = (0.53516, 0.43359)


def restyle_tulip():
    palette_material("Material.ColorPaletteMain", TULIP_TINT, 0.45)
    paint("Material.GrassPart", "leaf", 0.5)
    bm = bmesh.new()
    stem = core.add_limb(
        bm,
        core.bezier_points((0.0, 0.0, -0.005), (0.004, 0.0, 0.12), (0.0, 0.0, 0.226), 3),
        # 0.039 m across, so the bouquet's 0.9 stem scale keeps it above 0.03.
        [0.0195, 0.019, 0.0185],
        sides=6,
        tip=False,
    )
    set_uv(bm, stem, TULIP_STEM_UV)
    weights = [0.0, 0.0, 0.0, 0.25, 0.5, 0.8, 1.0, 1.0, 0.0]

    def petals(theta, index, r, z):
        wave = math.cos(3 * theta)
        return r * (1 + 0.07 * weights[index] * wave), z + 0.016 * weights[index] * wave

    cup = revolve(
        bm,
        [
            (0.0, 0.214),
            (0.022, 0.218),
            (0.039, 0.233),
            (0.047, 0.26),
            (0.047, 0.292),
            (0.042, 0.322),
            (0.034, 0.345),
            (0.021, 0.352),
            (0.0, 0.346),
        ],
        12,
        modulate=petals,
    )
    set_uv(bm, cup, TULIP_PETAL_UV)
    write_world(bpy.data.objects["Tulip"], bm)

    leaves = bmesh.new()
    for index in range(4):
        angle = math.radians(35 + 90 * index)
        out = Vector((math.cos(angle), math.sin(angle), 0.0))
        across = Vector((-out.y, out.x, 0.0))
        reach = 0.075 - 0.008 * index
        top = 0.2 - 0.015 * index
        path = core.bezier_points(
            out * 0.01 + Vector((0, 0, 0.005)),
            out * 0.035 + Vector((0, 0, top * 0.6)),
            out * reach + Vector((0, 0, top)),
            5,
        )
        add_tube(
            leaves,
            path,
            [0.04, 0.05, 0.048, 0.036, 0.022],
            [0.03, 0.03, 0.03, 0.028, 0.022],
            sides=6,
            width_axis=across,
            fold=0.006,
        )
    write_world(bpy.data.objects["Tulip_Leaves"], leaves)


# ------------------------------------------------------------ garden flower
# GardenFlowerModel.tsx anchors the bloom at this height and tints petals
# through their vertex colours, which stay white.
GARDEN_FLOWER_BLOOM = 0.428


def restyle_garden_flower():
    paint("Material.GardenFlower.Stem", "leaf", 0.5)
    paint("Material.GardenFlower.Leaf", "leaf", 0.5)
    paint("Material.GardenFlower.Center", "petal_yellow", 0.45)
    ps.set_surface(bpy.data.materials["Material.GardenFlower.PetalGradient"], 0.45)

    bm = bmesh.new()
    core.add_limb(
        bm,
        [(0.0, 0.0, -0.005), (0.0, 0.0, 0.2), (0.0, 0.0, GARDEN_FLOWER_BLOOM - 0.01)],
        [0.017, 0.0165, 0.016],
        sides=6,
        tip=False,
    )
    write_world(bpy.data.objects["GardenFlower_Stem"], bm)

    bm = bmesh.new()
    for height, (dx, dy) in ((0.12, (0.84, 0.53)), (0.17, (-0.92, -0.36))):
        out = Vector((dx, dy, 0.0)).normalized()
        across = Vector((-out.y, out.x, 0.0))
        path = core.bezier_points(
            out * 0.01 + Vector((0, 0, height)),
            out * 0.06 + Vector((0, 0, height + 0.025)),
            out * 0.115 + Vector((0, 0, height + 0.02)),
            4,
        )
        add_tube(bm, path, [0.03, 0.05, 0.044, 0.024], [0.024] * 4, sides=6, width_axis=across, fold=0.006)
    write_world(bpy.data.objects["GardenFlower_Leaves"], bm)

    petals = bpy.data.objects["GardenFlower_Petals"]
    bm = bmesh.new()
    for index in range(8):
        angle = index / 8 * math.tau
        out = Vector((math.cos(angle), math.sin(angle), 0.0))
        along = (out + Vector((0.0, 0.0, 0.18))).normalized()
        across = Vector((-out.y, out.x, 0.0))
        up = along.cross(across).normalized()
        if up.z < 0:
            up = -up
        add_ellipsoid(
            bm,
            Vector((0.0, 0.0, GARDEN_FLOWER_BLOOM - 0.006)) + along * 0.058,
            (along, across, up),
            (0.056, 0.03, 0.012),
            cup=0.006,
        )
    colour = bm.loops.layers.color.new("Color")
    for face in bm.faces:
        for loop in face.loops:
            loop[colour] = (1.0, 1.0, 1.0, 1.0)
    write_world(petals, bm)

    bm = bmesh.new()
    core.add_blob(bm, (0.0, 0.0, GARDEN_FLOWER_BLOOM + 0.006), (0.042, 0.042, 0.024), subdivisions=2)
    write_world(bpy.data.objects["GardenFlower_Center"], bm)


# ---------------------------------------------------------------- sunflower
SUNFLOWER_HEAD = Vector((0.0, -0.02, 1.33))
# The head faces -Y: head space +Z maps to world -Y.
SUNFLOWER_TO_WORLD = Matrix.Translation(SUNFLOWER_HEAD) @ Matrix.Rotation(math.radians(90), 4, "X")
SUNFLOWER_RINGS = [(0.04, 6), (0.075, 9), (0.11, 12), (0.145, 15)]
SUNFLOWER_DISC = [
    (0.0, 0.03),
    (0.17, 0.03),
    (0.186, 0.06),
    (0.176, 0.1),
    (0.135, 0.135),
    (0.07, 0.152),
    (0.0, 0.156),
]
# Leaf name: (centre, length axis, width axis, half length, half width).
SUNFLOWER_LEAVES = {
    "Sunflower_Leaf_Lower_L": ((-0.231, -0.019, 0.579), (-0.74, -0.016, 0.672), (-0.672, 0.002, -0.741), 0.25, 0.1),
    "Sunflower_Leaf_Lower_R": ((0.241, 0.0, 0.582), (0.958, -0.006, 0.286), (-0.286, 0.013, 0.958), 0.22, 0.095),
    "Sunflower_Leaf_Mid_L": ((-0.195, -0.027, 0.808), (-0.779, 0.012, 0.627), (0.627, 0.002, 0.779), 0.21, 0.09),
    "Sunflower_Leaf_Mid_R": ((0.194, -0.025, 0.903), (0.812, -0.002, 0.584), (0.584, 0.006, -0.812), 0.2, 0.088),
    "Sunflower_Leaf_Upper_L": ((-0.146, -0.025, 1.079), (-0.642, 0.022, 0.766), (-0.763, 0.076, -0.642), 0.19, 0.08),
    "Sunflower_Leaf_Upper_R": ((0.15, -0.022, 1.175), (0.747, 0.014, 0.665), (0.659, 0.121, -0.743), 0.17, 0.075),
}


def disc_height(radius):
    for (r0, z0), (r1, z1) in zip(SUNFLOWER_DISC[::-1], SUNFLOWER_DISC[-2::-1]):
        if r0 <= radius <= r1:
            return lerp(z0, z1, (radius - r0) / max(1e-6, r1 - r0))
    return SUNFLOWER_DISC[1][1]


def to_head(bm, verts):
    bmesh.ops.transform(bm, matrix=SUNFLOWER_TO_WORLD, verts=verts)


def restyle_sunflower():
    paint("Sunflower_Stem_Material", "canopy", 0.5)
    paint("Sunflower_Leaf_Material", "leaf", 0.5)
    paint("Sunflower_Leaf_Dark_Material", "canopy", 0.5)
    paint("Sunflower_Sepal_Material", "canopy", 0.5)
    paint("Sunflower_Petal_Material", "petal_yellow", 0.45)
    paint("Sunflower_Petal_Shadow_Material", "petal_amber", 0.45)
    paint("Sunflower_Center_Material", "flower_centre", 0.6)
    paint("Sunflower_Center_Dark_Material", "flower_seeds", 0.6)

    bm = bmesh.new()
    core.add_limb(
        bm,
        core.bezier_points((0.0, 0.0, -0.01), (0.012, -0.004, 0.65), (0.0, -0.03, 1.27), 4),
        [0.052, 0.049, 0.046, 0.044],
        sides=8,
        tip=False,
    )
    write_world(bpy.data.objects["Sunflower_Stem"], bm)

    for name, (centre, length_axis, width_axis, half_length, half_width) in SUNFLOWER_LEAVES.items():
        length_axis = Vector(length_axis).normalized()
        width_axis = Vector(width_axis).normalized()
        thin = length_axis.cross(width_axis).normalized()
        # Leaves sit out from the stem so their base meets it.
        centre = Vector(centre) + length_axis * 0.02
        bm = bmesh.new()
        add_flat_ellipsoid(bm, centre, (length_axis, width_axis, thin), (half_length, half_width, 0.024), cup=0.03)
        write_world(bpy.data.objects[name], bm)

    # Head back: a green dome behind the petals.
    bm = bmesh.new()
    revolve(bm, [(0.0, -0.075), (0.1, -0.065), (0.17, -0.035), (0.198, 0.0), (0.19, 0.035), (0.0, 0.035)], 18)
    to_head(bm, list(bm.verts))
    write_world(bpy.data.objects["Sunflower_Head_Back"], bm)

    bm = bmesh.new()
    revolve(bm, SUNFLOWER_DISC, 18)
    to_head(bm, list(bm.verts))
    write_world(bpy.data.objects["Sunflower_Center"], bm)

    # Seeds: rounded studs in rings on the disc.
    for ring_index, (radius, count) in enumerate(SUNFLOWER_RINGS):
        for index in range(count):
            angle = index / count * math.tau + ring_index * 0.35
            height = disc_height(radius)
            slope = (disc_height(radius + 0.01) - disc_height(radius - 0.01)) / 0.02
            normal = Vector((-math.cos(angle) * slope, -math.sin(angle) * slope, 1.0))
            base = Vector((math.cos(angle) * radius, math.sin(angle) * radius, height))
            bm = bmesh.new()
            add_stud(bm, base, normal, 0.022, 0.018, sides=5)
            to_head(bm, list(bm.verts))
            write_world(bpy.data.objects[f"Sunflower_Center_Dot_{ring_index}_{index:02d}"], bm)

    # Petals: 14 chunky spoons around the disc, alternate ones a step
    # forward so the ring reads as two layers.
    for index in range(14):
        angle = math.pi / 2 - index / 14 * math.tau
        out = Vector((math.cos(angle), math.sin(angle), 0.0))
        front = index % 2 == 0
        along = (out + Vector((0.0, 0.0, 0.16 if front else 0.08))).normalized()
        across = Vector((-out.y, out.x, 0.0))
        up = along.cross(across).normalized()
        if up.z < 0:
            up = -up
        length = 0.17 if front else 0.155
        centre = along * (0.16 + length) + Vector((0.0, 0.0, 0.07 if front else 0.05))
        bm = bmesh.new()
        add_flat_ellipsoid(bm, centre, (along, across, up), (length, 0.1, 0.028), segments=12, cup=0.03)
        to_head(bm, list(bm.verts))
        write_world(bpy.data.objects[f"Sunflower_Petal_{index:02d}"], bm)

    # Sepals: green points that peek out between the petals at the back.
    for index in range(7):
        angle = math.pi / 2 - (index + 0.5) / 7 * math.tau
        out = Vector((math.cos(angle), math.sin(angle), 0.0))
        along = (out + Vector((0.0, 0.0, -0.1))).normalized()
        across = Vector((-out.y, out.x, 0.0))
        up = along.cross(across).normalized()
        bm = bmesh.new()
        add_tube(
            bm,
            [along * 0.16 + Vector((0, 0, -0.012)), along * 0.24, along * 0.31 + Vector((0, 0, 0.012))],
            [0.07, 0.075, 0.045],
            [0.05, 0.05, 0.04],
            sides=6,
            width_axis=across,
        )
        to_head(bm, list(bm.verts))
        write_world(bpy.data.objects[f"Sunflower_Sepal_{index:02d}"], bm)


# -------------------------------------------------------------- stake, seed
# The shared wood profile (assets/apply-bridge-wood-palette.py): the
# walkway's warm plank, copied input by input like that script does.
SHARED_WOOD_SOURCE = ("WoodenWalkway.blend", "Material.WoodenWalkway.WarmWood")
SHARED_WOOD_INPUTS = (
    "Base Color",
    "Metallic",
    "Roughness",
    "IOR",
    "Specular IOR Level",
    "Coat Weight",
    "Coat Roughness",
    "Emission Color",
    "Emission Strength",
    "Alpha",
)


def shared_wood_material(name):
    """A material named `name` with the shared wood profile."""
    file_name, source_name = SHARED_WOOD_SOURCE
    with bpy.data.libraries.load(str(ASSETS_DIR / file_name), link=False) as (source, target):
        target.materials = [source_name]
    reference = target.materials[0]
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    shader = ps.principled(material)
    reference_shader = ps.principled(reference)
    for link in list(shader.inputs["Base Color"].links):
        material.node_tree.links.remove(link)
    for input_name in SHARED_WOOD_INPUTS:
        shader.inputs[input_name].default_value = reference_shader.inputs[input_name].default_value
    bpy.data.materials.remove(reference)
    return material


def restyle_stick():
    """Plant stake, exactly one metre tall (raisedBedDimensions.ts).

    The stake had no material, so the loader drew it white. It takes the
    shared wood as `Material.Planks`, the name the timber props use.
    """
    obj = bpy.data.objects["Stick"]
    bm = bmesh.new()
    revolve(bm, [(0.0, 0.0), (0.017, 0.0), (0.017, 0.972), (0.0125, 0.992), (0.0, 1.0)], 8)
    write_world(obj, bm)
    obj.data.materials.clear()
    obj.data.materials.append(shared_wood_material("Material.Planks"))


def restyle_seed():
    """A plump seed, a little larger than the old 1 cm bead.

    The seed had no material, so the loader drew it in its default white
    with metalness 1. It takes `Material.Seed` in the path tan, matte.
    """
    obj = bpy.data.objects["Seed"]
    bm = bmesh.new()
    core.add_blob(bm, (0.0, 0.0, 0.0), (0.0068, 0.0058, 0.0055), subdivisions=2)
    write_world(obj, bm)
    material = bpy.data.materials.get("Material.Seed") or bpy.data.materials.new("Material.Seed")
    obj.data.materials.clear()
    obj.data.materials.append(material)
    paint("Material.Seed", "seed", 0.8)


RESTYLERS = {
    "Pine.blend": restyle_pine,
    "PalmTree.blend": restyle_palm,
    "DeadTreeTall.blend": restyle_dead_tree_tall,
    "DeadTreeStump.blend": restyle_dead_tree_stump,
    "CactusBarrel.blend": restyle_cactus_barrel,
    "CactusColumnCluster.blend": restyle_cactus_columns,
    "CactusPricklyPear.blend": restyle_cactus_prickly_pear,
    "DesertStoneSmall.blend": lambda: restyle_desert_stone("DesertStoneSmall", 2.3),
    "DesertStoneMedium.blend": lambda: restyle_desert_stone("DesertStoneMedium", 5.2),
    "DesertStoneLarge.blend": lambda: restyle_desert_stone("DesertStoneLarge", 8.6),
    "Rose.blend": restyle_rose,
    "Tulip.blend": restyle_tulip,
    "GardenFlower.blend": restyle_garden_flower,
    "Sunflower.blend": restyle_sunflower,
    "Stick.blend": restyle_stick,
    "Seed.blend": restyle_seed,
}


def main():
    args = parse_args()
    wanted = {f"{name}.blend" for name in args.asset}
    unknown = wanted - set(RESTYLERS)
    if unknown:
        raise SystemExit(f"Not in this pass: {', '.join(sorted(unknown))}")
    for file_name, restyle in RESTYLERS.items():
        if wanted and file_name not in wanted:
            continue
        path = ASSETS_DIR / file_name
        bpy.ops.wm.open_mainfile(filepath=str(path))
        restyle()
        bpy.ops.wm.save_mainfile(filepath=str(path))
        backup = path.with_suffix(".blend1")
        if backup.exists():
            backup.unlink()
        for obj in bpy.data.objects:
            if obj.type == "MESH" and obj.data.polygons:
                print(f"  {obj.name}: {ps.evaluated_triangles(obj)} triangles")
        print(f"Restyled {file_name}")


if __name__ == "__main__":
    main()
