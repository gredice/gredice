"""Restyle the core garden models for the toy-diorama look in GAME_ART.md.

Rebuilds the meshes of the raised bed, fence, tree, bush and stones as chunky
rounded shapes, including the tree's and bush's autumn leaf stages and the
bare branches drawn with them from late autumn to spring, and moves the
terrain, soil, foliage and stone materials to the new palette. Timber keeps the shared wood profile. Object names, origins,
scales and material slot order stay as they were, so the runtime keeps finding
the same nodes.

Run from the repository root, then export the touched assets:

    /Applications/Blender.app/Contents/MacOS/Blender -b \
        --python assets/scripts/generate-party-core.py
    (cd assets && Blender -b --python export-game-assets.py -- --asset RaisedBed ...)

Pass `-- --asset RaisedBed` to limit the run to one source file.
"""

import argparse
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

ASSETS_DIR = Path(__file__).resolve().parents[1] / "game-assets"
TEXTURES_DIR = Path(__file__).resolve().parents[1] / "game-textures"

# Linear base colours. The scene lights a sunlit top face to roughly 3.3 times
# its albedo, so these are darker than the colour they show on screen. The
# comment gives the on-screen target from GAME_ART.md.
PALETTE = {
    "grass": ((0.085, 0.215, 0.022), 0.75),  # #7bd03a
    "grass_tuft": ((0.112, 0.238, 0.033), 0.75),  # #9be04a
    "ground": ((0.262, 0.138, 0.046), 0.8),  # #e0a765
    "bed_soil": ((0.13, 0.05, 0.017), 0.85),  # #a05a2a
    "trunk": ((0.152, 0.056, 0.026), 0.6),  # #b56a3c
    # Small bare twigs: the trunk colour without the bark texture.
    "branch": ((0.152, 0.056, 0.026), 0.6),  # #b56a3c
    "canopy":((0.036, 0.178, 0.026), 0.55),  # #43b93a
    "canopy_light": ((0.060, 0.203, 0.028), 0.55),  # #6fd040
    "stone": ((0.149, 0.166, 0.209), 0.6),  # #b3bdd3
}

MATERIAL_ROLES = {
    "BlockGrass.blend": {
        "Material.Grass": "grass",
        "Material.GrassPart": "grass_tuft",
    },
    "BlockGrassAngle.blend": {
        "Material.Grass.001": "grass",
        "Material.GrassPart.001": "grass_tuft",
    },
    "BlockTerrainCorner.blend": {
        "Material.Grass.001": "grass",
        "Material.GrassPart.001": "grass_tuft",
        "Material.Dirt.001": "ground",
    },
    "BlockTerrainReverseCorner.blend": {
        "Material.Grass.001": "grass",
        "Material.GrassPart.001": "grass_tuft",
        "Material.Dirt.001": "ground",
    },
    "BlockGround.blend": {"Material.Dirt": "ground"},
    "BlockGroundAngle.blend": {"Material.Dirt.001": "ground"},
    # Timber keeps the shared wood profile from apply-bridge-wood-palette.py.
    "RaisedBed.blend": {"Material.Dirt": "bed_soil"},
    "Tree.blend": {
        "Material.Planks": "trunk",
        "Material.Leaves": "canopy",
        "Material.GrassPart": "canopy_light",
    },
    "Bush.blend": {
        "Material.GrassPart": "canopy_light",
        "Material.BushBranches": "branch",
    },
    "BirdHouse.blend": {},
    "StoneSmall.blend": {"Material.Stone": "stone"},
    "StoneMedium.blend": {"Material.Stone.001": "stone"},
    "StoneLarge.blend": {"Material.Stone.002": "stone"},
    "Fence.blend": {},
}

# Painted textures from assets/game-textures, by material role, with the
# linear average colour they were corrected to.
TEXTURED_ROLES = {
    "trunk": ("bark.webp", (0.462, 0.145, 0.045)),  # #b56a3c
}
# Texture repeats per metre along and across the grain.
TEXTURE_DENSITY = 2.0


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", action="append", default=[])
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


# ---------------------------------------------------------------- materials
def principled(material):
    material.use_nodes = True
    return next(
        node
        for node in material.node_tree.nodes
        if node.type == "BSDF_PRINCIPLED"
    )


def apply_palette(file_name):
    for material_name, role in MATERIAL_ROLES.get(file_name, {}).items():
        material = bpy.data.materials.get(material_name)
        if material is None:
            raise RuntimeError(f"{file_name}: missing material {material_name}")
        color, roughness = PALETTE[role]
        shader = principled(material)
        base_color = shader.inputs["Base Color"]
        for link in list(base_color.links):
            material.node_tree.links.remove(link)
        base_color.default_value = (*color, 1.0)
        shader.inputs["Roughness"].default_value = roughness
        # With no environment to reflect, metalness only darkens the colour.
        shader.inputs["Metallic"].default_value = 0.0
        textured = TEXTURED_ROLES.get(role)
        if textured:
            apply_texture(material, shader, color, *textured)


