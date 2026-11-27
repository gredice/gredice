"""Restyle the release-pinned autumn decor for the toy-diorama look in GAME_ART.md.

Rebuilds the meshes of the autumn collection as chunky rounded shapes with
smooth shading: bevelled timber, round logs, soft leaf mounds, thick leaves,
lobed canopies and pumpkins. Thin parts (rake tines, grass blades, stems,
cords, perches) are thickened to at least 0.03 units.

Colours come from the bright seasonal roles decided on 2026-11-23
(`SEASONAL_ROLES` and `AUTUMN_REMAP` in party_style.py, "Seasonal roles" in
GAME_ART.md): autumn is no longer a muted exception. Every part names a role
and gets that role's albedo, one colour per part, with no painted shade
variation, since the bevels now draw the form. Timber parts take the timber
roles; the fallen log's round cut ends take the pale end grain role and its
moss the moss role (base roles in `SCREEN_ROLES`). Metalness is 0 everywhere
and roughness follows the GAME_ART bands. The autumn fence gate keeps its
pinned `Material.Planks` wood tone.

Object names, origins, empties (wind roots, sway roots, steam anchors),
material names and slot order stay as they were, so the runtime and the
release tests keep finding the same nodes. The autumn fence gate copies its
posts and leaf from FenceGate.blend, as generate-autumn-entrances.py does,
so it follows whatever shape the wooden gate has.

Small parts below the 0.03 minimum were merged or dropped: the bench pins are
gone, the rake has five thick tines instead of seven thin ones, and the
wreath and garland have fewer, larger leaves on one chunky twig ring or cord.

Every asset is rebuilt from the constants below, so the script is safe to run
again and gives the same geometry (Blender may round the exported normals
differently, so a GLB hash can still change). The original generate-*.py
scripts still build the previous low-poly models; run this pass after them.
Re-run AutumnFenceGate whenever FenceGate.blend changes, since the release
test requires identical gate posts and leaf.

Run from the repository root, then export and bump the touched assets:

    /Applications/Blender.app/Contents/MacOS/Blender -b \
        --python assets/scripts/party-pass-autumn.py [-- --asset FallenLog ...]
    (cd assets && Blender -b --python export-game-assets.py -- --asset FallenLog ...)

Afterwards rebuild each affected release manifest with
`pnpm --filter @gredice/game exec tsx scripts/build-<release>-release.ts`.
"""

import argparse
import math
import re
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import party_style  # noqa: E402

ASSETS_DIR = Path(__file__).resolve().parents[1] / "game-assets"

# Roughness bands from GAME_ART.md.
SATIN = 0.55
TRUNK = 0.6
STONE = 0.6
MATTE = 0.8
GLOSS = 0.4
ENAMEL = 0.35


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", action="append", default=[])
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


ROLES = {**party_style.SCREEN_ROLES, **party_style.SEASONAL_ROLES}


# ------------------------------------------------------------------ helpers
def colour(value):
    """Linear RGBA for a colour role (its on-screen target) or an albedo hex."""
    if value in ROLES:
        return (*party_style.seasonal_role_albedo(value)[0], 1.0)
    return (*party_style.hex_to_linear(value), 1.0)


class Builder:
    """Collects coloured, named parts in one bmesh."""

    def __init__(self, colours=True):
        self.bm = bmesh.new()
        self.colour_layer = (
            self.bm.loops.layers.float_color.new("Color") if colours else None
        )
        self.groups = {}

    def paint(self, faces, hex_value, group=None, material=0):
        value = colour(hex_value) if hex_value else None
        for face in faces:
            if not face.is_valid:
                continue
            face.material_index = material
            face.smooth = True
            if self.colour_layer is not None and value is not None:
                for loop in face.loops:
                    loop[self.colour_layer] = value
        if group:
            self.groups.setdefault(group, set()).update(
                face for face in faces if face.is_valid
            )
        return faces

    def commit(self, obj, weighted_normals=True):
        bm = self.bm
        bm.verts.index_update()
        groups = {
            name: sorted({vert.index for face in faces if face.is_valid for vert in face.verts})
            for name, faces in self.groups.items()
        }
        party_style.replace_mesh(obj, bm, weighted_normals=weighted_normals)
        for layer in list(obj.data.uv_layers):
            obj.data.uv_layers.remove(layer)
        attributes = obj.data.color_attributes
        if "Color" in attributes:
            attributes.active_color_name = "Color"
            attributes.render_color_index = attributes.find("Color")
        obj.vertex_groups.clear()
        for name, indices in groups.items():
            obj.vertex_groups.new(name=name).add(indices, 1.0, "REPLACE")
        triangles = sum(len(polygon.vertices) - 2 for polygon in obj.data.polygons)
        print(f"  {obj.name}: {len(obj.data.vertices)} verts, {triangles} triangles")
        return triangles


def faces_of(verts):
    return list({face for vert in verts for face in vert.link_faces})


def sharp_edges(faces, angle_degrees=30):
    limit = math.cos(math.radians(angle_degrees))
    edges = set()
    for face in faces:
        for edge in face.edges:
            linked = edge.link_faces
            if len(linked) == 2 and linked[0].normal.dot(linked[1].normal) < limit:
                edges.add(edge)
    return list(edges)


def bevel(bm, faces, radius, segments=2, edges=None, angle_degrees=30):
    """Rounds the sharp edges among `faces`; returns the faces of the part."""
    edges = edges if edges is not None else sharp_edges(faces, angle_degrees)
    if not edges or radius <= 0:
        return list(faces)
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


def find_cap(faces, direction):
    """The largest valid face facing `direction` (a flat end after a bevel)."""
    direction = Vector(direction).normalized()
    candidates = [
        face for face in faces if face.is_valid and face.normal.dot(direction) > 0.995
    ]
    return max(candidates, key=lambda face: face.calc_area()) if candidates else None


def orient(direction):
    """Rotation taking +Z onto `direction`."""
    direction = Vector(direction).normalized()
    return direction.to_track_quat("Z", "Y").to_matrix().to_4x4()


def add_box(builder, low, high, radius, hex_value, group, segments=2, sharp_sides=()):
    faces = party_style.add_box(
        builder.bm, low, high, radius=radius, segments=segments, sharp_sides=sharp_sides
    )
    return builder.paint(faces, hex_value, group)


def add_cylinder(
    builder,
    start,
    end,
    radius,
    hex_value,
    group,
    end_radius=None,
    segments=12,
    round_radius=0.0,
    round_segments=2,
    round_start=True,
    round_end=True,
    cap_hex=None,
):
    """A cylinder or cone from `start` to `end` with rounded rims.

    `cap_hex` paints the flat end faces (cut log ends, mug tops).
    Returns (side faces, start cap, end cap).
    """
    bm = builder.bm
    start = Vector(start)
    end = Vector(end)
    axis = end - start
    length = axis.length
    end_radius = radius if end_radius is None else end_radius
    result = bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        segments=segments,
        radius1=radius,
        radius2=end_radius,
        depth=length,
    )
    verts = result["verts"]
    faces = faces_of(verts)
    caps = [face for face in faces if len(face.verts) == segments]
    low_cap = min(caps, key=lambda face: face.calc_center_median().z)
    high_cap = max(caps, key=lambda face: face.calc_center_median().z)
    rims = []
    if round_radius > 0:
        if round_start:
            rims += list(low_cap.edges)
        if round_end:
            rims += list(high_cap.edges)
        faces = bevel(bm, faces, round_radius, round_segments, edges=rims)
    faces = [face for face in faces if face.is_valid]
    low_cap = find_cap(faces, (0, 0, -1))
    high_cap = find_cap(faces, (0, 0, 1))
    matrix = Matrix.Translation((start + end) / 2) @ orient(axis)
    bmesh.ops.transform(bm, matrix=matrix, verts=list({v for f in faces for v in f.verts}))
    bm.normal_update()
    caps = [face for face in (low_cap, high_cap) if face is not None]
    builder.paint(faces, hex_value, group)
    if cap_hex:
        builder.paint(caps, cap_hex, group)
    return faces, low_cap, high_cap


def frames_along(points, closed=False):
    """Parallel-transport frames for a polyline."""
    tangents = []
    count = len(points)
    for index in range(count):
        if closed:
            previous = points[index - 1]
            following = points[(index + 1) % count]
        else:
            previous = points[max(0, index - 1)]
            following = points[min(count - 1, index + 1)]
        tangents.append((following - previous).normalized())
    reference = Vector((0, 0, 1)) if abs(tangents[0].z) < 0.9 else Vector((1, 0, 0))
    normal = tangents[0].cross(reference).normalized()
    frames = []
    for tangent in tangents:
        normal = (normal - tangent * normal.dot(tangent)).normalized()
        frames.append((tangent, normal, tangent.cross(normal).normalized()))
    return frames


def add_tube(
    builder, points, radius, hex_value, group, segments=8, closed=False, round_caps=True,
    round_start=True,
):
    """A smooth tube through `points`; `radius` may be a list per point."""
    bm = builder.bm
    points = [Vector(point) for point in points]
    radii = radius if isinstance(radius, (list, tuple)) else [radius] * len(points)
    rings = []
    frames = frames_along(points, closed)
    for point, rad, (tangent, normal, binormal) in zip(points, radii, frames):
        rings.append(
            [
                bm.verts.new(
                    point
                    + rad * (math.cos(math.tau * i / segments) * normal + math.sin(math.tau * i / segments) * binormal)
                )
                for i in range(segments)
            ]
        )
    if not closed and round_caps:
        # Two shrinking rings and a tip round each open end.
        for end, sign in ((0, -1), (len(points) - 1, 1)):
            if sign < 0 and not round_start:
                continue
            tangent, normal, binormal = frames[end]
            point, rad = points[end], radii[end]
            extra = []
            for fraction, push in ((0.72, 0.55), (0.0, 0.85)):
                if fraction == 0.0:
                    extra.append([bm.verts.new(point + sign * tangent * rad * push)])
                else:
                    extra.append(
                        [
                            bm.verts.new(
                                point
                                + sign * tangent * rad * push
                                + rad * fraction * (math.cos(math.tau * i / segments) * normal + math.sin(math.tau * i / segments) * binormal)
                            )
                            for i in range(segments)
                        ]
                    )
            if sign < 0:
                rings = list(reversed(extra)) + rings
            else:
                rings = rings + extra
    faces = []
    ring_count = len(rings)
    for index in range(ring_count if closed else ring_count - 1):
        a = rings[index]
        b = rings[(index + 1) % ring_count]
        if len(a) == 1:
            faces += [bm.faces.new((a[0], b[(i + 1) % segments], b[i])) for i in range(segments)]
        elif len(b) == 1:
            faces += [bm.faces.new((a[i], a[(i + 1) % segments], b[0])) for i in range(segments)]
        else:
            faces += [
                bm.faces.new((a[i], a[(i + 1) % segments], b[(i + 1) % segments], b[i]))
                for i in range(segments)
            ]
    if not closed and not round_caps:
        faces.append(bm.faces.new(list(reversed(rings[0]))))
        faces.append(bm.faces.new(rings[-1]))
    elif not closed and not round_start:
        faces.append(bm.faces.new(list(reversed(rings[0]))))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return builder.paint(faces, hex_value, group)


