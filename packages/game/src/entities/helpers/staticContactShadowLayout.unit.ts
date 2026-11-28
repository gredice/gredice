import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getLocalSandboxBlockData } from '../../localSandboxBlockData';
import { getAutumnTreeCanopyStage } from '../../scene/autumnCanopy';
import type { Block } from '../../types/Block';
import type { GardenStack } from '../../types/Stack';
import { mulchBlockNames } from '../raisedBed/mulchPatchGeometry';
import { resolveTerrainVergePlacements } from '../terrainRim/terrainVergePlacements';
import {
    applyStaticContactShadowFoliage,
    decodeStaticContactShadowMaskBit,
    hasStaticContactShadowAt,
    packStaticContactShadows,
    resolveContactShadowReceiverLookup,
    resolveStaticContactShadows,
    resolveStaticContactShadowVergeMap,
    type StaticContactShadowInstance,
    staticContactShadowCornerBits,
    staticContactShadowFloatsPerInstance,
    staticContactShadowMaskBitGlsl,
    staticContactShadowOpenBits,
    staticContactShadowRimInset,
    staticContactShadowSideBits,
} from './staticContactShadowLayout';
import {
    getContactShadowReceiverSnow,
    getContactShadowReceiverVisualTop,
    staticContactShadowFoliageScale,
} from './staticContactShadowProfiles';

const blockData = getLocalSandboxBlockData();
const groundTop = 0.4;

let nextBlockId = 0;
function block(name: string, rotation = 0): Block {
    nextBlockId += 1;
    return { id: `${name}-${nextBlockId.toString()}`, name, rotation };
}

/** A flat square island of `name` terrain from `min` to `max` on both axes. */
function island(min: number, max: number, name = 'Block_Grass') {
    const stacks: GardenStack[] = [];
    for (let x = min; x <= max; x += 1) {
        for (let z = min; z <= max; z += 1) {
            stacks.push({ blocks: [block(name)], position: { x, y: 0, z } });
        }
    }
    return stacks;
}

function stackAt(stacks: GardenStack[], x: number, z: number) {
    const stack = stacks.find(
        (candidate) => candidate.position.x === x && candidate.position.z === z,
    );
    assert.ok(stack, `No stack at ${x.toString()}, ${z.toString()}`);
    return stack;
}

function place(
    stacks: GardenStack[],
    x: number,
    z: number,
    ...blocks: Block[]
) {
    stackAt(stacks, x, z).blocks.push(...blocks);
    return blocks[0];
}

function resolve(stacks: GardenStack[], excludedBlockIds?: Set<string>) {
    return resolveStaticContactShadows({ blockData, excludedBlockIds, stacks });
}

function only(instances: StaticContactShadowInstance[]) {
    assert.equal(instances.length, 1);
    const [instance] = instances;
    assert.ok(instance);
    return instance;
}

const allSides =
    staticContactShadowSideBits.negX |
    staticContactShadowSideBits.posX |
    staticContactShadowSideBits.negZ |
    staticContactShadowSideBits.posZ;
const allCorners =
    staticContactShadowCornerBits.negXNegZ |
    staticContactShadowCornerBits.posXNegZ |
    staticContactShadowCornerBits.negXPosZ |
    staticContactShadowCornerBits.posXPosZ;

