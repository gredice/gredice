import assert from 'node:assert/strict';
import test from 'node:test';
import { arrowSignConfigs, arrowSignNames } from './entities/signageConfig';
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

test('local sandbox exposes the wooden bench with production dimensions', () => {
    const blockData = getLocalSandboxBlockData();
    const woodenBench = blockData.find(
        (block) => block.information.name === 'WoodenBench',
    );

    assert.equal(woodenBench?.attributes.height, 0.41);
    assert.equal(woodenBench?.attributes.hitboxDepth, 0.36);
    assert.equal(woodenBench?.attributes.hitboxHeight, 0.41);
    assert.equal(woodenBench?.attributes.hitboxWidth, 1.1);
});

test('local sandbox exposes every arrow sign with direction-specific bounds', () => {
    const blockData = getLocalSandboxBlockData();
    const blockNames = new Set(
        blockData.map((block) => block.information.name),
    );

    assert.equal(arrowSignNames.length, 16);
    for (const config of arrowSignConfigs) {
        const arrowSign = blockData.find(
            (block) => block.information.name === config.name,
        );
        const height =
            config.direction === 'Up' || config.direction === 'Down'
                ? 1.32
                : 1.18;

        assert.equal(blockNames.has(config.name), true);
        assert.ok(arrowSign);
        assert.equal(arrowSign.attributes.height, height);
        assert.equal(arrowSign.attributes.hitboxDepth, 0.12);
        assert.equal(arrowSign.attributes.hitboxHeight, height);
        assert.equal(arrowSign.attributes.hitboxWidth, 0.8);
    }
});

test('local sandbox exposes the editable wooden sign with production bounds', () => {
    const woodenSign = getLocalSandboxBlockData().find(
        (block) => block.information.name === 'WoodenSign',
    );

    assert.ok(woodenSign);
    assert.equal(woodenSign.attributes.height, 1.16);
    assert.equal(woodenSign.attributes.hitboxDepth, 0.12);
    assert.equal(woodenSign.attributes.hitboxHeight, 1.16);
    assert.equal(woodenSign.attributes.hitboxWidth, 0.88);
});

test('local sandbox exposes the display table as a stackable decoration', () => {
    const displayTable = getLocalSandboxBlockData().find(
        (block) => block.information.name === 'OutletDisplayTable',
    );

    assert.ok(displayTable);
    assert.equal(displayTable.information.label, 'Drveni izložbeni stol');
    assert.equal(displayTable.attributes.height, 0.67);
    assert.equal(displayTable.attributes.hitboxDepth, 0.75);
    assert.equal(displayTable.attributes.hitboxHeight, 0.67);
    assert.equal(displayTable.attributes.hitboxWidth, 0.9);
    assert.equal(displayTable.attributes.stackable, true);
});

test('local sandbox stool metadata matches the reduced model', () => {
    const stool = getLocalSandboxBlockData().find(
        (block) => block.information.name === 'Stool',
    );

    assert.equal(stool?.attributes.height, 0.39);
    assert.equal(stool?.attributes.hitboxDepth, 0.66);
    assert.equal(stool?.attributes.hitboxHeight, 0.39);
    assert.equal(stool?.attributes.hitboxWidth, 0.66);
});

test('local sandbox exposes animal home blocks used by the item HUD', () => {
    const blockData = getLocalSandboxBlockData();
    const blockNames = new Set(
        blockData.map((block) => block.information.name),
    );

    assert.equal(blockNames.has('CatPillow'), true);
    assert.equal(blockNames.has('DogHouse'), true);
});

test('local sandbox exposes the small wooden bridge with its model bounds', () => {
    const bridge = getLocalSandboxBlockData().find(
        (block) => block.information.name === 'SmallWoodenBridge',
    );

    assert.ok(bridge);
    assert.equal(bridge.attributes.height, 0.38);
    assert.equal(bridge.attributes.hitboxDepth, 1);
    assert.equal(bridge.attributes.hitboxHeight, 0.38);
    assert.equal(bridge.attributes.hitboxWidth, 0.84);
    assert.equal(bridge.attributes.placeableOnWater, true);
});

test('local sandbox exposes the wooden walkway with its model bounds', () => {
    const walkway = getLocalSandboxBlockData().find(
        (block) => block.information.name === 'WoodenWalkway',
    );

    assert.ok(walkway);
    assert.equal(walkway.attributes.height, 0.1);
    assert.equal(walkway.attributes.hitboxDepth, 1);
    assert.equal(walkway.attributes.hitboxHeight, 0.1);
    assert.equal(walkway.attributes.hitboxWidth, 0.86);
    assert.equal(walkway.attributes.placeableOnWater, true);
});

