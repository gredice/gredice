import assert from 'node:assert/strict';
import test from 'node:test';
import type { Block } from '../../types/Block';
import { getBlockSurfaceDecorations } from './getBlockSurfaceDecorations';
import { groundDecorationOptions } from './groundDecorationConfig';

function round(value: number) {
    return Number(value.toFixed(6));
}

test('positions angled block decorations along the local x slope', () => {
    const block = {
        id: 'angled-grass-test',
        name: 'Block_Grass_Angle',
        rotation: 0,
    } satisfies Block;
    const placements = getBlockSurfaceDecorations({
        block,
        gardenId: 42,
        surface: 'grass',
    });
    const firstPlacement = placements[0];

    assert.ok(firstPlacement);
    assert.ok(
        Math.abs(firstPlacement.position[0] - firstPlacement.position[2]) >
            0.01,
    );

    const expectedY =
        groundDecorationOptions.grass.baseY +
        (firstPlacement.position[0] - 0.5) *
            groundDecorationOptions.grass.angleLiftPerUnit;

    assert.equal(round(firstPlacement.position[1]), round(expectedY));
});

test('positions corner block decorations toward the raised local corner', () => {
    const block = {
        id: 'corner-sand-test',
        name: 'Block_Sand_Corner',
        rotation: 0,
    } satisfies Block;
    const placements = getBlockSurfaceDecorations({
        block,
        gardenId: 42,
        surface: 'sand',
    });
    const firstPlacement = placements[0];

    assert.ok(firstPlacement);

    const expectedY =
        groundDecorationOptions.sand.baseY +
        (Math.min(firstPlacement.position[0], firstPlacement.position[2]) -
            0.5) *
            groundDecorationOptions.sand.angleLiftPerUnit;

    assert.equal(round(firstPlacement.position[1]), round(expectedY));
});

test('occasionally adds tiny white flower decorations to grass', () => {
    const block = {
        id: 'grass-8',
        name: 'Block_Grass',
        rotation: 0,
    } satisfies Block;
    const placements = getBlockSurfaceDecorations({
        block,
        gardenId: 42,
        surface: 'grass',
    });
    const flower = placements.find((placement) => placement.kind === 'flower');
    const flowerScaleRange = groundDecorationOptions.grass.flowerScaleRange;

    assert.ok(flower);
    assert.ok(flowerScaleRange);
    assert.equal(flower.color, groundDecorationOptions.grass.flowerColor);
    assert.equal(flower.scale >= flowerScaleRange[0], true);
    assert.equal(flower.scale <= flowerScaleRange[1], true);
});