describe('static contact shadow layout', () => {
    it('puts one blob under a prop, on the ground it stands on', () => {
        const stacks = island(-2, 2);
        const pot = place(stacks, 0, 0, block('PotLowBowl'));
        const instance = only(resolve(stacks));

        assert.equal(instance.blockId, pot?.id);
        assert.equal(instance.x, 0);
        assert.equal(instance.z, 0);
        assert.ok(Math.abs(instance.y - groundTop) < 1e-9);
        assert.ok(instance.halfWidth > 0.1 && instance.halfWidth < 0.45);
        assert.ok(instance.spread > 0);
        // Lawn on every side: the blob may spill into the neighbours.
        assert.equal(instance.mask, allSides | allCorners);
        assert.deepEqual(instance.clip, {
            maxX: 0.5,
            maxZ: 0.5,
            minX: -0.5,
            minZ: -0.5,
        });
    });

    it('skips terrain, flat ground cover and moving actors', () => {
        const stacks = island(-2, 2);
        place(stacks, -1, 0, block('MulchWood'));
        place(stacks, 0, 0, block('AutumnLeafPileMound'));
        place(stacks, 1, 0, block('Cow'));
        place(stacks, 0, 1, block('BeachTowelStriped'));

        assert.deepEqual(resolve(stacks), []);
    });

    it('skips objects on water and on slopes', () => {
        const stacks = island(-2, 2);
        stackAt(stacks, 0, 0).blocks = [block('Block_Water')];
        place(stacks, 0, 0, block('Bucket'));
        stackAt(stacks, 1, 0).blocks = [block('Block_Grass_Angle')];
        place(stacks, 1, 0, block('Bucket'));

        assert.deepEqual(resolve(stacks), []);
    });

    it('stands on the top of stacked terrain', () => {
        const stacks = island(-2, 2);
        place(stacks, 0, 0, block('Block_Grass'), block('Bucket'));
        const instance = only(resolve(stacks));

        assert.ok(Math.abs(instance.y - groundTop * 2) < 1e-9);
        // The neighbours are a step down: no spill, pulled back from the rim.
        assert.equal(instance.mask, 0);
        assert.ok(
            Math.abs(
                instance.clip.minX - (-0.5 + staticContactShadowRimInset),
            ) < 1e-9,
        );
        assert.ok(
            Math.abs(instance.clip.maxZ - (0.5 - staticContactShadowRimInset)) <
                1e-9,
        );
    });

    it('stays inside the island edge and cuts at a higher step', () => {
        const stacks = island(0, 2);
        place(stacks, 1, 0, block('Block_Grass'));
        place(stacks, 0, 0, block('Bucket'));
        const instance = only(resolve(stacks));

        // -X and -Z are the open island edge, +X is a higher step and +Z is
        // lawn at the same height.
        assert.equal(
            instance.mask,
            staticContactShadowSideBits.posZ |
                staticContactShadowCornerBits.posXPosZ,
            'only the same-height lawn lets the blob spill over',
        );
        assert.ok(
            Math.abs(
                instance.clip.minX - (-0.5 + staticContactShadowRimInset),
            ) < 1e-9,
        );
        assert.ok(
            Math.abs(
                instance.clip.minZ - (-0.5 + staticContactShadowRimInset),
            ) < 1e-9,
        );
        assert.equal(instance.clip.maxX, 0.5, 'a step is cut at the tile edge');
    });

    it('follows rotation and centres multi-tile footprints', () => {
        for (const rotation of [0, 1, 2, 3]) {
            const stacks = island(-2, 3);
            place(stacks, 0, 0, block('HarvestWheelbarrow', rotation));
            const instance = only(resolve(stacks));
            const turnsSideways = rotation % 2 === 1;

            assert.equal(instance.yaw, rotation * (Math.PI / 2));
            assert.equal(instance.x, turnsSideways ? 0 : 0.5);
            assert.equal(instance.z, turnsSideways ? 0.5 : 0);
            assert.equal(instance.clip.maxX, turnsSideways ? 0.5 : 1.5);
            assert.equal(instance.clip.maxZ, turnsSideways ? 1.5 : 0.5);
        }

        const shelterStacks = island(-2, 3);
        place(shelterStacks, 0, 0, block('CowShelter'));
        const shelter = only(resolve(shelterStacks));
        assert.ok(Math.abs(shelter.x - 0.5) < 0.1);
        assert.ok(Math.abs(shelter.z - 0.5) < 0.1);
        assert.ok(shelter.halfWidth > 0.5, 'a 2x2 shelter gets a wide blob');
    });

    it('turns part offsets with the block', () => {
        const stacks = island(-2, 2);
        place(stacks, 0, 0, block('DogHouse', 1));
        const instance = only(resolve(stacks));

        // DogHouse is offset (+0.1, -0.06) locally; a quarter turn about +Y
        // maps local (x, z) to world (z, -x).
        assert.ok(Math.abs(instance.x - -0.06) < 1e-6);
        assert.ok(Math.abs(instance.z - -0.1) < 1e-6);
    });

    it('lays a raised bed along its two cells', () => {
        for (const rotation of [0, 1]) {
            const stacks = island(-2, 3);
            place(stacks, 0, 0, block('Raised_Bed', rotation));
            const instance = only(resolve(stacks));
            const alongX = rotation === 1;

            assert.equal(instance.yaw, 0);
            assert.equal(instance.x, alongX ? 0.5 : 0);
            assert.equal(instance.z, alongX ? 0 : 0.5);
            assert.ok(
                Math.abs(instance.halfWidth - (alongX ? 0.95 : 0.5)) < 1e-9,
            );
            assert.ok(
                Math.abs(instance.halfDepth - (alongX ? 0.5 : 0.95)) < 1e-9,
            );
        }
    });

    it('gives trees a tight trunk blob and a fainter crown pool', () => {
        const stacks = island(-2, 2);
        place(stacks, 0, 0, block('Tree'));
        const instances = resolve(stacks);

        assert.equal(instances.length, 2);
        const [trunk, crown] = instances;
        assert.ok(trunk && crown);
        assert.ok(trunk.halfWidth < crown.halfWidth);
        assert.ok(crown.strength < trunk.strength);
    });

    it('joins fence arms between neighbours without a seam', () => {
        const stacks = island(-3, 3);
        place(stacks, -1, 0, block('Fence'));
        place(stacks, 0, 0, block('Fence'));
        const instances = resolve(stacks);
        const leftId = stackAt(stacks, -1, 0).blocks[1]?.id;
        const left = instances.filter((instance) =>
            instance.key.startsWith(`${leftId ?? '?'}:`),
        );

        // Post plus one arm each.
        assert.equal(instances.length, 4);
        assert.equal(left.length, 2);
        const arm = left.find((instance) => instance.key.endsWith(':arm:posX'));
        assert.ok(arm);
        assert.equal(arm.x, -0.75);
        // Open at both ends, so the arm ends exactly on the post centre and
        // the tile edge where the neighbour's arm starts.
        assert.equal(
            arm.mask &
                (staticContactShadowOpenBits.negX |
                    staticContactShadowOpenBits.posX),
            staticContactShadowOpenBits.negX | staticContactShadowOpenBits.posX,
        );
        assert.equal(arm.rect.minX, -0.25);
        assert.equal(arm.rect.maxX, 0.25);
        assert.ok(arm.rect.maxZ > arm.halfDepth, 'the sides still fade');
    });

    it('closes a fence arm that meets a gate side-on', () => {
        const stacks = island(-3, 3);
        place(stacks, 0, 0, block('Fence'));
        // Rotation 1 runs the gate along Z, across the arm coming from -X.
        place(stacks, 1, 0, block('FenceGate', 1));
        const instances = resolve(stacks);
        const arm = instances.find((instance) =>
            instance.key.endsWith(':arm:posX'),
        );
        const gate = instances.find((instance) =>
            instance.key.endsWith(':gate'),
        );

        assert.ok(arm && gate);
        assert.equal(arm.mask & staticContactShadowOpenBits.posX, 0);
        assert.ok(arm.rect.maxX > 0.25, 'the far end fades out');
        assert.equal(
            gate.mask &
                (staticContactShadowOpenBits.negX |
                    staticContactShadowOpenBits.posX),
            0,
            'the side-on gate does not reach out to the fence',
        );

        const inLine = island(-3, 3);
        place(inLine, 0, 0, block('Fence'));
        place(inLine, 1, 0, block('FenceGate', 0));
        const inLineInstances = resolve(inLine);
        const inLineArm = inLineInstances.find((instance) =>
            instance.key.endsWith(':arm:posX'),
        );
        const inLineGate = inLineInstances.find((instance) =>
            instance.key.endsWith(':gate'),
        );
        assert.ok(inLineArm && inLineGate);
        assert.notEqual(inLineArm.mask & staticContactShadowOpenBits.posX, 0);
        assert.notEqual(inLineGate.mask & staticContactShadowOpenBits.negX, 0);
        assert.equal(inLineGate.halfWidth, 0.5);
    });

    it('lays lattice shades out as thin panels that join', () => {
        const lone = island(-2, 2);
        place(lone, 0, 0, block('Shade', 1));
        const panel = only(resolve(lone));
        assert.equal(panel.yaw, Math.PI / 2, 'a lone panel follows its turn');
        assert.ok(panel.halfDepth < 0.1 && panel.halfWidth > 0.4);
        assert.ok(panel.strength < 1, 'light passes through the lattice');

        const pair = island(-2, 2);
        place(pair, 0, 0, block('Shade'));
        place(pair, 1, 0, block('Shade'));
        const pairInstances = resolve(pair);
        assert.equal(pairInstances.length, 4, 'two arms per panel');
        const shared = pairInstances.find(
            (instance) =>
                instance.x === 0.25 && instance.key.endsWith(':arm:posX'),
        );
        assert.ok(shared);
        assert.notEqual(shared.mask & staticContactShadowOpenBits.posX, 0);
        const end = pairInstances.find(
            (instance) =>
                instance.x === -0.25 && instance.key.endsWith(':arm:negX'),
        );
        assert.ok(end);
        assert.equal(end.mask & staticContactShadowOpenBits.negX, 0);

        const corner = island(-2, 2);
        place(corner, 0, 0, block('Shade'));
        place(corner, 1, 0, block('Shade'));
        place(corner, 0, 1, block('Shade'));
        const cornerKeys = resolve(corner).map((instance) => instance.key);
        assert.ok(cornerKeys.some((key) => key.endsWith(':middle')));
    });

    it('sits on a display table, clipped to its top', () => {
        const stacks = island(-2, 2);
        place(stacks, 0, 0, block('OutletDisplayTable'), block('PotLowBowl'));
        const instances = resolve(stacks);
        const table = instances.find((instance) =>
            instance.key.startsWith('OutletDisplayTable'),
        );
        const pot = instances.find((instance) =>
            instance.key.startsWith('PotLowBowl'),
        );

        assert.ok(table && pot);
        assert.ok(Math.abs(table.y - groundTop) < 1e-9);
        assert.ok(pot.y > table.y + 0.5, 'the pot blob lies on the table top');
        assert.equal(pot.mask, 0);
        assert.ok(pot.clip.maxX < 0.5 && pot.clip.minX > -0.5);
    });

    it('drops blocks that an active drag lifts', () => {
        const stacks = island(-2, 2);
        const bucket = place(stacks, 0, 0, block('Bucket'));
        place(stacks, 1, 1, block('Composter'));

        assert.equal(resolve(stacks).length, 2);
        assert.equal(resolve(stacks, new Set([bucket?.id ?? ''])).length, 1);
    });

    it('reports per block whether a static blob exists', () => {
        const stacks = island(-2, 2);
        place(stacks, 0, 0, block('Bucket'));
        place(stacks, 1, 0, block('MulchWood'));

        assert.equal(
            hasStaticContactShadowAt({
                blockData,
                blockIndex: 1,
                stack: stackAt(stacks, 0, 0),
            }),
            true,
        );
        assert.equal(
            hasStaticContactShadowAt({
                blockData,
                blockIndex: 1,
                stack: stackAt(stacks, 1, 0),
            }),
            false,
        );
        assert.equal(
            hasStaticContactShadowAt({
                blockData,
                blockIndex: 0,
                stack: stackAt(stacks, 0, 0),
            }),
            false,
            'terrain has nothing under it',
        );
    });

    it('packs every blob into flat instance attributes', () => {
        const stacks = island(-2, 2);
        place(stacks, 0, 0, block('Tree', 1));
        place(stacks, 1, 1, block('Bucket'));
        const instances = resolve(stacks);
        const packed = packStaticContactShadows(instances);

        assert.equal(packed.count, instances.length);
        assert.equal(
            packed.transform.length,
            instances.length * staticContactShadowFloatsPerInstance.transform,
        );
        assert.equal(
            packed.params.length,
            instances.length * staticContactShadowFloatsPerInstance.params,
        );
        const last = instances.at(-1);
        assert.ok(last);
        const index = instances.length - 1;
        assert.deepEqual(
            [...packed.transform.subarray(index * 4, index * 4 + 4)],
            [last.x, last.y, last.z, last.yaw].map(Math.fround),
        );
        assert.equal(packed.params[index * 2 + 1], last.mask);
        assert.equal(
            packed.snow.length,
            instances.length * staticContactShadowFloatsPerInstance.snow,
        );
        assert.deepEqual(
            [...packed.snow.subarray(index * 3, index * 3 + 3)],
            [
                last.snow.lift,
                last.snow.maxThickness * last.snow.crest,
                last.snow.coverageMultiplier,
            ].map(Math.fround),
        );
    });

    it('rises with the snow of the surface each blob lies on', () => {
        const stacks = island(-2, 2);
        stackAt(stacks, 1, 0).blocks[0] = block('Block_Ground');
        place(stacks, 0, 0, block('Bucket'));
        place(stacks, 1, 0, block('Bucket'));
        place(stacks, -1, 0, block('MulchWood'), block('PotLowBowl'));
        place(stacks, 0, 1, block('OutletDisplayTable'), block('PotLowBowl'));
        const instances = resolve(stacks);
        const snowOf = (x: number, z: number, name: string) => {
            const id = stackAt(stacks, x, z).blocks.find(
                (candidate) => candidate.name === name,
            )?.id;
            const instance = instances.find(
                (candidate) => candidate.blockId === id,
            );
            assert.ok(instance, `${name} at ${x.toString()}, ${z.toString()}`);
            return instance.snow;
        };

        assert.deepEqual(
            snowOf(0, 0, 'Bucket'),
            getContactShadowReceiverSnow('Block_Grass'),
        );
        assert.deepEqual(
            snowOf(1, 0, 'Bucket'),
            getContactShadowReceiverSnow('Block_Ground'),
        );
        assert.deepEqual(
            snowOf(-1, 0, 'PotLowBowl'),
            getContactShadowReceiverSnow('MulchWood'),
        );
        assert.equal(
            snowOf(0, 1, 'PotLowBowl').maxThickness,
            0,
            'a prop top keeps its blob where it is',
        );
    });
});

