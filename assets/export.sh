#!/bin/bash

if [ -z "${BLENDER_BINARY:-}" ]; then
    if [ "$(uname -s)" = "Darwin" ]; then
        BLENDER_BINARY="/Applications/Blender.app/Contents/MacOS/Blender"
    else
        BLENDER_BINARY="blender"
    fi
fi

"$BLENDER_BINARY" -b --python export-game-assets.py
