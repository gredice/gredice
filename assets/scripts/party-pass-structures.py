"""Restyle fences, gates and garden structures for the look in GAME_ART.md.

Covers the g2 structures group: the wooden, white, rough stone and polished
stone fence families with their gates, and the shade, water well, composter,
garden box, outlet display table, arrow sign, wooden sign, moon rain barrel
and hazel light arch.

Parts are rebuilt as chunky rounded masses with smooth shading and weighted
normals, thin parts are thickened, and materials move to the on-screen
palette with metalness 0 and roughness by band. Wood keeps its colours: the
shared `Material.Planks` profile is not touched at all, and the other wood
materials move into the satin roughness band; only the three lightest
(outlet table golden and honey wood, sign board) are eased under the value
ceiling.

Object names, object origins, mesh data names, material names and material
slot order stay as they were, because the runtime looks parts up by node and
primitive name (for example `FenceGate_Leaf_Mesh_1`). Gate leaves keep their
hinge at the object origin, so they open exactly as before.

Fences, gates, signs, the shade and the composter are rebuilt from the
constants below. The other props are rebuilt from their original parts: the
first run stores each original mesh as an unexported copy named
`<mesh>.party_source` (fake user, not linked to any object), and every run
starts from that copy, so running the script again gives the same result.
Run it from the repository root; `--export` also exports the touched assets
(see below for why plain export-game-assets.py is not enough):

    /Applications/Blender.app/Contents/MacOS/Blender -b \
        --python assets/scripts/party-pass-structures.py -- \
        --export [--asset FenceGate --asset WhiteFence ...]

Flat cuts, where a part meets the ground or continues into the next tile,
are marked sharp and the weighted normals keep them, so the large cut face
does not bend the normals of the faces beside it.

generate-fence-gates.py, generate-white-fence.py and generate-stone-fences.py
still build the earlier shapes; run this script after them.

Re-running gives the same shapes. Most files come out byte for byte the
same; the shade lattice cuts and the polished gate's rounded bars can be
numbered differently by Blender's bevel and bisect operators, so those two
GLBs may need a version bump after a re-run even though nothing moved.

Pass `-- --asset FenceGate` to limit the run to one source file, and
`--export` to export the restyled assets as well. Exporting through this
script differs from plain export-game-assets.py in two ways, both needed
while the repository pins Blender 5.1 but these files are saved with 5.2:

- Blender 5.2's glTF exporter sorts root objects by name. 5.1 kept scene
  order, which the manifest and the asset tests pin, so the export restores
  scene order.
- The shared plank colour in the exported GLBs is written as exact decimals
  (see docs/game-party-style.md). `Material.Planks` copies Fence.glb's base
  colour factor, so the gate matches its fence exactly.
"""

import argparse
import json
import math
import runpy
import struct
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import party_style  # noqa: E402

ASSETS_DIR = Path(__file__).resolve().parents[1] / "game-assets"
EXPORT_SCRIPT = Path(__file__).resolve().parents[1] / "export-game-assets.py"
MODELS_DIR = Path(__file__).resolve().parents[2] / "apps/garden/public/assets/models"
SHARED_PLANKS = ("Fence.glb", "Material.Planks")

# ------------------------------------------------------------------ palette
# Wood other than the shared plank profile keeps its colour and moves into
# the satin band.
WOOD_ROUGHNESS = 0.6

# On-screen colour of a sunlit top face and roughness, per material role.
# Roles from GAME_ART.md are reused where one fits.
SCREEN = {
    # Warm off-white paint: a neutral, never pure white. The game's cool sky
    # fill takes saturation out of warm neutrals (#f2e9d8 measured s=0.07 on
    # a sunlit picket), so it is authored warmer to land near s=0.12-0.18.
    "white_paint": ("#f6e5c4", 0.55),
    # Cool fieldstone in three close tones, one per stone, not shading.
    "stone_light": party_style.SCREEN_ROLES["stone"],
    "stone_mid": ("#a7b2c9", 0.6),
    "stone_dark": ("#9ba7c0", 0.6),
    # Polished stone keeps its warm limestone identity; authored warmer for
    # the same reason as the white paint (#e2d4ba measured s=0.07 on a
    # sunlit cap in game, #e9cea0 measured s=0.22).
    "limestone": ("#e9d2aa", 0.5),
    "steel": party_style.SCREEN_ROLES["steel"],
    "rope": ("#e2b46a", 0.8),
    "trunk": party_style.SCREEN_ROLES["trunk"],
    "leaf": party_style.SCREEN_ROLES["crop_leaf"],
    "brass": ("#f2ad33", 0.35),
    "terracotta": ("#e2703c", 0.5),
    "water": ("#3aa6ec", 0.12),
    "moonstone": ("#d9e2f2", 0.45),
    "sign_green": party_style.SCREEN_ROLES["canopy"],
    # Light woods on the outlet table and sign board, eased just under the
    # 0.95 value ceiling (they showed 0.97-0.98) with their hue kept.
    "golden_wood": ("#f2b060", WOOD_ROUGHNESS),
    "honey_wood": ("#f0985a", WOOD_ROUGHNESS),
    "board_wood": ("#f0aa66", WOOD_ROUGHNESS),
}

# The compost matches the raised bed soil from generate-party-core.py, so a
# composter next to a bed reads as the same earth.
BED_SOIL_ALBEDO = ((0.13, 0.05, 0.017), 0.85)



def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", action="append", default=[])
    parser.add_argument("--export", action="store_true")
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def hex_distance(first, second):
    a = [int(first[i : i + 2], 16) for i in (1, 3, 5)]
    b = [int(second[i : i + 2], 16) for i in (1, 3, 5)]
    return max(abs(x - y) for x, y in zip(a, b))


def material(name):
    found = bpy.data.materials.get(name)
    if found is None:
        raise RuntimeError(f"Missing material {name}")
    return found


def paint(name, role):
    """Gives a material the albedo that shows the role's on-screen colour."""
    target, roughness = SCREEN[role]
    albedo = party_style.screen_to_albedo(target)
    shown = party_style.albedo_to_screen(albedo)
    if hex_distance(shown, target) > 3:
        raise RuntimeError(f"{name}: {target} is out of reach, shows {shown}")
    party_style.set_flat_colour(material(name), albedo, roughness)


def paint_albedo(name, albedo, roughness):
    party_style.set_flat_colour(material(name), albedo, roughness)


def wood(name):
    """Keeps a wood colour and moves it into the satin band."""
    party_style.set_surface(material(name), WOOD_ROUGHNESS)


def set_slots(obj, names):
    obj.data.materials.clear()
    for name in names:
        obj.data.materials.append(material(name))


# ------------------------------------------------------------------- shapes
# BMesh elements hash by address, so sets of them iterate in a different
# order on every run. These helpers keep first-seen order instead, which keeps
# the exported files byte-for-byte repeatable.
def unique(items):
    return list(dict.fromkeys(items))


def faces_verts(faces):
    return unique(vert for face in faces for vert in face.verts)


def faces_edges(faces):
    return unique(edge for face in faces for edge in face.edges)


def new_faces(bm, before):
    return [face for face in bm.faces if face not in before]


def transform(bm, faces, matrix):
    bmesh.ops.transform(bm, matrix=matrix, verts=faces_verts(faces))
    return faces


def box_uvs(bm, faces, density=2.0):
    """Projects UVs from the dominant face axis, for the shared textures."""
    layer = bm.loops.layers.uv.verify()
    for face in faces:
        normal = face.normal
        axis = max(range(3), key=lambda index: abs(normal[index]))
        u_axis, v_axis = [index for index in range(3) if index != axis]
        for loop in face.loops:
            loop[layer].uv = (
                loop.vert.co[u_axis] * density,
                loop.vert.co[v_axis] * density,
            )


