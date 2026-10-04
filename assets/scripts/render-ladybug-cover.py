#!/usr/bin/env python3
"""Render the Ladybug source into its transparent public directory cover."""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def point_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_area_light(
    name: str,
    location: tuple[float, float, float],
    energy: float,
    size: float,
) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    light = bpy.data.objects.new(name, data)
    light.location = location
    bpy.context.collection.objects.link(light)
    point_at(light, (0, 0, 0.25))


def render_cover(input_path: Path, output_path: Path) -> None:
    bpy.ops.wm.open_mainfile(filepath=str(input_path.resolve()))
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.quality = 92
    scene.view_settings.look = "AgX - Medium High Contrast"

    world = scene.world or bpy.data.worlds.new("Ladybug Cover World")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background:
        background.inputs["Color"].default_value = (0.12, 0.16, 0.1, 1)
        background.inputs["Strength"].default_value = 0.7

    root = bpy.data.objects.get("Ladybug_Root")
    if root is None:
        raise RuntimeError("Ladybug_Root is missing from the source asset.")
    root.rotation_euler.z = math.radians(-18)

    camera_data = bpy.data.cameras.new("Ladybug Cover Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 1.65
    camera = bpy.data.objects.new("Ladybug Cover Camera", camera_data)
    camera.location = (2.8, -3.8, 2.7)
    bpy.context.collection.objects.link(camera)
    point_at(camera, (0, 0.02, 0.27))
    scene.camera = camera

    add_area_light("Ladybug Cover Key", (-3.2, -3.0, 5.2), 760, 4.0)
    add_area_light("Ladybug Cover Fill", (3.6, 1.8, 3.0), 430, 3.0)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output_path.resolve())
    bpy.ops.render.render(write_still=True)


def main() -> None:
    args = parse_args()
    render_cover(args.input, args.output)


if __name__ == "__main__":
    main()
