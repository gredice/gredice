"""Party-toy pass for the garden lights, summer and holiday props.

Restyles these sources in `assets/game-assets` to the look in GAME_ART.md:

- Lights: DoubleGardenLightPole, EnamelGardenLamp, WickerGardenLantern,
  WoodenHandLantern, RoofTileLantern, FireflyJar. Rebuilt from rounded lathe
  profiles, rounded boxes and swept tubes with chunkier parts. Shades and
  housings move to saturated enamel colours, metal trims to the light steel
  role and stone feet to a warm limestone neutral.
- Summer: BeachBall, BeachTowelStriped, BeachUmbrella, InflatablePoolSmall,
  SandcastleSmallA. Smooth gores and tubes with exact normals, glossy plastic
  colours, and a sandcastle in warm sand built from soft rounded masses.
- Holiday and stands: IceCreamCart, LemonadeStand (rounded edges on every
  part, thin parts thickened, recoloured from screen targets), FishingBoat
  (rounded hull and gunwale), Snowman (three soft spheres; the carrot nose and
  eyes are added in `Snowman.tsx`).

Object names, origins, rotations, material names, material slot order and
animations stay as they were, so the runtime keeps finding the same nodes.
Some non-uniform object scales are baked into the mesh, which renders the
same. Every wood material is set to one of the shared plank profiles
(`WOOD_PROFILES`, checked by `timberAssetPalette.unit.ts`).

Every mesh is rebuilt from parameters, so running the script again gives the
same result. The older generators for these models
(`generate-garden-light-blocks.py`, `generate-fishing-boat.py`) rebuild the
look from before this pass; run this script after them, and expect
`audit-garden-light-blocks.py` to report the old thin-weave and five-wood
contracts. Run from the repository root, then export and bump the assets:

    /Applications/Blender.app/Contents/MacOS/Blender -b \
        --python assets/scripts/party-pass-lights-summer.py -- --asset BeachBall
    (cd assets && Blender -b --python export-game-assets.py -- --asset BeachBall)

Without `--asset` every source in the group is restyled.
"""

import argparse
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import party_style as ps  # noqa: E402

ASSETS_DIR = Path(__file__).resolve().parents[1] / "game-assets"


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", action="append", default=[])
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


# ------------------------------------------------------------------ colour
# On-screen targets (sRGB of a sunlit top face) for roles this group adds.
# GAME_ART roles, base and seasonal, are reused where they fit. Bright yellow
# and orange roles in the table cannot be reached under the neutral tone
# mapping, so the nearest reachable shade is used instead.
SCREEN = {
    "limestone": "#ead8b6",
    "enamel_red": ps.SCREEN_ROLES["ripe_red"][0],
    "enamel_blue": ps.SEASONAL_ROLES["enamel_blue"][0],
    "enamel_cream": ps.SEASONAL_ROLES["cream"][0],
    "steel": ps.SCREEN_ROLES["steel"][0],
    "terracotta": ps.SEASONAL_ROLES["terracotta"][0],
    "wicker": ps.SEASONAL_ROLES["hay_shade"][0],
    "glass_warm": "#f6e3b4",
    "summer_teal": "#2aa6e6",
    "summer_coral": "#f05a4c",
    "summer_cream": ps.SEASONAL_ROLES["cream"][0],
    "summer_yellow": "#f0c232",
    "summer_orange": "#ef8429",
    "pool_aqua": "#62c6ee",
    "water": "#3aa8e8",
    "towel_blue": "#2f8fe0",
    "towel_blue_light": "#4fb0f0",
    "sand": ps.SCREEN_ROLES["path"][0],
    "sand_light": "#efbd6b",
    "sand_deep": "#c98a4e",
    "sand_pale": "#f2c470",
    "stone_light": "#cfd6e6",
    "waffle": "#f0b84a",
    "yellow_deep": "#eaa42e",
    "canopy": ps.SCREEN_ROLES["canopy"][0],
    "lemonade": "#f7d55a",
    # A cool neutral; LemonadeStand.tsx draws the glass with the same albedo.
    "glass_cool": "#d4ecf4",
    "firefly_body": "#5b6fae",
    "snow": ps.SEASONAL_ROLES["snow"][0],
    "timber_light": ps.SCREEN_ROLES["timber_light"][0],
    "pink": "#f0609a",
    "pink_deep": "#e04f86",
    "chocolate": "#b86d3f",
    "mint": "#5ad68a",
    "vanilla": "#f5d27a",
    "strawberry": "#f2607e",
    "chalkboard": "#3f8c70",
    "tire": "#7d7f99",
    "stone": ps.SCREEN_ROLES["stone"][0],
    "rope": "#e9c78f",
    "net": "#4fbf8f",
    "leaf": ps.SCREEN_ROLES["crop_leaf"][0],
    "lemon": "#f2c41a",
}

ROUGH = {"matte": 0.8, "satin": 0.55, "gloss": 0.35, "wet": 0.15}


def material(name):
    found = bpy.data.materials.get(name)
    if found is None:
        raise RuntimeError(f"missing material {name}")
    return found


def paint(name, role, band):
    """Sets a material to an on-screen role colour, a roughness band and no metal."""
    ps.set_flat_colour(material(name), ps.screen_to_albedo(SCREEN[role]), ROUGH[band])


# Shared plank profiles, the references timberAssetPalette.unit.ts checks.
WOOD_PROFILES = {
    "default": ("WoodenWalkway.blend", "Material.WoodenWalkway.WarmWood"),
    "bridgeLight": ("SmallWoodenBridge.blend", "Material.SmallWoodenBridge.LightWood"),
    "bridgeWarm": ("SmallWoodenBridge.blend", "Material.SmallWoodenBridge.WarmWood"),
}


def shared_wood(name, role="default"):
    """Copies a shared plank profile onto a prop's wood material."""
    shader = ps.principled(material(name))
    for input_name, value in shared_wood_profile(role).items():
        shader.inputs[input_name].default_value = value


def zero_metal(name):
    shader = ps.principled(material(name))
    shader.inputs["Metallic"].default_value = 0.0


# --------------------------------------------------------------- profiles
def round_profile(points, steps=2):
    """Rounds the interior corners of a polyline.

    `points` holds (r, z, radius) tuples; the corner at each point is
    replaced by a quadratic curve that starts and ends `radius` away from it.
    """
    out = [Vector(points[0][:2])]
    for index in range(1, len(points) - 1):
        previous = Vector(points[index - 1][:2])
        corner = Vector(points[index][:2])
        following = Vector(points[index + 1][:2])
        radius = points[index][2]
        to_previous = previous - corner
        to_following = following - corner
        radius = min(radius, to_previous.length * 0.5, to_following.length * 0.5)
        if radius <= 1e-6:
            out.append(corner)
            continue
        start = corner + to_previous.normalized() * radius
        end = corner + to_following.normalized() * radius
        for step in range(steps + 1):
            t = step / steps
            out.append((1 - t) ** 2 * start + 2 * (1 - t) * t * corner + t * t * end)
    out.append(Vector(points[-1][:2]))
    return [(point.x, point.y) for point in out]


def bridge_rings(bm, rings, cyclic=True, closed=False):
    """Joins consecutive vertex rings with quads, or fans where a ring is one pole."""
    faces = []
    pairs = list(zip(rings, rings[1:]))
    if closed:
        pairs.append((rings[-1], rings[0]))
    for lower, upper in pairs:
        if len(lower) == 1 and len(upper) == 1:
            continue
        if len(lower) == 1:
            count = len(upper)
            for i in range(count if cyclic else count - 1):
                faces.append(bm.faces.new((lower[0], upper[(i + 1) % count], upper[i])))
        elif len(upper) == 1:
            count = len(lower)
            for i in range(count if cyclic else count - 1):
                faces.append(bm.faces.new((lower[i], lower[(i + 1) % count], upper[0])))
        else:
            count = len(lower)
            for i in range(count if cyclic else count - 1):
                j = (i + 1) % count
                faces.append(bm.faces.new((lower[i], lower[j], upper[j], upper[i])))
    return faces


def add_lathe(bm, profile, center=(0.0, 0.0, 0.0), segments=20, steps=2, phase=0.0, scale=(1.0, 1.0)):
    """Revolves a rounded (r, z, radius) profile around a vertical axis."""
    points = round_profile(profile, steps)
    rings = []
    for r, z in points:
        if r < 1e-6:
            rings.append([bm.verts.new((center[0], center[1], center[2] + z))])
            continue
        rings.append(
            [
                bm.verts.new(
                    (
                        center[0] + r * scale[0] * math.cos(phase + i * math.tau / segments),
                        center[1] + r * scale[1] * math.sin(phase + i * math.tau / segments),
                        center[2] + z,
                    )
                )
                for i in range(segments)
            ]
        )
    faces = bridge_rings(bm, rings)
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def add_torus(bm, center, major, minor, major_segments=24, minor_segments=8, scale=(1.0, 1.0)):
    rings = []
    for i in range(major_segments):
        u = i * math.tau / major_segments
        ring = []
        for j in range(minor_segments):
            v = j * math.tau / minor_segments
            radius = major + minor * math.cos(v)
            ring.append(
                bm.verts.new(
                    (
                        center[0] + radius * math.cos(u) * scale[0],
                        center[1] + radius * math.sin(u) * scale[1],
                        center[2] + minor * math.sin(v),
                    )
                )
            )
        rings.append(ring)
    faces = bridge_rings(bm, rings, closed=True)
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def bezier(points, samples):
    """Samples a cubic Bezier curve given four control points."""
    p0, p1, p2, p3 = (Vector(point) for point in points)
    out = []
    for index in range(samples + 1):
        t = index / samples
        out.append(
            (1 - t) ** 3 * p0
            + 3 * (1 - t) ** 2 * t * p1
            + 3 * (1 - t) * t * t * p2
            + t ** 3 * p3
        )
    return out


