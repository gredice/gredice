"""Party animal kit: clean primitives, a face kit and checks for rigged animals.

Every animal in the game is a hierarchy of pivots (empties) that runtime code
or GLB clips animate, with rigid mesh nodes under them. A design module
(`party_animals/<animal>.py`) rebuilds the mesh data of every mesh node from
the primitives here. Nothing else changes: objects, names, transforms,
parents, animations and material names stay as they are, so the runtime and
`glbdiff` see the same rig.

Workflow
--------
1. Pick a design space: `design_space` (the stored pose, for animals posed by
   code such as the cow) or `clip_pose_space` (a clip frame, for animals
   animated by GLB clips such as the cat). It maps every object name to its
   world matrix in that pose. Geometry is authored in that space: Blender
   world units, +Z up, feet on z = 0.
2. Build one `Part` per mesh node from primitives (`blob`, `capsule`, `tube`,
   `lathe`, `slab`) and surface details (`pad`, `decal`, `spot`,
   `band_decal`), or from the face, limb and wing helpers built on them
   (`eye`, `blush`, `smile`, `beak`, `leaf_ear`, `cone_ear`, `pivot_leg`,
   `mid_pivot_leg`, `limb_segment`, `pivot_foot`, `sliced_tail`,
   `wing_panel`, `membrane`). Limbs, wings and tail slices are authored in
   their own pivot's frame, so any rotation of the pivot moves them cleanly.
3. `rebuild_mesh(obj, part, space)` writes the part into the node's existing
   mesh datablock name, in the node's local space, smooth shaded, with one or
   more of the asset's existing materials, and drops old modifiers.
4. `apply_colours` sets every material from an on-screen colour through
   `party_style.screen_to_albedo` (metalness 0).
5. The checks (`triangle_report`, `thickness_report`, `world_size`,
   `pose_metrics`, `clip_report`, `procedural_report`) print what
   GAME_ART.md asks to verify. `procedural_report` applies the rotation,
   position and scale offsets the entity code writes, with three.js
   semantics (`apply_pose`), and `joints` checks parts that move apart, such
   as a paw the code translates away from its leg.

Units: every length the kit takes is in design space (Blender world units of
the source file), also inside a scaled rig such as the horse's; pivot frames
are used without their scale (`node_frame`).

No geometry nodes and no modifiers are used, so Blender 5.1 and 5.2 export
the same mesh names.
"""

import json
import math
import struct

import bmesh
import bpy
from mathutils import Euler, Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

# Default ring segments for limbs and feet, and for the tubes of horns,
# antennae and smiles. A leg 0.1 game units wide is about 10 pixels at the
# default zoom; 10 segments with smooth shading read round there.
LEG_SEGMENTS = 10
TUBE_SEGMENTS = 8

# Mesh nodes rebuilt in this session, so the runner can refuse to save an
# animal with a node that still carries its old mesh.
REBUILT = set()
# Nodes whose part is only a hidden nub (skipped by the thickness check).
HIDDEN = set()


# ------------------------------------------------------------------ frames
def frame_from(origin, z_axis, y_hint=(0.0, 1.0, 0.0)):
    """4x4 frame at `origin` whose local +Z points along `z_axis`.

    Local +Y is as close to `y_hint` as possible; local +X completes a
    right-handed frame.
    """
    z = Vector(z_axis).normalized()
    y = Vector(y_hint)
    y = y - z * y.dot(z)
    if y.length < 1e-6:
        y = z.orthogonal()
    y.normalize()
    x = y.cross(z).normalized()
    return Matrix((
        (x.x, y.x, z.x, origin[0]),
        (x.y, y.y, z.y, origin[1]),
        (x.z, y.z, z.z, origin[2]),
        (0.0, 0.0, 0.0, 1.0),
    ))


def translation(v):
    return Matrix.Translation(Vector(v))


def node_frame(matrix):
    """`matrix` (a design-space node or pivot matrix) without its scale, so
    offsets along its axes are in design-space units."""
    loc, rot, _ = matrix.decompose()
    return Matrix.LocRotScale(loc, rot, None)


def smoothstep(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ part
class Part:
    """Geometry for one mesh node, in design space, with material slots."""

    def __init__(self, name=""):
        self.name = name
        self.verts = []
        self.faces = []  # (vertex indices, material slot)
        self.materials = []

    def slot(self, material_name):
        if material_name not in self.materials:
            self.materials.append(material_name)
        return self.materials.index(material_name)

    def add(self, verts, faces, material_name):
        base = len(self.verts)
        slot = self.slot(material_name)
        self.verts.extend(Vector(v) for v in verts)
        self.faces.extend(([base + i for i in face], slot) for face in faces)
        return range(base, base + len(verts))

    def extend(self, other):
        base = len(self.verts)
        for name in other.materials:
            self.slot(name)
        self.verts.extend(v.copy() for v in other.verts)
        self.faces.extend(([base + i for i in f], self.materials.index(other.materials[s])) for f, s in other.faces)

    def recoloured(self, material_name):
        """A copy whose faces all use `material_name` (coat variants)."""
        out = Part(self.name)
        out.verts = [v.copy() for v in self.verts]
        out.materials = [material_name]
        out.faces = [(list(f), 0) for f, _ in self.faces]
        return out

    def triangles(self):
        return sum(len(f) - 2 for f, _ in self.faces)


# ------------------------------------------------------------------ surface
class Surface:
    """Ray target with smooth (barycentric) normals, for pads and decals."""

    def __init__(self, part):
        self.verts = [v.copy() for v in part.verts]
        tris = []
        for face, _ in part.faces:
            for i in range(1, len(face) - 1):
                tris.append((face[0], face[i], face[i + 1]))
        self.tris = tris
        normals = [Vector() for _ in self.verts]
        for a, b, c in tris:
            n = (self.verts[b] - self.verts[a]).cross(self.verts[c] - self.verts[a])
            for i in (a, b, c):
                normals[i] += n
        # vertices that share a position (cube-sphere seams) share a normal
        merged = {}
        for i, v in enumerate(self.verts):
            merged.setdefault((round(v.x, 5), round(v.y, 5), round(v.z, 5)), []).append(i)
        for group in merged.values():
            total = sum((normals[i] for i in group), Vector())
            for i in group:
                normals[i] = total
        self.normals = [n.normalized() if n.length > 0 else Vector((0, 0, 1)) for n in normals]
        self.bvh = BVHTree.FromPolygons(self.verts, tris)

    def smooth_normal(self, point, index):
        a, b, c = (self.verts[i] for i in self.tris[index])
        na, nb, nc = (self.normals[i] for i in self.tris[index])
        v0, v1, v2 = b - a, c - a, point - a
        d00, d01, d11 = v0.dot(v0), v0.dot(v1), v1.dot(v1)
        d20, d21 = v2.dot(v0), v2.dot(v1)
        den = d00 * d11 - d01 * d01
        if abs(den) < 1e-12:
            return na
        v = (d11 * d20 - d01 * d21) / den
        w = (d00 * d21 - d01 * d20) / den
        return (na * (1 - v - w) + nb * v + nc * w).normalized()

    def hit(self, origin, direction):
        location, _, index, _ = self.bvh.ray_cast(Vector(origin), Vector(direction).normalized())
        if location is None:
            return None, None
        return location, self.smooth_normal(location, index)

    def nearest(self, point):
        location, _, index, _ = self.bvh.find_nearest(Vector(point))
        return location, self.smooth_normal(location, index)

    def project(self, core, point):
        """Surface point on the ray from `core` through `point` (or nearest)."""
        hit, normal = self.hit(core, Vector(point) - Vector(core))
        if hit is None:
            hit, normal = self.nearest(point)
        return hit, normal


# ------------------------------------------------------------------ blob
def _cube_sphere(n):
    """Unit sphere from a subdivided cube: even quads, no poles."""
    verts, index, faces = [], {}, []

    def vid(p):
        key = (round(p[0], 6), round(p[1], 6), round(p[2], 6))
        if key not in index:
            index[key] = len(verts)
            verts.append(p)
        return index[key]

    for axis in range(3):
        for sign in (-1, 1):
            ua, va = (axis + 1) % 3, (axis + 2) % 3
            grid = []
            for i in range(n + 1):
                row = []
                for j in range(n + 1):
                    a = math.tan((-1 + 2 * i / n) * math.pi / 4)
                    b = math.tan((-1 + 2 * j / n) * math.pi / 4)
                    p = [0.0, 0.0, 0.0]
                    p[axis], p[ua], p[va] = float(sign), a, b
                    row.append(vid(tuple(p)))
                grid.append(row)
            for i in range(n):
                for j in range(n):
                    q = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]
                    faces.append(q if sign > 0 else q[::-1])
    return [Vector(p).normalized() for p in verts], faces


def _box_sphere(nx, ny, nz):
    """`_cube_sphere` with its own cell count along each axis (x, y, z).

    Edges parallel to an axis have that axis's count on every face, so the
    faces still share their edges vertex for vertex. A long body gets more
    cells along its length, so the segments of its outline are about the
    same length all round instead of long along the back.
    """
    counts = (nx, ny, nz)
    verts, index, faces = [], {}, []

    def vid(p):
        key = (round(p[0], 6), round(p[1], 6), round(p[2], 6))
        if key not in index:
            index[key] = len(verts)
            verts.append(p)
        return index[key]

    for axis in range(3):
        for sign in (-1, 1):
            ua, va = (axis + 1) % 3, (axis + 2) % 3
            nu, nv = counts[ua], counts[va]
            grid = []
            for i in range(nu + 1):
                row = []
                for j in range(nv + 1):
                    a = math.tan((-1 + 2 * i / nu) * math.pi / 4)
                    b = math.tan((-1 + 2 * j / nv) * math.pi / 4)
                    p = [0.0, 0.0, 0.0]
                    p[axis], p[ua], p[va] = float(sign), a, b
                    row.append(vid(tuple(p)))
                grid.append(row)
            for i in range(nu):
                for j in range(nv):
                    q = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]
                    faces.append(q if sign > 0 else q[::-1])
    return [Vector(p).normalized() for p in verts], faces


def _spow(x, e):
    return math.copysign(abs(x) ** e, x)


