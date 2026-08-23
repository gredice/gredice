import assert from 'node:assert/strict';
import test from 'node:test';
import { getGardenBlockSpan } from '@gredice/js/gardenBlocks';
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
        'Block_Dry_Ground_Angle',
        'Block_Sand_Angle',
        'Block_Grass_Corner',
        'Block_Ground_Corner',
        'Block_Dry_Ground_Corner',
        'Block_Sand_Corner',
        'Block_Grass_Reverse_Corner',
        'Block_Ground_Reverse_Corner',
        'Block_Dry_Ground_Reverse_Corner',
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

test('local sandbox exposes every terrain variation with offer dimensions', () => {
    const blockData = getLocalSandboxBlockData();
    const names = [
        'Block_Stone',
        'Block_Stone_Angle',
        'Block_Gravel',
        'Block_Gravel_Angle',
        'Block_Dry_Ground',
        'Block_Dry_Ground_Angle',
        'Block_Dry_Ground_Corner',
        'Block_Dry_Ground_Reverse_Corner',
        'Block_Swamp_Ground',
        'Block_Swamp_Ground_Angle',
        'Block_Swamp_Water',
        'Block_Stone_Stairs',
        'Block_Stone_Stairs_Corner',
        'Block_Stone_Stairs_Half',
        'Block_Polished_Stone',
        'Block_Polished_Stone_Angle',
        'Block_Polished_Stone_Stairs',
        'Block_Polished_Stone_Stairs_Corner',
    ];

    for (const name of names) {
        const block = blockData.find(
            (candidate) => candidate.information.name === name,
        );

        assert.ok(block, `Missing local sandbox terrain ${name}`);
        assert.equal(block.attributes.height, 0.4);
        assert.equal(block.attributes.stackable, true);
        assert.equal(block.prices.sunflowers, 0);
    }

    const cornerStairs = blockData.filter((block) =>
        [
            'Block_Stone_Stairs_Corner',
            'Block_Stone_Stairs_Half',
            'Block_Polished_Stone_Stairs_Corner',
        ].includes(block.information.name),
    );
    const swampWater = blockData.find(
        (block) => block.information.name === 'Block_Swamp_Water',
    );
    for (const cornerStair of cornerStairs) {
        assert.equal(cornerStair.attributes.hitboxDepth, 1);
        assert.equal(cornerStair.attributes.hitboxWidth, 1);
    }
    assert.equal(swampWater?.attributes.placeableOnWater, true);
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

    assert.equal(arrowSignNames.length, 20);
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

test('local sandbox exposes animal catalogue blocks used by the item HUD', () => {
    const blockData = getLocalSandboxBlockData();
    const expectedHomes = [
        {
            name: 'CatPillow',
        },
        {
            name: 'ChickenCoop',
            label: 'Kokošinjac',
            height: 0.86,
            hitboxDepth: 0.97,
            hitboxHeight: 0.86,
            hitboxWidth: 0.76,
        },
        {
            name: 'DogHouse',
        },
        {
            name: 'Goat',
            label: 'Koza',
            height: 0.72,
            hitboxDepth: 0.72,
            hitboxHeight: 0.72,
            hitboxWidth: 0.5,
        },
        {
            name: 'PigletPen',
            label: 'Obor za praščića',
            height: 0.78,
            hitboxDepth: 0.89,
            hitboxHeight: 0.78,
            hitboxWidth: 0.94,
        },
        {
            name: 'Rabbit',
            label: 'Zec',
            height: 0.456,
            hitboxDepth: 0.432,
            hitboxHeight: 0.456,
            hitboxWidth: 0.348,
        },
        {
            name: 'Sheep',
            label: 'Ovca',
            height: 0.64,
            hitboxDepth: 0.92,
            hitboxHeight: 0.64,
            hitboxWidth: 0.64,
        },
    ];

    for (const expected of expectedHomes) {
        const home = blockData.find(
            (block) => block.information.name === expected.name,
        );
        assert.ok(home, `Missing animal catalogue block ${expected.name}`);

        if ('label' in expected) {
            assert.equal(home.information.label, expected.label);
            assert.equal(home.attributes.height, expected.height);
            assert.equal(home.attributes.hitboxDepth, expected.hitboxDepth);
            assert.equal(home.attributes.hitboxHeight, expected.hitboxHeight);
            assert.equal(home.attributes.hitboxWidth, expected.hitboxWidth);
            assert.equal(home.attributes.placeableOnWater, false);
            assert.equal(home.attributes.spanDepth, 1);
            assert.equal(home.attributes.spanWidth, 1);
            assert.equal(home.attributes.stackable, false);
        }
    }
});

test('local sandbox exposes the placeable horse at horse scale', () => {
    const horse = getLocalSandboxBlockData().find(
        (block) => block.information.name === 'Horse',
    );

    assert.ok(horse);
    assert.equal(horse.information.label, 'Konj');
    assert.match(horse.information.fullDescription, /boju dlake/);
    assert.equal(horse.attributes.height, 1.46);
    assert.equal(horse.attributes.hitboxDepth, 1.86);
    assert.equal(horse.attributes.hitboxHeight, 1.46);
    assert.equal(horse.attributes.hitboxWidth, 0.76);
    assert.equal(horse.attributes.placeableOnWater, false);
    assert.equal(horse.attributes.spanDepth, 2);
    assert.equal(horse.attributes.spanWidth, 1);
    assert.equal(horse.attributes.stackable, false);
});

test('local sandbox exposes the connected white fence with model bounds', () => {
    const whiteFence = getLocalSandboxBlockData().find(
        (block) => block.information.name === 'WhiteFence',
    );

    assert.ok(whiteFence);
    assert.equal(whiteFence.information.label, 'Bijela ograda');
    assert.equal(whiteFence.attributes.height, 0.72);
    assert.equal(whiteFence.attributes.hitboxDepth, 1);
    assert.equal(whiteFence.attributes.hitboxHeight, 0.72);
    assert.equal(whiteFence.attributes.hitboxWidth, 1);
    assert.equal(whiteFence.attributes.stackable, false);
});

test('local sandbox exposes both connected stone fences with model bounds', () => {
    const blockData = getLocalSandboxBlockData();
    const fences = [
        { label: 'Kamena ograda', name: 'StoneFence' },
        {
            label: 'Ograda od poliranog kamena',
            name: 'PolishedStoneFence',
        },
    ];

    for (const { label, name } of fences) {
        const fence = blockData.find(
            (block) => block.information.name === name,
        );

        assert.ok(fence, `Missing local sandbox fence ${name}`);
        assert.equal(fence.information.label, label);
        assert.equal(fence.attributes.height, 0.68);
        assert.equal(fence.attributes.hitboxDepth, 1);
        assert.equal(fence.attributes.hitboxHeight, 0.68);
        assert.equal(fence.attributes.hitboxWidth, 1);
        assert.equal(fence.attributes.stackable, false);
    }
});

test('local sandbox exposes a matching interactive gate for every fence', () => {
    const blockData = getLocalSandboxBlockData();
    const gates = [
        { height: 0.72, label: 'Vrata za drvenu ogradu', name: 'FenceGate' },
        {
            height: 0.72,
            label: 'Vrata za bijelu ogradu',
            name: 'WhiteFenceGate',
        },
        {
            height: 0.68,
            label: 'Vrata za kamenu ogradu',
            name: 'StoneFenceGate',
        },
        {
            height: 0.68,
            label: 'Vrata za ogradu od poliranog kamena',
            name: 'PolishedStoneFenceGate',
        },
    ];

    for (const { height, label, name } of gates) {
        const gate = blockData.find((block) => block.information.name === name);

        assert.ok(gate, `Missing local sandbox gate ${name}`);
        assert.equal(gate.information.label, label);
        assert.equal(gate.attributes.height, height);
        assert.equal(gate.attributes.hitboxDepth, 1);
        assert.equal(gate.attributes.hitboxHeight, height);
        assert.equal(gate.attributes.hitboxWidth, 1);
        assert.equal(gate.attributes.stackable, false);
    }
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

test('local sandbox exposes the fishing boat as a two-cell water decoration', () => {
    const boat = getLocalSandboxBlockData().find(
        (block) => block.information.name === 'FishingBoat',
    );

    assert.ok(boat);
    assert.equal(boat.information.label, 'Ribarska barka');
    assert.equal(boat.attributes.height, 0.62);
    assert.equal(boat.attributes.hitboxDepth, 1.84);
    assert.equal(boat.attributes.hitboxHeight, 0.62);
    assert.equal(boat.attributes.hitboxWidth, 0.94);
    assert.equal(boat.attributes.placeableOnWater, true);
    assert.equal(boat.attributes.spanDepth, 2);
    assert.equal(boat.attributes.spanWidth, 1);
    assert.equal(boat.attributes.stackable, false);
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
            name: 'DoubleGardenLightPole',
            label: 'Dvostruki drveni rasvjetni stup',
            height: 2.2,
            hitboxDepth: 0.38,
            hitboxHeight: 2.2,
            hitboxWidth: 0.94,
            placeableOnWater: false,
            spanDepth: 1,
            spanWidth: 1,
        },
        {
            name: 'HazelLightArch',
            label: 'Svjetleći luk od lijeske',
            height: 1.65,
            hitboxDepth: 1,
            hitboxHeight: 1.65,
            hitboxWidth: 0.24,
            placeableOnWater: false,
            spanDepth: 1,
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

test('HazelLightArch keeps one-cell occupancy through every rotation', () => {
    const arch = getLocalSandboxBlockData().find(
        (block) => block.information.name === 'HazelLightArch',
    );

    assert.ok(arch);
    for (const rotation of [0, 1, 2, 3]) {
        assert.deepEqual(getGardenBlockSpan(arch, rotation), {
            depth: 1,
            width: 1,
        });
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