def add_tube(bm, path, radius, sides=10, caps=("round", "round"), cap_steps=2, radii=None):
    """Sweeps a circle along a polyline, with rounded or flat ends."""
    path = [Vector(point) for point in path]
    count = len(path)
    radii = radii or [radius] * count
    tangents = []
    for index in range(count):
        if index == 0:
            tangent = path[1] - path[0]
        elif index == count - 1:
            tangent = path[-1] - path[-2]
        else:
            tangent = (path[index + 1] - path[index]).normalized() + (
                path[index] - path[index - 1]
            ).normalized()
        tangents.append(tangent.normalized())
    reference = Vector((0, 0, 1)) if abs(tangents[0].z) < 0.9 else Vector((1, 0, 0))
    normal = (reference - tangents[0] * reference.dot(tangents[0])).normalized()
    frames = []
    for tangent in tangents:
        normal = (normal - tangent * normal.dot(tangent)).normalized()
        frames.append((normal, tangent.cross(normal)))

    def ring(center, frame, size):
        normal_axis, binormal = frame
        return [
            bm.verts.new(
                center
                + size * (math.cos(i * math.tau / sides) * normal_axis + math.sin(i * math.tau / sides) * binormal)
            )
            for i in range(sides)
        ]

    rings = []
    if caps[0] == "round":
        rings.append([bm.verts.new(path[0] - tangents[0] * radii[0])])
        for step in range(1, cap_steps + 1):
            angle = (math.pi / 2) * step / (cap_steps + 1)
            rings.append(ring(path[0] - tangents[0] * radii[0] * math.cos(angle), frames[0], radii[0] * math.sin(angle)))
    else:
        rings.append([bm.verts.new(path[0])])
    for index in range(count):
        rings.append(ring(path[index], frames[index], radii[index]))
    if caps[1] == "round":
        for step in range(cap_steps, 0, -1):
            angle = (math.pi / 2) * step / (cap_steps + 1)
            rings.append(ring(path[-1] + tangents[-1] * radii[-1] * math.cos(angle), frames[-1], radii[-1] * math.sin(angle)))
        rings.append([bm.verts.new(path[-1] + tangents[-1] * radii[-1])])
    else:
        rings.append([bm.verts.new(path[-1])])
    faces = bridge_rings(bm, rings)
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def add_box(bm, low, high, radius, segments=2, sharp_sides=()):
    return ps.add_box(bm, low, high, radius=radius, segments=segments, sharp_sides=sharp_sides)


def add_frustum(bm, low, high, top_scale, radius, segments=2):
    """A box whose top face is scaled toward its centre, with rounded edges."""
    low = Vector(low)
    high = Vector(high)
    result = bmesh.ops.create_cube(bm, size=1.0)
    verts = result["verts"]
    bmesh.ops.scale(bm, vec=high - low, verts=verts)
    bmesh.ops.translate(bm, vec=(low + high) / 2, verts=verts)
    centre = (low + high) / 2
    for vert in verts:
        if vert.co.z > centre.z:
            vert.co.x = centre.x + (vert.co.x - centre.x) * top_scale[0]
            vert.co.y = centre.y + (vert.co.y - centre.y) * top_scale[1]
    faces = {face for vert in verts for face in vert.link_faces}
    edges = {edge for face in faces for edge in face.edges}
    before = set(bm.faces)
    bmesh.ops.bevel(
        bm,
        geom=list(edges),
        offset=radius,
        offset_type="OFFSET",
        segments=segments,
        profile=0.5,
        affect="EDGES",
        clamp_overlap=True,
    )
    return [face for face in faces if face.is_valid] + list(set(bm.faces) - before)


def add_ellipsoid(bm, center, radii, segments=16, rings=10, floor=None):
    """A UV ellipsoid; with `floor` the part below it is flattened."""
    profile = []
    for index in range(rings + 1):
        angle = -math.pi / 2 + math.pi * index / rings
        z = radii[2] * math.sin(angle)
        if floor is not None:
            z = max(z, floor - center[2])
        profile.append((math.cos(angle), z, 0.0))
    faces = add_lathe(bm, profile, center=center, segments=segments, steps=1, scale=(radii[0], radii[1]))
    return faces


def round_closed(points, radius, steps=2):
    """Rounds every corner of a closed 2D polygon."""
    count = len(points)
    out = []
    for index in range(count):
        previous = Vector(points[index - 1])
        corner = Vector(points[index])
        following = Vector(points[(index + 1) % count])
        to_previous = previous - corner
        to_following = following - corner
        size = min(radius, to_previous.length * 0.45, to_following.length * 0.45)
        start = corner + to_previous.normalized() * size
        end = corner + to_following.normalized() * size
        for step in range(steps + 1):
            t = step / steps
            out.append((1 - t) ** 2 * start + 2 * (1 - t) * t * corner + t * t * end)
    return [(point.x, point.y) for point in out]


def add_prism(bm, outline, low, high, chamfer, axis="z"):
    """Extrudes a closed 2D outline between `low` and `high` along `axis`.

    The two outer rings shrink toward the centroid by `chamfer`, so the slab
    has soft edges once shaded smooth.
    """
    centre = Vector((sum(p[0] for p in outline) / len(outline), sum(p[1] for p in outline) / len(outline)))

    def place(point, height):
        a, b = point
        if axis == "z":
            return (a, b, height)
        if axis == "y":
            return (a, height, b)
        return (height, a, b)

    def shrunk(amount):
        result = []
        for point in outline:
            offset = Vector(point) - centre
            length = offset.length
            factor = max(0.0, (length - amount) / length) if length > 1e-9 else 0.0
            result.append(centre + offset * factor)
        return result

    rings = [[bm.verts.new(place(centre, low))]]
    for points, height in (
        (shrunk(chamfer), low),
        (outline, low + chamfer),
        (outline, high - chamfer),
        (shrunk(chamfer), high),
    ):
        rings.append([bm.verts.new(place(point, height)) for point in points])
    rings.append([bm.verts.new(place(centre, high))])
    faces = bridge_rings(bm, rings)
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def add_torus_xy(bm, center, major_xy, minor, major_segments=36, minor_segments=10):
    """A torus whose centre line is an ellipse with radii `major_xy`."""
    rings = []
    for i in range(major_segments):
        u = i * math.tau / major_segments
        ring = []
        for j in range(minor_segments):
            v = j * math.tau / minor_segments
            ring.append(
                bm.verts.new(
                    (
                        center[0] + (major_xy[0] + minor * math.cos(v)) * math.cos(u),
                        center[1] + (major_xy[1] + minor * math.cos(v)) * math.sin(u),
                        center[2] + minor * math.sin(v),
                    )
                )
            )
        rings.append(ring)
    faces = bridge_rings(bm, rings, closed=True)
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def world_bounds(name):
    obj = bpy.data.objects[name]
    points = [obj.matrix_world @ vert.co for vert in obj.data.vertices]
    low = Vector([min(point[i] for point in points) for i in range(3)])
    high = Vector([max(point[i] for point in points) for i in range(3)])
    return low, high


def place_verts(bm, faces, matrix):
    verts = list({vert for face in faces for vert in face.verts})
    bmesh.ops.transform(bm, matrix=matrix, verts=verts)
    return faces


# ------------------------------------------------------------- mesh writes
def planar_uvs(bm, scale=2.0):
    """Continuous UVs, so they never split a vertex. No texture reads them."""
    layer = bm.loops.layers.uv.verify()
    for face in bm.faces:
        for loop in face.loops:
            co = loop.vert.co
            loop[layer].uv = ((co.x + 0.6 * co.z) * scale, (co.y + 0.3 * co.z) * scale)


def to_local(bm, obj):
    bmesh.ops.transform(bm, matrix=obj.matrix_world.inverted(), verts=bm.verts)


def bake_scale(obj):
    """Moves a non-uniform object scale into the mesh. Renders the same."""
    if all(abs(value - 1.0) < 1e-9 for value in obj.scale):
        return
    obj.data.transform(Matrix.Diagonal((*obj.scale, 1.0)))
    obj.scale = (1.0, 1.0, 1.0)
    bpy.context.view_layer.update()


def finish(obj, bm, keep_uv=None, weighted=True, custom_normals=None, local=False):
    """Writes a world-space (or `local`) bmesh into `obj`, keeping its transform and UV set."""
    had_uv = len(obj.data.uv_layers) > 0 if keep_uv is None else keep_uv
    if not local:
        to_local(bm, obj)
    if had_uv:
        planar_uvs(bm)
    for face in bm.faces:
        face.smooth = True
    ps.replace_mesh(obj, bm, weighted_normals=weighted and custom_normals is None)
    for modifier in list(obj.modifiers):
        if modifier.type == "BOOLEAN":
            obj.modifiers.remove(modifier)
    if custom_normals is not None:
        world_to_local = obj.matrix_world.inverted().to_3x3()
        local_to_world = obj.matrix_world
        normals = []
        for vert in obj.data.vertices:
            world_normal = custom_normals(local_to_world @ vert.co)
            normals.append((world_to_local.inverted().transposed() @ world_normal).normalized())
        obj.data.normals_split_custom_set_from_vertices(normals)
    obj.data.update()


def rebuild(name, build, material_index=0, **kwargs):
    """Builds world-space geometry with `build(bm)` and writes it into `name`."""
    obj = bpy.data.objects[name]
    bm = bmesh.new()
    faces = build(bm)
    if faces is not None and material_index is not None:
        for face in bm.faces:
            face.material_index = material_index
    finish(obj, bm, **kwargs)
    return obj


def report():
    total = 0
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        count = ps.evaluated_triangles(obj)
        total += count
        print(f"    {obj.name}: {count} tris, {len(obj.data.vertices)} verts")
    print(f"  triangles after modifiers: {total}")
    return total