def blob(part, material, center, rx, ry, rz, res=6, frame=None, ex=1.0, ey=1.0, ez=1.0,
         taper=None, droop=0.0, bulge=None, deform=None):
    """One soft superellipsoid: bodies, heads, muzzles, paws, ears.

    Radii and exponents take a number or a (negative side, positive side)
    pair, so a body can have a fuller rump than chest or a flatter belly than
    back. Exponents below 1 square the form off (0.8 to 0.9 reads as a plush
    loaf). `taper` maps axis -> (scaled axis, amount), e.g. {"y": ("x", 0.1)}
    widens x toward +y. `droop` lowers both ends along y. `bulge` maps axis ->
    (centre, width, amount), a radial swelling. `deform(local, direction)`
    returns a moved local point. With `frame` (a 4x4 design-space matrix) the
    local axes are the frame's and `center` is ignored. `res` is the cells per
    cube face edge: 6 * res * res quads; an (nx, ny, nz) tuple gives each
    local axis its own count (`_box_sphere`), for long bodies.
    """
    def pair(r):
        return (r, r) if isinstance(r, (int, float)) else r

    rx, ry, rz = pair(rx), pair(ry), pair(rz)
    ex, ey, ez = pair(ex), pair(ey), pair(ez)
    dirs, faces = _cube_sphere(res) if isinstance(res, int) else _box_sphere(*res)
    out = []
    for d in dirs:
        ux = _spow(d.x, ex[1] if d.x >= 0 else ex[0])
        uy = _spow(d.y, ey[1] if d.y >= 0 else ey[0])
        uz = _spow(d.z, ez[1] if d.z >= 0 else ez[0])
        local = Vector((ux * (rx[1] if ux >= 0 else rx[0]), uy * (ry[1] if uy >= 0 else ry[0]),
                        uz * (rz[1] if uz >= 0 else rz[0])))
        if taper:
            for along, (scaled, amount) in taper.items():
                local["xyz".index(scaled)] *= 1.0 + amount * d["xyz".index(along)]
        if bulge:
            for along, (c, w, amount) in bulge.items():
                ai = "xyz".index(along)
                f = 1.0 + amount * math.exp(-((d[ai] - c) / w) ** 2)
                for k in range(3):
                    if k != ai:
                        local[k] *= f
        if droop:
            local.z -= droop * d.y * d.y
        if deform:
            local = Vector(deform(local, d))
        out.append(local)
    m = frame if frame is not None else translation(center)
    return part.add([m @ v for v in out], faces, material)


# ------------------------------------------------------------------ lathe
def lathe(part, material, frame, profile, segments=16, scale_xy=(1.0, 1.0), sections=None):
    """Revolve [(radius, z), ...] about the frame's local +Z.

    A radius of 0 at an end makes a pole; a last radius above 0 leaves the
    top open (feet whose open rim meets a leg). `scale_xy` gives an
    elliptical section; `sections` gives one (sx, sy, y offset) per profile
    point instead, e.g. a paw whose toe reaches forward below a round top.
    """
    verts, faces, rings = [], [], []
    for k, (r, z) in enumerate(profile):
        if r <= 1e-9:
            rings.append([len(verts)])
            verts.append(Vector((0.0, 0.0, z)))
            continue
        sx, sy, oy = sections[k] if sections else (scale_xy[0], scale_xy[1], 0.0)
        ring = []
        for j in range(segments):
            a = 2 * math.pi * j / segments
            ring.append(len(verts))
            verts.append(Vector((r * math.cos(a) * sx, r * math.sin(a) * sy + oy, z)))
        rings.append(ring)
    for lower, upper in zip(rings, rings[1:]):
        if len(lower) == 1 and len(upper) == 1:
            continue
        if len(lower) == 1:
            faces.extend([lower[0], upper[(j + 1) % segments], upper[j]] for j in range(segments))
        elif len(upper) == 1:
            faces.extend([lower[j], lower[(j + 1) % segments], upper[0]] for j in range(segments))
        else:
            faces.extend([lower[j], lower[(j + 1) % segments], upper[(j + 1) % segments], upper[j]]
                         for j in range(segments))
    return part.add([frame @ v for v in verts], faces, material)


def _stitch(lower, upper):
    """Faces between two rings (vertex id lists, a single id is a pole) in
    `lathe`'s winding. Rings with different counts are zipped by angle, so
    a fine silhouette ring can meet a coarse hidden one with no T-junction."""
    nl, nu = len(lower), len(upper)
    if nl == 1 and nu == 1:
        return []
    if nl == 1:
        return [[lower[0], upper[(j + 1) % nu], upper[j]] for j in range(nu)]
    if nu == 1:
        return [[lower[j], lower[(j + 1) % nl], upper[0]] for j in range(nl)]
    if nl == nu:
        return [[lower[j], lower[(j + 1) % nl], upper[(j + 1) % nu], upper[j]] for j in range(nl)]
    faces, i, j = [], 0, 0
    while i < nl or j < nu:
        if j >= nu or (i < nl and (i + 1) / nl <= (j + 1) / nu):
            faces.append([lower[i % nl], lower[(i + 1) % nl], upper[j % nu]])
            i += 1
        else:
            faces.append([lower[i % nl], upper[(j + 1) % nu], upper[j % nu]])
            j += 1
    return faces


def lathe_rings(part, material, frame, profile, counts, sections=None):
    """`lathe` with its own segment count per profile point.

    Spend segments where a ring draws a silhouette (a hoof's outer wall and
    rim, a paw's widest ring) and keep the hidden or interior rings coarse,
    such as the sole or the top ring that meets a leg of fewer segments.
    """
    verts, faces, rings = [], [], []
    for k, (r, z) in enumerate(profile):
        if r <= 1e-9:
            rings.append([len(verts)])
            verts.append(Vector((0.0, 0.0, z)))
            continue
        sx, sy, oy = sections[k] if sections else (1.0, 1.0, 0.0)
        ring = []
        for j in range(counts[k]):
            a = 2 * math.pi * j / counts[k]
            ring.append(len(verts))
            verts.append(Vector((r * math.cos(a) * sx, r * math.sin(a) * sy + oy, z)))
        rings.append(ring)
    for lower, upper in zip(rings, rings[1:]):
        faces.extend(_stitch(lower, upper))
    return part.add([frame @ v for v in verts], faces, material)


def puck_profile(radius, height, bevel, top_bevel=None, bottom_steps=1, top_steps=3):
    """Profile of a puck with a flat sole and rounded rims (hooves).

    The sole rim stands on the ground and is hardly seen, so it gets fewer
    steps than the rounded top rim.
    """
    top_bevel = bevel if top_bevel is None else top_bevel
    pts = [(0.0, 0.0)]
    for i in range(bottom_steps + 1):
        a = -math.pi / 2 + (math.pi / 2) * i / bottom_steps
        pts.append((radius - bevel + bevel * math.cos(a), bevel + bevel * math.sin(a)))
    for i in range(top_steps + 1):
        a = (math.pi / 2) * i / top_steps
        pts.append((radius - top_bevel + top_bevel * math.cos(a), height - top_bevel + top_bevel * math.sin(a)))
    pts.append((0.0, height))
    clean = [pts[0]]
    for p in pts[1:]:
        if abs(p[0] - clean[-1][0]) > 1e-6 or abs(p[1] - clean[-1][1]) > 1e-6:
            clean.append(p)
    return clean


def capsule_profile(r0, r1, length, arc=4, mid=1):
    """Tangent hull of a sphere r0 at z = 0 and a sphere r1 at z = length."""
    s = max(-0.95, min(0.95, (r0 - r1) / max(length, 1e-6)))
    alpha = math.asin(s)
    prof = []
    for i in range(arc + 1):
        lat = -math.pi / 2 + (alpha + math.pi / 2) * i / arc
        prof.append((r0 * math.cos(lat), r0 * math.sin(lat)))
    a = (r0 * math.cos(alpha), r0 * math.sin(alpha))
    b = (r1 * math.cos(alpha), length + r1 * math.sin(alpha))
    for i in range(1, mid + 1):
        t = i / (mid + 1)
        prof.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    for i in range(arc + 1):
        lat = alpha + (math.pi / 2 - alpha) * i / arc
        prof.append((r1 * math.cos(lat), length + r1 * math.sin(lat)))
    prof[0] = (0.0, prof[0][1])
    prof[-1] = (0.0, prof[-1][1])
    return prof


def capsule(part, material, p0, r0, p1, r1, segments=LEG_SEGMENTS, arc=3, mid=1, y_hint=(0.0, 0.0, 1.0),
            section=(1.0, 1.0)):
    """Round limb: the tangent hull of a sphere r0 at p0 and r1 at p1.

    Centre the p0 sphere on a pivot and the limb never opens a gap however
    the pivot turns. `section` flattens it (ears).
    """
    p0, p1 = Vector(p0), Vector(p1)
    axis = p1 - p0
    return lathe(part, material, frame_from(p0, axis, y_hint), capsule_profile(r0, r1, axis.length, arc, mid),
                 segments, section)


# ------------------------------------------------------------------ tube
def catmull_rom(points, samples=4):
    """Points on a Catmull-Rom curve through every control point.

    Returns (curve, index) where index[i] is the curve index of control
    point i, so a curve can be sliced at pivots.
    """
    pts = [Vector(p) for p in points]
    if len(pts) < 3:
        out = [pts[0].lerp(pts[-1], i / samples) for i in range(samples + 1)]
        return out, [0, samples]
    ext = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    out, index = [], []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        index.append(len(out))
        for k in range(samples):
            t = k / samples
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t))
    index.append(len(out))
    out.append(pts[-1])
    return out, index


def lerp_radii(radii, count):
    """Resample a radius list to `count` values."""
    if count == len(radii):
        return list(radii)
    out = []
    for i in range(count):
        t = i * (len(radii) - 1) / (count - 1)
        k = min(int(t), len(radii) - 2)
        f = t - k
        out.append(radii[k] * (1 - f) + radii[k + 1] * f)
    return out


def _transport_normals(pts, tangents, up):
    upv = Vector(up)
    n = upv - tangents[0] * upv.dot(tangents[0])
    if n.length < 1e-6:
        n = tangents[0].orthogonal()
    normals = [n.normalized()]
    for i in range(1, len(pts)):
        prev, t = tangents[i - 1], tangents[i]
        axis = prev.cross(t)
        n = normals[-1]
        if axis.length > 1e-8:
            n = Matrix.Rotation(prev.angle(t), 3, axis.normalized()) @ n
        n = n - t * n.dot(t)
        normals.append(n.normalized())
    return normals