def apply_texture(material, shader, color, texture_name, texture_average):
    """Multiplies the painted texture down to the role's albedo.

    The textures are painted in the colour players see. A multiply node with
    a constant colour exports as the glTF base colour factor.
    """
    tree = material.node_tree
    for node in [n for n in tree.nodes if n.type in {"TEX_IMAGE", "MIX"}]:
        tree.nodes.remove(node)
    image = bpy.data.images.load(
        str(TEXTURES_DIR / texture_name), check_existing=True
    )
    image.pack()
    texture = tree.nodes.new("ShaderNodeTexImage")
    texture.image = image
    texture.location = (shader.location.x - 520, shader.location.y)
    mix = tree.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.location = (shader.location.x - 220, shader.location.y)
    mix.inputs[0].default_value = 1.0
    factor = [channel / average for channel, average in zip(color, texture_average)]
    mix.inputs[7].default_value = (*factor, 1.0)
    tree.links.new(texture.outputs["Color"], mix.inputs[6])
    tree.links.new(mix.outputs[2], shader.inputs["Base Color"])


def material_index(obj, material_name):
    for index, slot in enumerate(obj.material_slots):
        if slot.material and slot.material.name == material_name:
            return index
    raise RuntimeError(f"{obj.name}: no slot for {material_name}")


def set_material_slots(obj, material_names):
    obj.data.materials.clear()
    for name in material_names:
        obj.data.materials.append(bpy.data.materials[name])


# ------------------------------------------------------------------- shapes
def add_box(bm, low, high, radius=0.0, segments=3, sharp_sides=()):
    """Adds a box, rounding every edge except those of `sharp_sides`.

    `sharp_sides` lists faces to leave flat-cut, as "+x", "-z" and so on.
    Faces that meet the ground or another segment stay sharp so they close
    up without a gap.
    """
    low = Vector(low)
    high = Vector(high)
    size = high - low
    result = bmesh.ops.create_cube(bm, size=1.0)
    verts = result["verts"]
    bmesh.ops.scale(bm, vec=size, verts=verts)
    bmesh.ops.translate(bm, vec=(low + high) / 2, verts=verts)
    faces = {face for vert in verts for face in vert.link_faces}
    if radius <= 0:
        return list(faces)

    axes = {"x": 0, "y": 1, "z": 2}
    sharp_faces = set()
    for side in sharp_sides:
        axis = axes[side[1]]
        sign = 1 if side[0] == "+" else -1
        sharp_faces.update(
            face for face in faces if face.normal[axis] * sign > 0.9
        )
    edges = {
        edge
        for face in faces
        for edge in face.edges
        if not any(linked in sharp_faces for linked in edge.link_faces)
    }
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
    created = set(bm.faces) - before
    return [face for face in faces if face.is_valid] + list(created)


def add_blob(bm, center, radii, subdivisions=3, bump=0.0, seed=0.0, floor=None):
    """Adds a smooth ellipsoid, optionally lumpy and flattened at `floor`."""
    result = bmesh.ops.create_icosphere(
        bm, subdivisions=subdivisions, radius=1.0
    )
    verts = result["verts"]
    for vert in verts:
        direction = vert.co.normalized()
        scale = 1.0
        if bump:
            scale += bump * (
                math.sin(direction.x * 3.1 + seed)
                * math.sin(direction.y * 2.7 + seed * 1.7)
                + 0.7 * math.sin(direction.z * 4.3 + seed * 0.6)
            )
        vert.co = Vector(
            (
                center[0] + direction.x * radii[0] * scale,
                center[1] + direction.y * radii[1] * scale,
                center[2] + direction.z * radii[2] * scale,
            )
        )
        if floor is not None and vert.co.z < floor:
            vert.co.z = floor
    return list({face for vert in verts for face in vert.link_faces})


def add_lobed_blob(
    bm, center, radii, lobes, subdivisions=4, floor=None, sharpness=3
):
    """Adds one smooth mass with soft swellings, like a cloud or a canopy.

    `lobes` lists (direction, amount): the surface swells by `amount` of its
    radius toward each direction and blends smoothly between them, so the
    result reads as one shape rather than a cluster of balls.
    """
    result = bmesh.ops.create_icosphere(
        bm, subdivisions=subdivisions, radius=1.0
    )
    verts = result["verts"]
    lobe_directions = [
        (Vector(direction).normalized(), amount) for direction, amount in lobes
    ]
    for vert in verts:
        direction = vert.co.normalized()
        scale = 1.0
        for lobe_direction, amount in lobe_directions:
            scale += amount * max(0.0, direction.dot(lobe_direction)) ** sharpness
        vert.co = Vector(
            (
                center[0] + direction.x * radii[0] * scale,
                center[1] + direction.y * radii[1] * scale,
                center[2] + direction.z * radii[2] * scale,
            )
        )
        if floor is not None and vert.co.z < floor:
            vert.co.z = floor
    return list({face for vert in verts for face in vert.link_faces})


# Soft swellings for canopies, as (direction, amount). Five lean outward and
# up around the crown, one rises from the top.
CANOPY_LOBES = [
    ((0.95, 0.2, 0.3), 0.2),
    ((0.1, 0.95, 0.25), 0.17),
    ((-0.85, 0.45, 0.3), 0.2),
    ((-0.55, -0.8, 0.25), 0.17),
    ((0.5, -0.85, 0.3), 0.19),
    ((-0.1, -0.15, 1.0), 0.16),
]

# A tree crown: eight swellings around and above, sharp enough to scallop
# the outline like a cartoon tree while staying one smooth surface.
TREE_CROWN_LOBES = [
    ((math.cos(angle), math.sin(angle), 0.45), 0.2)
    for angle in [index * math.tau / 7 + 0.3 for index in range(7)]
] + [((0.0, 0.0, 1.0), 0.18)]


