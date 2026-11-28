"""Shared helpers for restyling game models to the look in GAME_ART.md.

Import from a Blender script in this folder:

    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import party_style

Colour helpers convert between the authored albedo and the colour a sunlit
top face shows on screen. The scene lights that face to about 3.2 times its
albedo and then applies Khronos neutral tone mapping; `albedo_to_screen` and
`screen_to_albedo` model exactly that. The fit reproduces the core palette in
`generate-party-core.py` to within a few sRGB steps.
"""

import math

try:
    import bmesh
    import bpy
    from mathutils import Matrix, Vector
except ImportError:  # Colour helpers also run outside Blender.
    bmesh = bpy = Matrix = Vector = None

# Measured from the core palette: sunlit top face radiance / albedo.
SUNLIT_GAIN = 3.2


# ------------------------------------------------------------------ colour
def srgb_to_linear(channel):
    return (
        channel / 12.92
        if channel <= 0.04045
        else ((channel + 0.055) / 1.055) ** 2.4
    )


def linear_to_srgb(channel):
    channel = min(1.0, max(0.0, channel))
    return (
        channel * 12.92
        if channel <= 0.0031308
        else 1.055 * channel ** (1 / 2.4) - 0.055
    )


def hex_to_linear(value):
    value = value.lstrip("#")
    return tuple(srgb_to_linear(int(value[i : i + 2], 16) / 255) for i in (0, 2, 4))


def linear_to_hex(color):
    return "#" + "".join(
        f"{round(linear_to_srgb(channel) * 255):02x}" for channel in color[:3]
    )


def neutral_tone_map(color):
    """Khronos PBR neutral, as three.js NeutralToneMapping."""
    start = 0.8 - 0.04
    desaturation = 0.15
    lowest = min(color)
    offset = lowest - 6.25 * lowest * lowest if lowest < 0.08 else 0.04
    color = [channel - offset for channel in color]
    peak = max(color)
    if peak < start:
        return color
    d = 1 - start
    new_peak = 1 - d * d / (peak + d - start)
    color = [channel * new_peak / peak for channel in color]
    g = 1 - 1 / (desaturation * (peak - new_peak) + 1)
    return [channel * (1 - g) + new_peak * g for channel in color]


def albedo_to_screen(albedo, gain=SUNLIT_GAIN):
    """Hex colour a sunlit top face with this linear albedo shows."""
    return linear_to_hex(neutral_tone_map([gain * channel for channel in albedo]))


def screen_to_albedo(target_hex, gain=SUNLIT_GAIN):
    """Linear albedo that shows `target_hex` on a sunlit top face."""
    target = hex_to_linear(target_hex)
    albedo = [channel / gain for channel in target]
    for _ in range(200):
        shown = neutral_tone_map([gain * channel for channel in albedo])
        albedo = [
            min(1.0, max(0.0, a + (t - s) / gain))
            for a, t, s in zip(albedo, target, shown)
        ]
    return tuple(round(channel, 4) for channel in albedo)


# On-screen colour roles from GAME_ART.md, with roughness. Use these names in
# role maps instead of inventing one-off colours; add a role here and to the
# table in GAME_ART.md when a new one is needed.
SCREEN_ROLES = {
    "grass": ("#7bd03a", 0.7),
    "path": ("#e0a765", 0.8),
    "terrain_soil": ("#b9693a", 0.8),
    "bed_soil": ("#8f5530", 0.85),
    "timber_light": ("#f2a53a", 0.55),
    "timber_dark": ("#dc8427", 0.55),
    "trunk": ("#b56a3c", 0.6),
    "canopy": ("#43b93a", 0.55),
    "canopy_light": ("#6fd040", 0.55),
    "moss": ("#78cc58", 0.6),
    "end_grain": ("#f2c674", 0.6),
    "crop_leaf": ("#5fc93a", 0.5),
    "crop_leaf_light": ("#a4e352", 0.5),
    "stone": ("#b3bdd3", 0.6),
    "steel": ("#8fc0ee", 0.3),
    "water": ("#35b4ff", 0.12),
    "ripe_red": ("#f23b2c", 0.25),
    "carrot_orange": ("#ff8a1c", 0.4),
    "petal_yellow": ("#ffd31c", 0.45),
    "petal_yellow_shade": ("#ffb300", 0.45),
}