def tube(part, material, points, radii, segments=TUBE_SEGMENTS, cap_rings=2, cap_start=True, cap_end=True,
         up=(0.0, 0.0, 1.0), squash=1.0):
    """Circle swept along `points` with hemispherical caps centred on the ends.

    `radii` has one radius per point. Parallel-transport frames keep the
    sweep free of twist. `squash` flattens the section along the binormal
    (tangent x the normal that starts closest to `up`). Horns, smiles,
    antennae, single-node tails. Leave `cap_start` off where the start is
    buried in a head or body.
    """
    pts = [Vector(p) for p in points]
    n = len(pts) - 1
    tangents = [(pts[min(n, i + 1)] - pts[max(0, i - 1)]).normalized() for i in range(len(pts))]
    normals = _transport_normals(pts, tangents, up)
    return _sweep(part, material, pts, tangents, normals, list(radii), segments, cap_rings, cap_start, cap_end,
                  squash)


def _orient_outward(verts, faces, path):
    """Flip every face when the first side quad points into the path."""
    for face in faces:
        if len(face) == 4:
            a, b, c = (verts[i] for i in face[:3])
            n = (b - a).cross(c - a)
            centre = sum((verts[i] for i in face), Vector()) / 4
            nearest = min(path, key=lambda p: (p - centre).length)
            if n.dot(centre - nearest) < 0:
                return [list(reversed(f)) for f in faces]
            return faces
    return faces


def arc_points(start, end, bend, count=6, side=(0.0, 0.0, 1.0)):
    """Points on a gentle arc from start to end, bowing `bend` toward `side`."""
    s, e, side = Vector(start), Vector(end), Vector(side)
    return [s.lerp(e, i / (count - 1)) + side * (bend * math.sin(math.pi * i / (count - 1))) for i in range(count)]


# ------------------------------------------------------------------ pad
def pad(part, material, surface, centre, core, radius_u, radius_v, height, u_hint=(0.0, 0.0, 1.0), rim=0.012,
        rings=(0.0, 0.4, 0.7, 0.86, 0.95, 1.0), lift=(1.0, 1.0, 0.97, 0.78, 0.4, None), segments=20,
        wobble=(), dome=0.0, rotate=0.0, project="core", outline=None):
    """Appliqué hugging `surface`: eyes, glints, blush, nostrils, inner ears.

    Centred where the ray from `core` through `centre` meets the surface. The
    outline is an ellipse (radius_u along `u_hint`, radius_v across),
    optionally wobbled by [(frequency, amplitude, phase)] or reshaped by
    `outline(angle) -> factor`. The plateau stands `height` above the surface
    (plus `dome` at the middle for glossy eyes); the rim rolls down and ends
    `rim` below the surface, so the edge tucks in cleanly with no seam.
    `project="parallel"` drops every point straight down the centre normal
    (flat parts such as ears). Returns (surface point, normal) at the centre.
    """
    core = Vector(core)
    first, normal = surface.hit(core, Vector(centre) - core)
    if first is None:
        raise RuntimeError(f"pad: no surface hit for {material}")
    u = Vector(u_hint) - normal * Vector(u_hint).dot(normal)
    if u.length < 1e-6:
        u = normal.orthogonal()
    u.normalize()
    if rotate:
        u = (Matrix.Rotation(rotate, 3, normal) @ u).normalized()
    v = normal.cross(u).normalized()
    verts, faces, ring_ids = [], [], []
    for k, t in enumerate(rings):
        count = 1 if t == 0 else segments
        ids = []
        for j in range(count):
            a = 2 * math.pi * j / segments
            r = 1.0
            for freq, amp, phase in wobble:
                r += amp * math.sin(freq * a + phase)
            if outline:
                r *= outline(a)
            target = first + u * (math.cos(a) * radius_u * t * r) + v * (math.sin(a) * radius_v * t * r)
            if project == "parallel":
                hit_point, hit_normal = surface.hit(target + normal * 0.5, -normal)
            else:
                hit_point, hit_normal = surface.hit(core, target - core)
            if hit_point is None:
                hit_point, hit_normal = surface.nearest(target)
            h = -rim if lift[k] is None else height * lift[k] + dome * (1 - t * t)
            ids.append(len(verts))
            verts.append(hit_point + hit_normal * h)
        ring_ids.append(ids)
    for lower, upper in zip(ring_ids, ring_ids[1:]):
        if len(lower) == 1:
            faces.extend([lower[0], upper[j], upper[(j + 1) % segments]] for j in range(segments))
        else:
            faces.extend([lower[j], upper[j], upper[(j + 1) % segments], lower[(j + 1) % segments]]
                         for j in range(segments))
    a, b, c = verts[faces[0][0]], verts[faces[0][1]], verts[faces[0][2]]
    if (b - a).cross(c - a).dot(normal) < 0:
        faces = [list(reversed(f)) for f in faces]
    part.add(verts, faces, material)
    return first, normal


# ------------------------------------------------------------------ decal
def decal(part, material, surface, core, centre_dir, radius, harmonics=(), squash=(1.0, 1.0), spin=0.0,
          rings=3, segments=22, lift=0.014, tuck=0.014, up=(0.0, 0.0, 1.0), shoulder=0.035, inner_segments=None):
    """Large marking (coat patch, bib, saddle) that wraps over a curved body.

    `inner_segments` (optional) gives the rings inside the outline fewer
    points than the outline, shoulder and tuck rings, so the outline can be
    fine (20 or more, no polygon steps at close zoom) for few triangles.

    The outline lives in direction space around `centre_dir` as seen from
    `core` (a point inside the body): an angular radius in radians times
    (1 + sum(a * cos(k * phi + p))) for (k, a, p) in `harmonics`. Keep the
    amplitudes at 0.16 or less and use 2 to 3 harmonics for a smooth, organic
    cow patch. `squash` stretches the outline along `up` and across it,
    `spin` turns it. The shell sits `lift` above the surface; a shoulder ring
    just outside the outline rolls it down and a last ring ends `tuck` under
    the surface, so the edge reads as a crisp painted step with no gap.
    """
    core = Vector(core)
    c = Vector(centre_dir).normalized()
    upv = Vector(up)
    e1 = upv - c * upv.dot(c)
    if e1.length < 1e-4:
        e1 = c.orthogonal()
    e1.normalize()
    e2 = c.cross(e1).normalized()
    cs, sn = math.cos(spin), math.sin(spin)
    e1, e2 = e1 * cs + e2 * sn, -e1 * sn + e2 * cs

    def outline(phi):
        k = 1.0
        for h, a, p in harmonics:
            k += a * math.cos(h * phi + p)
        return radius * k

    def direction(theta, phi):
        tang = e1 * (math.cos(phi) * squash[0]) + e2 * (math.sin(phi) * squash[1])
        theta *= tang.length
        return c * math.cos(theta) + tang.normalized() * math.sin(theta)

    def point(d, amount):
        hit, normal = surface.hit(core, d)
        if hit is None:
            hit, normal = surface.nearest(core + d)
        return hit + normal * amount

    phis = [2 * math.pi * s / segments for s in range(segments)]
    verts = [point(c, lift)]
    ring_ids = [[0]]
    for r in range(1, rings + 1):
        f = 1 - (1 - r / rings) ** 1.3
        ids = []
        inner_phis = phis
        if inner_segments and r < rings:
            inner_phis = [2 * math.pi * s / inner_segments for s in range(inner_segments)]
        for p in inner_phis:
            ids.append(len(verts))
            verts.append(point(direction(outline(p) * f, p), lift))
        ring_ids.append(ids)
    for extra, amount in ((shoulder * 0.5, lift * 0.45), (shoulder, -tuck)):
        ids = []
        for p in phis:
            ids.append(len(verts))
            verts.append(point(direction(outline(p) + extra, p), amount))
        ring_ids.append(ids)
    faces = []
    for lower, upper in zip(ring_ids, ring_ids[1:]):
        if inner_segments:
            faces.extend(_stitch(lower, upper))
        elif len(lower) == 1:
            faces.extend([lower[0], upper[j], upper[(j + 1) % segments]] for j in range(segments))
        else:
            faces.extend([lower[j], upper[j], upper[(j + 1) % segments], lower[(j + 1) % segments]]
                         for j in range(segments))
    a, b, cc = verts[faces[0][0]], verts[faces[0][1]], verts[faces[0][2]]
    if (b - a).cross(cc - a).dot(verts[0] - core) < 0:
        faces = [list(reversed(f)) for f in faces]
    return part.add(verts, faces, material)


def spot(part, material, surface, core, direction, radius, squash=(1.0, 1.0), lift=0.012, tuck=0.012,
         segments=12):
    """A round species marking (ladybug spots, frog back spots): a small
    `decal` with no wobble, `radius` in radians as seen from `core`. Keep
    spots few and big, at least 0.06 game units across."""
    return decal(part, material, surface, core, direction, radius, squash=squash, rings=2, segments=segments,
                 lift=lift, tuck=tuck, shoulder=min(0.035, radius * 0.25))