describe('static contact shadow mask bits', () => {
    const bitValues = Array.from({ length: 12 }, (_, bit) => 2 ** bit);

    function assertDecodes(mask: number) {
        for (const bitValue of bitValues) {
            assert.equal(
                decodeStaticContactShadowMaskBit(mask, bitValue),
                mask & bitValue ? 1 : 0,
                `mask ${mask.toString()} bit ${bitValue.toString()}`,
            );
        }
    }

    it('decodes in float32 the way the shader runs it', () => {
        assert.match(
            staticContactShadowMaskBitGlsl,
            /mod\(floor\(\(mask \+ 0\.5\) \/ bitValue\), 2\.0\)/,
        );
        for (let mask = 0; mask < 4096; mask += 1) {
            assertDecodes(mask);
        }
    });

    it('decodes every mask that fences, gates and shades produce', () => {
        // Runs along both axes, with end tiles, a corner and gates in line.
        const stacks = island(-4, 4);
        for (let x = -3; x <= 3; x += 1) {
            place(stacks, x, -3, block('Fence'));
            place(stacks, x, 3, block('StoneFence'));
            place(stacks, x, 0, block('Shade'));
        }
        for (let z = -2; z <= 2; z += 1) {
            place(stacks, -3, z === 0 ? 0 : z, block('WhiteFence'));
            place(stacks, 3, z, block('PolishedStoneFence'));
        }
        place(stacks, 0, -4, block('FenceGate', 0));
        place(stacks, -4, 1, block('StoneFenceGate', 1));
        place(stacks, 0, 2, block('Raised_Bed', 1));
        const masks = new Set(resolve(stacks).map((instance) => instance.mask));

        // Interior straight runs along X carry every ground bit and both X
        // open bits: 1023 read the -Z open bit as set before.
        assert.ok(masks.has(1023));
        assert.ok(masks.size > 6);
        for (const mask of masks) {
            assertDecodes(mask);
        }
    });
});

