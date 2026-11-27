"""Restyle the farmer avatar for the toy look in GAME_ART.md.

This was the first restyle pass for the animals and the avatar. It smoothed
the old low-poly meshes in place, which kept their long bodies, stick legs
and lumpy surfaces. All 17 animals are now rebuilt from scratch by
`assets/scripts/party-animals.py` (design modules in `party_animals/`, rules
in GAME_ART.md, "Animals"), so this pass only keeps `FarmerAvatar`, which was
not redesigned. Any other `--asset` is an error, so the pass can never put
an old low-poly animal back over its redesign.

`FarmerAvatar` is a pivot hierarchy that runtime code animates. This pass
never touches an object, its name, transform or parent, a material name or
an animation. It only rewrites the mesh data under the pivots, in place, and
the material colours:

- Box-like parts become rounded boxes sized by the bevel table in
  GAME_ART.md, with weighted normals; flat surface details (plaid, straps)
  are bevelled on their front face only.
- Organic parts (hands, boots, ears) are rebuilt as smooth, evenly
  tessellated blobs: the original island is smoothed by Catmull-Clark
  subdivision, sampled from its centre by an icosphere stretched to the
  island's proportions, and stretched back to its original bounds so joints
  still meet.
- The straw hat is a set of smooth revolved profiles.
- The head (with everything under the head pivot) grows about the head
  pivot, and the straps are thickened to at least 0.03 game units at the
  entity's `scale`. Every change happens in world space, so pivots stay
  where the code expects them.
- Colours are authored as the on-screen colour of a sunlit top face and
  converted to albedo with `party_style.screen_to_albedo`. Metalness is 0.

The original mesh of every touched object is kept in the .blend as a fake-user
mesh named `PartySource:<object>`; each run starts from it, so the script is
safe to run again. Those meshes are not linked to any object and do not
export.

Run from the repository root, then export:

    /Applications/Blender.app/Contents/MacOS/Blender -b \
        --python assets/scripts/party-pass-animals.py -- --asset FarmerAvatar
    (cd assets && Blender -b --python export-game-assets.py -- --asset FarmerAvatar)
"""

import argparse
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import party_style  # noqa: E402

ASSETS_DIR = Path(__file__).resolve().parents[1] / "game-assets"
SOURCE_PREFIX = "PartySource:"


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", action="append", default=[])
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


# ------------------------------------------------------------ source meshes
def source_mesh(obj):
    """The untouched mesh this pass started from, kept as a fake user."""
    name = SOURCE_PREFIX + obj.name
    mesh = bpy.data.meshes.get(name)
    if mesh is None:
        mesh = obj.data.copy()
        mesh.name = name
        mesh.use_fake_user = True
    return mesh


def restore_sources(objects):
    """Puts every object's original geometry back before reshaping."""
    for obj in objects:
        source = source_mesh(obj)
        bm = bmesh.new()
        bm.from_mesh(source)
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()


def mesh_objects(prefix):
    return [
        obj
        for obj in bpy.data.objects
        if obj.type == "MESH" and obj.name.startswith(prefix)
    ]


# ------------------------------------------------------------------ islands
def islands_of(bm):
    """Connected face groups, joined through shared vertices."""
    bm.faces.ensure_lookup_table()
    seen = set()
    groups = []
    for face in bm.faces:
        if face.index in seen:
            continue
        stack = [face]
        seen.add(face.index)
        group = []
        while stack:
            current = stack.pop()
            group.append(current)
            for vert in current.verts:
                for linked in vert.link_faces:
                    if linked.index not in seen:
                        seen.add(linked.index)
                        stack.append(linked)
        groups.append(group)
    return groups


def bounds(points):
    low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return low, high


def is_closed(faces):
    edges = {edge for face in faces for edge in face.edges}
    return all(len(edge.link_faces) == 2 for edge in edges)