# Roughness bands from GAME_ART.md.
ROUGHNESS = {"matte": 0.8, "satin": 0.55, "gloss": 0.35, "wet": 0.15}


def role_albedo(role):
    hex_value, roughness = SCREEN_ROLES[role]
    return screen_to_albedo(hex_value), roughness


# ---------------------------------------------------------- seasonal roles
# Bright seasonal roles from "Seasonal roles" in GAME_ART.md (decided
# 2026-11-23: every season gets the party look). Same shape as SCREEN_ROLES:
# the on-screen sRGB colour of a sunlit top face, and roughness. Seasons
# change hue, not brightness or saturation. Every value round-trips through
# screen_to_albedo / albedo_to_screen exactly.
# `packages/game/src/scene/seasonalRoles.ts` exports the same roles, with
# their albedo, for code; its unit test keeps the two in sync.
SEASONAL_ROLES = {
    # Autumn: canopy and leaf sequence after the summer green.
    "autumn_gold": ("#f0c832", 0.55),
    "autumn_amber": ("#f09a38", 0.55),
    "autumn_orange": ("#ee6c2b", 0.55),
    "autumn_red": ("#e44a2e", 0.55),
    "leaf_pile": ("#d9733a", 0.6),
    # Autumn: harvest.
    "pumpkin": ("#f0803a", 0.4),
    "pumpkin_light": ("#f2a640", 0.4),
    "pumpkin_shade": ("#e2662a", 0.4),
    "hay": ("#f2cb5a", 0.8),
    "hay_shade": ("#dcab48", 0.8),
    "apple_red": ("#ec3c3a", 0.3),
    "nut_caramel": ("#dc9a4c", 0.45),
    "acorn_cap": ("#c28a50", 0.6),
    "conker": ("#c4683a", 0.35),
    "terracotta": ("#e4764a", 0.4),
    # Autumn: flowers, textiles and accents.
    "aster_violet": ("#c05ddc", 0.6),
    "textile_rust": ("#e45f3a", 0.8),
    "cream": ("#f2e4c6", 0.8),
    "enamel_blue": ("#3f8ff0", 0.35),
    "iron": ("#8a95b5", 0.4),
    "lantern_glow": ("#f2b84a", 0.5),
    # Halloween. Pumpkins use the autumn pumpkin roles.
    "halloween_purple": ("#9a4ce0", 0.4),
    "halloween_lime": ("#b4e22e", 0.45),
    "ghost_lilac": ("#e2d4f2", 0.75),
    "ink_violet": ("#5c4590", 0.5),
    # Winter.
    "snow": ("#d6e2f2", 0.8),
    "ice_blue": ("#6ac6f0", 0.15),
    "evergreen": ("#42b848", 0.55),
    "holiday_red": ("#dc2f4c", 0.35),
    "holiday_gold": ("#f2c040", 0.35),
    "lamp_warm": ("#f2cc66", 0.5),
    # Spring.
    "spring_green": ("#8ee04e", 0.5),
    "blossom_pink": ("#f26aaf", 0.5),
    "blossom_white": ("#f2d4e2", 0.5),
}

# Emissive colour of the two glow roles. Their SEASONAL_ROLES colour is what
# the glowing part shows by day, as a lit albedo; these brighter targets
# cannot be reached by lit albedo and are for the emissive colour only.
SEASONAL_EMISSIVE = {
    "lantern_glow": "#ffb43a",
    "lamp_warm": "#ffd36b",
}


def seasonal_role_albedo(role):
    """Linear albedo and roughness of a seasonal or base role."""
    hex_value, roughness = SEASONAL_ROLES.get(role) or SCREEN_ROLES[role]
    return screen_to_albedo(hex_value), roughness