def add_box(bm, low, high, radius=0.0, segments=3, sharp_sides=()):
    """party_style.add_box, with its faces and edges kept in mesh order.

    The shared helper collects them in sets, so the bevel runs in a
    different order on every run; later cuts then number the result
    differently. The shape is the same either way.
    """
    low = Vector(low)
    high = Vector(high)
    result = bmesh.ops.create_cube(bm, size=1.0)
    verts = result["verts"]
    bmesh.ops.scale(bm, vec=high - low, verts=verts)
    bmesh.ops.translate(bm, vec=(low + high) / 2, verts=verts)
    faces = unique(face for vert in verts for face in vert.link_faces)
    if radius <= 0:
        return faces
    axes = {"x": 0, "y": 1, "z": 2}
    sharp_faces = set()
    for side in sharp_sides:
        axis = axes[side[1]]
        sign = 1 if side[0] == "+" else -1
        sharp_faces.update(face for face in faces if face.normal[axis] * sign > 0.9)
    edges = [
        edge
        for edge in faces_edges(faces)
        if not any(linked in sharp_faces for linked in edge.link_faces)
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
    faces = [face for face in faces if face.is_valid] + new_faces(bm, before)
    # The bevel may rebuild the flat faces, so find them again by position.
    for face in faces:
        face.normal_update()
    for side in sharp_sides:
        axis = axes[side[1]]
        sign = 1 if side[0] == "+" else -1
        plane = high[axis] if sign > 0 else low[axis]
        mark_sharp(
            face
            for face in faces
            if face.normal[axis] * sign > 0.99
            and all(abs(vert.co[axis] - plane) < 1e-6 for vert in face.verts)
        )
    return faces


def mark_sharp(faces):
    """Splits normals around flat cut faces; `finish` keeps the split.

    A cut face is large next to the bevel strips around it, so weighted
    normals would otherwise turn the strips' end vertices along the cut and
    smear a light or dark wedge down the long faces beside it.
    """
    for face in faces:
        for edge in face.edges:
            edge.smooth = False


def rbox(bm, low, high, slot, radius, segments=2, sharp=()):
    """A rounded box between two corners, smooth shaded, in one slot."""
    faces = add_box(bm, low, high, radius=radius, segments=segments, sharp_sides=sharp)
    party_style.assign(faces, slot)
    return faces


def centred_box(bm, centre, size, slot, radius, segments=2, sharp=()):
    low = [c - s / 2 for c, s in zip(centre, size)]
    high = [c + s / 2 for c, s in zip(centre, size)]
    return rbox(bm, low, high, slot, radius, segments, sharp)


def bevel_faces(bm, faces, radius, segments, keep_sharp=None):
    """Rounds the edges of a closed part built from `faces`."""
    edges = faces_edges(faces)
    if keep_sharp is not None:
        edges = [edge for edge in edges if not keep_sharp(edge)]
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
    return [face for face in faces if face.is_valid] + new_faces(bm, before)


def prism(bm, profile, depth, slot, radius, segments=2, sharp_bottom=True):
    """Extrudes a 2D outline in the XZ plane by `depth` along Y and rounds it.

    `profile` lists (x, z) points counter-clockwise seen from -Y. Edges on
    the lowest z stay sharp when `sharp_bottom` is set, since they sit on the
    ground or inside another part.
    """
    half = depth / 2
    front = [bm.verts.new((x, -half, z)) for x, z in profile]
    back = [bm.verts.new((x, half, z)) for x, z in profile]
    faces = [bm.faces.new(front[::-1]), bm.faces.new(back)]
    count = len(profile)
    for index in range(count):
        following = (index + 1) % count
        faces.append(
            bm.faces.new(
                (front[index], front[following], back[following], back[index])
            )
        )
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    floor = min(z for _, z in profile)

    def on_floor(edge):
        return sharp_bottom and all(abs(v.co.z - floor) < 1e-6 for v in edge.verts)

    faces = bevel_faces(bm, faces, radius, segments, keep_sharp=on_floor)
    if sharp_bottom:
        for face in faces:
            face.normal_update()
        mark_sharp(
            face
            for face in faces
            if face.normal.z < -0.99
            and all(abs(vert.co.z - floor) < 1e-6 for vert in face.verts)
        )
    party_style.assign(faces, slot)
    return faces


def cylinder(bm, centre, radius, depth, slot, segments=16, bevel=0.0, axis="Z"):
    """A rounded cylinder along `axis`."""
    result = bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        segments=segments,
        radius1=radius,
        radius2=radius,
        depth=depth,
    )
    faces = unique(face for vert in result["verts"] for face in vert.link_faces)
    if bevel > 0:
        rims = [
            edge
            for edge in faces_edges(faces)
            if abs(edge.verts[0].co.z - edge.verts[1].co.z) < 1e-6
        ]
        before = set(bm.faces)
        bmesh.ops.bevel(
            bm,
            geom=rims,
            offset=bevel,
            offset_type="OFFSET",
            segments=2,
            profile=0.5,
            affect="EDGES",
            clamp_overlap=True,
        )
        faces = [face for face in faces if face.is_valid] + new_faces(bm, before)
    rotation = {
        "Z": Matrix.Identity(4),
        "X": Matrix.Rotation(math.pi / 2, 4, "Y"),
        "Y": Matrix.Rotation(math.pi / 2, 4, "X"),
    }[axis]
    transform(bm, faces, Matrix.Translation(centre) @ rotation)
    party_style.assign(faces, slot)
    return faces


def ball(bm, centre, radius, slot, subdivisions=2, squash=1.0):
    faces = party_style.add_blob(
        bm, centre, (radius, radius, radius * squash), subdivisions=subdivisions
    )
    party_style.assign(faces, slot)
    return faces


def finish(obj, bm, uvs=True):
    """Writes a rebuilt mesh, keeping the object's name, origin and data."""
    if uvs:
        box_uvs(bm, list(bm.faces))
    keep_sharp = any(not edge.smooth for edge in bm.edges)
    party_style.replace_mesh(obj, bm)
    # Weighted normals keep the flat cuts marked by `mark_sharp`.
    for modifier in obj.modifiers:
        if modifier.type == "WEIGHTED_NORMAL":
            modifier.keep_sharp = keep_sharp


# -------------------------------------------------------------- fence gates
# Every gate is one tile wide along X. The posts stand at +-GATE_HALF_WIDTH and
# the leaf is authored from its hinge at the object origin, as the runtime
# places it at -GATE_HALF_WIDTH and swings it open about local Y.
GATE_HALF_WIDTH = 0.43
GATE_SPAN = GATE_HALF_WIDTH * 2
# Clearance between a closed leaf and the latch-side post.
GATE_LATCH_GAP = 0.015

# Wooden gate: the same post and rail profile as the rebuilt Fence in
# generate-party-core.py, so a fence line with a gate reads as one set.
WOOD_POST = 0.18
WOOD_HEIGHT = 0.55
WOOD_POST_BEVEL = 0.06
WOOD_RAIL_THICKNESS = 0.075
WOOD_RAIL_HEIGHT = 0.1
WOOD_RAIL_LEVELS = (0.2, 0.42)
WOOD_RAIL_BEVEL = 0.03


def hardware_band(bm, x_low, x_high, centre_y, centre_z, size_y, size_z, slot):
    """A steel strap wrapped around a rail or stile."""
    margin = 0.016
    return rbox(
        bm,
        (x_low, centre_y - size_y / 2 - margin, centre_z - size_z / 2 - margin),
        (x_high, centre_y + size_y / 2 + margin, centre_z + size_z / 2 + margin),
        slot,
        radius=0.014,
        segments=2,
    )


def restyle_fence_gate():
    posts = bpy.data.objects["FenceGate_Posts"]
    leaf = bpy.data.objects["FenceGate_Leaf"]
    paint("Material.FenceGate.Hardware", "steel")

    set_slots(posts, ["Material.Planks"])
    bm = bmesh.new()
    half = WOOD_POST / 2
    for side in (-1, 1):
        x = side * GATE_HALF_WIDTH
        rbox(
            bm,
            (x - half, -half, 0.0),
            (x + half, half, WOOD_HEIGHT),
            0,
            radius=WOOD_POST_BEVEL,
            segments=3,
            sharp=("-z",),
        )
    finish(posts, bm)

    set_slots(leaf, ["Material.Planks", "Material.FenceGate.Hardware"])
    bm = bmesh.new()
    leaf_end = GATE_SPAN - half - GATE_LATCH_GAP
    rail_half = WOOD_RAIL_THICKNESS / 2
    for level in WOOD_RAIL_LEVELS:
        rbox(
            bm,
            (0.0, -rail_half, level - WOOD_RAIL_HEIGHT / 2),
            (leaf_end, rail_half, level + WOOD_RAIL_HEIGHT / 2),
            0,
            radius=WOOD_RAIL_BEVEL,
            segments=3,
        )
    # A stile at the latch end and a diagonal brace tell the leaf from a
    # fence span. The brace is a little thinner, so its ends hide in the rails.
    stile_width = 0.09
    stile_low = WOOD_RAIL_LEVELS[0] - WOOD_RAIL_HEIGHT / 2 - 0.02
    stile_high = WOOD_RAIL_LEVELS[1] + WOOD_RAIL_HEIGHT / 2 + 0.02
    rbox(
        bm,
        (leaf_end - stile_width, -rail_half, stile_low),
        (leaf_end, rail_half, stile_high),
        0,
        radius=WOOD_RAIL_BEVEL,
        segments=3,
    )
    start = Vector((half + 0.03, 0.0, WOOD_RAIL_LEVELS[0]))
    end = Vector((leaf_end - stile_width - 0.02, 0.0, WOOD_RAIL_LEVELS[1]))
    direction = end - start
    length = direction.length
    brace = centred_box(
        bm, (0.0, 0.0, 0.0), (length, 0.055, 0.075), 0, radius=0.025, segments=3
    )
    angle = math.atan2(direction.z, direction.x)
    transform(
        bm,
        brace,
        Matrix.Translation((start + end) / 2) @ Matrix.Rotation(-angle, 4, "Y"),
    )
    # Steel straps by the hinge and a latch band on the stile.
    for level in WOOD_RAIL_LEVELS:
        hardware_band(
            bm,
            half + 0.005,
            half + 0.085,
            0.0,
            level,
            WOOD_RAIL_THICKNESS,
            WOOD_RAIL_HEIGHT,
            1,
        )
    latch_z = sum(WOOD_RAIL_LEVELS) / 2
    hardware_band(
        bm,
        leaf_end - stile_width - 0.012,
        leaf_end + 0.004,
        0.0,
        latch_z,
        WOOD_RAIL_THICKNESS,
        0.012,
        1,
    )
    finish(leaf, bm)


# ------------------------------------------------------- white picket fence
PICKET_WIDTH = 0.19
PICKET_DEPTH = 0.07
PICKET_BODY = 0.58
PICKET_CAP = 0.14
PICKET_BEVEL = 0.024
WHITE_RAIL_DEPTH = 0.05
WHITE_RAIL_HEIGHT = 0.08
WHITE_RAIL_LEVELS = (0.25, 0.45)
WHITE_RAIL_BEVEL = 0.02
PICKET_SPACING = 0.25


def picket(bm, x, y, along_x, slot, width=PICKET_WIDTH, depth=PICKET_DEPTH,
           bottom=0.0, body=PICKET_BODY, cap=PICKET_CAP):
    """One pointed picket with a softly rounded tip, standing on `bottom`."""
    half = width / 2
    shoulder = bottom + body
    profile = [
        (-half, bottom),
        (half, bottom),
        (half, shoulder),
        (0.0, shoulder + cap),
        (-half, shoulder),
    ]
    faces = prism(bm, profile, depth, slot, PICKET_BEVEL, segments=2)
    # Rounding the tip lowers it; stretch back so the picket keeps its height.
    verts = faces_verts(faces)
    top = max(vert.co.z for vert in verts)
    stretch = (body + cap) / (top - bottom)
    for vert in verts:
        vert.co.z = bottom + (vert.co.z - bottom) * stretch
    rotation = Matrix.Identity(4) if along_x else Matrix.Rotation(math.pi / 2, 4, "Z")
    return transform(bm, faces, Matrix.Translation((x, y, 0.0)) @ rotation)


