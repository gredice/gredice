"""Restyle terrain, paths and ground cover for the toy-diorama look in GAME_ART.md.

Covers the stone, polished stone, gravel and sand terrain blocks with their
ramps and stairs, the stone and wooden walkways, the small wooden bridge, the
three mulches, the hay bale and the unused ground environment cube.

Terrain stays a continuous floor: every block keeps flush, unbevelled outer
walls and a top at exactly 0.4, so neighbours meet without a seam. Exposed
sides are rounded at runtime by `entities/terrainRim`, not here. Stone blocks
are paved with chunky rounded slabs on a 0.5 grid that is offset half a slab
from the tile grid, so the tile edge runs through the middle of a slab and
never shows as a joint. Ramps carry the same slabs, and steps get rounded
nosings where they face down.

Timber keeps the shared wood profile: plank, stringer and peg materials of the
walkway and bridge are reference materials for every other wooden prop and are
only reshaped, never recoloured. Object names, origins and material slots stay
as they were, so the runtime finds the same nodes.

Run from the repository root, then export the touched assets:

    /Applications/Blender.app/Contents/MacOS/Blender -b \
        --python assets/scripts/party-pass-terrain.py
    (cd assets && Blender -b --python export-game-assets.py -- --asset BlockStone ...)

Pass `-- --asset BlockStone` to limit the run to one source file. The script
rebuilds every mesh from scratch, so it is safe to run again.
"""

import argparse
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import party_style  # noqa: E402

ASSETS_DIR = Path(__file__).resolve().parents[1] / "game-assets"
TEXTURES_DIR = Path(__file__).resolve().parents[1] / "game-textures"

TERRAIN_TOP = 0.4

# On-screen colour of a sunlit top face, and roughness. Converted to albedo
# with party_style.screen_to_albedo, so they match the role table. That fit
# ignores the blue the sky fill adds to a top face; in the game warm ground
# loses a little saturation, so sand and gravel are authored a step warmer
# than they should look (sand shows about #f1d29a, gravel about #d7c8ad).
SCREEN = {
    # Stone roles: cool tinted neutrals around the "stone" role #b3bdd3.
    "stone_light": ("#bfc8dd", 0.6),
    "stone": ("#b3bdd3", 0.6),
    "stone_dark": ("#a5b0c9", 0.6),
    # Polished stone: a warm cream sandstone neutral, lighter and a little
    # glossier than paving, so it never reads as snow (cool blue-white) or as
    # the cool stone paving. The sky fill cools a warm top face, so it is
    # authored a step warmer: it shows about #ebd6c6 in the game.
    "polished_stone": ("#edd6b1", 0.5),
    # Gravel: warm grey-beige neutral, light and dark pebbles around it.
    "gravel": ("#d5c696", 0.78),
    # Pebbles stay close to the bed so they read as texture, not as dots.
    "gravel_light": ("#e6d9b2", 0.6),
    "gravel_dark": ("#c2b083", 0.6),
    # Sand: warm and pale.
    "sand": ("#efd082", 0.8),
    # Stepping stones: stone role, with a warmer accent stone.
    "walk_stone_light": ("#c3cce0", 0.6),
    "walk_stone": ("#b3bdd3", 0.6),
    "walk_stone_warm": ("#d8c3a0", 0.6),
    # Walkway pegs: a dark wood accent, kept above the darkest soil value.
    "peg": ("#9c5424", 0.55),
    # Ground cover. Hay and straw take the seasonal hay role.
    "hay": party_style.SEASONAL_ROLES["hay"],
    # Mulch matches the in-game mulch patches (entities/raisedBed/MulchPatch).
    "mulch_coconut": ("#ab622a", 0.8),
    "mulch_hay": party_style.SEASONAL_ROLES["hay"],
    "mulch_wood": ("#cd8632", 0.8),
    "grass": ("#7bd03a", 0.7),
}

# Material name -> colour role, per source file. Materials not listed (the
# shared wood profile) keep their values.
MATERIAL_ROLES = {
    "BlockStone.blend": {
        "Material.BlockStone.Large": "stone_light",
        "Material.BlockStone.Mid": "stone",
        "Material.BlockStone.Dark": "stone_dark",
    },
    "BlockStoneAngle.blend": {
        "Material.BlockStone.Large": "stone_light",
        "Material.BlockStone.Mid": "stone",
        "Material.BlockStone.Dark": "stone_dark",
    },
    "BlockStoneStairs.blend": {
        "Material.BlockStone.Large": "stone_light",
        "Material.BlockStone.Mid": "stone",
        "Material.BlockStone.Dark": "stone_dark",
    },
    "BlockStoneStairsCorner.blend": {
        "Material.BlockStone.Large": "stone_light",
        "Material.BlockStone.Mid": "stone",
        "Material.BlockStone.Dark": "stone_dark",
    },
    "BlockPolishedStone.blend": {
        "Material.BlockPolishedStone.Surface": "polished_stone",
    },
    "BlockPolishedStoneAngle.blend": {
        "Material.BlockPolishedStone.Surface": "polished_stone",
    },
    "BlockPolishedStoneStairs.blend": {
        "Material.BlockPolishedStone.Surface": "polished_stone",
    },
    "BlockPolishedStoneStairsCorner.blend": {
        "Material.BlockPolishedStone.Surface": "polished_stone",
    },
    "BlockGravel.blend": {
        "Material.BlockGravel.Base": "gravel",
        "Material.BlockGravel.PiecesLight": "gravel_light",
        "Material.BlockGravel.PiecesDark": "gravel_dark",
    },
    "BlockGravelAngle.blend": {
        "Material.BlockGravel.Base": "gravel",
        "Material.BlockGravel.PiecesLight": "gravel_light",
        "Material.BlockGravel.PiecesDark": "gravel_dark",
    },
    "BlockSand.blend": {"Material.Sand": "sand"},
    "BlockSandAngle.blend": {"Material.Sand.001": "sand"},
    "StoneWalkway.blend": {
        "Material.StoneWalkway.LightStone": "walk_stone_light",
        "Material.StoneWalkway.MidStone": "walk_stone",
        "Material.StoneWalkway.WarmStone": "walk_stone_warm",
    },
    # Plank colours are the shared wood profile; only the pegs change.
    "WoodenWalkway.blend": {"Material.WoodenWalkway.Pegs": "peg"},
    # Every bridge material is a shared wood profile reference.
    "SmallWoodenBridge.blend": {},
    "MulchCoconut.blend": {"Material.ColorPaletteMain": "mulch_coconut"},
    "MulchHey.blend": {"Material.ColorPaletteMain": "mulch_hay"},
    "MulchWood.blend": {"Material.ColorPaletteMain": "mulch_wood"},
    "BaleHey.blend": {"Material.ColorPaletteMain": "hay"},
    "GroundEnvironment.blend": {"Material.Grass": "grass"},
}


