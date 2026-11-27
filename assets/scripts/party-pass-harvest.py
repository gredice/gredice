"""Restyle the harvest, woodland and Halloween models for GAME_ART.md.

Covers the nineteen release-pinned autumn and Halloween models: the chestnut
roasting cart, friendly ghost, supported cobweb, garden brazier, scarecrow,
both harvest crates, the three decorative pumpkins, the harvest wheelbarrow,
the hedgehog and its shelter, both pumpkin lanterns, the three woodland
arrangements and the woodland mushroom cluster. The pumpkin lanterns, crates
and wheelbarrow reuse the smooth pumpkin built here.

What changes:

- Shape. Boxes become rounded boxes with bevels from the GAME_ART table,
  round parts (pumpkins, fruit, acorns, mushrooms, the ghost sheet, the
  hedgehog) are rebuilt from smooth profiles, thin rods, strands and straws
  are rebuilt as round tubes at least 0.03 thick, and every face is shaded
  smooth with weighted normals.
- Surface. Metalness 0 and roughness from the GAME_ART bands.
- Colour. Autumn, harvest and Halloween get the bright party look (decided
  2026-11-23). Every material and vertex colour is mapped to a seasonal or
  base role from party_style: through its old->new table
  (party_style.seasonal_role), with the per-asset overrides in
  COLOUR_OVERRIDES, and one role per part where PART_ROLES names one, so
  rebuilt parts show one clean colour instead of sampled shading. Wood keeps
  its authored tones: the shared wood profile is not seasonal.

What does not change:

- Object, mesh and material names, origins, parents, effect anchors,
  animations, vertex groups and footprints.

Every model is rebuilt from its release-pinned source at SOURCE_COMMIT, read
with `git show`, so running the script again gives the same result.

Run from the repository root, then export the touched assets, bump their
versions and rebuild the release manifests with the build-*-release.ts
scripts in packages/game/scripts:

    /Applications/Blender.app/Contents/MacOS/Blender -b \
        --python assets/scripts/party-pass-harvest.py
    (cd assets && Blender -b --python export-game-assets.py -- --asset HarvestCrate ...)

Pass `-- --asset HarvestCrate` to limit the run to one model. The harvest
pumpkin manifest is rebuilt with packages/game/scripts/
build-harvest-pumpkins-release.ts like the others.
"""

import argparse
import fnmatch
import math
import subprocess
import sys
import tempfile
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector, kdtree
from mathutils.bvhtree import BVHTree
from mathutils.interpolate import poly_3d_calc

sys.path.insert(0, str(Path(__file__).resolve().parent))
import party_style  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
ASSETS_DIR = ROOT / "assets" / "game-assets"
# The last commit before the party pass. Its sources match the hashes in the
# release manifests that were reviewed for these items.
SOURCE_COMMIT = "ae0f4e0c2a8d42d0229a417f9bcbe0fd0cb26acb"

# Roughness bands from GAME_ART.md.
MATTE = 0.8
SATIN = 0.55
GLOSS = 0.4
STEEL = 0.35

Z = Vector((0.0, 0.0, 1.0))


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", action="append", default=[])
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


# --------------------------------------------------------------- source files
def open_source(asset):
    """Opens the release-pinned source of `asset`."""
    data = subprocess.run(
        [
            "git",
            "-C",
            str(ROOT),
            "show",
            f"{SOURCE_COMMIT}:assets/game-assets/{asset}.blend",
        ],
        check=True,
        capture_output=True,
    ).stdout
    path = Path(tempfile.gettempdir()) / f"party-pass-harvest-{asset}.blend"
    path.write_bytes(data)
    bpy.ops.wm.open_mainfile(filepath=str(path))
    bpy.context.preferences.filepaths.save_version = 0
    return path


def save(asset, source_path):
    bpy.context.scene["party_pass"] = "assets/scripts/party-pass-harvest.py"
    target = ASSETS_DIR / f"{asset}.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(target))
    for leftover in (target.with_suffix(".blend1"), source_path):
        if leftover.exists():
            leftover.unlink()


def set_roughness(material_name, roughness):
    material = bpy.data.materials[material_name]
    party_style.set_surface(material, roughness)
    material.roughness = roughness
    material.metallic = 0.0


# --------------------------------------------------------------------- colour
# Old colour -> role for this pack, on top of party_style.seasonal_role.
COLOUR_OVERRIDES = {
    # The ghost sheet was pure white.
    "FriendlyGhost": {"#ffffff": "ghost_lilac"},
}


def bowl_rim(_name, centre, _normal):
    """The brazier bowl is iron; its rolled rim is the lighter steel."""
    radius = math.hypot(centre.x, centre.y)
    return "steel" if centre.z > 0.445 and radius > 0.29 else "iron"


def conker_hilum(_name, centre, _normal):
    """One conker colour with the pale hilum on top, not shaded bands."""
    return "cream" if centre.z > 0.188 else "conker"


def basket_cap(_name, _centre, normal):
    """Basket mushroom caps: brown on top, cream gills underneath.

    The caps take the conker brown: small round caps catch more of the cool
    sky fill than a flat top face, and on acorn_cap they read as muted tan
    on screen (saturation about 0.44 against the 0.55 floor).
    """
    return "cream" if normal.z < -0.5 else "conker"


# Cap colour of each woodland mushroom (old #895735, #b08054, #bca578,
# #965d30 and #79563c), and the height of its gills. The lighter caps take
# nut caramel rather than acorn_cap, which reads as muted tan on a small
# round cap in the game.
WOODLAND_CAPS = {1: "conker", 2: "nut_caramel", 3: "cream", 4: "conker", 5: "nut_caramel"}


def woodland_cap(name, centre, _normal):
    index = int(name.split("_")[1])
    stem = WOODLAND_MUSHROOMS[index - 1][2]
    return "cream" if centre.z < stem - 0.003 else WOODLAND_CAPS[index]


# One role per part, by vertex-group pattern (first match wins). A callable
# picks the role per face (or per point) from its position and normal. Parts
# not listed keep their colours mapped one by one; wood stays as authored.
PART_ROLES = {
    "ChestnutRoastingCart": [
        ("FestiveLettering", "cream"),
        ("PaperCone", "cream"),
        ("SignBoard", "evergreen"),
        ("Wheel", "iron"),
        ("FireDoor", "iron"),
        ("RoastingPan", "iron"),
    ],
    "FriendlyGhost": [
        ("Sheet", "ghost_lilac"),
        ("Eye*", "ink_violet"),
        ("Smile*", "ink_violet"),
    ],
    "SupportedCobweb": [("Arc*", "ghost_lilac"), ("Spoke*", "ghost_lilac")],
    "GardenBrazier": [
        ("SteelBowl", bowl_rim),
        ("Handle*", "steel"),
        ("Leg*", "iron"),
        ("Foot*", "iron"),
        ("CharredBillet*", "conker"),
    ],
    "Hedgehog": [
        ("Body", "conker"),
        ("Spines*", "acorn_cap"),
        ("Foot*", "conker"),
        ("Face", "cream"),
        ("Ear*", "nut_caramel"),
        ("Eye*", "ink_violet"),
        ("Nose", "ink_violet"),
    ],
    "HedgehogShelter": [("Bedding", "hay")],
    # Leaf beds take the gold leaf colour: leaf_pile is too close to the
    # nuts and conkers lying on it to keep them readable.
    "WoodlandAcorns": [
        ("LeafBed", "autumn_gold"),
        ("Acorn*Nut", "nut_caramel"),
        # Conker brown: on acorn_cap the small caps read as muted tan.
        ("Acorn*Cap", "conker"),
        ("Acorn*Stem", "trunk"),
    ],
    "WoodlandConkers": [
        ("LeafBed", "autumn_gold"),
        ("Conker*", conker_hilum),
        ("OpenHusk*", "crop_leaf_light"),
    ],
    "WoodlandMushroomBasket": [
        ("BasketBand*", "hay"),
        ("BasketHandle*", "hay_shade"),
        ("Basket", "hay_shade"),
        ("Mushroom*Cap", basket_cap),
        ("Mushroom*Stem", "cream"),
    ],
    "WoodlandMushrooms": [("Stem_*", "cream"), ("Cap_*", woodland_cap)],
}

# Glowing materials take the emissive colour of their glow role.
EMISSIVE_ROLES = {
    "Material.PumpkinLantern.Glow": "lantern_glow",
    "Material.GardenBrazier.Embers": "lantern_glow",
}


def role_rgba(role):
    albedo, _ = party_style.seasonal_role_albedo(role)
    return (*albedo, 1.0)


def old_colour_role(asset, hex_value):
    key = hex_value.lower()
    return COLOUR_OVERRIDES.get(asset, {}).get(key) or party_style.seasonal_role(key, asset)


def part_rule(asset, name):
    for pattern, rule in PART_ROLES.get(asset, ()):
        if name and fnmatch.fnmatchcase(name, pattern):
            return rule
    return None


def recolour(asset):
    """Maps every material and vertex colour of `asset` to a role."""
    kept = set()
    for material in bpy.data.materials:
        if material.users == 0:
            continue
        shader = party_style.principled(material)
        colour = party_style.flat_colour(material)
        if colour is not None:
            role = old_colour_role(asset, party_style.linear_to_hex(colour))
            if role:
                shader.inputs["Base Color"].default_value = role_rgba(role)
                material.diffuse_color = role_rgba(role)
            else:
                kept.add(party_style.linear_to_hex(colour))
        glow = EMISSIVE_ROLES.get(material.name)
        if glow:
            emissive = party_style.hex_to_linear(party_style.SEASONAL_EMISSIVE[glow])
            shader.inputs["Emission Color"].default_value = (*emissive, 1.0)
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            recolour_vertices(obj, asset, kept)
    if kept:
        print(f"  kept as authored (wood): {sorted(kept)}")


def recolour_vertices(obj, asset, kept):
    mesh = obj.data
    attribute = mesh.color_attributes.get("Color")
    if attribute is None:
        return
    names = {group.index: group.name for group in obj.vertex_groups}

    def group_of(indices):
        weights = {}
        for index in indices:
            for element in mesh.vertices[index].groups:
                weights[element.group] = weights.get(element.group, 0.0) + element.weight
        return names.get(max(weights, key=weights.get)) if weights else None

    def role_at(name, centre, normal):
        rule = part_rule(asset, name)
        return rule(name, centre, normal) if callable(rule) else rule

    def remapped(colour):
        hex_value = party_style.linear_to_hex(colour)
        role = old_colour_role(asset, hex_value)
        if role is None:
            kept.add(hex_value)
            return None
        return role_rgba(role)

    if attribute.domain == "CORNER":
        for polygon in mesh.polygons:
            role = role_at(group_of(polygon.vertices), polygon.center, polygon.normal)
            for loop_index in polygon.loop_indices:
                colour = role_rgba(role) if role else remapped(attribute.data[loop_index].color)
                if colour:
                    attribute.data[loop_index].color = colour
    else:
        for vert in mesh.vertices:
            role = role_at(group_of([vert.index]), vert.co, vert.normal)
            colour = role_rgba(role) if role else remapped(attribute.data[vert.index].color)
            if colour:
                attribute.data[vert.index].color = colour
    mesh.update()