# ------------------------------------------------------------------ lights
def double_garden_light_pole():
    prefix = "DoubleGardenLightPole"
    paint(f"Material.{prefix}.Limestone", "limestone", "satin")
    paint(f"Material.{prefix}.WarmEnamel", "enamel_red", "gloss")
    paint(f"Material.{prefix}.DarkMetal", "steel", "gloss")
    zero_metal(f"Material.{prefix}.Glow")
    # WarmWood keeps the shared wood profile.
    shade_x = 0.30

    def base(bm):
        return add_lathe(
            bm,
            [
                (0, 0, 0),
                (0.2, 0, 0.012),
                (0.2, 0.095, 0.04),
                (0.15, 0.118, 0.02),
                (0.15, 0.2, 0.035),
                (0, 0.2, 0),
            ],
            segments=18,
        )

    def wood(bm):
        faces = add_lathe(bm, [(0, 0.19, 0), (0.066, 0.19, 0), (0.066, 2.04, 0), (0, 2.04, 0)], segments=14)
        faces += add_tube(bm, [(-shade_x, 0, 2.06), (shade_x, 0, 2.06)], 0.05, sides=12)
        faces += add_box(bm, (-0.085, -0.068, 1.995), (0.085, 0.068, 2.135), 0.035, segments=2)
        return faces

    def shade(bm, x):
        return add_lathe(
            bm,
            [
                (0, 1.95, 0),
                (0.05, 1.95, 0.02),
                (0.105, 1.85, 0.014),
                (0.138, 1.85, 0.014),
                (0.078, 1.995, 0.04),
                (0.05, 2.035, 0.012),
                (0, 2.035, 0),
            ],
            center=(x, 0, 0),
            segments=16,
        )

    def metal(bm):
        faces = add_lathe(bm, [(0, 0.185, 0), (0.09, 0.185, 0.02), (0.09, 0.27, 0.025), (0, 0.27, 0)], segments=14)
        faces += add_lathe(bm, [(0, 2.12, 0), (0.068, 2.12, 0.015), (0.068, 2.15, 0.03), (0, 2.19, 0)], segments=14)
        for x in (-shade_x, shade_x):
            faces += add_torus(bm, (x, 0, 1.852), 0.122, 0.02, 18, 6)
        return faces

    def bulb(bm, x):
        return add_lathe(
            bm,
            [
                (0, 1.715, 0),
                (0.036, 1.722, 0.012),
                (0.058, 1.752, 0.015),
                (0.062, 1.785, 0.015),
                (0.05, 1.82, 0.015),
                (0.03, 1.845, 0.01),
                (0.028, 1.95, 0),
                (0, 1.95, 0),
            ],
            center=(x, 0, 0),
            segments=12,
            steps=1,
        )

    rebuild(f"{prefix}_LimestoneBase", base)
    rebuild(f"{prefix}_Wood", wood)
    rebuild(f"{prefix}_Shades", lambda bm: shade(bm, -shade_x) + shade(bm, shade_x))
    rebuild(f"{prefix}_DarkMetal", metal)
    rebuild(f"{prefix}_BulbLeft", lambda bm: bulb(bm, -shade_x))
    rebuild(f"{prefix}_BulbRight", lambda bm: bulb(bm, shade_x))


def enamel_garden_lamp():
    prefix = "EnamelGardenLamp"
    paint(f"Material.{prefix}.Limestone", "limestone", "satin")
    paint(f"Material.{prefix}.BlueEnamel", "enamel_blue", "gloss")
    paint(f"Material.{prefix}.DarkMetal", "enamel_cream", "gloss")
    shared_wood(f"Material.{prefix}.Wood")
    zero_metal(f"Material.{prefix}.Glow")
    post_x = -0.08
    shade_x = 0.13

    def foot(bm):
        faces = add_box(bm, (post_x - 0.145, -0.145, 0), (post_x + 0.145, 0.145, 0.13), 0.04, segments=2)
        faces += add_lathe(
            bm,
            [(0, 0.12, 0), (0.105, 0.12, 0.01), (0.1, 0.15, 0.02), (0.085, 0.2, 0.02), (0, 0.2, 0)],
            center=(post_x, 0, 0),
            segments=16,
        )
        return faces

    def post(bm):
        faces = add_box(bm, (post_x - 0.075, -0.075, 0.18), (post_x + 0.075, 0.075, 1.21), 0.035, segments=2)
        faces += add_lathe(
            bm,
            [(0, 1.19, 0), (0.1, 1.19, 0.012), (0.1, 1.225, 0.02), (0.05, 1.275, 0.03), (0, 1.285, 0)],
            center=(post_x, 0, 0),
            segments=16,
        )
        return faces

    def shade(bm):
        return add_lathe(
            bm,
            [
                (0, 1.205, 0),
                (0.065, 1.205, 0.025),
                (0.152, 1.09, 0.014),
                (0.182, 1.09, 0.014),
                (0.09, 1.235, 0.05),
                (0.055, 1.268, 0.012),
                (0, 1.268, 0),
            ],
            center=(shade_x, 0, 0),
            segments=20,
        )

    def trim(bm):
        hook = bezier([(post_x, 0, 1.24), (post_x, 0, 1.41), (shade_x, 0, 1.41), (shade_x, 0, 1.27)], 14)
        faces = add_tube(bm, hook, 0.035, sides=10, caps=("flat", "flat"))
        faces += add_torus(bm, (shade_x, 0, 1.09), 0.168, 0.02, 20, 6)
        faces += add_lathe(
            bm,
            [(0, 1.255, 0), (0.052, 1.255, 0.012), (0.052, 1.285, 0.015), (0, 1.3, 0)],
            center=(shade_x, 0, 0),
            segments=12,
        )
        return faces

    def bulb(bm):
        return add_lathe(
            bm,
            [
                (0, 0.835, 0),
                (0.045, 0.845, 0.015),
                (0.074, 0.88, 0.02),
                (0.078, 0.925, 0.02),
                (0.06, 0.97, 0.02),
                (0.038, 1.0, 0.012),
                (0.034, 1.205, 0),
                (0, 1.205, 0),
            ],
            center=(shade_x, 0, 0),
            segments=14,
            steps=1,
        )

    rebuild(f"{prefix}_LimestoneFoot", foot)
    rebuild(f"{prefix}_WoodPost", post)
    rebuild(f"{prefix}_EnamelShade", shade)
    rebuild(f"{prefix}_MetalTrim", trim)
    rebuild(f"{prefix}_Bulb", bulb)


def roof_tile_lantern():
    prefix = "RoofTileLantern"
    paint(f"Material.{prefix}.Terracotta", "terracotta", "satin")
    paint(f"Material.{prefix}.Limestone", "limestone", "satin")
    zero_metal(f"Material.{prefix}.Glow")
    tile_base = 0.07
    height = 0.3
    thickness = 0.04
    outline_points = 20

    def petal_point(u, v, side, angle):
        t = max(0.0, min(1.0, v / height))
        smooth_t = t * t * (3 - 2 * t)
        crown = 0.012 * max(0.0, 1 - (u / 0.11) ** 2)
        radial = 0.132 + 0.03 * smooth_t + 0.012 * t ** 3 + crown + side * thickness / 2
        return Vector(
            (
                radial * math.cos(angle) - u * math.sin(angle),
                radial * math.sin(angle) + u * math.cos(angle),
                tile_base + v,
            )
        )

    def outline(index):
        theta = index * math.tau / outline_points
        c, s = math.cos(theta), math.sin(theta)
        exponent = 2 / 2.8
        v = height / 2 + height / 2 * math.copysign(abs(s) ** exponent, s)
        t = v / height
        u = (0.084 + 0.026 * t) * math.copysign(abs(c) ** exponent, c)
        return u, v

    def opening(index):
        theta = index * math.tau / outline_points
        c, s = math.cos(theta), math.sin(theta)
        u = 0.035 * c * (1 - 0.3 * s * s)
        v = 0.17 + 0.068 * s
        return u, v

    def petal(bm, angle):
        """A thick curved tile with a leaf-shaped opening and rounded rims."""
        shells = {}
        for side in (-1, 1):
            loops = []
            for blend in (0.0, 0.5, 1.0):
                loop = []
                for index in range(outline_points):
                    ou, ov = outline(index)
                    iu, iv = opening(index)
                    loop.append(bm.verts.new(petal_point(ou + (iu - ou) * blend, ov + (iv - ov) * blend, side, angle)))
                loops.append(loop)
            shells[side] = loops
        faces = []
        for loops in shells.values():
            faces += bridge_rings(bm, loops)

        def rim(points, centre, bulge):
            # A middle ring pushed out from the edge rounds the rim.
            ring = []
            for index in range(outline_points):
                u, v = points(index)
                direction = Vector((u - centre[0], v - centre[1])).normalized() * bulge
                ring.append(bm.verts.new(petal_point(u + direction.x, v + direction.y, 0, angle)))
            return ring

        outer_mid = rim(outline, (0.0, height / 2), thickness * 0.45)
        inner_mid = rim(opening, (0.0, 0.17), -thickness * 0.35)
        faces += bridge_rings(bm, [shells[-1][0], outer_mid, shells[1][0]])
        faces += bridge_rings(bm, [shells[-1][2], inner_mid, shells[1][2]])
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        return faces

    def tiles(bm):
        faces = []
        for index in range(4):
            faces += petal(bm, index * math.pi / 2)
        return faces

    def core(bm):
        faces = add_box(bm, (-0.22, -0.22, 0), (0.22, 0.22, 0.08), 0.035, segments=3)
        faces += add_lathe(
            bm,
            [(0, 0.07, 0), (0.062, 0.07, 0.01), (0.056, 0.1, 0.015), (0.046, 0.18, 0.02), (0, 0.19, 0)],
            segments=16,
        )
        return faces

    def ember(bm):
        return add_lathe(
            bm,
            [
                (0, 0.09, 0),
                (0.042, 0.1, 0.015),
                (0.06, 0.145, 0.02),
                (0.056, 0.19, 0.02),
                (0.03, 0.24, 0.015),
                (0, 0.258, 0),
            ],
            segments=16,
        )

    rebuild(f"{prefix}_Tiles", tiles)
    rebuild(f"{prefix}_LimestoneCore", core)
    rebuild(f"{prefix}_Glow", ember)