def band_decal(part, material, surface, origin, axis, half_width, lift=0.014, tuck=0.012, shoulder=0.02,
               segments=20, rows=2, up=(0.0, 0.0, 1.0)):
    """A stripe that wraps all the way round a body: bee stripes, collars,
    belts.

    `origin` is a point on the body's long `axis` at the middle of the band,
    inside the body; the band covers `half_width` (design units) either side
    along the axis. Each row is cast from the axis straight out, so the band
    follows the body's section; like `decal`, both edges roll down a
    shoulder and end `tuck` under the surface, with no gap or z-fighting.
    """
    o, ax = Vector(origin), Vector(axis).normalized()
    e1 = Vector(up) - ax * Vector(up).dot(ax)
    if e1.length < 1e-4:
        e1 = ax.orthogonal()
    e1.normalize()
    e2 = ax.cross(e1).normalized()
    offsets = [(-half_width - shoulder, -tuck), (-half_width - shoulder * 0.5, lift * 0.45)]
    offsets += [(-half_width + 2 * half_width * k / rows, lift) for k in range(rows + 1)]
    offsets += [(half_width + shoulder * 0.5, lift * 0.45), (half_width + shoulder, -tuck)]
    verts, ring_ids = [], []
    for along, amount in offsets:
        ids = []
        for j in range(segments):
            a = 2 * math.pi * j / segments
            start = o + ax * along
            d = e1 * math.cos(a) + e2 * math.sin(a)
            hit, normal = surface.hit(start, d)
            if hit is None:
                hit, normal = surface.nearest(start + d)
            ids.append(len(verts))
            verts.append(hit + normal * amount)
        ring_ids.append(ids)
    faces = []
    for lower, upper in zip(ring_ids, ring_ids[1:]):
        faces.extend([lower[j], lower[(j + 1) % segments], upper[(j + 1) % segments], upper[j]]
                     for j in range(segments))
    centre = sum((verts[i] for i in faces[0]), Vector()) / 4
    a, b, c = (verts[i] for i in faces[0][:3])
    if (b - a).cross(c - a).dot(centre - (o + ax * (centre - o).dot(ax))) < 0:
        faces = [list(reversed(f)) for f in faces]
    return part.add(verts, faces, material)


# ------------------------------------------------------------------ slab, wings
def _closed_catmull(points, samples):
    pts = [Vector(p) for p in points]
    n, out = len(pts), []
    for i in range(n):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        for k in range(samples):
            t = k / samples
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t))
    return out


def _resample_closed(points, count):
    """`count` points evenly spaced along a closed polyline."""
    pts = [Vector(p) for p in points]
    lengths = [(pts[(i + 1) % len(pts)] - pts[i]).length for i in range(len(pts))]
    total = sum(lengths)
    out, i, walked = [], 0, 0.0
    for k in range(count):
        target = total * k / count
        while walked + lengths[i] < target:
            walked += lengths[i]
            i += 1
        f = (target - walked) / max(lengths[i], 1e-9)
        out.append(pts[i].lerp(pts[(i + 1) % len(pts)], f))
    return out


def slab(part, material, frame, outline, thickness, segments=16, rings=(0.6, 0.9), cap=2.5, smooth=True):
    """A thin pillow with a rounded rim: wings, membranes, fins, flat ears.

    `outline` is a closed list of (x, y) points in the frame's XY plane,
    star-shaped around the frame origin (the origin sees every outline
    point). With `smooth` it is rounded through a closed Catmull-Rom first,
    then resampled to `segments` even points. The slab is `thickness` thick
    at the origin and rolls down to a rounded rim (superellipse exponent
    `cap`); `rings` are the inner ring fractions. Closed and smooth shaded:
    2 * segments * (len(rings) + 1) triangles. Keep `thickness` at least
    0.03 game units at the runtime scale.
    """
    pts = _closed_catmull([Vector((p[0], p[1], 0.0)) for p in outline], 4) if smooth else \
        [Vector((p[0], p[1], 0.0)) for p in outline]
    pts = _resample_closed(pts, segments)
    h = thickness / 2
    verts, faces = [], []

    def ring(f, z):
        ids = []
        for p in pts:
            ids.append(len(verts))
            verts.append(frame @ Vector((p.x * f, p.y * f, z)))
        return ids

    top_pole = len(verts)
    verts.append(frame @ Vector((0.0, 0.0, h)))
    top = [ring(f, h * (1 - f ** cap) ** (1 / cap)) for f in rings]
    rim = ring(1.0, 0.0)
    bottom = [ring(f, -h * (1 - f ** cap) ** (1 / cap)) for f in reversed(rings)]
    bottom_pole = len(verts)
    verts.append(frame @ Vector((0.0, 0.0, -h)))
    n = len(pts)
    faces.extend([top_pole, top[0][j], top[0][(j + 1) % n]] for j in range(n))
    chain = top + [rim] + bottom
    for lower, upper in zip(chain, chain[1:]):
        faces.extend([lower[j], upper[j], upper[(j + 1) % n], lower[(j + 1) % n]] for j in range(n))
    faces.extend([bottom[-1][j], bottom_pole, bottom[-1][(j + 1) % n]] for j in range(n))
    # orient outward: the top pole's fan must face the frame's +Z
    a, b, c = (verts[i] for i in faces[0])
    if (b - a).cross(c - a).dot(frame.to_3x3() @ Vector((0.0, 0.0, 1.0))) < 0:
        faces = [list(reversed(f)) for f in faces]
    return part.add(verts, faces, material)


def wing_panel(part, material, root, tip, normal, width, thickness, root_width=0.4, widest=0.55, sweep=0.0,
               segments=16, rings=(0.6, 0.9)):
    """A wing as one rounded teardrop panel (birds, chicken, bee, ladybug).

    It runs from `root` to `tip` in the plane whose normal is `normal` (the
    side the camera sees, for example up and out). `width` is the widest
    chord, at fraction `widest` of the length; the root end is `root_width`
    of it and round. `sweep` (a fraction of the width) bends the tip back
    toward the trailing side. Put `root` on or just inside the body at the
    wing pivot and author the panel under the pivot node, so a flap turns it
    about the shoulder without opening a gap. Butterfly wings are two
    overlapping panels (fore and hind) per side.
    """
    root, tip, nrm = Vector(root), Vector(tip), Vector(normal).normalized()
    axis = tip - root
    length = axis.length
    u = (axis - nrm * axis.dot(nrm)).normalized()
    v = nrm.cross(u).normalized()
    origin = root + u * (length * 0.45)
    frame = Matrix((
        (u.x, v.x, nrm.x, origin.x),
        (u.y, v.y, nrm.y, origin.y),
        (u.z, v.z, nrm.z, origin.z),
        (0.0, 0.0, 0.0, 1.0),
    ))

    def half(x):  # half chord at fraction x of the length
        if x < widest:
            return width / 2 * (root_width + (1 - root_width) * math.sin(math.pi / 2 * x / widest))
        return width / 2 * math.sqrt(max(0.0, 1 - ((x - widest) / (1 - widest)) ** 2))

    lead, trail = [], []
    steps = 8
    for k in range(steps + 1):
        x = k / steps
        bend = sweep * width * x * x
        lead.append((x * length - length * 0.45, half(x) - bend))
        trail.append((x * length - length * 0.45, -half(x) - bend))
    # round the root end: from the trailing root corner behind the root to the leading one
    r0 = width / 2 * root_width
    back = [(-length * 0.45 - r0 * math.sin(math.radians(a)), -r0 * math.cos(math.radians(a))) for a in (45, 90, 135)]
    outline = lead + list(reversed(trail[:-1])) + back
    return slab(part, material, frame, outline, thickness, segments=segments, rings=rings)


def membrane(part, material, points, normal, thickness, scallop=None, segments=20, rings=(0.6, 0.9)):
    """A flat wing membrane panel through 3D `points` (bat wings).

    `points` (design space, in order round the panel) are projected onto
    the best plane facing `normal`. `scallop` maps an edge index i (from
    point i to i + 1) to an inward bow, as a fraction of that edge's length,
    for the scalloped trailing edge between finger tips. A membrane that
    spans several pivots is cut into one panel per pivot node; let each
    panel reach 0.03 to 0.05 under its neighbour, so folding the joint
    never opens a gap.
    """
    pts = [Vector(p) for p in points]
    centre = sum(pts, Vector()) / len(pts)
    nrm = Vector()
    for i, p in enumerate(pts):  # Newell's normal
        q = pts[(i + 1) % len(pts)]
        nrm += Vector(((p.y - q.y) * (p.z + q.z), (p.z - q.z) * (p.x + q.x), (p.x - q.x) * (p.y + q.y)))
    nrm = nrm.normalized() if nrm.length > 1e-9 else Vector(normal).normalized()
    if nrm.dot(Vector(normal)) < 0:
        nrm = -nrm
    u = (pts[0] - centre) - nrm * (pts[0] - centre).dot(nrm)
    u.normalize()
    v = nrm.cross(u)
    frame = Matrix((
        (u.x, v.x, nrm.x, centre.x),
        (u.y, v.y, nrm.y, centre.y),
        (u.z, v.z, nrm.z, centre.z),
        (0.0, 0.0, 0.0, 1.0),
    ))
    flat = [Vector(((p - centre).dot(u), (p - centre).dot(v))) for p in pts]
    outline = []
    for i, p in enumerate(flat):
        q = flat[(i + 1) % len(flat)]
        bow = (scallop or {}).get(i, 0.0)
        for k in range(4):
            t = k / 4
            m = p.lerp(q, t)
            if bow:
                m = m.lerp(Vector((0.0, 0.0)), bow * math.sin(math.pi * t) * (q - p).length / max(m.length, 1e-6))
            outline.append((m.x, m.y))
    return slab(part, material, frame, outline, thickness, segments=segments, rings=rings)


# ------------------------------------------------------------------ face kit
def eye(eye_part, glint_part, surface, core, target, height, width, eye_material, glint_material,
        glint_size=0.09, glint_dir=(-1.0, 0.0, 0.0), dome=0.03, segments=16, pupil=None, glint_segments=10):
    """A tall glossy eye pad with a white glint, hugging a head surface.

    `height` and `width` are the full eye size (aim for 28 to 32% of the head
    height). The glint sits up and toward `glint_dir` (the same world
    direction for both eyes, the viewer's upper left) and is `glint_size`
    across, at least 0.03 game units at the runtime scale. `pupil` =
    (part, material, height fraction, width fraction, raise fraction) puts an
    ink pupil on a coloured iris; raise it so the iris shows as a crescent
    below. Returns the eye centre and normal.
    """
    centre, normal = pad(eye_part, eye_material, surface, target, core, height / 2, width / 2, 0.01,
                         u_hint=(0, 0, 1), rim=0.012, dome=dome, segments=segments,
                         rings=(0.0, 0.6, 0.9, 1.0), lift=(1.0, 0.85, 0.35, None))
    up = Vector((0, 0, 1)) - normal * normal.z
    up.normalize()
    side = Vector(glint_dir) - normal * normal.dot(Vector(glint_dir)) - up * up.dot(Vector(glint_dir))
    side.normalize()
    behind = centre - normal * 0.4
    layers = Part()
    layers.extend(eye_part)
    if pupil:
        pupil_part, pupil_material, hu, wu, raise_by = pupil
        pupil_centre = centre + up * (height * raise_by)
        pad(pupil_part, pupil_material, Surface(eye_part), pupil_centre, behind, height * hu / 2, width * wu / 2,
            0.006, u_hint=(0, 0, 1), rim=0.006, segments=segments, rings=(0.0, 0.6, 0.9, 1.0),
            lift=(1.0, 0.95, 0.5, None))
        layers.extend(pupil_part)
    # cast from the front so the glint lies on whichever layer is on top
    glint_centre = centre + up * (height * 0.24) + side * (width * 0.2)
    pad(glint_part, glint_material, Surface(layers), glint_centre, centre + normal * 0.4, glint_size * 0.56,
        glint_size / 2, 0.007, u_hint=(0, 0, 1), rim=0.006, segments=glint_segments, rings=(0.0, 0.7, 1.0),
        lift=(1.0, 0.75, None))
    return centre, normal


