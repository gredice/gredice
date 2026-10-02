import assert from 'node:assert/strict';
import test from 'node:test';
import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import {
    createAutumnFoliageGeometry,
    getAutumnFoliageProgress,
} from './autumnFoliageGeometry';
import { getAutumnLeafColor } from './autumnPalette';
import { getAutumnState } from './autumnState';
import { bushTextureColor } from './bushFoliage';
import { getSeasonState } from './seasonState';

test('textured bush foliage preserves summer and compensates the green palette in winter', () => {
    const source = new BufferGeometry().setAttribute(
        'position',
        new Float32BufferAttribute([0, 0, 0, 0, 1, 0], 3),
    );
    const white = new Color('white');
    for (const progress of [0, 0.4, 1]) {
        const geometry = createAutumnFoliageGeometry(
            source,
            source,
            white,
            progress,
            'bush',
            bushTextureColor,
        );
        const colors = geometry.getAttribute('color');
        for (let index = 0; index < 2; index++) {
            const rendered = new Color()
                .fromBufferAttribute(colors, index)
                .multiply(bushTextureColor);
            const expected = getAutumnLeafColor(
                bushTextureColor,
                getAutumnFoliageProgress(progress, index),
                'bush',
            );
            assert.equal(rendered.getHexString(), expected.getHexString());
            if (progress === 0)
                assert.equal(
                    new Color()
                        .fromBufferAttribute(colors, index)
                        .getHexString(),
                    'ffffff',
                );
        }
        geometry.dispose();
    }
    assert.equal(source.getAttribute('color'), undefined);
    assert.equal(white.getHexString(), 'ffffff');
    source.dispose();
});

test('yellowing advances downwards with exact summer and winter endpoints', () => {
    for (const progress of [0, 0.05, 0.2, 0.5, 0.8, 1]) {
        let previous = -1;
        for (const height of [0, 0.25, 0.5, 0.75, 1]) {
            const value = getAutumnFoliageProgress(progress, height);
            assert.ok(value >= previous && value <= 1);
            if (progress === 0 || progress === 1) assert.equal(value, progress);
            previous = value;
        }
    }
    assert.ok(
        getAutumnFoliageProgress(0.2, 1) > getAutumnFoliageProgress(0.2, 0.5),
    );
    assert.equal(getAutumnFoliageProgress(0.2, 0), 0);
    assert.equal(getAutumnFoliageProgress(NaN, 1), 0);
});

test('canopy and sprigs share local heights without changing cached GLTF geometry or colour', () => {
    const canopy = new BufferGeometry().setAttribute(
        'position',
        new Float32BufferAttribute([0, 2, 0, 0, 3, 0, 0, 4, 0], 3),
    );
    const sprigs = new BufferGeometry().setAttribute(
        'position',
        new Float32BufferAttribute([1, 3, 0, 1, 4, 0, 1, 5, 0], 3),
    );
    const base = new Color('#458a36');
    const original = base.clone();
    const progress = getAutumnState(
        getSeasonState(new Date(2024, 8, 22)),
    ).foliageColorProgress;
    const coloredCanopy = createAutumnFoliageGeometry(
        canopy,
        canopy,
        base,
        progress,
        'tree',
    );
    const coloredSprigs = createAutumnFoliageGeometry(
        sprigs,
        canopy,
        base,
        progress,
        'tree',
    );
    const canopyColors = coloredCanopy.getAttribute('color');
    const sprigColors = coloredSprigs.getAttribute('color');
    const bottom = new Color().fromBufferAttribute(canopyColors, 0);
    const top = new Color().fromBufferAttribute(canopyColors, 2);
    assert.equal(bottom.getHexString(), base.getHexString());
    assert.ok(
        top.r / top.g > bottom.r / bottom.g,
        'crown is yellower than the base',
    );
    assert.equal(
        top.getHexString(),
        getAutumnLeafColor(base, progress, 'tree').getHexString(),
    );
    for (const [canopyIndex, sprigIndex] of [
        [1, 0],
        [2, 1],
        [2, 2],
    ]) {
        assert.deepEqual(
            new Color().fromBufferAttribute(canopyColors, canopyIndex),
            new Color().fromBufferAttribute(sprigColors, sprigIndex),
        );
    }
    assert.equal(canopy.getAttribute('color'), undefined);
    assert.equal(sprigs.getAttribute('color'), undefined);
    assert.equal(canopy.boundingBox, null);
    assert.deepEqual(base, original);
    assert.notEqual(
        coloredCanopy.getAttribute('position'),
        canopy.getAttribute('position'),
    );
    for (const geometry of [canopy, sprigs, coloredCanopy, coloredSprigs])
        geometry.dispose();
});