def wicker_garden_lantern():
    prefix = "WickerGardenLantern"
    paint(f"Material.{prefix}.Wicker", "wicker", "matte")
    paint(f"Material.{prefix}.Terracotta", "terracotta", "satin")
    paint(f"Material.{prefix}.Limestone", "limestone", "satin")
    zero_metal(f"Material.{prefix}.Glow")
    bottom = 0.175
    top = 0.645

    def band_radius(progress):
        dome = math.sin(progress * math.pi / 2)
        return 0.225 + (0.1 - 0.225) * dome ** 1.35, bottom + (top - bottom) * dome

    def wicker(bm):
        faces = add_torus(bm, (0, 0, bottom), 0.225, 0.024, 24, 6)
        faces += add_torus(bm, (0, 0, top), 0.1, 0.022, 16, 6)
        bands = 4
        spacing = math.tau / bands
        twist = 2.0
        for hand in (-1, 1):
            for band in range(bands):
                start = band * spacing + (spacing / 2 if hand < 0 else 0)
                path = []
                for sample in range(17):
                    progress = sample / 16
                    radius, z = band_radius(progress)
                    phase = start + hand * twist * progress
                    # Crossing strands pass over and under each other instead of
                    # cutting through: the relief at a crossing exceeds the
                    # strand radius.
                    radius += 0.021 * hand * math.cos(math.pi * (2 * twist * progress / spacing - 0.5))
                    path.append((radius * math.cos(phase), radius * math.sin(phase), z))
                faces += add_tube(bm, path, 0.019, sides=6, caps=("flat", "flat"))
        return faces

    def terracotta(bm):
        return add_lathe(
            bm,
            [(0, 0, 0), (0.19, 0, 0.012), (0.2, 0.05, 0.03), (0.19, 0.115, 0.025), (0, 0.115, 0)],
            segments=20,
        )

    def limestone(bm):
        return add_lathe(
            bm,
            [(0, 0.105, 0), (0.212, 0.105, 0), (0.218, 0.135, 0.02), (0.208, 0.168, 0.02), (0, 0.168, 0)],
            segments=20,
        )

    def glow(bm):
        return add_lathe(
            bm,
            [(0, 0.17, 0), (0.1, 0.18, 0.03), (0.112, 0.3, 0.04), (0.105, 0.47, 0.05), (0.06, 0.56, 0.03), (0, 0.575, 0)],
            segments=14,
        )

    rebuild(f"{prefix}_Wicker", wicker)
    rebuild(f"{prefix}_TerracottaBase", terracotta)
    rebuild(f"{prefix}_LimestoneBase", limestone)
    rebuild(f"{prefix}_Glow", glow)


def wooden_hand_lantern():
    prefix = "WoodenHandLantern"
    # Glass and glow are drawn by WoodenHandLantern.tsx.
    paint(f"Material.{prefix}.DarkMetal", "steel", "gloss")
    paint(f"Material.{prefix}.Glass", "glass_warm", "wet")
    shared_wood(f"Material.{prefix}.Wood")
    zero_metal(f"Material.{prefix}.Glow")

    def frame(bm):
        faces = add_box(bm, (-0.19, -0.16, 0), (0.19, 0.16, 0.09), 0.035, segments=2)
        for x in (-0.155, 0.155):
            for y in (-0.125, 0.125):
                faces += add_box(bm, (x - 0.0325, y - 0.0325, 0.07), (x + 0.0325, y + 0.0325, 0.35), 0.022, segments=2)
        faces += add_box(bm, (-0.185, -0.155, 0.33), (0.185, 0.155, 0.4), 0.03, segments=2)
        faces += add_frustum(bm, (-0.195, -0.165, 0.385), (0.195, 0.165, 0.47), (0.36, 0.3), 0.028, segments=2)
        return faces

    def handle(bm):
        path = [
            (0.13 * math.cos(math.pi * i / 16), 0, 0.43 + 0.15 * math.sin(math.pi * i / 16))
            for i in range(17)
        ]
        return add_tube(bm, path, 0.03, sides=10, caps=("flat", "flat"))

    def metal(bm):
        faces = []
        for x in (-0.13, 0.13):
            faces += add_ellipsoid(bm, (x, 0, 0.45), (0.042, 0.045, 0.04), segments=14, rings=8)
        faces += add_box(bm, (0.12, -0.2, 0.17), (0.17, -0.165, 0.25), 0.012, segments=2)
        return faces

    def glass(bm):
        return add_box(bm, (-0.14, -0.11, 0.08), (0.14, 0.11, 0.34), 0.03, segments=2)

    def glow(bm):
        return add_lathe(
            bm,
            [(0, 0.09, 0), (0.07, 0.095, 0.015), (0.072, 0.25, 0.03), (0.05, 0.3, 0.02), (0, 0.315, 0)],
            segments=16,
        )

    rebuild(f"{prefix}_Frame", frame)
    rebuild(f"{prefix}_Handle", handle)
    rebuild(f"{prefix}_Metal", metal)
    rebuild(f"{prefix}_Glass", glass)
    rebuild(f"{prefix}_Glow", glow)


def firefly_jar():
    # FireflyJar.tsx draws every part with its own materials; the GLB colours
    # below only matter for previews of the raw model.
    paint("FJ_soft_transparent_glass", "glass_warm", "wet")
    paint("FJ_flat_brass_lid", "enamel_red", "gloss")
    paint("FJ_soft_firefly_wings", "summer_cream", "wet")
    paint("FJ_flat_firefly_body", "firefly_body", "satin")
    zero_metal("FJ_warm_firefly_glow")

    def jar(bm):
        return add_lathe(
            bm,
            [
                (0, 0.022, 0),
                (0.13, 0.022, 0.03),
                (0.148, 0.06, 0.03),
                (0.148, 0.29, 0.04),
                (0.122, 0.335, 0.02),
                (0.12, 0.355, 0),
            ],
            segments=20,
        )

    def base(bm):
        return add_lathe(bm, [(0, 0, 0), (0.132, 0, 0.008), (0.138, 0.012, 0.008), (0.128, 0.024, 0.006), (0, 0.024, 0)], segments=20, steps=1)

    def rim(bm):
        return add_torus(bm, (0, 0, 0.352), 0.124, 0.017, 20, 6)

    def lid(bm):
        return add_lathe(
            bm,
            [(0, 0.352, 0), (0.142, 0.352, 0.01), (0.148, 0.375, 0.014), (0.13, 0.395, 0.015), (0.05, 0.402, 0.02), (0, 0.405, 0)],
            segments=20,
        )

    def body(bm):
        faces = add_ellipsoid(bm, (0.015, 0.0, 0.278), (0.022, 0.02, 0.03), segments=12, rings=8)
        return faces

    def abdomen(bm):
        return add_ellipsoid(bm, (0.02, 0.028, 0.25), (0.022, 0.026, 0.024), segments=12, rings=8)

    def wings(bm):
        faces = []
        for x, tilt in ((-0.018, 0.35), (0.048, -0.35)):
            wing = add_ellipsoid(bm, (0, 0, 0), (0.034, 0.018, 0.006), segments=12, rings=6)
            verts = list({vert for face in wing for vert in face.verts})
            bmesh.ops.rotate(bm, verts=verts, cent=(0, 0, 0), matrix=Matrix.Rotation(tilt, 3, "Y"))
            bmesh.ops.translate(bm, verts=verts, vec=(x, 0.012, 0.302))
            faces += wing
        return faces

    rebuild("FireflyJar_Glass_Jar", jar, keep_uv=False)
    rebuild("FireflyJar_Glass_Base_Thickness", base, keep_uv=False)
    rebuild("FireflyJar_Glass_Top_Rim", rim, keep_uv=False)
    rebuild("FireflyJar_Lid", lid, keep_uv=False)
    rebuild("FireflyJar_Firefly_Body", body, keep_uv=False)
    rebuild("FireflyJar_Firefly_Glow_Abdomen", abdomen, keep_uv=False)
    rebuild("FireflyJar_Firefly_Wings", wings, keep_uv=False)


# ------------------------------------------------------------------ summer
def outward(faces, centre):
    """Flips open-surface faces so they face away from `centre`."""
    for face in faces:
        face.normal_update()
        if face.normal.dot(face.calc_center_median() - centre) < 0:
            face.normal_flip()
    return faces


def beach_ball():
    for name, role in {
        "BeachBall_Coral": "summer_coral",
        "BeachBall_White": "summer_cream",
        "BeachBall_Teal": "summer_teal",
        "BeachBall_TealDark": "summer_teal",
        "BeachBall_Yellow": "summer_yellow",
        "BeachBall_Cap": "summer_teal",
        "BeachBall_ContactPatch": "summer_teal",
    }.items():
        paint(name, role, "gloss")
    centre = Vector((0.0, 0.0, 1.0))
    radius = 0.993

    def sphere_normal(point):
        return (point - centre).normalized()

    panels = [obj.name for obj in bpy.data.objects if obj.name.startswith("BeachBall_Panel")]
    for name in panels:
        low, high = world_bounds(name)
        middle = (low + high) / 2
        # Each panel keeps the 45 degree gore it already covered.
        angle = round(math.atan2(middle.y, middle.x) / (math.pi / 4)) * (math.pi / 4)

        def gore(bm, angle=angle):
            rings = []
            for row in range(15):
                latitude = math.radians(-84 + 168 * row / 14)
                ring = []
                for column in range(5):
                    longitude = angle - math.pi / 8 + (math.pi / 4) * column / 4
                    ring.append(
                        bm.verts.new(
                            centre
                            + radius
                            * Vector(
                                (
                                    math.cos(latitude) * math.cos(longitude),
                                    math.cos(latitude) * math.sin(longitude),
                                    math.sin(latitude),
                                )
                            )
                        )
                    )
                rings.append(ring)
            return outward(bridge_rings(bm, rings, cyclic=False), centre)

        rebuild(name, gore, custom_normals=sphere_normal)

    # Valve buttons at the top and bottom of the ball.
    rebuild(
        "BeachBall_Cap",
        lambda bm: add_lathe(
            bm,
            [(0, 1.95, 0), (0.19, 1.95, 0), (0.19, 2.0, 0.02), (0.14, 2.038, 0.03), (0, 2.046, 0)],
            segments=16,
        ),
    )
    rebuild(
        "BeachBall_ContactPatch",
        lambda bm: add_lathe(
            bm,
            [(0, 0.0025, 0), (0.12, 0.007, 0.03), (0.18, 0.03, 0.02), (0.18, 0.06, 0), (0, 0.06, 0)],
            segments=16,
        ),
    )