# Old autumn, harvest and Halloween colours -> role. Keys are the old colour
# as authored, lower case: the sRGB hex of an albedo, whether a vertex
# colour, a material base colour or a three.js colour string. Values name a
# role in SEASONAL_ROLES or SCREEN_ROLES. Use one colour per part (no painted
# shading), so several old shades of a part map to one role. Timber keeps the
# shared wood profile (timberAssetPalette.unit.ts) and is not listed; bark and
# cut log ends are. SEASONAL_REMAP overrides this per asset or file.
AUTUMN_REMAP = {
    # Canopy and leaf stops (scene/autumnPalette.ts). Russet is retired.
    "#d6b83f": "autumn_gold",
    "#d78335": "autumn_amber",
    "#b94e32": "autumn_orange",
    "#79563c": "autumn_red",
    "#b06a3d": "autumn_orange",
    # Falling and settled leaf clusters (scene/autumnLeafClusterGeometry.ts).
    "#c39635": "autumn_gold",
    "#b96634": "autumn_orange",
    "#845237": "autumn_red",
    # Leaf piles, leaf beds, wreath and garland leaves.
    "#d5a24f": "autumn_gold",
    "#ca9148": "autumn_amber",
    "#c57e3d": "autumn_amber",
    "#b87536": "autumn_orange",
    "#a15b30": "leaf_pile",
    "#986037": "leaf_pile",
    "#815932": "leaf_pile",
    "#986b3f": "autumn_amber",
    "#bc8d4b": "autumn_gold",
    "#b38442": "autumn_amber",
    "#c49439": "autumn_gold",
    "#a77a3d": "autumn_amber",
    "#b77738": "autumn_amber",
    "#b86232": "autumn_orange",
    "#8f5931": "autumn_red",
    "#c0803e": "autumn_amber",
    # Summer greens the autumn code starts from, stems and moss.
    "#6d913f": "canopy",
    "#78a447": "canopy",
    "#458a36": "canopy",
    "#6c7944": "canopy",
    "#234335": "canopy",
    "#4e7f35": "crop_leaf",
    "#665a34": "crop_leaf",
    "#8c8b48": "crop_leaf_light",
    "#a6a05d": "crop_leaf_light",
    "#7d8f68": "canopy_light",
    "#4f6b4d": "evergreen",
    "#536e59": "evergreen",
    "#657e68": "evergreen",
    "#435c52": "evergreen",
    # Pumpkins.
    "#e08a3c": "pumpkin",
    "#c87430": "pumpkin",
    "#d59b48": "pumpkin_light",
    "#a36300": "pumpkin",
    "#9b4c14": "pumpkin",
    "#392314": "pumpkin_shade",
    "#734820": "lantern_glow",
    # Hay, straw, dry grass and seed heads.
    "#937930": "hay",
    "#b2934a": "hay",
    "#c3a65a": "hay",
    "#bda266": "hay",
    "#c6ae75": "hay",
    "#d6b47f": "hay",
    "#a18e58": "hay",
    "#b9a266": "hay",
    "#c0ac76": "hay",
    "#9a8748": "hay_shade",
    "#9b8c52": "hay_shade",
    "#b29a66": "hay_shade",
    "#bc9257": "hay_shade",
    # Wicker baskets.
    "#8c633d": "hay_shade",
    "#a47a49": "hay_shade",
    "#b78f5b": "hay_shade",
    "#8c663d": "hay_shade",
    "#cca574": "hay_shade",
    "#a8804d": "hay_shade",
    "#b68e58": "hay_shade",
    "#89643e": "hay_shade",
    "#c09b66": "hay_shade",
    "#a47b47": "hay_shade",
    "#ad824d": "hay_shade",
    # Acorns, conkers, chestnuts, mushroom caps and the hedgehog.
    "#b87d35": "nut_caramel",
    "#d09a50": "nut_caramel",
    "#be8642": "nut_caramel",
    "#aa7335": "nut_caramel",
    "#b48455": "nut_caramel",
    "#c5a071": "nut_caramel",
    "#ad895b": "nut_caramel",
    "#826038": "acorn_cap",
    "#806039": "acorn_cap",
    "#927448": "acorn_cap",
    "#7b5935": "acorn_cap",
    "#a47149": "acorn_cap",
    "#b08054": "acorn_cap",
    "#b07947": "acorn_cap",
    "#c59869": "acorn_cap",
    "#c8a66e": "acorn_cap",
    "#b38b54": "acorn_cap",
    "#c19a62": "acorn_cap",
    "#9f8057": "acorn_cap",
    "#806044": "acorn_cap",
    "#764b2c": "conker",
    "#895334": "conker",
    "#a06a3e": "conker",
    "#79502e": "conker",
    "#895735": "conker",
    "#965d30": "conker",
    "#715339": "conker",
    "#755c42": "conker",
    "#57483c": "conker",
    "#665346": "conker",
    "#784329": "conker",
    # Linen, paper, mushroom stems and other cream.
    "#eee3cb": "cream",
    "#e7d9bb": "cream",
    "#e7d9b9": "cream",
    "#eee5cf": "cream",
    "#e9ddc2": "cream",
    "#e7dabd": "cream",
    "#f3deaf": "cream",
    "#ead5a8": "cream",
    "#f3e1b9": "cream",
    "#d5d4b7": "cream",
    "#d6bf88": "cream",
    "#ddc794": "cream",
    "#d6bc91": "cream",
    "#bca578": "cream",
    "#d5c29a": "cream",
    "#cfc19e": "cream",
    "#d9c8a3": "cream",
    "#ddd0ae": "cream",
    "#c6b994": "cream",
    "#c9af83": "cream",
    # Textiles, flowers and pots.
    "#aa563d": "textile_rust",
    "#a85835": "textile_rust",
    "#a55c3a": "textile_rust",
    "#a95d3c": "textile_rust",
    "#9b709c": "aster_violet",
    "#c56c45": "terracotta",
    "#3f2a1c": "bed_soil",
    # Cool accents and dark metal.
    "#2f5e83": "enamel_blue",
    "#536e78": "enamel_blue",
    "#313536": "iron",
    "#536367": "iron",
    "#45575d": "iron",
    "#444d43": "iron",
    "#39423e": "iron",
    "#404b45": "iron",
    "#536159": "iron",
    "#718078": "iron",
    "#47544d": "iron",
    "#526059": "iron",
    "#76857b": "iron",
    "#859087": "iron",
    "#3f4b44": "iron",
    "#6c7b70": "iron",
    "#b95f28": "lantern_glow",
    # Halloween: ghost sheet, cobweb and faces.
    "#f2e9cc": "ghost_lilac",
    "#e5dabb": "ghost_lilac",
    "#faf0d5": "ghost_lilac",
    "#f0e5c9": "ghost_lilac",
    "#e9ddc3": "ghost_lilac",
    "#394546": "ink_violet",
    "#46504a": "ink_violet",
    "#303a35": "ink_violet",
    "#272f2c": "ink_violet",
    # Lantern and lamp emissive colours (use SEASONAL_EMISSIVE).
    "#ffad32": "lantern_glow",
    "#ffce53": "lamp_warm",
    # Bark and cut ends of logs and firewood.
    "#845933": "trunk",
    "#795536": "trunk",
    "#815c38": "trunk",
    "#705136": "trunk",
    "#6c4c32": "trunk",
    "#755331": "trunk",
    "#825832": "trunk",
    "#c0925c": "timber_light",
    "#d2a56f": "timber_light",
    "#cba16b": "timber_light",
    "#d4af77": "timber_light",
    "#af7d49": "timber_dark",
    "#b38b57": "timber_dark",
    "#ac804b": "timber_dark",
}

