import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../../localSandboxBlockData';
import { findCatPath } from '../cats/catPathfinding';
import {
    createPersistentPetHomeBlockedCells,
    getPersistentPetHomePlacement,
} from './persistentPetHomes';

describe('persistent pet home placement', () => {
    it('centers two-by-two homes across the complete occupied footprint', () => {
        const placement = getPersistentPetHomePlacement({
            blockName: 'CowShelter',
            rotation: 0,
            x: 4,
            z: -2,
        });

        assert.deepEqual(placement.center, { x: 4.5, z: -1.5 });
        assert.deepEqual(
            { depth: placement.spanDepth, width: placement.spanWidth },
            { depth: 2, width: 2 },
        );
    });

    it('places the animal at the authored front opening for every rotation', () => {
        const north = getPersistentPetHomePlacement({
            blockName: 'RabbitHutch',
            rotation: 0,
            x: 0,
            z: 0,
        });
        const east = getPersistentPetHomePlacement({
            blockName: 'RabbitHutch',
            rotation: 1,
            x: 0,
            z: 0,
        });

        assert.ok(Math.abs(north.doorway.x) < 1e-10);
        assert.equal(north.doorway.z, -0.6);
        assert.equal(east.doorway.x, -0.6);
        assert.ok(Math.abs(east.doorway.z) < 1e-10);
    });

    it('blocks the complete home footprint without applying animal clearance to it', () => {
        const block = {
            id: 'stable',
            name: 'HorseStable',
            rotation: 0,
        };
        const stack = {
            blocks: [block],
            position: new Vector3(3, 0, 4),
        };
        const blockData = getLocalSandboxBlockData();

        assert.deepEqual(
            createPersistentPetHomeBlockedCells({
                block,
                blockData,
                clearanceCells: 1,
                stack,
                stacks: [stack],
            }).sort((left, right) => left.x - right.x || left.z - right.z),
            [
                { x: 3, z: 4 },
                { x: 3, z: 5 },
                { x: 4, z: 4 },
                { x: 4, z: 5 },
            ],
        );
    });

    it('keeps every two-by-two pet doorway pathable for departures and returns', () => {
        const blockData = getLocalSandboxBlockData();
        const surfaces = Array.from({ length: 49 }, (_, index) => ({
            x: (index % 7) - 3,
            y: 0.025,
            z: Math.floor(index / 7) - 3,
        }));

        for (const blockName of [
            'CowShelter',
            'HorseStable',
            'SheepFold',
        ] as const) {
            const block = { id: blockName, name: blockName, rotation: 0 };
            const stack = {
                blocks: [block],
                position: new Vector3(0, 0, 0),
            };
            const placement = getPersistentPetHomePlacement({
                blockName,
                rotation: 0,
                x: 0,
                z: 0,
            });
            const blockedCells = createPersistentPetHomeBlockedCells({
                block,
                blockData,
                clearanceCells: blockName === 'HorseStable' ? 1 : 0,
                stack,
                stacks: [stack],
            });
            const doorway = { ...placement.doorway, y: 0.025 };
            const outside = {
                x: doorway.x + Math.sin(placement.facingYaw) * 1.5,
                y: 0.025,
                z: doorway.z + Math.cos(placement.facingYaw) * 1.5,
            };

            assert.equal(blockedCells.length, 4, blockName);
            assert.notEqual(
                findCatPath({
                    blockedCells,
                    from: doorway,
                    surfaces,
                    to: outside,
                }).status,
                'unreachable',
                `${blockName} departure`,
            );
            assert.notEqual(
                findCatPath({
                    blockedCells,
                    from: outside,
                    surfaces,
                    to: doorway,
                }).status,
                'unreachable',
                `${blockName} return`,
            );
        }
    });
});