def beach_towel_striped():
    prefix = "BeachTowelStriped"
    paint(f"{prefix}_BlueDark", "towel_blue", "matte")
    paint(f"{prefix}_BlueLight", "towel_blue_light", "matte")
    paint(f"{prefix}_Cream", "summer_cream", "matte")
    paint(f"{prefix}_CreamDark", "summer_yellow", "matte")
    paint(f"{prefix}_Tassel", "summer_cream", "matte")
    paint(f"{prefix}_TasselDark", "summer_yellow", "matte")
    # A towel stays low; 0.13 here is 0.03 in the game (scale 0.24).
    rebuild(f"{prefix}_Base", lambda bm: add_box(bm, (-2.9, -1.175, 0), (2.9, 1.175, 0.12), 0.05, segments=2))
    # Stripe bands across the towel, as (low y, high y) from the source.
    stripes = {
        "A01": (-1.163, -0.851),
        "B01": (-0.827, -0.516),
        "A02": (-0.492, -0.18),
        "B02": (-0.156, 0.156),
        "A03": (0.18, 0.492),
        "B03": (0.516, 0.827),
        "A04": (0.851, 1.163),
    }
    for stripe, (low_y, high_y) in stripes.items():
        rebuild(
            f"{prefix}_Stripe{stripe}",
            lambda bm, low_y=low_y, high_y=high_y: add_box(bm, (-2.82, low_y, 0.095), (2.82, high_y, 0.145), 0.025, segments=1),
        )
    for side in ("Left", "Right"):
        sign = -1 if side == "Left" else 1
        rebuild(
            f"{prefix}_Seam{side}",
            lambda bm, sign=sign: add_box(
                bm, (sign * 2.68 - 0.09, -1.115, 0.11), (sign * 2.68 + 0.09, 1.115, 0.168), 0.028, segments=2
            ),
        )
        for index in range(1, 10):
            rope = f"{prefix}_Fringe{side}Rope{index:02d}"
            tip = f"{prefix}_Fringe{side}Tip{index:02d}"
            # Object origins never move, so the script is stable when run again.
            y = bpy.data.objects[tip].location.y
            # Ropes 0.135 across and knots 0.14 tall are 0.03 in the game.
            rebuild(
                rope,
                lambda bm, sign=sign, y=y: add_tube(
                    bm, [(sign * 2.62, y, 0.068), (sign * 2.97, y, 0.068)], 0.0675, sides=8, caps=("flat", "round"), cap_steps=1
                ),
            )
            rebuild(
                tip,
                lambda bm, sign=sign, y=y: add_ellipsoid(bm, (sign * 3.04, y, 0.071), (0.085, 0.08, 0.07), segments=8, rings=4),
            )


def beach_umbrella():
    prefix = "BeachUmbrella"
    paint(f"Material.{prefix}.CanopyCream", "summer_cream", "matte")
    paint(f"Material.{prefix}.CanopyCoral", "summer_coral", "matte")
    paint(f"Material.{prefix}.CanopyTeal", "summer_teal", "gloss")
    paint(f"Material.{prefix}.CanopyYellow", "summer_yellow", "gloss")
    paint(f"Material.{prefix}.Trim", "summer_teal", "matte")
    paint(f"Material.{prefix}.Pole", "summer_teal", "gloss")
    paint(f"Material.{prefix}.Stake", "summer_teal", "gloss")
    rim = 0.6
    apex = 1.48
    base = 1.04
    thickness = 0.04
    gores = 8
    segments = gores * 4

    def top_z(r):
        return base + (apex - base) * (1 - (r / rim) ** 1.5)

    def canopy(bm):
        cream, teal, coral, yellow = 0, 1, 2, 3
        radii = [rim * (index / 5) ** 0.85 for index in range(1, 6)]

        def ring(r, z):
            return [
                bm.verts.new((r * math.cos(i * math.tau / segments), r * math.sin(i * math.tau / segments), z))
                for i in range(segments)
            ]

        rings = [[bm.verts.new((0, 0, apex))]]
        rings += [ring(r, top_z(r)) for r in radii]
        rings.append(ring(rim + 0.012, top_z(rim) - thickness / 2))
        rings += [ring(r, top_z(r) - thickness) for r in reversed(radii)]
        rings.append([bm.verts.new((0, 0, apex - thickness))])
        shell = bridge_rings(bm, rings)
        bmesh.ops.recalc_face_normals(bm, faces=shell)
        for face in shell:
            centre = face.calc_center_median()
            gore = int((math.atan2(centre.y, centre.x) % math.tau) / (math.tau / gores)) % gores
            face.material_index = coral if gore % 2 == 0 else cream
        collar = add_lathe(bm, [(0, 1.455, 0), (0.07, 1.455, 0.01), (0.07, 1.49, 0.015), (0, 1.5, 0)], segments=12)
        for face in collar:
            face.material_index = teal
        finial = add_ellipsoid(bm, (0, 0, 1.52), (0.055, 0.055, 0.05), segments=12, rings=6)
        for face in finial:
            face.material_index = yellow
        return None

    def trim(bm):
        rings = []
        samples = 40
        for i in range(samples):
            theta = i * math.tau / samples
            scallop = abs(math.sin(theta * gores)) ** 0.6
            bottom = 1.005 - 0.06 * scallop
            top = top_z(rim) - 0.005
            loop = []
            for r, z in ((0.62, top), (0.62, bottom + 0.012), (0.604, bottom), (0.588, bottom + 0.012), (0.588, top)):
                loop.append(bm.verts.new((r * math.cos(theta), r * math.sin(theta), z)))
            rings.append(loop)
        faces = bridge_rings(bm, rings, closed=True)
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        return faces

    def pole(bm):
        return add_lathe(bm, [(0, 0.0, 0), (0.04, 0.0, 0.01), (0.04, 1.46, 0.02), (0, 1.47, 0)], segments=10)

    def ribs(bm):
        faces = add_lathe(bm, [(0, 1.16, 0), (0.06, 1.16, 0.015), (0.06, 1.23, 0.015), (0, 1.23, 0)], segments=10, steps=1)
        for index in range(gores):
            theta = index * math.tau / gores
            direction = Vector((math.cos(theta), math.sin(theta), 0))
            path = []
            for step in range(4):
                r = 0.06 + (0.57 - 0.06) * step / 3
                path.append(direction * r + Vector((0, 0, top_z(r) - thickness - 0.022)))
            faces += add_tube(bm, path, 0.018, sides=5, caps=("flat", "round"), cap_steps=1)
            middle = 0.3
            faces += add_tube(
                bm,
                [Vector((0, 0, 1.2)) + direction * 0.05, direction * middle + Vector((0, 0, top_z(middle) - thickness - 0.03))],
                0.014,
                sides=5,
                caps=("flat", "flat"),
            )
        return faces

    def stake(bm):
        return add_lathe(
            bm,
            [(0, 0, 0), (0.12, 0, 0.015), (0.115, 0.04, 0.025), (0.06, 0.075, 0.02), (0.05, 0.12, 0.01), (0, 0.12, 0)],
            segments=12,
            steps=1,
        )

    rebuild(f"{prefix}_Canopy", canopy, material_index=None)
    rebuild(f"{prefix}_CanopyTrim", trim)
    rebuild(f"{prefix}_Pole", pole)
    rebuild(f"{prefix}_Ribs", ribs)
    rebuild(f"{prefix}_Stake", stake)


def inflatable_pool_small():
    prefix = "InflatablePoolSmall"
    paint(f"{prefix}_TealRing", "summer_teal", "gloss")
    paint(f"{prefix}_YellowRing", "summer_yellow", "gloss")
    paint(f"{prefix}_CoralRing", "summer_coral", "gloss")
    paint(f"{prefix}_InnerWallAqua", "pool_aqua", "gloss")
    paint(f"{prefix}_WaterPreview", "water", "wet")
    major = (1.561, 1.534)
    minor = 0.225

    def ring_normal(z):
        def normal(point):
            angle = math.atan2(point.y / major[1], point.x / major[0])
            centre = Vector((major[0] * math.cos(angle), major[1] * math.sin(angle), z))
            return (point - centre).normalized()

        return normal

    for name, z in (("OuterRingBottom", 0.23), ("OuterRingMiddle", 0.54), ("OuterRingTop", 0.85)):
        rebuild(
            f"{prefix}_{name}",
            lambda bm, z=z: add_torus_xy(bm, (0, 0, z), major, minor, 36, 8),
            custom_normals=ring_normal(z),
        )
    wall = bpy.data.objects[f"{prefix}_InnerWall"]
    bake_scale(wall)
    rebuild(
        f"{prefix}_InnerWall",
        lambda bm: add_lathe(
            bm,
            [(0, 0.02, 0), (1.36, 0.02, 0), (1.36, 0.9, 0.02), (1.3, 0.9, 0.02), (1.3, 0.08, 0), (0, 0.08, 0)],
            segments=32,
            steps=1,
            scale=(1.0, major[1] / major[0]),
        ),
    )
    rebuild(
        f"{prefix}_Water",
        lambda bm: add_lathe(
            bm,
            [(0, 0.695, 0), (1.37, 0.695, 0.01), (1.37, 0.725, 0.01), (0.9, 0.725, 0), (0.45, 0.725, 0), (0, 0.725, 0)],
            segments=32,
            steps=1,
            scale=(1.0, major[1] / major[0]),
        ),
    )