def add_trunk(bm, base, height, radius_base, radius_top, segments=16):
    result = bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        segments=segments,
        radius1=radius_base,
        radius2=radius_top,
        depth=height,
    )
    verts = result["verts"]
    bmesh.ops.translate(
        bm, vec=(base[0], base[1], base[2] + height / 2), verts=verts
    )
    return list({face for vert in verts for face in vert.link_faces})


def bezier_points(start, control, end, count):
    """Points along a quadratic Bezier, for a gently curved limb."""
    start, control, end = Vector(start), Vector(control), Vector(end)
    return [
        start * (1 - t) ** 2 + control * 2 * (1 - t) * t + end * t**2
        for t in (index / (count - 1) for index in range(count))
    ]


def add_limb(
    bm,
    path,
    radii,
    sides=8,
    tip=True,
    tip_rings=2,
    base_cap=False,
    uv_density=None,
    uv_wraps=1,
):
    """A smooth tapered tube along `path` with a rounded tip.

    `radii` gives the radius at each path point. `tip_rings` (1 or 2)
    sets how many rings round off the tip. The start is left open
    (it is buried in a trunk) unless `base_cap` is set. With `uv_density`
    the tube gets bark UVs: u runs along the limb, v wraps around it.
    """
    path = [Vector(point) for point in path]
    tangents = []
    for index in range(len(path)):
        ahead = path[min(index + 1, len(path) - 1)]
        behind = path[max(index - 1, 0)]
        tangents.append((ahead - behind).normalized())
    # Parallel-transported frame, so the rings do not twist.
    seed = Vector((0.0, 0.0, 1.0))
    if abs(tangents[0].dot(seed)) > 0.9:
        seed = Vector((1.0, 0.0, 0.0))
    normal = tangents[0].cross(seed).normalized()
    frames = []
    for tangent in tangents:
        normal = (normal - tangent * normal.dot(tangent)).normalized()
        frames.append((normal, tangent.cross(normal).normalized()))

    rings = []
    along = []
    length = 0.0
    centres = list(path)
    ring_radii = list(radii)
    ring_frames = list(frames)
    if tip:
        # Two shrinking rings close the end into a soft dome.
        end, tangent, radius = path[-1], tangents[-1], radii[-1]
        steps = ((0.55, 0.8), (0.9, 0.4)) if tip_rings == 2 else ((0.7, 0.62),)
        for offset, scale in steps:
            centres.append(end + tangent * radius * offset)
            ring_radii.append(radius * scale)
            ring_frames.append(frames[-1])
    for index, (centre, radius, (u_axis, v_axis)) in enumerate(
        zip(centres, ring_radii, ring_frames)
    ):
        if index:
            length += (centre - centres[index - 1]).length
        along.append(length)
        rings.append(
            [
                bm.verts.new(
                    centre
                    + (
                        u_axis * math.cos(side / sides * math.tau)
                        + v_axis * math.sin(side / sides * math.tau)
                    )
                    * radius
                )
                for side in range(sides)
            ]
        )
    faces = []
    columns = []
    for index in range(len(rings) - 1):
        for side in range(sides):
            following = (side + 1) % sides
            face = bm.faces.new(
                (
                    rings[index][side],
                    rings[index][following],
                    rings[index + 1][following],
                    rings[index + 1][side],
                )
            )
            faces.append(face)
            columns.append(
                (
                    (index, side),
                    (index, side + 1),
                    (index + 1, side + 1),
                    (index + 1, side),
                )
            )
    if tip:
        apex_point = path[-1] + tangents[-1] * radii[-1]
        apex = bm.verts.new(apex_point)
        last = len(rings) - 1
        for side in range(sides):
            following = (side + 1) % sides
            face = bm.faces.new((rings[last][side], rings[last][following], apex))
            faces.append(face)
            columns.append(((last, side), (last, side + 1), (last + 1, side + 0.5)))
        along.append(length + (apex_point - centres[-1]).length)
    if base_cap:
        centre = bm.verts.new(path[0] - tangents[0] * radii[0] * 0.3)
        for side in range(sides):
            following = (side + 1) % sides
            face = bm.faces.new((rings[0][following], rings[0][side], centre))
            faces.append(face)
            columns.append(((0, side + 1), (0, side), (0, side + 0.5)))
    if uv_density:
        layer = bm.loops.layers.uv.verify()
        for face, corners in zip(faces, columns):
            for loop, (ring, column) in zip(face.loops, corners):
                loop[layer].uv = (
                    along[min(ring, len(along) - 1)] * uv_density,
                    column / sides * uv_wraps,
                )
    return faces


def assign(faces, index, smooth=True):
    for face in faces:
        face.material_index = index
        face.smooth = smooth


def box_uvs(bm, faces, grain_axis, density=TEXTURE_DENSITY, transform=None):
    """Projects UVs from the dominant face axis, with u along the grain."""
    layer = bm.loops.layers.uv.verify()
    transform = transform or Matrix.Identity(4)
    for face in faces:
        normal = (transform.to_3x3() @ face.normal).normalized()
        normal_axis = max(range(3), key=lambda axis: abs(normal[axis]))
        in_plane = [axis for axis in range(3) if axis != normal_axis]
        if grain_axis in in_plane:
            u_axis = grain_axis
            v_axis = next(axis for axis in in_plane if axis != grain_axis)
        else:
            u_axis, v_axis = in_plane
        for loop in face.loops:
            position = transform @ loop.vert.co
            loop[layer].uv = (
                position[u_axis] * density,
                position[v_axis] * density,
            )