def is_box(faces):
    """A cube or a cube with chamfered edges, as the farmer is built."""
    verts = {vert for face in faces for vert in face.verts}
    return len(verts) in (8, 24) and len(faces) in (6, 26)


def star_shaped(faces, centre):
    """True when every face looks away from `centre`, so rays from it hit
    the surface once."""
    low, high = bounds([v.co for f in faces for v in f.verts])
    size = max((high - low).length, 1e-6)
    for face in faces:
        offset = face.calc_center_median() - centre
        if face.normal.dot(offset) < -0.02 * size:
            return False
    return True


# ---------------------------------------------------------------- smoothing
def subdivided_copy(faces, levels):
    """Catmull-Clark smoothed copy of an island, as a BVH and a bmesh."""
    island = bmesh.new()
    lookup = {}
    for face in faces:
        verts = []
        for vert in face.verts:
            if vert not in lookup:
                lookup[vert] = island.verts.new(vert.co)
            verts.append(lookup[vert])
        try:
            island.faces.new(verts)
        except ValueError:
            pass
    mesh = bpy.data.meshes.new("PartyTemp")
    island.to_mesh(mesh)
    island.free()
    temp = bpy.data.objects.new("PartyTemp", mesh)
    bpy.context.scene.collection.objects.link(temp)
    modifier = temp.modifiers.new("Smooth", "SUBSURF")
    modifier.levels = levels
    modifier.render_levels = levels
    modifier.use_limit_surface = True
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = temp.evaluated_get(depsgraph)
    smooth_mesh = evaluated.to_mesh()
    smooth = bmesh.new()
    smooth.from_mesh(smooth_mesh)
    evaluated.to_mesh_clear()
    bpy.data.objects.remove(temp)
    bpy.data.meshes.remove(mesh)
    return smooth


def fit_to_bounds(verts, target_low, target_high):
    low, high = bounds([vert.co for vert in verts])
    size = high - low
    target = target_high - target_low
    for vert in verts:
        for axis in range(3):
            if size[axis] > 1e-7:
                t = (vert.co[axis] - low[axis]) / size[axis]
                vert.co[axis] = target_low[axis] + t * target[axis]


def add_geodesic(bm, frequency):
    """Unit geodesic sphere: every icosahedron edge split into `frequency`
    parts, so 20 * frequency^2 triangles (20, 80, 180, 320, ...)."""
    base = bmesh.new()
    bmesh.ops.create_icosphere(base, subdivisions=1, radius=1.0)
    corners = [[vert.co.copy() for vert in face.verts] for face in base.faces]
    base.free()
    lookup = {}

    def vert(point):
        point = point.normalized()
        key = (round(point.x, 5), round(point.y, 5), round(point.z, 5))
        if key not in lookup:
            lookup[key] = bm.verts.new(point)
        return lookup[key]

    n = frequency
    faces = []
    for a, b, c in corners:
        grid = {}
        for i in range(n + 1):
            for j in range(n + 1 - i):
                grid[i, j] = vert((a * (n - i - j) + b * i + c * j) / n)
        for i in range(n):
            for j in range(n - i):
                faces.append(bm.faces.new((grid[i, j], grid[i + 1, j], grid[i, j + 1])))
                if i + j < n - 1:
                    faces.append(
                        bm.faces.new((grid[i + 1, j], grid[i + 1, j + 1], grid[i, j + 1]))
                    )
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return list(lookup.values())