# Shared painted textures by material, with the linear average colour each
# was painted to. Gravel takes the calm path texture, multiplied down to its
# grey-beige albedo; one repeat per tile, so unrotated neighbours join
# without a seam.
TEXTURED_MATERIALS = {
    "Material.BlockGravel.Base": ("path.webp", party_style.hex_to_linear("#e0a765")),
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", action="append", default=[])
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


# ---------------------------------------------------------------- materials
def apply_palette(file_name):
    for material_name, role in MATERIAL_ROLES[file_name].items():
        material = bpy.data.materials.get(material_name)
        if material is None:
            raise RuntimeError(f"{file_name}: missing material {material_name}")
        hex_value, roughness = SCREEN[role]
        albedo = party_style.screen_to_albedo(hex_value)
        # Flat colour, no texture: unlinks the old palette atlas lookups too.
        party_style.set_flat_colour(material, albedo, roughness)
        for node in [
            n for n in material.node_tree.nodes if n.type in {"TEX_IMAGE", "MIX"}
        ]:
            material.node_tree.nodes.remove(node)
        textured = TEXTURED_MATERIALS.get(material_name)
        if textured:
            apply_texture(material, albedo, *textured)
        print(f"  {party_style.describe_material(material)}")


def apply_texture(material, albedo, texture_name, texture_average):
    """Multiplies a shared painted texture down to the material's albedo.

    The texture is painted in the colour players see; a multiply node with a
    constant colour exports as the glTF base colour factor.
    """
    tree = material.node_tree
    shader = party_style.principled(material)
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
    factor = [channel / average for channel, average in zip(albedo, texture_average)]
    mix.inputs[7].default_value = (*factor, 1.0)
    tree.links.new(texture.outputs["Color"], mix.inputs[6])
    tree.links.new(mix.outputs[2], shader.inputs["Base Color"])


# ------------------------------------------------------------------ helpers
def planar_uvs(bm, scale=1.0):
    """Top-down UVs from position: continuous, so they add no seams."""
    layer = bm.loops.layers.uv.verify()
    for face in bm.faces:
        for loop in face.loops:
            loop[layer].uv = (loop.vert.co.x * scale, loop.vert.co.y * scale)


def delete_bottom_faces(bm, floor=0.0):
    """Drops faces lying on the ground. They are never seen."""
    bottom = [
        face
        for face in bm.faces
        if face.normal.z < -0.99
        and all(abs(vert.co.z - floor) < 1e-5 for vert in face.verts)
    ]
    bmesh.ops.delete(bm, geom=bottom, context="FACES_ONLY")


# Edges folding more than this stay sharp. Two bevel segments on a right
# angle fold 45 degrees each, so bevels still shade smooth.
SHARP_ANGLE = math.radians(55)


def write_mesh(obj, bm, smooth=True, weighted=True):
    """Writes `bm` into `obj`, smooth shaded, replacing shaping modifiers.

    Edges left unbevelled on purpose (tile walls, the underside of a tread)
    are marked sharp, so smoothing never bends the light across a flat face.
    """
    for face in bm.faces:
        face.smooth = smooth
    for edge in bm.edges:
        if len(edge.link_faces) == 2:
            a, b = edge.link_faces
            if a.normal.angle(b.normal, 0.0) > SHARP_ANGLE:
                edge.smooth = False
    party_style.replace_mesh(obj, bm, weighted_normals=weighted)
    for modifier in obj.modifiers:
        if modifier.type == "WEIGHTED_NORMAL":
            modifier.keep_sharp = True
    # Geometry nodes are baked away: the 5.2 exporter renames their meshes.
    for modifier in list(obj.modifiers):
        if modifier.type == "NODES":
            obj.modifiers.remove(modifier)
    obj.data.update()


def snap_extent(bm, axis, low, high, tolerance=1e-4):
    """Snaps coordinates within `tolerance` of the tile limits onto them."""
    for vert in bm.verts:
        value = vert.co[axis]
        if abs(value - low) < tolerance:
            vert.co[axis] = low
        elif abs(value - high) < tolerance:
            vert.co[axis] = high


def tile_box(bm, low, high, radius, segments, sharp_sides):
    """A rounded box whose tile-edge sides stay flat-cut and unbevelled."""
    return party_style.add_box(
        bm, low, high, radius=radius, segments=segments, sharp_sides=sharp_sides
    )


def sharp_tile_sides(low, high):
    """Sides of a box that lie on the tile boundary, plus its underside."""
    sides = ["-z"]
    for axis, name in ((0, "x"), (1, "y")):
        if low[axis] <= -0.5 + 1e-6:
            sides.append(f"-{name}")
        if high[axis] >= 0.5 - 1e-6:
            sides.append(f"+{name}")
    return sides


# ---------------------------------------------------------- stone paving
# Slabs sit on a 0.5 grid centred on the tile centre, edge midpoints and
# corners. A tile edge cuts through the middle of a slab, so two blocks side
# by side join into whole slabs and the tile grid never shows as a joint.
PAVER_CENTRES = (-0.5, 0.0, 0.5)
PAVER_HALF = 0.25
# Half the gap between two slabs.
PAVER_HALF_GAP = 0.008
PAVER_RADIUS = 0.03
PAVER_THICKNESS = 0.075
# The bed under the slabs shows in the joints.
PAVER_BED_DEPTH = 0.05
PAVER_SEGMENTS = 2


def paver_cells():
    """(low, high, tone) for every slab piece inside the tile.

    `tone` is "light" on the centre and corners and "mid" on edge midpoints,
    so the slabs form a soft two-tone checker that joins across tiles.
    """
    cells = []
    for cx in PAVER_CENTRES:
        for cy in PAVER_CENTRES:
            low = [max(-0.5, cx - PAVER_HALF), max(-0.5, cy - PAVER_HALF)]
            high = [min(0.5, cx + PAVER_HALF), min(0.5, cy + PAVER_HALF)]
            for axis in (0, 1):
                if low[axis] > -0.5 + 1e-6:
                    low[axis] += PAVER_HALF_GAP
                if high[axis] < 0.5 - 1e-6:
                    high[axis] -= PAVER_HALF_GAP
            on_edge = (abs(cx) == 0.5) != (abs(cy) == 0.5)
            cells.append((low, high, "mid" if on_edge else "light"))
    return cells


def build_pavers(bm, tone, height=lambda x, y: TERRAIN_TOP):
    """Adds the slabs of one tone, their tops following `height`."""
    for low, high, cell_tone in paver_cells():
        if cell_tone != tone:
            continue
        box_low = (low[0], low[1], TERRAIN_TOP - PAVER_THICKNESS)
        box_high = (high[0], high[1], TERRAIN_TOP)
        new = tile_box(
            bm,
            box_low,
            box_high,
            PAVER_RADIUS,
            PAVER_SEGMENTS,
            sharp_tile_sides(box_low, box_high),
        )
        verts = {vert for face in new for vert in face.verts}
        for vert in verts:
            drop = TERRAIN_TOP - height(vert.co.x, vert.co.y)
            vert.co.z = max(0.0, vert.co.z - drop)


def build_paved_bed(bm, ramp=False):
    """The bed under the slabs: a flush box, or a wedge on a ramp."""
    bed_top = TERRAIN_TOP - PAVER_BED_DEPTH
    if not ramp:
        party_style.add_box(bm, (-0.5, -0.5, 0.0), (0.5, 0.5, bed_top))
        return
    # The ramp rises along +x from 0 at x = -0.5 to the full height at 0.5.
    x0 = -0.5 + PAVER_BED_DEPTH / TERRAIN_TOP
    profile = [(x0, 0.0), (0.5, 0.0), (0.5, bed_top)]
    verts = []
    for y in (-0.5, 0.5):
        verts.append([bm.verts.new((x, y, z)) for x, z in profile])
    front, back = verts
    bm.faces.new([front[0], front[1], front[2]])
    bm.faces.new([back[2], back[1], back[0]])
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new([front[j], front[i], back[i], back[j]])
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.normal_update()


RAMP_SLOPE = TERRAIN_TOP


def ramp_height(x, y):
    return max(0.0, min(TERRAIN_TOP, (x + 0.5) * RAMP_SLOPE))


def build_stone_floor(prefix, ramp=False):
    height = ramp_height if ramp else (lambda x, y: TERRAIN_TOP)
    for suffix, tone in (("Large", "light"), ("Mid", "mid")):
        obj = bpy.data.objects[f"{prefix}_{suffix}"]
        bm = bmesh.new()
        build_pavers(bm, tone, height)
        bm.normal_update()
        delete_bottom_faces(bm)
        snap_extent(bm, 0, -0.5, 0.5)
        snap_extent(bm, 1, -0.5, 0.5)
        planar_uvs(bm)
        write_mesh(obj, bm)
    obj = bpy.data.objects[f"{prefix}_Dark"]
    bm = bmesh.new()
    build_paved_bed(bm, ramp=ramp)
    bm.normal_update()
    delete_bottom_faces(bm)
    planar_uvs(bm)
    # The bed is a flush block with flat faces: no smoothing across corners.
    write_mesh(obj, bm, smooth=False, weighted=False)


# ------------------------------------------------------------------ stairs
STEP_RADIUS = 0.045
STEP_SEGMENTS = 2


def build_stairs(pieces_by_object):
    """`pieces_by_object` maps an object name to (low, high, sharp sides)."""
    for object_name, pieces in pieces_by_object.items():
        obj = bpy.data.objects[object_name]
        bm = bmesh.new()
        for low, high, sharp in pieces:
            tile_box(bm, low, high, STEP_RADIUS, STEP_SEGMENTS, sharp)
        bm.normal_update()
        delete_bottom_faces(bm)
        snap_extent(bm, 0, -0.5, 0.5)
        snap_extent(bm, 1, -0.5, 0.5)
        planar_uvs(bm)
        write_mesh(obj, bm)


# Straight stairs rise along +x: a lower tread at 0.2 for x < 0 and an upper
# tread at 0.4 for x > 0. Faces against the next tile or the upper step stay
# flat-cut; the nosings that face down the stairs are rounded.
LOW = 0.2
HIGH = TERRAIN_TOP
STRAIGHT_LOWER = {
    # Quarter pieces either side of y = 0 meet in a rounded joint.
    "-y": ((-0.5, -0.5, 0.0), (0.0, 0.0, LOW), ["-z", "-y", "+x"]),
    "+y": ((-0.5, 0.0, 0.0), (0.0, 0.5, LOW), ["-z", "+y", "+x"]),
}
STRAIGHT_UPPER = {
    "-y": ((0.0, -0.5, 0.0), (0.5, 0.0, HIGH), ["-z", "-y", "+x"]),
    "+y": ((0.0, 0.0, 0.0), (0.5, 0.5, HIGH), ["-z", "+y", "+x"]),
}


def restyle_stone_stairs():
    build_stairs(
        {
            "Block_Stone_Stairs_Large": [
                STRAIGHT_UPPER["+y"],
                STRAIGHT_LOWER["-y"],
            ],
            "Block_Stone_Stairs_Mid": [STRAIGHT_UPPER["-y"]],
            "Block_Stone_Stairs_Dark": [STRAIGHT_LOWER["+y"]],
        }
    )


def restyle_polished_stairs():
    # One smooth piece per tread, no joint between quarters.
    build_stairs(
        {
            "Block_Polished_Stone_Stairs": [
                ((-0.5, -0.5, 0.0), (0.0, 0.5, LOW), ["-z", "-y", "+y", "+x"]),
                ((0.0, -0.5, 0.0), (0.5, 0.5, HIGH), ["-z", "-y", "+y", "+x"]),
            ]
        }
    )


# Corner stairs: the upper quarter sits at +x/+y (runtime +X/-Z) and an
# L-shaped lower tread wraps it on the -x and -y sides.
CORNER_UPPER = ((0.0, 0.0, 0.0), (0.5, 0.5, HIGH), ["-z", "+x", "+y"])
CORNER_LOWER_CORNER = ((-0.5, -0.5, 0.0), (0.0, 0.0, LOW), ["-z"])
CORNER_LOWER_X = ((0.0, -0.5, 0.0), (0.5, 0.0, LOW), ["-z", "+x", "+y"])
CORNER_LOWER_Y = ((-0.5, 0.0, 0.0), (0.0, 0.5, LOW), ["-z", "+y", "+x"])


def restyle_stone_stairs_corner():
    build_stairs(
        {
            "Block_Stone_Stairs_Corner_Large": [CORNER_UPPER, CORNER_LOWER_CORNER],
            "Block_Stone_Stairs_Corner_Mid": [CORNER_LOWER_X],
            "Block_Stone_Stairs_Corner_Dark": [CORNER_LOWER_Y],
        }
    )


def restyle_polished_stairs_corner():
    # The lower L is one tread: its quarters meet flat, without a joint.
    build_stairs(
        {
            "Block_Polished_Stone_Stairs_Corner": [
                CORNER_UPPER,
                ((-0.5, -0.5, 0.0), (0.0, 0.0, LOW), ["-z", "+x", "+y"]),
                ((0.0, -0.5, 0.0), (0.5, 0.0, LOW), ["-z", "+x", "+y", "-x"]),
                ((-0.5, 0.0, 0.0), (0.0, 0.5, LOW), ["-z", "+y", "+x", "-y"]),
            ]
        }
    )


# ---------------------------------------------------------- plain blocks
def flush_box(bm, low=(-0.5, -0.5, 0.0), high=(0.5, 0.5, TERRAIN_TOP)):
    party_style.add_box(bm, low, high)


def flush_wedge(bm, top=TERRAIN_TOP, z_offset=0.0):
    """A ramp rising along +x, with flat faces so neighbours join flush."""
    corners = {}
    for x in (-0.5, 0.5):
        for y in (-0.5, 0.5):
            corners[(x, y, 0)] = bm.verts.new((x, y, z_offset))
    for y in (-0.5, 0.5):
        corners[(0.5, y, 1)] = bm.verts.new((0.5, y, z_offset + top))
    c = corners
    bm.faces.new([c[(-0.5, -0.5, 0)], c[(-0.5, 0.5, 0)], c[(0.5, 0.5, 0)], c[(0.5, -0.5, 0)]])
    bm.faces.new([c[(-0.5, -0.5, 0)], c[(0.5, -0.5, 0)], c[(0.5, -0.5, 1)]])
    bm.faces.new([c[(0.5, -0.5, 0)], c[(0.5, 0.5, 0)], c[(0.5, 0.5, 1)], c[(0.5, -0.5, 1)]])
    bm.faces.new([c[(-0.5, 0.5, 0)], c[(0.5, 0.5, 1)], c[(0.5, 0.5, 0)]])
    bm.faces.new([c[(-0.5, -0.5, 0)], c[(0.5, -0.5, 1)], c[(0.5, 0.5, 1)], c[(-0.5, 0.5, 0)]])
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.normal_update()


def restyle_polished_block():
    obj = bpy.data.objects["Block_Polished_Stone"]
    bm = bmesh.new()
    flush_box(bm)
    planar_uvs(bm)
    write_mesh(obj, bm, smooth=False, weighted=False)


def restyle_polished_angle():
    obj = bpy.data.objects["Block_Polished_Stone_Angle"]
    bm = bmesh.new()
    flush_wedge(bm)
    planar_uvs(bm)
    write_mesh(obj, bm, smooth=False, weighted=False)


def restyle_sand(object_name, wedge):
    """Bakes the old geometry-node transform into a plain flush block."""
    obj = bpy.data.objects[object_name]
    # The origin sits at half height, 0.2 above the ground.
    bm = bmesh.new()
    if wedge:
        flush_wedge(bm, z_offset=-0.2)
    else:
        flush_box(bm, (-0.5, -0.5, -0.2), (0.5, 0.5, 0.2))
    planar_uvs(bm)
    write_mesh(obj, bm, smooth=False, weighted=False)


# ------------------------------------------------------------------ gravel
# A few large, flattened pebbles set into the gravel bed. Few large marks
# read calmer than many small ones. Sizes and places are irregular, with no
# row or column in common, so a floor of unrotated tiles does not read as a
# grid of dots. (x, y, radius x, radius y, angle)
GRAVEL_LIGHT = [
    (-0.26, 0.17, 0.12, 0.085, 0.5),
    (0.2, -0.27, 0.1, 0.072, 2.3),
]
GRAVEL_DARK = [
    (0.16, 0.2, 0.085, 0.065, 1.3),
    (-0.31, -0.24, 0.075, 0.058, 0.2),
    (0.33, -0.02, 0.065, 0.05, 1.9),
]
# The flat bed sits a little under the tile top so the pebbles show; the
# highest pebble reaches the top exactly.
GRAVEL_BED_TOP = 0.386
GRAVEL_RELIEF = TERRAIN_TOP - GRAVEL_BED_TOP


def add_pebble(bm, x, y, rx, ry, angle, base_z, relief, slope=0.0):
    """A flattened pebble lying on a surface that rises `slope` per unit x."""
    result = bmesh.ops.create_uvsphere(
        bm, u_segments=12, v_segments=5, radius=1.0
    )
    verts = result["verts"]
    cos_a, sin_a = math.cos(angle), math.sin(angle)
    # Lay the pebble in the surface: along the slope, across it, and out of it.
    along = Vector((1.0, 0.0, slope)).normalized()
    across = Vector((0.0, 1.0, 0.0))
    normal = Vector((-slope, 0.0, 1.0)).normalized()
    for vert in verts:
        local = vert.co.copy()
        px, py = local.x * rx, local.y * ry
        # Only the upper half shows; the rest sinks into the bed.
        pz = local.z * (relief if local.z > 0 else relief * 0.6)
        u = px * cos_a - py * sin_a
        v = px * sin_a + py * cos_a
        vert.co = Vector((x, y, base_z)) + along * u + across * v + normal * pz
    return verts


def gravel_bed(bm, ramp):
    """The exact flush box or wedge: tile walls stay unbevelled."""
    if ramp:
        # Same slope as every other ramp, so they meet without a step.
        flush_wedge(bm)
    else:
        party_style.add_box(bm, (-0.5, -0.5, 0.0), (0.5, 0.5, GRAVEL_BED_TOP))


def restyle_gravel(prefix, ramp=False):
    obj = bpy.data.objects[f"{prefix}_Base"]
    bm = bmesh.new()
    gravel_bed(bm, ramp)
    planar_uvs(bm)
    write_mesh(obj, bm, smooth=False, weighted=False)

    for suffix, pebbles in (("Pieces_Light", GRAVEL_LIGHT), ("Pieces_Dark", GRAVEL_DARK)):
        obj = bpy.data.objects[f"{prefix}_{suffix}"]
        bm = bmesh.new()
        for x, y, rx, ry, angle in pebbles:
            if ramp:
                bed = ramp_height(x, y)
                # Pebbles stay off the thin toe.
                if bed < 0.08:
                    continue
                verts = add_pebble(
                    bm, x, y, rx, ry, angle, bed, GRAVEL_RELIEF,
                    slope=RAMP_SLOPE,
                )
                # ...and below the crest.
                if max(vert.co.z for vert in verts) > TERRAIN_TOP - 0.01:
                    bmesh.ops.delete(bm, geom=verts, context="VERTS")
            else:
                add_pebble(bm, x, y, rx, ry, angle, GRAVEL_BED_TOP, GRAVEL_RELIEF)
        bm.normal_update()
        planar_uvs(bm)
        write_mesh(obj, bm, weighted=False)
    if not ramp:
        # Pole vertices land exactly on the tile top.
        for suffix in ("Pieces_Light", "Pieces_Dark"):
            mesh = bpy.data.objects[f"{prefix}_{suffix}"].data
            for vert in mesh.vertices:
                if abs(vert.co.z - TERRAIN_TOP) < 1e-5:
                    vert.co.z = TERRAIN_TOP
            mesh.update()


def restyle_block_gravel():
    restyle_gravel("Block_Gravel")


def restyle_block_gravel_angle():
    restyle_gravel("Block_Gravel_Angle", ramp=True)


# ---------------------------------------------------------- stone walkway
# Chunky stepping slabs. Each slab sits a hair inside the tile so walkway
# tiles meet with a joint like any other slab. (x0, y0, x1, y1, object)
WALK_STONE_HEIGHT = 0.064
WALK_STONE_GAP = 0.012
WALK_STONES = [
    (-0.5, -0.5, -0.04, -0.166, "StoneWalkway_StonesLight"),
    (-0.04, -0.5, 0.5, -0.166, "StoneWalkway_StonesMid"),
    (-0.5, -0.166, 0.04, 0.166, "StoneWalkway_StonesMid"),
    (0.04, -0.166, 0.5, 0.166, "StoneWalkway_StonesWarm"),
    (-0.5, 0.166, -0.02, 0.5, "StoneWalkway_StonesWarm"),
    (-0.02, 0.166, 0.5, 0.5, "StoneWalkway_StonesMid"),
]
# Slight height differences keep the slabs from reading as one sheet.
WALK_STONE_HEIGHTS = {
    "StoneWalkway_StonesLight": 0.058,
    "StoneWalkway_StonesMid": 0.064,
    "StoneWalkway_StonesWarm": 0.061,
}


def restyle_stone_walkway():
    meshes = {name: bmesh.new() for name in WALK_STONE_HEIGHTS}
    for x0, y0, x1, y1, name in WALK_STONES:
        low = [x0, y0]
        high = [x1, y1]
        for axis in (0, 1):
            low[axis] += WALK_STONE_GAP / 2
            high[axis] -= WALK_STONE_GAP / 2
        # Snap the outer slab faces back onto the tile edge: neighbouring
        # walkway tiles share the joint width between them.
        for axis in (0, 1):
            if low[axis] < -0.5 + WALK_STONE_GAP:
                low[axis] = -0.5 + WALK_STONE_GAP / 2
            if high[axis] > 0.5 - WALK_STONE_GAP:
                high[axis] = 0.5 - WALK_STONE_GAP / 2
        party_style.add_box(
            meshes[name],
            (low[0], low[1], 0.0),
            (high[0], high[1], WALK_STONE_HEIGHTS[name]),
            radius=0.03,
            segments=2,
            sharp_sides=("-z",),
        )
    for name, bm in meshes.items():
        bm.normal_update()
        delete_bottom_faces(bm)
        # Keep the exported footprint on the tile edges.
        for vert in bm.verts:
            for axis in (0, 1):
                if abs(abs(vert.co[axis]) - (0.5 - WALK_STONE_GAP / 2)) < 1e-6:
                    vert.co[axis] = math.copysign(0.5, vert.co[axis])
        planar_uvs(bm)
        write_mesh(bpy.data.objects[name], bm)


# --------------------------------------------------------- wooden walkway
# Six chunky planks across the walk, alternating warm and light, so a run
# of tiles keeps alternating across the tile edge.
WALK_PLANK_COUNT = 6
WALK_PLANK_GAP = 0.022
WALK_PLANK_HALF_LENGTH = 0.43
WALK_PLANK_THICKNESS = 0.09
WALK_PEG_X = 0.36
WALK_PEG_RADIUS = 0.026
WALK_PEG_RISE = 0.004


def plank_uvs(bm, faces, grain_axis, density=2.0):
    layer = bm.loops.layers.uv.verify()
    for face in faces:
        normal_axis = max(range(3), key=lambda axis: abs(face.normal[axis]))
        in_plane = [axis for axis in range(3) if axis != normal_axis]
        if grain_axis in in_plane:
            u_axis = grain_axis
            v_axis = next(axis for axis in in_plane if axis != grain_axis)
        else:
            u_axis, v_axis = in_plane
        for loop in face.loops:
            loop[layer].uv = (
                loop.vert.co[u_axis] * density,
                loop.vert.co[v_axis] * density,
            )


def add_dome(bm, x, y, z, radius, rise, segments=8, tilt=0.0):
    """A low domed nail head: a base ring, a shoulder ring and a top point.

    `tilt` follows a sloped plank: the dome leans with dz/dy.
    """
    rings = ((1.0, -0.4), (1.0, 0.25), (0.62, 0.85))
    ring_verts = []
    for scale, height in rings:
        ring = []
        for step in range(segments):
            angle = math.tau * step / segments
            dx = math.cos(angle) * radius * scale
            dy = math.sin(angle) * radius * scale
            ring.append(bm.verts.new((x + dx, y + dy, z + height * rise + tilt * dy)))
        ring_verts.append(ring)
    top = bm.verts.new((x, y, z + rise))
    for lower, upper in zip(ring_verts, ring_verts[1:]):
        for step in range(segments):
            nxt = (step + 1) % segments
            bm.faces.new([lower[step], lower[nxt], upper[nxt], upper[step]])
    last = ring_verts[-1]
    for step in range(segments):
        bm.faces.new([last[step], last[(step + 1) % segments], top])
    return top


def restyle_wooden_walkway():
    pitch = 1.0 / WALK_PLANK_COUNT
    width = pitch - WALK_PLANK_GAP
    planks = {"WoodenWalkway_PlanksWarm": bmesh.new(), "WoodenWalkway_PlanksLight": bmesh.new()}
    pegs = bmesh.new()
    for index in range(WALK_PLANK_COUNT):
        centre = -0.5 + pitch * (index + 0.5)
        name = "WoodenWalkway_PlanksWarm" if index % 2 == 0 else "WoodenWalkway_PlanksLight"
        bm = planks[name]
        # Slight length variation per plank, like hand-cut boards.
        trim = (0.0, 0.012, 0.004, 0.016, 0.008, 0.0)[index]
        faces = party_style.add_box(
            bm,
            (-WALK_PLANK_HALF_LENGTH + trim, centre - width / 2, 0.0),
            (WALK_PLANK_HALF_LENGTH - trim * 0.5, centre + width / 2, WALK_PLANK_THICKNESS),
            radius=0.035,
            segments=2,
            sharp_sides=("-z",),
        )
        plank_uvs(bm, faces, grain_axis=0)
        for side in (-1, 1):
            add_dome(
                pegs,
                side * WALK_PEG_X,
                centre,
                WALK_PLANK_THICKNESS,
                WALK_PEG_RADIUS,
                WALK_PEG_RISE + 0.004,
            )
    for name, bm in planks.items():
        bm.normal_update()
        delete_bottom_faces(bm)
        write_mesh(bpy.data.objects[name], bm)
    pegs.normal_update()
    planar_uvs(pegs)
    write_mesh(bpy.data.objects["WoodenWalkway_Pegs"], pegs, weighted=False)


# -------------------------------------------------------------- bridge
# A low arched footbridge: seven chunky planks on two arched stringers.
BRIDGE_TOP = 0.347
BRIDGE_ARCH = 0.74
BRIDGE_PLANK_THICKNESS = 0.085
BRIDGE_PLANK_HALF_LENGTH = 0.42
BRIDGE_PLANK_CENTRES = (-0.428, -0.285, -0.143, 0.0, 0.143, 0.285, 0.428)
BRIDGE_PLANK_WIDTH = 0.128
# Structural timber is at least 0.12 thick (GAME_ART.md).
BRIDGE_STRINGER_X = (0.285, 0.41)
BRIDGE_STRINGER_DEPTH = 0.13
BRIDGE_STRINGER_STEPS = 16


def bridge_top(y):
    return BRIDGE_TOP - BRIDGE_ARCH * y * y


def add_arched_plank(bm, centre):
    """A plank tilted to the arch, its middle on the deck line."""
    half = BRIDGE_PLANK_WIDTH / 2
    faces = party_style.add_box(
        bm,
        (-BRIDGE_PLANK_HALF_LENGTH, -half, -BRIDGE_PLANK_THICKNESS),
        (BRIDGE_PLANK_HALF_LENGTH, half, 0.0),
        radius=0.032,
        segments=2,
    )
    plank_uvs(bm, faces, grain_axis=0)
    slope = -2 * BRIDGE_ARCH * centre
    angle = math.atan(slope)
    verts = {vert for face in faces for vert in face.verts}
    cos_a, sin_a = math.cos(angle), math.sin(angle)
    for vert in verts:
        y, z = vert.co.y, vert.co.z
        vert.co.y = centre + y * cos_a - z * sin_a
        vert.co.z = bridge_top(centre) + y * sin_a + z * cos_a
    return faces


def add_stringer(bm, x0, x1):
    """A beam that follows the arch under the planks and lands on the ground."""
    rows = []
    for step in range(BRIDGE_STRINGER_STEPS + 1):
        y = -0.495 + 0.99 * step / BRIDGE_STRINGER_STEPS
        top = bridge_top(y) - BRIDGE_PLANK_THICKNESS + 0.01
        bottom = max(0.0, top - BRIDGE_STRINGER_DEPTH)
        rows.append(
            [
                bm.verts.new((x0, y, bottom)),
                bm.verts.new((x1, y, bottom)),
                bm.verts.new((x1, y, top)),
                bm.verts.new((x0, y, top)),
            ]
        )
    for a, b in zip(rows, rows[1:]):
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new([a[i], a[j], b[j], b[i]])
    bm.faces.new(list(reversed(rows[0])))
    bm.faces.new(rows[-1])
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.normal_update()
    # Round the top and end edges; the underside stays flat on the ground.
    created = [f for row in rows for v in row for f in v.link_faces]
    bottom = {face for face in created if face.normal.z < -0.5}
    edges = {
        edge
        for face in set(created)
        for edge in face.edges
        if len(edge.link_faces) == 2
        and not any(linked in bottom for linked in edge.link_faces)
        and edge.link_faces[0].normal.angle(edge.link_faces[1].normal, 0.0)
        > math.radians(30)
    }
    bmesh.ops.bevel(
        bm,
        geom=list(edges),
        offset=0.03,
        offset_type="OFFSET",
        segments=2,
        profile=0.5,
        affect="EDGES",
        clamp_overlap=True,
    )
    bm.normal_update()


def restyle_bridge():
    light = bmesh.new()
    warm = bmesh.new()
    for index, centre in enumerate(BRIDGE_PLANK_CENTRES):
        add_arched_plank(light if index % 2 == 0 else warm, centre)
    for name, bm in (
        ("SmallWoodenBridge_PlanksLight", light),
        ("SmallWoodenBridge_PlanksWarm", warm),
    ):
        bm.normal_update()
        write_mesh(bpy.data.objects[name], bm)

    stringers = bmesh.new()
    for sign in (-1, 1):
        x0, x1 = sorted((sign * BRIDGE_STRINGER_X[0], sign * BRIDGE_STRINGER_X[1]))
        add_stringer(stringers, x0, x1)
    obj = bpy.data.objects["SmallWoodenBridge_Stringers"]
    write_mesh(obj, stringers)

    pegs = bmesh.new()
    for y in (BRIDGE_PLANK_CENTRES[0], BRIDGE_PLANK_CENTRES[-1]):
        for x in (-0.35, 0.35):
            add_dome(
                pegs,
                x,
                y,
                bridge_top(y),
                0.03,
                0.016,
                tilt=-2 * BRIDGE_ARCH * y,
            )
    pegs.normal_update()
    planar_uvs(pegs)
    write_mesh(bpy.data.objects["SmallWoodenBridge_Pegs"], pegs, weighted=False)


# ------------------------------------------------------------------ mulch
def restyle_mulch(object_name):
    """A soft, low mound instead of a flat faceted disc."""
    obj = bpy.data.objects[object_name]
    bm = bmesh.new()
    party_style.add_blob(
        bm,
        (0.0, 0.0, -0.012),
        (0.163, 0.16, 0.047),
        subdivisions=2,
        bump=0.05,
        seed=2.3,
        floor=0.0,
    )
    bm.normal_update()
    delete_bottom_faces(bm)
    planar_uvs(bm)
    write_mesh(obj, bm, weighted=False)


# -------------------------------------------------------------- hay bale
BALE_HALF = (0.185, 0.39)
BALE_HEIGHT = 0.35
BALE_RADIUS = 0.07
BALE_TWINE_Y = (-0.19, 0.19)
BALE_TWINE_HALF_WIDTH = 0.022
BALE_TWINE_RISE = 0.012


def restyle_bale():
    obj = bpy.data.objects["BaleHey"]
    bm = bmesh.new()
    party_style.add_box(
        bm,
        (-BALE_HALF[0], -BALE_HALF[1], 0.005),
        (BALE_HALF[0], BALE_HALF[1], BALE_HEIGHT),
        radius=BALE_RADIUS,
        segments=3,
    )
    # Two twine bands: slightly proud, rounded loops around the bale.
    for y in BALE_TWINE_Y:
        party_style.add_box(
            bm,
            (-BALE_HALF[0] - BALE_TWINE_RISE, y - BALE_TWINE_HALF_WIDTH, 0.005 - 0.0),
            (BALE_HALF[0] + BALE_TWINE_RISE, y + BALE_TWINE_HALF_WIDTH, BALE_HEIGHT + BALE_TWINE_RISE),
            radius=BALE_RADIUS + BALE_TWINE_RISE * 0.5,
            segments=3,
        )
    bm.normal_update()
    planar_uvs(bm)
    write_mesh(obj, bm)


# ---------------------------------------------------------- ground cube
def restyle_ground_environment():
    """The unused preview cube: a rounded grass cube with its tuft.

    The cube (2 units in its own space, scaled by 0.5) gets the 0.07 terrain
    bevel. The tuft had no material, so the loader drew it in its default
    white with metalness 1; it shares the cube's grass material.
    """
    cube = bpy.data.objects["Gound Cube"]
    bm = bmesh.new()
    party_style.add_box(bm, (-1.0, -1.0, -1.0), (1.0, 1.0, 1.0), radius=0.14, segments=3)
    planar_uvs(bm, scale=0.5)
    write_mesh(cube, bm)
    tuft = bpy.data.objects["Grass 1"]
    tuft.data.materials.clear()
    tuft.data.materials.append(bpy.data.materials["Material.Grass"])
    for polygon in tuft.data.polygons:
        polygon.use_smooth = True


RESTYLERS = {
    "BlockStone.blend": lambda: build_stone_floor("Block_Stone"),
    "BlockStoneAngle.blend": lambda: build_stone_floor("Block_Stone_Angle", ramp=True),
    "BlockStoneStairs.blend": restyle_stone_stairs,
    "BlockStoneStairsCorner.blend": restyle_stone_stairs_corner,
    "BlockPolishedStone.blend": restyle_polished_block,
    "BlockPolishedStoneAngle.blend": restyle_polished_angle,
    "BlockPolishedStoneStairs.blend": restyle_polished_stairs,
    "BlockPolishedStoneStairsCorner.blend": restyle_polished_stairs_corner,
    "BlockGravel.blend": restyle_block_gravel,
    "BlockGravelAngle.blend": restyle_block_gravel_angle,
    "BlockSand.blend": lambda: restyle_sand("Block Sand 1", wedge=False),
    "BlockSandAngle.blend": lambda: restyle_sand("Block Sand Angle 1", wedge=True),
    "StoneWalkway.blend": restyle_stone_walkway,
    "WoodenWalkway.blend": restyle_wooden_walkway,
    "SmallWoodenBridge.blend": restyle_bridge,
    "MulchCoconut.blend": lambda: restyle_mulch("Mulch Coconut"),
    "MulchHey.blend": lambda: restyle_mulch("Mulch Hey"),
    "MulchWood.blend": lambda: restyle_mulch("Mulch Wood"),
    "BaleHey.blend": restyle_bale,
    "GroundEnvironment.blend": restyle_ground_environment,
}


def report():
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            print(
                f"  {obj.name}: {party_style.evaluated_triangles(obj)} tris,"
                f" dims {tuple(round(d, 3) for d in obj.dimensions)}"
            )


def main():
    args = parse_args()
    wanted = {f"{name}.blend" for name in args.asset}
    for file_name in RESTYLERS:
        if wanted and file_name not in wanted:
            continue
        path = ASSETS_DIR / file_name
        bpy.ops.wm.open_mainfile(filepath=str(path))
        print(f"Restyling {file_name}")
        apply_palette(file_name)
        RESTYLERS[file_name]()
        report()
        bpy.ops.wm.save_mainfile(filepath=str(path))
        backup = path.with_suffix(".blend1")
        if backup.exists():
            backup.unlink()


if __name__ == "__main__":
    main()
