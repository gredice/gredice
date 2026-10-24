#!/usr/bin/env python3
"""Original deterministic, loopable wind textures; no third-party samples.

Run with Python 3 (standard library only). Versioned mono WAVs are mirrored to
both game hosts, just like the leaf-rustle asset. Circular band-limited noise
and periodic gust envelopes keep the loop seam continuous without silence dips.
"""
import math
from pathlib import Path
import random
import struct
import wave

ROOT = Path(__file__).resolve().parent.parent
RATE = 22050
SECONDS = 12
LENGTH = RATE * SECONDS

for name, highpass, lowpass, target_rms in (
    ('light', 80, 650, 0.10),
    ('medium', 40, 1000, 0.12),
    ('strong', 25, 1400, 0.14),
):
    rng = random.Random(f'gredice-wind-{name}-v1')
    noise = [rng.uniform(-1, 1) for _ in range(LENGTH)]
    low_alpha = 1 - math.exp(-2 * math.pi * lowpass / RATE)
    high_alpha = 1 - math.exp(-2 * math.pi * highpass / RATE)
    low = high = 0.0
    samples = []
    # Warm the filters through a complete cycle to reach their periodic state.
    for cycle in range(2):
        for index, value in enumerate(noise):
            low += low_alpha * (value - low)
            high += high_alpha * (low - high)
            if cycle:
                phase = 2 * math.pi * index / LENGTH
                gust = 0.7 + 0.2 * math.sin(phase) + 0.1 * math.sin(3 * phase + 0.7)
                samples.append((low - high) * gust)
    rms = math.sqrt(sum(value * value for value in samples) / LENGTH)
    scale = min(target_rms / rms, 0.7 / max(map(abs, samples)))
    samples = [value * scale for value in samples]
    frames = b''.join(struct.pack('<h', round(value * 32767)) for value in samples)
    for app in ('garden', 'www'):
        target = ROOT / 'apps' / app / f'public/assets/sounds/wind-{name}-v1.wav'
        target.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(target), 'wb') as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(RATE)
            output.writeframes(frames)
    peak = max(map(abs, samples))
    seam = abs(samples[0] - samples[-1])
    adjacent = max(abs(a - b) for a, b in zip(samples, samples[1:]))
    assert seam <= adjacent and peak <= 0.700001
    print(f'{name}: {SECONDS}s, peak {peak:.3f}, RMS {rms * scale:.3f}, seam step {seam:.4f}, max adjacent step {adjacent:.4f}')