def white_rails(bm, direction, start, end, slot, floor, levels=WHITE_RAIL_LEVELS,
                depth=WHITE_RAIL_DEPTH, offset=0.0):
    dx, dy = direction
    along_x = dx != 0
    for level in levels:
        low = [0.0, 0.0, floor + level - WHITE_RAIL_HEIGHT / 2]
        high = [0.0, 0.0, floor + level + WHITE_RAIL_HEIGHT / 2]
        along = 0 if along_x else 1
        across = 1 - along
        sign = dx if along_x else dy
        low[along] = min(sign * start, sign * end)
        high[along] = max(sign * start, sign * end)
        low[across] = offset - depth / 2
        high[across] = offset + depth / 2
        # Rails sit between pickets on a repeated piece: one bevel segment.
        rbox(bm, low, high, slot, WHITE_RAIL_BEVEL, segments=1)


def build_white_fence(obj, directions):
    set_slots(obj, ["Material.WhitePaint"])
    floor = -1.0
    bm = bmesh.new()
    centre_along_x = not directions or directions[0][0] != 0
    picket(bm, 0.0, 0.0, centre_along_x, 0, bottom=floor)
    if not directions:
        for side in (-1, 1):
            picket(bm, side * PICKET_SPACING, 0.0, True, 0, bottom=floor)
        white_rails(bm, (1, 0), -PICKET_SPACING, PICKET_SPACING, 0, floor)
    for dx, dy in directions:
        for distance in (PICKET_SPACING, 2 * PICKET_SPACING):
            picket(bm, dx * distance, dy * distance, dx != 0, 0, bottom=floor)
        white_rails(bm, (dx, dy), 0.0, 0.5, 0, floor)
    finish(obj, bm)


def restyle_white_fence():
    paint("Material.WhitePaint", "white_paint")
    variants = {
        "WhiteFence_Solo": (),
        "WhiteFence_Single": ((0, 1),),
        "WhiteFence_Middle": ((0, 1), (0, -1)),
        "WhiteFence_Corner": ((1, 0), (0, 1)),
        "WhiteFence_T": ((1, 0), (0, 1), (-1, 0)),
        "WhiteFence_Cross": ((1, 0), (0, 1), (-1, 0), (0, -1)),
    }
    for name, directions in variants.items():
        build_white_fence(bpy.data.objects[name], directions)

    pole = bpy.data.objects["WhiteFence_Pole"]
    set_slots(pole, ["Material.WhitePaint"])
    bm = bmesh.new()
    picket(bm, 0.0, 0.0, True, 0, bottom=-1.0)
    finish(pole, bm)

    extension = bpy.data.objects["WhiteFence_Extension"]
    set_slots(extension, ["Material.WhitePaint"])
    bm = bmesh.new()
    picket(bm, 0.0, 0.75, False, 0, bottom=-1.0)
    white_rails(bm, (0, 1), 0.5, 1.0, 0, -1.0)
    finish(extension, bm)


WHITE_GATE_POST_DEPTH = 0.09
WHITE_LEAF_PICKET = 0.17
WHITE_LEAF_LIFT = 0.04


def restyle_white_fence_gate():
    paint("Material.WhitePaint", "white_paint")
    paint("Material.WhiteFenceGate.Hardware", "steel")
    posts = bpy.data.objects["WhiteFenceGate_Posts"]
    set_slots(posts, ["Material.WhitePaint"])
    bm = bmesh.new()
    for side in (-1, 1):
        picket(
            bm, side * GATE_HALF_WIDTH, 0.0, True, 0, depth=WHITE_GATE_POST_DEPTH
        )
    finish(posts, bm)

    leaf = bpy.data.objects["WhiteFenceGate_Leaf"]
    set_slots(leaf, ["Material.WhitePaint", "Material.WhiteFenceGate.Hardware"])
    bm = bmesh.new()
    post_half = PICKET_WIDTH / 2
    leaf_end = GATE_SPAN - post_half - GATE_LATCH_GAP
    free = leaf_end - post_half
    gap = (free - 3 * WHITE_LEAF_PICKET) / 4
    for index in range(3):
        x = post_half + gap * (index + 1) + WHITE_LEAF_PICKET * (index + 0.5)
        picket(
            bm,
            x,
            0.0,
            True,
            0,
            width=WHITE_LEAF_PICKET,
            bottom=WHITE_LEAF_LIFT,
            body=PICKET_BODY - WHITE_LEAF_LIFT,
        )
    levels = (WHITE_RAIL_LEVELS[0], WHITE_RAIL_LEVELS[1] + 0.02)
    white_rails(bm, (1, 0), 0.0, leaf_end, 0, 0.0, levels=levels)
    for level in levels:
        hardware_band(
            bm, 0.06, 0.16, 0.0, level, WHITE_RAIL_DEPTH, WHITE_RAIL_HEIGHT, 1
        )
    hardware_band(
        bm,
        leaf_end - 0.09,
        leaf_end - 0.01,
        0.0,
        levels[1],
        WHITE_RAIL_DEPTH,
        WHITE_RAIL_HEIGHT,
        1,
    )
    finish(leaf, bm)


# --------------------------------------------------------- rough stone fence
STONE_SLOTS = [
    "Material.StoneFence.Large",
    "Material.StoneFence.Mid",
    "Material.StoneFence.Dark",
]
PILLAR = 0.28
PILLAR_COURSE = 0.2
PILLAR_COURSES = 3
PILLAR_CAP = 0.32
PILLAR_CAP_HEIGHT = 0.08
PILLAR_HEIGHT = PILLAR_COURSE * PILLAR_COURSES + PILLAR_CAP_HEIGHT
STONE_WALL = 0.18
STONE_COURSE = 0.19
STONE_WALL_CAP = 0.2
STONE_WALL_HEIGHT = 0.48
STONE_ARM_START = PILLAR / 2 - 0.02
STONE_BEVEL = 0.035
# Walls repeat on every tile, so their stones take one bevel segment; with
# weighted normals it still shades round at 3.5 pixels. Caps keep two.
STONE_SEGMENTS = 1


def rough_pillar(bm, centre_x, centre_y, floor, slots):
    """Three courses of two rounded stones, laid crosswise, under a cap."""
    order = 0
    for course in range(PILLAR_COURSES):
        along_x = course % 2 == 0
        split = 0.46 if course % 2 == 0 else 0.54
        lengths = (PILLAR * split, PILLAR * (1 - split))
        cursor = -PILLAR / 2
        for length in lengths:
            low = [centre_x - PILLAR / 2, centre_y - PILLAR / 2, floor + course * PILLAR_COURSE]
            high = [centre_x + PILLAR / 2, centre_y + PILLAR / 2, low[2] + PILLAR_COURSE]
            axis = 0 if along_x else 1
            origin = centre_x if along_x else centre_y
            low[axis] = origin + cursor
            high[axis] = origin + cursor + length
            cursor += length
            rbox(
                bm,
                low,
                high,
                slots[order % 3],
                STONE_BEVEL,
                segments=STONE_SEGMENTS,
                sharp=("-z",) if course == 0 else (),
            )
            order += 1
    cap_low = floor + PILLAR_COURSE * PILLAR_COURSES
    rbox(
        bm,
        (centre_x - PILLAR_CAP / 2, centre_y - PILLAR_CAP / 2, cap_low),
        (centre_x + PILLAR_CAP / 2, centre_y + PILLAR_CAP / 2, cap_low + PILLAR_CAP_HEIGHT),
        slots[0],
        0.03,
    )


def rough_arm(bm, direction, start, end, floor, slots, slot_offset=1):
    """Two courses of staggered rounded stones and one long cap stone."""
    dx, dy = direction
    along = 0 if dx != 0 else 1
    across = 1 - along
    sign = dx if dx != 0 else dy
    length = end - start
    order = slot_offset
    for course, split in enumerate((0.48, 0.58)):
        cursor = start
        for part in (split, 1 - split):
            piece = length * part
            low = [0.0, 0.0, floor + course * STONE_COURSE]
            high = [0.0, 0.0, low[2] + STONE_COURSE]
            low[along] = min(sign * cursor, sign * (cursor + piece))
            high[along] = max(sign * cursor, sign * (cursor + piece))
            low[across] = -STONE_WALL / 2
            high[across] = STONE_WALL / 2
            cursor += piece
            rbox(
                bm,
                low,
                high,
                slots[order % 3],
                STONE_BEVEL,
                segments=STONE_SEGMENTS,
                sharp=("-z",) if course == 0 else (),
            )
            order += 1
    cap_low = floor + 2 * STONE_COURSE
    low = [0.0, 0.0, cap_low]
    high = [0.0, 0.0, floor + STONE_WALL_HEIGHT]
    low[along] = min(sign * start, sign * end)
    high[along] = max(sign * start, sign * end)
    low[across] = -STONE_WALL_CAP / 2
    high[across] = STONE_WALL_CAP / 2
    rbox(bm, low, high, slots[order % 3], 0.03)


FENCE_VARIANTS = {
    "Solo": (),
    "Single": ((0, 1),),
    "Middle": ((0, 1), (0, -1)),
    "Corner": ((1, 0), (0, 1)),
    "T": ((1, 0), (0, 1), (-1, 0)),
    "Cross": ((1, 0), (0, 1), (-1, 0), (0, -1)),
}


def restyle_stone_fence():
    for role, name in zip(("stone_light", "stone_mid", "stone_dark"), STONE_SLOTS):
        paint(name, role)
    for shape, directions in FENCE_VARIANTS.items():
        obj = bpy.data.objects[f"StoneFence_{shape}"]
        set_slots(obj, STONE_SLOTS)
        bm = bmesh.new()
        rough_pillar(bm, 0.0, 0.0, -1.0, (0, 1, 2))
        for index, direction in enumerate(directions):
            rough_arm(bm, direction, STONE_ARM_START, 0.5, -1.0, (0, 1, 2), slot_offset=index + 1)
        finish(obj, bm)
    extension = bpy.data.objects["StoneFence_Extension"]
    set_slots(extension, STONE_SLOTS)
    bm = bmesh.new()
    rough_arm(bm, (0, 1), 0.5, 1.0, -1.0, (0, 1, 2))
    finish(extension, bm)