def replace_mesh(obj, bm):
    """Writes the bmesh into the object and drops its generator modifiers."""
    bm.normal_update()
    bm.to_mesh(obj.data)
    bm.free()
    for modifier in list(obj.modifiers):
        obj.modifiers.remove(modifier)
    # Keeps large flat faces flat while their bevels shade smooth.
    weighted = obj.modifiers.new("Party Weighted Normal", "WEIGHTED_NORMAL")
    weighted.keep_sharp = False
    weighted.weight = 100
    obj.data.update()


# --------------------------------------------------------------- raised bed
BED_BOARD = 0.1
# Planks sit back from the post faces, so the posts read as proud corners.
BED_BOARD_INSET = 0.02
BED_WALL = 0.3
BED_SOIL = 0.25
BED_POST = 0.18
BED_POST_HEIGHT = 0.4
BED_PLANK_GAP = 0.012
# How far a plank end tucks into the post it meets.
BED_POST_OVERLAP = 0.02
BED_SOIL_HALF_WIDTH = 0.39


def build_raised_bed(obj, open_sides, slot_order):
    """One 1 x 1 bed segment. `open_sides` join onto the next segment."""
    set_material_slots(obj, slot_order)
    soil_index = material_index(obj, "Material.Dirt")
    plank_index = material_index(obj, "Material.Planks")
    # The mesh origin sits one unit above the segment base.
    floor = -1.0
    bm = bmesh.new()
    closed = [side for side in ("+x", "-x", "+y", "-y") if side not in open_sides]
    plank_height = (BED_WALL - BED_PLANK_GAP) / 2
    outer = 0.5 - BED_BOARD_INSET
    inner = outer - BED_BOARD
    post_end = 0.5 - BED_POST + BED_POST_OVERLAP

    for side in closed:
        axis = 0 if side[1] == "x" else 1
        along = 1 - axis
        sign = 1 if side[0] == "+" else -1
        along_name = "xy"[along]
        # A plank stops at a corner post, or is cut flat where the bed
        # continues into the next segment.
        low_open = f"-{along_name}" in open_sides
        high_open = f"+{along_name}" in open_sides
        sharp = ["-z"]
        if low_open:
            sharp.append(f"-{along_name}")
        if high_open:
            sharp.append(f"+{along_name}")
        for level in range(2):
            bottom = floor + level * (plank_height + BED_PLANK_GAP)
            low = [0.0, 0.0, bottom]
            high = [0.0, 0.0, bottom + plank_height]
            low[axis] = min(sign * outer, sign * inner)
            high[axis] = max(sign * outer, sign * inner)
            low[along] = -0.5 if low_open else -post_end
            high[along] = 0.5 if high_open else post_end
            faces = add_box(
                bm,
                low,
                high,
                radius=0.03,
                sharp_sides=sharp if level == 0 else sharp[1:],
            )
            assign(faces, plank_index)
            box_uvs(bm, faces, grain_axis=along)

    # A post wherever two closed sides meet.
    for x_side in ("+x", "-x"):
        for y_side in ("+y", "-y"):
            if x_side in open_sides or y_side in open_sides:
                continue
            x_sign = 1 if x_side[0] == "+" else -1
            y_sign = 1 if y_side[0] == "+" else -1
            xs = sorted((x_sign * 0.5, x_sign * (0.5 - BED_POST)))
            ys = sorted((y_sign * 0.5, y_sign * (0.5 - BED_POST)))
            faces = add_box(
                bm,
                (xs[0], ys[0], floor),
                (xs[1], ys[1], floor + BED_POST_HEIGHT),
                radius=0.05,
                sharp_sides=("-z",),
            )
            assign(faces, plank_index)
            box_uvs(bm, faces, grain_axis=2)

    soil_low = [-BED_SOIL_HALF_WIDTH, -BED_SOIL_HALF_WIDTH, floor]
    soil_high = [BED_SOIL_HALF_WIDTH, BED_SOIL_HALF_WIDTH, floor + BED_SOIL]
    for side in open_sides:
        axis = 0 if side[1] == "x" else 1
        if side[0] == "+":
            soil_high[axis] = 0.5
        else:
            soil_low[axis] = -0.5
    faces = add_box(bm, soil_low, soil_high)
    assign(faces, soil_index, smooth=False)
    box_uvs(bm, faces, grain_axis=0)
    replace_mesh(obj, bm)


def restyle_raised_bed():
    dirt_first = ["Material.Dirt", "Material.Planks"]
    planks_first = ["Material.Planks", "Material.Dirt"]
    build_raised_bed(bpy.data.objects["Raised Bed O"], (), planks_first)
    build_raised_bed(bpy.data.objects["Raised Bed U"], ("+x",), dirt_first)
    build_raised_bed(bpy.data.objects["Raised Bed I"], ("+y", "-y"), dirt_first)
    build_raised_bed(bpy.data.objects["Raised Bed L"], ("+x", "+y"), dirt_first)