def blush(part, material, surface, core, target, height, width, segments=14):
    """A soft pink oval on the cheek, below and outside the eye."""
    return pad(part, material, surface, target, core, height / 2, width / 2, 0.006, u_hint=(0, 0, 1), rim=0.008,
               segments=segments, rings=(0.0, 0.75, 1.0), lift=(1.0, 0.7, None))


def smile(part, material, surface, points, radius, lift=0.006, segments=6):
    """An ink smile tube laid on a surface through `points` (Catmull-Rom)."""
    curve, _ = catmull_rom(points, samples=2)
    snapped = []
    for p in curve:
        hit, normal = surface.nearest(p)
        snapped.append(hit + normal * (lift + radius * 0.35))
    return tube(part, material, snapped, [radius] * len(snapped), segments=segments, cap_rings=2)


def beak(part, material, base, tip, base_radius, tip_radius, curl=0.0, squash=0.75, up=(0.0, 0.0, 1.0),
         segments=TUBE_SEGMENTS, samples=4):
    """A rounded cone beak or bill (chicken, small bird).

    It runs from `base`, buried about one base radius inside the head, to
    `tip`, curling `curl` down (against `up`) toward the tip, tapering from
    `base_radius` to a round `tip_radius` (at least 0.015 game units, so the
    tip stays 0.03 across), and flattened top to bottom by `squash`. Open at
    the buried base. A duck bill is the same with `squash` about 0.45 and a
    tip radius close to the base radius.
    """
    base, tip, upv = Vector(base), Vector(tip), Vector(up).normalized()
    pts = [base.lerp(tip, i / samples) - upv * (curl * (i / samples) ** 2) for i in range(samples + 1)]
    radii = [base_radius + (tip_radius - base_radius) * (i / samples) ** 0.8 for i in range(samples + 1)]
    side = (tip - base).cross(upv)
    if side.length < 1e-6:
        side = upv.orthogonal()
    # start the section frame sideways, so `squash` (the binormal) is vertical
    return tube(part, material, pts, radii, segments=segments, cap_rings=2, cap_start=False, up=side.normalized(),
                squash=squash)


def leaf_ear(ear_part, inner_part, ear_material, inner_material, root, axis, face, length, width, thickness,
             res=4, inner=(0.72, 0.7), point=0.25):
    """A soft leaf ear and a pink lining that follows its outline.

    The ear runs from `root` (buried in the head) along `axis` for `length`;
    its flat face looks toward `face`. `point` narrows it toward the tip. The
    lining is the same leaf scaled by `inner` (length, width) and set on the
    front face, so its outline follows the ear's instead of being a sticker.
    """
    axis = Vector(axis).normalized()
    centre = Vector(root) + axis * (length / 2)
    frame = frame_from(centre, axis, face)  # local z along the ear, local y = flat face
    taper = {"z": ("x", -point)}
    blob(ear_part, ear_material, None, width / 2, thickness / 2, length / 2, res=res, frame=frame, ex=0.9, ez=0.9,
         taper=taper)
    il, iw = inner
    front = (frame.to_3x3() @ Vector((0, 1, 0))).normalized()
    inner_centre = centre + axis * (length * (1 - il) * 0.18) + front * (thickness * 0.34)
    inner_frame = frame_from(inner_centre, axis, face)
    blob(inner_part, inner_material, None, width * iw / 2, thickness * 0.3, length * il / 2, res=res - 1,
         frame=inner_frame, ex=0.9, ez=0.9, taper=taper)
    return frame


def cone_ear(ear_part, inner_part, ear_material, inner_material, base, tip, base_radius, tip_radius, face,
             flatten=0.55, inner=(0.62, 0.68), segments=16):
    """A tall rounded-triangle ear (cats, foxes, rabbits) with a lining.

    The ear is a capsule cone from `base` (buried in the head) to `tip`,
    flattened to `flatten` front to back. The lining is the same cone scaled
    by `inner` (radius, length) and much flatter, set on the face that looks
    toward `face`, so it follows the ear's outline.
    """
    base, tip = Vector(base), Vector(tip)
    axis = (tip - base).normalized()
    f = Vector(face) - axis * Vector(face).dot(axis)
    f.normalize()
    side = axis.cross(f).normalized()
    capsule(ear_part, ear_material, base, base_radius, tip, tip_radius, segments=segments, arc=3, mid=1,
            y_hint=side, section=(flatten, 1.0))
    scale_r, scale_len = inner
    length = (tip - base).length
    ib = base + axis * (length * 0.12) + f * (base_radius * flatten * 0.6)
    it = ib + axis * (length * scale_len) + f * (tip_radius * flatten * 0.2)
    capsule(inner_part, inner_material, ib, base_radius * scale_r, it, tip_radius * scale_r,
            segments=segments - 4, arc=2, mid=1, y_hint=side, section=(flatten * 0.42, 1.0))


def slab_leaf_ear(ear_part, inner_part, ear_material, inner_material, root, axis, face, length, width, thickness,
                  inner=(0.72, 0.7), point=0.25, segments=20, inner_segments=18, rings=(0.6, 0.9), cap=2.5,
                  lining_height=0.01, lining_rim=0.01):
    """`leaf_ear` with an outline that stays round at close zoom.

    The ear is a `slab` pillow (an even outline of `segments` points) instead
    of a flattened cube-sphere, whose outline showed 8 to 12 corners. The
    lining is a pad laid on the ear's front face, the same leaf scaled by
    `inner` (length, width) and moved a little toward the tip, its rim
    tucked under the ear, so its outline is its own even ring of
    `inner_segments` points rather than where two faceted shells cross.
    Arguments otherwise as `leaf_ear`. Returns the ear frame (local Y along
    the ear, Z out of the lined face).
    """
    a = Vector(axis).normalized()
    f = Vector(face) - a * Vector(face).dot(a)
    f.normalize()
    x = a.cross(f).normalized()
    centre = Vector(root) + a * (length / 2)
    frame = Matrix((
        (x.x, a.x, f.x, centre.x),
        (x.y, a.y, f.y, centre.y),
        (x.z, a.z, f.z, centre.z),
        (0.0, 0.0, 0.0, 1.0),
    ))

    def leaf(w, ln, oy=0.0, n=48):
        pts = []
        for k in range(n):
            t = 2 * math.pi * k / n
            c, s = math.cos(t), math.sin(t)
            pts.append(Vector((w / 2 * _spow(c, 0.9) * (1 - point * s), ln / 2 * _spow(s, 0.9) + oy, 0.0)))
        return pts

    ear = Part()
    slab(ear, ear_material, frame, [(p.x, p.y) for p in leaf(width, length)], thickness, segments=segments,
         rings=rings, cap=cap)
    ear_part.extend(ear)
    surface = Surface(ear)
    il, iw = inner
    oy = length * (1 - il) * 0.18
    ring = _resample_closed(_closed_catmull(leaf(width * iw, length * il, oy), 4), inner_segments)
    middle = Vector((0.0, oy, 0.0))
    verts, rows = [], []
    for t, lift in ((0.0, 1.0), (0.8, 0.75), (1.0, None)):
        ids = []
        for p in ([middle] if t == 0 else ring):
            q = middle + (p - middle) * t
            hit, normal = surface.hit(frame @ Vector((q.x, q.y, thickness)), -f)
            if hit is None:
                hit, normal = surface.nearest(frame @ q)
            ids.append(len(verts))
            verts.append(hit + normal * (-lining_rim if lift is None else lining_height * lift))
        rows.append(ids)
    faces = _stitch(rows[0], rows[1]) + _stitch(rows[1], rows[2])
    p0, p1, p2 = (verts[i] for i in faces[0])
    if (p1 - p0).cross(p2 - p0).dot(f) < 0:
        faces = [list(reversed(face)) for face in faces]
    inner_part.add(verts, faces, inner_material)
    return frame


# ------------------------------------------------------------------ limbs
def _leg_frame(pivot, inward, z):
    """Frame on the leg axis at pivot-local height `z` (design-space units):
    +Z up the leg, +Y the pivot's local Y, so leg and foot rings line up
    vertex for vertex."""
    frame = node_frame(pivot)
    return frame_from(frame @ Vector((inward, 0.0, z)), frame.to_3x3() @ Vector((0.0, 0.0, 1.0)),
                      frame.to_3x3() @ Vector((0.0, 1.0, 0.0)))


def pivot_leg(part, material, pivot, radius, length, inward=0.0, segments=LEG_SEGMENTS, arc=2, top_radius=None):
    """A round leg authored in the pivot's own frame.

    The top sphere is centred on the pivot (moved only along the pivot's
    swing axis, local X, by `inward`), so a swing never opens a gap and the
    leg turns exactly with the pivot. The leg runs down local -Z for `length`
    to the centre of its bottom sphere, which hides inside the foot. Also the
    lower half of a two-segment leg: pass the knee pivot, with `top_radius`
    a little under the knee ball of `limb_segment`.
    """
    top_radius = radius if top_radius is None else top_radius
    profile = capsule_profile(radius, top_radius, length, arc, 1)
    return lathe(part, material, _leg_frame(pivot, inward, -length), profile, segments)


