#!/usr/bin/env python3
"""Original deterministic six-second fire foley; no recordings or external samples."""
import math
from pathlib import Path
import random
import struct
import wave

ROOT = Path(__file__).resolve().parent.parent
RATE = 22050
LENGTH = RATE * 6
rng = random.Random('gredice-contained-crackle-v1')
samples = [0.0] * LENGTH
# Sparse short, rounded crackles over a quiet band-limited ember bed.
low = 0.0
for index in range(LENGTH):
    low += 0.035 * (rng.uniform(-1, 1) - low)
    samples[index] = low * 0.08
for _ in range(48):
    start = rng.randrange(LENGTH)
    count = int(RATE * rng.uniform(0.012, 0.065))
    amplitude = rng.uniform(0.04, 0.3)
    filtered = 0.0
    for index in range(count):
        filtered += 0.3 * (rng.uniform(-1, 1) - filtered)
        envelope = math.sin(math.pi * index / (count - 1)) ** 2
        samples[(start + index) % LENGTH] += amplitude * envelope * filtered
for index in range(220):
    gain = math.sin(math.pi * index / 438) ** 2
    samples[index] *= gain
    samples[-1-index] *= gain
peak = max(map(abs, samples))
samples = [value * 0.4 / peak for value in samples]
frames = b''.join(struct.pack('<h', round(value * 32767)) for value in samples)
for app in ('garden', 'www'):
    target = ROOT / 'apps' / app / 'public/assets/sounds/warm-prop-crackle-v1.wav'
    target.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(target), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(frames)
print(f'crackle: 6s, peak {max(map(abs, samples)):.3f}, RMS {math.sqrt(sum(v*v for v in samples)/LENGTH):.4f}')