def lobe_scale(direction, lobes, sharpness):
    scale = 1.0
    for lobe_direction, amount in lobes:
        scale += amount * max(0.0, direction.dot(lobe_direction)) ** sharpness
    return scale


def add_lobed_sphere(
    builder, center, radii, hex_value, group, lobes=(), segments=16, rings=10,
    sharpness=3, floor=None, squash=None,
):
    """A smooth UV ellipsoid with soft swellings toward each lobe."""
    bm = builder.bm
    lobes = [(Vector(direction).normalized(), amount) for direction, amount in lobes]
    result = bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=1.0)
    verts = result["verts"]
    for vert in verts:
        direction = vert.co.normalized()
        scale = lobe_scale(direction, lobes, sharpness)
        position = Vector(
            (
                center[0] + direction.x * radii[0] * scale,
                center[1] + direction.y * radii[1] * scale,
                center[2] + direction.z * radii[2] * scale,
            )
        )
        if squash:
            position = squash(position, direction)
        if floor is not None and position.z < floor:
            position.z = floor
        vert.co = position
    return builder.paint(faces_of(verts), hex_value, group)


def add_dome(
    builder, center, radii, hex_value, group, lobes=(), segments=20, rings=6,
    sharpness=3, profile=1.0,
):
    """The top half of a lobed ellipsoid on a flat base at center.z.

    `profile` below 1 makes the sides fuller, like a heaped pile.
    """
    bm = builder.bm
    lobes = [(Vector(direction).normalized(), amount) for direction, amount in lobes]
    top = None
    ring_verts = []
    for ring in range(rings + 1):
        polar = (math.pi / 2) * ring / rings
        if ring == 0:
            direction = Vector((0, 0, 1))
            scale = lobe_scale(direction, lobes, sharpness)
            top = bm.verts.new(
                (center[0], center[1], center[2] + radii[2] * scale)
            )
            continue
        verts = []
        for index in range(segments):
            azimuth = math.tau * index / segments
            direction = Vector(
                (
                    math.sin(polar) * math.cos(azimuth),
                    math.sin(polar) * math.sin(azimuth),
                    math.cos(polar),
                )
            )
            scale = lobe_scale(direction, lobes, sharpness)
            height = math.cos(polar) ** profile if ring < rings else 0.0
            verts.append(
                bm.verts.new(
                    (
                        center[0] + direction.x * radii[0] * scale,
                        center[1] + direction.y * radii[1] * scale,
                        center[2] + height * radii[2] * scale,
                    )
                )
            )
        ring_verts.append(verts)
    faces = [
        bm.faces.new((top, ring_verts[0][i], ring_verts[0][(i + 1) % segments]))
        for i in range(segments)
    ]
    for upper, lower in zip(ring_verts, ring_verts[1:]):
        faces += [
            bm.faces.new((upper[i], lower[i], lower[(i + 1) % segments], upper[(i + 1) % segments]))
            for i in range(segments)
        ]
    faces.append(bm.faces.new(list(reversed(ring_verts[-1]))))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return builder.paint(faces, hex_value, group)


def add_leaf(
    builder, center, length, width, thickness, yaw, hex_value, group,
    pitch=0.0, roll=0.0, curl=0.0, segments=16, rings=8, placement=None,
):
    """A thick leaf lying along +X before rotation.

    The leaf is one smooth lens: widest near the stem, narrowing to a soft
    rounded tip, with a rounded edge all round, so it reads as one chunky
    shape. `segments` sets how smooth the outline is, `rings` the edge.
    """
    bm = builder.bm
    result = bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=1.0)
    verts = result["verts"]
    for vert in verts:
        x, y, z = vert.co
        # Narrower toward the tip at +x, fuller toward the stem at -x; the
        # taper is gentle so the tip stays round instead of a sharp point.
        y *= (1.0 - 0.24 * x) * (1.0 - 0.1 * abs(x) ** 4)
        z *= 1.0 - 0.3 * x * x
        vert.co = Vector(
            (
                x * length / 2,
                y * width / 2,
                z * thickness / 2 + curl * (x * x) * length / 2,
            )
        )
    rotation = (
        Matrix.Rotation(yaw, 4, "Z")
        @ Matrix.Rotation(pitch, 4, "Y")
        @ Matrix.Rotation(roll, 4, "X")
    )
    matrix = Matrix.Translation(center) @ (placement or Matrix.Identity(4)) @ rotation
    bmesh.ops.transform(bm, matrix=matrix, verts=verts)
    return builder.paint(faces_of(verts), hex_value, group)


def surface_frame(tree, x, y, top=2.0):
    """Point and normal on the surface below (x, y), as a placement basis."""
    hit, normal, _index, _distance = tree.ray_cast(Vector((x, y, top)), Vector((0, 0, -1)))
    if hit is None:
        return Vector((x, y, 0.0)), Matrix.Identity(4)
    normal = normal.normalized()
    if normal.z < 0:
        normal = -normal
    tangent = Vector((1, 0, 0)) - normal * normal.x
    tangent.normalize()
    bitangent = normal.cross(tangent)
    basis = Matrix((tangent, bitangent, normal)).transposed().to_4x4()
    return hit, basis


def add_blade(
    builder, base, azimuth, height, lean, width, thickness, hex_value, group,
    points=5, segments=6, tip_width=None, tip_length=0.06,
):
    """A thick grass blade that rises from `base`, arches outward and tapers.

    The blade narrows along its length and ends in a soft point `tip_length`
    beyond its last ring, so a clump reads as grass, not as fingers. It stays
    at least 0.03 thick up to the tip.
    """
    bm = builder.bm
    base = Vector(base)
    outward = Vector((math.cos(azimuth), math.sin(azimuth), 0.0))
    side = Vector((-math.sin(azimuth), math.cos(azimuth), 0.0))
    tip_width = width * 0.6 if tip_width is None else tip_width
    rings = []
    centres = []
    for index in range(points):
        t = index / (points - 1)
        centre = base + outward * lean * t * t + Vector((0, 0, height * t))
        tangent = outward * 2 * lean * t + Vector((0, 0, height))
        normal = tangent.normalized().cross(side).normalized()
        w = width + (tip_width - width) * t ** 0.8
        th = thickness + (max(0.03, tip_width * 0.8) - thickness) * t
        rings.append(
            [
                bm.verts.new(
                    centre
                    + side * (w / 2) * math.cos(math.tau * i / segments)
                    + normal * (th / 2) * math.sin(math.tau * i / segments)
                )
                for i in range(segments)
            ]
        )
        centres.append((centre, tangent.normalized(), normal, w, th))
    centre, tangent, normal, w, th = centres[-1]
    tip_ring = [
        bm.verts.new(
            centre
            + tangent * tip_length * 0.45
            + side * (w / 2) * 0.75 * math.cos(math.tau * i / segments)
            + normal * (th / 2) * math.sin(math.tau * i / segments)
        )
        for i in range(segments)
    ]
    tip = bm.verts.new(centre + tangent * tip_length)
    rings.append(tip_ring)
    faces = []
    for a, b in zip(rings, rings[1:]):
        faces += [
            bm.faces.new((a[i], a[(i + 1) % segments], b[(i + 1) % segments], b[i]))
            for i in range(segments)
        ]
    faces += [bm.faces.new((tip_ring[i], tip_ring[(i + 1) % segments], tip)) for i in range(segments)]
    faces.append(bm.faces.new(list(reversed(rings[0]))))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return builder.paint(faces, hex_value, group)


def add_pumpkin(builder, center, radius, height, hex_value, group, lobes=8, groove=0.11, segments=24, rings=10):
    """A squat pumpkin with soft vertical lobes and a dimpled top."""
    bm = builder.bm
    result = bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=1.0)
    verts = result["verts"]
    for vert in verts:
        d = vert.co.normalized()
        azimuth = math.atan2(d.y, d.x)
        scale = 1.0 - groove * (0.5 - 0.5 * math.cos(lobes * azimuth)) * (1 - abs(d.z) ** 3)
        z = d.z * (1.0 - 0.22 * abs(d.z) ** 6)
        vert.co = Vector(
            (
                center[0] + d.x * radius * scale,
                center[1] + d.y * radius * scale,
                center[2] + height / 2 + z * height / 2,
            )
        )
    return builder.paint(faces_of(verts), hex_value, group)


def add_profile_prism(
    builder, profile, start_y, end_y, hex_value, group, rim=0.025, rim_segments=2, axis="y",
):
    """Extrudes a profile along Y (XZ profile) or X (YZ profile) with rounded rims.

    Returns the faces and the two end caps.
    """
    bm = builder.bm
    if axis == "y":
        low = [bm.verts.new((a, start_y, b)) for a, b in profile]
        high = [bm.verts.new((a, end_y, b)) for a, b in profile]
    else:
        low = [bm.verts.new((start_y, a, b)) for a, b in profile]
        high = [bm.verts.new((end_y, a, b)) for a, b in profile]
    count = len(profile)
    faces = [
        bm.faces.new((low[i], low[(i + 1) % count], high[(i + 1) % count], high[i]))
        for i in range(count)
    ]
    start_cap = bm.faces.new(list(reversed(low)))
    end_cap = bm.faces.new(high)
    faces += [start_cap, end_cap]
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    rims = list(start_cap.edges) + list(end_cap.edges)
    faces = bevel(bm, faces, rim, rim_segments, edges=rims)
    bm.normal_update()
    direction = Vector((0, 1, 0)) if axis == "y" else Vector((1, 0, 0))
    start_cap = find_cap(faces, -direction)
    end_cap = find_cap(faces, direction)
    builder.paint(faces, hex_value, group)
    return faces, start_cap, end_cap


def inset_rings(builder, cap, rings, group):
    """Insets a flat cap into concentric bands: [(thickness, hex), ...].

    The cap keeps the first colour; each inset paints the inner face.
    """
    bm = builder.bm
    current = cap
    previous = rings[0][1]
    builder.paint([current], previous, group)
    for thickness, hex_value in rings[1:]:
        result = bmesh.ops.inset_individual(
            bm, faces=[current], thickness=thickness, use_even_offset=False
        )
        builder.paint(result["faces"], previous, group)
        builder.paint([current], hex_value, group)
        previous = hex_value
    return current


def rounded_polygon(corners, radius, steps=3):
    """A closed 2D polygon with each corner rounded by `radius`."""
    points = []
    count = len(corners)
    for index in range(count):
        previous = Vector(corners[index - 1])
        corner = Vector(corners[index])
        following = Vector(corners[(index + 1) % count])
        a = (previous - corner).normalized()
        b = (following - corner).normalized()
        start = corner + a * radius
        end = corner + b * radius
        for step in range(steps + 1):
            t = step / steps
            # Quadratic Bezier through the corner gives a soft round.
            point = (1 - t) ** 2 * start + 2 * (1 - t) * t * corner + t * t * end
            points.append((point.x, point.y))
    return points