def mid_pivot_leg(part, material, node, radius, top, bottom, top_radius=None, segments=LEG_SEGMENTS, arc=2):
    """A leg for a mesh node the code swings about its own origin.

    Some rigs have no hip pivot: the dog's code rotates `Dog_Leg_*` itself
    about its origin, half way down the leg, and translates `Dog_Paw_*` on
    its own. `node` is the leg node's design-space matrix. The top sphere
    sits `top` above the origin, deep in the body, so it stays buried when
    the swing moves it the other way; the bottom sphere sits `bottom` below
    (negative), deep in the foot. Make that foot a closed form (a `blob`,
    not an open `pivot_foot`) and check both ends with
    `procedural_report(..., joints=[(leg, foot)])` at the swing extremes,
    with the paw translations the code applies.
    """
    top_radius = radius if top_radius is None else top_radius
    profile = capsule_profile(radius, top_radius, top - bottom, arc, 1)
    return lathe(part, material, node_frame(node) @ translation((0.0, 0.0, bottom)), profile, segments)


def limb_segment(part, material, start, end, r_start, r_end, inward=0.0, segments=LEG_SEGMENTS, arc=2):
    """The upper half of a two-segment limb (horse legs, frog hind legs).

    A sphere `r_start` centred on the `start` pivot (the hip) and a sphere
    `r_end` centred on the `end` pivot (the knee, a child of the hip), both
    moved `inward` along their own local X, joined by a tangent hull. Put it
    on the node under the hip pivot. The end sphere is the knee ball: build
    the lower half with `pivot_leg` on the knee pivot and a top radius about
    0.95 of `r_end`, so it turns inside the ball and the knee never opens or
    z-fights, whatever the two pivots do.
    """
    p0 = node_frame(start) @ Vector((inward, 0.0, 0.0))
    p1 = node_frame(end) @ Vector((inward, 0.0, 0.0))
    axis = p0 - p1
    y_hint = node_frame(start).to_3x3() @ Vector((0.0, 1.0, 0.0))
    return lathe(part, material, frame_from(p1, axis, y_hint), capsule_profile(r_end, r_start, axis.length, arc, 1),
                 segments)


def pivot_foot(part, material, pivot, inward, sole_z, profile, segments=LEG_SEGMENTS, sections=None):
    """A foot (hoof, paw, boot) revolved about the leg axis.

    `profile` is [(radius, height above the sole), ...] from the sole pole
    up and must end on the leg radius with the top left open: the leg
    continues out of that rim, so leg and foot meet on one clean circle with
    no zig-zag seam. Use the leg's `segments`. `sections` reaches a paw's toe
    forward (see `lathe`); keep the top entries at (1, 1, 0). Only for a
    foot under the same pivot as its leg; a foot the code moves on its own
    must be closed (see `mid_pivot_leg`).
    """
    return lathe(part, material, _leg_frame(pivot, inward, sole_z), profile, segments, sections=sections)


def hoof_profile(radius, height, leg_radius, bevel=0.035):
    """A chunky hoof puck: flat sole, rounded sole rim, and a top rim that
    rolls in to meet the leg (radius - leg_radius is the top fillet). Five
    rings: about 90 triangles at 10 segments."""
    top = radius - leg_radius
    pts = [(0.0, 0.0), (radius - bevel, 0.0), (radius, bevel), (radius, height - top)]
    for a in (45, 90):
        t = math.radians(a)
        pts.append((leg_radius + top * math.cos(t), height - top + top * math.sin(t)))
    return pts


def pivot_foot_rings(part, material, pivot, inward, sole_z, profile, counts, sections=None):
    """`pivot_foot` with a segment count per profile point (`lathe_rings`).

    The last count must be the leg's segments, so leg and foot still meet on
    one clean circle. `HOOF_RINGS` suits `hoof_profile`: a coarse sole on
    the ground, 16 segments on the outer wall and rim the camera sees as an
    outline, and the fillet stepping back down to the leg's 10.
    """
    return lathe_rings(part, material, _leg_frame(pivot, inward, sole_z), profile, counts, sections)


# `pivot_foot_rings` counts for the six points of `hoof_profile` on a leg of
# LEG_SEGMENTS: 114 triangles, against 90 for an all-10 hoof whose rims read
# as a polygon at close zoom.
HOOF_RINGS = (1, 8, 16, 16, 12, LEG_SEGMENTS)


def paw_profile(radius, height, leg_radius):
    """A round mitten paw: soft sole, full ball, a neck that meets the leg."""
    return [(0.0, 0.0), (radius * 0.62, 0.0), (radius * 0.92, height * 0.16), (radius, height * 0.42),
            (radius * 0.95, height * 0.66), (radius * 0.84, height * 0.86), (leg_radius, height)]


# `sections` for `paw_profile`: the toe reaches 0.03 toward the leg frame's
# -Y (forward for an animal facing -Y) while the top stays round.
PAW_TOE = [(1.0, 1.18, -0.03), (1.0, 1.18, -0.03), (1.0, 1.15, -0.026), (1.0, 1.1, -0.018), (1.0, 1.05, -0.009),
           (1.0, 1.02, -0.003), (1.0, 1.0, 0.0)]


def sliced_tail(points, radius, slices, lead_in=None, samples=4, segments=10, cap_rings=2, collar_scale=1.07,
                collar="cap"):
    """One smooth tail through its pivots, cut into one tube per pivot node.

    `points` are the control points: the pivot positions in design space,
    then the tail end. `slices` lists (part, material) per pivot. `lead_in`
    is an extra point before the first pivot, buried in the body, so the root
    never shows a gap. `radius(t)` gives the radius at curve fraction t.

    All slices share one set of rings, so at rest they meet on one circle.
    Between slices of one material, the proximal slice ends in a hemisphere
    centred on the pivot, hidden inside the next slice at rest; the next
    slice starts open on that circle, and when the joint bends the
    hemisphere fills the outside of the bend. Where the material changes (a
    white tip), the distal slice instead starts with a collar `collar_scale`
    wider, so the colour seam is an exact circle in every pose. No kinks, no
    gaps, no coincident shells (no z-fighting).

    `collar="ring"` puts the colour seam on a shared ring instead: the
    proximal slice ends in a hemisphere centred on the pivot (a ball that
    fills the outside of a bend), and the distal slice starts open on that
    same ring, flaring to `collar_scale` within 0.15 radii. At rest the seam
    is the ring itself, and in a bend it is the distal ring lying on the
    ball. The "cap" collar's seam is where a coarse hemisphere crosses the
    tube's facets, which shows as a sawtooth at close zoom.
    """
    collar_kind = collar
    controls = ([Vector(lead_in)] if lead_in is not None else []) + [Vector(p) for p in points]
    curve, index = catmull_rom(controls, samples)
    if lead_in is not None:
        index = index[1:]
    n = len(curve) - 1
    radii = [radius(i / n) for i in range(len(curve))]
    tangents = [(curve[min(n, i + 1)] - curve[max(0, i - 1)]).normalized() for i in range(len(curve))]
    normals = _transport_normals(curve, tangents, (0.0, 0.0, 1.0))
    starts = [0] + index[1:len(slices)]
    ends = index[1:len(slices)] + [n]
    materials = [material for _, material in slices]
    for k, ((part, material), a, b) in enumerate(zip(slices, starts, ends)):
        # A colour change (a white tip) starts with a collar: a hemisphere a
        # little wider than the tube, centred on the pivot. Its seam with the
        # previous slice is an exact circle in every pose, because a sphere
        # turning about its own centre does not move.
        collar = k > 0 and material != materials[k - 1]
        next_collar = k + 1 < len(slices) and materials[k + 1] != material
        if collar_kind == "ring" and collar:
            pts = [curve[a], curve[a] + tangents[a] * (radii[a] * 0.15)] + curve[a + 1:b + 1]
            rr = [radii[a], radii[a] * collar_scale] + [r * collar_scale for r in radii[a + 1:b + 1]]
            _sweep(part, material, pts, [tangents[a]] + tangents[a:b + 1], [normals[a]] + normals[a:b + 1], rr,
                   segments, cap_rings, cap_start=False, cap_end=True)
            continue
        if collar_kind == "ring" and next_collar:
            # the ball shows on the outside of a bend: give it one ring more
            _sweep(part, material, curve[a:b + 1], tangents[a:b + 1], normals[a:b + 1], radii[a:b + 1], segments,
                   max(cap_rings, 3), cap_start=k == 0, cap_end=True)
            continue
        scale = collar_scale if collar else 1.0
        _sweep(part, material, curve[a:b + 1], tangents[a:b + 1], normals[a:b + 1],
               [r * scale for r in radii[a:b + 1]], segments, cap_rings, cap_start=k == 0 or collar,
               cap_end=not next_collar)
    return curve


def _sweep(part, material, pts, tangents, normals, radii, segments, cap_rings, cap_start=True, cap_end=True,
           squash=1.0):
    """Rings along `pts` with given frames, optional hemisphere caps."""
    verts, faces, rings = [], [], []

    def ring_at(center, t, nrm, r):
        b = t.cross(nrm).normalized()
        ids = []
        for j in range(segments):
            a = 2 * math.pi * j / segments
            ids.append(len(verts))
            verts.append(center + nrm * (r * math.cos(a)) + b * (r * math.sin(a) * squash))
        return ids

    if cap_start:
        verts.append(pts[0] - tangents[0] * radii[0])
        rings.append([len(verts) - 1])
        for k in range(1, cap_rings):
            a = math.pi / 2 * (1 - k / cap_rings)
            rings.append(ring_at(pts[0] - tangents[0] * radii[0] * math.sin(a), tangents[0], normals[0],
                                 radii[0] * math.cos(a)))
    for i, p in enumerate(pts):
        rings.append(ring_at(p, tangents[i], normals[i], radii[i]))
    if cap_end:
        for k in range(1, cap_rings):
            a = math.pi / 2 * k / cap_rings
            rings.append(ring_at(pts[-1] + tangents[-1] * radii[-1] * math.sin(a), tangents[-1], normals[-1],
                                 radii[-1] * math.cos(a)))
        verts.append(pts[-1] + tangents[-1] * radii[-1])
        rings.append([len(verts) - 1])
    for lower, upper in zip(rings, rings[1:]):
        if len(lower) == 1:
            faces.extend([lower[0], upper[j], upper[(j + 1) % segments]] for j in range(segments))
        elif len(upper) == 1:
            faces.extend([lower[(j + 1) % segments], lower[j], upper[0]] for j in range(segments))
        else:
            faces.extend([lower[j], upper[j], upper[(j + 1) % segments], lower[(j + 1) % segments]]
                         for j in range(segments))
    return part.add(verts, _orient_outward(verts, faces, pts), material)


