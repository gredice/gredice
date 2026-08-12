#!/usr/bin/env python3
"""Audit the source geometry contracts for the garden light block collection.

Run with Blender rather than the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python assets/scripts/audit-garden-light-blocks.py

The audit intentionally reads the source ``.blend`` files. It verifies visual
design invariants that node-name and GLB-bound tests cannot prove, including
connected-part counts, manifold topology, face winding, and open seams.
"""

from __future__ import annotations

import argparse
import math
import sys
from dataclasses import dataclass
from itertools import combinations
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


FAILURES: list[str] = []


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--asset-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "game-assets",
        help="Directory containing the generated source .blend files.",
    )
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


ASSET_DIRECTORY = parse_args().asset_dir.resolve()


def check(condition: bool, label: str, detail: str = "") -> None:
    status = "PASS" if condition else "FAIL"
    print(f"CONTRACT {status} {label}" + (f" :: {detail}" if detail else ""))
    if not condition:
        FAILURES.append(label + (f": {detail}" if detail else ""))


@dataclass
class Component:
    vertex_indexes: set[int]
    face_indexes: list[int]
    edge_face_counts: dict[tuple[int, int], int]
    bounds_min: Vector
    bounds_max: Vector
    centroid: Vector
    volume: float
    euler: int
    boundary_edges: int
    wire_edges: int
    overfull_edges: int
    degenerate_faces: int
    bvh: BVHTree

    @property
    def dimensions(self) -> Vector:
        return self.bounds_max - self.bounds_min


def mesh_components(obj: bpy.types.Object) -> list[Component]:
    mesh = obj.data
    adjacency = {vertex.index: set() for vertex in mesh.vertices}
    for edge in mesh.edges:
        a, b = edge.vertices
        adjacency[a].add(b)
        adjacency[b].add(a)

    unseen = set(adjacency)
    vertex_components: list[set[int]] = []
    while unseen:
        seed = min(unseen)
        unseen.remove(seed)
        stack = [seed]
        indexes = {seed}
        while stack:
            current = stack.pop()
            neighbors = adjacency[current] & unseen
            unseen.difference_update(neighbors)
            indexes.update(neighbors)
            stack.extend(neighbors)
        vertex_components.append(indexes)

    results: list[Component] = []
    for indexes in vertex_components:
        face_indexes = [
            polygon.index
            for polygon in mesh.polygons
            if all(index in indexes for index in polygon.vertices)
        ]
        edge_face_counts: dict[tuple[int, int], int] = {}
        for edge in mesh.edges:
            a, b = edge.vertices
            if a in indexes and b in indexes:
                edge_face_counts[tuple(sorted((a, b)))] = 0
        for polygon_index in face_indexes:
            polygon = mesh.polygons[polygon_index]
            polygon_indexes = list(polygon.vertices)
            for index, current in enumerate(polygon_indexes):
                following = polygon_indexes[(index + 1) % len(polygon_indexes)]
                key = tuple(sorted((current, following)))
                edge_face_counts[key] = edge_face_counts.get(key, 0) + 1

        bm = bmesh.new()
        vertex_map = {
            index: bm.verts.new(mesh.vertices[index].co)
            for index in sorted(indexes)
        }
        bm.verts.ensure_lookup_table()
        for polygon_index in face_indexes:
            polygon = mesh.polygons[polygon_index]
            try:
                bm.faces.new([vertex_map[index] for index in polygon.vertices])
            except ValueError:
                pass
        bm.normal_update()
        volume = bm.calc_volume(signed=True) if bm.faces else 0.0
        degenerate_faces = sum(1 for face in bm.faces if face.calc_area() < 1e-10)
        bvh = BVHTree.FromBMesh(bm, epsilon=0.0)
        bm.free()

        coordinates = [mesh.vertices[index].co.copy() for index in indexes]
        bounds_min = Vector(
            tuple(min(co[axis] for co in coordinates) for axis in range(3))
        )
        bounds_max = Vector(
            tuple(max(co[axis] for co in coordinates) for axis in range(3))
        )
        centroid = sum(coordinates, Vector()) / len(coordinates)
        edge_count = len(edge_face_counts)
        results.append(
            Component(
                vertex_indexes=indexes,
                face_indexes=face_indexes,
                edge_face_counts=edge_face_counts,
                bounds_min=bounds_min,
                bounds_max=bounds_max,
                centroid=centroid,
                volume=volume,
                euler=len(indexes) - edge_count + len(face_indexes),
                boundary_edges=sum(1 for count in edge_face_counts.values() if count == 1),
                wire_edges=sum(1 for count in edge_face_counts.values() if count == 0),
                overfull_edges=sum(1 for count in edge_face_counts.values() if count > 2),
                degenerate_faces=degenerate_faces,
                bvh=bvh,
            )
        )
    return results


