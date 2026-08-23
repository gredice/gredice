import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../../localSandboxBlockData';
import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import {
    createSquirrelHabitats,
    isSquirrelHabitatTreeBlockName,
} from './squirrelHabitat';

function block(id: string, name: string): Block {
    return { id, name, rotation: 0 };
}

function stack(x: number, z: number, names: string[]): Stack {
    return {
        blocks: names.map((name, index) =>
            block(`${name}-${x}-${z}-${index}`, name),
        ),
        position: new Vector3(x, 0, z),
    };
}

function groundGrid(radius = 3) {
    const stacks: Stack[] = [];
    for (let x = -radius; x <= radius; x += 1) {
        for (let z = -radius; z <= radius; z += 1) {
            stacks.push(stack(x, z, ['Block_Grass']));
        }
    }
    return stacks;
}

describe('squirrel woody habitat discovery', () => {
    it('accepts only explicit mature woody habitat names', () => {
        for (const name of ['Tree', 'Pine', 'PineAdvent', 'DeadTreeTall']) {
            assert.equal(isSquirrelHabitatTreeBlockName(name), true);
        }
        for (const name of ['PalmTree', 'DeadTreeStump', 'Bush', 'BirdHouse']) {
            assert.equal(isSquirrelHabitatTreeBlockName(name), false);
        }
    });

    it('creates a deterministic habitat only with connected safe ground', () => {
        const stacks = groundGrid();
        stacks
            .find(
                (candidate) =>
                    candidate.position.x === 0 && candidate.position.z === 0,
            )
            ?.blocks.push(block('habitat-tree', 'Tree'));
        stacks
            .find(
                (candidate) =>
                    candidate.position.x === 1 && candidate.position.z === 0,
            )
            ?.blocks.push(block('occupied-cell', 'GardenBox'));

        const first = createSquirrelHabitats({
            blockData: getLocalSandboxBlockData(),
            gardenSeed: 'garden-a',
            stacks,
        });
        const second = createSquirrelHabitats({
            blockData: getLocalSandboxBlockData(),
            gardenSeed: 'garden-a',
            stacks: [...stacks].reverse(),
        });

        assert.equal(first.length, 1);
        assert.equal(first[0]?.treeBlockName, 'Tree');
        assert.equal(first[0]?.roamTargets.length, 43);
        assert.deepEqual(
            second.map(({ id, revisionKey, seed, spawnTarget }) => ({
                id,
                revisionKey,
                seed,
                spawnTarget: spawnTarget.id,
            })),
            first.map(({ id, revisionKey, seed, spawnTarget }) => ({
                id,
                revisionKey,
                seed,
                spawnTarget: spawnTarget.id,
            })),
        );
        assert.equal(
            first[0]?.roamTargets.some(
                (target) =>
                    Math.round(target.position.x) === 1 &&
                    Math.round(target.position.z) === 0,
            ),
            false,
        );
    });

    it('does not spawn without a tree or when a tree has no safe approach', () => {
        const blockData = getLocalSandboxBlockData();
        assert.deepEqual(
            createSquirrelHabitats({
                blockData,
                gardenSeed: 'garden-a',
                stacks: groundGrid(),
            }),
            [],
        );
        assert.deepEqual(
            createSquirrelHabitats({
                blockData,
                gardenSeed: 'garden-a',
                stacks: [stack(0, 0, ['Block_Grass', 'Tree'])],
            }),
            [],
        );
    });
});