def hidden_nub(part, material, centre, radius=0.03):
    """A 12-triangle closed blob for a node the design does not need.

    Place it inside a neighbour so it never shows; the node, its mesh and its
    material stay for the runtime and the exporter.
    """
    HIDDEN.add(part.name)
    return blob(part, material, centre, radius, radius, radius, res=1)


# ------------------------------------------------------------------ design spaces
def design_space(objects):
    """World matrix of every object in the stored pose."""
    return {o.name: o.matrix_world.copy() for o in objects}


def clip_pose_space(objects, track_name, frame=1):
    """World matrices with only NLA track `track_name` playing at `frame`.

    Objects the clip does not animate keep their stored transform, exactly
    as three.js leaves an unanimated node at rest. Restores every mute flag,
    the frame and the stored transforms, so the exported rig is untouched.
    """
    scene = bpy.context.scene
    saved_frame = scene.frame_current
    saved = {o.name: (o.location.copy(), o.rotation_mode, o.rotation_euler.copy(), o.rotation_quaternion.copy(),
                      o.scale.copy()) for o in objects}
    mutes = {}
    for o in objects:
        if o.animation_data:
            for t in o.animation_data.nla_tracks:
                mutes[(o.name, t.name)] = t.mute
                t.mute = t.name != track_name
    scene.frame_set(frame)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    world = {o.name: o.evaluated_get(depsgraph).matrix_world.copy() for o in objects}
    for o in objects:
        if o.animation_data:
            for t in o.animation_data.nla_tracks:
                t.mute = mutes[(o.name, t.name)]
    scene.frame_set(saved_frame)
    for o in objects:
        loc, mode, eul, quat, scl = saved[o.name]
        o.location, o.rotation_mode, o.rotation_euler, o.rotation_quaternion, o.scale = loc, mode, eul, quat, scl
    bpy.context.view_layer.update()
    return world


# ------------------------------------------------------------------ writing
def rebuild_mesh(obj, part, space):
    """Replace `obj`'s mesh data with `part` (design space), keeping names.

    The object, its transform, parent and animation are untouched. The new
    mesh takes the old mesh's name (so exported mesh names do not change),
    is smooth shaded, uses only materials that already exist in the file,
    and old modifiers (weighted normals, bevels) are removed.
    """
    if not part.verts:
        raise RuntimeError(f"{obj.name}: empty part; use hidden_nub for unused nodes")
    inv = space[obj.name].inverted()
    old = obj.data
    name = old.name
    old.name = name + ".old"
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bverts = [bm.verts.new(inv @ v) for v in part.verts]
    for face, slot in part.faces:
        try:
            f = bm.faces.new([bverts[i] for i in face])
        except ValueError:
            continue
        f.material_index = slot
        f.smooth = True
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    for material_name in part.materials:
        material = bpy.data.materials.get(material_name)
        if material is None:
            raise RuntimeError(f"{obj.name}: material {material_name} is not in the file")
        mesh.materials.append(material)
    obj.data = mesh
    for slot in obj.material_slots:
        slot.link = "DATA"
    for modifier in list(obj.modifiers):
        obj.modifiers.remove(modifier)
    if old.users == 0:
        bpy.data.meshes.remove(old)
    REBUILT.add(obj.name)
    return mesh


def rebuild_all(parts, space):
    """Rebuild every mesh object named in `parts`; returns rendered triangles."""
    total = 0
    for name, part in parts.items():
        rebuild_mesh(bpy.data.objects[name], part, space)
        total += part.triangles()
    return total


def remove_party_sources(prefix):
    """Drop the `PartySource:` meshes the retired in-place pass kept.

    The redesign builds from scratch, so the old low-poly sources are dead
    weight in the .blend (they never export).
    """
    for mesh in list(bpy.data.meshes):
        if mesh.name.startswith("PartySource:" + prefix):
            mesh.use_fake_user = False
            if mesh.users == 0:
                bpy.data.meshes.remove(mesh)


def apply_colours(party_style, colours):
    """Set flat colours: {material: (on-screen hex, roughness)}.

    A third item "albedo" authors the hex as the albedo itself, for
    materials whose colour the runtime overrides (the cat's fur tint).
    """
    for material_name, spec in colours.items():
        material = bpy.data.materials.get(material_name)
        if material is None:
            raise RuntimeError(f"missing material {material_name}")
        hex_value, roughness = spec[0], spec[1]
        if len(spec) > 2 and spec[2] == "albedo":
            albedo = party_style.hex_to_linear(hex_value)
        else:
            albedo = party_style.screen_to_albedo(hex_value)
        party_style.set_flat_colour(material, albedo, roughness)


# ------------------------------------------------------------------ export
def export_glb(path):
    """Export with the repo's settings (assets/export-game-assets.py)."""
    options = {"filepath": str(path), "export_apply": True}
    props = bpy.ops.export_scene.gltf.get_rna_type().properties
    if "export_animation_mode" in props:
        if "NLA_TRACKS" in {i.identifier for i in props["export_animation_mode"].enum_items}:
            options["export_animation_mode"] = "NLA_TRACKS"
    if "export_merge_animation" in props:
        if "NLA_TRACK" in {i.identifier for i in props["export_merge_animation"].enum_items}:
            options["export_merge_animation"] = "NLA_TRACK"
    bpy.ops.export_scene.gltf(**options)


# ------------------------------------------------------------------ checks
def _world_mesh(obj, depsgraph):
    ev = obj.evaluated_get(depsgraph)
    me = ev.to_mesh()
    verts = [ev.matrix_world @ v.co for v in me.vertices]
    polys = [tuple(p.vertices) for p in me.polygons]
    ev.to_mesh_clear()
    return verts, polys


def mesh_objects(prefix):
    return sorted((o for o in bpy.data.objects if o.type == "MESH" and o.name.startswith(prefix)),
                  key=lambda o: o.name)


def triangle_report(prefix, budget, hidden=()):
    """Triangles in the file and rendered (minus nodes the runtime hides)."""
    total = rendered = 0
    for o in mesh_objects(prefix):
        tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
        total += tris
        if o.name not in hidden:
            rendered += tris
    flag = "" if rendered <= budget * 1.15 else "  <-- over budget"
    print(f"CHECK triangles: {total} in file, {rendered} rendered, budget about {budget}{flag}")
    heavy = sorted(((sum(len(p.vertices) - 2 for p in o.data.polygons), o.name) for o in mesh_objects(prefix)),
                   reverse=True)[:8]
    print("      heaviest: " + ", ".join(f"{n} {t}" for t, n in heavy))
    return rendered


def world_size(prefix, space=None):
    """(width x, length y, height z) of all mesh nodes in a pose."""
    lo = Vector((1e9, 1e9, 1e9))
    hi = -lo
    for o in mesh_objects(prefix):
        m = space[o.name] if space else o.matrix_world
        for v in o.data.vertices:
            p = m @ v.co
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
    return hi - lo, lo, hi