describe('static contact shadow receiving surfaces', () => {
    it('lies on top of mulch instead of under it', () => {
        for (const name of mulchBlockNames) {
            const stacks = island(-2, 2);
            place(stacks, 0, 0, block(name), block('Bucket'));
            const instance = only(resolve(stacks));
            const mulchBlockHeight = 0.01;

            assert.ok(
                Math.abs(
                    instance.y -
                        (groundTop + getContactShadowReceiverVisualTop(name)),
                ) < 1e-9,
                name,
            );
            assert.ok(instance.y > groundTop + mulchBlockHeight, name);
        }
    });

    it('lies at the block height of a walkway, where objects stand', () => {
        for (const name of ['StoneWalkway', 'WoodenWalkway']) {
            const stacks = island(-2, 2);
            place(stacks, 0, 0, block(name), block('Bucket'));
            const instance = only(resolve(stacks));

            assert.ok(Math.abs(instance.y - (groundTop + 0.1)) < 1e-9, name);
        }
    });

    it('finds the ground and its snow under actors', () => {
        const stacks = island(-2, 2);
        place(stacks, 0, 0, block('Bucket'));
        place(stacks, 1, 0, block('MulchHey'));
        place(stacks, -1, 0, block('StoneWalkway'));
        stackAt(stacks, 0, 1).blocks = [block('Block_Grass_Angle')];
        place(stacks, 1, 1, block('Block_Grass'));
        stackAt(stacks, -1, 1).blocks = [block('Block_Water')];
        const lookup = resolveContactShadowReceiverLookup({
            blockData,
            stacks,
        });
        const grass = getContactShadowReceiverSnow('Block_Grass');

        assert.equal(lookup(2, 2, groundTop), grass);
        assert.equal(lookup(0.3, -0.2, groundTop), grass, 'rounds to a cell');
        assert.equal(lookup(0, 0, groundTop), grass, 'beside the bucket');
        assert.equal(lookup(0, 0, groundTop + 0.5), null, 'on a prop top');
        assert.equal(
            lookup(1, 0, groundTop + 0.01),
            getContactShadowReceiverSnow('MulchHey'),
        );
        assert.equal(
            lookup(-1, 0, groundTop + 0.064),
            getContactShadowReceiverSnow('StoneWalkway'),
            "on the walkway's drawn top",
        );
        assert.equal(lookup(0, 1, groundTop), null, 'on a slope');
        assert.equal(lookup(1, 1, groundTop * 2), grass, 'on a raised step');
        assert.equal(lookup(-1, 1, groundTop), null, 'on water');
        assert.equal(lookup(9, 9, 0), null, 'off the garden');
    });
});