def resample_island(bm_out, faces, frequency, material_of):
    """Adds a smooth, evenly tessellated copy of a star-shaped island."""
    low, high = bounds([v.co for f in faces for v in f.verts])
    smooth = subdivided_copy(faces, 2)
    smooth_low, smooth_high = bounds([v.co for v in smooth.verts])
    centre = (smooth_low + smooth_high) / 2
    half = (smooth_high - smooth_low) / 2
    tree = BVHTree.FromBMesh(smooth)
    new_verts = add_geodesic(bm_out, frequency)
    for vert in new_verts:
        direction = Vector((vert.co.x * half.x, vert.co.y * half.y, vert.co.z * half.z))
        if direction.length < 1e-9:
            continue
        direction.normalize()
        hit = tree.ray_cast(centre, direction)
        if hit[0] is None:
            # Tiny numerical misses: fall back to the ellipsoid.
            vert.co = centre + Vector(
                (vert.co.x * half.x, vert.co.y * half.y, vert.co.z * half.z)
            )
        else:
            vert.co = hit[0].copy()
    smooth.free()
    fit_to_bounds(new_verts, low, high)
    new_faces = list({face for vert in new_verts for face in vert.link_faces})
    for face in new_faces:
        face.material_index = material_of(face.calc_center_median())
        face.smooth = True
    return new_faces


def subdivide_island(bm_out, faces, levels, material_of):
    """Fallback for islands that are not star-shaped: bake a subdivision."""
    low, high = bounds([v.co for f in faces for v in f.verts])
    smooth = subdivided_copy(faces, levels)
    lookup = {}
    new_faces = []
    for face in smooth.faces:
        verts = []
        for vert in face.verts:
            if vert not in lookup:
                lookup[vert] = bm_out.verts.new(vert.co)
            verts.append(lookup[vert])
        new_face = bm_out.faces.new(verts)
        new_face.material_index = material_of(face.calc_center_median())
        new_face.smooth = True
        new_faces.append(new_face)
    smooth.free()
    if is_closed(faces):
        fit_to_bounds(list(lookup.values()), low, high)
    return new_faces


def rounded_box_island(bm_out, faces, radius, segments, material_index):
    """Replaces a (chamfered) box with a rounded box of the same bounds."""
    low, high = bounds([v.co for f in faces for v in f.verts])
    smallest = min(high - low)
    radius = min(radius if radius else party_style.bevel_radius_for(smallest), smallest * 0.45)
    new_faces = party_style.add_box(bm_out, low, high, radius=radius, segments=segments)
    for face in new_faces:
        face.material_index = material_index
        face.smooth = True
    return new_faces


def nearest_material(faces):
    """Material index of the original face nearest to a point."""
    island = bmesh.new()
    lookup = {}
    materials = []
    for face in faces:
        verts = []
        for vert in face.verts:
            if vert not in lookup:
                lookup[vert] = island.verts.new(vert.co)
            verts.append(lookup[vert])
        try:
            island.faces.new(verts)
            materials.append(face.material_index)
        except ValueError:
            pass
    tree = BVHTree.FromBMesh(island)
    island.free()
    uniform = len(set(materials)) == 1

    def lookup_material(point):
        if uniform:
            return materials[0]
        hit = tree.find_nearest(point)
        return materials[hit[2]] if hit[2] is not None else materials[0]

    return lookup_material


