import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolveWindAmbience } from './windAmbienceState';

test('calm and invalid wind stay silent while each weather strength has its own texture', () => {
    for (const wind of [0, 0.25, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert(resolveWindAmbience(wind).every(({ gain }) => gain === 0));
    }
    for (const [index, wind] of [1, 2, 3].entries()) {
        const layers = resolveWindAmbience(wind);
        assert(layers[index].gain > 0);
        assert(
            layers.every(({ gain }, other) => other === index || gain === 0),
        );
    }
});

test('crossfades are continuous, bounded and leave headroom under rain', () => {
    let previous = 0;
    for (let wind = 0; wind <= 3; wind += 0.005) {
        const dry = resolveWindAmbience(wind);
        const wet = resolveWindAmbience(wind, 1);
        const total = dry.reduce((sum, layer) => sum + layer.gain, 0);
        assert(total >= previous && total <= 0.260001);
        previous = total;
        const next = resolveWindAmbience(wind + 0.00001);
        dry.forEach(({ gain }, index) => {
            assert(gain >= 0);
            assert(Math.abs(gain - next[index].gain) < 0.00001);
            assert(Math.abs(wet[index].gain - gain * 0.7) < 1e-10);
        });
    }
    assert.deepEqual(resolveWindAmbience(100, -1), resolveWindAmbience(3, 0));
});

test('all wind assets are identical on both hosts and have bounded continuous PCM seams', () => {
    for (const { name } of resolveWindAmbience()) {
        const path = `public/assets/sounds/wind-${name}-v1.wav`;
        const garden = readFileSync(
            new URL(`../../../../apps/garden/${path}`, import.meta.url),
        );
        const www = readFileSync(
            new URL(`../../../../apps/www/${path}`, import.meta.url),
        );
        assert.deepEqual(garden, www);
        assert.equal(garden.toString('ascii', 0, 4), 'RIFF');
        assert.equal(garden.toString('ascii', 36, 40), 'data');
        assert.equal(garden.readUInt16LE(22), 1);
        assert.equal(garden.readUInt32LE(24), 22050);
        assert.equal(garden.readUInt16LE(34), 16);
        assert.equal(garden.length, 44 + 22050 * 12 * 2);
        let peak = 0;
        let maxStep = 0;
        let energy = 0;
        for (let offset = 44; offset < garden.length; offset += 2) {
            const sample = garden.readInt16LE(offset);
            peak = Math.max(peak, Math.abs(sample));
            energy += sample * sample;
            if (offset > 44)
                maxStep = Math.max(
                    maxStep,
                    Math.abs(sample - garden.readInt16LE(offset - 2)),
                );
        }
        assert(peak <= 0.701 * 32767);
        assert(Math.sqrt(energy / (22050 * 12)) > 0.07 * 32767);
        assert(
            Math.abs(
                garden.readInt16LE(44) - garden.readInt16LE(garden.length - 2),
            ) <= maxStep,
        );
    }
});