test('local sandbox exposes the new walkway and lighting blocks with catalog dimensions', () => {
    const blockData = getLocalSandboxBlockData();
    const expectedBlocks = [
        {
            name: 'StoneWalkway',
            label: 'Kamena staza',
            height: 0.1,
            hitboxDepth: 1,
            hitboxHeight: 0.1,
            hitboxWidth: 0.86,
            placeableOnWater: true,
            spanDepth: 1,
            spanWidth: 1,
        },
        {
            name: 'EnamelGardenLamp',
            label: 'Emajlirana vrtna lampa',
            height: 1.45,
            hitboxDepth: 0.46,
            hitboxHeight: 1.45,
            hitboxWidth: 0.52,
            placeableOnWater: false,
            spanDepth: 1,
            spanWidth: 1,
        },
        {
            name: 'HazelLightArch',
            label: 'Svjetleći luk od lijeske',
            height: 1.65,
            hitboxDepth: 1.72,
            hitboxHeight: 1.65,
            hitboxWidth: 0.9,
            placeableOnWater: false,
            spanDepth: 2,
            spanWidth: 1,
        },
        {
            name: 'RoofTileLantern',
            label: 'Fenjer od starog crijepa',
            height: 0.4,
            hitboxDepth: 0.48,
            hitboxHeight: 0.4,
            hitboxWidth: 0.48,
            placeableOnWater: false,
            spanDepth: 1,
            spanWidth: 1,
        },
        {
            name: 'WickerGardenLantern',
            label: 'Pleteni vrtni fenjer',
            height: 0.7,
            hitboxDepth: 0.62,
            hitboxHeight: 0.7,
            hitboxWidth: 0.62,
            placeableOnWater: false,
            spanDepth: 1,
            spanWidth: 1,
        },
        {
            name: 'WoodenHandLantern',
            label: 'Drveni ručni fenjer',
            height: 0.66,
            hitboxDepth: 0.4,
            hitboxHeight: 0.66,
            hitboxWidth: 0.44,
            placeableOnWater: false,
            spanDepth: 1,
            spanWidth: 1,
        },
        {
            name: 'MoonRainBarrel',
            label: 'Mjesečeva bačva',
            height: 1,
            hitboxDepth: 0.84,
            hitboxHeight: 1,
            hitboxWidth: 0.76,
            placeableOnWater: false,
            spanDepth: 1,
            spanWidth: 1,
        },
    ];

    for (const expected of expectedBlocks) {
        const block = blockData.find(
            (candidate) => candidate.information.name === expected.name,
        );

        assert.ok(block, `Missing local sandbox block ${expected.name}`);
        assert.equal(block.information.label, expected.label);
        assert.equal(block.attributes.height, expected.height);
        assert.equal(block.attributes.hitboxDepth, expected.hitboxDepth);
        assert.equal(block.attributes.hitboxHeight, expected.hitboxHeight);
        assert.equal(block.attributes.hitboxWidth, expected.hitboxWidth);
        assert.equal(
            block.attributes.placeableOnWater,
            expected.placeableOnWater,
        );
        assert.equal(block.attributes.spanDepth, expected.spanDepth);
        assert.equal(block.attributes.spanWidth, expected.spanWidth);
        assert.equal(block.attributes.stackable, false);
        assert.equal(block.attributes.nightOnlyPurchase, false);
    }
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

test('local sandbox exposes mulch blocks used by the item HUD', () => {
    const blockData = getLocalSandboxBlockData();
    const blockNames = new Set(
        blockData.map((block) => block.information.name),
    );

    assert.equal(blockNames.has('BaleHey'), false);
    for (const blockName of ['MulchHey', 'MulchCoconut', 'MulchWood']) {
        const block = blockData.find(
            (item) => item.information.name === blockName,
        );

        assert.ok(block);
        assert.equal(block.prices.sunflowers, 0);
        assert.equal(block.attributes.height, 0.01);
        assert.equal(block.attributes.hitboxDepth, 0.96);
        assert.equal(block.attributes.hitboxHeight, 0.08);
        assert.equal(block.attributes.hitboxWidth, 0.96);
    }
});
