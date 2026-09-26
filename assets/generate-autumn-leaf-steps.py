#!/usr/bin/env python3
"""Original deterministic leaf-crunch foley. No third-party samples.

Three short mono PCM variants, shared by both game asset hosts. Python stdlib only.
"""
import math
from pathlib import Path
import random
import struct
import wave

ROOT = Path(__file__).resolve().parent.parent
RATE = 22050
for variant in range(1, 4):
    rng = random.Random(f'gredice-leaf-step-v1:{variant}')
    length = int(RATE * (0.15 + variant * 0.015))
    samples = [0.0] * length
    # A compressed initial crinkle followed by smaller settling grains.
    for grain in range(30):
        start = int(rng.random() ** 2 * (length - RATE * 0.035))
        count = min(int(RATE * rng.uniform(0.003, 0.032)), length - start)
        low = 0.0
        band = 0.0
        for index in range(count):
            noise = rng.uniform(-1, 1)
            low += 0.12 * (noise - low)
            band += 0.6 * (noise - low - band)
            envelope = math.sin(math.pi * index / (count - 1)) ** 2
            samples[start + index] += band * envelope * (1 - start / length)
    peak = max(map(abs, samples))
    samples = [value * 0.65 / peak for value in samples]
    frames = b''.join(struct.pack('<h', round(value * 32767)) for value in samples)
    for app in ('garden', 'www'):
        target = ROOT / 'apps' / app / 'public/assets/sounds' / f'autumn-leaf-step-v1-{variant}.wav'
        target.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(target), 'wb') as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(RATE)
            output.writeframes(frames)
    print(f'variant {variant}: {length/RATE:.3f}s, peak 0.65, RMS {math.sqrt(sum(v*v for v in samples)/length):.4f}')