def restyle_stone_fence_gate():
    for role, name in zip(("stone_light", "stone_mid", "stone_dark"), STONE_SLOTS):
        paint(name, role)
    posts = bpy.data.objects["StoneFenceGate_Posts"]
    set_slots(posts, STONE_SLOTS)
    bm = bmesh.new()
    for side in (-1, 1):
        rough_pillar(bm, side * GATE_HALF_WIDTH, 0.0, 0.0, (0, 1, 2))
    finish(posts, bm)

    # The leaf keeps its slot order (mid, dark, large): the runtime draws one
    # primitive per slot.
    leaf = bpy.data.objects["StoneFenceGate_Leaf"]
    leaf_slots = [STONE_SLOTS[1], STONE_SLOTS[2], STONE_SLOTS[0]]
    set_slots(leaf, leaf_slots)
    bm = bmesh.new()
    leaf_end = GATE_SPAN - PILLAR / 2 - GATE_LATCH_GAP
    # Slot indices into the leaf's own order: large=2, mid=0, dark=1.
    rough_arm(bm, (1, 0), 0.0, leaf_end, 0.0, (2, 0, 1))
    finish(leaf, bm)


# ------------------------------------------------------ polished stone fence
POLISHED_PILLAR = 0.28
POLISHED_BODY = 0.25
POLISHED_CAP_HEIGHT = 0.08
POLISHED_WALL = 0.22
POLISHED_WALL_HEIGHT = 0.42
POLISHED_COPING = 0.25
POLISHED_COPING_HEIGHT = 0.06


def polished_pillar(bm, centre_x, centre_y, floor, slot):
    body_top = floor + PILLAR_HEIGHT - POLISHED_CAP_HEIGHT
    half = POLISHED_BODY / 2
    rbox(
        bm,
        (centre_x - half, centre_y - half, floor),
        (centre_x + half, centre_y + half, body_top + 0.01),
        slot,
        0.05,
        segments=2,
        sharp=("-z",),
    )
    half = POLISHED_PILLAR / 2
    rbox(
        bm,
        (centre_x - half, centre_y - half, body_top),
        (centre_x + half, centre_y + half, floor + PILLAR_HEIGHT),
        slot,
        0.035,
        segments=2,
    )


def polished_arm(bm, direction, start, end, floor, slot, cut_start=False):
    """A smooth wall with a coping stone, cut flat where it meets the next tile.

    The far end always continues into the next tile; `cut_start` also cuts
    the near end, for an extension that continues an arm.
    """
    dx, dy = direction
    along = 0 if dx != 0 else 1
    across = 1 - along
    sign = dx if dx != 0 else dy
    far = ("+" if sign > 0 else "-") + "xy"[along]
    near = ("-" if sign > 0 else "+") + "xy"[along]
    for width, low_z, high_z, radius in (
        (POLISHED_WALL, floor, floor + POLISHED_WALL_HEIGHT + 0.01, 0.045),
        (
            POLISHED_COPING,
            floor + POLISHED_WALL_HEIGHT,
            floor + POLISHED_WALL_HEIGHT + POLISHED_COPING_HEIGHT,
            0.03,
        ),
    ):
        low = [0.0, 0.0, low_z]
        high = [0.0, 0.0, high_z]
        low[along] = min(sign * start, sign * end)
        high[along] = max(sign * start, sign * end)
        low[across] = -width / 2
        high[across] = width / 2
        sharp = [far, near] if cut_start else [far]
        if low_z == floor:
            sharp.append("-z")
        rbox(bm, low, high, slot, radius, segments=2, sharp=tuple(sharp))


def restyle_polished_stone_fence():
    paint("Material.PolishedStoneFence.Surface", "limestone")
    for shape, directions in FENCE_VARIANTS.items():
        obj = bpy.data.objects[f"PolishedStoneFence_{shape}"]
        set_slots(obj, ["Material.PolishedStoneFence.Surface"])
        bm = bmesh.new()
        polished_pillar(bm, 0.0, 0.0, -1.0, 0)
        for direction in directions:
            polished_arm(bm, direction, POLISHED_BODY / 2 - 0.03, 0.5, -1.0, 0)
        finish(obj, bm)
    extension = bpy.data.objects["PolishedStoneFence_Extension"]
    set_slots(extension, ["Material.PolishedStoneFence.Surface"])
    bm = bmesh.new()
    # Both ends of an extension meet other spans.
    polished_arm(bm, (0, 1), 0.5, 1.0, -1.0, 0, cut_start=True)
    finish(extension, bm)


def restyle_polished_stone_fence_gate():
    paint("Material.PolishedStoneFence.Surface", "limestone")
    paint("Material.WhitePaint", "white_paint")
    posts = bpy.data.objects["PolishedStoneFenceGate_Posts"]
    set_slots(posts, ["Material.PolishedStoneFence.Surface"])
    bm = bmesh.new()
    for side in (-1, 1):
        polished_pillar(bm, side * GATE_HALF_WIDTH, 0.0, 0.0, 0)
    finish(posts, bm)

    # A painted railing leaf in one material, as before.
    leaf = bpy.data.objects["PolishedStoneFenceGate_Leaf"]
    set_slots(leaf, ["Material.WhitePaint"])
    bm = bmesh.new()
    pillar_half = POLISHED_PILLAR / 2
    leaf_end = GATE_SPAN - pillar_half - GATE_LATCH_GAP
    rail = 0.07
    for level in (0.13, 0.47):
        rbox(bm, (0.0, -0.03, level - rail / 2), (leaf_end, 0.03, level + rail / 2), 0, 0.022)
    bar = 0.055
    first = pillar_half + 0.06
    last = leaf_end - bar / 2 - 0.005
    count = 5
    for index in range(count):
        x = first + (last - first) * index / (count - 1)
        rbox(bm, (x - bar / 2, -bar / 2, 0.06), (x + bar / 2, bar / 2, 0.55), 0, 0.02)
        ball(bm, (x, 0.0, 0.575), 0.045, 0, subdivisions=2)
    for level in (0.13, 0.47):
        cylinder(bm, (pillar_half + 0.012, 0.0, level), 0.03, 0.1, 0, segments=12, bevel=0.01)
    finish(leaf, bm)


# ------------------------------------------------------------ part toolkit
SOURCE_SUFFIX = ".party_source"


def pristine(obj):
    """Restores an object's original mesh, saving it on the first run."""
    name = obj.data.name + SOURCE_SUFFIX
    source = bpy.data.meshes.get(name)
    if source is None:
        source = obj.data.copy()
        source.name = name
        source.use_fake_user = True
        return obj
    bm = bmesh.new()
    bm.from_mesh(source)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.materials.clear()
    for slot in source.materials:
        obj.data.materials.append(slot)
    return obj


def split_components(faces):
    """Groups faces into connected parts."""
    seen = set()
    parts = []
    for seed in faces:
        if seed in seen:
            continue
        seen.add(seed)
        part = [seed]
        stack = [seed]
        while stack:
            face = stack.pop()
            for edge in face.edges:
                for linked in edge.link_faces:
                    if linked not in seen:
                        seen.add(linked)
                        part.append(linked)
                        stack.append(linked)
        parts.append(part)
    return parts


def snap_axis(axis):
    for index in range(3):
        if abs(axis[index]) > 0.9999:
            snapped = Vector((0.0, 0.0, 0.0))
            snapped[index] = 1.0 if axis[index] > 0 else -1.0
            return snapped
    return axis.normalized()


def oriented_bounds(faces):
    """Axes, centre and size of a part, framed on its largest faces."""
    ordered = sorted(faces, key=lambda face: face.calc_area(), reverse=True)
    first = snap_axis(ordered[0].normal.copy())
    second = next(
        (
            face.normal.copy()
            for face in ordered[1:]
            if abs(face.normal.dot(first)) < 0.02 and face.normal.length > 0.5
        ),
        None,
    )
    if second is None:
        return None
    second = snap_axis((second - first * second.dot(first)).normalized())
    third = snap_axis(first.cross(second))
    axes = (first, second, third)
    verts = faces_verts(faces)
    low = [min(vert.co.dot(axis) for vert in verts) for axis in axes]
    high = [max(vert.co.dot(axis) for vert in verts) for axis in axes]
    centre = Vector((0.0, 0.0, 0.0))
    for axis, a, b in zip(axes, low, high):
        centre += axis * ((a + b) / 2)
    return axes, centre, [b - a for a, b in zip(low, high)]


def is_box(faces, bounds):
    """True when a part is a plain, chamfered or rounded box."""
    if bounds is None:
        return False
    axes, centre, size = bounds
    if min(size) <= 0:
        return False
    directions = set()
    aligned_area = 0.0
    for face in faces:
        for index, axis in enumerate(axes):
            dot = face.normal.dot(axis)
            if abs(dot) > 0.999:
                directions.add((index, dot > 0))
                aligned_area += face.calc_area()
    if len(directions) < 6:
        return False
    # A plain box and a box chamfered on every edge have fixed topology.
    if (len(faces_verts(faces)), len(faces)) in ((8, 6), (24, 26)):
        return True
    box_area = 2 * (size[0] * size[1] + size[1] * size[2] + size[0] * size[2])
    if aligned_area < 0.8 * box_area:
        return False
    # Every corner of the part must sit near the surface of its bounds, which
    # rules out L shapes and notched parts.
    tolerance = 0.3 * min(size)
    for vert in faces_verts(faces):
        local = vert.co - centre
        if min(
            size[index] / 2 - abs(local.dot(axis)) for index, axis in enumerate(axes)
        ) > tolerance:
            return False
    return True


