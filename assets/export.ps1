$BlenderBinary = if ($env:BLENDER_BINARY) { $env:BLENDER_BINARY } else { "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" }

& $BlenderBinary '-b' '--python' './export-game-assets.py'
