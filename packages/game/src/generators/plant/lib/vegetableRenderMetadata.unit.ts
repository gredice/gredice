import assert from 'node:assert/strict';
import test from 'node:test';
import {
    resolveVegetableColor,
    vegetableMaterialProps,
} from './vegetableRenderMetadata';

test('keeps tomatoes green before ripening and deep red at maturity', () => {
    assert.equal(resolveVegetableColor('tomato', 0), '#6f8135');
    assert.equal(resolveVegetableColor('tomato', 0.55), '#6f8135');
    assert.equal(resolveVegetableColor('tomato', 1), '#d62828');
    assert.equal(vegetableMaterialProps.tomato.color, '#d62828');

    const turningColor = resolveVegetableColor('tomato', 0.8);
    assert.notEqual(turningColor, '#6f8135');
    assert.notEqual(turningColor, '#d62828');
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

    assert.equal(resolveVegetableColor('cucumber', 0), '#2e591a');
    assert.equal(resolveVegetableColor('cucumber', 0.5), '#2e591a');
    assert.equal(resolveVegetableColor('cucumber', 1), '#2e591a');
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