def round_profile(points, radius, steps=2):
    """Rounds the inner corners of an open 2D polyline."""
    result = [tuple(points[0])]
    for index in range(1, len(points) - 1):
        previous = Vector(points[index - 1])
        corner = Vector(points[index])
        following = Vector(points[index + 1])
        a = previous - corner
        b = following - corner
        if a.length < 1e-6 or b.length < 1e-6:
            continue
        r = min(radius, a.length * 0.45, b.length * 0.45)
        start = corner + a.normalized() * r
        end = corner + b.normalized() * r
        for step in range(steps + 1):
            t = step / steps
            point = (1 - t) ** 2 * start + 2 * (1 - t) * t * corner + t * t * end
            result.append((point.x, point.y))
    result.append(tuple(points[-1]))
    return result


def add_lathe(builder, cx, cy, profile, colour_at, group, segments=20):
    """Revolves an (r, z) profile that starts and ends on the axis.

    `colour_at(r, z)` picks the colour of each band from its midpoint.
    """
    bm = builder.bm
    rings = []
    for r, z in profile:
        if r < 1e-6:
            rings.append([bm.verts.new((cx, cy, z))])
        else:
            rings.append(
                [
                    bm.verts.new(
                        (
                            cx + r * math.cos(math.tau * i / segments),
                            cy + r * math.sin(math.tau * i / segments),
                            z,
                        )
                    )
                    for i in range(segments)
                ]
            )
    faces = []
    bands = []
    for (a, b), (p, q) in zip(zip(rings, rings[1:]), zip(profile, profile[1:])):
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            band = [bm.faces.new((a[0], b[(i + 1) % segments], b[i])) for i in range(segments)]
        elif len(b) == 1:
            band = [bm.faces.new((a[i], a[(i + 1) % segments], b[0])) for i in range(segments)]
        else:
            band = [
                bm.faces.new((a[i], a[(i + 1) % segments], b[(i + 1) % segments], b[i]))
                for i in range(segments)
            ]
        faces += band
        bands.append((band, ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    for band, (r, z) in bands:
        builder.paint(band, colour_at(r, z), group)
    return faces


def add_tray(builder, low, high, wall, floor, radius, rim_hex, floor_hex, group, segments=2):
    """An open box: a rim of `wall` thickness around a recessed floor."""
    bm = builder.bm
    low = Vector(low)
    high = Vector(high)
    result = bmesh.ops.create_cube(bm, size=1.0)
    verts = result["verts"]
    bmesh.ops.scale(bm, vec=high - low, verts=verts)
    bmesh.ops.translate(bm, vec=(low + high) / 2, verts=verts)
    faces = faces_of(verts)
    top = max(faces, key=lambda face: face.calc_center_median().z)
    inset = bmesh.ops.inset_individual(bm, faces=[top], thickness=wall)
    extruded = bmesh.ops.extrude_face_region(bm, geom=[top])
    new_verts = [elem for elem in extruded["geom"] if isinstance(elem, bmesh.types.BMVert)]
    depth = (high.z - low.z) - floor
    bmesh.ops.translate(bm, vec=(0, 0, -depth), verts=new_verts)
    # The extrusion leaves the original inner top face in place as a lid at
    # rim height; remove it so the tray is open and its floor shows.
    if top.is_valid:
        bmesh.ops.delete(bm, geom=[top], context="FACES_ONLY")
    faces = faces_of(verts + new_verts) + inset["faces"]
    faces = list({face for face in faces if face.is_valid})
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    faces = bevel(bm, faces, radius, segments)
    bm.normal_update()
    builder.paint(faces, rim_hex, group)
    floor_z = low.z + floor
    builder.paint(
        [
            face
            for face in faces
            if face.normal.z > 0.9 and abs(face.calc_center_median().z - floor_z) < 0.004
        ],
        floor_hex,
        group,
    )
    return faces


def set_materials(roles):
    """Metalness 0 everywhere and roughness by band, colours untouched."""
    for name, roughness in roles.items():
        material = bpy.data.materials.get(name)
        if material is None:
            raise RuntimeError(f"missing material {name}")
        party_style.set_surface(material, roughness)
        material.roughness = roughness
        material.metallic = 0.0


def set_material_roles(roles):
    """Flat base colour from a role, metalness 0 and roughness by band."""
    for name, (role, roughness) in roles.items():
        material = bpy.data.materials.get(name)
        if material is None:
            raise RuntimeError(f"missing material {name}")
        albedo, _ = party_style.seasonal_role_albedo(role)
        party_style.set_flat_colour(material, albedo, roughness)
        material.diffuse_color = (*albedo, 1.0)
        material.roughness = roughness
        material.metallic = 0.0


def obj(name):
    found = bpy.data.objects.get(name)
    if found is None:
        raise RuntimeError(f"missing object {name}")
    return found


# ---------------------------------------------------------------- fallen log
# The log lies along X with its thick end at -X and its +Y side toward the
# default camera, which sees that end and that side. The barrel is
# LOG_RIDGES soft bark plates with grooves between them that deepen and fade
# along the length and turn a little from end to end, on a body that tapers,
# bows gently sideways and sits on a flat seat, so it reads as a log and not
# a tube. Both cut faces lean back so they look up at the camera and show
# pale end grain with nut caramel rings, not the orange timber roles. A large
# moss cushion grows over the crown beside the stub with two smaller ones
# tucked under its edge, one spilling down the camera side, and a small tuft
# sits near the -X cut end. A chunky broken branch on the far side carries
# one small leaf, and a knot sits on the near side.
LOG_ENDS = (-0.875, 0.875)
LOG_STATION_COUNT = 10
LOG_RIDGES = 6
LOG_PLATE_VERTS = 5
LOG_SEGMENTS = LOG_RIDGES * LOG_PLATE_VERTS
LOG_GROOVE = 0.15  # Groove depth, as a fraction of the radius.
LOG_PLATE_SWELL = 0.05  # Plates swell and settle along the length.
LOG_TWIST = 0.45  # Radians the plates turn from end to end.
LOG_HALF_WIDTH = 0.26
LOG_HALF_HEIGHT = 0.222
LOG_SEAT = 0.8  # Axis height over the vertical radius; below it is the flat seat.
LOG_BEND = 0.07  # Sideways bow in plan view.
LOG_TAPER = (1.05, 0.83)  # Radius scale at the thick (-X) and thin (+X) end.
LOG_CUT_SLANT = 0.25
LOG_RIM = 0.04
LOG_TOP = 0.447  # Highest point, under the 0.45 item height.
LOG_BARK = "trunk"
LOG_CUT = "end_grain"
LOG_RING = "nut_caramel"
LOG_MOSS = "moss"
LOG_SPROUT = "canopy_light"
# End grain from the rim in: (fraction of the radius where the band ends,
# how round it is, role). The last band fills the heart.
LOG_END_GRAIN = [(0.78, 0.35, LOG_CUT), (0.6, 0.65, LOG_RING), (0.3, 0.9, LOG_CUT), (0.0, 1.0, LOG_RING)]
# Moss cushions: (x, angle around the log from +Y toward +Z, half length,
# half width along the bark, thickness, scallops, segments, profile). Each
# cushion is a soft oval with `scallops` small round bumps along its edge. A
# profile lists rings from the rim in: (fraction of the outline, fraction of
# the thickness), None for the rim sunk into the bark under a rounded lip
# that overhangs it a little. LOG_MOSS_DOME rounds the top beyond the profile.
LOG_MOSS_SCALLOP = 0.1
LOG_MOSS_DOME = 0.45
LOG_MOSS_PROFILE = [(0.88, None), (1.0, 0.36), (0.84, 0.78), (0.46, 0.97)]
LOG_MOSS_SMALL_PROFILE = [(0.88, None), (1.0, 0.4), (0.62, 0.9)]
LOG_MOSS_CUSHIONS = [
    # A large cushion over the crown beside the stub, with two smaller ones
    # tucked under its edge: one behind it along the crown, one spilling
    # down the camera side.
    (-0.08, 1.2, 0.22, 0.17, 0.09, 5, 20, LOG_MOSS_PROFILE),
    (0.14, 1.48, 0.12, 0.1, 0.06, 4, 16, LOG_MOSS_SMALL_PROFILE),
    (-0.24, 0.72, 0.11, 0.1, 0.065, 4, 16, LOG_MOSS_SMALL_PROFILE),
    # A small tuft near the -X cut end.
    (-0.75, 0.95, 0.065, 0.06, 0.05, 4, 12, LOG_MOSS_SMALL_PROFILE),
]
# The branch stub: (x, angle around the log, outward direction, length out,
# radius at the bark and at the cut).
LOG_STUB = (0.34, 2.55, (0.25, -0.85, 0.42), 0.13, 0.078, 0.066)
# A knot on the camera side: (x, angle around the log, size).
LOG_KNOT = (0.5, 0.6, 1.2)


def log_axis(t):
    """Axis point and radius scale at t in [0, 1], from the thick end to the thin end."""
    x = LOG_ENDS[0] + (LOG_ENDS[1] - LOG_ENDS[0]) * t
    scale = LOG_TAPER[0] + (LOG_TAPER[1] - LOG_TAPER[0]) * t
    y = LOG_BEND * (math.sin(math.pi * t) - 0.5)
    z = LOG_SEAT * LOG_HALF_HEIGHT * scale
    return Vector((x, y, z)), scale


def log_ring(t, index):
    """One barrel vertex: soft plates with a groove every LOG_PLATE_VERTS vertices."""
    centre, scale = log_axis(t)
    step = math.tau * index / LOG_SEGMENTS
    angle = step + LOG_TWIST * t
    groove = (0.5 + 0.5 * math.cos(LOG_RIDGES * step)) ** 3
    plate = index * LOG_RIDGES // LOG_SEGMENTS
    # Each groove deepens and fades along the log at its own place, so the
    # plates part and merge like bark instead of running as even flutes.
    nearest = round(index / LOG_PLATE_VERTS) % LOG_RIDGES
    groove *= 0.5 + 0.5 * math.sin(math.tau * 0.85 * t + 2.2 * nearest + 0.6)
    swell = 1 + LOG_PLATE_SWELL * (1 - groove) * math.sin(math.tau * 1.3 * t + 1.9 * plate)
    radial = scale * (1 - LOG_GROOVE * groove) * swell
    y = centre.y + LOG_HALF_WIDTH * radial * math.cos(angle)
    z = max(0.0, centre.z + LOG_HALF_HEIGHT * radial * math.sin(angle))
    # The cut faces lean back so the end grain looks up a little.
    x = centre.x + LOG_CUT_SLANT * (z - centre.z) * (1 - 2 * t)
    return Vector((x, y, z))


def surface_basis(point, normal, along=Vector((1, 0, 0))):
    """A frame on the bark: Z out of the surface, X along the log."""
    normal = normal.normalized()
    tangent = (along - normal * along.dot(normal)).normalized()
    return Matrix((tangent, normal.cross(tangent), normal)).transposed().to_4x4()


def end_grain(builder, cap, centre, bands, group):
    """Replaces a cut face with concentric bands around `centre` (the pith).

    Each band's inner loop shrinks the rim toward the pith and rounds it
    off, so the rings stay clean on the plated outline. Returns the faces.
    """
    bm = builder.bm
    rim = list(cap.verts)
    normal = cap.normal.copy()
    centre = centre - normal * normal.dot(centre - rim[0].co)
    offsets = [vert.co - centre for vert in rim]
    mean = sum((offset.length for offset in offsets), 0.0) / len(offsets)
    bmesh.ops.delete(bm, geom=[cap], context="FACES_ONLY")
    faces = []
    outer = rim
    for fraction, roundness, hex_value in bands:
        if fraction <= 0:
            faces += builder.paint([bm.faces.new(outer)], hex_value, group)
            break
        inner = [
            bm.verts.new(centre + offset * fraction * (1 - roundness) + offset.normalized() * mean * fraction * roundness)
            for offset in offsets
        ]
        count = len(outer)
        band = [
            bm.faces.new((outer[i], outer[(i + 1) % count], inner[(i + 1) % count], inner[i]))
            for i in range(count)
        ]
        faces += builder.paint(band, hex_value, group)
        outer = inner
    for face in faces:
        if face.normal.dot(normal) < 0:
            face.normal_flip()
    return faces


def log_surface(tree, x, angle):
    """Point and outward normal on the bark at x, `angle` from +Y toward +Z."""
    t = (x - LOG_ENDS[0]) / (LOG_ENDS[1] - LOG_ENDS[0])
    centre, _ = log_axis(t)
    direction = Vector((0, math.cos(angle), math.sin(angle)))
    hit, normal, _index, _distance = tree.ray_cast(centre + direction * 2.0, -direction)
    if normal.dot(direction) < 0:
        normal = -normal
    return hit, normal


def log_shell(x, angle):
    """Point, outward normal and radius on the smooth barrel, without grooves."""
    t = min(1.0, max(0.0, (x - LOG_ENDS[0]) / (LOG_ENDS[1] - LOG_ENDS[0])))
    centre, scale = log_axis(t)
    cos_a, sin_a = math.cos(angle), math.sin(angle)
    point = Vector((x, centre.y + LOG_HALF_WIDTH * scale * cos_a, centre.z + LOG_HALF_HEIGHT * scale * sin_a))
    normal = Vector((0, cos_a / LOG_HALF_WIDTH, sin_a / LOG_HALF_HEIGHT)).normalized()
    return point, normal, LOG_HALF_HEIGHT * scale


def add_moss_cushion(builder, cushion, group):
    """One soft moss cushion draped over the barrel.

    A polar grid laid on the smooth barrel: its rim sinks below the groove
    floor and tucks under a rounded lip, so the cushion grows out of the bark
    with a soft shadow line all round instead of sitting on it like a
    sticker. The top is flattened only as much as the item height needs.
    """
    x0, angle0, half_length, half_width, thickness, scallops, segments, profile = cushion
    bm = builder.bm
    step = 1e-3
    arc = (log_shell(x0, angle0 + step)[0] - log_shell(x0, angle0 - step)[0]).length / (2 * step)

    def spot(fraction, theta, height):
        # Small round bumps along the edge, fading toward the top.
        notch = 1 - abs(math.sin(scallops * theta / 2)) ** 0.5
        rounded = fraction * (1 - LOG_MOSS_SCALLOP * notch * fraction * fraction)
        edge = 1 / math.hypot(math.cos(theta) / half_length, math.sin(theta) / half_width)
        along, around = rounded * edge * math.cos(theta), rounded * edge * math.sin(theta)
        base, normal, radius = log_shell(x0 + along, angle0 + around / arc)
        if height is None:
            lift = -LOG_GROOVE * radius - 0.006
        else:
            dome = math.exp(-1.6 * rounded * rounded)
            lift = thickness * height * (1 - LOG_MOSS_DOME + LOG_MOSS_DOME * dome)
        return base, normal, lift

    loops = [
        [spot(fraction, math.tau * index / segments, height) for index in range(segments)]
        for fraction, height in profile
    ]
    top = spot(0.0, 0.0, 1.0)
    squash = min(
        [1.0]
        + [
            (LOG_TOP - base.z) / (normal.z * lift)
            for base, normal, lift in [top] + [s for loop in loops for s in loop]
            if lift > 0 and base.z + normal.z * lift > LOG_TOP
        ]
    )

    def place(base, normal, lift):
        return bm.verts.new(base + normal * (lift * squash if lift > 0 else lift))

    rings = [[place(*s) for s in loop] for loop in loops]
    centre = place(*top)
    faces = []
    for outer, inner in zip(rings, rings[1:]):
        faces += [
            bm.faces.new((outer[i], outer[(i + 1) % segments], inner[(i + 1) % segments], inner[i]))
            for i in range(segments)
        ]
    faces += [bm.faces.new((rings[-1][i], rings[-1][(i + 1) % segments], centre)) for i in range(segments)]
    bm.normal_update()
    outward = log_shell(x0, angle0)[1]
    if sum(face.normal.dot(outward) * face.calc_area() for face in faces) < 0:
        bmesh.ops.reverse_faces(bm, faces=faces)
    return builder.paint(faces, LOG_MOSS, group)


def add_sprout(builder, base, up, lean, group):
    """One small leaf on a short twig, the log's first new growth."""
    up = up.normalized()
    lean = (lean - up * lean.dot(up)).normalized()
    tip = base + up * 0.05 + lean * 0.02
    add_tube(
        builder, [base - up * 0.02, base + up * 0.025 + lean * 0.004, tip],
        [0.018, 0.017, 0.016], LOG_SPROUT, group, segments=5,
    )
    yaw = math.atan2(lean.y, lean.x)
    add_leaf(
        builder, tip + lean * 0.055 + up * 0.012, 0.13, 0.08, 0.032, yaw, LOG_SPROUT, group,
        pitch=-0.35, curl=0.05, segments=8, rings=4,
    )


def add_knot(builder, point, normal, size, group):
    """A soft oval swelling with a rolled lip round a shallow dimple, all bark."""
    profile = [(0.0, 0.008), (0.024, 0.014), (0.046, 0.027), (0.07, 0.017), (0.09, -0.006), (0.085, -0.035), (0.0, -0.035)]
    faces = add_lathe(builder, 0.0, 0.0, profile, lambda r, z: LOG_BARK, group, segments=8)
    verts = list({vert for face in faces for vert in face.verts})
    matrix = (
        Matrix.Translation(point)
        @ surface_basis(point, normal)
        @ Matrix.Diagonal((1.35 * size, 0.9 * size, size, 1.0))
    )
    bmesh.ops.transform(builder.bm, matrix=matrix, verts=verts)
    return faces


def restyle_fallen_log():
    set_materials({"Material.FallenLog.Palette": TRUNK})
    builder = Builder()
    bm = builder.bm
    rings = []
    for station in range(LOG_STATION_COUNT):
        t = station / (LOG_STATION_COUNT - 1)
        rings.append([bm.verts.new(log_ring(t, index)) for index in range(LOG_SEGMENTS)])
    faces = []
    for a, b in zip(rings, rings[1:]):
        faces += [
            bm.faces.new((a[i], b[i], b[(i + 1) % LOG_SEGMENTS], a[(i + 1) % LOG_SEGMENTS]))
            for i in range(LOG_SEGMENTS)
        ]
    left = bm.faces.new(rings[0])
    right = bm.faces.new(list(reversed(rings[-1])))
    faces += [left, right]
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    # Round the rims of the cut faces, but keep the seat edge sharp so the
    # log sits flat on the ground.
    rims = [
        edge for cap in (left, right) for edge in cap.edges
        if edge.verts[0].co.z > 0.001 or edge.verts[1].co.z > 0.001
    ]
    faces = bevel(bm, faces, LOG_RIM, 2, edges=rims)
    bm.normal_update()
    builder.paint(faces, LOG_BARK, "Bark")
    for sign, name, t in ((-1, "CutEndLeft", 0.0), (1, "CutEndRight", 1.0)):
        cap = max(
            (face for face in faces if face.is_valid and face.normal.x * sign > 0.9),
            key=lambda face: face.calc_area(),
        )
        end_grain(builder, cap, log_axis(t)[0], LOG_END_GRAIN, name)
    bm.normal_update()
    tree = BVHTree.FromBMesh(bm)
    # A chunky broken branch on the far side, its cut end showing one ring.
    x, angle, direction, length, radius, end_radius = LOG_STUB
    point, _normal = log_surface(tree, x, angle)
    direction = Vector(direction).normalized()
    _faces, _start, stub_cap = add_cylinder(
        builder, point - direction * 0.07, point + direction * length, radius, LOG_BARK,
        "BranchStub", end_radius=end_radius, segments=10, round_radius=0.024,
        round_start=False,
    )
    inset_rings(builder, stub_cap, [(None, LOG_CUT), (0.012, LOG_RING), (0.01, LOG_CUT)], "BranchStub")
    # One small leaf sprouting from the top of the stub.
    end = point + direction * length
    stub_up = (Vector((0, 0, 1)) - direction * direction.z).normalized()
    add_sprout(builder, end - direction * 0.05 + stub_up * end_radius * 0.75, Vector((0, 0, 1)), direction, "Sprout")
    # A knot on the near side, clear of the moss.
    x, angle, size = LOG_KNOT
    point, normal = log_surface(tree, x, angle)
    add_knot(builder, point - normal * 0.006, normal, size, "Knot")
    for cushion in LOG_MOSS_CUSHIONS:
        add_moss_cushion(builder, cushion, "Moss")
    # Nothing reaches below the seat (the rim bevel can dip a hair under it).
    for vert in bm.verts:
        vert.co.z = max(0.0, vert.co.z)
    bm.normal_update()
    low = Vector([min(vert.co[i] for vert in bm.verts) for i in range(3)])
    high = Vector([max(vert.co[i] for vert in bm.verts) for i in range(3)])
    print(f"  FallenLog bounds {tuple(round(v, 3) for v in low)} .. {tuple(round(v, 3) for v in high)}")
    builder.commit(obj("FallenLog_Timber"))


# ---------------------------------------------------------- stacked firewood
# Each billet: (x, y, z, length), from the original generator.
FIREWOOD_BILLETS = [
    (-0.25, 0.0, 0.0, 0.65),
    (0.0, -0.018, 0.0, 0.69),
    (0.25, 0.012, 0.0, 0.62),
    (-0.125, 0.02, 0.14, 0.64),
    (0.125, -0.015, 0.14, 0.67),
    (0.0, 0.0, 0.28, 0.60),
]
# Split billet: flat split faces top and bottom, bark on the slanted sides.
FIREWOOD_PROFILE = [(-0.118, 0.0), (0.118, 0.0), (0.132, 0.07), (0.078, 0.145), (-0.078, 0.145), (-0.132, 0.07)]
# One bark colour for every billet (the trunk role); split faces and end
# grain show the timber roles.
FIREWOOD_BARK = ["trunk"] * 6
FIREWOOD_SPLIT_TOP = "timber_light"
FIREWOOD_SPLIT_BOTTOM = "timber_dark"
FIREWOOD_END_GRAIN = [(None, "timber_light"), (0.034, "timber_dark")]


def restyle_stacked_firewood():
    set_materials({"Material.StackedFirewood.Timber": SATIN})
    builder = Builder()
    profile = rounded_polygon(FIREWOOD_PROFILE, 0.034, steps=2)
    for index, (x, y, z, length) in enumerate(FIREWOOD_BILLETS):
        name = f"SplitLog{index}"
        shifted = [(x + px, z + pz) for px, pz in profile]
        faces, start_cap, end_cap = add_profile_prism(
            builder, shifted, y - length / 2, y + length / 2,
            FIREWOOD_BARK[index], name, rim=0.028,
        )
        for face in faces:
            if not face.is_valid or face in (start_cap, end_cap):
                continue
            if face.normal.z > 0.85:
                builder.paint([face], FIREWOOD_SPLIT_TOP, name)
            elif face.normal.z < -0.85:
                builder.paint([face], FIREWOOD_SPLIT_BOTTOM, name)
        for cap in (start_cap, end_cap):
            inset_rings(builder, cap, FIREWOOD_END_GRAIN, name)
    builder.commit(obj("StackedFirewood_Timber"))


# ---------------------------------------------------------------- leaf piles
LEAF_MOUND = "leaf_pile"
LEAF_ORANGE = "autumn_orange"
LEAF_GOLD = "autumn_gold"
LEAF_AMBER = "autumn_amber"
LEAF_RED = "autumn_red"
PILE_LOBES = [
    ((math.cos(angle), math.sin(angle), 0.2), amount)
    for angle, amount in [(0.2, 0.12), (1.3, 0.09), (2.4, 0.13), (3.4, 0.08), (4.4, 0.12), (5.4, 0.1)]
] + [
    # Soft heaps on the top so the pile reads as loose leaves, not a disc.
    ((math.cos(angle), math.sin(angle), 1.6), amount)
    for angle, amount in [(0.6, 0.22), (1.9, 0.16), (3.0, 0.2), (4.3, 0.18), (5.4, 0.15)]
]
# Leaves on the mound: (angle, distance from centre, yaw, tilt, colour, rest).
# `rest` lifts a leaf off the surface (+) or tucks it into the heap (-), in
# leaf thicknesses.
MOUND_LEAVES = [
    (0.0, 0.0, 0.6, 0.12, LEAF_GOLD, -0.1),
    (0.3, 0.2, 0.4, 0.35, LEAF_RED, -0.3),
    (1.2, 0.19, 2.1, 0.3, LEAF_AMBER, 0.15),
    (2.1, 0.21, 2.7, 0.4, LEAF_GOLD, -0.3),
    (3.0, 0.18, 3.5, 0.25, LEAF_ORANGE, 0.15),
    (3.9, 0.21, 4.2, 0.35, LEAF_GOLD, -0.3),
    (4.8, 0.19, 5.1, 0.3, LEAF_RED, 0.15),
    (5.6, 0.19, 5.6, 0.4, LEAF_AMBER, -0.3),
]
MOUND_RADII = (0.34, 0.315, 0.13)
# Height follows (1 - r^2)^(profile / 2) across the pile: above 2 the sides
# flare out low and meet the ground softly, so the heap has a high rounded
# centre and a soft edge instead of a cushion's steep wall.
MOUND_PROFILE = 2.6
LEAF_SIZE = (0.25, 0.14, 0.038)


def scatter_leaves(builder, leaves, scale=1.0, leaf_scale=1.0, offset=(0.0, 0.0), segments=16, rings=7):
    """Lays leaves on whatever the builder holds so far, following its surface."""
    tree = BVHTree.FromBMesh(builder.bm)
    length, width, thickness = (value * leaf_scale for value in LEAF_SIZE)
    for index, (angle, distance, yaw, tilt, hex_value, rest) in enumerate(leaves):
        x = offset[0] + distance * scale * math.cos(angle)
        y = offset[1] + distance * scale * math.sin(angle)
        point, basis = surface_frame(tree, x, y)
        # Each leaf rests on the pile with its stem end lifted a little; the
        # tucked ones sink part way into the heap.
        add_leaf(
            builder, point + basis.col[2].xyz * thickness * rest, length, width,
            thickness, yaw, hex_value, f"Leaf_{index + 1:02d}", pitch=-tilt,
            curl=-0.06, segments=segments, rings=rings, placement=basis,
        )


def build_leaf_mound(builder, scale=1.0, leaf_scale=1.0, segments=32, rings=10, leaf_segments=16, leaf_rings=7):
    rx, ry, rz = (value * scale for value in MOUND_RADII)
    add_dome(
        builder, (0.0, 0.0, 0.0), (rx, ry, rz), LEAF_MOUND, "PileBase",
        lobes=PILE_LOBES, segments=segments, rings=rings, profile=MOUND_PROFILE, sharpness=4,
    )
    scatter_leaves(builder, MOUND_LEAVES, scale, leaf_scale, segments=leaf_segments, rings=leaf_rings)


PILE_TOP = 0.172  # The piles' hitbox is 0.18 high.


def fit_height(bm, top):
    """Scales the whole mesh down in Z, if needed, so it ends at `top`."""
    highest = max(vert.co.z for vert in bm.verts)
    if highest > top:
        for vert in bm.verts:
            vert.co.z *= top / highest
        bm.normal_update()


def restyle_leaf_pile_mound():
    set_materials({"Material.AutumnLeafPileMound.Palette": SATIN})
    builder = Builder()
    build_leaf_mound(builder)
    fit_height(builder.bm, PILE_TOP)
    builder.commit(obj("AutumnLeafPileMound_Leaves"))


CRESCENT_RADIUS = 0.235
CRESCENT_HALF_LENGTH = 0.6
CRESCENT_HALF_WIDTH = 0.15
CRESCENT_HEIGHT = 0.118
# Leaves along the crescent: (arc position -1..1, across, yaw, colour, rest).
CRESCENT_LEAVES = [
    (-0.74, 0.0, 0.5, LEAF_ORANGE, 0.15),
    (-0.46, -0.03, 3.6, LEAF_GOLD, -0.3),
    (-0.17, 0.04, -0.4, LEAF_RED, 0.15),
    (0.12, -0.03, 2.7, LEAF_AMBER, -0.3),
    (0.42, 0.03, 0.3, LEAF_GOLD, 0.15),
    (0.72, -0.01, 3.4, LEAF_RED, -0.3),
]


def bend_onto_arc(verts, radius):
    """Wraps a shape lying along X onto a circle around the origin.

    The angle runs against X so the map keeps its handedness (tangent x
    radial = +Z): faces keep their winding and the normals stay outward.
    """
    for vert in verts:
        x, y, z = vert.co
        angle = -x / radius
        distance = radius + y
        vert.co = Vector((distance * math.cos(angle), distance * math.sin(angle), z))


def restyle_leaf_pile_crescent():
    set_materials({"Material.AutumnLeafPileCrescent.Palette": SATIN})
    builder = Builder()
    add_dome(
        builder, (0.0, 0.0, 0.0),
        (CRESCENT_HALF_LENGTH, CRESCENT_HALF_WIDTH, CRESCENT_HEIGHT), LEAF_MOUND, "PileBase",
        lobes=[((0.3, 1, 0.2), 0.08), ((-0.4, -1, 0.2), 0.08), ((0.35, 0.1, 1), 0.2),
               ((-0.4, -0.1, 1), 0.2), ((0.0, 0.05, 1), 0.08), ((0.75, -0.05, 1), 0.1), ((-0.75, 0.05, 1), 0.1)],
        segments=64, rings=9, profile=2.4, sharpness=4,
    )
    leaves = [
        (math.atan2(across, along * CRESCENT_HALF_LENGTH), math.hypot(along * CRESCENT_HALF_LENGTH, across), yaw, 0.18, hex_value, rest)
        for along, across, yaw, hex_value, rest in CRESCENT_LEAVES
    ]
    scatter_leaves(builder, leaves)
    bend_onto_arc(set(builder.bm.verts), CRESCENT_RADIUS)
    fit_height(builder.bm, PILE_TOP)
    builder.bm.normal_update()
    builder.commit(obj("AutumnLeafPileCrescent_Leaves"))


# ----------------------------------------------------------------- leaf rake
RAKE_HANDLE = "timber_light"
RAKE_HANDLE_TIP = "timber_dark"
RAKE_FERRULE = "iron"
RAKE_TINE = "iron"
RAKE_TINES = [-0.22, -0.11, 0.0, 0.11, 0.22]


def restyle_leaf_rake():
    set_materials({"Material.LeafRake.Palette": SATIN})
    builder = Builder()
    # The rake leans into a smaller copy of the mound pile.
    build_leaf_mound(builder, scale=0.82, leaf_scale=0.9, segments=28, rings=8, leaf_segments=14)
    handle_low = Vector((0.0, 0.105, 0.15))
    handle_high = Vector((-0.155, -0.105, 1.045))
    add_tube(builder, [handle_low, handle_high], 0.04, RAKE_HANDLE, "Handle", segments=10)
    add_lobed_sphere(
        builder, handle_high, (0.048, 0.048, 0.044), RAKE_HANDLE_TIP, "HandleTip",
        segments=12, rings=8,
    )
    add_cylinder(
        builder, (0.008, 0.115, 0.1), (-0.014, 0.088, 0.215), 0.052, RAKE_FERRULE,
        "Ferrule", segments=12, round_radius=0.018,
    )
    add_tube(
        builder, [(-0.245, 0.253, 0.075), (0.245, 0.253, 0.075)], 0.03, RAKE_FERRULE,
        "HeadBrace", segments=10,
    )
    for index, x in enumerate(RAKE_TINES):
        add_tube(
            builder,
            [(x * 0.2, 0.125, 0.14), (x, 0.262, 0.075), (x * 1.02, 0.31, 0.03)],
            [0.02, 0.019, 0.018], RAKE_TINE, f"Tine_{index + 1:02d}", segments=8,
        )
    builder.commit(obj("LeafRake_Arrangement"))


# --------------------------------------------------------------- bird feeder
def restyle_bird_feeder():
    set_materials({"Material.BirdFeeder.Timber": SATIN})
    builder = Builder()
    add_box(builder, (-0.32, -0.068, 0.0), (0.32, 0.068, 0.085), 0.034, "timber_dark", "FootX", sharp_sides=("-z",))
    add_box(builder, (-0.068, -0.32, 0.0), (0.068, 0.32, 0.09), 0.034, "timber_dark", "FootY", sharp_sides=("-z",))
    add_box(builder, (-0.065, -0.065, 0.05), (0.065, 0.065, 0.745), 0.036, "timber_dark", "Post", sharp_sides=("-z",))
    tray = round_profile(
        [(0.0, 0.73), (0.3, 0.73), (0.34, 0.765), (0.34, 0.835), (0.285, 0.835), (0.275, 0.795), (0.0, 0.795)],
        0.022,
    )
    add_lathe(
        builder, 0.0, 0.0, tray,
        lambda r, z: "timber_dark" if (z < 0.8 and z > 0.79 and r < 0.27) else "timber_light",
        "Tray", segments=28,
    )
    for index, axis in enumerate(((1, 0, 0), (0, 1, 0))):
        end = Vector(axis) * 0.385
        add_tube(builder, [-end + Vector((0, 0, 0.765)), end + Vector((0, 0, 0.765))], 0.03, "timber_light", f"Perch{index}", segments=10)
    for index, ((x, y), hex_value, yaw) in enumerate(
        [((-0.13, -0.08), "hay", 0.4), ((0.05, -0.13), "cream", 1.9), ((0.14, 0.06), "nut_caramel", 0.9),
         ((-0.06, 0.1), "cream", 2.6), ((0.0, 0.0), "hay", 1.4)]
    ):
        add_leaf(builder, (x, y, 0.808), 0.1, 0.07, 0.05, yaw, hex_value, f"Seed{index}", segments=12, rings=6)
    builder.commit(obj("BirdFeeder_Arrangement"))


# ---------------------------------------------------------- seed drying rack
RACK_POST_X = 0.36
RACK_POST_Y = 0.25
RACK_POST = 0.085
RACK_TRAYS = (0.215, 0.49)
RACK_TRAY_HALF = (RACK_POST_X - RACK_POST / 2 - 0.004, 0.27)


def restyle_seed_drying_rack():
    set_materials({"Material.GardenTeaTable.SeedDryingRack.Timber": SATIN})
    builder = Builder()
    half = RACK_POST / 2
    for i, x in enumerate((-RACK_POST_X, RACK_POST_X)):
        for j, y in enumerate((-RACK_POST_Y, RACK_POST_Y)):
            add_box(builder, (x - 0.06, y - 0.065, 0.0), (x + 0.06, y + 0.065, 0.065), 0.026, "timber_dark", f"Foot{i}{j}", segments=2, sharp_sides=("-z",))
            add_box(builder, (x - half, y - half, 0.04), (x + half, y + half, 0.83), 0.026, "timber_dark", f"Post{i}{j}")
        add_box(builder, (x - 0.055, -0.31, 0.81), (x + 0.055, 0.31, 0.895), 0.03, "timber_light", f"TopSide{i}")
    add_box(builder, (-0.41, -0.04, 0.885), (0.41, 0.04, 0.965), 0.03, "timber_light", "HangingRail")
    tx, ty = RACK_TRAY_HALF
    for i, z in enumerate(RACK_TRAYS):
        add_tray(builder, (-tx, -ty, z), (tx, ty, z + 0.11), 0.045, 0.035, 0.016, "timber_light", "timber_dark", f"Tray{i}")
        for j, (x, hex_value) in enumerate(zip((-0.17, 0.0, 0.17), ("hay", "hay_shade", "hay"))):
            add_box(builder, (x - 0.065, -0.17, z + 0.03), (x + 0.065, 0.17, z + 0.08), 0.02, hex_value, f"Tray{i}DryingBundle{j}", segments=2, sharp_sides=("-z",))
    for i, x in enumerate((-0.19, 0.0, 0.19)):
        add_tube(builder, [(x, 0.0, 0.9), (x, 0.0, 0.76)], 0.018, "hay_shade", f"HangingStem{i}", segments=8)
        add_lathe(
            builder, x, 0.0,
            round_profile([(0.0, 0.62), (0.045, 0.645), (0.062, 0.7), (0.05, 0.76), (0.022, 0.795), (0.0, 0.8)], 0.02),
            lambda r, z: "nut_caramel", f"HangingHead{i}", segments=10,
        )
    builder.commit(obj("SeedDryingRack_Arrangement"))


# ----------------------------------------------------------- garden tea table
TABLE_TOP = 0.643
TABLE_LEG_X = 0.33
TABLE_LEG_Y = 0.255
TABLE_LEG = 0.12
TEA_LEVEL = 0.7732
MUGS = [
    # (name, x, y, body, rim)
    ("Left", -0.2, -0.13, "cream", "enamel_blue"),
    ("Right", 0.2, -0.03, "cream", "textile_rust"),
]


def restyle_garden_tea_table():
    set_materials({"Material.GardenTeaTable.Timber": SATIN, "Material.GardenTeaTable.Enamel": ENAMEL})
    builder = Builder()
    frame, top, shelf = "timber_dark", "timber_light", "timber_light"
    half = TABLE_LEG / 2
    for x in (-TABLE_LEG_X, TABLE_LEG_X):
        for y in (-TABLE_LEG_Y, TABLE_LEG_Y):
            add_box(builder, (x - half, y - half, 0.0), (x + half, y + half, 0.56), 0.035, frame, "OutletDisplayTable_Frame", sharp_sides=("-z",))
    inner_x = TABLE_LEG_X - half
    inner_y = TABLE_LEG_Y - half
    for y in (-TABLE_LEG_Y, TABLE_LEG_Y):
        add_box(builder, (-inner_x, y - 0.035, 0.455), (inner_x, y + 0.035, 0.56), 0.025, frame, "OutletDisplayTable_Frame")
    for x in (-TABLE_LEG_X, TABLE_LEG_X):
        add_box(builder, (x - 0.035, -inner_y, 0.455), (x + 0.035, inner_y, 0.56), 0.025, frame, "OutletDisplayTable_Frame")
    for y in (-0.245, 0.0, 0.245):
        add_box(builder, (-0.432, y - 0.112, TABLE_TOP - 0.088), (0.432, y + 0.112, TABLE_TOP), 0.032, top, "OutletDisplayTable_TopPlanks")
    for y in (-0.13, 0.0, 0.13):
        add_box(builder, (-inner_x, y - 0.058, 0.18), (inner_x, y + 0.058, 0.245), 0.022, shelf, "OutletDisplayTable_LowerShelf", segments=2)
    builder.commit(obj("GardenTeaTable_Timber"))

    builder = Builder()
    for name, x, y, body, rim in MUGS:
        profile = round_profile(
            [(0.0, TABLE_TOP), (0.062, TABLE_TOP), (0.074, TABLE_TOP + 0.03), (0.074, 0.782), (0.07, 0.797),
             (0.054, 0.797), (0.052, 0.784), (0.052, TEA_LEVEL)],
            0.012, steps=1,
        ) + [(0.0, TEA_LEVEL)]

        def mug_colour(r, z, body=body, rim=rim):
            if abs(z - TEA_LEVEL) < 0.0005 and r < 0.052:
                return "conker"
            return rim if z > 0.768 else body

        add_lathe(builder, x, y, profile, mug_colour, f"Mug{name}", segments=16)
        add_tube(
            builder,
            [(x + 0.064, y, 0.768), (x + 0.1, y, 0.765), (x + 0.115, y, 0.725), (x + 0.1, y, 0.688), (x + 0.064, y, 0.685)],
            0.017, rim, f"Mug{name}Handle", segments=8,
        )
    thermos = round_profile(
        [(0.0, TABLE_TOP), (0.074, TABLE_TOP), (0.082, TABLE_TOP + 0.03), (0.082, 0.875), (0.066, 0.9),
         (0.068, 0.905), (0.068, 0.945), (0.058, 0.955), (0.0, 0.955)],
        0.014, steps=1,
    )

    def thermos_colour(r, z):
        # Evergreen enamel body with a cream band and a cream cup lid.
        if z > 0.9 or 0.665 < z < 0.69:
            return "cream"
        return "evergreen"

    add_lathe(builder, -0.08, 0.16, thermos, thermos_colour, "Thermos", segments=18)
    builder.commit(obj("GardenTeaTable_TeaSet"))


# ------------------------------------------------------ autumn blanket bench
BENCH_SEAT_TOP = 0.392
BENCH_LEG_X = (0.389, 0.513)
BENCH_LEG_Y = (0.066, 0.165)


def restyle_autumn_blanket_bench():
    set_materials({"Material.AutumnBlanketBench.Timber": SATIN, "Material.AutumnBlanketBench.Textile": MATTE})
    builder = Builder()
    # Dark timber for the legs and rails, light timber for the seat and braces.
    dark, light = "timber_dark", "timber_light"
    x0, x1 = BENCH_LEG_X
    y0, y1 = BENCH_LEG_Y
    for sx, xn in ((1, "Right"), (-1, "Left")):
        for sy, yn in ((-1, "Front"), (1, "Back")):
            lo = (min(sx * x0, sx * x1), min(sy * y0, sy * y1) - (0.006 if sy < 0 else 0), 0.0)
            hi = (max(sx * x0, sx * x1), max(sy * y0, sy * y1) + (0.006 if sy > 0 else 0), BENCH_SEAT_TOP - 0.068)
            add_box(builder, lo, hi, 0.034, dark, f"WoodenBench_Leg{yn}{xn}", sharp_sides=("-z",))
        cx = sx * (x0 + x1) / 2
        add_box(builder, (cx - 0.035, -y0, 0.2), (cx + 0.035, y0, 0.275), 0.022, light, f"WoodenBench_EndBrace{xn}")
    for sy, yn in ((-1, "Front"), (1, "Back")):
        add_box(builder, (-x0, sy * 0.1065 - 0.03, 0.25), (x0, sy * 0.1065 + 0.03, 0.324), 0.022, dark, f"WoodenBench_SupportRail{yn}")
    for y, colour_hex, name in ((-0.1065, light, "Front"), (0.0, light, "Center"), (0.1065, light, "Back")):
        add_box(builder, (-0.546, y - 0.0445, BENCH_SEAT_TOP - 0.07), (0.546, y + 0.0445, BENCH_SEAT_TOP), 0.028, colour_hex, f"WoodenBench_SeatSlat{name}")
    builder.commit(obj("AutumnBlanketBench_Timber"))

    # The throw drapes over the right half of the seat, between the legs,
    # with two broad rust bands across it.
    builder = Builder()
    bm = builder.bm
    thickness = 0.036
    path = round_profile(
        [(-0.205, 0.2), (-0.172, 0.33), (-0.165, BENCH_SEAT_TOP + 0.016), (-0.05, BENCH_SEAT_TOP + 0.03),
         (0.06, BENCH_SEAT_TOP + 0.024), (0.165, BENCH_SEAT_TOP + 0.016), (0.172, 0.33), (0.19, 0.215)],
        0.05, steps=3,
    )
    # Offset the drape path to both sides to get a closed cross-section.
    outline_out, outline_in = [], []
    for index, point in enumerate(path):
        point = Vector(point)
        previous = Vector(path[max(0, index - 1)])
        following = Vector(path[min(len(path) - 1, index + 1)])
        tangent = (following - previous).normalized()
        normal = Vector((-tangent.y, tangent.x))
        if normal.y < 0 and abs(tangent.x) > 0.5:
            normal = -normal
        if abs(tangent.x) <= 0.5:
            normal = Vector((math.copysign(1, point.x), 0)) if normal.dot(Vector((point.x, 0))) < 0 else normal
        outline_out.append(point + normal * thickness / 2)
        outline_in.append(point - normal * thickness / 2)
    section = [(v.x, v.y) for v in outline_out] + [(v.x, v.y) for v in reversed(outline_in)]
    stations = [0.0, 0.07, 0.12, 0.25, 0.3, 0.37]
    bands = {1: "textile_rust", 3: "textile_rust"}
    rings = [[bm.verts.new((x, a, b)) for a, b in section] for x in stations]
    count = len(section)
    faces = []
    for index, (a, b) in enumerate(zip(rings, rings[1:])):
        band = [bm.faces.new((a[i], a[(i + 1) % count], b[(i + 1) % count], b[i])) for i in range(count)]
        faces += band
    start_cap = bm.faces.new(list(reversed(rings[0])))
    end_cap = bm.faces.new(rings[-1])
    faces += [start_cap, end_cap]
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    faces = bevel(bm, faces, 0.014, 2, edges=list(start_cap.edges) + list(end_cap.edges))
    bm.normal_update()
    builder.paint(faces, "cream", "FoldedThrow")
    for face in faces:
        if not face.is_valid:
            continue
        x = face.calc_center_median().x
        for index, hex_value in bands.items():
            if stations[index] < x < stations[index + 1]:
                builder.paint([face], hex_value, "FoldedThrow")
    builder.commit(obj("AutumnBlanketBench_Textile"))


# ------------------------------------------------------ autumn entrances
ENTRANCE_LEAVES = ["autumn_orange", "autumn_gold", "autumn_red"]
ENTRANCE_POST = "timber_light"
ENTRANCE_FOOT = "timber_dark"
ENTRANCE_TWIG = "trunk"


def hanging_leaf(builder, point, angle, hex_value, group, size=(0.2, 0.12, 0.036), y_offset=0.0):
    """A leaf in the XZ plane, its stem at `point` and tip along `angle`."""
    length, width, thickness = size
    direction = Vector((math.cos(angle), 0.0, math.sin(angle)))
    centre = Vector(point) + direction * (length / 2 - 0.02) + Vector((0, y_offset, 0))
    placement = Matrix.Rotation(-angle, 4, "Y") @ Matrix.Rotation(math.pi / 2, 4, "X")
    return add_leaf(
        builder, centre, length, width, thickness, 0.0, hex_value, group,
        curl=0.05, segments=16, rings=6, placement=placement,
    )


def restyle_autumn_garland():
    set_materials({"Material.AutumnEntrance.Timber": SATIN, "Material.AutumnEntrance.Leaves": SATIN})
    builder = Builder()
    for side in (-1, 1):
        x = side * 0.34
        add_box(builder, (x - 0.07, -0.125, 0.0), (x + 0.07, 0.125, 0.07), 0.03, ENTRANCE_FOOT, f"Foot{side}", sharp_sides=("-z",))
        add_box(builder, (x - 0.052, -0.052, 0.04), (x + 0.052, 0.052, 0.9), 0.034, ENTRANCE_POST, f"Post{side}")
    builder.commit(obj("AutumnGarland_Support"))

    builder = Builder()
    stations = 20
    cord = [
        (-0.34 + 0.68 * t / stations, 0.07, 0.84 - 0.19 * math.sin(math.pi * t / stations))
        for t in range(stations + 1)
    ]
    add_tube(builder, cord, 0.024, ENTRANCE_TWIG, "Cord", segments=8)
    count = 9
    for index in range(count):
        t = (index + 0.5) / count
        x = -0.34 + 0.68 * t
        z = 0.84 - 0.19 * math.sin(math.pi * t)
        angle = -math.pi / 2 + (0.42 if index % 2 else -0.42)
        hanging_leaf(
            builder, (x, 0.07, z - 0.01), angle, ENTRANCE_LEAVES[index % 3],
            f"GarlandLeaf{index}", y_offset=0.006 * (1 if index % 2 else -1),
        )
    builder.commit(obj("AutumnGarland_Foliage"))


def restyle_autumn_wreath_post():
    set_materials({"Material.AutumnEntrance.Timber": SATIN, "Material.AutumnEntrance.Leaves": SATIN})
    builder = Builder()
    add_box(builder, (-0.15, -0.16, 0.0), (0.15, 0.16, 0.075), 0.034, ENTRANCE_FOOT, "GroundFoot", sharp_sides=("-z",))
    add_box(builder, (-0.06, -0.06, 0.04), (0.06, 0.06, 0.94), 0.04, ENTRANCE_POST, "Upright")
    builder.commit(obj("AutumnWreathPost_Support"))

    builder = Builder()
    centre = Vector((0.0, 0.075, 0.73))
    ring_radius = 0.2
    ring = [
        centre + ring_radius * Vector((math.cos(math.tau * i / 24), 0.0, math.sin(math.tau * i / 24)))
        for i in range(24)
    ]
    add_tube(builder, ring, 0.045, ENTRANCE_TWIG, "TwigRing", segments=10, closed=True)
    count = 12
    for index in range(count):
        angle = math.tau * index / count + 0.2
        point = centre + ring_radius * Vector((math.cos(angle), 0.0, math.sin(angle)))
        # Leaves follow the ring round, alternating on its front and back
        # face, so the wreath reads as leafy from every side.
        tangent_angle = angle + math.pi / 2 + 0.35
        stem = point - 0.05 * Vector((math.cos(tangent_angle), 0, math.sin(tangent_angle)))
        side = 1 if index % 2 == 0 else -1
        hanging_leaf(
            builder, stem, tangent_angle, ENTRANCE_LEAVES[index % 3], f"WreathLeaf{index}",
            size=(0.19, 0.115, 0.036), y_offset=side * 0.032,
        )
    builder.commit(obj("AutumnWreathPost_Foliage"))


# ---------------------------------------------------------- autumn grasses
GRAVEL = "stone"
GRAVEL_LIGHT = "cream"
GRAVEL_DARK = "stone"
BLADES = ["hay", "hay", "hay_shade"]
# Wind roots, from the shared autumnGrassWind config (Blender axes).
GRASS_ROOTS = [(-0.1, -0.09), (0.12, -0.025), (-0.01, 0.13)]


def build_gravel(builder):
    profile = round_profile([(0.0, 0.0), (0.34, 0.0), (0.34, 0.012), (0.31, 0.032), (0.0, 0.032)], 0.012, steps=1)
    add_lathe(builder, 0.0, 0.0, profile, lambda r, z: GRAVEL, "GravelIsland", segments=22)
    for index, (x, y, size, hex_value) in enumerate(
        [(0.24, 0.12, 0.05, GRAVEL_LIGHT), (-0.22, 0.17, 0.045, GRAVEL_DARK), (0.05, -0.25, 0.05, GRAVEL_LIGHT), (-0.25, -0.12, 0.04, GRAVEL_DARK)]
    ):
        add_dome(
            builder, (x, y, 0.018), (size, size * 0.8, size * 0.55), hex_value, "GravelIsland",
            segments=9, rings=3, profile=0.8,
        )


def build_grass_clumps(builder, heights=(0.215, 0.24, 0.19, 0.235, 0.205, 0.225), lean=0.08):
    for clump, (cx, cy) in enumerate(GRASS_ROOTS):
        for blade in range(6):
            azimuth = math.tau * blade / 6 + clump * 0.7
            add_blade(
                builder, (cx + 0.025 * math.cos(azimuth), cy + 0.025 * math.sin(azimuth), 0.025),
                azimuth, heights[(blade + clump) % len(heights)], lean * (0.75 + 0.15 * (blade % 3)),
                0.068, 0.036, BLADES[(blade + clump) % 3], f"Clump{clump}Blade{blade}",
                tip_width=0.036,
            )


def restyle_autumn_grass_tuft():
    # Dry grass is the matte hay role; the gravel island is the stone role.
    set_materials({"Material.AutumnGrasses.Blades": MATTE, "Material.AutumnGrasses.Gravel": STONE})
    builder = Builder()
    build_gravel(builder)
    builder.commit(obj("AutumnGrassTuft_Base"))
    builder = Builder()
    build_grass_clumps(builder)
    builder.commit(obj("AutumnGrassTuft_Foliage"))


SEED_STEMS = [
    # (x, y, top of stem, lean x, lean y)
    (-0.12, -0.1, 0.41, -0.02, -0.01),
    (-0.06, 0.01, 0.49, -0.01, 0.0),
    (0.13, -0.05, 0.45, 0.02, -0.01),
    (0.18, 0.05, 0.38, 0.03, 0.01),
    (0.0, 0.15, 0.43, 0.0, 0.02),
]
SEED_STEM = "hay_shade"
SEED_HEADS = ["nut_caramel", "cream"]


def restyle_autumn_seed_heads():
    set_materials({"Material.AutumnGrasses.Blades": MATTE, "Material.AutumnGrasses.Gravel": STONE})
    builder = Builder()
    build_gravel(builder)
    builder.commit(obj("AutumnSeedHeads_Base"))
    builder = Builder()
    build_grass_clumps(builder, heights=(0.19, 0.22, 0.17, 0.21, 0.18), lean=0.07)
    for index, (x, y, top, lx, ly) in enumerate(SEED_STEMS):
        add_tube(
            builder, [(x, y, 0.025), (x + lx * 0.5, y + ly * 0.5, top * 0.6), (x + lx, y + ly, top)],
            0.018, SEED_STEM, f"SeedStem{index}", segments=6,
        )
        add_lathe(
            builder, x + lx, y + ly,
            round_profile([(0.0, top - 0.04), (0.04, top - 0.02), (0.056, top + 0.05), (0.04, top + 0.13), (0.0, top + 0.17)], 0.025),
            lambda r, z, index=index: SEED_HEADS[index % 2], f"SeedHead{index}", segments=10,
        )
    builder.commit(obj("AutumnSeedHeads_Foliage"))


# --------------------------------------------------------------- shrub
# Lobes for small canopy masses: soft swellings, not a cluster of balls.
SHRUB_LOBES = [
    ((math.cos(angle), math.sin(angle), 0.45), 0.2)
    for angle in [0.3, 1.2, 2.1, 3.0, 3.9, 4.8, 5.6]
] + [((0.25, -0.2, 1.0), 0.17), ((-0.3, 0.25, 0.9), 0.15)]


def turn_to_camera(builder):
    """Turns the shrub half round, so the orange mass sits in front of the
    gold one from the default camera instead of hiding behind it."""
    bmesh.ops.rotate(
        builder.bm, cent=(0.0, 0.0, 0.0), matrix=Matrix.Rotation(math.pi, 3, "Z"),
        verts=list(builder.bm.verts),
    )
    builder.bm.normal_update()


def restyle_autumn_shrub():
    # The runtime recolours the foliage per season (autumnShrubAppearance.ts);
    # the file colours are the peak autumn gold and orange.
    set_material_roles({
        "Material.AutumnShrub.Gold": ("autumn_gold", SATIN),
        "Material.AutumnShrub.Russet": ("autumn_orange", SATIN),
        "Material.AutumnShrub.Wood": ("trunk", TRUNK),
    })
    builder = Builder(colours=False)
    add_dome(builder, (0.0, 0.0, 0.0), (0.075, 0.075, 0.06), None, "Base", segments=12, rings=3)
    add_tube(builder, [(0.0, 0.0, 0.0), (0.0, 0.0, 0.1), (0.0, 0.005, 0.24), (0.0, 0.0, 0.4)], [0.048, 0.046, 0.042, 0.036], None, "Stem", segments=10, round_start=False)
    for end in [(-0.2, -0.13, 0.42), (0.17, -0.12, 0.38), (-0.17, 0.14, 0.46), (0.16, 0.15, 0.45), (0.03, -0.01, 0.56)]:
        mid = (end[0] * 0.45, end[1] * 0.45, 0.18 + (end[2] - 0.18) * 0.45)
        add_tube(builder, [(0.0, 0.0, 0.14), mid, end], [0.032, 0.028, 0.024], None, "Branch", segments=8)
    turn_to_camera(builder)
    builder.commit(obj("AutumnShrub_Wood"))

    stages = {
        # The full crown is a low wide mound that sits down on the root base,
        # like the core Bush, with the second colour as a smaller mound at
        # its side.
        "AutumnShrub_FullGold": [((-0.06, 0.03, 0.29), (0.276, 0.285, 0.25), 28, 16, 0.035)],
        "AutumnShrub_FullRusset": [((0.18, -0.06, 0.225), (0.184, 0.23, 0.184), 24, 14, 0.03)],
        # Thinning keeps the same two-colour mound, smaller and lifted onto
        # the branches so the stem shows under it: one soft form per
        # colour, not a cluster of balls (GAME_ART.md, Shape).
        "AutumnShrub_ThinningGold": [((-0.05, 0.03, 0.35), (0.215, 0.225, 0.16), 20, 11, 0.2)],
        "AutumnShrub_ThinningRusset": [((0.16, -0.06, 0.31), (0.13, 0.17, 0.12), 14, 8, 0.2)],
        # Sparse leaves the branches bare: the last leaves lie in one low,
        # irregular mound around the root, so the stage never reads as balls
        # on sticks.
        "AutumnShrub_SparseGold": [((-0.06, 0.03, 0.0), (0.25, 0.23, 0.1), 16, 8, 0.004)],
        "AutumnShrub_SparseRusset": [((0.17, -0.08, 0.0), (0.12, 0.15, 0.07), 12, 7, 0.004)],
    }
    for name, masses in stages.items():
        builder = Builder(colours=False)
        for centre, radii, segments, rings, floor in masses:
            # Broad swellings, as on the core Bush mound: a sharper falloff
            # raised small blisters on the crown.
            add_lobed_sphere(
                builder, centre, radii, None, name, lobes=SHRUB_LOBES, segments=segments,
                rings=rings, sharpness=3, floor=floor,
            )
        turn_to_camera(builder)
        builder.commit(obj(name))


# --------------------------------------------------------- seasonal maple
MAPLE_CROWN_LOBES = [
    ((math.cos(angle), math.sin(angle), 0.3), 0.22)
    for angle in [index * math.tau / 7 + 0.4 for index in range(7)]
] + [
    ((math.cos(angle) * 0.55, math.sin(angle) * 0.55, 1.0), 0.17)
    for angle in (0.9, 3.0, 5.1)
]
MAPLE_BRANCHES = [(-0.2, -0.06, 1.12), (0.21, 0.03, 1.18), (-0.06, 0.17, 1.33), (0.1, -0.16, 1.42), (0.02, 0.01, 1.6)]


def restyle_seasonal_maple():
    # The leaf colour is the summer canopy green; the runtime turns it through
    # the autumn canopy stops (scene/autumnPalette.ts), as on the core tree.
    set_material_roles({
        "Material.SeasonalMaple.Leaves": ("canopy", SATIN),
        "Material.SeasonalMaple.Wood": ("trunk", TRUNK),
    })
    builder = Builder(colours=False)
    add_dome(builder, (0.0, 0.0, 0.0), (0.15, 0.15, 0.09), None, "Roots", segments=14, rings=3,
             lobes=[((math.cos(a), math.sin(a), 0), 0.18) for a in (0.5, 2.6, 4.7)], sharpness=6)
    add_tube(builder, [(0.0, 0.0, 0.0), (0.0, 0.0, 0.16), (0.01, 0.0, 0.52), (0.0, 0.0, 0.98)], [0.105, 0.098, 0.088, 0.074], None, "Trunk", segments=12, round_start=False)
    for end in MAPLE_BRANCHES:
        start = (0.0, 0.0, 0.82 + 0.1 * (end[2] > 1.4))
        mid = (end[0] * 0.5, end[1] * 0.5, (start[2] + end[2]) / 2 + 0.04)
        add_tube(builder, [start, mid, end], [0.05, 0.04, 0.032], None, "Branch", segments=8)
    builder.commit(obj("SeasonalMaple_Wood"))

    stages = {
        "SeasonalMaple_Full": [((0.0, 0.0, 1.27), (0.355, 0.355, 0.415), 36, 22, 0.88)],
        "SeasonalMaple_Thinning": [
            ((-0.05, 0.03, 1.33), (0.27, 0.27, 0.3), 22, 14, None),
            ((0.21, -0.1, 1.18), (0.13, 0.13, 0.12), 14, 8, None),
        ],
        # One small remnant clump nestled among the branches on one side,
        # so most branches show bare: a ball on every branch tip read as
        # toadstools on stalks.
        "SeasonalMaple_Sparse": [((-0.08, 0.06, 1.36), (0.17, 0.16, 0.13), 22, 12, None)],
    }
    for name, masses in stages.items():
        builder = Builder(colours=False)
        for centre, radii, segments, rings, floor in masses:
            add_lobed_sphere(
                builder, centre, radii, None, name, lobes=MAPLE_CROWN_LOBES,
                segments=segments, rings=rings, sharpness=10, floor=floor,
            )
        builder.commit(obj(name))


# ------------------------------------------------------ autumn fence gate
def copy_surface(source, target):
    """Copies base colour, roughness and metalness between flat materials."""
    source_shader = party_style.principled(source)
    target_shader = party_style.principled(target)
    for socket in ("Base Color", "Roughness", "Metallic"):
        target_shader.inputs[socket].default_value = source_shader.inputs[socket].default_value
    target.diffuse_color = source.diffuse_color
    target.roughness = source.roughness
    target.metallic = source.metallic


def copy_gate_from_fence_gate():
    """Replaces the gate posts and leaf with exact copies from FenceGate.blend.

    The release test requires identical post and leaf geometry. The copies
    keep this file's own material slots, and Material.Planks takes the
    colour and roughness of FenceGate's planks: the shared wood profile
    (timberAssetPalette.unit.ts), so the autumn gate matches the plain one.
    """
    source = ASSETS_DIR / "FenceGate.blend"
    names = {"FenceGate_Posts": "AutumnFenceGate_Posts", "FenceGate_Leaf": "AutumnFenceGate_Leaf"}
    local_materials = {
        name: bpy.data.materials[name] for name in ("Material.Planks", "Material.FenceGate.Hardware")
    }
    for old_name in names.values():
        old = bpy.data.objects.get(old_name)
        if old is not None:
            mesh = old.data
            bpy.data.objects.remove(old, do_unlink=True)
            if mesh.users == 0:
                bpy.data.meshes.remove(mesh)
    with bpy.data.libraries.load(str(source), link=False) as (data_from, data_to):
        data_to.objects = list(names)
    appended_materials = set()
    for copied in data_to.objects:
        bpy.context.scene.collection.objects.link(copied)
        target = names[copied.name]
        copied.name = target
        # Mesh data names become glTF mesh names, which the runtime looks up
        # (AutumnFenceGate_Leaf_Mesh, AutumnFenceGate_Leaf_Mesh_1).
        copied.data.name = copied.data.name.replace("FenceGate", "AutumnFenceGate", 1)
        for slot in copied.material_slots:
            material = slot.material
            # Appended copies arrive as "Material.Planks.001" and so on.
            base = re.sub(r"\.\d{3}$", "", material.name)
            if material is not local_materials[base]:
                appended_materials.add(material)
                if base == "Material.Planks":
                    copy_surface(material, local_materials[base])
            slot.material = local_materials[base]
    for material in appended_materials:
        if material.users == 0:
            bpy.data.materials.remove(material)
    for image in list(bpy.data.images):
        if image.users == 0:
            bpy.data.images.remove(image)


def restyle_autumn_fence_gate():
    # Material.Planks takes FenceGate's shared wood profile in
    # copy_gate_from_fence_gate, so the two gates show one wood tone. The
    # hinges and latch are the iron role.
    set_materials({"Material.AutumnEntrance.Pumpkins": GLOSS})
    set_material_roles({"Material.FenceGate.Hardware": ("iron", GLOSS)})
    copy_gate_from_fence_gate()
    builder = Builder()
    for index, (x, height, hex_value) in enumerate([(-0.43, 0.15, "pumpkin"), (0.43, 0.135, "pumpkin_light")]):
        add_pumpkin(builder, (x, 0.0, 0.545), 0.088, height, hex_value, f"PostPumpkin{index}_Body")
        top = 0.545 + height
        add_tube(
            builder, [(x, 0.0, top - 0.03), (x + 0.004, 0.003, top + 0.01), (x + 0.02, 0.008, top + 0.035)],
            [0.022, 0.019, 0.017], "crop_leaf", f"PostPumpkin{index}_Stem", segments=8,
        )
    builder.commit(obj("AutumnFenceGate_Decor"))


RESTYLERS = {
    "FallenLog": restyle_fallen_log,
    "StackedFirewood": restyle_stacked_firewood,
    "AutumnLeafPileMound": restyle_leaf_pile_mound,
    "AutumnLeafPileCrescent": restyle_leaf_pile_crescent,
    "LeafRake": restyle_leaf_rake,
    "BirdFeeder": restyle_bird_feeder,
    "SeedDryingRack": restyle_seed_drying_rack,
    "GardenTeaTable": restyle_garden_tea_table,
    "AutumnBlanketBench": restyle_autumn_blanket_bench,
    "AutumnGarland": restyle_autumn_garland,
    "AutumnWreathPost": restyle_autumn_wreath_post,
    "AutumnGrassTuft": restyle_autumn_grass_tuft,
    "AutumnSeedHeads": restyle_autumn_seed_heads,
    "AutumnShrub": restyle_autumn_shrub,
    "SeasonalMaple": restyle_seasonal_maple,
    "AutumnFenceGate": restyle_autumn_fence_gate,
}


def main():
    args = parse_args()
    wanted = args.asset or list(RESTYLERS)
    for name in wanted:
        if name not in RESTYLERS:
            raise SystemExit(f"unknown asset {name}")
    for name in wanted:
        path = ASSETS_DIR / f"{name}.blend"
        bpy.ops.wm.open_mainfile(filepath=str(path))
        bpy.context.preferences.filepaths.save_version = 0
        print(f"Restyling {name}")
        RESTYLERS[name]()
        bpy.context.scene["party_pass"] = "assets/scripts/party-pass-autumn.py"
        bpy.ops.wm.save_mainfile(filepath=str(path))
        backup = path.with_suffix(".blend1")
        if backup.exists():
            backup.unlink()


if __name__ == "__main__":
    main()
