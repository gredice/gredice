"""Party-toy pass for furniture, tools and small props (see GAME_ART.md).

Rebuilds the beach chair, bucket, stool, wooden bench, watering can, small
shovel, paint roller, harvest basket, fieldwork clipboard, cat pillow, summer
hat and gift box as chunky rounded shapes with smooth shading, and moves their
materials to the on-screen colour roles with metalness 0 and roughness by band.

Rules this script keeps:

- Object names, origins, rotations and material names stay as they were, so
  the runtime keeps finding the same nodes. Shapes are authored in world
  metres and converted into each object's own space. Where an object carried
  its size in a non-uniform scale (the beach chair bars), the scale is moved
  into the mesh so the bevels stay round.
- Timber materials keep the shared wood profile (`timberAssetPalette.unit.ts`),
  so only their shapes change.
- Footprints stay inside what each prop had. The stool keeps its pinned bounds,
  the bench keeps its seat slat tops (autumn leaf anchors) and the bucket,
  stool and pillow keep the heights animals perch at.
- Geometry nodes are replaced by plain meshes (bucket, bucket handle, stool),
  so the Blender 5.2 exporter keeps the mesh names the runtime looks up
  (`Bucket_1`, `Bucket_2`, `Bucket_3`).

Colours are given as the sRGB colour a sunlit top face shows on screen and
converted with `party_style.screen_to_albedo`. Most come from the base and
seasonal roles in `party_style` (`SCREEN` below). Colours that code sets are
mirrored in the entity TSX files: the cat pillow and watering can import the
same roles from `packages/game/src/scene/seasonalRoles.ts`, and the gift box
variants take theirs from there in `entities/helpers/GiftBox.tsx`.

Run from the repository root, then export the touched assets:

    /Applications/Blender.app/Contents/MacOS/Blender -b \
        --python assets/scripts/party-pass-props.py -- --asset Stool
    (cd assets && Blender -b --python export-game-assets.py -- --asset Stool)

Without `--asset` every prop in the group is restyled. The script rebuilds
meshes from scratch each run, so running it again gives the same result.
"""

import argparse
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import party_style  # noqa: E402

ASSETS_DIR = Path(__file__).resolve().parents[1] / "game-assets"

def role(name, roughness=None):
    """On-screen colour and roughness of a GAME_ART.md role.

    Looks in the base roles first, then the seasonal ones. `roughness` puts the
    role colour on another material band, such as cream on petals or enamel
    blue on fabric.
    """
    table = (
        party_style.SCREEN_ROLES
        if name in party_style.SCREEN_ROLES
        else party_style.SEASONAL_ROLES
    )
    hex_value, role_roughness = table[name]
    return hex_value, role_roughness if roughness is None else roughness


# On-screen colour (sunlit top face) and roughness for each colour used here.
# Keys that name a role in GAME_ART.md take that role as it is; the others
# put a role colour on this prop's material band. The prop colours at the end
# have no role yet and stay inside the saturation and value ranges of the
# colour rules.
SCREEN = {
    name: role(name)
    for name in (
        "steel",
        "water",
        "timber_light",
        "timber_dark",
        "ripe_red",
        "crop_leaf",
        "crop_leaf_light",
        "canopy",
        "cream",
        "hay",
        "hay_shade",
        "pumpkin_light",
        "enamel_blue",
        "holiday_gold",
    )
}
SCREEN.update(
    {
        # Role colours on another band.
        "fabric_blue": role("enamel_blue", 0.8),  # matte fabric
        "fabric_yellow": role("hay"),  # matte fabric, straw yellow
        "petal_cream": role("cream", 0.5),  # satin petals
        "flower_gold": role("holiday_gold", 0.45),  # as the sunflower petal role
        "turnip_cream": role("cream", 0.45),  # glossy produce
        "zucchini": role("canopy", 0.4),  # glossy produce
        # Prop colours without a role.
        "pillow_red": ("#ee5048", 0.8),
        "ribbon_pink": ("#ee4f7a", 0.8),
        "enamel_orange": ("#f06a35", 0.4),
        # Nearest reachable colour to the carrot orange role #ff8a1c.
        "carrot": ("#f28a2a", 0.4),
        "ink_blue": ("#6f8fd8", 0.55),
        "pencil_wood": ("#f0c890", 0.55),
        "graphite": ("#707a96", 0.5),
        "eraser_pink": ("#f08a8a", 0.8),
    }
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", action="append", default=[])
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


# ---------------------------------------------------------------- materials
def paint(material_name, colour, double_sided=None):
    material = bpy.data.materials.get(material_name)
    if material is None:
        raise RuntimeError(f"missing material {material_name}")
    hex_value, roughness = SCREEN[colour]
    party_style.set_flat_colour(
        material, party_style.screen_to_albedo(hex_value), roughness
    )
    if double_sided is not None:
        material.use_backface_culling = not double_sided
    return material


def zero_metalness_everywhere():
    for material in bpy.data.materials:
        if material.use_nodes and party_style.principled(material):
            shader = party_style.principled(material)
            if shader.inputs["Metallic"].default_value != 0:
                party_style.set_surface(
                    material, shader.inputs["Roughness"].default_value
                )


def set_slots(obj, names):
    obj.data.materials.clear()
    for name in names:
        obj.data.materials.append(bpy.data.materials[name])


# ------------------------------------------------------------------- meshes
def assign(faces, index=0, smooth=True):
    for face in faces:
        face.material_index = index
        face.smooth = smooth


def write_mesh(obj, bm, weighted=True, world=True):
    """Writes `bm` (world metres unless `world` is False) into `obj`.

    Drops every modifier on the object, so geometry nodes, solidify and old
    bevels cannot reshape the new mesh, then adds weighted normals.
    """
    if world:
        bpy.context.view_layer.update()
        matrix = obj.matrix_world.inverted()
        bmesh.ops.transform(bm, matrix=matrix, verts=bm.verts)
        if matrix.determinant() < 0:
            bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.normal_update()
    bm.to_mesh(obj.data)
    bm.free()
    for modifier in list(obj.modifiers):
        obj.modifiers.remove(modifier)
    if weighted:
        party_style.add_weighted_normals(obj)
    obj.data.update()


def add_box(bm, low, high, radius, segments=3, sharp_sides=()):
    return party_style.add_box(bm, low, high, radius, segments, sharp_sides)


def add_frustum_box(bm, z0, z1, bottom, top, radius, segments=2):
    """A rounded box whose cross-section moves and scales from bottom to top.

    `bottom` and `top` are (centre x, centre y, size x, size y). Horizontal
    faces stay horizontal, so legs splay without poking through the floor.
    """
    size_x = (bottom[2] + top[2]) / 2
    size_y = (bottom[3] + top[3]) / 2
    faces = add_box(
        bm,
        (-size_x / 2, -size_y / 2, z0),
        (size_x / 2, size_y / 2, z1),
        radius,
        segments,
    )
    verts = {vert for face in faces for vert in face.verts}
    for vert in verts:
        t = (vert.co.z - z0) / (z1 - z0)
        centre_x = bottom[0] + (top[0] - bottom[0]) * t
        centre_y = bottom[1] + (top[1] - bottom[1]) * t
        width_x = bottom[2] + (top[2] - bottom[2]) * t
        width_y = bottom[3] + (top[3] - bottom[3]) * t
        vert.co.x = centre_x + vert.co.x / size_x * width_x
        vert.co.y = centre_y + vert.co.y / size_y * width_y
    return faces


def frame_for(axis):
    """Rotation taking +Z to `axis`."""
    axis = Vector(axis).normalized()
    return axis.to_track_quat("Z", "Y").to_matrix().to_4x4()


def add_cylinder(
    bm,
    centre,
    axis,
    radius,
    length,
    segments=20,
    bevel=0.0,
    bevel_segments=2,
    radius_top=None,
):
    """A capped cylinder (or cone) along `axis`, with rounded cap edges."""
    result = bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=segments,
        radius1=radius,
        radius2=radius if radius_top is None else radius_top,
        depth=length,
    )
    verts = result["verts"]
    faces = list({face for vert in verts for face in vert.link_faces})
    if bevel > 0:
        caps = [face for face in faces if len(face.verts) == segments]
        edges = list({edge for face in caps for edge in face.edges})
        before = set(bm.faces)
        bmesh.ops.bevel(
            bm,
            geom=edges,
            offset=bevel,
            offset_type="OFFSET",
            segments=bevel_segments,
            profile=0.5,
            affect="EDGES",
            clamp_overlap=True,
        )
        faces = [face for face in faces if face.is_valid] + list(
            set(bm.faces) - before
        )
    verts = list({vert for face in faces for vert in face.verts})
    matrix = Matrix.Translation(Vector(centre)) @ frame_for(axis)
    bmesh.ops.transform(bm, matrix=matrix, verts=verts)
    return faces