def frame_matrix(axes, centre):
    matrix = Matrix((axes[0], axes[1], axes[2])).transposed().to_4x4()
    matrix.translation = centre
    return matrix


def aabb_size(faces):
    verts = faces_verts(faces)
    return [
        max(vert.co[index] for vert in verts) - min(vert.co[index] for vert in verts)
        for index in range(3)
    ]


def rebuild_parts(obj, rule=None, segments=2, radius_scale=1.0, drop=None, bm=None):
    """Rebuilds every box-like part of a mesh as a rounded box.

    Call `pristine(obj)` first. `rule(size, centre, axes)` returns the new
    size, so thin parts can be thickened in place; `segments` is a number or
    a function of the new size; `drop(size)` removes tiny parts that are
    better painted than modelled. Returns the bmesh and the remaining parts.
    """
    if bm is None:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
    boxes = []
    others = []
    for faces in split_components(list(bm.faces)):
        if drop is not None and drop(aabb_size(faces)):
            bmesh.ops.delete(bm, geom=faces_verts(faces), context="VERTS")
            continue
        bounds = oriented_bounds(faces)
        if is_box(faces, bounds):
            boxes.append((faces, bounds, faces[0].material_index))
        else:
            others.append(faces)
    for faces, _, _ in boxes:
        bmesh.ops.delete(bm, geom=faces_verts(faces), context="VERTS")
    for _, (axes, centre, size), slot in boxes:
        if rule is not None:
            size = rule(list(size), centre, axes)
        radius = party_style.bevel_radius_for(min(size)) * radius_scale
        faces = rbox(
            bm,
            [-value / 2 for value in size],
            [value / 2 for value in size],
            slot,
            radius,
            segments(size) if callable(segments) else segments,
        )
        transform(bm, faces, frame_matrix(axes, centre))
    others = [[face for face in faces if face.is_valid] for faces in others]
    return bm, [faces for faces in others if faces]


def round_sharp_edges(bm, faces, radius, segments=2, angle=50):
    """Bevels the hard edges of a part that is not a box, then shades it smooth."""
    limit = math.radians(angle)
    edges = [
        edge
        for edge in faces_edges(faces)
        if len(edge.link_faces) == 2 and edge.calc_face_angle(0) > limit
    ]
    if edges:
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
        faces = [face for face in faces if face.is_valid] + new_faces(bm, before)
    for face in faces:
        face.smooth = True
    return faces


def thickness(faces):
    bounds = oriented_bounds(faces)
    if bounds is not None:
        return min(bounds[2])
    verts = faces_verts(faces)
    return min(
        max(vert.co[index] for vert in verts) - min(vert.co[index] for vert in verts)
        for index in range(3)
    )


def inflate(bm, faces, target):
    """Thickens a thin tube or sheet to `target` by pushing it out along its normals."""
    current = thickness(faces)
    if current >= target - 1e-4:
        return faces
    bm.normal_update()
    offset = (target - current) / 2
    for vert in faces_verts(faces):
        vert.co += vert.normal * offset
    for face in faces:
        face.smooth = True
    return faces


def scale_part(faces, factors, centre=None):
    verts = faces_verts(faces)
    if centre is None:
        centre = sum((vert.co for vert in verts), Vector()) / len(verts)
    for vert in verts:
        offset = vert.co - centre
        vert.co = centre + Vector(
            (offset.x * factors[0], offset.y * factors[1], offset.z * factors[2])
        )


def thicken_min(minimum=0.03, thin=0.05, factor=1.5):
    """Size rule: thin sides grow by `factor` up to `thin`; nothing below `minimum`."""

    def rule(size, centre, axes):
        return [
            max(value, minimum, min(value * factor, thin)) if value < thin else value
            for value in size
        ]

    return rule


def thicken_thinnest(minimum=0.035, thin=0.05, factor=1.5):
    """Size rule for parts laid side by side: only the thinnest side grows."""

    def rule(size, centre, axes):
        index = min(range(3), key=lambda axis: size[axis])
        if size[index] < thin:
            size[index] = max(size[index], minimum, min(size[index] * factor, thin))
        return size

    return rule


# -------------------------------------------------------------------- shade
SHADE_POST = 0.14
SHADE_LINTEL_DEPTH = 0.2
SHADE_LINTEL_HEIGHT = 0.12
SHADE_SLAT_WIDTH = 0.06
SHADE_SLAT_DEPTH = 0.032
# Slats cross at 45 degrees and repeat four times a tile, so halves and
# neighbouring tiles continue one lattice. The phase keeps it symmetric.
SHADE_PERIOD = 0.25
SHADE_PHASE = 0.125


def clip_part(bm, faces, planes):
    """Cuts a part by planes (point, outward normal) and caps the cuts."""
    # Take the faces in mesh order, so the cuts are made in a repeatable order.
    wanted = set(faces)
    faces = [face for face in bm.faces if face in wanted]
    geom = faces_verts(faces) + faces_edges(faces) + faces
    for point, normal in planes:
        result = bmesh.ops.bisect_plane(
            bm,
            geom=geom,
            plane_co=point,
            plane_no=normal,
            clear_outer=True,
        )
        geom = [element for element in result["geom"] if element.is_valid]
        cut_edges = [
            element
            for element in result["geom_cut"]
            if isinstance(element, bmesh.types.BMEdge) and element.is_valid
        ]
        boundary = [edge for edge in cut_edges if edge.is_boundary]
        if boundary:
            filled = bmesh.ops.holes_fill(bm, edges=boundary, sides=0)
            geom += filled["faces"]
    return [element for element in geom if isinstance(element, bmesh.types.BMFace) and element.is_valid]


def shade_lattice(bm, along_x, start, end, slot, bottom=-1.0, top=-0.02):
    """Two layers of crossing slats between `start` and `end` along the panel."""
    for direction, layer in ((1, 1), (-1, -1)):
        # Lines u - direction * v = c, with v measured from the ground.
        lowest = start - 1.0 - SHADE_PERIOD
        c = SHADE_PHASE + math.floor((lowest - SHADE_PHASE) / SHADE_PERIOD) * SHADE_PERIOD
        while c < end + 1.0 + SHADE_PERIOD:
            length = 1.6
            faces = centred_box(
                bm,
                (0.0, 0.0, 0.0),
                (length, SHADE_SLAT_DEPTH, SHADE_SLAT_WIDTH),
                slot,
                radius=0.016,
                segments=2,
            )
            # Centre the slat where its line crosses mid height.
            mid_v = (top - bottom) / 2
            u = c + direction * mid_v
            rotation = Matrix.Rotation(-direction * math.pi / 4, 4, "Y")
            offset = Vector((u, layer * SHADE_SLAT_DEPTH / 2, bottom + mid_v))
            transform(bm, faces, Matrix.Translation(offset) @ rotation)
            if not along_x:
                transform(bm, faces, Matrix.Rotation(math.pi / 2, 4, "Z"))
            axis = Vector((1, 0, 0)) if along_x else Vector((0, 1, 0))
            clipped = clip_part(
                bm,
                faces,
                [
                    (axis * end, axis),
                    (axis * start, -axis),
                    (Vector((0, 0, top)), Vector((0, 0, 1))),
                    (Vector((0, 0, bottom)), Vector((0, 0, -1))),
                ],
            )
            party_style.assign(clipped, slot)
            c += SHADE_PERIOD


def shade_lintel(bm, along_x, start, end, slot, rounded_start, rounded_end, grow=0.0):
    axis = 0 if along_x else 1
    low = [0.0, 0.0, -SHADE_LINTEL_HEIGHT / 2]
    high = [0.0, 0.0, SHADE_LINTEL_HEIGHT / 2]
    low[axis], high[axis] = start, end
    low[1 - axis] = -SHADE_LINTEL_DEPTH / 2 - grow
    high[1 - axis] = SHADE_LINTEL_DEPTH / 2 + grow
    name = "xy"[axis]
    sharp = []
    if not rounded_start:
        sharp.append(f"-{name}")
    if not rounded_end:
        sharp.append(f"+{name}")
    rbox(bm, low, high, slot, 0.04, segments=2, sharp=tuple(sharp))


def shade_post(bm, x, y, slot):
    half = SHADE_POST / 2
    rbox(bm, (x - half, y - half, -1.0), (x + half, y + half, 0.0), slot, 0.04, sharp=("-z",))


def restyle_shade():
    # Half lintels end flat at the tile centre and at shared tile edges, so a
    # straight run reads as one beam; a corner or junction adds the middle
    # post with its cap block.
    pieces = {
        "Shade Solo": ("x", (-0.35, 0.35), (-0.5, 0.5), (True, True), (-0.4, 0.4)),
        "Shade Single Left": ("x", (-0.35, 0.0), (-0.5, 0.0), (True, False), (-0.4,)),
        "Shade Single Right": ("x", (0.0, 0.35), (0.0, 0.5), (False, True), (0.4,)),
        "Shade N": ("x", (-0.5, 0.0), (-0.5, 0.0), (False, False), ()),
        "Shade S": ("x", (0.0, 0.5), (0.0, 0.5), (False, False), ()),
        "Shade E": ("y", (0.0, 0.5), (0.0, 0.5), (False, False), ()),
        "Shade W": ("y", (-0.5, 0.0), (-0.5, 0.0), (False, False), ()),
    }
    for name, (axis, lattice, lintel, rounded, posts) in pieces.items():
        obj = bpy.data.objects[name]
        set_slots(obj, ["Material.Planks"])
        bm = bmesh.new()
        along_x = axis == "x"
        shade_lattice(bm, along_x, lattice[0], lattice[1], 0)
        shade_lintel(bm, along_x, lintel[0], lintel[1], 0, *rounded)
        for x in posts:
            shade_post(bm, x, 0.0, 0)
        finish(obj, bm)
    middle = bpy.data.objects["Shade Middle"]
    set_slots(middle, ["Material.Planks"])
    bm = bmesh.new()
    shade_post(bm, 0.0, 0.0, 0)
    cap = SHADE_LINTEL_DEPTH + 0.03
    rbox(
        bm,
        (-cap / 2, -cap / 2, -SHADE_LINTEL_HEIGHT / 2 - 0.012),
        (cap / 2, cap / 2, SHADE_LINTEL_HEIGHT / 2 + 0.02),
        0,
        0.045,
    )
    finish(middle, bm)