# --------------------------------------------------------------------- tree
def restyle_tree():
    obj = bpy.data.objects["Tree 1"]
    set_material_slots(
        obj, ["Material.Planks", "Material.Leaves", "Material.GrassPart"]
    )
    # The object is scaled (0.125, 0.125, 0.5) and its origin is half a unit
    # above the ground, so shapes are authored in metres and converted.
    to_local = Matrix.Diagonal((1 / 0.125, 1 / 0.125, 1 / 0.5, 1.0)) @ Matrix.Translation(
        (0.0, 0.0, -0.5)
    )
    to_world = to_local.inverted()
    bm = bmesh.new()

    # A tapered trunk with a flared root and a rounded top, in rings so its
    # shading and bark run smoothly up the whole height. Bark UVs: u follows
    # height, v wraps around twice without a seam. The foot stays open below
    # the ground: a cap there would tip the weighted normals of the root
    # ring downward and shade it as a dark band.
    trunk = add_limb(
        bm,
        [(0.0, 0.0, -0.02 + 0.9 * index / 6) for index in range(7)],
        [0.175, 0.145, 0.13, 0.118, 0.107, 0.097, 0.09],
        sides=16,
        base_cap=False,
        uv_density=TEXTURE_DENSITY,
        uv_wraps=2,
    )
    assign(trunk, 0)

    # One softly lobed canopy with a flat underside where it meets the trunk.
    canopy = add_lobed_blob(
        bm,
        (0.0, 0.0, 1.3),
        (0.5, 0.5, 0.45),
        TREE_CROWN_LOBES,
        floor=0.92,
        sharpness=10,
    )
    assign(canopy, 1)
    # The runtime still draws a second foliage part from this slot. A small
    # core hidden inside the canopy keeps that part without showing it.
    core = add_blob(bm, (0.0, 0.0, 1.3), (0.1, 0.1, 0.1), subdivisions=1)
    assign(core, 2)

    bmesh.ops.transform(bm, matrix=to_local, verts=bm.verts)
    del to_world
    replace_mesh(obj, bm)

    # Autumn stages: the same dome, smaller as the leaves drop.
    # (x, y, z, radius x/y, radius z, subdivisions, flat underside)
    autumn_stages = {
        "Tree_AutumnThinning": [(0.0, 0.0, 1.32, 0.46, 0.4, 3, 1.0)],
        # One small soft clump nestled among the limbs on one side, so most
        # limbs show bare past it: a remnant crown, not a stack of balls and
        # not a cap on a stalk. Subdivision 3, like the thinning dome.
        "Tree_AutumnSparse": [(-0.12, 0.1, 1.33, 0.2, 0.16, 3, None)],
    }
    for object_name, blobs in autumn_stages.items():
        stage = bpy.data.objects[object_name]
        set_material_slots(stage, ["Material.Leaves"])
        bm = bmesh.new()
        for x, y, z, radius, radius_z, subdivisions, floor in blobs:
            faces = add_lobed_blob(
                bm,
                (x, y, z),
                (radius, radius, radius_z),
                CANOPY_LOBES,
                subdivisions=subdivisions,
                floor=floor,
            )
            assign(faces, 0)
        bmesh.ops.transform(bm, matrix=to_local, verts=bm.verts)
        replace_mesh(stage, bm)
        stage.modifiers.clear()

    # Bare branches, drawn with the thinning and sparse stages from late
    # autumn to spring: chunky limbs that grow out of the trunk top and end
    # in rounded tips, two of them inside the sparse leaf clumps.
    branches = bpy.data.objects["Tree_AutumnBranches"]
    set_material_slots(branches, ["Material.Planks"])
    bm = bmesh.new()
    for (start, control, end), (base_radius, tip_radius) in TREE_LIMBS:
        points = bezier_points(start, control, end, 4)
        radii = [
            base_radius + (tip_radius - base_radius) * index / 3
            for index in range(4)
        ]
        assign(
            add_limb(bm, points, radii, uv_density=TEXTURE_DENSITY),
            0,
        )
    bmesh.ops.transform(bm, matrix=to_local, verts=bm.verts)
    replace_mesh(branches, bm)


# Bare tree limbs in metres above the ground: (start, bend, end) and the
# radius at the start and the tip. Starts are buried in the trunk top.
TREE_LIMBS = [
    (((0.0, 0.0, 0.74), (0.02, 0.0, 1.1), (0.07, 0.0, 1.42)), (0.075, 0.045)),
    (((0.0, 0.0, 0.76), (-0.12, 0.06, 1.0), (-0.27, 0.18, 1.2)), (0.065, 0.04)),
    (((0.0, 0.0, 0.78), (0.16, -0.08, 0.98), (0.33, -0.17, 1.24)), (0.062, 0.038)),
    (((0.0, 0.0, 0.8), (-0.06, -0.16, 1.02), (-0.13, -0.32, 1.3)), (0.06, 0.036)),
    (((0.0, 0.0, 0.82), (0.12, 0.14, 1.08), (0.24, 0.27, 1.36)), (0.056, 0.035)),
    # Two forks that split off the bare limbs.
    (((0.17, -0.09, 1.04), (0.2, -0.07, 1.25), (0.21, -0.03, 1.44)), (0.04, 0.032)),
    (((-0.07, -0.18, 1.08), (-0.15, -0.17, 1.28), (-0.21, -0.12, 1.45)), (0.04, 0.032)),
]