# Overrides of AUTUMN_REMAP where an old colour means something else, and the
# winter and holiday colours in code. Keys are an asset name or a
# repo-relative file path. Unlit materials (drei Line) take the on-screen
# colour, not the albedo.
SEASONAL_REMAP = {
    "AutumnShrub": {"#79563c": "trunk"},
    "SeasonalMaple": {"#79563c": "trunk"},
    "WoodlandMushrooms": {"#79563c": "acorn_cap"},
    "GardenScarecrow": {"#d6b83f": "hay", "#313536": "ink_violet"},
    "HarvestCrateOrchard": {"#aa563d": "apple_red"},
    "packages/game/src/entities/autumnShrubAppearance.ts": {"#4e7f35": "canopy"},
    "packages/game/src/entities/helpers/groundPatchMaterial.ts": {"#898e8f": "snow"},
    "packages/game/src/snow/SnowOverlay.tsx": {"#f7f7ff": "snow"},
    "packages/game/src/entities/EntityInstancesBlock.tsx": {"#f7f7ff": "snow"},
    "packages/game/src/entities/Snowman.tsx": {
        "#88909d": "snow",
        "#965320": "carrot_orange",
        "#343649": "ink_violet",
    },
    "packages/game/src/entities/helpers/GiftBox.tsx": {
        "#952b29": "holiday_red",
        "#8d292e": "holiday_red",
        "#9f998d": "cream",
        "#2d702d": "evergreen",
        "#307638": "evergreen",
        "#9d7c2b": "holiday_gold",
        "#2a5a98": "enamel_blue",
        "#5f3682": "halloween_purple",
        "#7a808a": "snow",
    },
    "packages/game/src/entities/PineAdvent.tsx": {
        "#9c241b": "holiday_red",
        "#957700": "holiday_gold",
        "#2b6498": "enamel_blue",
        "#9a4f00": "pumpkin",
        "#983358": "blossom_pink",
        "#624698": "halloween_purple",
        "#aaa598": "cream",
        "#1a4a1a": "evergreen",
        "#ffcc66": "lamp_warm",
    },
    "packages/game/src/entities/PineAdventStar.tsx": {
        "#957700": "holiday_gold",
        "#f6d365": "lamp_warm",
    },
}