def _mesh_volume(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.transform(obj.matrix_world)
    volume = abs(bm.calc_volume(signed=False))
    bm.free()
    return volume


def proportion_report(body, heads, space=None):
    """Body length / height and head / body volume (GAME_ART "Proportions").

    `body` is the body mesh node, `heads` the nodes that read as the head
    (head, plus a muzzle that is part of the head's mass). Length runs
    along design-space Y, height along Z, in `space` (the design pose).
    """
    obj = bpy.data.objects[body]
    m = space[body] if space else obj.matrix_world
    pts = [m @ v.co for v in obj.data.vertices]
    length = max(p.y for p in pts) - min(p.y for p in pts)
    height = max(p.z for p in pts) - min(p.z for p in pts)
    ratio = sum(_mesh_volume(bpy.data.objects[h]) for h in heads) / _mesh_volume(obj)
    print(f"CHECK proportions: body length {length:.3f} / height {height:.3f} = {length / height:.2f}; "
          f"head / body volume {ratio:.2f} ({' + '.join(heads)})")
    return length / height, ratio


def size_report(prefix, reference, space=None, tolerance=0.1):
    """Compare the pose's bounding box with the replaced model's (w, l, h)."""
    size, lo, _ = world_size(prefix, space)
    parts = []
    for label, now, ref in zip(("width", "length", "height"), size, reference):
        change = now / ref - 1
        flag = "" if abs(change) <= tolerance else " <--"
        parts.append(f"{label} {now:.2f} ({change:+.0%}){flag}")
    print(f"CHECK size vs {tuple(reference)}: " + ", ".join(parts) + f"; lowest point z {lo.z:+.3f}")


def thickness_report(prefix, scale, minimum=0.03):
    """Thinnest visible extent of every mesh island at the runtime scale.

    Pads and decals are thin on purpose (they lie on a surface), so the
    number that matters is `across`: the narrowest width in the pad's plane.
    """
    dirs = []
    for i in range(300):
        z = 1 - (i + 0.5) / 300
        r = math.sqrt(1 - z * z)
        a = i * 2.399963
        dirs.append(Vector((r * math.cos(a), r * math.sin(a), z)))
    flagged = []
    for o in mesh_objects(prefix):
        if o.name in HIDDEN:
            continue
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bm.transform(o.matrix_world)
        bm.faces.ensure_lookup_table()
        seen = set()
        for f in bm.faces:
            if f.index in seen:
                continue
            stack, island = [f], []
            while stack:
                g = stack.pop()
                if g.index in seen:
                    continue
                seen.add(g.index)
                island.append(g)
                stack.extend(h for e in g.edges for h in e.link_faces if h.index not in seen)
            pts = list({v.co.copy().freeze() for g in island for v in g.verts})
            widths = [(max(p.dot(d) for p in pts) - min(p.dot(d) for p in pts), d) for d in dirs]
            thin, dmin = min(widths, key=lambda w: w[0])
            across = min(w for w, d in widths if abs(d.dot(dmin)) < 0.1) * scale
            if across < minimum and thin * scale < 0.2:
                flagged.append(f"{o.name} across {across:.3f}")
        bm.free()
    print(f"CHECK thickness at scale {scale}: " + ("all parts at least 0.03 game units across" if not flagged
                                                   else "UNDER 0.03: " + ", ".join(flagged)))
    return flagged


def _depth_into(bvh, verts):
    """Deepest vertex inside the closed mesh of `bvh` (positive = inside)."""
    deepest = 0.0
    for v in verts:
        loc, normal, _, dist = bvh.find_nearest(v)
        if loc is not None and (v - loc).dot(normal) < 0:
            deepest = max(deepest, dist)
    return deepest


def _signed_depth(bvh, verts):
    """How deep `verts` reach into the closed mesh of `bvh`: the deepest
    vertex inside (positive), or minus the smallest gap when none is."""
    best = -1e9
    for v in verts:
        loc, normal, _, dist = bvh.find_nearest(v)
        if loc is None:
            continue
        best = max(best, dist if (v - loc).dot(normal) < 0 else -dist)
    return best


def pose_metrics(body, head, legs, feet, tails=(), joints=()):
    """Grounding and attachment of the current (evaluated) pose.

    foot = lowest foot point (0 is ground contact); legs = how deep each leg
    reaches into the body (above ~0.02 means attached); head = how deep the
    head overlaps the body (> 0: never floats); clip = deepest foot inside the
    body; tail = how deep the tail roots stay in the body; joints = for each
    (a, b) pair, how deep a reaches into closed mesh b (negative: a gap).
    """
    dg = bpy.context.evaluated_depsgraph_get()
    O = bpy.data.objects
    bv, bp = _world_mesh(O[body], dg)
    bvh = BVHTree.FromPolygons(bv, bp)

    def depth(a, b):
        verts, polys = _world_mesh(O[b], dg)
        return _signed_depth(BVHTree.FromPolygons(verts, polys), _world_mesh(O[a], dg)[0])

    out = {
        "foot": min(min(v.z for v in _world_mesh(O[f], dg)[0]) for f in feet),
        "legs": [_depth_into(bvh, _world_mesh(O[leg], dg)[0]) for leg in legs],
        "head": _depth_into(bvh, _world_mesh(O[head], dg)[0]) if head else None,
        "clip": max(_depth_into(bvh, _world_mesh(O[f], dg)[0]) for f in feet),
        "tail": [_depth_into(bvh, _world_mesh(O[t], dg)[0]) for t in tails],
        "belly": min(v.z for v in bv),
        "joints": [depth(a, b) for a, b in joints],
    }
    return out


def format_metrics(m):
    legs = "/".join(f"{d:.2f}" for d in m["legs"])
    tail = "/".join(f"{d:.2f}" for d in m["tail"])
    bad = []
    if min(m["legs"]) < 0.02:
        bad.append("LEG GAP")
    if m["head"] is not None and m["head"] <= 0.0:
        bad.append("HEAD FLOATS")
    if m["tail"] and m["tail"][0] <= 0.0:
        bad.append("TAIL GAP")
    if m["joints"] and min(m["joints"]) < 0.01:
        bad.append("JOINT GAP")
    joints = (" joints-in " + "/".join(f"{d:+.3f}" for d in m["joints"])) if m["joints"] else ""
    head = "-" if m["head"] is None else f"{m['head']:.3f}"
    return (f"foot {m['foot']:+.3f} belly {m['belly']:+.3f} legs-in {legs} head-in {head} "
            f"feet-clip {m['clip']:.3f} tail-in {tail}{joints}" + (("  <-- " + ", ".join(bad)) if bad else ""))


# glTF and three.js are +Y up: the exporter maps every node's local Blender
# (x, y, z) to (x, z, -y).
_TO_GLTF = Matrix(((1.0, 0.0, 0.0, 0.0), (0.0, 0.0, 1.0, 0.0), (0.0, -1.0, 0.0, 0.0), (0.0, 0.0, 0.0, 1.0)))
_FROM_GLTF = _TO_GLTF.inverted()


def _three_euler(m):
    """three.js `Euler.setFromRotationMatrix` for order 'XYZ' (m is 3x3)."""
    m13 = max(-1.0, min(1.0, m[0][2]))
    y = math.asin(m13)
    if abs(m13) < 0.9999999:
        return Vector((math.atan2(-m[1][2], m[2][2]), y, math.atan2(-m[0][1], m[0][0])))
    return Vector((math.atan2(m[2][1], m[1][1]), y, 0.0))


def three_local(obj):
    """(position, rotation, scale) of `obj` as three.js sees it after
    loading the GLB: the node's local transform, +Y up, Euler order XYZ."""
    local = _TO_GLTF @ (obj.matrix_parent_inverse @ obj.matrix_basis) @ _FROM_GLTF
    t, q, s = local.decompose()
    return t, _three_euler(q.to_matrix()), s


def set_three_local(obj, position, rotation, scale):
    """Set `obj` from three.js local values (inverse of `three_local`)."""
    # mathutils Euler order 'ZYX' is Rx @ Ry @ Rz, which is three.js 'XYZ'
    local = Matrix.LocRotScale(Vector(position), Euler(Vector(rotation), "ZYX"), Vector(scale))
    obj.matrix_basis = obj.matrix_parent_inverse.inverted() @ (_FROM_GLTF @ local @ _TO_GLTF)


def glb_rest_pose(glb_path):
    """Set every node to the rest transform the exported GLB carries.

    A .blend whose clips live on NLA tracks opens with a clip evaluated into
    the pivots it animates (BirdSmall's body and head pivots load 0.02 off
    and 0.1 rad turned), so its loaded state is not the rest three.js
    starts from. Call this in `check` (after the runner has saved) before
    `procedural_report` on an animal that has clips and code poses.
    Returns the number of nodes set.
    """
    with open(glb_path, "rb") as handle:
        data = handle.read()
    length = struct.unpack_from("<I", data, 12)[0]
    document = json.loads(data[20:20 + length])
    count = 0
    for node in document["nodes"]:
        obj = bpy.data.objects.get(node.get("name", ""))
        if obj is None:
            continue
        x, y, z, w = node.get("rotation", (0.0, 0.0, 0.0, 1.0))
        set_three_local(obj, node.get("translation", (0.0, 0.0, 0.0)),
                        _three_euler(Quaternion((w, x, y, z)).to_matrix()), node.get("scale", (1.0, 1.0, 1.0)))
        count += 1
    bpy.context.view_layer.update()
    return count


def apply_pose(offsets):
    """Apply what entity code writes on top of the rest pose.

    `offsets` maps a node to (rx, ry, rz), radians added to its three.js
    rotation (`node.rotation.x = base.x + rx`), or to a dict with any of
    "rot" (added radians), "pos" (added to `node.position`, three.js +Y up,
    in the parent's units) and "scale" (multiplies `node.scale`), all in
    three.js node-local terms exactly as the code writes them.
    """
    O = bpy.data.objects
    for node, spec in offsets.items():
        if not isinstance(spec, dict):
            spec = {"rot": spec}
        t, e, s = three_local(O[node])
        t = t + Vector(spec.get("pos", (0.0, 0.0, 0.0)))
        e = e + Vector(spec.get("rot", (0.0, 0.0, 0.0)))
        k = spec.get("scale", (1.0, 1.0, 1.0))
        s = Vector((s.x * k[0], s.y * k[1], s.z * k[2]))
        set_three_local(O[node], t, e, s)
    bpy.context.view_layer.update()


def procedural_report(body, head, legs, feet, tails, poses, joints=()):
    """Pose checks for code-animated animals.

    `poses` maps a label to the offsets of `apply_pose` at the extremes the
    entity code reaches (walk swing, paw lift and slide, body bob, graze,
    squash). Every pose starts from the stored rest pose, which is restored
    afterwards. `joints` lists (a, b) mesh pairs whose overlap to report,
    such as (leg, paw) where the code moves the paw on its own.
    """
    O = bpy.data.objects
    rest = {o.name: o.matrix_basis.copy() for o in O}
    for label, offsets in poses.items():
        for o in O:
            o.matrix_basis = rest[o.name]
        apply_pose(offsets)
        print(f"POSE {label:24s} " + format_metrics(pose_metrics(body, head, legs, feet, tails, joints)))
    for o in O:
        o.matrix_basis = rest[o.name]
    bpy.context.view_layer.update()


def clip_report(body, head, legs, feet, tails, samples=8, joints=(), offsets=None):
    """Pose checks for clip-animated animals: every NLA track at `samples`
    frames, the other tracks muted (as three.js plays one clip and leaves
    every node it does not animate at rest). `offsets` (as in `apply_pose`)
    adds what the code writes on top of the clips, for example a leg pose
    the code blends in while walking."""
    scene = bpy.context.scene
    objs = list(bpy.data.objects)
    rest = {o.name: (o.location.copy(), o.rotation_mode, o.rotation_euler.copy(), o.rotation_quaternion.copy(),
                     o.scale.copy()) for o in objs}
    tracks = sorted({t.name for o in objs if o.animation_data for t in o.animation_data.nla_tracks})
    mutes = {(o.name, t.name): t.mute for o in objs if o.animation_data for t in o.animation_data.nla_tracks}

    def restore():
        for o in objs:
            loc, mode, eul, quat, scl = rest[o.name]
            o.location, o.rotation_mode, o.rotation_euler, o.rotation_quaternion, o.scale = loc, mode, eul, quat, scl

    for track in tracks:
        for o in objs:
            if o.animation_data:
                for t in o.animation_data.nla_tracks:
                    t.mute = t.name != track
        end = max(int(s.frame_end) for o in objs if o.animation_data for t in o.animation_data.nla_tracks
                  if t.name == track for s in t.strips)
        for k in range(samples):
            f = 1 + round((end - 1) * k / (samples - 1))
            # nodes this clip does not drive keep whatever was evaluated last
            restore()
            scene.frame_set(f)
            if offsets:
                apply_pose(offsets)
            print(f"CLIP {track:14s} f={f:3d} " + format_metrics(pose_metrics(body, head, legs, feet, tails,
                                                                               joints)))
    for o in objs:
        if o.animation_data:
            for t in o.animation_data.nla_tracks:
                t.mute = mutes[(o.name, t.name)]
    restore()
    scene.frame_set(1)
    restore()
    bpy.context.view_layer.update()