# ------------------------------------------------------------------- profiles
def catmull_rom(points, count):
    """Resamples a 2D polyline to `count` points along a smooth spline.

    The ends are kept, so a profile still starts and stops where it did.
    """
    points = [Vector(point) for point in points]
    padded = [2 * points[0] - points[1], *points, 2 * points[-1] - points[-2]]
    dense = []
    for index in range(1, len(padded) - 2):
        p0, p1, p2, p3 = padded[index - 1 : index + 3]
        for step in range(16):
            t = step / 16
            dense.append(
                0.5
                * (
                    2 * p1
                    + (-p0 + p2) * t
                    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                    + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
                )
            )
    dense.append(points[-1])
    lengths = [0.0]
    for a, b in zip(dense, dense[1:]):
        lengths.append(lengths[-1] + (b - a).length)
    result = []
    for index in range(count):
        target = lengths[-1] * index / (count - 1)
        segment = next(
            (i for i in range(1, len(lengths)) if lengths[i] >= target),
            len(lengths) - 1,
        )
        span = lengths[segment] - lengths[segment - 1] or 1.0
        t = (target - lengths[segment - 1]) / span
        result.append(dense[segment - 1].lerp(dense[segment], t))
    return [(point.x, point.y) for point in result]


def fillet(points, radius, steps=1):
    """Rounds each inner corner of a 2D polyline, like a profile bevel.

    Nearly straight joints are left alone, so the ring count stays low.
    """
    points = [Vector(point) for point in points]
    result = [points[0]]
    for index in range(1, len(points) - 1):
        a, p, b = points[index - 1], points[index], points[index + 1]
        to_a, to_b = a - p, b - p
        if to_a.length < 1e-6 or to_b.length < 1e-6:
            result.append(p)
            continue
        angle = to_a.angle(to_b)
        if angle > math.radians(155):
            result.append(p)
            continue
        distance = min(radius / math.tan(angle / 2), 0.45 * to_a.length, 0.45 * to_b.length)
        start = p + to_a.normalized() * distance
        end = p + to_b.normalized() * distance
        for step in range(steps + 2):
            t = step / (steps + 1)
            result.append((1 - t) ** 2 * start + 2 * (1 - t) * t * p + t * t * end)
    result.append(points[-1])
    return [(point.x, point.y) for point in result]


def fillet_closed(points, radius, steps=1):
    """Rounds every corner of a closed 2D polygon."""
    return fillet([points[-1], *points, points[0]], radius, steps)[1:-1]


def orthonormal(axis):
    axis = Vector(axis).normalized()
    helper = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0))
    u = axis.cross(helper).normalized()
    v = axis.cross(u).normalized()
    return axis, u, v


# ----------------------------------------------------------------- primitives
def revolve(
    bm,
    profile,
    sides,
    origin=(0.0, 0.0, 0.0),
    axis=Z,
    radial=None,
    offset=None,
    phase=0.0,
    scale=(1.0, 1.0),
):
    """Revolves `profile`, a list of (height, radius), around `axis`.

    A radius of 0 at either end closes the shape with a pole. Otherwise the
    end is closed with a flat fan. `radial(angle, height)` multiplies the
    radius (ribs, lobes) and `offset(height)` shifts a ring sideways (a lean
    or a curve). `scale` stretches the ring along the two side axes for oval
    sections.
    """
    axis, u, v = orthonormal(axis)
    origin = Vector(origin)
    rings = []
    last = len(profile) - 1
    for index, (height, radius) in enumerate(profile):
        centre = origin + axis * height
        if offset is not None:
            centre = centre + Vector(offset(height))
        if radius <= 1e-6 and index in (0, last):
            rings.append([bm.verts.new(centre)])
            continue
        ring = []
        for step in range(sides):
            angle = math.tau * step / sides + phase
            factor = radial(angle, height) if radial else 1.0
            ring.append(
                bm.verts.new(
                    centre
                    + u * (math.cos(angle) * radius * factor * scale[0])
                    + v * (math.sin(angle) * radius * factor * scale[1])
                )
            )
        rings.append(ring)
    faces = []
    for low, high in zip(rings, rings[1:]):
        if len(low) == 1 and len(high) == 1:
            continue
        for step in range(sides):
            nxt = (step + 1) % sides
            if len(low) == 1:
                faces.append(bm.faces.new((low[0], high[step], high[nxt])))
            elif len(high) == 1:
                faces.append(bm.faces.new((low[step], high[0], low[nxt])))
            else:
                faces.append(bm.faces.new((low[step], high[step], high[nxt], low[nxt])))
    # Flat fans for ends that are not poles.
    for ring, flip in ((rings[0], True), (rings[-1], False)):
        if len(ring) == 1:
            continue
        centre = bm.verts.new(sum((vert.co for vert in ring), Vector()) / len(ring))
        for step in range(sides):
            nxt = (step + 1) % sides
            corners = (ring[nxt], ring[step], centre) if flip else (ring[step], ring[nxt], centre)
            faces.append(bm.faces.new(corners))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def ellipsoid(bm, centre, radii, sides=12, rings=8, frame=None):
    """A smooth UV ellipsoid. `frame` is a 3x3 rotation for its axes."""
    profile = [
        (-math.cos(math.pi * index / rings), math.sin(math.pi * index / rings))
        for index in range(rings + 1)
    ]
    profile[0] = (-1.0, 0.0)
    profile[-1] = (1.0, 0.0)
    faces = revolve(bm, profile, sides)
    verts = {vert for face in faces for vert in face.verts}
    frame = frame or Matrix.Identity(3)
    for vert in verts:
        local = Vector((vert.co.x * radii[0], vert.co.y * radii[1], vert.co.z * radii[2]))
        vert.co = Vector(centre) + frame @ local
    return faces


def tube(bm, start, end, radius, sides=8, end_radius=None, caps=("round", "round"), cap_rings=2):
    """A round rod from `start` to `end` with rounded or flat ends."""
    start, end = Vector(start), Vector(end)
    length = (end - start).length
    end_radius = radius if end_radius is None else end_radius
    profile = []
    for which, (cap, r, sign) in enumerate(
        ((caps[0], radius, 1), (caps[1], end_radius, -1))
    ):
        base = 0.0 if which == 0 else length
        points = []
        if cap == "round":
            # A dome: the pole sits on the end point and the full radius
            # `depth` inside it, so the rod keeps its length.
            depth = min(r, length * 0.45)
            for step in range(cap_rings + 1):
                angle = math.pi / 2 * step / cap_rings
                points.append((base + sign * depth * (1 - math.cos(angle)), r * math.sin(angle)))
        else:
            lip = min(r * 0.35, length * 0.2)
            points = [
                (base, 0.0),
                (base, r - lip),
                (base + sign * lip * 0.3, r - lip * 0.3),
                (base + sign * lip, r),
            ]
        profile.extend(points if which == 0 else list(reversed(points)))
    return revolve(bm, profile, sides, origin=start, axis=end - start)


def sweep(bm, points, radius, sides=8, closed=False, end_rings=2):
    """A round tube along a polyline, with rounded ends unless `closed`."""
    points = [Vector(point) for point in points]
    count = len(points)
    tangents = []
    for index in range(count):
        if closed:
            tangent = points[(index + 1) % count] - points[index - 1]
        else:
            tangent = points[min(index + 1, count - 1)] - points[max(index - 1, 0)]
        tangents.append(tangent.normalized())
    _, normal, _ = orthonormal(tangents[0])
    rings = []
    for index, (point, tangent) in enumerate(zip(points, tangents)):
        normal = (normal - tangent * normal.dot(tangent)).normalized()
        binormal = tangent.cross(normal)
        rings.append(
            [
                bm.verts.new(
                    point
                    + radius
                    * (
                        normal * math.cos(math.tau * step / sides)
                        + binormal * math.sin(math.tau * step / sides)
                    )
                )
                for step in range(sides)
            ]
        )
    faces = []
    pairs = list(zip(rings, rings[1:]))
    if closed:
        # Match the seam ring to the start ring by nearest vertex.
        last, first = rings[-1], rings[0]
        shift = min(range(sides), key=lambda s: (last[0].co - first[s].co).length)
        pairs.append((last, first[shift:] + first[:shift]))
    for low, high in pairs:
        for step in range(sides):
            nxt = (step + 1) % sides
            faces.append(bm.faces.new((low[step], low[nxt], high[nxt], high[step])))
    if not closed:
        for ring, point, tangent, sign in (
            (rings[0], points[0], tangents[0], -1),
            (rings[-1], points[-1], tangents[-1], 1),
        ):
            previous = ring
            for step in range(1, end_rings + 1):
                angle = math.pi / 2 * step / (end_rings + 1)
                shrink = math.cos(angle)
                lift = math.sin(angle) * radius * sign
                current = [
                    bm.verts.new(point + (vert.co - point) * shrink + tangent * lift)
                    for vert in ring
                ]
                for index in range(sides):
                    nxt = (index + 1) % sides
                    faces.append(
                        bm.faces.new((previous[index], previous[nxt], current[nxt], current[index]))
                    )
                previous = current
            pole = bm.verts.new(point + tangent * radius * sign)
            for index in range(sides):
                nxt = (index + 1) % sides
                faces.append(bm.faces.new((previous[index], previous[nxt], pole)))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def rounded_box(bm, centre, frame, half, radius, segments=2, sharp_sides=()):
    """A rounded box with half sizes `half` along the columns of `frame`."""
    radius = min(radius, min(half) * 0.9)
    faces = party_style.add_box(
        bm,
        tuple(-h for h in half),
        tuple(half),
        radius=radius,
        segments=segments,
        sharp_sides=sharp_sides,
    )
    verts = {vert for face in faces for vert in face.verts}
    for vert in verts:
        vert.co = Vector(centre) + frame @ vert.co
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def loft(bm, rings, close_start=True, close_end=True):
    """Skins rings of points (lists of Vectors); a single point is a pole."""
    built = [[bm.verts.new(point) for point in ring] for ring in rings]
    sides = max(len(ring) for ring in built)
    faces = []
    for low, high in zip(built, built[1:]):
        for step in range(sides):
            nxt = (step + 1) % sides
            if len(low) == 1:
                faces.append(bm.faces.new((low[0], high[step], high[nxt])))
            elif len(high) == 1:
                faces.append(bm.faces.new((low[step], high[0], low[nxt])))
            else:
                faces.append(bm.faces.new((low[step], high[step], high[nxt], low[nxt])))
    for ring, wanted in ((built[0], close_start), (built[-1], close_end)):
        if wanted and len(ring) > 1:
            centre = bm.verts.new(sum((vert.co for vert in ring), Vector()) / len(ring))
            for step in range(sides):
                faces.append(bm.faces.new((ring[step], ring[(step + 1) % sides], centre)))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def prism(bm, outline, depth_axis, depth_low, depth_high, radius, segments=2, angle=30.0):
    """Extrudes a 2D outline (3D points in the plane normal to `depth_axis`)
    and rounds every edge sharper than `angle`."""
    low = [bm.verts.new(Vector(point) + depth_axis * depth_low) for point in outline]
    high = [bm.verts.new(Vector(point) + depth_axis * depth_high) for point in outline]
    count = len(outline)
    faces = [bm.faces.new(low), bm.faces.new(list(reversed(high)))]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append(bm.faces.new((low[index], low[nxt], high[nxt], high[index])))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    edges = [
        edge
        for edge in {edge for face in faces for edge in face.edges}
        if edge.calc_face_angle(0.0) > math.radians(angle)
    ]
    before = set(bm.faces)
    bmesh.ops.bevel(
        bm,
        geom=edges,
        offset=radius,
        offset_type="OFFSET",
        segments=segments,
        profile=0.5,
        affect="EDGES",
        clamp_overlap=True,
    )
    created = set(bm.faces) - before
    return [face for face in faces if face.is_valid] + list(created)