def add_blob(bm, centre, radii, subdivisions=2, bump=0.0, seed=0.0, floor=None):
    return party_style.add_blob(bm, centre, radii, subdivisions, bump, seed, floor)


def add_lobed_blob(bm, centre, radii, lobes, subdivisions=2, floor=None, sharpness=3):
    return party_style.add_lobed_blob(
        bm, centre, radii, lobes, subdivisions, floor, sharpness
    )


def transform_faces(bm, faces, matrix):
    verts = list({vert for face in faces for vert in face.verts})
    bmesh.ops.transform(bm, matrix=matrix, verts=verts)
    return faces


def circle_shape(theta):
    return math.cos(theta), math.sin(theta)


def squircle_shape(power):
    def shape(theta):
        c, s = math.cos(theta), math.sin(theta)
        return (
            math.copysign(abs(c) ** (2 / power), c),
            math.copysign(abs(s) ** (2 / power), s),
        )

    return shape


def add_lathe(
    bm,
    profile,
    segments=24,
    centre=(0.0, 0.0, 0.0),
    scale=(1.0, 1.0),
    shape=circle_shape,
    matrix=None,
):
    """Revolves `profile`, a list of (radius, height), around the Z axis.

    A radius of 0 at either end closes the surface with a pole. Faces point
    to the left of the profile direction: outward on a wall that rises,
    inward on one that falls, up on a floor that runs toward the axis.
    """
    rings = []
    for radius, height in profile:
        if radius < 1e-6:
            rings.append([bm.verts.new((centre[0], centre[1], centre[2] + height))])
            continue
        ring = []
        for index in range(segments):
            theta = index / segments * math.tau
            x, y = shape(theta)
            ring.append(
                bm.verts.new(
                    (
                        centre[0] + x * radius * scale[0],
                        centre[1] + y * radius * scale[1],
                        centre[2] + height,
                    )
                )
            )
        rings.append(ring)
    faces = []
    for lower, upper in zip(rings, rings[1:]):
        for index in range(segments):
            following = (index + 1) % segments
            if len(lower) == 1 and len(upper) == 1:
                continue
            if len(lower) == 1:
                faces.append(bm.faces.new((lower[0], upper[following], upper[index])))
                continue
            if len(upper) == 1:
                faces.append(bm.faces.new((lower[index], lower[following], upper[0])))
                continue
            faces.append(
                bm.faces.new(
                    (lower[index], lower[following], upper[following], upper[index])
                )
            )
    if matrix is not None:
        transform_faces(bm, faces, matrix)
    return faces


def fix_pole_winding(bm, faces):
    """Recomputes normals of a closed lathe so they face outward."""
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def add_torus(
    bm,
    centre,
    radii,
    minor,
    segments=24,
    minor_segments=8,
    matrix=None,
    shape=circle_shape,
    minor_scale=(1.0, 1.0),
):
    """A ring around Z with an elliptical (or squircle) path."""
    rings = []
    for index in range(segments):
        theta = index / segments * math.tau
        x, y = shape(theta)
        path = Vector((x * radii[0], y * radii[1], 0.0))
        # Outward direction of the path in the XY plane.
        nx, ny = shape(theta + 1e-3)
        px, py = shape(theta - 1e-3)
        tangent = Vector(((nx - px) * radii[0], (ny - py) * radii[1], 0.0)).normalized()
        outward = tangent.cross(Vector((0.0, 0.0, 1.0))).normalized()
        ring = []
        for minor_index in range(minor_segments):
            phi = minor_index / minor_segments * math.tau
            offset = outward * (math.cos(phi) * minor * minor_scale[0]) + Vector(
                (0.0, 0.0, math.sin(phi) * minor * minor_scale[1])
            )
            ring.append(bm.verts.new(Vector(centre) + path + offset))
        rings.append(ring)
    faces = []
    for index in range(segments):
        ring = rings[index]
        following = rings[(index + 1) % segments]
        for minor_index in range(minor_segments):
            next_minor = (minor_index + 1) % minor_segments
            faces.append(
                bm.faces.new(
                    (
                        ring[minor_index],
                        ring[next_minor],
                        following[next_minor],
                        following[minor_index],
                    )
                )
            )
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    if matrix is not None:
        transform_faces(bm, faces, matrix)
    return faces


def rounded_rect_profile(width, height, radius, corner_segments=2, radius_low_v=None):
    """Closed 2D outline (u, v) of a rounded rectangle centred on 0.

    `radius_low_v` rounds the two corners on the -v side differently.
    """
    points = []
    limit = min(width / 2, height / 2) - 1e-4
    radius = min(radius, limit)
    low = radius if radius_low_v is None else min(radius_low_v, limit)
    corners = [
        (width / 2 - radius, height / 2 - radius, 0.0, radius),
        (-width / 2 + radius, height / 2 - radius, math.pi / 2, radius),
        (-width / 2 + low, -height / 2 + low, math.pi, low),
        (width / 2 - low, -height / 2 + low, 3 * math.pi / 2, low),
    ]
    for cx, cy, start, radius in corners:
        for step in range(corner_segments + 1):
            angle = start + step / corner_segments * math.pi / 2
            points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    return points


def circle_profile(radius, segments=8):
    return [
        (math.cos(i / segments * math.tau) * radius, math.sin(i / segments * math.tau) * radius)
        for i in range(segments)
    ]


def add_sweep(bm, path, profile, closed=False, up=(0.0, 0.0, 1.0), caps=True):
    """Sweeps a closed 2D `profile` (u along the side vector, v along the
    path normal) along `path`. `up` fixes the frame for planar paths."""
    path = [Vector(point) for point in path]
    count = len(path)
    up = Vector(up)
    rings = []
    for index, point in enumerate(path):
        if closed:
            before = path[index - 1]
            after = path[(index + 1) % count]
        else:
            before = path[max(0, index - 1)]
            after = path[min(count - 1, index + 1)]
        tangent = (after - before).normalized()
        side = tangent.cross(up)
        if side.length < 1e-6:
            side = tangent.orthogonal()
        side.normalize()
        normal = side.cross(tangent).normalized()
        rings.append(
            [bm.verts.new(point + side * u + normal * v) for u, v in profile]
        )
    faces = []
    spans = count if closed else count - 1
    size = len(profile)
    for index in range(spans):
        ring = rings[index]
        following = rings[(index + 1) % count]
        for corner in range(size):
            next_corner = (corner + 1) % size
            faces.append(
                bm.faces.new(
                    (ring[corner], ring[next_corner], following[next_corner], following[corner])
                )
            )
    if not closed and caps:
        faces.append(bm.faces.new(list(reversed(rings[0]))))
        faces.append(bm.faces.new(rings[-1]))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def rounded_rect_path(half_u, half_v, radius, corner_segments=5):
    """Closed loop in the plane (u, v) around a rounded rectangle."""
    return rounded_rect_profile(half_u * 2, half_v * 2, radius, corner_segments)