# --------------------------------------------------------------- composter
COMPOSTER_POST = 0.14
COMPOSTER_HALF = 0.4
COMPOSTER_HEIGHT = 0.61
COMPOSTER_BOARD = 0.1
COMPOSTER_BOARD_INSET = 0.02
COMPOSTER_BOARD_GAP = 0.016


def restyle_composter():
    obj = bpy.data.objects["Composter"]
    paint_albedo("Material.Dirt", *BED_SOIL_ALBEDO)
    # The runtime draws primitive one as soil and two as planks.
    set_slots(obj, ["Material.Dirt", "Material.Planks"])
    bm = bmesh.new()
    post_centre = COMPOSTER_HALF - COMPOSTER_POST / 2
    for sx in (-1, 1):
        for sy in (-1, 1):
            centred_box(
                bm,
                (sx * post_centre, sy * post_centre, COMPOSTER_HEIGHT / 2),
                (COMPOSTER_POST, COMPOSTER_POST, COMPOSTER_HEIGHT),
                1,
                0.045,
                sharp=("-z",),
            )
    board_height = (COMPOSTER_HEIGHT - 0.03 - 2 * COMPOSTER_BOARD_GAP) / 3
    outer = COMPOSTER_HALF - COMPOSTER_BOARD_INSET
    inner = outer - COMPOSTER_BOARD
    reach = post_centre
    for axis in (0, 1):
        for sign in (-1, 1):
            for level in range(3):
                bottom = level * (board_height + COMPOSTER_BOARD_GAP)
                low = [0.0, 0.0, bottom]
                high = [0.0, 0.0, bottom + board_height]
                low[axis] = min(sign * outer, sign * inner)
                high[axis] = max(sign * outer, sign * inner)
                low[1 - axis] = -reach
                high[1 - axis] = reach
                rbox(bm, low, high, 1, 0.03, sharp=("-z",) if level == 0 else ())
    # One soft mound of compost instead of loose cubes.
    mound = party_style.add_blob(
        bm, (0.0, 0.0, 0.3), (0.3, 0.3, 0.27), subdivisions=3, bump=0.05, seed=2.3, floor=0.0
    )
    party_style.assign(mound, 0)
    finish(obj, bm)


# --------------------------------------------------------------- water well
WELL_STONE_INNER = 0.3
WELL_STONE_OUTER = 0.44
WELL_COURSE = 0.22
WELL_STONES_PER_COURSE = 7
WELL_STONE_GAP = 0.012
WELL_ROOF_BOARDS = 3
WELL_ROOF_GAP = 0.016
WELL_ROOF_THICKNESS = 0.07


def well_stone_ring():
    """Two courses of wedge stones, staggered, one tone per stone."""
    objects = [
        bpy.data.objects[name]
        for name in ("WaterWell_Stone_Light", "WaterWell_Stone_Mid", "WaterWell_Stone_Dark")
    ]
    meshes = {obj.name: bmesh.new() for obj in objects}
    middle = (WELL_STONE_INNER + WELL_STONE_OUTER) / 2
    step = math.tau / WELL_STONES_PER_COURSE
    half_length = middle * math.tan(step / 2) - WELL_STONE_GAP / 2
    order = 0
    for course in range(2):
        for index in range(WELL_STONES_PER_COURSE):
            obj = objects[order % 3]
            order += 1
            bm = meshes[obj.name]
            faces = rbox(
                bm,
                (WELL_STONE_INNER, -half_length, course * WELL_COURSE),
                (WELL_STONE_OUTER, half_length, (course + 1) * WELL_COURSE),
                0,
                0.035,
                sharp=("-z",) if course == 0 else (),
            )
            # Taper along radial lines so the stones close into a ring.
            for vert in faces_verts(faces):
                vert.co.y *= vert.co.x / middle
            angle = (index + 0.5 * course) * step
            transform(bm, faces, Matrix.Rotation(angle, 4, "Z"))
    for obj in objects:
        finish(obj, meshes[obj.name])


def well_roof_boards(bm):
    """Merges the narrow roof planks into a few wide boards per side."""
    planks = []
    for faces in split_components(list(bm.faces)):
        bounds = oriented_bounds(faces)
        if not is_box(faces, bounds):
            continue
        ordered = sorted(bounds[2])
        if abs(ordered[1] - 0.105) < 0.01 and ordered[2] > 0.5:
            planks.append((faces, bounds))
    sides = {}
    for faces, bounds in planks:
        sides.setdefault(bounds[1].x > 0, []).append(bounds)
        bmesh.ops.delete(bm, geom=faces_verts(faces), context="VERTS")
    for items in sides.values():
        axes, centre, size = items[0]
        width_axis = max(range(3), key=lambda index: abs(axes[index].y))
        thick_axis = min(range(3), key=lambda index: size[index])
        long_axis = 3 - width_axis - thick_axis
        ys = [item[1].y for item in items]
        low = min(ys) - size[width_axis] / 2
        high = max(ys) + size[width_axis] / 2
        width = (high - low - (WELL_ROOF_BOARDS - 1) * WELL_ROOF_GAP) / WELL_ROOF_BOARDS
        for board in range(WELL_ROOF_BOARDS):
            board_centre = centre.copy()
            board_centre.y = low + width / 2 + board * (width + WELL_ROOF_GAP)
            board_size = list(size)
            board_size[width_axis] = width
            board_size[thick_axis] = WELL_ROOF_THICKNESS
            board_size[long_axis] += 0.03
            faces = rbox(
                bm,
                [-value / 2 for value in board_size],
                [value / 2 for value in board_size],
                0,
                0.0,
            )
            transform(bm, faces, frame_matrix(axes, board_centre))


def restyle_water_well():
    paint("Material.Stone", "stone_mid")
    paint("Material.Stone.001", "stone_light")
    paint("Material.Stone.002", "stone_dark")
    paint("Material.WaterWell.Rope", "rope")
    paint("Material.Water", "water")
    well_stone_ring()

    frame = pristine(bpy.data.objects["WaterWell_Wood_Frame"])
    bm = bmesh.new()
    bm.from_mesh(frame.data)
    well_roof_boards(bm)

    def frame_rule(size, centre, axes):
        # Roof boards are already sized; posts, beams, braces and the ridge
        # grow by half.
        if sorted(size)[1] > 0.2:
            return size
        return [value * 1.5 if value < 0.09 else value for value in size]

    def frame_segments(size):
        return 2 if min(size) > 0.1 or sorted(size)[1] > 0.2 else 1

    bm, others = rebuild_parts(frame, rule=frame_rule, segments=frame_segments, bm=bm)
    for faces in others:
        round_sharp_edges(bm, faces, 0.012)
    finish(frame, bm)

    rope = pristine(bpy.data.objects["WaterWell_Rope"])
    bm = bmesh.new()
    bm.from_mesh(rope.data)
    for faces in split_components(list(bm.faces)):
        span = aabb_size(faces)
        if span[2] > 0.2:
            # The hanging rope: thicker around its vertical axis.
            factor = 0.034 / span[0]
            scale_part(faces, (factor, factor, 1.0))
        else:
            # The coil on the axle: wider along the axle.
            scale_part(faces, (0.055 / span[0], 1.0, 1.0))
        for face in faces:
            face.smooth = True
    finish(rope, bm)

    # The water is a thin flat disc: flat shading keeps its top facing up,
    # where smooth shading would tilt it toward the rim.
    water = bpy.data.objects["WaterWell_Water"]
    for polygon in water.data.polygons:
        polygon.use_smooth = False


# --------------------------------------------------------------- garden box
def thin_board_segments(size):
    return 1 if min(size) < 0.055 else 2


def restyle_garden_box():
    for name in ("GardenBox_Body_Planks", "GardenBox_Lid_HingeOrigin"):
        obj = pristine(bpy.data.objects[name])
        bm, others = rebuild_parts(
            obj, rule=thicken_min(0.035, 0.05), segments=thin_board_segments
        )
        for faces in others:
            round_sharp_edges(bm, faces, 0.012)
        finish(obj, bm)


# ----------------------------------------------------- outlet display table
def restyle_outlet_display_table():
    paint("Material.OutletDisplayTable.HoneyWood", "honey_wood")
    wood("Material.OutletDisplayTable.DeepWood")
    paint("Material.OutletDisplayTable.GoldenWood", "golden_wood")
    for name in (
        "OutletDisplayTable_TopPlanks",
        "OutletDisplayTable_Frame",
        "OutletDisplayTable_LowerShelf",
    ):
        obj = pristine(bpy.data.objects[name])
        bm, others = rebuild_parts(obj, rule=thicken_min(0.035, 0.08), segments=2)
        if others:
            raise RuntimeError(f"{name}: unexpected non-box parts")
        finish(obj, bm)


# -------------------------------------------------------------- arrow sign
ARROW_LENGTH = 0.8
ARROW_HEIGHT = 0.52
ARROW_TAIL_HEIGHT = 0.3
ARROW_HEAD_LENGTH = 0.3
ARROW_DEPTH = 0.08