describe('static contact shadow foliage', () => {
    it('fades crown pools with the canopy and keeps the trunk', () => {
        const stacks = island(-2, 2);
        const tree = place(stacks, 0, 0, block('Tree'));
        place(stacks, 1, 1, block('Bucket'));
        const instances = resolve(stacks);
        const packed = packStaticContactShadows(instances);
        const strengths = () =>
            instances.map((_, index) => packed.params[index * 2] ?? 0);
        const base = strengths();

        assert.equal(
            instances.filter((instance) => instance.foliage).length,
            1,
        );
        assert.equal(
            applyStaticContactShadowFoliage(packed.params, instances, 1),
            false,
            'a full canopy keeps the packed strengths',
        );

        assert.equal(
            applyStaticContactShadowFoliage(packed.params, instances, 0),
            true,
        );
        // The bare winter Tree keeps its trunk contact and loses the pool
        // under its missing crown (was the sparse trace before the bare
        // stage).
        assert.equal(getAutumnTreeCanopyStage(0, tree?.id ?? ''), 'bare');
        const winter = strengths();
        instances.forEach((instance, index) => {
            const expected = instance.foliage
                ? (base[index] ?? 0) * staticContactShadowFoliageScale.bare
                : base[index];
            assert.ok(
                Math.abs((winter[index] ?? 0) - (expected ?? 0)) < 1e-6,
                instance.key,
            );
        });
        assert.equal(
            applyStaticContactShadowFoliage(packed.params, instances, 0),
            false,
            'nothing to upload when no stage changed',
        );
        assert.equal(
            applyStaticContactShadowFoliage(packed.params, instances, 1),
            true,
        );
        assert.deepEqual(strengths(), base);
        const scaledBy = (scale: number) =>
            instances.map((instance, index) =>
                instance.foliage ? (base[index] ?? 0) * scale : base[index],
            );
        const near = (
            actual: readonly number[],
            expected: readonly unknown[],
        ) =>
            actual.every(
                (value, index) =>
                    Math.abs(value - Number(expected[index] ?? 0)) < 1e-6,
            );
        // Late autumn (retention 0.15) keeps the sparse trace under the
        // round tree; the winter floor (0.08) is bare.
        applyStaticContactShadowFoliage(packed.params, instances, 0.15);
        assert.ok(
            near(strengths(), scaledBy(staticContactShadowFoliageScale.sparse)),
        );
        applyStaticContactShadowFoliage(packed.params, instances, 0.08);
        assert.ok(
            near(strengths(), scaledBy(staticContactShadowFoliageScale.bare)),
        );
    });
});