def box_uvs(bm, faces, density=2.0):
    """Projects UVs from the dominant face axis (for future wood textures)."""
    layer = bm.loops.layers.uv.verify()
    for face in faces:
        normal_axis = max(range(3), key=lambda axis: abs(face.normal[axis]))
        u_axis, v_axis = [axis for axis in range(3) if axis != normal_axis]
        for loop in face.loops:
            loop[layer].uv = (loop.vert.co[u_axis] * density, loop.vert.co[v_axis] * density)


def evaluated_world_bounds(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    low = Vector((math.inf,) * 3)
    high = Vector((-math.inf,) * 3)
    for obj in objects:
        if obj.type not in {"MESH", "CURVE"}:
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        for vert in mesh.vertices:
            point = obj.matrix_world @ vert.co
            low = Vector(map(min, low, point))
            high = Vector(map(max, high, point))
        evaluated.to_mesh_clear()
    return low, high


def report(label, game_scale=1.0):
    total = 0
    for obj in sorted(bpy.data.objects, key=lambda o: o.name):
        if obj.type not in {"MESH", "CURVE"}:
            continue
        triangles = party_style.evaluated_triangles(obj)
        total += triangles
        print(f"  {obj.name}: {triangles} tris")
    low, high = evaluated_world_bounds(bpy.data.objects)
    size = (high - low) * game_scale
    print(
        f"  {label}: {total} tris, in-game size "
        f"{size.x:.3f} x {size.y:.3f} x {size.z:.3f}"
    )
    for material in bpy.data.materials:
        if material.users and material.use_nodes and party_style.principled(material):
            print("   ", party_style.describe_material(material))


# --------------------------------------------------------------------- stool
# Seat top and floor are pinned by timberAssetProportions.unit.ts and the
# autumn leaf anchors (block-local y 0.357412).
STOOL_FLOOR = -0.02173
STOOL_TOP = 0.357412
STOOL_HALF = 0.32


def restyle_stool():
    obj = bpy.data.objects["Stool"]
    set_slots(obj, ["Material.Planks"])
    bm = bmesh.new()
    faces = add_box(
        bm,
        (-STOOL_HALF, -STOOL_HALF, STOOL_TOP - 0.11),
        (STOOL_HALF, STOOL_HALF, STOOL_TOP),
        radius=0.045,
        segments=3,
    )
    # Four chunky legs, splayed a little, tucked into the seat.
    for sx in (-1, 1):
        for sy in (-1, 1):
            faces += add_frustum_box(
                bm,
                STOOL_FLOOR,
                STOOL_TOP - 0.09,
                (sx * 0.235, sy * 0.235, 0.12, 0.12),
                (sx * 0.2, sy * 0.2, 0.11, 0.11),
                radius=0.026,
                segments=2,
            )
    assign(faces)
    box_uvs(bm, faces)
    write_mesh(obj, bm)
    obj.data.name = "Stool"


# --------------------------------------------------------------------- bucket
BUCKET_SEGMENTS = 28


def bucket_profile():
    """Outer wall with a hoop and a rolled rim, then down the inside."""
    points = [(0.0, 0.0), (0.215, 0.0), (0.24, 0.006), (0.252, 0.028)]
    # Wall rising and widening, with one raised hoop.
    for height, radius in [
        (0.12, 0.257),
        (0.165, 0.263),
        (0.18, 0.276),
        (0.215, 0.28),
        (0.23, 0.269),
        (0.32, 0.274),
        (0.44, 0.281),
    ]:
        points.append((radius, height))
    # Rolled rim: a circle around (0.29, 0.468).
    for step in range(9):
        angle = math.radians(-120 + step * (330 / 8))
        points.append((0.29 + math.cos(angle) * 0.028, 0.468 + math.sin(angle) * 0.028))
    points += [(0.255, 0.43), (0.0, 0.43)]
    return points


def build_bucket_handle(parent):
    """The bail handle as a plain mesh: two wires from the rim ears down to a
    wooden grip resting against the side. Replaces the geometry-node curve."""
    old = bpy.data.objects.get("Bucket - Handle")
    if old is not None and old.type != "MESH":
        matrix_parent_inverse = old.matrix_parent_inverse.copy()
        bpy.data.objects.remove(old, do_unlink=True)
        mesh = bpy.data.meshes.new("Bucket - Handle")
        handle = bpy.data.objects.new("Bucket - Handle", mesh)
        bpy.context.scene.collection.objects.link(handle)
        handle.parent = parent
        handle.matrix_parent_inverse = matrix_parent_inverse
    else:
        handle = old
    handle.data.name = "Bucket - Handle"
    set_slots(handle, ["Material.Metal"])
    bm = bmesh.new()
    wire = circle_profile(0.017, 8)
    for side in (-1, 1):
        # Cubic Bezier from the grip end to the ear on the rim.
        p0 = Vector((-0.318, side * 0.16, 0.291))
        p1 = Vector((-0.318, side * 0.28, 0.292))
        p2 = Vector((-0.07, side * 0.35, 0.44))
        p3 = Vector((0.0, side * 0.288, 0.468))
        path = []
        for step in range(11):
            t = step / 10
            path.append(
                (1 - t) ** 3 * p0
                + 3 * (1 - t) ** 2 * t * p1
                + 3 * (1 - t) * t**2 * p2
                + t**3 * p3
            )
        faces = add_sweep(bm, path, wire, up=(0.0, 0.0, 1.0))
        assign(faces, 0)
    write_mesh(handle, bm, weighted=False)
    return handle


def restyle_bucket():
    paint("Material.Metal", "steel")
    paint("Material.Water", "water")
    obj = bpy.data.objects["Bucket"]
    # Primitive order is Water, Metal, Planks: the runtime reads them as
    # Bucket_1, Bucket_2 and Bucket_3.
    set_slots(obj, ["Material.Water", "Material.Metal", "Material.Planks"])
    bm = bmesh.new()
    metal = add_lathe(bm, bucket_profile(), BUCKET_SEGMENTS)
    assign(metal, 1)
    water = add_lathe(bm, [(0.0, 0.45), (0.262, 0.45)], BUCKET_SEGMENTS)
    # A floor running away from the axis faces down; flip it to face up.
    for face in water:
        face.normal_flip()
    assign(water, 0)
    grip = add_cylinder(
        bm,
        (-0.322, 0.0, 0.29),
        (0.0, 1.0, 0.0),
        0.046,
        0.34,
        segments=14,
        bevel=0.03,
        bevel_segments=2,
    )
    assign(grip, 2)
    box_uvs(bm, grip)
    write_mesh(obj, bm)
    obj.data.name = "Bucket"
    build_bucket_handle(obj)


# ------------------------------------------------------------------- giftbox
GIFT_HALF = 0.267
GIFT_HEIGHT = 0.25  # half height; the runtime lifts the box by 0.25
GIFT_RADIUS = 0.05
GIFT_RIBBON_WIDTH = 0.1
GIFT_RIBBON_THICKNESS = 0.016


def restyle_giftbox():
    """Rounded box, two ribbons that follow its rounded edges, chunky bow.

    The runtime draws these meshes without their object transforms, so they
    are written in mesh space: box and ribbon centred on 0, bow sitting on 0
    (placed on the lid and turned 45 degrees by GiftBox.tsx).
    """
    box = bpy.data.objects["GiftBox_Box"]
    bm = bmesh.new()
    faces = add_box(
        bm,
        (-GIFT_HALF, -GIFT_HALF, -GIFT_HEIGHT),
        (GIFT_HALF, GIFT_HALF, GIFT_HEIGHT),
        radius=GIFT_RADIUS,
        segments=3,
    )
    assign(faces)
    box_uvs(bm, faces)
    write_mesh(box, bm, world=False)

    strip = bpy.data.objects["GiftBox_Strip"]
    bm = bmesh.new()
    cross = rounded_rect_profile(GIFT_RIBBON_THICKNESS, GIFT_RIBBON_WIDTH, 0.007, 2)
    for axis, lift in ((0, 0.0), (1, 0.002)):
        offset = GIFT_RIBBON_THICKNESS / 2 + lift
        loop = rounded_rect_path(
            GIFT_HALF + offset, GIFT_HEIGHT + offset, GIFT_RADIUS + offset, 5
        )
        if axis == 0:
            path = [(u, 0.0, v) for u, v in loop]
            up = (0.0, 1.0, 0.0)
        else:
            path = [(0.0, u, v) for u, v in loop]
            up = (1.0, 0.0, 0.0)
        faces = add_sweep(bm, path, cross, closed=True, up=up)
        assign(faces)
    write_mesh(strip, bm, world=False)

    bow = bpy.data.objects["GiftBox_Bow"]
    bm = bmesh.new()
    for side in (-1, 1):
        # A puffy loop standing up and leaning outward along local Y.
        tilt = Matrix.Rotation(side * math.radians(-48), 4, "X")
        place = Matrix.Translation((0.0, side * 0.075, 0.05))
        stand = Matrix.Rotation(math.radians(90), 4, "Y")
        faces = add_torus(
            bm,
            (0.0, 0.0, 0.0),
            (0.058, 0.08),
            0.03,
            segments=18,
            minor_segments=8,
            matrix=place @ tilt @ stand,
            minor_scale=(1.0, 1.25),
        )
        assign(faces)
        # Short tail lying on the lid.
        tail = add_blob(
            bm, (0.0, 0.0, 0.0), (0.04, 0.075, 0.018), subdivisions=2
        )
        transform_faces(
            bm,
            tail,
            Matrix.Translation((side * 0.045, side * 0.07, 0.02))
            @ Matrix.Rotation(side * math.radians(28), 4, "Z"),
        )
        assign(tail)
    knot = add_blob(bm, (0.0, 0.0, 0.05), (0.05, 0.046, 0.044), subdivisions=3)
    assign(knot)
    write_mesh(bow, bm, world=False, weighted=False)


# ---------------------------------------------------------------- cat pillow
# Half the cushion's length and depth. With the piping (0.026 proud) the
# pillow is 1.442 x 1.082 here, 0.894 x 0.671 at the game scale of 0.62, so
# it stays inside the 0.9 x 0.9 a 1x1 prop may use. It was 0.944 long before.
PILLOW_HALF = (0.695, 0.515)
PILLOW_FLOOR = 0.012
PILLOW_SEAM = 0.135
PILLOW_TOP = 0.355


def pillow_profile():
    """Fraction of the footprint against height, bottom to top."""
    points = [(0.0, PILLOW_FLOOR), (0.6, PILLOW_FLOOR), (0.82, PILLOW_FLOOR + 0.004)]
    # Lower bulge up to the seam.
    for step in range(1, 6):
        angle = step / 5 * math.pi / 2
        points.append(
            (
                0.82 + math.sin(angle) * 0.18,
                PILLOW_FLOOR + 0.004 + (1 - math.cos(angle)) * (PILLOW_SEAM - PILLOW_FLOOR - 0.004),
            )
        )
    # Upper roll from the seam onto a soft dome.
    for step in range(1, 7):
        angle = step / 6 * math.pi / 2
        points.append(
            (
                0.78 + math.cos(angle) * 0.22,
                PILLOW_SEAM + math.sin(angle) * 0.15,
            )
        )
    for fraction in (0.6, 0.4, 0.2):
        dome = 1 - (fraction / 0.78) ** 2
        points.append((fraction, PILLOW_SEAM + 0.15 + dome * (PILLOW_TOP - PILLOW_SEAM - 0.15)))
    points.append((0.0, PILLOW_TOP))
    return points


def restyle_cat_pillow():
    paint("CatPillow_Fabric_Red", "pillow_red", double_sided=True)
    paint("CatPillow_Seam_DarkRed", "cream", double_sided=True)
    shape = squircle_shape(4)
    cushion = bpy.data.objects["CatPillow_Cushion"]
    bm = bmesh.new()
    faces = add_lathe(bm, pillow_profile(), 44, scale=PILLOW_HALF, shape=shape)
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    assign(faces)
    write_mesh(cushion, bm)

    seam = bpy.data.objects["CatPillow_Seam"]
    bm = bmesh.new()
    faces = add_torus(
        bm,
        (0.0, 0.0, PILLOW_SEAM),
        (PILLOW_HALF[0] + 0.002, PILLOW_HALF[1] + 0.002),
        0.024,
        segments=44,
        minor_segments=8,
        shape=shape,
    )
    assign(faces)
    write_mesh(seam, bm, weighted=False)


# ---------------------------------------------------------------- summer hat
HAT_RADII = (1.78, 1.426)
HAT_Y = HAT_RADII[1] / HAT_RADII[0]
CROWN_Y = 0.92


def brim_profile():
    points = [(0.0, 0.0), (1.1, 0.0), (1.45, 0.02), (1.66, 0.06)]
    # Rolled edge.
    for step in range(1, 7):
        angle = -math.pi / 2 + step / 6 * math.pi
        points.append((1.7 + math.cos(angle) * 0.075, 0.135 + math.sin(angle) * 0.075))
    points += [(1.62, 0.2), (1.35, 0.165), (1.0, 0.14), (0.0, 0.14)]
    return points


def restyle_summer_hat():
    paint("straw", "hay")
    paint("straw_light", "hay")
    paint("ribbon", "ribbon_pink")
    paint("ribbon_dark", "ribbon_pink")
    paint("flower_white", "petal_cream")
    paint("flower_center", "flower_gold")
    paint("leaf_green", "crop_leaf")

    def lathe_part(name, profile, scale_y, segments=32, flip=False):
        obj = bpy.data.objects[name]
        bm = bmesh.new()
        faces = add_lathe(bm, profile, segments, scale=(1.0, scale_y))
        if flip:
            bmesh.ops.recalc_face_normals(bm, faces=faces)
        assign(faces)
        write_mesh(obj, bm)

    lathe_part("SummerHat_wide_brim_flat_faceted", brim_profile(), HAT_Y, flip=True)
    # The crown flares into the brim with a concave cove (a quarter circle of
    # radius 0.16). It starts just under the brim surface and ends inside the
    # crown under the ribbon band, so it shows as a blend, not as a thin ring
    # of its own (0.036 tall at game scale).
    lathe_part(
        "SummerHat_inner_brim_highlight",
        [
            (1.06 + 0.16 * math.cos(angle), 0.295 + 0.16 * math.sin(angle))
            for angle in (math.radians(270 - step * 18) for step in range(6))
        ],
        CROWN_Y,
    )
    # Crown: one continuous profile split over the two crown parts.
    lathe_part(
        "SummerHat_low_poly_crown_base",
        [(0.0, 0.1), (0.86, 0.1), (0.9, 0.2), (0.905, 0.35), (0.895, 0.5)],
        CROWN_Y,
    )
    lathe_part(
        "SummerHat_low_poly_crown_top",
        [
            (0.895, 0.5),
            (0.87, 0.6),
            (0.81, 0.7),
            (0.7, 0.78),
            (0.53, 0.845),
            (0.3, 0.878),
            (0.0, 0.888),
        ],
        CROWN_Y,
    )
    lathe_part(
        "SummerHat_ribbon_band",
        [(0.89, 0.24), (0.93, 0.25), (0.948, 0.29), (0.95, 0.37), (0.932, 0.41), (0.89, 0.42)],
        CROWN_Y,
    )

    def band_point(angle, out=0.0):
        """Point on the ribbon band surface at `angle`, pushed `out`."""
        radius = 0.95 + out
        return Vector((math.cos(angle) * radius, math.sin(angle) * radius * CROWN_Y, 0.0))

    def band_frame(angle, out, height):
        point = band_point(angle, out)
        point.z = height
        normal = Vector((math.cos(angle) * CROWN_Y, math.sin(angle), 0.0)).normalized()
        tangent = Vector((-normal.y, normal.x, 0.0))
        basis = Matrix((tangent, normal, (0.0, 0.0, 1.0))).transposed().to_4x4()
        return Matrix.Translation(point) @ basis

    def blob_part(name, frame, radii, subdivisions=2, lobes=None):
        obj = bpy.data.objects[name]
        bm = bmesh.new()
        if lobes:
            faces = add_lobed_blob(bm, (0, 0, 0), radii, lobes, subdivisions, sharpness=2)
        else:
            faces = add_blob(bm, (0, 0, 0), radii, subdivisions)
        transform_faces(bm, faces, frame)
        assign(faces)
        write_mesh(obj, bm, weighted=False)

    # Bow on the front right of the band: a knot and two puffy loops.
    knot_angle = math.radians(-31)
    blob_part("SummerHat_bow_knot", band_frame(knot_angle, 0.05, 0.335), (0.09, 0.08, 0.1))
    for name, offset, lean in (
        ("SummerHat_bow_left_loop", -0.2, 1),
        ("SummerHat_bow_right_loop", 0.2, -1),
    ):
        frame = band_frame(knot_angle + offset, 0.035, 0.35) @ Matrix.Rotation(
            lean * math.radians(18), 4, "Y"
        )
        blob_part(name, frame, (0.17, 0.07, 0.115))

    # Daisy on the front left, facing out of the band. `daisy` scales the centre,
    # petals and their ring so every part stays at least 0.03 thick at the
    # 0.224 game scale; the flower sits a little further from the bow for it.
    daisy = 1.15
    flower_angle = math.radians(-69)
    centre_height = 0.35
    ring = 0.125 * daisy
    flower = band_frame(flower_angle, 0.05, centre_height)
    blob_part(
        "SummerHat_flower_center",
        flower @ Matrix.Translation((0.0, 0.035 * daisy, 0.0)),
        tuple(radius * daisy for radius in (0.07, 0.065, 0.07)),
    )
    for index in range(5):
        angle = math.radians(90 + index * 72)
        petal = (
            flower
            @ Matrix.Translation((math.cos(angle) * ring, 0.0, math.sin(angle) * ring))
            @ Matrix.Rotation(-angle, 4, "Y")
        )
        blob_part(
            f"SummerHat_flower_petal_{index + 1}",
            petal,
            tuple(radius * daisy for radius in (0.09, 0.065, 0.072)),
        )
    for name, side in (("SummerHat_flower_leaf_left", -1), ("SummerHat_flower_leaf_right", 1)):
        leaf = (
            flower
            @ Matrix.Translation((side * 0.17 * daisy, -0.02, -0.12 * daisy))
            @ Matrix.Rotation(side * math.radians(-35), 4, "Y")
        )
        blob_part(name, leaf, (0.13, 0.075, 0.075))


# -------------------------------------------------------------- beach chair
BEACH_BAR_THICKEN = 1.5
BEACH_BAR_MAX = 0.17
# The crossbars set the chair's depth: thicker ones would pass 0.9 in game.
BEACH_CROSSBAR_MAX = 0.135
BEACH_SCALE = 0.35  # BeachChair.tsx draws the model at this scale


def beach_profile_point(t):
    """Sling centreline (y, z) from the front bar (t=0) to the back roll."""
    points = [
        (-1.05, 0.22),
        (-0.72, 0.23),
        (-0.35, 0.33),
        (0.148, 0.632),
        (0.588, 1.068),
        (0.98, 1.508),
    ]
    scaled = t * (len(points) - 1)
    index = min(int(scaled), len(points) - 2)
    local = scaled - index
    p0 = Vector(points[max(index - 1, 0)])
    p1 = Vector(points[index])
    p2 = Vector(points[index + 1])
    p3 = Vector(points[min(index + 2, len(points) - 1)])
    # Catmull-Rom through the original sling points.
    return 0.5 * (
        2 * p1
        + (-p0 + p2) * local
        + (2 * p0 - 5 * p1 + 4 * p2 - p3) * local**2
        + (-p0 + 3 * p1 - 3 * p2 + p3) * local**3
    )


def source_size(obj):
    """Original size of a unit-cube bar, kept on the object so a second run
    does not thicken it again after its scale was moved into the mesh."""
    if "party_source_size" not in obj:
        obj["party_source_size"] = [abs(value) for value in obj.scale]
    return list(obj["party_source_size"])


def restyle_beach_chair():
    paint("BeachChair_DeepBlueFabric", "fabric_blue")
    paint("BeachChair_SunCreamFabric", "fabric_yellow")
    paint("BeachChair_FabricEdge", "fabric_blue")

    bars = {
        "BeachChair_FrameLeft": 1.0,
        "BeachChair_FrameRight": 1.0,
        "BeachChair_BackSupportLeft": 1.0,
        "BeachChair_BackSupportRight": 1.0,
        "BeachChair_GroundRailLeft": 1.0,
        "BeachChair_GroundRailRight": 1.0,
        # Crossbars reach across the thicker rails.
        "BeachChair_RearCrossbar": 1.03,
        "BeachChair_FrontCrossbar": 1.03,
    }
    for name, stretch in bars.items():
        obj = bpy.data.objects[name]
        # Bars were unit cubes sized by their scale; thicken the two short
        # sides and keep the length.
        scale = source_size(obj)
        length_axis = max(range(3), key=lambda axis: scale[axis])
        limit = BEACH_CROSSBAR_MAX if "Crossbar" in name else BEACH_BAR_MAX
        size = [
            scale[axis] * stretch
            if axis == length_axis
            else min(scale[axis] * BEACH_BAR_THICKEN, limit)
            for axis in range(3)
        ]
        obj.scale = (1.0, 1.0, 1.0)
        bm = bmesh.new()
        faces = add_box(
            bm,
            [-value / 2 for value in size],
            [value / 2 for value in size],
            radius=0.045,
            segments=2,
        )
        assign(faces)
        box_uvs(bm, faces)
        write_mesh(obj, bm, world=False)

    # The fabric roll at the top of the back.
    roll = bpy.data.objects["BeachChair_BackFabricEdge"]
    length = source_size(roll)[2]
    roll.scale = (1.0, 1.0, 1.0)
    bm = bmesh.new()
    faces = add_box(
        bm, (-0.065, -0.065, -length / 2 - 0.02), (0.065, 0.065, length / 2 + 0.02), 0.06, 3
    )
    assign(faces)
    write_mesh(roll, bm, world=False)

    # Five stripes of one sling: they touch, with a soft groove between.
    stripe_names = [
        "BeachChair_FabricStripeBlue01",
        "BeachChair_FabricStripeCream02",
        "BeachChair_FabricStripeBlue03",
        "BeachChair_FabricStripeCream04",
        "BeachChair_FabricStripeBlue05",
    ]
    width = 0.246
    thickness = 0.09
    for index, name in enumerate(stripe_names):
        obj = bpy.data.objects[name]
        # u runs across the sling surface, v across the stripe (+v is +X).
        # Edges that meet the next stripe stay nearly square, so the five
        # stripes read as one sheet; the sheet's outer edges are fully round.
        cross = rounded_rect_profile(
            thickness,
            width,
            0.012 if index < len(stripe_names) - 1 else 0.042,
            2,
            radius_low_v=0.012 if index > 0 else 0.042,
        )
        centre_x = (index - 2) * width
        path = []
        for step in range(13):
            y, z = beach_profile_point(step / 12)
            path.append((centre_x, y, z))
        bm = bmesh.new()
        faces = add_sweep(bm, path, cross, up=(1.0, 0.0, 0.0))
        assign(faces)
        write_mesh(obj, bm)


# ------------------------------------------------------------- wooden bench
def restyle_wooden_bench():
    def box_part(name, low, high, radius, segments=2):
        obj = bpy.data.objects[name]
        bm = bmesh.new()
        faces = add_box(bm, low, high, radius, segments)
        assign(faces)
        box_uvs(bm, faces)
        write_mesh(obj, bm)

    # Seat slats keep their tops at 0.775 (autumn leaf anchors) and grow
    # down to read as thick boards.
    for name, (y0, y1) in {
        "WoodenBench_SeatSlatFront": (-0.29, -0.12),
        "WoodenBench_SeatSlatCenter": (-0.085, 0.085),
        "WoodenBench_SeatSlatBack": (0.12, 0.29),
    }.items():
        box_part(name, (-1.05, y0, 0.615), (1.05, y1, 0.775), 0.03, 3)
    for name, (y0, y1) in {
        "WoodenBench_SupportRailFront": (-0.265, -0.145),
        "WoodenBench_SupportRailBack": (0.145, 0.265),
    }.items():
        box_part(name, (-0.9, y0, 0.5), (0.9, y1, 0.635), 0.03)
    for name, sign in (("WoodenBench_EndBraceLeft", -1), ("WoodenBench_EndBraceRight", 1)):
        xs = sorted((sign * 0.745, sign * 0.895))
        box_part(name, (xs[0], -0.25, 0.52), (xs[1], 0.25, 0.64), 0.03)
    # Splayed legs, thicker than before.
    for name, sx, sy in (
        ("WoodenBench_LegFrontLeft", -1, -1),
        ("WoodenBench_LegFrontRight", 1, -1),
        ("WoodenBench_LegBackLeft", -1, 1),
        ("WoodenBench_LegBackRight", 1, 1),
    ):
        obj = bpy.data.objects[name]
        bm = bmesh.new()
        faces = add_frustum_box(
            bm,
            0.025,
            0.63,
            (sx * 0.9, sy * 0.245, 0.15, 0.13),
            (sx * 0.82, sy * 0.19, 0.13, 0.11),
            radius=0.032,
        )
        assign(faces)
        box_uvs(bm, faces)
        write_mesh(obj, bm)
    # Dowel heads: domed pegs on the outer slats.
    for name, sx, sy in (
        ("WoodenBench_PinFrontLeft", -1, -1),
        ("WoodenBench_PinFrontRight", 1, -1),
        ("WoodenBench_PinBackLeft", -1, 1),
        ("WoodenBench_PinBackRight", 1, 1),
    ):
        obj = bpy.data.objects[name]
        bm = bmesh.new()
        faces = add_cylinder(
            bm,
            (sx * 0.82, sy * 0.205, 0.78),
            (0, 0, 1),
            0.042,
            0.04,
            segments=14,
            bevel=0.018,
            bevel_segments=2,
        )
        assign(faces)
        write_mesh(obj, bm)


# ------------------------------------------------------------- watering can
def restyle_watering_can():
    import numpy

    paint("Material.WateringCan.Body", "enamel_blue", double_sided=True)
    paint("Material.WateringCan.Trim", "holiday_gold", double_sided=True)
    paint("Material.WateringCan.Dark", "steel", double_sided=True)
    paint("Material.Water", "water")

    # The original pieces are low-poly but already the right shape: smooth
    # them instead of rebuilding, and keep the counts modest.
    for name, levels in (
        ("WateringCan_Body", 1),
        ("WateringCan_Spout", 1),
        ("WateringCan_Handle", 1),
        ("WateringCan_Base_Ring", 1),
        ("WateringCan_Fill_Rim", 1),
        ("WateringCan_Rose_Head", 1),
    ):
        obj = bpy.data.objects[name]
        for modifier in list(obj.modifiers):
            obj.modifiers.remove(modifier)
        party_style.add_party_subdivision(obj, levels)

    # The rose's holes become one domed face plate (the holes are painted
    # detail, too small to model at game scale).
    dots = bpy.data.objects["WateringCan_Rose_Face_Dots"]
    if "party_plate" not in dots:
        points = numpy.array([tuple(dots.matrix_world @ v.co) for v in dots.data.vertices])
        centre = points.mean(axis=0)
        _, _, axes = numpy.linalg.svd(points - centre)
        normal = Vector(axes[2])
        head = bpy.data.objects["WateringCan_Rose_Head"]
        head_centre = sum((head.matrix_world @ v.co for v in head.data.vertices), Vector()) / len(
            head.data.vertices
        )
        if normal.dot(Vector(centre) - head_centre) < 0:
            normal = -normal
        dots["party_plate"] = (*centre, *normal)
    values = dots["party_plate"]
    centre = Vector(values[:3])
    normal = Vector(values[3:])
    bm = bmesh.new()
    faces = add_cylinder(
        bm,
        centre - normal * 0.02,
        normal,
        0.27,
        0.06,
        segments=20,
        bevel=0.028,
        bevel_segments=2,
    )
    assign(faces)
    write_mesh(dots, bm)


# ------------------------------------------------------------- small shovel
# The shovel keeps its shared palette texture; each part points at the centre
# of one texel of GredicePixPal_BaseColor.png whose colour (decoded from sRGB)
# is closest to a role. The comment gives what a sunlit face shows.
SHOVEL_TEXELS = {
    "steel": (29, 107),  # #7bb8f3, near the steel role #8fc0ee
    "wood": (27, 82),  # #d4821f, near timber #dc8427
    "grip": (10, 53),  # #f15322, red accent
}
PALETTE_SIZE = 128


def restyle_shovel():
    material = bpy.data.materials["Material.ColorPaletteMain"]
    party_style.set_surface(material, 0.45)
    obj = bpy.data.objects["Shovel Small"]
    bm = bmesh.new()
    parts = []
    # Blade: a rounded spade 0.26 wide, narrowing toward the buried tip
    # (the runtime sinks the shovel 0.1 into the ground).
    blade = add_box(bm, (-0.128, -0.022, 0.0), (0.128, 0.022, 0.38), radius=0.02, segments=2)
    for vert in {vert for face in blade for vert in face.verts}:
        t = max(0.0, min(1.0, (0.22 - vert.co.z) / 0.22))
        vert.co.x *= 1 - 0.45 * t**1.5
    parts.append((blade, "steel"))
    socket = add_cylinder(bm, (0.0, 0.0, 0.42), (0, 0, 1), 0.05, 0.1, 12, 0.02, 2, radius_top=0.042)
    parts.append((socket, "steel"))
    shaft = add_cylinder(bm, (0.0, 0.0, 0.66), (0, 0, 1), 0.04, 0.44, 12, 0.012, 1)
    parts.append((shaft, "wood"))
    grip = add_cylinder(bm, (0.0, 0.0, 0.98), (1, 0, 0), 0.042, 0.27, 12, 0.03, 2)
    parts.append((grip, "grip"))
    neck = add_cylinder(bm, (0.0, 0.0, 0.915), (0, 0, 1), 0.036, 0.11, 12, 0.0, 1)
    parts.append((neck, "wood"))
    layer = bm.loops.layers.uv.verify()
    for faces, swatch in parts:
        x, y = SHOVEL_TEXELS[swatch]
        uv = ((x + 0.5) / PALETTE_SIZE, (y + 0.5) / PALETTE_SIZE)
        assign(faces)
        for face in faces:
            for loop in face.loops:
                loop[layer].uv = uv
    write_mesh(obj, bm)


# ------------------------------------------------------------- paint roller
ROLLER_SCALE = 0.352


def restyle_paint_roller():
    paint("Material.PaintRoller.Sleeve", "cream")
    paint("Material.PaintRoller.SleeveShadow", "cream")
    paint("Material.PaintRoller.Yellow", "holiday_gold")
    paint("Material.PaintRoller.Handle", "holiday_gold")
    paint("Material.PaintRoller.Orange", "enamel_orange")
    paint("Material.PaintRoller.Frame", "steel")
    axis_x = (1.0, 0.0, 0.0)
    axis_z = (0.0, 0.0, 1.0)
    parts = {
        # name: (centre, axis, radius, length, segments, bevel, top radius)
        "PaintRoller_Sleeve": ((-0.15, 0.02, 1.82), axis_x, 0.25, 1.52, 24, 0.07, None),
        # Was a darker copy painted over the sleeve; now a core hidden inside.
        "PaintRoller_Sleeve_Shadow": ((-0.15, 0.02, 1.82), axis_x, 0.18, 1.3, 10, 0.0, None),
        "PaintRoller_EndCap_Left": ((-0.94, 0.02, 1.82), axis_x, 0.2, 0.08, 20, 0.03, None),
        "PaintRoller_EndCap_Right": ((0.655, 0.02, 1.82), axis_x, 0.21, 0.08, 20, 0.03, None),
        "PaintRoller_EndHub": ((0.715, 0.02, 1.82), axis_x, 0.12, 0.1, 16, 0.03, None),
        "PaintRoller_Handle": ((0.3, 0.02, 0.4), axis_z, 0.15, 0.6, 20, 0.04, 0.14),
        "PaintRoller_Handle_Collar_Top": ((0.31, 0.02, 0.73), axis_z, 0.17, 0.11, 20, 0.035, None),
        "PaintRoller_Handle_Collar_Bottom": ((0.3, 0.02, 0.05), axis_z, 0.17, 0.1, 20, 0.035, None),
    }
    for name, (centre, axis, radius, length, segments, bevel, top) in parts.items():
        obj = bpy.data.objects[name]
        bm = bmesh.new()
        faces = add_cylinder(
            bm, centre, axis, radius, length, segments, bevel, 2, radius_top=top
        )
        assign(faces)
        write_mesh(obj, bm, weighted=bevel > 0)
    frame = bpy.data.objects["PaintRoller_Frame"]
    frame.data.bevel_depth = 0.055
    frame.data.bevel_resolution = 2
    frame.data.resolution_u = 6
    for spline in frame.data.splines:
        spline.resolution_u = 6
        spline.use_smooth = True
    frame.data.use_fill_caps = True


# ----------------------------------------------------------- harvest basket
BASKET_Y = 0.71  # depth / width of the oval basket
BASKET_FLOOR = 0.19  # inner floor the produce slots sit on


def weave_profile():
    points = [(0.0, 0.02), (0.2, 0.02), (0.232, 0.026), (0.25, 0.045)]
    bands = 4
    bottom, top = 0.045, 0.245
    for band in range(bands):
        z0 = bottom + (top - bottom) * band / bands
        z1 = bottom + (top - bottom) * (band + 1) / bands
        for fraction, bulge in ((0.33, 0.85), (0.67, 0.85), (1.0, 0.0)):
            z = z0 + (z1 - z0) * fraction
            radius = 0.25 + (z - bottom) / (top - bottom) * 0.05
            points.append((radius + bulge * 0.009, z))
    return points


def restyle_harvest_basket():
    paint("Material.BasketWeave", "hay_shade")
    paint("Material.BasketRim", "timber_dark")
    paint("Material.BasketInner", "hay_shade")
    paint("Material.BasketPin", "steel")
    paint("Material.VeggieRed", "ripe_red")
    paint("Material.VeggieGreenDark", "crop_leaf")
    paint("Material.VeggieOrange", "carrot")
    paint("Material.VeggieLeafy", "crop_leaf_light")
    paint("Material.VeggiePale", "turnip_cream")
    paint("Material.VeggieGreen", "zucchini")
    paint("Material.VeggieYellow", "pumpkin_light")

    def part(name, build, weighted=False):
        obj = bpy.data.objects[name]
        bm = bmesh.new()
        faces = build(bm)
        assign(faces)
        write_mesh(obj, bm, weighted=weighted)

    part(
        "HarvestBasket_Weave",
        lambda bm: add_lathe(bm, weave_profile(), 24, scale=(1.0, BASKET_Y)),
        weighted=True,
    )
    part(
        "HarvestBasket_Rim",
        lambda bm: add_torus(bm, (0.0, 0.0, 0.252), (0.3, 0.3 * BASKET_Y), 0.025, 24, 8),
    )
    part(
        "HarvestBasket_Inner",
        lambda bm: add_lathe(
            bm,
            [(0.29, 0.258), (0.282, 0.215), (0.265, BASKET_FLOOR + 0.004), (0.24, BASKET_FLOOR), (0.0, BASKET_FLOOR)],
            24,
            scale=(1.0, BASKET_Y),
        ),
        weighted=True,
    )

    def handle(bm):
        path = []
        for step in range(17):
            angle = math.pi * step / 16
            path.append((math.cos(angle) * 0.3, 0.0, 0.135 + math.sin(angle) * 0.42))
        return add_sweep(bm, path, rounded_rect_profile(0.042, 0.062, 0.016, 2), up=(0, 1, 0))

    part("HarvestBasket_Handle", handle, weighted=True)

    def pins(bm):
        faces = []
        for side in (-1, 1):
            faces += add_cylinder(
                bm, (side * 0.322, 0.0, 0.2), (side, 0, 0), 0.026, 0.03, 10, 0.012, 1
            )
        return faces

    part("HarvestBasket_Pin", pins, weighted=True)

    # Produce: origins at the resting bottom, about 1.25 times larger.
    part("HarvestBasket_Tomato", lambda bm: add_blob(bm, (0, 0, 0.053), (0.06, 0.06, 0.053), 2))
    part(
        "HarvestBasket_TomatoCalyx",
        lambda bm: add_lobed_blob(
            bm,
            (0, 0, 0.103),
            (0.018, 0.018, 0.016),
            [((math.cos(a), math.sin(a), 0.0), 0.9) for a in [i * math.tau / 5 for i in range(5)]],
            2,
            sharpness=4,
        ),
    )
    part(
        "HarvestBasket_Carrot",
        lambda bm: fix_pole_winding(
            bm,
            add_lathe(
                bm,
                [(0.0, 0.0), (0.012, 0.008), (0.026, 0.05), (0.04, 0.11), (0.046, 0.15), (0.03, 0.168), (0.0, 0.172)],
                12,
            ),
        ),
    )
    part(
        "HarvestBasket_CarrotGreens",
        lambda bm: add_lobed_blob(
            bm,
            (0, 0, 0.2),
            (0.024, 0.024, 0.034),
            [((0.6, 0.0, 0.8), 0.7), ((-0.4, 0.5, 0.8), 0.6), ((-0.3, -0.6, 0.8), 0.6)],
            2,
            sharpness=3,
        ),
    )
    part(
        "HarvestBasket_Cabbage",
        lambda bm: add_lobed_blob(
            bm,
            (0, 0, 0.085),
            (0.09, 0.09, 0.08),
            [((math.cos(a), math.sin(a), 0.35), 0.14) for a in [i * math.tau / 6 + 0.3 for i in range(6)]]
            + [((0.0, 0.0, 1.0), 0.08)],
            3,
            floor=0.0,
            sharpness=4,
        ),
    )
    part(
        "HarvestBasket_Turnip",
        lambda bm: fix_pole_winding(
            bm,
            add_lathe(
                bm,
                [(0.0, 0.0), (0.012, 0.004), (0.04, 0.025), (0.052, 0.05), (0.044, 0.075), (0.02, 0.09), (0.0, 0.093)],
                14,
            ),
        ),
    )
    part(
        "HarvestBasket_TurnipSprout",
        lambda bm: add_lobed_blob(
            bm,
            (0, 0, 0.115),
            (0.02, 0.02, 0.03),
            [((0.5, 0.0, 0.85), 0.7), ((-0.5, 0.3, 0.8), 0.6)],
            2,
            sharpness=3,
        ),
    )
    part(
        "HarvestBasket_Zucchini",
        lambda bm: add_blob(bm, (0, 0, 0.042), (0.095, 0.043, 0.042), 2),
    )
    part(
        "HarvestBasket_Pumpkin",
        lambda bm: add_lobed_blob(
            bm,
            (0, 0, 0.066),
            (0.08, 0.08, 0.064),
            [((math.cos(a), math.sin(a), 0.0), 0.16) for a in [i * math.tau / 8 for i in range(8)]],
            3,
            floor=0.0,
            sharpness=5,
        ),
    )
    part(
        "HarvestBasket_PumpkinStem",
        lambda bm: add_cylinder(bm, (0, 0, 0.14), (0.15, 0, 1), 0.018, 0.05, 10, 0.008, 1, radius_top=0.014),
    )


# ------------------------------------------------------- fieldwork clipboard
def restyle_clipboard():
    paint("Material.FieldworkClipboard.Board", "timber_light")
    paint("Material.FieldworkClipboard.Paper", "cream")
    paint("Material.FieldworkClipboard.Metal", "steel")
    paint("Material.FieldworkClipboard.Ink", "ink_blue")
    paint("Material.FieldworkClipboard.CheckGreen", "crop_leaf")
    paint("Material.FieldworkClipboard.PencilYellow", "holiday_gold")
    paint("Material.FieldworkClipboard.PencilWood", "pencil_wood")
    paint("Material.FieldworkClipboard.Graphite", "graphite")
    paint("Material.FieldworkClipboard.Eraser", "eraser_pink")

    def part(name, build, weighted=True):
        obj = bpy.data.objects[name]
        bm = bmesh.new()
        faces = build(bm)
        assign(faces)
        write_mesh(obj, bm, weighted=weighted)

    board_top = 0.06
    paper_top = 0.088
    part("FieldworkClipboard_Board", lambda bm: add_box(bm, (-0.376, -0.499, 0.0), (0.344, 0.521, board_top), 0.026, 2))
    part("FieldworkClipboard_Paper", lambda bm: add_box(bm, (-0.296, -0.404, board_top - 0.005), (0.264, 0.356, paper_top), 0.012, 2))
    part("FieldworkClipboard_Clip", lambda bm: add_box(bm, (-0.165, 0.35, board_top - 0.005), (0.135, 0.455, 0.125), 0.024, 2))
    rows = (0.238, 0.078, -0.082)
    for index, row in enumerate(rows, start=1):
        part(
            f"FieldworkClipboard_Checkbox_{index:02d}",
            lambda bm, row=row: add_box(bm, (-0.256, row - 0.035, paper_top - 0.004), (-0.186, row + 0.035, paper_top + 0.014), 0.012, 2),
        )
        part(
            f"FieldworkClipboard_Line_{index:02d}",
            lambda bm, row=row: add_box(bm, (-0.15, row - 0.018, paper_top - 0.004), (0.215, row + 0.018, paper_top + 0.01), 0.008, 2),
        )
        check_top = paper_top + 0.03
        short_start = Vector((-0.248, row + 0.006, check_top - 0.01))
        corner = Vector((-0.228, row - 0.014, check_top - 0.01))
        long_end = Vector((-0.178, row + 0.042, check_top - 0.01))
        for suffix, start, end in (("A", short_start, corner), ("B", corner, long_end)):
            part(
                f"FieldworkClipboard_Check_{index:02d}_{suffix}",
                lambda bm, start=start, end=end: add_cylinder(
                    bm, (start + end) / 2, end - start, 0.016, (end - start).length + 0.03, 10, 0.012, 2
                ),
            )
    # Pencil lying on the paper, along its original axis.
    eraser_end = Vector((-0.336, -0.381, 0.0))
    tip_end = Vector((0.329, -0.119, 0.0))
    axis = (tip_end - eraser_end).normalized()
    origin = Vector((-0.041, -0.264, paper_top + 0.036))
    radius = 0.036
    part("FieldworkClipboard_Pencil_Body", lambda bm: add_cylinder(bm, origin, axis, radius, 0.57, 12, 0.008, 1))
    part(
        "FieldworkClipboard_Pencil_Eraser",
        lambda bm: add_cylinder(bm, origin - axis * 0.31, axis, radius, 0.07, 12, 0.026, 2),
    )
    part(
        "FieldworkClipboard_Pencil_Wood",
        lambda bm: add_cylinder(bm, origin + axis * 0.322, axis, radius, 0.075, 12, 0.0, 1, radius_top=0.016),
    )
    part(
        "FieldworkClipboard_Pencil_Graphite",
        lambda bm: add_cylinder(bm, origin + axis * 0.375, axis, 0.017, 0.04, 10, 0.012, 2, radius_top=0.006),
    )


# ---------------------------------------------------------------- dispatch
RESTYLERS = {
    "BeachChair": restyle_beach_chair,
    "Bucket": restyle_bucket,
    "Stool": restyle_stool,
    "WoodenBench": restyle_wooden_bench,
    "WateringCan": restyle_watering_can,
    "ShovelSmall": restyle_shovel,
    "PaintRoller": restyle_paint_roller,
    "HarvestBasket": restyle_harvest_basket,
    "FieldworkClipboard": restyle_clipboard,
    "CatPillow": restyle_cat_pillow,
    "SummerHat": restyle_summer_hat,
    "GiftBox": restyle_giftbox,
}

GAME_SCALES = {
    "BeachChair": BEACH_SCALE,
    "WoodenBench": 0.52,
    "WateringCan": 0.35,
    "PaintRoller": ROLLER_SCALE,
    "CatPillow": 0.62,
    "SummerHat": 0.224,
}


def main():
    args = parse_args()
    names = args.asset or list(RESTYLERS)
    bpy.context.preferences.filepaths.save_version = 0
    for name in names:
        path = ASSETS_DIR / f"{name}.blend"
        bpy.ops.wm.open_mainfile(filepath=str(path))
        RESTYLERS[name]()
        zero_metalness_everywhere()
        bpy.ops.wm.save_mainfile(filepath=str(path))
        backup = path.with_suffix(".blend1")
        if backup.exists():
            backup.unlink()
        print(f"Restyled {name}")
        report(name, GAME_SCALES.get(name, 1.0))


if __name__ == "__main__":
    main()