def sandcastle_small_a():
    prefix = "SandcastleSmallA"
    paint(f"{prefix}_SandMain", "sand_light", "matte")
    paint(f"{prefix}_SandLight", "sand_pale", "matte")
    paint(f"{prefix}_SandDeep", "sand_deep", "matte")
    paint(f"{prefix}_Pole", "timber_light", "satin")
    paint(f"{prefix}_Flag", "enamel_red", "satin")
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            bake_scale(obj)
    towers = {"Central": (0.0, 0.019), "LeftTower": (-1.05, -0.02), "RightTower": (1.05, -0.02)}

    rebuild(f"{prefix}_Gatehouse", lambda bm: add_box(bm, (-0.775, -0.475, 0), (0.775, 0.475, 0.996), 0.16, segments=2))
    rebuild(f"{prefix}_GateArchRecess", lambda bm: add_box(bm, (-0.22, -0.5, 0), (0.22, -0.36, 0.64), 0.14, segments=2))
    for side, x in (("Left", -1.05), ("Right", 1.05)):
        rebuild(
            f"{prefix}_{side}TowerTowerBody",
            lambda bm, x=x: add_lathe(
                bm, [(0, 0, 0), (0.36, 0, 0.02), (0.36, 1.1, 0.06), (0, 1.1, 0)], center=(x, -0.02, 0), segments=16, steps=1
            ),
        )
        rebuild(
            f"{prefix}_{side}TowerBattlementRing",
            lambda bm, x=x: add_lathe(
                bm, [(0, 1.05, 0), (0.44, 1.05, 0.04), (0.44, 1.19, 0.05), (0, 1.19, 0)], center=(x, -0.02, 0), segments=16, steps=1
            ),
        )
        rebuild(
            f"{prefix}_{side}TowerWindowRecess",
            lambda bm, x=x: add_box(bm, (x - 0.1, -0.4, 0.3), (x + 0.1, -0.3, 0.6), 0.08, segments=1),
        )
    rebuild(
        f"{prefix}_CentralTower",
        lambda bm: add_lathe(
            bm, [(0, 0.95, 0), (0.42, 0.95, 0.02), (0.42, 1.88, 0.06), (0, 1.88, 0)], center=(0, 0.019, 0), segments=16, steps=1
        ),
    )
    rebuild(
        f"{prefix}_CentralTowerBattlementBase",
        lambda bm: add_lathe(
            bm,
            [(0, 1.85, 0), (0.51, 1.85, 0.04), (0.51, 1.965, 0.05), (0, 1.965, 0)],
            center=(0, 0.019, 0),
            segments=16,
            steps=1,
        ),
    )
    rebuild(f"{prefix}_UpperWindowRecess", lambda bm: add_box(bm, (-0.085, -0.44, 1.42), (0.085, -0.33, 1.72), 0.07, segments=1))
    rebuild(
        f"{prefix}_ConeRoof",
        lambda bm: add_lathe(
            bm,
            [(0, 1.95, 0), (0.29, 1.95, 0.02), (0.29, 2.0, 0.05), (0.03, 2.36, 0.06), (0, 2.38, 0)],
            center=(0, 0.019, 0),
            segments=16,
            steps=1,
        ),
    )
    rebuild(
        f"{prefix}_FlagPole",
        lambda bm: add_lathe(
            bm,
            # 0.2 across, 0.03 in the game, with a round knob on top.
            [(0, 2.3, 0), (0.1, 2.3, 0.01), (0.1, 2.6, 0.01), (0.07, 2.62, 0), (0.125, 2.665, 0.05), (0.085, 2.77, 0.05), (0, 2.775, 0)],
            center=(0, 0.019, 0),
            segments=10,
            steps=1,
        ),
    )
    # The pennant is 0.2 thick, 0.03 in the game, centred on the pole.
    rebuild(
        f"{prefix}_Flag",
        lambda bm: add_prism(
            bm, round_closed([(0.04, 2.62), (0.04, 2.4), (0.44, 2.51)], 0.05), -0.081, 0.119, 0.05, axis="y"
        ),
    )
    for tower, (cx, cy) in towers.items():
        size = 0.2 if tower == "Central" else 0.19
        orbit = 0.4 if tower == "Central" else 0.35
        bottom = 1.94 if tower == "Central" else 1.17
        for index in range(1, 9):
            name = f"{prefix}_{tower}Crenel{index:02d}"
            origin = bpy.data.objects[name].location
            angle = math.atan2(origin.y - cy, origin.x - cx)

            def crenel(bm, angle=angle, cx=cx, cy=cy, size=size, orbit=orbit, bottom=bottom):
                faces = add_box(bm, (-size / 2, -size / 2, 0), (size / 2, size / 2, size), 0.06, segments=1)
                matrix = (
                    Matrix.Translation((cx + orbit * math.cos(angle), cy + orbit * math.sin(angle), bottom))
                    @ Matrix.Rotation(angle, 4, "Z")
                )
                return place_verts(bm, faces, matrix)

            rebuild(name, crenel)
    for name in ("SandBlock05", "SandBlock06"):
        low, high = world_bounds(f"{prefix}_{name}")
        rebuild(f"{prefix}_{name}", lambda bm, low=low, high=high: add_box(bm, low, high, 0.025, segments=1))


# ----------------------------------------------------------------- holiday
def snowman():
    """Three soft snowballs. Snowman.tsx colours them and adds the face."""

    def body(bm):
        faces = []
        for centre, radius in (((0, 0, 0.27), 0.31), ((0, 0, 0.7), 0.23), ((0, 0, 1.05), 0.17)):
            faces += add_ellipsoid(bm, centre, (radius, radius, radius), segments=20, rings=12, floor=-0.01)
        return faces

    rebuild("Snowman", body)


# ------------------------------------------------------------------ stands
# IceCreamCart.tsx and LemonadeStand.tsx draw these models at this scale, so
# sizes in the game are 0.45 times the source units.
STAND_SCALE = 0.45
# Every part is at least 0.03 thick in the game.
STAND_MIN_SIZE = 0.03 / STAND_SCALE
# Long thin boxes that become round rods with flat ends hidden in what they
# join: wheel spokes, menu legs, handle bars.
STAND_RODS = ("wheel_spoke", "menu_back_leg", "side_handle_bar", "spigot_handle")
# The FONT text. Neither cart's TSX draws it (they render only nodes named
# after the cart), so it is kept as cheap as possible: the lowest curve
# resolution and no extrusion. The object and mesh names stay.
STAND_TEXT_RESOLUTION = 1
STAND_TEXT_EXTRUDE = 0.0

STAND_ROLES = {
    "IceCreamCart": {
        "cream": ("summer_cream", "satin"),
        "cream2": ("enamel_cream", "satin"),
        "pink": ("pink", "satin"),
        "pink_dark": ("pink_deep", "satin"),
        "gray": ("stone_light", "satin"),
        "tire": ("tire", "matte"),
        "gold": ("waffle", "satin"),
        "metal": ("steel", "gloss"),
        "white": ("summer_cream", "satin"),
        "darkgray": ("steel", "gloss"),
        "vanilla": ("vanilla", "gloss"),
        "strawberry": ("strawberry", "gloss"),
        "chocolate": ("chocolate", "gloss"),
        "mint": ("mint", "gloss"),
        "brown_bottle": ("chocolate", "gloss"),
        "teal": ("summer_teal", "gloss"),
        "blackboard": ("chalkboard", "matte"),
    },
    "LemonadeStand": {
        "cream": ("summer_cream", "satin"),
        "cream2": ("enamel_cream", "satin"),
        "yellow": ("summer_yellow", "satin"),
        "yellow_dark": ("yellow_deep", "satin"),
        "green": ("leaf", "satin"),
        "green_dark": ("canopy", "satin"),
        "tire": ("tire", "matte"),
        "metal": ("steel", "gloss"),
        "white": ("summer_cream", "satin"),
        "lemon": ("summer_yellow", "gloss"),
        "liquid": ("lemonade", "wet"),
        "glass": ("glass_cool", "wet"),
        "lemon_light": ("vanilla", "gloss"),
        "blackboard": ("chalkboard", "matte"),
        "gray": ("stone_light", "satin"),
        "flower_white": ("summer_cream", "satin"),
        "flower_center": ("summer_orange", "satin"),
    },
}


def axis_rotation(axis, sign):
    """Rotation that maps +Z onto the local `axis` (0, 1, 2) with `sign`."""
    target = Vector([0.0, 0.0, 0.0])
    target[axis] = sign
    return Vector((0, 0, 1)).rotation_difference(target).to_matrix().to_4x4()


def source_shape(obj):
    """What the original part was: its kind, local bounds and axis.

    Read from the source mesh on the first run and kept as a custom property,
    so running the script again rebuilds the same shapes.
    """
    if "party_shape" in obj:
        return json.loads(obj["party_shape"])
    bake_scale(obj)
    points = [vert.co.copy() for vert in obj.data.vertices]
    count = len(points)
    distinct = [sorted({round(p[i], 4) for p in points}) for i in range(3)]
    shape = {
        "low": [min(p[i] for p in points) for i in range(3)],
        "high": [max(p[i] for p in points) for i in range(3)],
        "axis": None,
        "sign": 1,
    }
    if count == 8:
        shape["kind"] = "box"
    elif count == 9:
        shape["kind"] = "cone"
        axis = next(i for i in range(3) if len(distinct[i]) == 2)
        at_high = sum(1 for p in points if abs(p[axis] - distinct[axis][1]) < 1e-4)
        shape["axis"] = axis
        shape["sign"] = 1 if at_high == 1 else -1
    elif count == 12:
        shape["kind"] = "blob"
    else:
        shape["kind"] = "cylinder"
        size = [shape["high"][i] - shape["low"][i] for i in range(3)]
        candidates = [i for i in range(3) if len(distinct[i]) == 2]
        shape["axis"] = candidates[0] if candidates else min(range(3), key=lambda i: size[i])
    obj["party_shape"] = json.dumps(shape)
    return shape


def add_rod(bm, low, high, sides=6):
    """A smooth rod along the longest side of a box, with flat ends."""
    size = high - low
    axis = max(range(3), key=lambda i: size[i])
    others = [i for i in range(3) if i != axis]
    centre = (low + high) / 2
    # Sized across the flats, so the rod is never thinner than the box.
    widen = 1 / math.cos(math.pi / sides)
    rings = []
    for end in (low[axis], high[axis]):
        ring = []
        for index in range(sides):
            angle = index * math.tau / sides
            point = centre.copy()
            point[axis] = end
            point[others[0]] += size[others[0]] / 2 * widen * math.cos(angle)
            point[others[1]] += size[others[1]] / 2 * widen * math.sin(angle)
            ring.append(bm.verts.new(point))
        rings.append(ring)
    faces = bridge_rings(bm, rings)
    faces.append(bm.faces.new(list(reversed(rings[0]))))
    faces.append(bm.faces.new(rings[1]))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def cylinder_segments(game_radius):
    """Smooth outlines on the large discs (wheels, tires, emblems)."""
    if game_radius >= 0.18:
        return 20
    if game_radius >= 0.09:
        return 16
    if game_radius >= 0.08:
        return 10
    # Hubs, knobs, cups and caster tyres; 8 sides are smooth at this size.
    return 8


