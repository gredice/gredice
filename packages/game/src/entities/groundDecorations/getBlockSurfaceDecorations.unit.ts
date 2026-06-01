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

test('positions reverse corner decorations away from the low local corner', () => {
    const block = {
        id: 'reverse-corner-grass-test',
        name: 'Block_Grass_Reverse_Corner',
        rotation: 0,
    } satisfies Block;
    const placements = getBlockSurfaceDecorations({
        block,
        gardenId: 42,
        surface: 'grass',
    });
    const firstPlacement = placements[0];

    assert.ok(firstPlacement);

    const expectedY =
        groundDecorationOptions.grass.baseY +
        (Math.max(firstPlacement.position[0], firstPlacement.position[2]) -
            0.5) *
            groundDecorationOptions.grass.angleLiftPerUnit;

    assert.equal(round(firstPlacement.position[1]), round(expectedY));
});

test('adds larger colored flower clusters to grass decorations', () => {
    const flowerOptions = groundDecorationOptions.grass.flowers;
    const flowerColors = new Set<string>();
    const flowerSprites = new Set<string>();
    let flowerCount = 0;

    assert.ok(flowerOptions);

    for (let index = 0; index < 16; index += 1) {
        const block = {
            id: `flower-grass-test-${index}`,
            name: 'Block_Grass',
            rotation: 0,
        } satisfies Block;
        const placements = getBlockSurfaceDecorations({
            block,
            gardenId: 42,
            surface: 'grass',
        });

        for (const flower of placements) {
            if (flower.kind !== 'flower') {
                continue;
            }

            flowerCount += 1;
            flowerColors.add(flower.color);
            flowerSprites.add(flower.spriteName);
            assert.ok(flower.scale >= flowerOptions.scaleRange[0]);
            assert.ok(flower.scale <= flowerOptions.scaleRange[1]);
        }
    }

    assert.ok(flowerCount > 0);
    assert.ok(flowerColors.size >= 3);
    assert.ok(flowerSprites.size >= 3);
});

test('does not add flower clusters to sand decorations', () => {
    const block = {
        id: 'flower-sand-test',
        name: 'Block_Sand',
        rotation: 0,
    } satisfies Block;
    const placements = getBlockSurfaceDecorations({
        block,
        gardenId: 42,
        surface: 'sand',
    });

    assert.equal(
        placements.filter((placement) => placement.kind === 'flower').length,
        0,
    );
});
