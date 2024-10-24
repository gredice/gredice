#!/bin/bash

/Applications/Blender.app/Contents/MacOS/Blender -b GameAssets.blend \
  --python-expr "import bpy; bpy.ops.export_scene.gltf(filepath='../apps/garden/public/assets/models/GameAssets.glb',export_apply=True)"