def stand_part(obj, scale=STAND_SCALE):
    """Rebuilds one box, cone, blob or cylinder part as a rounded shape."""
    shape = source_shape(obj)
    low = Vector(shape["low"])
    high = Vector(shape["high"])
    centre = (low + high) / 2
    size = high - low
    for axis in range(3):
        if size[axis] < STAND_MIN_SIZE:
            size[axis] = STAND_MIN_SIZE
    low = centre - size / 2
    high = centre + size / 2
    game_min = min(size) * scale
    game_max = max(size) * scale
    radius = ps.bevel_radius_for(game_min) / scale
    # Only the large masses (body, counter, trims) get a second bevel segment.
    big = game_min >= 0.07 and game_max >= 0.5 and min(sorted(size)[1] * scale, 1) >= 0.5
    bm = bmesh.new()
    kind = shape["kind"]
    if "mint_chip" in obj.name:
        # A soft chocolate chip instead of a cube, 0.03 across its flats.
        widen = 1 / math.cos(math.pi / 6)
        add_ellipsoid(bm, centre, (size.x / 2 * widen, size.y / 2 * widen, size.z / 2), segments=6, rings=3)
    elif kind == "box" and any(rod in obj.name for rod in STAND_RODS):
        add_rod(bm, low, high, sides=6)
    elif kind == "box":
        add_box(bm, low, high, radius, segments=2 if big else 1)
    elif kind == "cone":
        axis = shape["axis"]
        sign = shape["sign"]
        others = [i for i in range(3) if i != axis]
        r = max(size[others[0]], size[others[1]]) / 2
        length = size[axis]
        faces = add_lathe(
            bm,
            [(0, 0, 0), (r, 0, min(0.04, r * 0.3)), (r * 0.12, length, min(0.05, r * 0.5)), (0, length, 0)],
            segments=10,
            steps=1,
        )
        start = centre.copy()
        start[axis] -= sign * length / 2
        place_verts(bm, faces, Matrix.Translation(start) @ axis_rotation(axis, sign))
    elif kind == "blob":
        if game_max < 0.05:
            # Petals and flower centres, a few pixels across.
            segments, rings = 6, 2
        elif game_max < 0.1:
            # Small leaves, scoops, menu dots.
            segments, rings = 6, 3
        elif game_min < 0.04:
            # Flat pieces. A leaf lying flat (thin along Z) shows its outline
            # from above; an awning scallop (thin along Y) shows its profile.
            segments, rings = (6, 3) if size.z <= min(size.x, size.y) else (6, 4)
        elif game_max < 0.15:
            # Lemons in the crate.
            segments, rings = 8, 4
        elif game_max < 0.25:
            segments, rings = 8, 5
        else:
            segments, rings = 10, 6
        add_ellipsoid(bm, centre, size / 2, segments=segments, rings=rings)
    else:
        axis = shape["axis"]
        others = [i for i in range(3) if i != axis]
        length = size[axis]
        r = max(size[others[0]], size[others[1]]) / 2
        if length < r:
            # A disc (wheel, tire, emblem, lid, cup): one soft bulge around
            # the rim instead of two rounded corners.
            inset = min(radius, r * 0.3, length / 2)
            profile = [(0, 0, 0), (r - inset, 0, 0), (r, length / 2, 0), (r - inset, length, 0), (0, length, 0)]
        else:
            corner = min(length * 0.45, r * 0.4, radius * 1.6)
            profile = [(0, 0, 0), (r, 0, corner), (r, length, corner), (0, length, 0)]
        faces = add_lathe(
            bm,
            profile,
            # The dispenser liquid is seen only through the glass around it.
            segments=12 if "_liquid" in obj.name else cylinder_segments(r * scale),
            steps=1,
            scale=(size[others[0]] / (2 * r), size[others[1]] / (2 * r)) if axis == 2 else (1.0, 1.0),
        )
        start = centre.copy()
        start[axis] -= length / 2
        place_verts(bm, faces, Matrix.Translation(start) @ axis_rotation(axis, 1))
    for face in bm.faces:
        face.material_index = 0
    finish(obj, bm, local=True)


def lemon_slice_segment(obj, name):
    """One of six pale flesh lobes on the face of a jar lemon slice.

    The source had six 0.006 bars fanned in the wrong plane; together the
    lobes now read as the slice's pale centre inside its yellow rind.
    """
    slice_index, part = obj.name.rsplit("_", 2)[-2:]
    slice_obj = bpy.data.objects[f"{name}_jar_lemon_slice_{slice_index}"]
    slice_shape = source_shape(slice_obj)
    slice_radius = (slice_shape["high"][0] - slice_shape["low"][0]) / 2
    centre = slice_obj.matrix_world.translation.copy()
    angle = int(part) * math.pi / 3 + math.pi / 6
    half = STAND_MIN_SIZE / 2
    # In front of the slice (-Y), sunk a little into its face.
    depth = centre.y - max(slice_shape["high"][2] - slice_shape["low"][2], STAND_MIN_SIZE) / 2 - half + 0.012
    lobe_centre = Vector((centre.x, depth, centre.z)) + 0.46 * slice_radius * Vector((math.cos(angle), 0, math.sin(angle)))
    bm = bmesh.new()
    faces = add_ellipsoid(bm, (0, 0, 0), (0.36 * slice_radius, half * 1.08, half), segments=6, rings=2)
    frame = Matrix(
        (
            (math.cos(angle), -math.sin(angle), 0, 0),
            (0, 0, -1, 0),
            (math.sin(angle), math.cos(angle), 0, 0),
            (0, 0, 0, 1),
        )
    )
    place_verts(bm, faces, Matrix.Translation(lobe_centre) @ frame)
    finish(obj, bm)


def menu_lines(name, scale=STAND_SCALE):
    """Lays each menu row out as an item bar (`_a`) and a short price bar (`_b`).

    The source stacked the two lines 0.07 apart, which leaves no gap once each
    is 0.03 thick in the game, so they now sit side by side on one row, next
    to the row's colour dot where the board has one. Origins stay in place.
    """
    rows = {}
    for obj in bpy.data.objects:
        if obj.type == "MESH" and obj.name.startswith(f"{name}_menu_line_"):
            row, part = obj.name.rsplit("_", 2)[-2:]
            rows.setdefault(row, {})[part] = obj
    obstacles = [
        world_bounds(obj.name)
        for obj in bpy.data.objects
        if obj.type == "MESH"
        and obj.name.startswith(f"{name}_menu_")
        and any(key in obj.name for key in ("lemon_icon", "leaf", "color_dot"))
    ]
    dots = [obj for obj in bpy.data.objects if obj.name.startswith(f"{name}_menu_color_dot_")]
    thickness = STAND_MIN_SIZE
    radius = ps.bevel_radius_for(thickness * scale) / scale
    for row in sorted(rows):
        item = rows[row]["a"]
        price = rows[row].get("b")
        item_shape = source_shape(item)
        a_loc = item.matrix_world.translation
        z = a_loc.z
        y = a_loc.y
        if price is not None:
            source_shape(price)
            b_loc = price.matrix_world.translation
            z = (a_loc.z + b_loc.z) / 2
            near_dots = [dot.matrix_world.translation.z for dot in dots if abs(dot.matrix_world.translation.z - z) < 0.06]
            if near_dots:
                z = near_dots[0]
            # The lines step back with the tilted board; follow that slope.
            y = a_loc.y + (b_loc.y - a_loc.y) * (z - a_loc.z) / (b_loc.z - a_loc.z)
        start = a_loc.x + item_shape["low"][0]
        end = a_loc.x + item_shape["high"][0]
        for low, high in obstacles:
            if low.z < z + thickness and high.z > z - thickness and low.x < end and high.x > start:
                start = max(start, high.x + 0.03)
        rotation = item.matrix_world.to_quaternion().to_matrix().to_4x4()
        parts = [(item, (start, end))]
        if price is not None:
            parts.append((price, (end + 0.04, end + 0.14)))
        for obj, (x0, x1) in parts:
            bm = bmesh.new()
            faces = add_box(bm, (x0, -thickness / 2, -thickness / 2), (x1, thickness / 2, thickness / 2), radius, segments=1)
            place_verts(bm, faces, Matrix.Translation((0, y, z)) @ rotation)
            finish(obj, bm)


WOOD_INPUTS = ("Base Color", "Metallic", "Roughness", "IOR", "Specular IOR Level", "Coat Weight", "Coat Roughness", "Emission Color", "Emission Strength", "Alpha")
STAND_WOOD = {
    "IceCreamCart": ("wood", "wood_dark"),
    "LemonadeStand": ("tan", "wood", "wood_dark", "wood_light"),
}


def shared_wood_profile(role="default"):
    """A shared plank profile, as apply-bridge-wood-palette.py copies it."""
    file_name, material_name = WOOD_PROFILES[role]
    path = ASSETS_DIR / file_name
    with bpy.data.libraries.load(str(path), link=False) as (source, target):
        target.materials = [material_name]
    reference = target.materials[0]
    shader = ps.principled(reference)
    profile = {}
    for name in WOOD_INPUTS:
        value = shader.inputs[name].default_value
        try:
            value = tuple(value)
        except TypeError:
            pass
        profile[name] = value
    bpy.data.materials.remove(reference)
    return profile


def stand(name):
    # Wood keeps the shared profile; this only re-applies it, so a source
    # restored from an older commit matches timberAssetPalette.unit.ts.
    profile = shared_wood_profile()
    for material_name in STAND_WOOD[name]:
        shader = ps.principled(material(material_name))
        for input_name, value in profile.items():
            shader.inputs[input_name].default_value = value
    for material_name, (role, band) in STAND_ROLES[name].items():
        paint(material_name, role, band)
    for obj in bpy.data.objects:
        if obj.type == "FONT":
            obj.data.resolution_u = STAND_TEXT_RESOLUTION
            obj.data.extrude = STAND_TEXT_EXTRUDE
        if obj.type != "MESH" or not obj.name.startswith(f"{name}_"):
            continue
        if "jar_slice_segment" in obj.name:
            lemon_slice_segment(obj, name)
        elif "menu_line" not in obj.name:
            stand_part(obj)
    # Last, so they can make room for the rebuilt icons and colour dots.
    menu_lines(name)


# -------------------------------------------------------------------- boat
def catmull_rom(rows, samples_per_span):
    """Smoothly resamples a list of equal-length parameter rows."""
    out = []
    count = len(rows)
    for index in range(count - 1):
        p0 = rows[max(index - 1, 0)]
        p1 = rows[index]
        p2 = rows[index + 1]
        p3 = rows[min(index + 2, count - 1)]
        for step in range(samples_per_span):
            t = step / samples_per_span
            out.append(
                tuple(
                    0.5
                    * (
                        2 * b
                        + (-a + c) * t
                        + (2 * a - 5 * b + 4 * c - d) * t * t
                        + (-a + 3 * b - 3 * c + d) * t ** 3
                    )
                    for a, b, c, d in zip(p0, p1, p2, p3)
                )
            )
    out.append(tuple(rows[-1]))
    return out


def rounded_rect(half_width, half_height, radius, steps=2):
    corners = [(half_width, -half_height), (half_width, half_height), (-half_width, half_height), (-half_width, -half_height)]
    return round_closed(corners, radius, steps)