def seasonal_role(old_hex, where=None):
    """Role name for an old seasonal colour, or None if it is not mapped."""
    key = "#" + old_hex.lstrip("#").lower()
    override = SEASONAL_REMAP.get(where, {}).get(key) if where else None
    return override or AUTUMN_REMAP.get(key)


# --------------------------------------------------------------- materials
def principled(material):
    material.use_nodes = True
    return next(
        (node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"),
        None,
    )


def set_flat_colour(material, albedo, roughness):
    """Sets a flat base colour, roughness and zero metalness.

    Unlinks any texture feeding the base colour. Use `set_surface` instead to
    keep a texture.
    """
    shader = principled(material)
    if shader is None:
        raise RuntimeError(f"{material.name}: no Principled BSDF")
    base_color = shader.inputs["Base Color"]
    for link in list(base_color.links):
        material.node_tree.links.remove(link)
    base_color.default_value = (*albedo[:3], 1.0)
    set_surface(material, roughness)


def set_surface(material, roughness, metallic=0.0):
    """Sets roughness and metalness, leaving colour as it is."""
    shader = principled(material)
    if shader is None:
        raise RuntimeError(f"{material.name}: no Principled BSDF")
    for name, value in (("Roughness", roughness), ("Metallic", metallic)):
        socket = shader.inputs[name]
        for link in list(socket.links):
            material.node_tree.links.remove(link)
        socket.default_value = value


def flat_colour(material):
    """Linear base colour of an untextured material, or None if textured."""
    shader = principled(material)
    if shader is None or shader.inputs["Base Color"].is_linked:
        return None
    return tuple(shader.inputs["Base Color"].default_value[:3])


def describe_material(material):
    shader = principled(material)
    if shader is None:
        return f"{material.name}: no principled"
    colour = flat_colour(material)
    shown = albedo_to_screen(colour) if colour else "TEXTURE"
    return (
        f"{material.name}: albedo={linear_to_hex(colour) if colour else 'TEX'} "
        f"shows={shown} rough={shader.inputs['Roughness'].default_value:.2f} "
        f"metal={shader.inputs['Metallic'].default_value:.2f}"
    )


# ------------------------------------------------------------------ bevels
DEFORM_MODIFIERS = {
    "ARMATURE",
    "CAST",
    "CURVE",
    "DISPLACE",
    "HOOK",
    "LATTICE",
    "MESH_DEFORM",
    "SHRINKWRAP",
    "SIMPLE_DEFORM",
    "SMOOTH",
    "WAVE",
}


def world_scale(obj):
    return obj.matrix_world.to_scale()


def smallest_world_dimension(obj):
    return min(obj.dimensions) if min(obj.dimensions) > 0 else max(obj.dimensions)


def bevel_radius_for(size):
    """Bevel radius in metres for a part whose smallest side is `size`.

    Follows the table in GAME_ART.md and never takes more than a quarter of
    the part.
    """
    if size < 0.15:
        radius = min(0.03, max(0.012, size * 0.22))
    elif size < 0.5:
        radius = 0.045
    else:
        radius = 0.07
    return min(radius, size * 0.25)


def add_party_bevel(obj, radius=None, segments=3, angle_degrees=30):
    """Rounds the edges of `obj` with a modifier applied at export.

    Replaces earlier bevel and weighted-normal modifiers, keeps other
    modifiers (armatures, arrays) in order, and shades the mesh smooth.
    `radius` is in world metres; it is converted to the object's own space
    using its average world scale. Returns the radius used.
    """
    if obj.type != "MESH":
        return None
    if radius is None:
        radius = bevel_radius_for(smallest_world_dimension(obj))
    scale = world_scale(obj)
    mean_scale = (abs(scale.x) + abs(scale.y) + abs(scale.z)) / 3 or 1.0
    for modifier in list(obj.modifiers):
        if modifier.type in {"BEVEL", "WEIGHTED_NORMAL"}:
            obj.modifiers.remove(modifier)
    bevel = obj.modifiers.new("Party Bevel", "BEVEL")
    bevel.width = radius / mean_scale
    bevel.segments = segments
    bevel.limit_method = "ANGLE"
    bevel.angle_limit = math.radians(angle_degrees)
    bevel.use_clamp_overlap = True
    bevel.harden_normals = False
    # A bevel must run before an armature or other deform modifier.
    deform = [
        index
        for index, modifier in enumerate(obj.modifiers)
        if modifier.type in DEFORM_MODIFIERS
    ]
    if deform:
        obj.modifiers.move(obj.modifiers.find(bevel.name), deform[0])
    add_weighted_normals(obj)
    shade_smooth(obj)
    return radius


def add_weighted_normals(obj):
    for modifier in list(obj.modifiers):
        if modifier.type == "WEIGHTED_NORMAL":
            obj.modifiers.remove(modifier)
    weighted = obj.modifiers.new("Party Weighted Normal", "WEIGHTED_NORMAL")
    weighted.keep_sharp = False
    weighted.weight = 100
    # Place it straight after the last bevel or subdivision.
    shaping = [
        index
        for index, modifier in enumerate(obj.modifiers)
        if modifier.type in {"BEVEL", "SUBSURF"}
    ]
    if shaping:
        obj.modifiers.move(obj.modifiers.find(weighted.name), shaping[-1] + 1)
    return weighted


def add_party_subdivision(obj, levels=1):
    """Smooths a low-poly organic part (fruit, animal body, pumpkin)."""
    if obj.type != "MESH":
        return None
    for modifier in list(obj.modifiers):
        if modifier.type == "SUBSURF":
            obj.modifiers.remove(modifier)
    subsurf = obj.modifiers.new("Party Subdivision", "SUBSURF")
    subsurf.levels = levels
    subsurf.render_levels = levels
    subsurf.subdivision_type = "CATMULL_CLARK"
    obj.modifiers.move(obj.modifiers.find(subsurf.name), 0)
    shade_smooth(obj)
    return subsurf


def shade_smooth(obj):
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    obj.data.update()


def evaluated_triangles(obj):
    """Triangle count after modifiers, as the exporter will see it."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    count = sum(len(polygon.vertices) - 2 for polygon in mesh.polygons)
    evaluated.to_mesh_clear()
    return count


def uses_geometry_nodes(obj):
    return any(modifier.type == "NODES" for modifier in obj.modifiers)


# -------------------------------------------------------------- mesh build
def add_box(bm, low, high, radius=0.0, segments=3, sharp_sides=()):
    """Adds a box to `bm`, rounding every edge except those of `sharp_sides`.

    `sharp_sides` lists faces to leave flat-cut, as "+x", "-z" and so on.
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
    result = bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=1.0)
    verts = result["verts"]
    for vert in verts:
        direction = vert.co.normalized()
        scale = 1.0
        if bump:
            scale += bump * (
                math.sin(direction.x * 3.1 + seed) * math.sin(direction.y * 2.7 + seed * 1.7)
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


def add_lobed_blob(bm, center, radii, lobes, subdivisions=4, floor=None, sharpness=3):
    """Adds one smooth mass with soft swellings toward each lobe direction."""
    result = bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=1.0)
    verts = result["verts"]
    lobe_directions = [(Vector(direction).normalized(), amount) for direction, amount in lobes]
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


def assign(faces, index, smooth=True):
    for face in faces:
        face.material_index = index
        face.smooth = smooth


def replace_mesh(obj, bm, weighted_normals=True):
    """Writes `bm` into the object and drops its old shaping modifiers."""
    bm.normal_update()
    bm.to_mesh(obj.data)
    bm.free()
    for modifier in list(obj.modifiers):
        if modifier.type in {"BEVEL", "WEIGHTED_NORMAL", "SUBSURF", "NODES"}:
            obj.modifiers.remove(modifier)
    if weighted_normals:
        add_weighted_normals(obj)
    obj.data.update()