def restyle_arrow_sign():
    wood("Material.ArrowSign.WarmWood")
    paint("Material.ArrowSign.DeepWood", "trunk")
    paint("Material.ArrowSign.Color", "sign_green")

    post = bpy.data.objects["ArrowSign_Post"]
    set_slots(post, ["Material.ArrowSign.WarmWood"])
    bm = bmesh.new()
    rbox(bm, (-0.06, -0.06, 0.0), (0.06, 0.06, 0.8), 0, 0.04, segments=2, sharp=("-z",))
    finish(post, bm)

    # The plaque turns about its centre for each direction, so its bounds stay
    # centred on the object origin.
    arrow = bpy.data.objects["ArrowSign_Arrow"]
    set_slots(arrow, ["Material.ArrowSign.Color"])
    bm = bmesh.new()
    half = ARROW_LENGTH / 2
    neck = half - ARROW_HEAD_LENGTH
    tail = ARROW_TAIL_HEIGHT / 2
    head = ARROW_HEIGHT / 2
    profile = [
        (-half, -tail),
        (neck, -tail),
        (neck, -head),
        (half, 0.0),
        (neck, head),
        (neck, tail),
        (-half, tail),
    ]
    faces = prism(bm, profile, ARROW_DEPTH, 0, 0.03, segments=2, sharp_bottom=False)
    verts = faces_verts(faces)
    xs = [vert.co.x for vert in verts]
    shift = -(min(xs) + max(xs)) / 2
    zs = [vert.co.z for vert in verts]
    stretch = ARROW_HEIGHT / (max(zs) - min(zs))
    for vert in verts:
        vert.co.x += shift
        vert.co.z *= stretch
    finish(arrow, bm)

    fastener = bpy.data.objects["ArrowSign_Fastener"]
    set_slots(fastener, ["Material.ArrowSign.DeepWood"])
    bm = bmesh.new()
    # A chunky bolt head on the front of the plaque.
    cylinder(bm, (0.0, 0.0, 0.0), 0.048, 0.036, 0, segments=16, bevel=0.012, axis="Y")
    finish(fastener, bm)


# ------------------------------------------------------------- wooden sign
SIGN_CENTRE = 0.93
SIGN_FRAME_WIDTH = 0.88
SIGN_FRAME_HEIGHT = 0.46
SIGN_FRAME_BAR = 0.075
SIGN_FRAME_DEPTH = 0.12
SIGN_BOARD_DEPTH = 0.065


def restyle_wooden_sign():
    wood("Material.WoodenSign.WarmWood")
    paint("Material.WoodenSign.BoardWood", "board_wood")
    paint("Material.WoodenSign.DeepWood", "trunk")
    objects = {name: bpy.data.objects[f"WoodenSign_{name}"] for name in ("Post", "Board", "Frame", "Fasteners")}

    def local(obj, point):
        return Vector(point) - obj.location

    post = objects["Post"]
    set_slots(post, ["Material.WoodenSign.WarmWood"])
    bm = bmesh.new()
    board_bottom = SIGN_CENTRE - (SIGN_FRAME_HEIGHT / 2 - SIGN_FRAME_BAR) - 0.01
    low = local(post, (-0.065, -0.06, 0.0))
    high = local(post, (0.065, 0.06, board_bottom))
    rbox(bm, low, high, 0, 0.04, sharp=("-z",))
    finish(post, bm)

    board = objects["Board"]
    set_slots(board, ["Material.WoodenSign.BoardWood"])
    bm = bmesh.new()
    inner_w = SIGN_FRAME_WIDTH / 2 - SIGN_FRAME_BAR + 0.02
    inner_h = SIGN_FRAME_HEIGHT / 2 - SIGN_FRAME_BAR + 0.01
    rbox(
        bm,
        local(board, (-inner_w, -SIGN_BOARD_DEPTH / 2, SIGN_CENTRE - inner_h)),
        local(board, (inner_w, SIGN_BOARD_DEPTH / 2, SIGN_CENTRE + inner_h)),
        0,
        0.02,
    )
    finish(board, bm)

    frame = objects["Frame"]
    set_slots(frame, ["Material.WoodenSign.WarmWood"])
    bm = bmesh.new()
    half_w = SIGN_FRAME_WIDTH / 2
    half_h = SIGN_FRAME_HEIGHT / 2
    depth = SIGN_FRAME_DEPTH / 2
    for z_sign in (-1, 1):
        z_outer = SIGN_CENTRE + z_sign * half_h
        z_inner = z_outer - z_sign * SIGN_FRAME_BAR
        rbox(
            bm,
            local(frame, (-half_w, -depth, min(z_outer, z_inner))),
            local(frame, (half_w, depth, max(z_outer, z_inner))),
            0,
            0.032,
        )
    for x_sign in (-1, 1):
        x_outer = x_sign * (half_w - 0.005)
        x_inner = x_outer - x_sign * SIGN_FRAME_BAR
        rbox(
            bm,
            local(frame, (min(x_outer, x_inner), -depth + 0.006, SIGN_CENTRE - half_h + 0.02)),
            local(frame, (max(x_outer, x_inner), depth - 0.006, SIGN_CENTRE + half_h - 0.02)),
            0,
            0.032,
        )
    finish(frame, bm)

    fasteners = objects["Fasteners"]
    set_slots(fasteners, ["Material.WoodenSign.DeepWood"])
    bm = bmesh.new()
    bolt_z = SIGN_CENTRE + half_h - SIGN_FRAME_BAR / 2
    for x in (-0.34, 0.34):
        cylinder(
            bm,
            local(fasteners, (x, -depth - 0.012, bolt_z)),
            0.026,
            0.03,
            0,
            segments=12,
            bevel=0.01,
            axis="Y",
        )
    finish(fasteners, bm)


# --------------------------------------------------------- moon rain barrel
# A round, gently bulged barrel of 12 staves with modelled seams, and two
# continuous hoops (it was 8 flat staves and hoops of 8 straight segments).
BARREL_STAVES = 12
# Each stave spans 30 degrees: a seam, two narrow seam walls and a curved face.
BARREL_STAVE_COLUMNS = (0.0, 1.6, 15.0, 28.4)
BARREL_SEAM_DEPTH = 0.008
BARREL_BOTTOM = 0.08
BARREL_TOP = 0.78
BARREL_END_RADIUS = 0.288
BARREL_BULGE = 0.022
BARREL_RIM = 0.062
BARREL_FLOOR = 0.68
BARREL_HOOPS = (0.22, 0.59)
BARREL_HOOP_THICKNESS = 0.048


def barrel_radius(z):
    t = (z - BARREL_BOTTOM) / (BARREL_TOP - BARREL_BOTTOM)
    return BARREL_END_RADIUS + BARREL_BULGE * math.sin(math.pi * t)


def barrel_staves(bm):
    """The body as one lathe: outside, a rolled rim, the inside wall down to a
    floor just under the water, and a closed bottom."""
    top = barrel_radius(BARREL_TOP)
    # (radius, height, seam direction): seams cut inward outside, outward
    # inside and down across the rim.
    profile = [
        (barrel_radius(BARREL_BOTTOM), BARREL_BOTTOM, (-1, 0)),
        (barrel_radius(0.32), 0.32, (-1, 0)),
        (barrel_radius(0.56), 0.56, (-1, 0)),
        (barrel_radius(0.745), 0.745, (-1, 0)),
        (top - 0.014, BARREL_TOP - 0.007, (-0.7, -0.7)),
        (top - BARREL_RIM / 2, BARREL_TOP, (0, -1)),
        (top - BARREL_RIM + 0.004, BARREL_TOP - 0.015, (0.7, -0.7)),
        (top - BARREL_RIM, BARREL_FLOOR, (1, 0)),
    ]
    angles = [
        math.radians(stave * 360.0 / BARREL_STAVES + column)
        for stave in range(BARREL_STAVES)
        for column in BARREL_STAVE_COLUMNS
    ]
    count = len(angles)
    seam = len(BARREL_STAVE_COLUMNS)
    rows = []
    for radius, z, (push_r, push_z) in profile:
        row = []
        for index, angle in enumerate(angles):
            r, height = radius, z
            if index % seam == 0:
                r += push_r * BARREL_SEAM_DEPTH
                height += push_z * BARREL_SEAM_DEPTH
            row.append(bm.verts.new((r * math.cos(angle), r * math.sin(angle), height)))
        rows.append(row)
    faces = []
    for lower, upper in zip(rows, rows[1:]):
        for index in range(count):
            following = (index + 1) % count
            faces.append(
                bm.faces.new((lower[index], lower[following], upper[following], upper[index]))
            )
    caps = [bm.faces.new(rows[0][::-1]), bm.faces.new(rows[-1])]
    faces += caps
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    # The seams and both discs keep crisp normals.
    for lower, upper in zip(rows, rows[1:]):
        for index in range(0, count, seam):
            edge = bm.edges.get((lower[index], upper[index]))
            if edge is not None:
                edge.smooth = False
    mark_sharp(caps)
    party_style.assign(faces, 0)
    return faces


def torus(bm, centre_z, major, minor, slot, segments=24, sides=6):
    rings = []
    for step in range(segments):
        angle = math.tau * step / segments
        direction = Vector((math.cos(angle), math.sin(angle), 0.0))
        ring = []
        for side in range(sides):
            around = math.tau * side / sides
            offset = direction * (major + minor * math.cos(around))
            ring.append(bm.verts.new((offset.x, offset.y, centre_z + minor * math.sin(around))))
        rings.append(ring)
    faces = []
    for step in range(segments):
        ring, following = rings[step], rings[(step + 1) % segments]
        for side in range(sides):
            nxt = (side + 1) % sides
            faces.append(bm.faces.new((ring[side], following[side], following[nxt], ring[nxt])))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    party_style.assign(faces, slot)
    return faces