def add_sweep(bm, path, profiles):
    """Sweeps closed 2D profiles (u across, v up) along a path with flat ends."""
    path = [Vector(point) for point in path]
    rings = []
    up = Vector((0, 0, 1))
    for index, point in enumerate(path):
        tangent = (path[min(index + 1, len(path) - 1)] - path[max(index - 1, 0)]).normalized()
        across = tangent.cross(up).normalized()
        local_up = across.cross(tangent).normalized()
        rings.append([bm.verts.new(point + across * u + local_up * v) for u, v in profiles[index]])
    rings.insert(0, [bm.verts.new(path[0])])
    rings.append([bm.verts.new(path[-1])])
    faces = bridge_rings(bm, rings)
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def fishing_boat():
    prefix = "Material.FishingBoat"
    # Shared plank profiles: the warm walkway wood for rails, benches and
    # oars, the bridge's lighter plank for the floor and its warmer plank for
    # the lower hull band (still above 0.7 value on screen).
    for wood, role in (
        ("DarkWarmWood", "bridgeWarm"),
        ("HullWood", "default"),
        ("InteriorWood", "bridgeLight"),
        ("WarmWood", "default"),
    ):
        shared_wood(f"{prefix}.{wood}", role)
    paint(f"{prefix}.Rope", "rope", "matte")
    paint(f"{prefix}.Net", "net", "matte")
    paint(f"{prefix}.FloatGold", "summer_orange", "gloss")
    paint(f"{prefix}.DarkMetal", "steel", "gloss")
    ps.set_surface(material(f"{prefix}.Ripple"), ROUGH["wet"])

    # (y, half width, keel z, chine z, sheer z), from generate-fishing-boat.py.
    hull_sections = [
        (-0.84, 0.27, 0.15, 0.25, 0.33),
        (-0.58, 0.40, 0.07, 0.21, 0.31),
        (0.18, 0.43, 0.045, 0.20, 0.32),
        (0.60, 0.34, 0.10, 0.27, 0.40),
        (0.88, 0.045, 0.23, 0.39, 0.54),
    ]

    def hull(bm):
        sections = catmull_rom(hull_sections, 4)
        # Soft ends: a slightly smaller section just past the transom and bow.
        first = sections[0]
        last = sections[-1]
        sections = (
            [(first[0] - 0.025, first[1] * 0.82, first[2] + 0.03, first[3] + 0.01, first[4] - 0.02)]
            + sections
            + [(last[0] + 0.02, last[1] * 0.6, last[2] + 0.03, last[3], last[4] - 0.02)]
        )
        rings = []
        for y, width, keel, chine, sheer in sections:
            ratio = max(0.05, min(0.95, (chine - keel) / max(sheer - keel, 1e-6)))
            power = math.log(ratio) / math.log(0.63)
            loop = []
            for index in range(13):
                t = -1 + 2 * index / 12
                angle = t * math.pi / 2
                loop.append(
                    bm.verts.new(
                        (
                            width * math.sin(angle),
                            y,
                            keel + (sheer - keel) * (1 - math.cos(angle)) ** power,
                        )
                    )
                )
            # Across the top from starboard back to port.
            for x in (0.5, 0.0, -0.5):
                loop.append(bm.verts.new((width * x, y, sheer)))
            rings.append(loop)
        start = sum((vert.co for vert in rings[0]), Vector()) / len(rings[0])
        end = sum((vert.co for vert in rings[-1]), Vector()) / len(rings[-1])
        rings = [[bm.verts.new(start)]] + rings + [[bm.verts.new(end)]]
        faces = bridge_rings(bm, rings)
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        return faces

    # (y, outer half width, bottom z, top z)
    rail_sections = [
        (-0.78, 0.30, 0.32, 0.48),
        (-0.55, 0.41, 0.31, 0.49),
        (0.18, 0.43, 0.32, 0.51),
        (0.59, 0.34, 0.40, 0.57),
        (0.80, 0.14, 0.49, 0.62),
    ]

    def hull_wood(bm):
        faces = []
        sections = catmull_rom(rail_sections, 3)
        for side in (-1, 1):
            path = []
            profiles = []
            for y, outer, bottom, top in sections:
                half_height = (top - bottom + 0.015) / 2
                path.append((side * (outer - 0.0525), y, bottom - 0.015 + half_height))
                profiles.append(rounded_rect(0.0525, half_height, 0.04))
            faces += add_sweep(bm, path, profiles)
        faces += add_prism(
            bm, round_closed([(-0.15, 0.77), (0.15, 0.77), (0.045, 0.9), (-0.045, 0.9)], 0.03), 0.52, 0.62, 0.025
        )
        faces += add_box(bm, (-0.3, -0.845, 0.33), (0.3, -0.735, 0.51), 0.04, segments=2)
        return faces

    def interior(bm):
        outline = round_closed([(-0.27, -0.57), (0.27, -0.57), (0.3, 0.32), (0.2, 0.57), (-0.2, 0.57), (-0.3, 0.32)], 0.05)
        return add_prism(bm, outline, 0.31, 0.35, 0.012)

    def benches(bm):
        faces = add_box(bm, (-0.32, -0.535, 0.42), (0.32, -0.385, 0.49), 0.025, segments=2)
        faces += add_box(bm, (-0.285, 0.27, 0.465), (0.285, 0.41, 0.535), 0.025, segments=2)
        return faces

    def oars(bm):
        faces = []
        for side in (-1, 1):
            faces += add_tube(bm, [(side * 0.25, -0.57, 0.525), (side * 0.33, 0.57, 0.575)], 0.024, sides=8, cap_steps=1)
            blade = add_box(bm, (-0.0575, -0.1375, -0.02), (0.0575, 0.1375, 0.02), 0.018, segments=2)
            faces += place_verts(
                bm, blade, Matrix.Translation((side * 0.34, 0.69, 0.59)) @ Matrix.Rotation(-side * 0.055, 4, "Z")
            )
        return faces

    def rope(bm):
        faces = add_torus(bm, (0.13, 0.53, 0.605), 0.1, 0.022, 16, 6)
        faces += add_torus(bm, (0.13, 0.53, 0.607), 0.056, 0.02, 12, 6)
        faces += add_tube(bm, [(0.05, 0.53, 0.605), (-0.03, 0.44, 0.575)], 0.018, sides=6, cap_steps=1)
        return faces

    def net(bm):
        faces = add_ellipsoid(bm, (-0.15, -0.61, 0.43), (0.12, 0.075, 0.07), segments=10, rings=6)
        faces += add_ellipsoid(bm, (-0.04, -0.64, 0.44), (0.1, 0.07, 0.06), segments=10, rings=6)
        faces += add_ellipsoid(bm, (-0.2, -0.68, 0.46), (0.085, 0.06, 0.055), segments=10, rings=6)
        faces += add_torus(bm, (-0.12, -0.63, 0.47), 0.095, 0.015, 16, 5, scale=(1.2, 0.7))
        return faces

    def floats(bm):
        faces = []
        for index in range(5):
            faces += add_ellipsoid(
                bm, (-0.26 + index * 0.06, -0.69 + (index % 2) * 0.035, 0.5), (0.032, 0.032, 0.032), segments=8, rings=5
            )
        return faces

    def metal(bm):
        faces = []
        for side in (-1, 1):
            faces += add_box(bm, (side * 0.25 - 0.0425, 0.6725, 0.5725), (side * 0.25 + 0.0425, 0.7075, 0.6075), 0.012, segments=2)
        ring = add_torus(bm, (0, 0, 0), 0.03, 0.012, 12, 6)
        faces += place_verts(bm, ring, Matrix.Translation((0, -0.855, 0.49)) @ Matrix.Rotation(math.pi / 2, 4, "X"))
        return faces

    def ripples(bm):
        faces = add_torus(bm, (0, 0.03, 0), 0.608, 0.014, 28, 5, scale=(0.76, 1.48))
        faces += add_torus(bm, (0, -0.02, 0), 0.501, 0.012, 28, 5, scale=(0.72, 1.43))
        # Flat rings lying on the water; the lowest point stays exactly at 0.
        verts = list({vert for face in faces for vert in face.verts})
        lowest = min(vert.co.z for vert in verts)
        for vert in verts:
            vert.co.z = (vert.co.z - lowest) * 0.35
        return faces

    rebuild("FishingBoat_HullWoodDark", hull)
    rebuild("FishingBoat_HullWood", hull_wood)
    rebuild("FishingBoat_InteriorWood", interior)
    rebuild("FishingBoat_Benches", benches)
    rebuild("FishingBoat_Oars", oars)
    rebuild("FishingBoat_Rope", rope)
    rebuild("FishingBoat_Net", net)
    rebuild("FishingBoat_Floats", floats)
    rebuild("FishingBoat_Metal", metal)
    rebuild("FishingBoat_Ripples", ripples)


RESTYLERS = {
    "FishingBoat": fishing_boat,
    "IceCreamCart": lambda: stand("IceCreamCart"),
    "LemonadeStand": lambda: stand("LemonadeStand"),
    "Snowman": snowman,
    "BeachBall": beach_ball,
    "BeachTowelStriped": beach_towel_striped,
    "BeachUmbrella": beach_umbrella,
    "InflatablePoolSmall": inflatable_pool_small,
    "SandcastleSmallA": sandcastle_small_a,
    "DoubleGardenLightPole": double_garden_light_pole,
    "EnamelGardenLamp": enamel_garden_lamp,
    "RoofTileLantern": roof_tile_lantern,
    "WickerGardenLantern": wicker_garden_lantern,
    "WoodenHandLantern": wooden_hand_lantern,
    "FireflyJar": firefly_jar,
}


def main():
    args = parse_args()
    wanted = args.asset or list(RESTYLERS)
    unknown = sorted(set(wanted) - set(RESTYLERS))
    if unknown:
        raise RuntimeError(f"Unknown assets: {', '.join(unknown)}")
    bpy.context.preferences.filepaths.save_version = 0
    for name in wanted:
        path = ASSETS_DIR / f"{name}.blend"
        bpy.ops.wm.open_mainfile(filepath=str(path))
        bpy.context.preferences.filepaths.save_version = 0
        RESTYLERS[name]()
        print(f"Restyled {name}")
        report()
        bpy.ops.wm.save_mainfile(filepath=str(path))


if __name__ == "__main__":
    main()
