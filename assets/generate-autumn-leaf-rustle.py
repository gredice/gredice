#!/usr/bin/env python3
"""Original, deterministic dry-leaf foley synthesis; no third-party recording.

Writes the same versioned six-second mono WAV to both game asset hosts. Sparse,
band-limited scrape/crinkle grains leave low frequencies free for general wind.
Run from any directory with Python 3; only standard-library modules are used.
"""
import math
from pathlib import Path
import random
import struct
import wave

ROOT = Path(__file__).resolve().parent.parent
RATE = 22050
LENGTH = RATE * 6
rng = random.Random('gredice-autumn-rustle-v1')
samples = [0.0] * LENGTH
for _ in range(140):
    start = rng.randrange(LENGTH)
    count = int(RATE * rng.uniform(0.025, 0.19))
    amplitude = rng.uniform(0.08, 0.4)
    low = 0.0
    band = 0.0
    for index in range(count):
        noise = rng.uniform(-1, 1)
        low += 0.18 * (noise - low)
        band += 0.65 * (noise - low - band)
        envelope = math.sin(math.pi * index / (count - 1)) ** 2
        samples[(start + index) % LENGTH] += amplitude * envelope * band
# Join at silence with a very short smooth seam; no discontinuous loop click.
for index in range(220):
    gain = math.sin(math.pi * index / 438) ** 2
    samples[index] *= gain
    samples[-1-index] *= gain
peak = max(abs(value) for value in samples)
samples = [value * 0.42 / peak for value in samples]
frames = b''.join(struct.pack('<h', round(value * 32767)) for value in samples)
for app in ('garden', 'www'):
    target = ROOT / 'apps' / app / 'public/assets/sounds/autumn-leaf-rustle-v1.wav'
    target.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(target), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(frames)
print(f'leaf rustle: {LENGTH/RATE:.1f}s, peak {max(map(abs, samples)):.3f}, RMS {math.sqrt(sum(v*v for v in samples)/LENGTH):.4f}, seam {samples[0]:.1f}/{samples[-1]:.1f}')