def load(asset: str) -> dict[str, tuple[bpy.types.Object, list[Component]]]:
    source_path = ASSET_DIRECTORY / f"{asset}.blend"
    check(source_path.is_file(), f"{asset}.source-exists", str(source_path))
    if not source_path.is_file():
        return {}
    bpy.ops.wm.open_mainfile(filepath=str(source_path))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    check(
        len(meshes) == len(bpy.context.scene.objects),
        f"{asset}.mesh-only",
        f"mesh={len(meshes)} scene={len(bpy.context.scene.objects)}",
    )
    return {obj.name: (obj, mesh_components(obj)) for obj in meshes}


def assert_solid(label: str, components: list[Component]) -> None:
    check(bool(components), f"{label}.exists")
    check(
        all(component.boundary_edges == 0 for component in components),
        f"{label}.closed",
        f"boundary={[component.boundary_edges for component in components]}",
    )
    check(
        all(component.wire_edges == 0 and component.overfull_edges == 0 for component in components),
        f"{label}.manifold",
        f"wire={[component.wire_edges for component in components]} overfull={[component.overfull_edges for component in components]}",
    )
    check(
        all(component.degenerate_faces == 0 for component in components),
        f"{label}.nondegenerate",
        f"degenerate={[component.degenerate_faces for component in components]}",
    )
    check(
        all(component.volume > 1e-10 for component in components),
        f"{label}.outward",
        f"signed_volumes={[round(component.volume, 8) for component in components]}",
    )


def grouped_values(values: list[float], tolerance: float) -> list[list[float]]:
    groups: list[list[float]] = []
    for value in sorted(values):
        if not groups or abs(value - sum(groups[-1]) / len(groups[-1])) > tolerance:
            groups.append([value])
        else:
            groups[-1].append(value)
    return groups


def audit_stone() -> None:
    objects = load("StoneWalkway")
    pavers: list[Component] = []
    for name, (_, components) in objects.items():
        if name.startswith("StoneWalkway_Stones"):
            pavers.extend(components)
    check(len(pavers) == 6, "StoneWalkway.six-pavers", f"count={len(pavers)}")
    assert_solid("StoneWalkway.pavers", pavers)
    x_groups = grouped_values([component.centroid.x for component in pavers], 0.05)
    y_groups = grouped_values([component.centroid.y for component in pavers], 0.05)
    check(
        len(x_groups) == 2 and sorted(map(len, x_groups)) == [3, 3],
        "StoneWalkway.two-columns",
        f"groups={[len(group) for group in x_groups]}",
    )
    check(
        len(y_groups) == 3 and sorted(map(len, y_groups)) == [2, 2, 2],
        "StoneWalkway.three-rows",
        f"groups={[len(group) for group in y_groups]}",
    )
    minimum = Vector(
        tuple(min(component.bounds_min[axis] for component in pavers) for axis in range(3))
    )
    maximum = Vector(
        tuple(max(component.bounds_max[axis] for component in pavers) for axis in range(3))
    )
    check(
        minimum.x <= -0.4999
        and maximum.x >= 0.4999
        and minimum.y <= -0.4999
        and maximum.y >= 0.4999,
        "StoneWalkway.four-edge-connectivity",
        f"bounds=({minimum.x:.4f},{minimum.y:.4f})..({maximum.x:.4f},{maximum.y:.4f})",
    )
    check(
        "StoneWalkway_SupportRails" not in objects,
        "StoneWalkway.no-support-rails",
    )