# Bare bush twigs in metres above the ground, as for TREE_LIMBS.
BUSH_TWIGS = [
    (((0.0, 0.0, -0.01), (0.02, 0.0, 0.18), (0.05, 0.02, 0.36)), (0.036, 0.024)),
    (((0.01, 0.0, -0.01), (0.1, -0.06, 0.14), (0.2, -0.12, 0.28)), (0.034, 0.022)),
    (((-0.01, 0.0, -0.01), (-0.1, 0.05, 0.13), (-0.19, 0.12, 0.29)), (0.034, 0.022)),
    (((0.0, 0.01, -0.01), (-0.04, -0.1, 0.14), (-0.08, -0.2, 0.3)), (0.034, 0.022)),
]


# --------------------------------------------------------------------- bush
# The bush keeps its swatch in the shared palette texture. This multiplier
# moves that olive swatch (#608020) to the canopy green.
BUSH_PALETTE_UV = (0.2795, 0.7068)
BUSH_PALETTE_TINT = (0.31, 0.82, 1.0)


def tint_textured_material(material, tint):
    """Multiplies a textured base colour; exports as the base colour factor."""
    tree = material.node_tree
    shader = principled(material)
    for node in [n for n in tree.nodes if n.type == "MIX"]:
        source = node.inputs[6].links[0].from_socket
        tree.nodes.remove(node)
        tree.links.new(source, shader.inputs["Base Color"])
    source = shader.inputs["Base Color"].links[0].from_socket
    mix = tree.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.location = (shader.location.x - 220, shader.location.y)
    mix.inputs[0].default_value = 1.0
    mix.inputs[7].default_value = (*tint, 1.0)
    tree.links.new(source, mix.inputs[6])
    tree.links.new(mix.outputs[2], shader.inputs["Base Color"])


def build_bush_mesh(obj, blobs, slots, lobes=None):
    """Rounded mounds resting on the ground.

    One mesh unit is half a metre: the runtime draws this geometry at half
    scale and ignores the object's own transform. With `lobes`, each mound
    is one softly lobed form (radius x, y and z) instead of a lumpy ball.
    """
    set_material_slots(obj, slots)
    bm = bmesh.new()
    for x, y, z, radius, radius_z, subdivisions, slot in blobs:
        radii = radius if isinstance(radius, tuple) else (radius, radius)
        if lobes:
            faces = add_lobed_blob(
                bm,
                (x, y, z),
                (*radii, radius_z),
                lobes,
                subdivisions=subdivisions,
                floor=0.0,
            )
        else:
            faces = add_blob(
                bm,
                (x, y, z),
                (*radii, radius_z),
                subdivisions=subdivisions,
                bump=0.06,
                seed=1.7,
                floor=0.0,
            )
        assign(faces, slot)
    layer = bm.loops.layers.uv.verify()
    for face in bm.faces:
        for loop in face.loops:
            loop[layer].uv = BUSH_PALETTE_UV
    bmesh.ops.scale(bm, vec=(2.0, 2.0, 2.0), verts=bm.verts)
    replace_mesh(obj, bm)
    obj.modifiers.clear()


def restyle_bush():
    foliage = bpy.data.materials["Material.ColorPaletteMain"]
    tint_textured_material(foliage, BUSH_PALETTE_TINT)
    # Leaves sit in the satin band, like the tree canopy.
    principled(foliage).inputs["Roughness"].default_value = 0.55
    # One softly lobed mound. The runtime still draws a second foliage part
    # from the GrassPart slot, so a small core hides inside the mound.
    bush = bpy.data.objects["Bush 1"]
    set_material_slots(bush, ["Material.ColorPaletteMain", "Material.GrassPart"])
    bm = bmesh.new()
    # Bushes are numerous, so the mound keeps a lighter mesh than the tree.
    mound = add_lobed_blob(
        bm,
        (0.0, 0.0, 0.2),
        (0.38, 0.38, 0.3),
        CANOPY_LOBES,
        subdivisions=3,
        floor=0.0,
    )
    assign(mound, 0)
    core = add_blob(bm, (0.0, 0.0, 0.18), (0.08, 0.08, 0.08), subdivisions=1)
    assign(core, 1)
    layer = bm.loops.layers.uv.verify()
    for face in bm.faces:
        for loop in face.loops:
            loop[layer].uv = BUSH_PALETTE_UV
    bmesh.ops.scale(bm, vec=(2.0, 2.0, 2.0), verts=bm.verts)
    replace_mesh(bush, bm)
    bush.modifiers.clear()
    # Autumn stages: the same mound, smaller as the leaves drop.
    build_bush_mesh(
        bpy.data.objects["Bush_AutumnThinning"],
        [(0.0, 0.0, 0.17, 0.3, 0.24, 2, 0), (0.14, -0.1, 0.1, 0.16, 0.13, 2, 0)],
        ["Material.ColorPaletteMain"],
    )
    # The last leaves are one low, wide, irregular mound that the bare twigs
    # rise out of. A round ball here read as an apple or tomato.
    build_bush_mesh(
        bpy.data.objects["Bush_AutumnSparse"],
        [(0.03, -0.02, 0.02, (0.3, 0.2), 0.085, 2, 0)],
        ["Material.ColorPaletteMain"],
        lobes=CANOPY_LOBES,
    )
    # Bare twigs for late autumn to spring. Bushes are numerous, so each
    # twig is a six-sided tube: together they stay under the triangle
    # budget in scene/autumnCanopy.unit.ts.
    twigs = bpy.data.objects["Bush_AutumnBranches"]
    set_material_slots(twigs, ["Material.BushBranches"])
    bm = bmesh.new()
    for (start, control, end), (base_radius, tip_radius) in BUSH_TWIGS:
        points = bezier_points(start, control, end, 3)
        radii = [base_radius, (base_radius + tip_radius) / 2, tip_radius]
        assign(add_limb(bm, points, radii, sides=6, tip_rings=1), 0)
    bmesh.ops.scale(bm, vec=(2.0, 2.0, 2.0), verts=bm.verts)
    replace_mesh(twigs, bm)
    twigs.modifiers.clear()


