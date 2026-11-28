import assert from 'node:assert/strict';
import test from 'node:test';
import {
    resolveVegetableColor,
    vegetableMaterialProps,
} from './vegetableRenderMetadata';

test('keeps tomatoes green before ripening and ripe red at maturity', () => {
    assert.equal(resolveVegetableColor('tomato', 0), '#708a3b');
    assert.equal(resolveVegetableColor('tomato', 0.55), '#708a3b');
    assert.equal(resolveVegetableColor('tomato', 1), '#9c241b');
    assert.equal(vegetableMaterialProps.tomato.color, '#9c241b');

    const turningColor = resolveVegetableColor('tomato', 0.8);
    assert.notEqual(turningColor, '#708a3b');
    assert.notEqual(turningColor, '#9c241b');
});

test('ripens color-changing produce while preserving fixed-color produce', () => {
    for (const type of [
        'strawberry',
        'blueberry',
        'raspberry',
        'bellpepper',
        'eggplant',
        'pumpkin',
    ] as const) {
        assert.notEqual(
            resolveVegetableColor(type, 0),
            resolveVegetableColor(type, 1),
        );
        assert.equal(
            resolveVegetableColor(type, 1),
            vegetableMaterialProps[type].color,
        );
    }

    assert.equal(resolveVegetableColor('cucumber', 0), '#367032');
    assert.equal(resolveVegetableColor('cucumber', 0.5), '#367032');
    assert.equal(resolveVegetableColor('cucumber', 1), '#367032');
});

test('clamps produce maturity outside the lifecycle range', () => {
    assert.equal(
        resolveVegetableColor('tomato', -1),
        resolveVegetableColor('tomato', 0),
    );
    assert.equal(
        resolveVegetableColor('tomato', 2),
        resolveVegetableColor('tomato', 1),
    );
});