def audit_hazel() -> None:
    objects = load("HazelLightArch")
    poles = objects["HazelLightArch_Poles"][1]
    assert_solid("HazelLightArch.poles", poles)
    pole_min = Vector(
        tuple(min(component.bounds_min[axis] for component in poles) for axis in range(3))
    )
    pole_max = Vector(
        tuple(max(component.bounds_max[axis] for component in poles) for axis in range(3))
    )
    dimensions = pole_max - pole_min
    check(
        dimensions.x <= 0.14 and dimensions.y >= 1.55,
        "HazelLightArch.one-thin-plane",
        f"dimensions={[round(value, 4) for value in dimensions]}",
    )
    ground_legs = [
        component
        for component in poles
        if component.bounds_min.z <= 0.002 and component.bounds_max.z >= 0.75
    ]
    check(
        len(ground_legs) == 2,
        "HazelLightArch.two-ground-legs",
        f"count={len(ground_legs)} y={[round(component.centroid.y, 3) for component in ground_legs]}",
    )
    top_rods = [
        component
        for component in poles
        if component.dimensions.y >= 1.35 and component.bounds_min.z >= 1.30
    ]
    check(len(top_rods) == 2, "HazelLightArch.two-top-rods", f"count={len(top_rods)}")
    check(
        "HazelLightArch_LimestoneFootings" not in objects,
        "HazelLightArch.no-limestone-footings",
    )
    low_broad_supports = [
        component
        for component in poles
        if component.bounds_min.z <= 0.08
        and component.bounds_max.z <= 0.13
        and component.dimensions.x >= 0.10
        and component.dimensions.y >= 0.10
    ]
    check(
        len(low_broad_supports) == 0,
        "HazelLightArch.no-foot-or-shoe-components",
        f"count={len(low_broad_supports)}",
    )
    bulbs = objects.get("HazelLightArch_Bulbs", (None, []))[1]
    shades = objects.get("HazelLightArch_TerracottaShades", (None, []))[1]
    check(len(bulbs) == 3, "HazelLightArch.three-bulbs", f"count={len(bulbs)}")
    check(len(shades) == 6, "HazelLightArch.three-shades-and-rims", f"components={len(shades)}")


def audit_roof() -> None:
    objects = load("RoofTileLantern")
    petals = objects["RoofTileLantern_Tiles"][1]
    check(len(petals) == 4, "RoofTileLantern.four-petals", f"count={len(petals)}")
    assert_solid("RoofTileLantern.petals", petals)
    check(
        all(component.euler == 0 for component in petals),
        "RoofTileLantern.leaf-through-holes",
        f"euler={[component.euler for component in petals]}",
    )
    check(
        all(
            component.dimensions.z >= 0.30
            and min(component.dimensions.x, component.dimensions.y) <= 0.12
            for component in petals
        ),
        "RoofTileLantern.tall-thin-petals",
        f"dims={[[round(value, 3) for value in component.dimensions] for component in petals]}",
    )
    overlap_counts = [
        len(left.bvh.overlap(right.bvh))
        for left, right in combinations(petals, 2)
    ]
    check(
        all(count == 0 for count in overlap_counts),
        "RoofTileLantern.open-seams",
        f"pair-overlaps={overlap_counts}",
    )


def ribbon_centerline(obj: bpy.types.Object, component: Component) -> list[Vector]:
    indexes = sorted(component.vertex_indexes)
    if len(indexes) % 4 != 0:
        return []
    return [
        sum((obj.data.vertices[index].co for index in indexes[offset : offset + 4]), Vector()) / 4
        for offset in range(0, len(indexes), 4)
    ]


def wrap_angle(value: float) -> float:
    return (value + math.pi) % (2 * math.pi) - math.pi


def audit_wicker() -> None:
    objects = load("WickerGardenLantern")
    obj, wicker_components = objects["WickerGardenLantern_Wicker"]
    anchor = [component for component in wicker_components if component.dimensions.z < 0.05]
    ribbons = [component for component in wicker_components if component.dimensions.z >= 0.40]
    check(len(anchor) == 1, "WickerGardenLantern.anchor-ring", f"count={len(anchor)}")
    check(
        len(ribbons) == 12,
        "WickerGardenLantern.twelve-half-helix-bands",
        f"count={len(ribbons)}",
    )
    assert_solid("WickerGardenLantern.bands", ribbons)
    deltas: list[float] = []
    rises: list[float] = []
    widths: list[float] = []
    for component in ribbons:
        centerline = ribbon_centerline(obj, component)
        if len(centerline) < 2:
            continue
        start, end = centerline[0], centerline[-1]
        deltas.append(wrap_angle(math.atan2(end.y, end.x) - math.atan2(start.y, start.x)))
        rises.append(end.z - start.z)
        ordered = sorted(component.vertex_indexes)
        widths.append((obj.data.vertices[ordered[1]].co - obj.data.vertices[ordered[0]].co).length)
    positive_diagonals = sum(delta > 2.0 for delta in deltas)
    negative_diagonals = sum(delta < -2.0 for delta in deltas)
    check(
        len(deltas) == len(ribbons)
        and positive_diagonals == negative_diagonals
        and positive_diagonals + negative_diagonals == len(ribbons),
        "WickerGardenLantern.balanced-opposing-diagonals",
        f"positive={positive_diagonals} negative={negative_diagonals} angle-deltas={[round(delta, 3) for delta in deltas]}",
    )
    check(
        len(rises) == len(ribbons) and all(rise >= 0.46 for rise in rises),
        "WickerGardenLantern.monotonic-base-to-crown-rise",
        f"rises={[round(rise, 3) for rise in rises]}",
    )
    check(
        len(widths) == len(ribbons) and all(0.024 <= width <= 0.031 for width in widths),
        "WickerGardenLantern.narrow-dense-bands",
        f"widths={[round(width, 3) for width in widths]}",
    )
    pair_overlaps = [
        ((left_index, right_index), len(left.bvh.overlap(right.bvh)))
        for (left_index, left), (right_index, right) in combinations(
            enumerate(ribbons), 2
        )
    ]
    check(
        len(pair_overlaps) == 66 and all(count == 0 for _, count in pair_overlaps),
        "WickerGardenLantern.over-under-clearance",
        f"pair-overlaps={pair_overlaps}",
    )