# ----------------------------------------------------------------- rebuild
def rebuild_object(obj, settings):
    """Rewrites one object's mesh as smooth blobs and rounded boxes."""
    mode = settings.get("mode", "auto")
    if mode == "keep":
        party_style.shade_smooth(obj)
        return
    source = bmesh.new()
    source.from_mesh(obj.data)
    out = bmesh.new()
    has_uv = len(obj.data.uv_layers) > 0
    uv_name = obj.data.uv_layers[0].name if has_uv else "UVMap"
    uv_layer = out.loops.layers.uv.new(uv_name)
    weighted = False
    for faces in islands_of(source):
        material_of = nearest_material(faces)
        verts = {v for f in faces for v in f.verts}
        low, high = bounds([v.co for v in verts])
        world_extent = max(
            (obj.matrix_world.to_3x3() @ Vector((size if axis == i else 0 for i in range(3)))).length
            for axis, size in enumerate(high - low)
        )
        centre = (low + high) / 2
        closed = is_closed(faces)
        island_mode = mode
        if island_mode == "auto":
            if not closed:
                island_mode = "keep"
            elif is_box(faces):
                island_mode = "box"
            elif star_shaped(faces, centre):
                island_mode = "resample"
            elif len(faces) > 40:
                island_mode = "keep"
            else:
                island_mode = "subdivide"
        if island_mode == "box":
            rounded_box_island(
                out,
                faces,
                settings.get("radius"),
                settings.get("segments", 2),
                faces[0].material_index,
            )
            weighted = True
        elif island_mode == "revolve":
            revolve_island(out, faces, settings, faces[0].material_index)
        elif island_mode == "front":
            front_box_island(out, faces, settings, faces[0].material_index)
            weighted = True
        elif island_mode == "resample":
            frequency = frequency_for(settings, world_extent)
            resample_island(out, faces, frequency, material_of)
        elif island_mode == "subdivide":
            subdivide_island(out, faces, settings.get("levels", 1), material_of)
        else:
            copy_island(out, faces)
    source.free()
    # Keep a UV layer so every part shares one vertex layout and batches.
    for face in out.faces:
        for loop in face.loops:
            loop[uv_layer].uv = (0.0, 0.0)
    if not has_uv:
        out.loops.layers.uv.remove(uv_layer)
    out.normal_update()
    out.to_mesh(obj.data)
    out.free()
    for modifier in list(obj.modifiers):
        if modifier.type in {"BEVEL", "WEIGHTED_NORMAL", "SUBSURF"}:
            obj.modifiers.remove(modifier)
    if weighted:
        party_style.add_weighted_normals(obj)
    obj.data.update()


def copy_island(bm_out, faces):
    lookup = {}
    for face in faces:
        verts = []
        for vert in face.verts:
            if vert not in lookup:
                lookup[vert] = bm_out.verts.new(vert.co)
            verts.append(lookup[vert])
        try:
            new_face = bm_out.faces.new(verts)
        except ValueError:
            continue
        new_face.material_index = face.material_index
        new_face.smooth = True


def revolve(bm, centre, radii, profile, segments):
    """A closed or open surface of revolution about the local z axis.

    `profile` lists (radius factor, z) from the bottom up; a radius factor of
    0 is a pole. `radii` are the x and y half widths at factor 1, so the
    outline can be an ellipse.
    """
    rings = []
    for factor, z in profile:
        if factor <= 1e-6:
            rings.append([bm.verts.new((centre[0], centre[1], z))])
            continue
        ring = []
        for step in range(segments):
            angle = 2 * math.pi * step / segments
            ring.append(
                bm.verts.new(
                    (
                        centre[0] + math.cos(angle) * radii[0] * factor,
                        centre[1] + math.sin(angle) * radii[1] * factor,
                        z,
                    )
                )
            )
        rings.append(ring)
    faces = []
    for lower, upper in zip(rings, rings[1:]):
        for step in range(segments):
            following = (step + 1) % segments
            if len(lower) == 1:
                faces.append(bm.faces.new((lower[0], upper[step], upper[following])))
            elif len(upper) == 1:
                faces.append(bm.faces.new((lower[step], upper[0], lower[following])))
            else:
                faces.append(
                    bm.faces.new((lower[step], lower[following], upper[following], upper[step]))
                )
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def revolve_island(bm_out, faces, settings, material_index):
    """Rebuilds a round part (hat crown, band, brim) as a smooth revolved
    profile that fills the island's bounds."""
    low, high = bounds([v.co for f in faces for v in f.verts])
    centre = (low + high) / 2
    radii = ((high.x - low.x) / 2, (high.y - low.y) / 2)
    height = high.z - low.z
    profile = [(factor, low.z + fraction * height) for factor, fraction in settings["profile"]]
    new_faces = revolve(bm_out, centre, radii, profile, settings.get("segments", 20))
    for face in new_faces:
        face.material_index = material_index
        face.smooth = True
    return new_faces


