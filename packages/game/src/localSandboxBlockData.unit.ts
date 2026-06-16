import assert from 'node:assert/strict';
import test from 'node:test';
import { getLocalSandboxBlockData } from './localSandboxBlockData';

test('local sandbox grass block data uses the rendered surface height', () => {
    const blockData = getLocalSandboxBlockData();
    const grass = blockData.find(
        (block) => block.information.name === 'Block_Grass',
    );

    assert.equal(grass?.attributes.height, 0.4);
    assert.equal(grass?.attributes.stackable, true);
});

test('local sandbox shaped terrain uses the rendered surface height', () => {
    const blockData = getLocalSandboxBlockData();
    const blockNames = [
        'Block_Grass_Angle',
        'Block_Ground_Angle',
        'Block_Sand_Angle',
        'Block_Grass_Corner',
        'Block_Ground_Corner',
        'Block_Sand_Corner',
        'Block_Grass_Reverse_Corner',
        'Block_Ground_Reverse_Corner',
        'Block_Sand_Reverse_Corner',
    ];

    for (const blockName of blockNames) {
        const block = blockData.find(
            (item) => item.information.name === blockName,
        );

        assert.equal(block?.attributes.height, 0.4);
        assert.equal(block?.attributes.stackable, true);
    }
});

test('local sandbox exposes special seasonal blocks', () => {
    const blockData = getLocalSandboxBlockData();
    const blockNames = new Set(
        blockData.map((block) => block.information.name),
    );

    assert.equal(blockNames.has('Snowman'), true);
    assert.equal(blockNames.has('GiftBox_RedWhite'), true);
    assert.equal(blockNames.has('PineAdvent'), true);
    assert.equal(blockNames.has('Block_Snow_Falling'), true);
});

test('local sandbox summer hat metadata matches the reduced visual scale', () => {
    const blockData = getLocalSandboxBlockData();
    const summerHat = blockData.find(
        (block) => block.information.name === 'SummerHat',
    );

    assert.equal(summerHat?.attributes.height, 0.2);
    assert.equal(summerHat?.attributes.hitboxDepth, 0.64);
    assert.equal(summerHat?.attributes.hitboxHeight, 0.2);
    assert.equal(summerHat?.attributes.hitboxWidth, 0.8);
});

test('local sandbox exposes animal home blocks used by the item HUD', () => {
    const blockData = getLocalSandboxBlockData();
    const blockNames = new Set(
        blockData.map((block) => block.information.name),
    );

    assert.equal(blockNames.has('CatPillow'), true);
    assert.equal(blockNames.has('DogHouse'), true);
});

test('local sandbox exposes flower decorations used by the item HUD', () => {
    const blockData = getLocalSandboxBlockData();
    const blockNames = new Set(
        blockData.map((block) => block.information.name),
    );
    const sunflower = blockData.find(
        (block) => block.information.name === 'Sunflower',
    );

    assert.equal(blockNames.has('Tulip'), true);
    assert.equal(blockNames.has('Sunflower'), true);
    assert.equal(sunflower?.attributes.height, 1);
});

test('local sandbox does not expose mulch as placeable blocks', () => {
    const blockData = getLocalSandboxBlockData();
    const blockNames = new Set(
        blockData.map((block) => block.information.name),
    );

    assert.equal(blockNames.has('BaleHey'), false);
    assert.equal(blockNames.has('MulchHey'), false);
    assert.equal(blockNames.has('MulchCoconut'), false);
    assert.equal(blockNames.has('MulchWood'), false);
});