# ------------------------------------------------------------------- stones
def restyle_stone(object_name, seed):
    obj = bpy.data.objects[object_name]
    scale = obj.scale
    # Keep the footprint and height the model already had.
    half_x, half_y, height = (
        obj.dimensions.x / 2,
        obj.dimensions.y / 2,
        obj.dimensions.z,
    )
    bm = bmesh.new()
    faces = add_blob(
        bm,
        (0.0, 0.0, height * 0.42),
        (half_x, half_y, height * 0.6),
        bump=0.09,
        seed=seed,
        floor=0.0,
    )
    assign(faces, 0)
    bmesh.ops.transform(
        bm,
        matrix=Matrix.Diagonal((1 / scale.x, 1 / scale.y, 1 / scale.z, 1.0)),
        verts=bm.verts,
    )
    replace_mesh(obj, bm)
    # A pebble has no flat faces to protect.
    obj.modifiers.clear()


# -------------------------------------------------------------------- fence
FENCE_POST = 0.18
FENCE_HEIGHT = 0.55
FENCE_RAIL_THICKNESS = 0.075
FENCE_RAIL_HEIGHT = 0.1
FENCE_RAIL_LEVELS = (0.2, 0.42)


def sharpen_cut(faces, axis, plane, sign):
    """Marks the edges of a flat cut sharp; the weighted normals keep them.

    A cut face is large next to the bevel strips around it, so weighted
    normals would otherwise turn the strips' end vertices along the cut and
    shade a wedge down the faces beside it.
    """
    for face in faces:
        face.normal_update()
        if face.normal[axis] * sign > 0.99 and all(
            abs(vert.co[axis] - plane) < 1e-6 for vert in face.verts
        ):
            for edge in face.edges:
                edge.smooth = False


def keep_sharp_cuts(obj):
    for modifier in obj.modifiers:
        if modifier.type == "WEIGHTED_NORMAL":
            modifier.keep_sharp = True


def build_fence(obj, rails):
    """A post at the tile centre with rails toward each connected side."""
    set_material_slots(obj, ["Material.Planks"])
    floor = -1.0
    bm = bmesh.new()
    half = FENCE_POST / 2
    faces = add_box(
        bm,
        (-half, -half, floor),
        (half, half, floor + FENCE_HEIGHT),
        radius=0.06,
        sharp_sides=("-z",),
    )
    sharpen_cut(faces, 2, floor, -1)
    assign(faces, 0)
    box_uvs(bm, faces, grain_axis=2)
    for direction in rails:
        axis = 0 if direction[1] == "x" else 1
        sign = 1 if direction[0] == "+" else -1
        for level in FENCE_RAIL_LEVELS:
            low = [
                -FENCE_RAIL_THICKNESS / 2,
                -FENCE_RAIL_THICKNESS / 2,
                floor + level - FENCE_RAIL_HEIGHT / 2,
            ]
            high = [
                FENCE_RAIL_THICKNESS / 2,
                FENCE_RAIL_THICKNESS / 2,
                floor + level + FENCE_RAIL_HEIGHT / 2,
            ]
            low[axis] = min(0.0, sign * 0.5)
            high[axis] = max(0.0, sign * 0.5)
            # The rail is cut flat at the tile edge to meet the next piece.
            faces = add_box(bm, low, high, radius=0.03, sharp_sides=(direction,))
            sharpen_cut(faces, axis, sign * 0.5, sign)
            assign(faces, 0)
            box_uvs(bm, faces, grain_axis=axis)
    replace_mesh(obj, bm)
    keep_sharp_cuts(obj)


def build_fence_extension(obj):
    """Rails that carry a fence on to the centre of a tile of another fence
    family, in the same profile as the rails above."""
    set_material_slots(obj, ["Material.Planks"])
    floor = -1.0
    bm = bmesh.new()
    for level in FENCE_RAIL_LEVELS:
        low = (
            -FENCE_RAIL_THICKNESS / 2,
            0.5,
            floor + level - FENCE_RAIL_HEIGHT / 2,
        )
        high = (
            FENCE_RAIL_THICKNESS / 2,
            1.0,
            floor + level + FENCE_RAIL_HEIGHT / 2,
        )
        # Flat where it meets the rail of the fence tile, rounded at the far end.
        faces = add_box(bm, low, high, radius=0.03, sharp_sides=("-y",))
        sharpen_cut(faces, 1, 0.5, -1)
        assign(faces, 0)
        box_uvs(bm, faces, grain_axis=1)
    replace_mesh(obj, bm)
    keep_sharp_cuts(obj)