def audit_moon() -> None:
    objects = load("MoonRainBarrel")
    staves = objects["MoonRainBarrel_Staves"][1]
    check(len(staves) == 8, "MoonRainBarrel.eight-staves", f"count={len(staves)}")
    assert_solid("MoonRainBarrel.staves", staves)
    band_components = objects["MoonRainBarrel_Bands"][1]
    panels = [
        component
        for component in band_components
        if max(component.dimensions.x, component.dimensions.y) >= 0.12
        and component.dimensions.z <= 0.06
    ]
    bolts = [
        component
        for component in band_components
        if max(component.dimensions.x, component.dimensions.y) < 0.04
        and component.dimensions.z < 0.04
    ]
    check(len(panels) == 16, "MoonRainBarrel.narrow-band-panels", f"count={len(panels)}")
    check(len(bolts) == 16, "MoonRainBarrel.band-bolts", f"count={len(bolts)}")
    z_groups = grouped_values([component.centroid.z for component in panels], 0.04)
    check(
        len(z_groups) == 2 and all(len(group) == 8 for group in z_groups),
        "MoonRainBarrel.two-primary-bands",
        f"groups={[len(group) for group in z_groups]}",
    )
    feet = objects["MoonRainBarrel_LimestoneFeet"][1]
    check(len(feet) == 2, "MoonRainBarrel.two-feet", f"count={len(feet)}")
    assert_solid("MoonRainBarrel.feet", feet)
    lid = objects["MoonRainBarrel_Lid"][1]
    assert_solid("MoonRainBarrel.lid", lid)
    lid_segments = [component for component in lid if component.volume >= 0.0004]
    lid_min = Vector(tuple(min(component.bounds_min[axis] for component in lid) for axis in range(3)))
    lid_max = Vector(tuple(max(component.bounds_max[axis] for component in lid) for axis in range(3)))
    lid_centroid = sum((component.centroid for component in lid), Vector()) / len(lid)
    check(
        len(lid_segments) >= 6,
        "MoonRainBarrel.segmented-lid",
        f"structural-components={len(lid_segments)} total={len(lid)}",
    )
    check(
        lid_max.z - lid_min.z >= 0.38 and lid_max.z >= 0.90 and lid_centroid.y >= 0.10,
        "MoonRainBarrel.propped-rear-lid",
        f"z-span={lid_max.z - lid_min.z:.3f} z-max={lid_max.z:.3f} centroid-y={lid_centroid.y:.3f}",
    )


def audit_wooden_hand() -> None:
    objects = load("WoodenHandLantern")
    check(
        "WoodenHandLantern_LimestoneBase" not in objects,
        "WoodenHandLantern.no-limestone-base",
    )
    frame = objects["WoodenHandLantern_Frame"][1]
    frame_min_z = min(component.bounds_min.z for component in frame)
    check(
        abs(frame_min_z) <= 0.002,
        "WoodenHandLantern.wood-frame-grounded",
        f"min-z={frame_min_z:.4f}",
    )


for audit in (
    audit_stone,
    audit_hazel,
    audit_roof,
    audit_wicker,
    audit_moon,
    audit_wooden_hand,
):
    audit()

print(f"CONTRACT SUMMARY failures={len(FAILURES)}")
for failure in FAILURES:
    print(f"CONTRACT FAILURE {failure}")
sys.exit(1 if FAILURES else 0)