def front_box_island(bm_out, faces, settings, material_index):
    """A flat surface detail (plaid stripe, strap, buckle) as a box whose
    front face alone is bevelled: the back sits in the body and the sides are
    too shallow to show an edge."""
    low, high = bounds([v.co for f in faces for v in f.verts])
    axis, sign = settings.get("front", (1, 1))
    size = high - low
    result = bmesh.ops.create_cube(bm_out, size=1.0)
    verts = result["verts"]
    bmesh.ops.scale(bm_out, vec=size, verts=verts)
    bmesh.ops.translate(bm_out, vec=(low + high) / 2, verts=verts)
    box_faces = list({face for vert in verts for face in vert.link_faces})
    bm_out.normal_update()
    front = next(face for face in box_faces if face.normal[axis] * sign > 0.9)
    plan = sorted(size[index] for index in range(3) if index != axis)
    radius = min(settings.get("radius") or plan[0] * 0.35, size[axis] * 0.9, plan[0] * 0.45)
    before = set(bm_out.faces)
    bmesh.ops.bevel(
        bm_out,
        geom=list(front.edges),
        offset=radius,
        offset_type="OFFSET",
        segments=settings.get("segments", 1),
        profile=0.5,
        affect="EDGES",
        clamp_overlap=True,
    )
    new_faces = [face for face in box_faces if face.is_valid] + list(set(bm_out.faces) - before)
    for face in new_faces:
        face.material_index = material_index
        face.smooth = True
    return new_faces


def frequency_for(settings, extent):
    """Geodesic frequency of a resampled part: 20 * f^2 triangles."""
    if "freq" in settings:
        return settings["freq"]
    if "res" in settings:
        return {1: 1, 2: 2, 3: 4}[settings["res"]]
    return subdivisions_for(extent, settings)


def subdivisions_for(extent, settings):
    """Frequency for a part without an explicit `res` or `freq`.

    Medium and slender parts get 80 triangles, so they read as smooth
    spindles. Tiny parts (glints) get 20.
    """
    scale = settings["_length"]
    if extent < scale * settings.get("small", 0.06):
        return 1
    return 2


# ------------------------------------------------------------ transforming
def transform_world(obj, function):
    """Moves the object's vertices through a world-space function."""
    inverse = obj.matrix_world.inverted()
    for vert in obj.data.vertices:
        vert.co = inverse @ function(obj.matrix_world @ vert.co)
    obj.data.update()


def subtree(root_name):
    root = bpy.data.objects[root_name]
    result = []
    stack = list(root.children)
    while stack:
        obj = stack.pop()
        if obj.type == "MESH":
            result.append(obj)
        stack.extend(obj.children)
    return result


def scale_about(objects, centre, factor):
    factor = Vector(factor) if not isinstance(factor, (int, float)) else Vector((factor,) * 3)
    for obj in objects:
        transform_world(
            obj,
            lambda p: centre + Vector(
                ((p - centre).x * factor.x, (p - centre).y * factor.y, (p - centre).z * factor.z)
            ),
        )


def grow_head(pivot_name, factor, exclude=()):
    pivot = bpy.data.objects[pivot_name]
    centre = pivot.matrix_world.translation.copy()
    objects = [obj for obj in subtree(pivot_name) if obj.name not in exclude]
    scale_about(objects, centre, factor)


def island_axes(points):
    """Centre and the three principal axes of a point set, longest first."""
    centre = sum(points, Vector()) / len(points)
    covariance = Matrix(((0.0,) * 3,) * 3)
    for point in points:
        offset = point - centre
        for row in range(3):
            for column in range(3):
                covariance[row][column] += offset[row] * offset[column]
    axes = []
    for _ in range(3):
        axis = Vector((0.577, 0.577, 0.577))
        for previous in axes:
            axis -= previous * axis.dot(previous)
        for _ in range(60):
            axis = covariance @ axis
            for previous in axes:
                axis -= previous * axis.dot(previous)
            if axis.length < 1e-12:
                axis = Vector((1.0, 0.0, 0.0)) if not axes else axes[0].orthogonal()
                for previous in axes:
                    axis -= previous * axis.dot(previous)
            axis.normalize()
        axes.append(axis)
    return centre, axes