describe('static contact shadow verge map', () => {
    it('is empty without a lawn-to-path bank', () => {
        assert.equal(
            resolveStaticContactShadowVergeMap({
                blockData,
                stacks: island(-1, 1),
            }),
            null,
        );
    });

    it('flags both cells along a bank and every cell at its ends', () => {
        const stacks = island(-1, 1);
        stackAt(stacks, 1, 0).blocks = [block('Block_Ground')];
        const map = resolveStaticContactShadowVergeMap({ blockData, stacks });
        assert.ok(map);
        const flagsAt = (x: number, z: number) => {
            const column = x - map.originX;
            const row = z - map.originZ;
            if (
                column < 0 ||
                row < 0 ||
                column >= map.width ||
                row >= map.depth
            ) {
                return 0;
            }
            return map.data[row * map.width + column] ?? 0;
        };

        // Lawn at (0, 0) meets the path at (1, 0) along x = 0.5.
        assert.notEqual(flagsAt(0, 0) & staticContactShadowSideBits.posX, 0);
        assert.notEqual(flagsAt(1, 0) & staticContactShadowSideBits.negX, 0);
        // The bank ends at (0.5, -0.5) and (0.5, 0.5): the cells around those
        // points get the matching corner bit.
        assert.notEqual(
            flagsAt(0, -1) & staticContactShadowCornerBits.posXPosZ,
            0,
        );
        assert.notEqual(
            flagsAt(1, -1) & staticContactShadowCornerBits.negXPosZ,
            0,
        );
        assert.notEqual(
            flagsAt(0, 1) & staticContactShadowCornerBits.posXNegZ,
            0,
        );
        assert.notEqual(
            flagsAt(1, 1) & staticContactShadowCornerBits.negXNegZ,
            0,
        );
        // Lawn far from the path is left alone.
        assert.equal(flagsAt(-1, 0), 0);
    });
    it('flags exactly the sides where the terrain verge grows a bank', () => {
        // Lawn meets a soil path, raised sand, gravel, water and snow, on
        // two levels.
        const stacks = island(-3, 3);
        for (let z = -3; z <= 3; z += 1) {
            stackAt(stacks, 0, z).blocks = [block('Block_Ground')];
        }
        stackAt(stacks, 2, 2).blocks = [block('Block_Sand')];
        stackAt(stacks, -2, 2).blocks = [block('Block_Gravel')];
        stackAt(stacks, 2, -2).blocks = [block('Block_Water')];
        stackAt(stacks, -2, -2).blocks = [block('Block_Snow')];
        stackAt(stacks, 3, 0).blocks = [
            block('Block_Grass'),
            block('Block_Grass'),
        ];
        stackAt(stacks, 3, 1).blocks = [
            block('Block_Grass'),
            block('Block_Ground'),
        ];
        place(stacks, -3, 0, block('Bucket'));
        const map = resolveStaticContactShadowVergeMap({ blockData, stacks });
        assert.ok(map);

        const sideBitsByTurn = [
            staticContactShadowSideBits.posX,
            staticContactShadowSideBits.negZ,
            staticContactShadowSideBits.negX,
            staticContactShadowSideBits.posZ,
        ];
        const turnOffsets = [
            [1, 0],
            [0, -1],
            [-1, 0],
            [0, 1],
        ] as const;
        const expected = new Set<string>();
        for (const placement of resolveTerrainVergePlacements(
            blockData,
            stacks,
        )) {
            if (placement.kind !== 'edge') {
                continue;
            }
            const { x, z } = placement.stack.position;
            const [dx, dz] = turnOffsets[placement.turn] ?? [0, 0];
            expected.add(
                `${x},${z}:${sideBitsByTurn[placement.turn]?.toString()}`,
            );
            expected.add(
                `${x + dx},${z + dz}:${sideBitsByTurn[(placement.turn + 2) % 4]?.toString()}`,
            );
        }
        const actual = new Set<string>();
        for (let row = 0; row < map.depth; row += 1) {
            for (let column = 0; column < map.width; column += 1) {
                const flags = map.data[row * map.width + column] ?? 0;
                for (const bit of sideBitsByTurn) {
                    if (flags & bit) {
                        actual.add(
                            `${map.originX + column},${map.originZ + row}:${bit.toString()}`,
                        );
                    }
                }
            }
        }

        assert.ok(expected.size > 10);
        assert.deepEqual([...actual].sort(), [...expected].sort());
    });
});