def restyle_moon_rain_barrel():
    wood("Material.MoonRainBarrel.Wood")
    paint("Material.MoonRainBarrel.Zinc", "steel")
    paint("Material.MoonRainBarrel.Brass", "brass")
    paint("Material.MoonRainBarrel.Leaf", "leaf")
    paint("Material.MoonRainBarrel.Limestone", "limestone")
    paint("Material.MoonRainBarrel.MoonStone", "moonstone")
    paint("Material.MoonRainBarrel.Water", "water")

    # Continuous hoops, sunk a little into the staves; the rivets are gone
    # (smaller than the 0.03 minimum).
    bands = bpy.data.objects["MoonRainBarrel_Bands"]
    set_slots(bands, ["Material.MoonRainBarrel.Zinc"])
    bm = bmesh.new()
    minor = BARREL_HOOP_THICKNESS / 2
    for z in BARREL_HOOPS:
        torus(bm, z, barrel_radius(z) + minor - 0.014, minor, 0)
    finish(bands, bm)

    for name, rule, segments in (
        ("MoonRainBarrel_Lid", thicken_thinnest(0.035, 0.05), 1),
        ("MoonRainBarrel_LimestoneFeet", None, 2),
    ):
        obj = pristine(bpy.data.objects[name])
        bm, others = rebuild_parts(obj, rule=rule, segments=segments)
        for faces in others:
            round_sharp_edges(bm, faces, 0.015)
        finish(obj, bm)

    staves = bpy.data.objects["MoonRainBarrel_Staves"]
    set_slots(staves, ["Material.MoonRainBarrel.Wood"])
    bm = bmesh.new()
    barrel_staves(bm)
    finish(staves, bm)

    for name, target, radius in (
        ("MoonRainBarrel_Tap", 0.032, 0.008),
        ("MoonRainBarrel_Leaf", 0.03, 0.006),
        ("MoonRainBarrel_MoonStone", 0.03, 0.006),
    ):
        obj = pristine(bpy.data.objects[name])
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        for faces in split_components(list(bm.faces)):
            faces = inflate(bm, faces, target)
            round_sharp_edges(bm, faces, radius)
        finish(obj, bm)

    # The water's octagon reaches just under the round inside wall, so no
    # sliver opens between them.
    water = bpy.data.objects["MoonRainBarrel_Water"]
    inside = barrel_radius(BARREL_TOP) - BARREL_RIM
    corner = max(Vector((vert.co.x, vert.co.y)).length for vert in water.data.vertices)
    grow = (inside + 0.004) / (corner * math.cos(math.pi / 8))
    for vert in water.data.vertices:
        vert.co.x *= grow
        vert.co.y *= grow
    # A thin flat slab: flat shading keeps its top facing up.
    for polygon in water.data.polygons:
        polygon.use_smooth = False
    water.data.update()


# -------------------------------------------------------- hazel light arch
# Structural timber is at least 0.12 thick (GAME_ART.md); the posts were 0.1.
HAZEL_POLE_WIDTH = 0.12


def tube_axis(faces):
    """Centre, unit axis and half length of a round pole part."""
    verts = faces_verts(faces)
    centre = sum((vert.co for vert in verts), Vector()) / len(verts)
    size = aabb_size(faces)
    axis = Vector((0.0, 0.0, 0.0))
    axis[max(range(3), key=lambda index: size[index])] = 1.0
    # Power iteration on the spread of the vertices finds the long axis.
    for _ in range(32):
        spread = Vector((0.0, 0.0, 0.0))
        for vert in verts:
            offset = vert.co - centre
            spread += offset * offset.dot(axis)
        axis = spread.normalized()
    half = max(abs((vert.co - centre).dot(axis)) for vert in verts)
    return centre, axis, half


def distance_to_axis(point, tube):
    centre, axis, half = tube
    offset = point - centre
    along = max(-half, min(half, offset.dot(axis)))
    return (offset - axis * along).length


def grow_about_axis(verts, tube, factor):
    centre, axis, _ = tube
    for vert in verts:
        offset = vert.co - centre
        along = axis * offset.dot(axis)
        vert.co = centre + along + (offset - along) * factor


def restyle_hazel_light_arch():
    wood("Material.HazelLightArch.HazelWood")
    paint("Material.HazelLightArch.Terracotta", "terracotta")
    paint("Material.HazelLightArch.DarkCord", "rope")
    # Bulbs are drawn with their own emissive material at runtime.
    party_style.set_surface(material("Material.HazelLightArch.Glow"), 0.3)

    # Every round pole grows by the same factor about its own axis, so the
    # posts reach the 0.12 timber minimum and the beams and braces keep their
    # proportion. The cord bindings around them grow with them. The whole
    # frame then narrows and lowers slightly so the posts' outer faces and
    # the top of the beam stay where they were.
    poles = pristine(bpy.data.objects["HazelLightArch_Poles"])
    bm = bmesh.new()
    bm.from_mesh(poles.data)
    pole_parts = split_components(list(bm.faces))
    reach = max(abs(vert.co.y) for vert in bm.verts)
    top = max(vert.co.z for vert in bm.verts)
    factor = HAZEL_POLE_WIDTH / max(aabb_size(faces)[0] for faces in pole_parts)
    tubes = [tube_axis(faces) for faces in pole_parts]
    for faces, tube in zip(pole_parts, tubes):
        grow_about_axis(faces_verts(faces), tube, factor)
    narrow = reach / max(abs(vert.co.y) for vert in bm.verts)
    lower = top / max(vert.co.z for vert in bm.verts)
    for vert in bm.verts:
        vert.co.y *= narrow
        vert.co.z *= lower
    for faces in pole_parts:
        round_sharp_edges(bm, faces, 0.014, angle=70)
    finish(poles, bm)

    # Cords and the shade rims grow to the 0.03 minimum.
    for name, target, follow_poles in (
        ("HazelLightArch_Cords", 0.03, True),
        ("HazelLightArch_TerracottaShades", 0.03, False),
        ("HazelLightArch_Bulbs", 0.0, False),
    ):
        obj = pristine(bpy.data.objects[name])
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        for faces in split_components(list(bm.faces)):
            if follow_poles:
                verts = faces_verts(faces)
                centre = sum((vert.co for vert in verts), Vector()) / len(verts)
                nearest = min(tubes, key=lambda tube: distance_to_axis(centre, tube))
                grow_about_axis(verts, nearest, factor)
                for vert in verts:
                    vert.co.y *= narrow
                    vert.co.z *= lower
            if target:
                faces = inflate(bm, faces, target)
            for face in faces:
                face.smooth = True
        finish(obj, bm)


RESTYLERS = {
    "FenceGate.blend": restyle_fence_gate,
    "WhiteFence.blend": restyle_white_fence,
    "WhiteFenceGate.blend": restyle_white_fence_gate,
    "StoneFence.blend": restyle_stone_fence,
    "StoneFenceGate.blend": restyle_stone_fence_gate,
    "PolishedStoneFence.blend": restyle_polished_stone_fence,
    "PolishedStoneFenceGate.blend": restyle_polished_stone_fence_gate,
    "Shade.blend": restyle_shade,
    "WaterWell.blend": restyle_water_well,
    "Composter.blend": restyle_composter,
    "GardenBox.blend": restyle_garden_box,
    "OutletDisplayTable.blend": restyle_outlet_display_table,
    "ArrowSign.blend": restyle_arrow_sign,
    "WoodenSign.blend": restyle_wooden_sign,
    "MoonRainBarrel.blend": restyle_moon_rain_barrel,
    "HazelLightArch.blend": restyle_hazel_light_arch,
}


# ------------------------------------------------------------------- export
def read_glb(path):
    data = path.read_bytes()
    json_length = struct.unpack_from("<I", data, 12)[0]
    document = json.loads(data[20 : 20 + json_length])
    return document, data[20 + json_length :]


def write_glb(path, document, rest):
    payload = json.dumps(document, separators=(",", ":")).encode("utf-8")
    payload += b" " * (-len(payload) % 4)
    header = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(payload) + len(rest))
    path.write_bytes(header + struct.pack("<II", len(payload), 0x4E4F534A) + payload + rest)


def sync_shared_planks(path):
    reference, _ = read_glb(MODELS_DIR / SHARED_PLANKS[0])
    factor = next(
        material["pbrMetallicRoughness"]["baseColorFactor"]
        for material in reference["materials"]
        if material["name"] == SHARED_PLANKS[1]
    )
    document, rest = read_glb(path)
    changed = False
    for material in document.get("materials", []):
        if material["name"] == SHARED_PLANKS[1]:
            material["pbrMetallicRoughness"]["baseColorFactor"] = factor
            changed = True
    if changed:
        write_glb(path, document, rest)


def export_assets(names):
    """Exports in scene order with the shared plank factor (see the docstring)."""
    from io_scene_gltf2.blender.exp import tree

    tree._sort_by_name = list
    argv = sys.argv
    sys.argv = [argv[0], "--"] + [arg for name in names for arg in ("--asset", name)]
    try:
        runpy.run_path(str(EXPORT_SCRIPT), run_name="__main__")
    finally:
        sys.argv = argv
    for name in names:
        sync_shared_planks(MODELS_DIR / f"{name}.glb")


def check_metalness():
    for mat in bpy.data.materials:
        shader = party_style.principled(mat) if mat.users else None
        if shader is not None and shader.inputs["Metallic"].default_value != 0:
            party_style.set_surface(mat, shader.inputs["Roughness"].default_value)


def report(file_name):
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            print(
                f"  {obj.name}: tris={party_style.evaluated_triangles(obj)} "
                f"dims={tuple(round(d, 3) for d in obj.dimensions)}"
            )
    for mat in bpy.data.materials:
        if mat.users:
            print("  " + party_style.describe_material(mat))


def main():
    args = parse_args()
    wanted = {f"{name}.blend" for name in args.asset}
    for file_name, restyle in RESTYLERS.items():
        if wanted and file_name not in wanted:
            continue
        path = ASSETS_DIR / file_name
        bpy.ops.wm.open_mainfile(filepath=str(path))
        restyle()
        check_metalness()
        bpy.ops.wm.save_mainfile(filepath=str(path))
        print(f"Restyled {file_name}")
        report(file_name)
        backup = path.with_suffix(".blend1")
        if backup.exists():
            backup.unlink()
    if args.export:
        export_assets(
            [
                Path(file_name).stem
                for file_name in RESTYLERS
                if not wanted or file_name in wanted
            ]
        )


if __name__ == "__main__":
    main()