def min_thickness(object_names, target, keep_length=True, shorten=None, root=None):
    """Thickens each island of these parts so no cross dimension is under
    `target` (world units, before the entity scale). Long parts keep their
    length; `shorten` scales the long axis about the end nearest `root`
    (world point), so a whisker stays planted in the muzzle."""
    for name in existing(object_names):
        obj = bpy.data.objects[name]
        matrix = obj.matrix_world
        inverse = matrix.inverted()
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        for faces in islands_of(bm):
            verts = sorted({vert for face in faces for vert in face.verts}, key=lambda v: v.index)
            points = [matrix @ vert.co for vert in verts]
            centre, axes = island_axes(points)
            extents = [
                max((point - centre).dot(axis) for point in points)
                - min((point - centre).dot(axis) for point in points)
                for axis in axes
            ]
            factors = [max(1.0, target / extent) if extent > 1e-9 else 1.0 for extent in extents]
            if keep_length:
                factors[0] = 1.0
            anchor = centre
            if shorten is not None and root is not None:
                factors[0] = shorten
                ends = sorted(points, key=lambda point: (point - root).length)
                anchor = centre + axes[0] * (ends[0] - centre).dot(axes[0])
            for vert, point in zip(verts, points):
                offset = point - centre
                moved = Vector(centre)
                for axis, factor in zip(axes, factors):
                    along = offset.dot(axis)
                    if axis is axes[0] and shorten is not None and root is not None:
                        base = (anchor - centre).dot(axis)
                        along = base + (along - base) * factor
                    else:
                        along *= factor
                    moved += axis * along
                vert.co = inverse @ moved
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()


# ---------------------------------------------------------------- colours
def apply_colours(colours):
    for material_name, (screen, roughness) in colours.items():
        material = bpy.data.materials.get(material_name)
        if material is None:
            raise RuntimeError(f"missing material {material_name}")
        # Quantised to an 8-bit sRGB albedo, so the authored value is a hex.
        albedo = party_style.hex_to_linear(
            party_style.linear_to_hex(party_style.screen_to_albedo(screen))
        )
        shown = party_style.albedo_to_screen(albedo)
        miss = max(abs(int(shown[i : i + 2], 16) - int(screen[i : i + 2], 16)) for i in (1, 3, 5))
        if miss > 6:
            print(f"WARNING {material_name}: {screen} cannot be reached, shows {shown}")
        party_style.set_flat_colour(material, albedo, roughness)
    for material in bpy.data.materials:
        if party_style.principled(material) is not None:
            party_style.set_surface(
                material,
                party_style.principled(material).inputs["Roughness"].default_value,
            )


def clear_custom_normals(obj):
    attribute = obj.data.attributes.get("custom_normal")
    if attribute is not None:
        obj.data.attributes.remove(attribute)


# ------------------------------------------------------------------ assets
def settings_for(obj, config):
    settings = dict(config.get("default", {}))
    for pattern, override in config.get("parts", []):
        if pattern in obj.name:
            settings.update(override)
    settings["_length"] = config["length"]
    return settings


def restyle(name, config):
    prefix = config.get("prefix", name + "_")
    objects = mesh_objects(prefix)
    restore_sources(objects)
    for obj in objects:
        rebuild_object(obj, settings_for(obj, config))
        clear_custom_normals(obj)
    for step in config.get("shape", []):
        step()
    apply_colours(config.get("colours", {}))
    report_thin_parts(prefix, config)


