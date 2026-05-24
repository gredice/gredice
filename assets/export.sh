#!/bin/bash

BLENDER_BINARY="${BLENDER_BINARY:-/Applications/Blender.app/Contents/MacOS/Blender}"

"$BLENDER_BINARY" -b --python export-game-assets.py