def restyle_fence():
    build_fence(bpy.data.objects["Fence Solo"], ())
    build_fence(bpy.data.objects["Fence Single"], ("+y",))
    build_fence(bpy.data.objects["Fence Middle"], ("+y", "-y"))
    build_fence(bpy.data.objects["Fence Corner"], ("+x", "+y"))
    build_fence(bpy.data.objects["Fence T"], ("+x", "-x", "+y"))
    build_fence(bpy.data.objects["Fence Cross"], ("+x", "-x", "+y", "-y"))
    build_fence_extension(bpy.data.objects["Fence Extension"])


# ---------------------------------------------------------------- bird house
# Bevel width per part, in metres. Thin parts get a smaller bevel.
BIRDHOUSE_BEVELS = {
    "Birdhouse_Angled_Supports": 0.012,
    "Birdhouse_Cabin_Walls": 0.022,
    "Birdhouse_Center_Post": 0.02,
    "Birdhouse_Ridge_Cap": 0.012,
    "Birdhouse_Roof_Panels": 0.016,
    "Birdhouse_Upper_Platform": 0.02,
}
# Width of the centre post, in metres. The original is 0.075.
BIRDHOUSE_POST_WIDTH = 0.11


# birdHouseRoofColor and birdHouseRoofRoughness in entities/birdHousePalette.ts.
BIRDHOUSE_ROOF_RED = "#a3402a"
BIRDHOUSE_ROOF_ROUGHNESS = 0.45


def hex_to_linear(value):
    value = value.lstrip("#")
    channels = [int(value[index : index + 2], 16) / 255 for index in (0, 2, 4)]
    return tuple(
        channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4
        for channel in channels
    )


def restyle_birdhouse():
    """Rounded edges and a sturdier post. Colours are set in BirdHouse.tsx."""
    post = bpy.data.objects["Birdhouse_Center_Post"]
    bm = bmesh.new()
    bm.from_mesh(post.data)
    xs = [vert.co.x for vert in bm.verts]
    ys = [vert.co.y for vert in bm.verts]
    centre = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, 0.0))
    # Scaling to a target width keeps the script safe to run again.
    thicken = BIRDHOUSE_POST_WIDTH / (max(xs) - min(xs))
    for vert in bm.verts:
        vert.co.x = centre.x + (vert.co.x - centre.x) * thicken
        vert.co.y = centre.y + (vert.co.y - centre.y) * thicken
    bm.to_mesh(post.data)
    bm.free()

    # BirdHouse.tsx paints the walls wood, the roof red and the ridge cream.
    # The file carries the same colours, so the asset is right on its own
    # in viewers and the block renderer: the walls use the light wood, and
    # the roof material (old name, a near-black placeholder) takes the roof
    # red of entities/birdHousePalette.ts.
    walls = bpy.data.objects["Birdhouse_Cabin_Walls"]
    light_wood = bpy.data.materials["BH_flat_light_wood"]
    for slot in walls.material_slots:
        slot.material = light_wood
    roof = bpy.data.materials["BH_flat_warm_gray_roof"]
    roof_red = (*hex_to_linear(BIRDHOUSE_ROOF_RED), 1.0)
    shader = principled(roof)
    shader.inputs["Base Color"].default_value = roof_red
    shader.inputs["Roughness"].default_value = BIRDHOUSE_ROOF_ROUGHNESS
    shader.inputs["Metallic"].default_value = 0.0
    roof.diffuse_color = roof_red
    roof.roughness = BIRDHOUSE_ROOF_ROUGHNESS
    roof.metallic = 0.0

    for name, width in BIRDHOUSE_BEVELS.items():
        obj = bpy.data.objects[name]
        for modifier in list(obj.modifiers):
            obj.modifiers.remove(modifier)
        bevel = obj.modifiers.new("Party Bevel", "BEVEL")
        bevel.width = width
        bevel.segments = 3
        bevel.limit_method = "ANGLE"
        bevel.angle_limit = math.radians(30)
        bevel.harden_normals = False
        weighted = obj.modifiers.new("Party Weighted Normal", "WEIGHTED_NORMAL")
        weighted.keep_sharp = False
        weighted.weight = 100
        for polygon in obj.data.polygons:
            polygon.use_smooth = True


RESTYLERS = {
    "BirdHouse.blend": restyle_birdhouse,
    "Bush.blend": restyle_bush,
    "Fence.blend": restyle_fence,
    "RaisedBed.blend": restyle_raised_bed,
    "Tree.blend": restyle_tree,
    "StoneSmall.blend": lambda: restyle_stone("Stone Small", 1.3),
    "StoneMedium.blend": lambda: restyle_stone("Stone Medium", 4.1),
    "StoneLarge.blend": lambda: restyle_stone("Stone Large", 7.7),
}


def main():
    args = parse_args()
    wanted = {f"{name}.blend" for name in args.asset}
    for file_name in MATERIAL_ROLES:
        if wanted and file_name not in wanted:
            continue
        path = ASSETS_DIR / file_name
        bpy.ops.wm.open_mainfile(filepath=str(path))
        apply_palette(file_name)
        restyle = RESTYLERS.get(file_name)
        if restyle:
            restyle()
        bpy.ops.wm.save_mainfile(filepath=str(path))
        print(f"Restyled {file_name}")


if __name__ == "__main__":
    main()