def report_thin_parts(prefix, config):
    """Prints visible parts thinner than 0.03 game units at the entity scale."""
    scale = config.get("scale")
    if not scale:
        return
    for obj in sorted(mesh_objects(prefix), key=lambda o: o.name):
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        for faces in islands_of(bm):
            points = [obj.matrix_world @ v.co for v in {v for f in faces for v in f.verts}]
            centre, axes = island_axes(points)
            thinnest = min(
                max((p - centre).dot(axis) for p in points) - min((p - centre).dot(axis) for p in points)
                for axis in axes
            )
            if thinnest * scale < 0.03:
                print(f"THIN {obj.name}: {thinnest * scale:.3f} game units")
        bm.free()


def tri_count(prefix):
    return sum(party_style.evaluated_triangles(obj) for obj in mesh_objects(prefix))


# Shorthands for on-screen colours with a roughness band.
def matte(hex_value):
    return (hex_value, 0.8)


def satin(hex_value):
    return (hex_value, 0.55)


def gloss(hex_value):
    return (hex_value, 0.35)


# Eyes use the ink violet role from GAME_ART.md ("small facial features ...
# never black").
EYE = party_style.SEASONAL_ROLES["ink_violet"]
GLINT = gloss("#fff4dc")


def existing(names):
    return [name for name in names if name in bpy.data.objects]


def head(pivot, factor):
    return [lambda: grow_head(pivot, factor)]


def thick(names, target, **options):
    """No cross dimension under `target` (GLB units) for these parts."""
    return [lambda: min_thickness(names, target, **options)]


def sided(prefix, parts, sides=("L", "R")):
    return [f"{prefix}_{part}_{side}" for part in parts for side in sides]