# ---------------------------------------------------------------- part rebuild
class Part:
    def __init__(self, index, name, faces, verts):
        self.index = index
        self.name = name
        self.faces = faces
        self.verts = verts


class Rebuilder:
    """Rewrites one mesh object part by part.

    A part is a loose piece of the mesh, named after its vertex group when
    the source has named groups. Replaced parts are deleted and rebuilt;
    their new faces take the colour of the nearest original face, the part's
    material slot and its vertex group. Kept parts stay as they are.
    """

    def __init__(self, obj):
        self.obj = obj
        self.src = bmesh.new()
        self.src.from_mesh(obj.data)
        self.out = bmesh.new()
        self.out.from_mesh(obj.data)
        for bm in (self.src, self.out):
            bm.verts.ensure_lookup_table()
            bm.faces.ensure_lookup_table()
        self.out_verts = list(self.out.verts)
        self.corner = self.src.loops.layers.float_color.get("Color")
        self.point = self.src.verts.layers.float_color.get("Color")
        self.out_corner = self.out.loops.layers.float_color.get("Color")
        self.out_point = self.out.verts.layers.float_color.get("Color")
        self.deform = self.src.verts.layers.deform.active
        self.out_deform = self.out.verts.layers.deform.active
        self.group_index = {group.name: group.index for group in obj.vertex_groups}
        group_names = {group.index: group.name for group in obj.vertex_groups}
        self.parts = []
        seen = set()
        for face in self.src.faces:
            if face.index in seen:
                continue
            stack, faces = [face], []
            seen.add(face.index)
            while stack:
                current = stack.pop()
                faces.append(current.index)
                for edge in current.edges:
                    for linked in edge.link_faces:
                        if linked.index not in seen:
                            seen.add(linked.index)
                            stack.append(linked)
            verts = sorted({vert.index for index in faces for vert in self.src.faces[index].verts})
            name = f"{obj.name}#{len(self.parts)}"
            if self.deform is not None and group_names:
                counts = {}
                for index in verts:
                    for group, weight in self.src.verts[index][self.deform].items():
                        counts[group] = counts.get(group, 0) + weight
                if counts:
                    name = group_names[max(counts, key=counts.get)]
            self.parts.append(Part(len(self.parts), name, faces, verts))
        self.removed = set()

    # -------------------------------------------------------------- queries
    def find(self, *patterns):
        return [
            part
            for part in self.parts
            if any(fnmatch.fnmatchcase(part.name, pattern) for pattern in patterns)
        ]

    def points(self, part):
        return [self.src.verts[index].co.copy() for index in part.verts]

    def bounds(self, parts):
        points = [point for part in parts for point in self.points(part)]
        low = Vector([min(point[axis] for point in points) for axis in range(3)])
        high = Vector([max(point[axis] for point in points) for axis in range(3)])
        return low, high

    def material_index(self, part):
        counts = {}
        for index in part.faces:
            material = self.src.faces[index].material_index
            counts[material] = counts.get(material, 0) + 1
        return max(counts, key=counts.get)

    def box_fit(self, part):
        """Oriented box of a box-like part: centre, frame and half sizes.

        The frame is ordered and signed to stay close to the world axes.
        """
        faces = sorted(
            (self.src.faces[index] for index in part.faces),
            key=lambda face: face.calc_area(),
            reverse=True,
        )
        first = faces[0].normal.normalized()
        second = next(
            (face.normal.normalized() for face in faces[1:] if abs(face.normal.dot(first)) < 0.2),
            None,
        )
        if second is None:
            axes = [Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))]
        else:
            second = (second - first * second.dot(first)).normalized()
            axes = [first, second, first.cross(second)]
        ordered = []
        for world in (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))):
            best = max(
                (axis for axis in axes if all(axis is not used for used in ordered)),
                key=lambda axis: abs(axis.dot(world)),
            )
            ordered.append(best)
        ordered = [axis if axis.dot(world) >= 0 else -axis for axis, world in zip(
            ordered, (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
        )]
        if ordered[0].cross(ordered[1]).dot(ordered[2]) < 0:
            ordered[2] = -ordered[2]
        points = self.points(part)
        low = [min(point.dot(axis) for point in points) for axis in ordered]
        high = [max(point.dot(axis) for point in points) for axis in ordered]
        centre = sum(
            (axis * ((lo + hi) / 2) for axis, lo, hi in zip(ordered, low, high)), Vector()
        )
        half = [(hi - lo) / 2 for lo, hi in zip(low, high)]
        frame = Matrix((ordered[0], ordered[1], ordered[2])).transposed()
        return centre, frame, half

    def tube_fit(self, part):
        """Axis, end points and end radii of a rod-like part."""
        caps = [
            self.src.faces[index]
            for index in part.faces
            if len(self.src.faces[index].verts) >= 5
        ]
        if caps:
            cap = max(caps, key=lambda face: face.calc_area())
            axis = cap.normal.normalized()
            anchor = cap.calc_center_median()
        else:
            centre, frame, half = self.box_fit(part)
            longest = max(range(3), key=lambda index: half[index])
            axis = frame.col[longest].normalized()
            anchor = centre
        points = self.points(part)
        heights = [(point - anchor).dot(axis) for point in points]
        low, high = min(heights), max(heights)

        def radius_near(target):
            near = [
                ((point - anchor) - axis * height).length
                for point, height in zip(points, heights)
                if abs(height - target) < (high - low) * 0.2 + 1e-5
            ]
            return max(near) if near else 0.0

        # The rod runs through the centre of its largest end cap.
        start = anchor + axis * low
        end = anchor + axis * high
        return start, end, radius_near(low), radius_near(high)

    # ------------------------------------------------------------- editing
    def remove(self, parts):
        verts = []
        for part in parts:
            if part.index in self.removed:
                continue
            self.removed.add(part.index)
            verts.extend(self.out_verts[index] for index in part.verts)
        if verts:
            bmesh.ops.delete(self.out, geom=verts, context="VERTS")

    def colour_tree(self, parts):
        """Nearest-surface lookup of the original colours of `parts`."""
        if self.corner is None and self.point is None:
            return None
        faces = [self.src.faces[index] for part in parts for index in part.faces]
        tree = BVHTree.FromPolygons(
            [vert.co for vert in self.src.verts],
            [[vert.index for vert in face.verts] for face in faces],
            all_triangles=False,
        )
        return tree, faces

    def sample(self, tree, point):
        bvh, faces = tree
        location, _, index, _ = bvh.find_nearest(point)
        face = faces[index]
        if self.corner is not None:
            colour = sum((Vector(loop[self.corner]) for loop in face.loops), Vector((0, 0, 0, 0)))
            return colour / len(face.loops)
        weights = poly_3d_calc([vert.co for vert in face.verts], location)
        return sum(
            (Vector(vert[self.point]) * weight for vert, weight in zip(face.verts, weights)),
            Vector((0, 0, 0, 0)),
        )

    def paint(self, faces, parts, group=None, material_index=None, smooth=True, colour=None):
        """Gives new faces the colour, slot and group of `parts`."""
        parts = list(parts)
        tree = None if colour is not None else self.colour_tree(parts)
        if material_index is None and parts:
            material_index = self.material_index(parts[0])
        group = group if group is not None else (parts[0].name if parts else None)
        group_index = self.group_index.get(group)
        verts = set()
        for face in faces:
            if not face.is_valid:
                continue
            face.smooth = smooth
            if material_index is not None:
                face.material_index = material_index
            verts.update(face.verts)
            if self.out_corner is not None:
                value = colour if colour is not None else self.sample(tree, face.calc_center_median())
                for loop in face.loops:
                    loop[self.out_corner] = value
        if self.out_point is not None:
            for vert in verts:
                vert[self.out_point] = colour if colour is not None else self.sample(tree, vert.co)
        if self.out_deform is not None and group_index is not None:
            for vert in verts:
                vert[self.out_deform].clear()
                vert[self.out_deform][group_index] = 1.0

    def dominant_colour(self, parts):
        """The colour covering most of the area of `parts`."""
        areas = {}
        for part in parts:
            for index in part.faces:
                face = self.src.faces[index]
                if self.corner is not None:
                    colour = tuple(round(value, 4) for value in face.loops[0][self.corner])
                else:
                    colour = tuple(round(value, 4) for value in face.verts[0][self.point])
                areas[colour] = areas.get(colour, 0.0) + face.calc_area()
        return Vector(max(areas, key=areas.get))

    def smooth_kept(self, parts):
        keep = {index for part in parts for index in part.verts}
        for vert_index in keep:
            vert = self.out_verts[vert_index]
            if vert.is_valid:
                for face in vert.link_faces:
                    face.smooth = True

    def finish(self, keep_sharp=False):
        self.out.normal_update()
        self.out.to_mesh(self.obj.data)
        self.out.free()
        self.src.free()
        for modifier in list(self.obj.modifiers):
            self.obj.modifiers.remove(modifier)
        weighted = party_style.add_weighted_normals(self.obj)
        weighted.keep_sharp = keep_sharp
        self.obj.data.update()

    # ------------------------------------------------------------- recipes
    def rebox(self, parts, radius=None, segments=None, min_thickness=0.0, grow="centre",
              thicken=1.0, thin=0.12, sharp_bottom=False, inward_to=None):
        """Rebuilds box-like parts as rounded boxes.

        Sides thinner than `thin` are multiplied by `thicken`, and none ends
        up under `min_thickness`. `grow="inward"` keeps the side face
        farthest from `inward_to` (the model centre by default) where it was;
        height always grows upward so a part keeps standing where it stood.
        Small parts get one bevel segment, which weighted normals shade as a
        rounded edge.
        """
        inward_to = Vector(inward_to or (0.0, 0.0, 0.0))
        for part in parts:
            centre, frame, half = self.box_fit(part)
            half = list(half)
            for axis in range(3):
                size = half[axis] * 2
                target = size * thicken if size < thin else size
                target = max(target, min_thickness)
                if target <= size + 1e-6:
                    continue
                grow_by = (target - size) / 2
                half[axis] = target / 2
                direction = frame.col[axis]
                if axis == 2:
                    centre = centre + direction * grow_by
                elif grow == "inward":
                    side = 1 if (centre - inward_to).dot(direction) > 0 else -1
                    centre = centre - direction * side * grow_by
            size = min(half) * 2
            bevel = radius if radius is not None else part_bevel(size)
            steps = segments if segments is not None else (2 if size >= 0.08 else 1)
            self.remove([part])
            faces = rounded_box(
                self.out, centre, frame, half, bevel, steps,
                sharp_sides=("-z",) if sharp_bottom else (),
            )
            self.paint(faces, [part])

    def retube(self, parts, min_radius=0.015, scale=1.0, sides=8, caps=("round", "round"),
               taper=True, cap_rings=2):
        for part in parts:
            start, end, r0, r1 = self.tube_fit(part)
            r0, r1 = max(r0 * scale, min_radius), max(r1 * scale, min_radius)
            if not taper:
                r0 = r1 = max(r0, r1)
            self.remove([part])
            faces = tube(self.out, start, end, r0, sides=sides, end_radius=r1, caps=caps, cap_rings=cap_rings)
            self.paint(faces, [part])

    def reblob(self, parts, sides=12, rings=8, scale=1.0, min_radius=0.0, yaw=0.0):
        """Rebuilds round parts as smooth ellipsoids filling their bounds."""
        frame = Matrix.Rotation(yaw, 3, "Z")
        inverse = frame.transposed()
        for part in parts:
            points = [inverse @ point for point in self.points(part)]
            low = Vector([min(p[axis] for p in points) for axis in range(3)])
            high = Vector([max(p[axis] for p in points) for axis in range(3)])
            centre = frame @ ((low + high) / 2)
            radii = [max((high[axis] - low[axis]) / 2 * scale, min_radius) for axis in range(3)]
            self.remove([part])
            faces = ellipsoid(self.out, centre, radii, sides=sides, rings=rings, frame=frame)
            self.paint(faces, [part])

    def recone(self, parts, sides=8, rings=4, scale=1.0, push=0.0):
        """Rebuilds a pointed cone (a pyramid) as a soft rounded spike.

        `push` moves it outward along its axis, as a fraction of its length.
        """
        for part in parts:
            faces = [self.src.faces[index] for index in part.faces]
            base = max(faces, key=lambda face: len(face.verts))
            base_centre = base.calc_center_median()
            base_ids = {vert.index for vert in base.verts}
            apex = next(
                self.src.verts[index].co
                for index in part.verts
                if index not in base_ids
            )
            axis = apex - base_centre
            length = axis.length
            base_centre = base_centre + axis * push
            radius = max((vert.co - base_centre).length for vert in base.verts) * scale
            profile = catmull_rom(
                [(0.0, radius), (length * 0.45, radius * 0.7), (length * 0.85, radius * 0.3), (length, 0.0)],
                rings + 2,
            )
            profile = [(0.0, 0.0)] + profile
            self.remove([part])
            new_faces = revolve(self.out, profile, sides, origin=base_centre, axis=axis)
            self.paint(new_faces, [part])

    def resweep(self, parts, radius, sides=8, closed=False, order=None, smooth=2, count=None):
        """Joins chained rod parts into one round tube along their centres."""
        if not parts:
            return
        ends = []
        for part in parts:
            start, end, _, _ = self.tube_fit(part)
            ends.append((start, end))
        if order == "centres":
            chain = [sum(self.points(part), Vector()) / len(part.verts) for part in parts]
        else:
            first_start, first_end = ends[0]
            if len(ends) > 1:
                nxt = ends[1]
                gap = lambda point: min((point - nxt[0]).length, (point - nxt[1]).length)
                if gap(first_start) < gap(first_end):
                    first_start, first_end = first_end, first_start
            chain = [first_start, first_end]
            remaining = ends[1:]
            while remaining:
                tail = chain[-1]
                best = min(
                    range(len(remaining)),
                    key=lambda i: min((remaining[i][0] - tail).length, (remaining[i][1] - tail).length),
                )
                a, b = remaining.pop(best)
                if (a - tail).length > (b - tail).length:
                    a, b = b, a
                chain.append(b)
        if smooth and len(chain) > 2:
            chain = smooth_polyline(chain, smooth, closed)
        if count and not closed:
            chain = resample_polyline(chain, count)
        self.remove(parts)
        faces = sweep(self.out, chain, radius, sides=sides, closed=closed)
        self.paint(faces, parts)

    def round_kept(self, parts, radius, segments=2, angle=35.0):
        """Bevels the sharp edges of parts kept in place."""
        verts = {self.out_verts[index] for part in parts for index in part.verts}
        verts = {vert for vert in verts if vert.is_valid}
        edges = [
            edge
            for edge in {edge for vert in verts for edge in vert.link_edges}
            if all(v in verts for v in edge.verts)
            and len(edge.link_faces) == 2
            and edge.calc_face_angle(0.0) > math.radians(angle)
        ]
        before = set(self.out.faces)
        if edges:
            bmesh.ops.bevel(
                self.out,
                geom=edges,
                offset=radius,
                offset_type="OFFSET",
                segments=segments,
                profile=0.5,
                affect="EDGES",
                clamp_overlap=True,
            )
        created = set(self.out.faces) - before
        faces = {face for vert in verts if vert.is_valid for face in vert.link_faces} | created
        self.paint(list(faces), parts)


def part_bevel(size):
    """Bevel radius for a part whose smallest side is `size` (GAME_ART table)."""
    if size < 0.15:
        return min(max(size * 0.3, 0.015), 0.03, size * 0.45)
    if size < 0.5:
        return 0.045
    return 0.07


def ring_revolve(bm, loop, sides, origin, axis):
    """Revolves a closed 2D loop of (height, radius): a tyre or a band."""
    axis, u, v = orthonormal(axis)
    origin = Vector(origin)
    rings = []
    for height, radius in loop:
        rings.append(
            [
                bm.verts.new(
                    origin
                    + axis * height
                    + (u * math.cos(math.tau * step / sides) + v * math.sin(math.tau * step / sides))
                    * radius
                )
                for step in range(sides)
            ]
        )
    faces = []
    for index, low in enumerate(rings):
        high = rings[(index + 1) % len(rings)]
        for step in range(sides):
            nxt = (step + 1) % sides
            faces.append(bm.faces.new((low[step], high[step], high[nxt], low[nxt])))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def smooth_polyline(points, iterations, closed):
    """Chaikin corner cutting; the ends of an open line stay put."""
    points = [Vector(point) for point in points]
    for _ in range(iterations):
        if closed:
            pairs = list(zip(points, points[1:] + points[:1]))
            result = []
            for a, b in pairs:
                result.extend((a.lerp(b, 0.25), a.lerp(b, 0.75)))
        else:
            pairs = list(zip(points, points[1:]))
            result = [points[0]]
            for index, (a, b) in enumerate(pairs):
                if index > 0:
                    result.append(a.lerp(b, 0.25))
                if index < len(pairs) - 1:
                    result.append(a.lerp(b, 0.75))
            result.append(points[-1])
        points = result
    return points


def resample_polyline(points, count):
    """`count` points evenly spaced along an open 3D polyline."""
    points = [Vector(point) for point in points]
    lengths = [0.0]
    for a, b in zip(points, points[1:]):
        lengths.append(lengths[-1] + (b - a).length)
    result = []
    for index in range(count):
        target = lengths[-1] * index / (count - 1)
        segment = next((i for i in range(1, len(lengths)) if lengths[i] >= target), len(lengths) - 1)
        span = lengths[segment] - lengths[segment - 1] or 1.0
        result.append(points[segment - 1].lerp(points[segment], (target - lengths[segment - 1]) / span))
    return result


def triangles(obj):
    return party_style.evaluated_triangles(obj)


def report(asset):
    total = 0
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        count = triangles(obj)
        total += count
        corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        low = [round(min(c[axis] for c in corners), 3) for axis in range(3)]
        high = [round(max(c[axis] for c in corners), 3) for axis in range(3)]
        print(f"  {obj.name}: {count} triangles, bounds {low}..{high}")
    print(f"{asset}: {total} triangles")


# ------------------------------------------------------------------ pumpkins
# Profiles from generate-harvest-pumpkins.py, as (height, radius) fractions.
SQUAT_PROFILE = [
    (0, 0.35), (0.07, 0.73), (0.22, 0.97), (0.46, 1), (0.69, 0.95),
    (0.86, 0.76), (0.95, 0.48), (0.92, 0.20), (0.89, 0.08),
]
GOURD_PROFILE = [
    (0, 0.3), (0.07, 0.76), (0.21, 1), (0.38, 0.98), (0.53, 0.72),
    (0.67, 0.40), (0.82, 0.30), (0.94, 0.32), (1, 0.21),
]
# Eight soft ribs, as in the approved release.
RIB_DEPTH = 0.14


def pumpkin_body(bm, radius, height, x, y, phase, gourd=False, z=0.0, sides=48, rings=13):
    """A smooth ribbed pumpkin or gourd resting at `z`."""
    control = GOURD_PROFILE if gourd else SQUAT_PROFILE
    resampled = catmull_rom(control, rings)
    profile = [(0.0, 0.0)] + [(t * height, r * radius) for t, r in resampled]
    top = control[-1][0] * height
    # The squat pumpkin keeps its recessed crown; the gourd neck is capped.
    profile.append((top - (0.02 * height if not gourd else 0.0), 0.0))

    def ribs(angle, _height):
        return 1 - RIB_DEPTH * (1 - math.cos(8 * (angle - phase))) / 2

    def bend(h):
        return (0.07 * (h / height) ** 3, 0.0, 0.0) if gourd else (0.0, 0.0, 0.0)

    return revolve(bm, profile, sides, origin=(x, y, z), radial=ribs, offset=bend, phase=phase)


def pumpkin_stem(bm, radius, height, x, y, gourd=False, z=0.0, sides=8):
    """A chunky curved stalk sitting in the crown.

    It ends at the same height as the original stalk, so the model keeps
    its declared height.
    """
    top = (GOURD_PROFILE if gourd else SQUAT_PROFILE)[-1][0] * height
    base_x = x + (0.07 if gourd else 0.0)
    stem_radius = max(radius * 0.11 * 1.35, 0.02)
    original_tip = top - 0.008 + (0.075 if gourd else height * 0.24)
    base = top - 0.025 * height
    length = original_tip - base
    profile = catmull_rom(
        [
            (0.0, stem_radius * 1.3),
            (length * 0.35, stem_radius),
            (length * 0.7, stem_radius * 0.85),
            (length - stem_radius * 0.3, stem_radius * 0.72),
        ],
        5,
    )
    # A rounded tip instead of a flat cut.
    profile += [(length - stem_radius * 0.08, stem_radius * 0.45), (length, 0.0)]

    def curve(h):
        bend = 0.045 * (max(h, 0.0) / length) ** 1.5
        return (bend, bend * 0.35, 0.0)

    return revolve(bm, profile, sides, origin=(base_x, y, z + base), offset=curve)


def rebuild_material_object(obj, build):
    """Replaces the whole mesh of a single-material object."""
    rebuilder = Rebuilder(obj)
    rebuilder.remove(rebuilder.parts)
    faces = build(rebuilder.out)
    rebuilder.paint(faces, [], material_index=0)
    rebuilder.finish()


PUMPKIN_SPECS = {
    # (radius, height, x, y, phase) from generate-harvest-pumpkins.py.
    "HarvestPumpkinSquat": [(0.35, 0.37, 0, 0, 0.12)],
    "HarvestPumpkinGourd": [(0.235, 0.47, 0, 0, 0.18)],
    "HarvestPumpkinGroup": [
        (0.245, 0.36, -0.17, 0.13, 0.12),
        (0.19, 0.265, 0.22, 0.055, 0.32),
        (0.17, 0.235, -0.055, -0.255, 0.0),
    ],
}


def restyle_pumpkin(asset):
    specs = PUMPKIN_SPECS[asset]
    gourd = asset.endswith("Gourd")
    # The group shows three pumpkins on one tile, so each is lighter.
    sides, rings = (48, 13) if len(specs) == 1 else (32, 11)

    def bodies(bm):
        faces = []
        for radius, height, x, y, phase in specs:
            faces += pumpkin_body(bm, radius, height, x, y, phase, gourd, sides=sides, rings=rings)
        return faces

    def stems(bm):
        faces = []
        for radius, height, x, y, _ in specs:
            faces += pumpkin_stem(bm, radius, height, x, y, gourd)
        return faces

    rebuild_material_object(bpy.data.objects[f"{asset}_Body"], bodies)
    rebuild_material_object(bpy.data.objects[f"{asset}_Stem"], stems)
    set_roughness("Material.HarvestPumpkin.Skin", GLOSS)
    set_roughness("Material.HarvestPumpkin.Stem", SATIN)


# ------------------------------------------------------------------ lanterns
LANTERN_EYES = [
    [(-0.19, 0.285), (-0.045, 0.285), (-0.115, 0.395)],
    [(0.045, 0.285), (0.19, 0.285), (0.115, 0.395)],
]
LANTERN_MOUTH = [
    (-0.195, 0.235), (-0.1, 0.205), (0, 0.19), (0.1, 0.205), (0.195, 0.235),
    (0.15, 0.13), (0, 0.105), (-0.15, 0.13),
]
WINK_EYE = [(0.045, 0.325), (0.11, 0.365), (0.20, 0.335), (0.17, 0.305), (0.11, 0.325), (0.065, 0.30)]
WINK_MOUTH = [
    (-0.19, 0.24), (-0.095, 0.21), (-0.075, 0.235), (-0.025, 0.22), (-0.04, 0.175),
    (0.095, 0.20), (0.195, 0.255), (0.15, 0.125), (0, 0.105), (-0.15, 0.14),
]


def temporary_object(name, bm):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def carve(body, cutters):
    """Applies boolean differences, as generate-pumpkin-lanterns.py does."""
    for cutter in cutters:
        modifier = body.modifiers.new("Carve", "BOOLEAN")
        modifier.operation = "DIFFERENCE"
        modifier.solver = "EXACT"
        modifier.object = cutter
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(body.evaluated_get(depsgraph))
    for cutter in cutters:
        bpy.data.objects.remove(cutter, do_unlink=True)
    return mesh


def face_cutter(name, points):
    bm = bmesh.new()
    count = len(points)
    low = [bm.verts.new((x, 0.03, z + 0.7 * (0.03 - 0.28))) for x, z in points]
    high = [bm.verts.new((x, 0.5, z + 0.7 * (0.5 - 0.28))) for x, z in points]
    faces = [bm.faces.new(list(reversed(low))), bm.faces.new(high)]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append(bm.faces.new((low[index], low[nxt], high[nxt], high[index])))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return temporary_object(name, bm)


class SurfaceNormals:
    """Smooth normals of a reference surface, looked up by position."""

    def __init__(self, bm):
        bm.normal_update()
        bm.faces.ensure_lookup_table()
        self.bm = bm
        self.tree = BVHTree.FromBMesh(bm)

    def distance(self, point):
        hit = self.tree.find_nearest(point)
        return hit[3] if hit[0] is not None else math.inf

    def normal(self, point):
        _, _, index, _ = self.tree.find_nearest(point)
        face = self.bm.faces[index]
        weights = poly_3d_calc([vert.co for vert in face.verts], point)
        normal = sum(
            (vert.normal * weight for vert, weight in zip(face.verts, weights)), Vector()
        )
        return normal.normalized()


def restyle_lantern(asset):
    """Rebuilds the carved lantern from a smooth pumpkin shell.

    The cavity and face openings are cut with the same booleans as
    generate-pumpkin-lanterns.py. Boolean cuts leave long thin triangles that
    shade badly, so the outer shell and the cavity take their normals from
    the uncut smooth surfaces and the carved walls stay flat.
    """
    wink = asset.endswith("Wink")
    radius, height, phase = 0.35, 0.49, 0.12
    turn = Matrix.Rotation(math.pi / 4, 4, "Z")

    outer = bmesh.new()
    pumpkin_body(outer, radius, height, 0, 0, phase, sides=48, rings=16)
    shell = temporary_object("LanternShell", outer.copy())
    inner = bmesh.new()
    ellipsoid(inner, (0, 0, 0.245), (0.285, 0.285, 0.205), sides=24, rings=12)
    cutters = [temporary_object("Cavity", inner.copy())]
    eyes = [LANTERN_EYES[0], WINK_EYE if wink else LANTERN_EYES[1]]
    mouth = WINK_MOUTH if wink else LANTERN_MOUTH
    mouth = [(x, z + 0.04) for x, z in mouth]
    for index, points in enumerate([*eyes, mouth]):
        cutters.append(face_cutter(f"FaceCut{index}", points))
    carved = carve(shell, cutters)
    bpy.data.objects.remove(shell, do_unlink=True)
    for reference in (outer, inner):
        reference.transform(turn)
    outer_surface = SurfaceNormals(outer)
    # The cavity is cut out, so its surface faces inward.
    for face in inner.faces:
        face.normal_flip()
    inner_surface = SurfaceNormals(inner)

    body = bpy.data.objects[f"{asset}_Body"]
    rebuilder = Rebuilder(body)
    rebuilder.remove(rebuilder.parts)
    source = bmesh.new()
    source.from_mesh(carved)
    bpy.data.meshes.remove(carved)
    source.transform(turn)
    mapping = {vert: rebuilder.out.verts.new(vert.co) for vert in source.verts}
    faces = []
    for face in source.faces:
        try:
            faces.append(rebuilder.out.faces.new([mapping[vert] for vert in face.verts]))
        except ValueError:
            pass
    source.free()
    rebuilder.paint(faces, [], material_index=0)
    rebuilder.finish()
    mesh = body.data
    for modifier in list(body.modifiers):
        body.modifiers.remove(modifier)
    normals = []
    for polygon in mesh.polygons:
        centre = polygon.center
        # Under the crown the cavity ceiling lies within a hair of the outer
        # surface, so a face takes the surface that also faces its way.
        surface = next(
            (
                reference
                for reference in (outer_surface, inner_surface)
                if reference.distance(centre) < 0.004
                and reference.normal(centre).dot(polygon.normal) > 0.2
            ),
            None,
        )
        for loop_index in polygon.loop_indices:
            if surface is None:
                normals.append(polygon.normal.copy())
            else:
                point = mesh.vertices[mesh.loops[loop_index].vertex_index].co
                normals.append(surface.normal(point))
    mesh.normals_split_custom_set(normals)
    outer.free()
    inner.free()

    stem = bpy.data.objects[f"{asset}_Stem"]

    def stem_faces(bm):
        faces = pumpkin_stem(bm, radius, height, 0, 0)
        verts = {vert for face in faces for vert in face.verts}
        bmesh.ops.transform(bm, matrix=turn, verts=list(verts))
        return faces

    rebuild_material_object(stem, stem_faces)

    glow = bpy.data.objects[f"{asset}_Glow"]
    glow_rebuilder = Rebuilder(glow)
    glow_rebuilder.smooth_kept(glow_rebuilder.parts)
    glow_rebuilder.finish()

    set_roughness("Material.PumpkinLantern.Skin", GLOSS)
    set_roughness("Material.PumpkinLantern.Stem", SATIN)
    set_roughness("Material.PumpkinLantern.Glow", SATIN)


# -------------------------------------------------------------------- crates
CRATE_PUMPKINS = [
    # (radius, height, x, y, cream) from generate-harvest-crates.py.
    (0.19, 0.34, -0.175, 0.06, False),
    (0.165, 0.30, 0.185, 0.105, True),
    (0.14, 0.265, 0.09, -0.19, False),
]
ORCHARD_FRUIT = [
    # (x, y, radius, height, pear) from generate-harvest-crates.py.
    (-0.205, -0.145, 0.135, 0.27, False),
    (0.065, -0.16, 0.14, 0.28, False),
    (0.22, 0.095, 0.125, 0.255, False),
    (-0.17, 0.135, 0.14, 0.385, True),
    (0.07, 0.085, 0.115, 0.36, True),
]
PEAR_PROFILE = [(0, 0.38), (0.10, 0.80), (0.28, 1), (0.48, 0.93), (0.66, 0.64), (0.83, 0.37), (0.96, 0.26), (1, 0.12)]
APPLE_PROFILE = [(0, 0.30), (0.10, 0.69), (0.30, 0.94), (0.57, 1), (0.80, 0.93), (0.96, 0.66), (0.90, 0.18)]
CRATE_FLOOR = 0.06


def orchard_fruit(bm, x, y, radius, height, pear, sides=16, rings=9):
    control = PEAR_PROFILE if pear else APPLE_PROFILE
    resampled = catmull_rom(control, rings)
    profile = [(0.0, 0.0)] + [(t * height, r * radius) for t, r in resampled]
    top = control[-1][0] * height
    profile.append((top + (0.004 if pear else -0.012), 0.0))

    def lobes(angle, _height):
        return 1 + 0.04 * math.cos(5 * angle)

    def bend(h):
        return (0.025 * (h / height) ** 2, 0.0, 0.0) if pear else (0.0, 0.0, 0.0)

    return revolve(bm, profile, sides, origin=(x, y, CRATE_FLOOR), radial=lobes, offset=bend)


def restyle_crate_timber(asset):
    for role in ("Timber", "Frame"):
        rebuilder = Rebuilder(bpy.data.objects[f"{asset}_{role}"])
        # Slats and handle strips get chunkier toward the inside, so the
        # crate keeps its footprint.
        rebuilder.rebox(rebuilder.parts, thicken=1.4, thin=0.059, min_thickness=0.035, grow="inward")
        rebuilder.finish()
        set_roughness(f"Material.{asset}.{role}", SATIN)


def restyle_harvest_crate():
    asset = "HarvestCrate"
    restyle_crate_timber(asset)

    def produce(cream):
        def build(bm):
            faces = []
            for index, (radius, height, x, y, is_cream) in enumerate(CRATE_PUMPKINS):
                if is_cream == cream:
                    faces += pumpkin_body(bm, radius, height, x, y, index * 0.19, z=CRATE_FLOOR, sides=32, rings=9)
            return faces
        return build

    def stems(bm):
        faces = []
        for radius, height, x, y, _ in CRATE_PUMPKINS:
            faces += pumpkin_stem(bm, radius, height, x, y, z=CRATE_FLOOR)
        return faces

    rebuild_material_object(bpy.data.objects[f"{asset}_ProducePrimary"], produce(False))
    rebuild_material_object(bpy.data.objects[f"{asset}_ProduceSecondary"], produce(True))
    rebuild_material_object(bpy.data.objects[f"{asset}_Stems"], stems)
    set_roughness(f"Material.{asset}.ProducePrimary", GLOSS)
    set_roughness(f"Material.{asset}.ProduceSecondary", GLOSS)
    set_roughness(f"Material.{asset}.Stems", SATIN)


def restyle_orchard_crate():
    asset = "HarvestCrateOrchard"
    restyle_crate_timber(asset)

    def produce(pear):
        def build(bm):
            faces = []
            for x, y, radius, height, is_pear in ORCHARD_FRUIT:
                if is_pear == pear:
                    faces += orchard_fruit(bm, x, y, radius, height, pear)
            return faces
        return build

    rebuild_material_object(bpy.data.objects[f"{asset}_ProducePrimary"], produce(False))
    rebuild_material_object(bpy.data.objects[f"{asset}_ProduceSecondary"], produce(True))
    stems = Rebuilder(bpy.data.objects[f"{asset}_Stems"])
    rods = [part for part in stems.parts if len(part.verts) > 8]
    leaves = [part for part in stems.parts if len(part.verts) <= 8]
    stems.retube(rods, min_radius=0.016, sides=6, caps=("flat", "round"))
    # Paper-thin leaves become small soft lozenges.
    stems.reblob(leaves, sides=8, rings=4, min_radius=0.015)
    stems.finish()
    set_roughness(f"Material.{asset}.ProducePrimary", GLOSS)
    set_roughness(f"Material.{asset}.ProduceSecondary", GLOSS)
    set_roughness(f"Material.{asset}.Stems", SATIN)


# --------------------------------------------------------------- wheelbarrow
WHEELBARROW_PUMPKINS = [
    # (x, y, radius, height, cream) from generate-harvest-wheelbarrow.py.
    (-0.22, 0.035, 0.23, 0.39, False),
    (0.22, 0.10, 0.175, 0.31, True),
    (0.13, -0.185, 0.155, 0.275, False),
]
WHEELBARROW_TILT = Matrix.Translation(Vector((0, 0, 0.415))) @ Matrix.Rotation(-0.105, 4, "Y")
WHEEL_X, WHEEL_Z, WHEEL_RADIUS = -0.69, 0.24, 0.24


def restyle_wheelbarrow():
    name = "HarvestWheelbarrow"
    objects = {role: bpy.data.objects[f"{name}_{role}"] for role in ("Timber", "Frame", "Hardware", "Pumpkins", "Cream", "Stems")}

    timber = Rebuilder(objects["Timber"])
    hub = [part for part in timber.parts if len(part.verts) > 30 and len(part.verts) != 24]
    timber.retube(hub, min_radius=0.0, sides=16, caps=("flat", "flat"))
    timber.rebox([part for part in timber.parts if part not in hub], thicken=1.35, thin=0.06, min_thickness=0.035, grow="inward")
    timber.finish()

    frame = Rebuilder(objects["Frame"])
    spokes = [part for part in frame.parts if len(part.verts) not in (8, 24)]
    frame.retube(spokes, min_radius=0.03, sides=8, caps=("flat", "flat"))
    frame.rebox([part for part in frame.parts if part not in spokes], thicken=1.25, thin=0.09, min_thickness=0.035, grow="inward")
    frame.finish()

    hardware = Rebuilder(objects["Hardware"])
    band = [part for part in hardware.parts if len(part.verts) >= 64]
    axle = [part for part in hardware.parts if part not in band]
    hardware.retube(axle, min_radius=0.026, sides=10, caps=("round", "round"))
    hardware.remove(band)
    tyre = fillet_closed(
        [(-0.052, 0.178), (0.052, 0.178), (0.052, WHEEL_RADIUS), (-0.052, WHEEL_RADIUS)],
        0.022,
        steps=1,
    )
    faces = ring_revolve(hardware.out, tyre, 20, (WHEEL_X, 0, WHEEL_Z), Vector((0, 1, 0)))
    hardware.paint(faces, band)
    hardware.finish()

    def load(cream):
        def build(bm):
            faces = []
            for index, (x, y, radius, height, is_cream) in enumerate(WHEELBARROW_PUMPKINS):
                if is_cream == cream:
                    faces += pumpkin_body(bm, radius, height, x, y, index * 0.2, z=0.055, sides=32, rings=11)
            verts = list({vert for face in faces for vert in face.verts})
            bmesh.ops.transform(bm, matrix=WHEELBARROW_TILT, verts=verts)
            return faces
        return build

    def stems(bm):
        faces = []
        for x, y, radius, height, _ in WHEELBARROW_PUMPKINS:
            faces += pumpkin_stem(bm, radius, height, x, y, z=0.055)
        verts = list({vert for face in faces for vert in face.verts})
        bmesh.ops.transform(bm, matrix=WHEELBARROW_TILT, verts=verts)
        return faces

    rebuild_material_object(objects["Pumpkins"], load(False))
    rebuild_material_object(objects["Cream"], load(True))
    rebuild_material_object(objects["Stems"], stems)
    for role, roughness in (
        ("Timber", SATIN), ("Frame", SATIN), ("Hardware", STEEL),
        ("Pumpkins", GLOSS), ("Cream", GLOSS), ("Stems", SATIN),
    ):
        set_roughness(f"Material.{name}.{role}", roughness)


# ------------------------------------------------------------------ woodland
def lathe(bm, x, y, profile, sides, corner=0.0, smooth=0, offset=None, steps=1):
    """Revolves a (radius, height) profile, as the tea.lathe helper does.

    `corner` rounds every inner corner like a bevel; `smooth` instead runs a
    spline through the points with that many rings, for organic shapes.
    """
    points = [(z, r) for r, z in profile]
    if smooth:
        points = catmull_rom(points, smooth)
    elif corner:
        points = fillet(points, corner, steps)
    return revolve(bm, points, sides, origin=(x, y, 0.0), offset=offset)


def leaf_bed(rebuilder):
    part = rebuilder.find("LeafBed")
    rebuilder.remove(part)
    faces = lathe(
        rebuilder.out, 0, 0,
        [(0, 0), (0.31, 0), (0.39, 0.012), (0.34, 0.027), (0, 0.031)],
        32, corner=0.02,
    )
    rebuilder.paint(faces, part)


ACORNS = [(-0.16, -0.11, 0.10), (0.12, -0.12, 0.115), (0, 0.13, 0.13)]
CONKERS = [(-0.17, -0.12, 0.105), (0.11, -0.15, 0.12), (-0.02, 0.13, 0.13), (0.20, 0.09, 0.08)]
BASKET_SIDES = 24
BASKET_MUSHROOMS = [(-0.13, -0.10, 0.34, 0.115), (0.13, -0.09, 0.38, 0.12), (0, 0.13, 0.43, 0.13)]


def restyle_acorns():
    rebuilder = Rebuilder(bpy.data.objects["WoodlandAcorns_Arrangement"])
    leaf_bed(rebuilder)
    for index, (x, y, r) in enumerate(ACORNS):
        nut = rebuilder.find(f"Acorn{index}Nut")
        cap = rebuilder.find(f"Acorn{index}Cap")
        rebuilder.remove(nut + cap)
        faces = lathe(
            rebuilder.out, x, y,
            [(0, 0.03), (r * 0.6, 0.045), (r, 0.12), (r * 0.95, 0.21), (0, 0.22)],
            20, smooth=9,
        )
        rebuilder.paint(faces, nut)
        faces = lathe(
            rebuilder.out, x, y,
            [(0, 0.20), (r * 1.08, 0.20), (r * 1.12, 0.235), (r * 0.60, 0.275), (0, 0.285)],
            20, corner=0.018,
        )
        rebuilder.paint(faces, cap)
        rebuilder.retube(rebuilder.find(f"Acorn{index}Stem"), min_radius=0.018, sides=8, caps=("flat", "round"))
    rebuilder.finish()
    set_roughness("Material.Woodland.Arrangement", SATIN)


def restyle_conkers():
    rebuilder = Rebuilder(bpy.data.objects["WoodlandConkers_Arrangement"])
    leaf_bed(rebuilder)
    for index, (x, y, r) in enumerate(CONKERS):
        part = rebuilder.find(f"Conker{index}")
        rebuilder.remove(part)
        faces = lathe(
            rebuilder.out, x, y,
            [(0, 0.03), (r * 0.72, 0.045), (r, 0.10), (r * 0.8, 0.19), (r * 0.40, 0.22), (0, 0.223)],
            22, smooth=10,
        )
        rebuilder.paint(faces, part)
    # The open husks were single flat wedges; they become chunky wedges.
    for index, x in enumerate((-0.21, 0.23)):
        part = rebuilder.find(f"OpenHusk{index}")
        outline = [(x - 0.075, 0.18, 0.025), (x + 0.075, 0.18, 0.025), (x + 0.07, 0.28, 0.04), (x, 0.28, 0.17), (x - 0.07, 0.28, 0.04)]
        normal = (Vector(outline[1]) - Vector(outline[0])).cross(Vector(outline[3]) - Vector(outline[0])).normalized()
        rebuilder.remove(part)
        faces = prism(rebuilder.out, outline, normal, -0.016, 0.016, 0.012, segments=2)
        rebuilder.paint(faces, part)
    rebuilder.finish()
    set_roughness("Material.Woodland.Arrangement", SATIN)


def restyle_mushroom_basket():
    rebuilder = Rebuilder(bpy.data.objects["WoodlandMushroomBasket_Arrangement"])
    basket = rebuilder.find("Basket")
    rebuilder.remove(basket)
    faces = lathe(
        rebuilder.out, 0, 0,
        [(0, 0), (0.24, 0), (0.29, 0.04), (0.34, 0.23), (0.34, 0.27), (0.30, 0.27), (0.27, 0.08), (0, 0.08)],
        BASKET_SIDES, corner=0.018,
    )
    rebuilder.paint(faces, basket)
    for index, z in enumerate((0.075, 0.145, 0.215)):
        band = rebuilder.find(f"BasketBand{index}")
        radius = 0.29 + (z - 0.04) * 0.05 / 0.19
        rebuilder.remove(band)
        # Only the two outer corners show; the inner ones sit in the wall.
        loop = [(z, radius - 0.006)]
        loop += fillet([(z, radius - 0.006), (z, radius + 0.014), (z + 0.032, radius + 0.016), (z + 0.032, radius - 0.006)], 0.008, steps=0)[1:-1]
        faces = ring_revolve(rebuilder.out, loop, BASKET_SIDES, (0, 0, 0), Z)
        rebuilder.paint(faces, band)
    for index, (x, y, h, r) in enumerate(BASKET_MUSHROOMS):
        stem = rebuilder.find(f"Mushroom{index}Stem")
        cap = rebuilder.find(f"Mushroom{index}Cap")
        rebuilder.remove(stem + cap)
        faces = lathe(
            rebuilder.out, x, y,
            [(0.042, 0.08), (0.044, h - 0.07), (0, h - 0.06)],
            12, corner=0.01,
        )
        rebuilder.paint(faces, stem)
        faces = lathe(
            rebuilder.out, x, y,
            [(0, h - 0.065), (r, h - 0.065), (r * 0.86, h - 0.015), (r * 0.45, h + 0.025), (0, h + 0.035)],
            14, corner=0.02,
        )
        rebuilder.paint(faces, cap)
    handle = sorted(rebuilder.find("BasketHandle*"), key=lambda part: int(part.name[len("BasketHandle"):]))
    rebuilder.resweep(handle, 0.028, sides=8, smooth=1, count=16)
    rebuilder.finish()
    set_roughness("Material.Woodland.Arrangement", SATIN)


WOODLAND_MUSHROOMS = [
    # (x, y, stem, radius, dome) from generate-woodland-mushrooms.py.
    (-0.105, 0.015, 0.245, 0.19, 0.135),
    (0.205, 0.12, 0.17, 0.155, 0.11),
    (-0.25, -0.205, 0.105, 0.14, 0.09),
    (0.10, -0.205, 0.085, 0.125, 0.085),
    (-0.07, 0.285, 0.11, 0.12, 0.095),
]


def restyle_woodland_mushrooms():
    rebuilder = Rebuilder(bpy.data.objects["WoodlandMushrooms_Cluster"])
    for index, (x, y, stem, radius, dome) in enumerate(WOODLAND_MUSHROOMS, 1):
        lean = 0.045 if index % 2 else -0.04
        stem_part = rebuilder.find(f"Stem_{index}")
        cap_part = rebuilder.find(f"Cap_{index}")
        rebuilder.remove(stem_part + cap_part)
        # Stems are a little chunkier; the top hides inside the cap.
        thick = 1.2
        profile = [
            (0.0, 0.0),
            (0.0, radius * 0.25 * thick),
            (0.008, radius * 0.29 * thick),
            (0.025, radius * 0.30 * thick),
            (stem * 0.65, radius * 0.22 * thick),
            (stem + 0.018, radius * 0.24 * thick),
            (stem + 0.018, 0.0),
        ]
        faces = revolve(rebuilder.out, profile, 10, origin=(x, y, 0), offset=lambda h, lean=lean: (lean * h, 0, 0))
        rebuilder.paint(faces, stem_part)
        dome_points = catmull_rom(
            [
                (stem, radius * 0.94),
                (stem + dome * 0.18, radius),
                (stem + dome * 0.62, radius * 0.78),
                (stem + dome * 0.92, radius * 0.40),
                (stem + dome, radius * 0.12),
            ],
            6,
        )
        profile = [(stem - 0.012, 0.0), (stem - 0.012, radius * 0.22), (stem - 0.006, radius * 0.8)]
        profile += dome_points + [(stem + dome + 0.004, 0.0)]
        faces = revolve(rebuilder.out, profile, 16, origin=(x + lean * stem, y, 0))
        rebuilder.paint(faces, cap_part)
    rebuilder.finish()
    set_roughness("Material.WoodlandMushrooms.Palette", SATIN)


# --------------------------------------------------------- Halloween accents
GHOST_TURN = Matrix.Rotation(math.pi / 4, 4, "Z")
# (height, half width, half depth) of the sheet, from generate-halloween-accents.py.
GHOST_SHEET = [(0.29, 0.26, 0.17), (0.43, 0.24, 0.16), (0.59, 0.34, 0.17), (0.77, 0.19, 0.135), (0.89, 0.125, 0.095), (0.955, 0.025, 0.025)]


def restyle_ghost():
    rebuilder = Rebuilder(bpy.data.objects["FriendlyGhost_Arrangement"])
    rebuilder.rebox(rebuilder.find("FootX", "FootY"))
    # A sturdier stand: the pole and arm were 0.065 thick.
    rebuilder.rebox(rebuilder.find("Pole", "CrossArm"), thicken=1.35, thin=0.07)
    sheet = rebuilder.find("Sheet")
    rebuilder.remove(sheet)
    # Six samples per fold keep the eight folds and the hem smooth.
    sides, count = 48, 10
    heights = catmull_rom([(z, rx) for z, rx, _ in GHOST_SHEET], count)
    depths = catmull_rom([(z, ry) for z, _, ry in GHOST_SHEET], count)
    rings = []
    for index, ((z, rx), (_, ry)) in enumerate(zip(heights, depths)):
        ring = []
        for step in range(sides):
            angle = math.tau * step / sides
            # Eight soft folds and a rippled hem, as smooth waves.
            fold = 1 - 0.07 * (0.5 - 0.5 * math.cos(8 * angle))
            ripple = 0.028 * (0.5 + 0.5 * math.cos(4 * angle)) if index == 0 else 0.0
            ring.append(GHOST_TURN @ Vector((rx * math.cos(angle) * fold, ry * math.sin(angle) * fold, z + ripple)))
        rings.append(ring)
    rings.append([GHOST_TURN @ Vector((0, 0, GHOST_SHEET[-1][0] + 0.012))])
    faces = loft(rebuilder.out, rings)
    # One cloth colour: the source striped the sheet with three close tones,
    # which reads as painted shading once the sheet is smooth.
    rebuilder.paint(faces, sheet, colour=rebuilder.dominant_colour(sheet))
    # Bigger, rounder eyes and a chunky smile read at garden zoom.
    rebuilder.reblob(rebuilder.find("Eye*"), sides=10, rings=6, scale=1.3, min_radius=0.016, yaw=math.pi / 4)
    smile = sorted(rebuilder.find("Smile*"), key=lambda part: part.name)
    rebuilder.resweep(smile, 0.015, sides=8, smooth=1)
    rebuilder.finish()
    set_roughness("Material.FriendlyGhost.Palette", 0.75)


WEB_CENTRE = Vector((-0.25, 0.035, 0.865))
WEB_RADIUS = 0.53
# The web billows toward the front like a sail, so it still reads beside the
# post when a rotation shows its plane edge-on. Strands along the post and
# beam stay put; the middle of the free edge moves most.
WEB_BILLOW = 0.1


def web_point(radius, angle):
    """A point of the web at `radius` from its corner, before the turn."""
    lift = WEB_BILLOW * min(radius / WEB_RADIUS, 1.0) ** 1.2 * math.sin(2 * angle)
    return WEB_CENTRE + Vector((math.cos(angle) * radius, lift, -math.sin(angle) * radius))


def restyle_cobweb():
    rebuilder = Rebuilder(bpy.data.objects["SupportedCobweb_Arrangement"])
    rebuilder.rebox(rebuilder.find("Foot"))
    rebuilder.rebox(rebuilder.find("Post", "TopBeam"), thicken=1.3, thin=0.09)
    # Strands were 0.017 thick; they become round 0.03 cords. The two along
    # the frame stay straight; the inner three follow the billow.
    for index in range(5):
        spoke = rebuilder.find(f"Spoke{index}")
        if index in (0, 4):
            rebuilder.retube(spoke, min_radius=0.015, sides=8, taper=False)
            continue
        angle = math.pi / 2 * index / 4
        points = [GHOST_TURN @ web_point(WEB_RADIUS * step / 5, angle) for step in range(6)]
        rebuilder.remove(spoke)
        # Strand ends meet other strands, so one cap ring is enough.
        rebuilder.paint(sweep(rebuilder.out, points, 0.015, sides=8, end_rings=1), spoke)
    # Each ring of the web sags toward the corner between two spokes, using
    # the layout of generate-halloween-accents.py.
    centre = WEB_CENTRE
    for ring, radius in enumerate((0.17, 0.34, WEB_RADIUS)):
        arcs = rebuilder.find(f"Arc{ring}_*")
        points = []
        for index in range(5):
            angle = math.pi / 2 * index / 4
            point = centre + Vector((math.cos(angle) * radius, 0, -math.sin(angle) * radius))
            if index:
                chord = (previous + point) / 2
                points.append(chord + (centre - chord).normalized() * 0.022 * (radius / 0.53) ** 0.5)
            points.append(point)
            previous = point
        # Three rounds of corner cutting keep the tube from folding where a
        # sagging ring meets a spoke; resampling keeps the count low.
        points = resample_polyline(smooth_polyline(points, 3, False), 13 + 6 * ring)
        points = [
            GHOST_TURN @ web_point(
                math.hypot(point.x - centre.x, point.z - centre.z),
                math.atan2(centre.z - point.z, point.x - centre.x),
            )
            for point in points
        ]
        rebuilder.remove(arcs)
        faces = sweep(rebuilder.out, points, 0.015, sides=8, end_rings=1)
        rebuilder.paint(faces, arcs)
    rebuilder.finish()
    set_roughness("Material.SupportedCobweb.Palette", SATIN)


# ------------------------------------------------------------------- brazier
def restyle_brazier():
    metal = Rebuilder(bpy.data.objects["GardenBrazier_Metal"])
    bowl = metal.find("SteelBowl")
    metal.remove(bowl)
    faces = lathe(
        metal.out, 0, 0,
        [(0, 0.22), (0.15, 0.22), (0.28, 0.31), (0.34, 0.45), (0.34, 0.485), (0.30, 0.485), (0.265, 0.335), (0, 0.305)],
        32, corner=0.02,
    )
    metal.paint(faces, bowl)
    metal.rebox(metal.find("Leg*"), thicken=1.3, thin=0.07)
    metal.rebox(metal.find("Foot*"))
    for side in (-1, 1):
        handle = metal.find(f"Handle{side}_*")
        metal.remove(handle)
        points = [
            Vector((side * (0.377 + 0.045 * math.cos(math.tau * i / 16)), 0, 0.412 + 0.045 * math.sin(math.tau * i / 16)))
            for i in range(16)
        ]
        faces = sweep(metal.out, points, 0.016, sides=8, closed=True)
        metal.paint(faces, handle)
    metal.finish()
    embers = Rebuilder(bpy.data.objects["GardenBrazier_Embers"])
    embers.rebox(embers.parts, radius=0.022, segments=2)
    embers.finish()
    set_roughness("Material.GardenBrazier.Metal", STEEL)
    # Charred billets are wood, so satin.
    set_roughness("Material.GardenBrazier.Embers", SATIN)


# ---------------------------------------------------------------------- cart
CART_SHIFT = -0.115


def restyle_cart():
    cart = Rebuilder(bpy.data.objects["ChestnutRoastingCart_Cart"])
    cart.rebox(cart.find("CartBody", "ServingTop"))
    cart.rebox(cart.find("SidePlank"), min_thickness=0.05, grow="inward")
    cart.rebox(cart.find("SupportLeg"), min_thickness=0.09)
    cart.rebox(cart.find("HandleRail"), min_thickness=0.07, grow="inward")
    cart.rebox(cart.find("HandleGrip"), min_thickness=0.075)
    cart.rebox(cart.find("SignPost"), min_thickness=0.055)
    # The lettering is painted onto both faces of the board, so the board
    # keeps its thickness.
    cart.rebox(cart.find("SignBoard"))
    for index, x in enumerate((-0.35, -0.19, -0.03, 0.13)):
        flag = [part for part in cart.find("Bunting") if abs(cart.bounds([part])[0].x - (x - 0.055 + CART_SHIFT)) < 0.01]
        outline = [(x - 0.055 + CART_SHIFT, 0.235, 1.19), (x + 0.055 + CART_SHIFT, 0.235, 1.19), (x + CART_SHIFT, 0.235, 1.09)]
        cart.remove(flag)
        faces = prism(cart.out, outline, Vector((0, 1, 0)), -0.015, 0.015, 0.01, segments=2)
        cart.paint(faces, flag)
    cones = cart.find("PaperCone")
    for index, y in enumerate((-0.17, 0.12)):
        cone = [part for part in cones if abs((sum(cart.bounds([part]), Vector()) / 2).y - y) < 0.05]
        cart.remove(cone)
        faces = lathe(
            cart.out, 0.43 + CART_SHIFT, y,
            [(0.014, 0.845), (0.11, 1.01), (0.096, 1.02), (0.06, 0.96), (0, 0.96)],
            16, corner=0.01,
        )
        cart.paint(faces, cone)
    cart.reblob(cart.find("Serving*Nut*"), sides=10, rings=6, scale=1.08)
    cart.finish()

    roaster = Rebuilder(bpy.data.objects["ChestnutRoastingCart_Roaster"])
    roaster.retube(roaster.find("Wheel"), min_radius=0.0, sides=24, caps=("flat", "flat"))
    roaster.retube(roaster.find("WheelHub"), min_radius=0.0, sides=12, caps=("flat", "flat"))
    roaster.rebox(roaster.find("FireDoor"), min_thickness=0.035, grow="inward")
    roaster.rebox(roaster.find("DoorHandle"), min_thickness=0.03)
    pan = roaster.find("RoastingPan")
    roaster.remove(pan)
    faces = lathe(
        roaster.out, -0.16 + CART_SHIFT, 0,
        [(0, 0.838), (0.235, 0.838), (0.285, 0.872), (0.285, 0.93), (0.253, 0.94), (0.235, 0.886), (0, 0.886)],
        24, corner=0.012,
    )
    roaster.paint(faces, pan)
    roaster.reblob(roaster.find("RoastingNut*"), sides=10, rings=6, scale=1.08)
    roaster.finish()
    set_roughness("Material.ChestnutRoastingCart.WoodPaper", SATIN)
    set_roughness("Material.ChestnutRoastingCart.Roaster", GLOSS)


# ------------------------------------------------------------------ hedgehog
def smoothstep(low, high, value):
    t = min(1.0, max(0.0, (value - low) / (high - low)))
    return t * t * (3 - 2 * t)


def spiny_mantle(bm, centre, radii, sides=20, rings=12, spike=0.034):
    """One soft spiky coat: an ellipsoid whose back grows soft spikes.

    Every other vertex of every other ring, staggered, is pulled out and
    swept up and toward the tail (-Y), so smooth shading turns each into a
    soft spike. Spikes fade out toward the face (+Y), the belly and the very
    tail, so the coat stays inside the hedgehog's bounds.
    """
    faces = ellipsoid(bm, (0, 0, 0), (1, 1, 1), sides=sides, rings=rings)
    verts = {vert for face in faces for vert in face.verts}
    centre = Vector(centre)
    for vert in verts:
        d = vert.co.normalized()
        ring = round(math.acos(max(-1.0, min(1.0, -d.z))) / (math.pi / rings))
        side = round(math.atan2(d.y, d.x) / (math.tau / sides)) % sides
        point = Vector((d.x * radii[0], d.y * radii[1], d.z * radii[2]))
        weight = smoothstep(-0.1, 0.35, d.z) * (1 - smoothstep(0.25, 0.6, d.y)) * smoothstep(-0.95, -0.55, d.y)
        if ring % 2 == 0 and (side + ring // 2) % 2 == 0 and weight > 0:
            normal = Vector((d.x / radii[0], d.y / radii[1], d.z / radii[2])).normalized()
            direction = normal + Vector((0, -0.5, 0.25))
            direction.x *= 0.3
            point += direction.normalized() * spike * weight
        vert.co = centre + point
    return faces


def restyle_hedgehog():
    body = Rebuilder(bpy.data.objects["Hedgehog_Body"])
    torso = body.find("Body")
    low, high = body.bounds(torso)
    centre, half = (low + high) / 2, (high - low) / 2
    body.remove(torso)
    # A slimmer body so the coat covers its back and sides.
    faces = ellipsoid(body.out, centre, (half.x * 0.9, half.y, half.z * 0.92), sides=16, rings=10)
    body.paint(faces, torso)
    # The thirteen scattered cones become one soft spiky coat over the back,
    # as GAME_ART prefers one soft form over a cluster.
    spines = body.find("Spines*")
    body.remove(spines)
    faces = spiny_mantle(body.out, centre + Vector((0, -0.008, 0.008)), (half.x * 0.98, half.y * 0.93, half.z * 0.88))
    body.paint(faces, spines, colour=Vector((1, 1, 1, 1)))
    body.finish()
    head = Rebuilder(bpy.data.objects["Hedgehog_Head"])
    head.reblob(head.find("Face"), sides=16, rings=10)
    head.reblob(head.find("Nose"), sides=10, rings=6, scale=1.15)
    head.reblob(head.find("Eye*"), sides=8, rings=6, scale=1.2, min_radius=0.015)
    head.reblob(head.find("Ear*"), sides=10, rings=6, scale=1.1)
    head.finish()
    for index in range(4):
        foot = Rebuilder(bpy.data.objects[f"Hedgehog_Foot{index}"])
        foot.reblob(foot.parts, sides=10, rings=6)
        foot.finish()
    set_roughness("Material.Hedgehog.Palette", 0.75)


def restyle_shelter():
    rebuilder = Rebuilder(bpy.data.objects["HedgehogShelter_Arrangement"])
    roof = rebuilder.find("ArchedRoof")
    rebuilder.remove(roof)
    steps = 16
    outline = [(0.4 * math.cos(math.pi * i / steps), 0, 0.18 + 0.3 * math.sin(math.pi * i / steps)) for i in range(steps + 1)]
    outline += [(0.32 * math.cos(math.pi * i / steps), 0, 0.18 + 0.22 * math.sin(math.pi * i / steps)) for i in range(steps, -1, -1)]
    faces = prism(rebuilder.out, outline, Vector((0, 1, 0)), -0.37, 0.37, 0.025, segments=2)
    rebuilder.paint(faces, roof)
    rebuilder.rebox(rebuilder.find("Side*", "Back"))
    bedding = rebuilder.find("Bedding")
    rebuilder.remove(bedding)
    faces = lathe(rebuilder.out, 0, 0, [(0, 0.004), (0.25, 0.004), (0.27, 0.018), (0, 0.026)], 24, corner=0.01)
    rebuilder.paint(faces, bedding)
    rebuilder.finish()
    set_roughness("Material.HedgehogShelter.Palette", SATIN)


# ----------------------------------------------------------------- scarecrow
def hat_ring(cx, z, rx, ry, curl, sides, shift):
    """One tilted elliptical ring, as hat_ring in generate-garden-scarecrow.py."""
    if rx < 1e-6:
        return [Vector((cx, 0, z - shift))]
    return [
        Vector((
            cx + rx * math.cos(math.tau * i / sides),
            ry * math.sin(math.tau * i / sides),
            z + 0.035 * math.cos(math.tau * i / sides) + curl * max(0.0, math.cos(math.tau * i / sides)) - shift,
        ))
        for i in range(sides)
    ]


def restyle_scarecrow():
    objects = {role: bpy.data.objects[f"GardenScarecrow_{role}"] for role in ("Timber", "Straw", "Linen", "Shirt", "Patch", "Face")}
    linen = Rebuilder(objects["Linen"])
    head = max(linen.parts, key=lambda part: (lambda b: (b[1] - b[0]).length)(linen.bounds([part])))
    low, high = linen.bounds([head])
    shift = 1.14 - (low.z + high.z) / 2
    linen.reblob([head], sides=18, rings=12)
    buttons = [part for part in linen.parts if part is not head and len(part.verts) == 42]
    linen.reblob(buttons, sides=8, rings=5, min_radius=0.016)
    linen.rebox([part for part in linen.parts if part is not head and part not in buttons], radius=0.018)
    linen.finish()

    timber = Rebuilder(objects["Timber"])
    poles = [part for part in timber.parts if len(part.verts) == 48]
    sticks = [part for part in timber.parts if len(part.verts) != 48]
    stake = max(poles, key=lambda part: timber.bounds([part])[1].z - timber.bounds([part])[0].z)
    timber.retube([stake], min_radius=0.045, sides=12, caps=("flat", "round"), taper=False)
    timber.retube([part for part in poles if part is not stake], min_radius=0.034, sides=10, taper=False)
    # Arms and the forked fingers were 0.03 and 0.018 thick.
    arms = [part for part in sticks if max(timber.bounds([part])[1] - timber.bounds([part])[0]) > 0.12]
    timber.retube(arms, min_radius=0.022, sides=8, taper=False)
    timber.retube([part for part in sticks if part not in arms], min_radius=0.016, sides=8, taper=False)
    timber.finish()

    straw = Rebuilder(objects["Straw"])
    straws = [part for part in straw.parts if len(part.verts) == 30]
    # Thin straws need one cap ring; this keeps the prop near the 1x1 budget.
    straw.retube(straws, min_radius=0.016, sides=6, taper=False, cap_rings=1)
    brim = [part for part in straw.parts if len(part.verts) == 24]
    crown = [part for part in straw.parts if len(part.verts) == 36]
    straw.remove(brim + crown)
    # A thicker brim with a rounded edge.
    slab = [(-0.008, 0.0), (-0.008, 0.9), (-0.001, 0.975), (0.008, 1.0), (0.017, 0.975), (0.024, 0.9), (0.024, 0.0)]
    rings = [hat_ring(-0.045, 1.25 + dz, 0.245 * f, 0.205 * f, 0.025, 28, shift) for dz, f in slab]
    straw.paint(loft(straw.out, rings), brim)
    crown_rings = [(-0.045, 1.267, 0.142, 0.122), (-0.064, 1.365, 0.112, 0.102), (-0.093, 1.397, 0.071, 0.071)]
    xs = catmull_rom([(z, cx) for cx, z, _, _ in crown_rings], 6)
    rxs = catmull_rom([(z, rx) for _, z, rx, _ in crown_rings], 6)
    rys = catmull_rom([(z, ry) for _, z, _, ry in crown_rings], 6)
    rings = [hat_ring(cx, z, rx, ry, 0.0, 24, shift) for (z, cx), (_, rx), (_, ry) in zip(xs, rxs, rys)]
    rings.append(hat_ring(-0.1, 1.405, 0.0, 0.0, 0.0, 24, shift))
    straw.paint(loft(straw.out, rings), crown)
    straw.finish()

    patch = Rebuilder(objects["Patch"])
    band = [part for part in patch.parts if (lambda b: b[1].x - b[0].x)(patch.bounds([part])) > 0.2]
    patch.remove(band)
    rings = [
        hat_ring(-0.047, 1.272, 0.143 * 0.97, 0.123 * 0.97, 0.0, 24, shift),
        hat_ring(-0.048, 1.277, 0.143 * 1.05, 0.123 * 1.05, 0.0, 24, shift),
        hat_ring(-0.052, 1.303, 0.135 * 1.06, 0.118 * 1.06, 0.0, 24, shift),
        hat_ring(-0.053, 1.308, 0.135 * 0.97, 0.118 * 0.97, 0.0, 24, shift),
    ]
    patch.paint(loft(patch.out, rings), band)
    patch.rebox([part for part in patch.parts if part not in band], min_thickness=0.03, radius=0.012)
    patch.finish()

    shirt = Rebuilder(objects["Shirt"])
    body = [part for part in shirt.parts if len(part.verts) == 16]
    shirt.round_kept(body, 0.035, segments=2, angle=30)
    shirt.rebox([part for part in shirt.parts if part not in body], radius=0.04)
    shirt.finish()

    face = Rebuilder(objects["Face"])
    eyes = [part for part in face.parts if len(part.verts) == 42]
    face.reblob(eyes, sides=8, rings=6, min_radius=0.015)
    smile = [part for part in face.parts if part not in eyes]
    smile.sort(key=lambda part: face.bounds([part])[0].x)
    face.resweep(smile, 0.015, sides=6, smooth=1)
    face.finish()

    # The thicker stake reaches a hair below the ground; lift the timber so
    # it stands exactly on it and the hat keeps its height.
    stake_mesh = objects["Timber"].data
    bottom = min(vert.co.z for vert in stake_mesh.vertices)
    stake_mesh.transform(Matrix.Translation((0, 0, -bottom)))
    stake_mesh.update()

    for role, roughness in (
        ("Timber", SATIN), ("Straw", MATTE), ("Linen", MATTE),
        ("Shirt", MATTE), ("Patch", MATTE), ("Face", SATIN),
    ):
        set_roughness(f"Material.GardenScarecrow.{role}", roughness)


RESTYLERS = {
    "HarvestPumpkinSquat": lambda: restyle_pumpkin("HarvestPumpkinSquat"),
    "HarvestPumpkinGourd": lambda: restyle_pumpkin("HarvestPumpkinGourd"),
    "HarvestPumpkinGroup": lambda: restyle_pumpkin("HarvestPumpkinGroup"),
    "PumpkinLanternSmile": lambda: restyle_lantern("PumpkinLanternSmile"),
    "PumpkinLanternWink": lambda: restyle_lantern("PumpkinLanternWink"),
    "HarvestCrate": restyle_harvest_crate,
    "HarvestCrateOrchard": restyle_orchard_crate,
    "HarvestWheelbarrow": restyle_wheelbarrow,
    "WoodlandAcorns": restyle_acorns,
    "WoodlandConkers": restyle_conkers,
    "WoodlandMushroomBasket": restyle_mushroom_basket,
    "WoodlandMushrooms": restyle_woodland_mushrooms,
    "FriendlyGhost": restyle_ghost,
    "SupportedCobweb": restyle_cobweb,
    "GardenBrazier": restyle_brazier,
    "ChestnutRoastingCart": restyle_cart,
    "Hedgehog": restyle_hedgehog,
    "HedgehogShelter": restyle_shelter,
    "GardenScarecrow": restyle_scarecrow,
}


def main():
    args = parse_args()
    wanted = args.asset or list(RESTYLERS)
    for asset in wanted:
        source_path = open_source(asset)
        RESTYLERS[asset]()
        recolour(asset)
        report(asset)
        save(asset, source_path)
        print(f"Restyled {asset}")


if __name__ == "__main__":
    main()