ASSETS = {
    "FarmerAvatar": {
        "length": 2.15,
        "scale": 0.697,
        "default": {"segments": 2},
        "parts": [
            # A toy figure: a pillow-soft head, rounded limbs, mitten hands,
            # a revolved straw hat; flat surface details are bevelled on
            # their front face only, to keep the hero near 3,000 triangles.
            ("FarmerAvatar_", {"segments": 1}),
            ("FarmerAvatar_Head", {"radius": 0.17, "segments": 3}),
            ("FarmerAvatar_Torso", {"radius": 0.13, "segments": 2}),
            ("FarmerAvatar_OverallWaist", {"mode": "resample", "freq": 2}),
            ("FarmerAvatar_UpperArm", {"mode": "resample", "freq": 2}),
            ("FarmerAvatar_Forearm", {"radius": 0.06, "segments": 1}),
            ("FarmerAvatar_Hand", {"mode": "resample", "freq": 2}),
            ("FarmerAvatar_OverallLeg", {"mode": "resample", "freq": 2}),
            ("FarmerAvatar_LowerLeg", {"radius": 0.07, "segments": 1}),
            ("FarmerAvatar_Boot", {"mode": "resample", "freq": 2}),
            ("FarmerAvatar_BootSole", {"mode": "box", "radius": 0.025, "segments": 1}),
            ("FarmerAvatar_Hair", {"radius": 0.05, "segments": 2}),
            ("FarmerAvatar_HairFringe", {"mode": "resample", "freq": 2}),
            ("FarmerAvatar_Ear", {"mode": "resample", "freq": 2}),
            ("FarmerAvatar_Eye_", {"radius": 0.012, "segments": 1}),
            ("FarmerAvatar_EyeGlint", {"mode": "resample", "freq": 1}),
            ("FarmerAvatar_Eyebrow", {"mode": "resample", "freq": 1}),
            ("FarmerAvatar_Mouth", {"mode": "resample", "freq": 1}),
            ("FarmerAvatar_Nose", {"mode": "resample", "freq": 1}),
            ("FarmerAvatar_SunflowerBadge", {"mode": "resample", "freq": 2}),
            ("FarmerAvatar_SunflowerCenter", {"mode": "resample", "freq": 1}),
            ("FarmerAvatar_ShirtPlaid", {"mode": "front", "front": (1, 1)}),
            ("FarmerAvatar_SleeveStripe", {"mode": "front", "front": (1, 1)}),
            ("FarmerAvatar_OverallPocket", {"mode": "front", "front": (1, 1)}),
            ("FarmerAvatar_OverallBib", {"mode": "front", "front": (1, 1)}),
            ("FarmerAvatar_Strap", {"mode": "front", "front": (1, 1)}),
            ("FarmerAvatar_Buckle", {"mode": "front", "front": (1, 1)}),
            # The straw hat: smooth revolved profiles (radius factor, height
            # fraction), a slightly tapered crown with a soft top, a band
            # whose edges tuck into the crown and a brim with a rolled rim.
            ("FarmerAvatar_HatCrown", {"mode": "revolve", "segments": 20, "profile": (
                (1.0, 0.0), (0.97, 0.74), (0.86, 0.96), (0.45, 1.0), (0.0, 1.0),
            )}),
            ("FarmerAvatar_HatBand", {"mode": "revolve", "segments": 20, "profile": (
                (0.93, 0.0), (1.0, 0.5), (0.93, 1.0),
            )}),
            ("FarmerAvatar_HatBrim", {"mode": "revolve", "segments": 22, "profile": (
                (0.0, 0.0), (0.86, 0.0), (0.97, 0.12), (1.0, 0.5), (0.97, 0.88), (0.86, 1.0), (0.0, 1.0),
            )}),
        ],
        "shape": head("FarmerAvatar_HeadPivot", 1.12)
        # Straps at least 0.03 game units deep.
        + thick(sided("FarmerAvatar", ("Strap",)), 0.045),
        "colours": {
            "Material.FarmerAvatar.ShirtRed": matte("#f4583c"),
            "Material.FarmerAvatar.ShirtPlaid": matte("#c43a2e"),
            "Material.FarmerAvatar.OverallsNavy": matte("#4a8de0"),
            "Material.FarmerAvatar.OverallsLight": matte("#6aa8ee"),
            "Material.FarmerAvatar.Skin": satin("#f8c494"),
            # Same as Skin: neck, forearms, ears and nose are not shaded.
            "Material.FarmerAvatar.SkinShadow": satin("#f8c494"),
            "Material.FarmerAvatar.Hair": satin("#b86a3a"),
            "Material.FarmerAvatar.Straw": satin("#f5c65a"),
            "Material.FarmerAvatar.StrawLight": satin("#f9d778"),
            "Material.FarmerAvatar.HatBand": satin("#e0503a"),
            "Material.FarmerAvatar.Boots": satin("#a8603a"),
            "Material.FarmerAvatar.BootSoles": satin("#965a3e"),
            "Material.FarmerAvatar.Brass": gloss("#f2bc2e"),
            "Material.FarmerAvatar.Sunflower": satin("#f0c020"),
            "Material.FarmerAvatar.SunflowerCenter": satin("#9a5a32"),
            "Material.FarmerAvatar.Eyes": EYE,
            "Material.FarmerAvatar.EyeGlint": GLINT,
        },
    },
}


def main():
    args = parse_args()
    wanted = args.asset or list(ASSETS)
    unknown = [name for name in wanted if name not in ASSETS]
    if unknown:
        raise SystemExit(
            f"Not restyled by this pass: {', '.join(unknown)}. Animals are rebuilt by "
            "assets/scripts/party-animals.py -- --asset <Name>."
        )
    for name in wanted:
        config = ASSETS[name]
        path = ASSETS_DIR / f"{name}.blend"
        bpy.ops.wm.open_mainfile(filepath=str(path))
        restyle(name, config)
        print(f"Restyled {name}: {tri_count(config.get('prefix', name + '_'))} triangles")
        bpy.ops.wm.save_mainfile(filepath=str(path))
        backup = path.with_suffix(".blend1")
        if backup.exists():
            backup.unlink()


if __name__ == "__main__":
    main()
