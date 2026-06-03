import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import type { Stack } from '../types/Stack';
import {
    getSpecialEntityDebugEntries,
    type SpecialEntityBlockData,
} from './specialEntityDebug';

function blockData(
    name: string,
    label: string,
    height: number,
): SpecialEntityBlockData {
    return {
        attributes: { height },
        information: { label, name },
    };
}

test('finds sunflower special entities by block name', () => {
    const stacks: Stack[] = [
        {
            position: new Vector3(2, 0, -1),
            blocks: [{ id: 'sunflower-1', name: 'Sunflower', rotation: 0 }],
        },
    ];

    const entries = getSpecialEntityDebugEntries({
        stacks,
        blockData: [blockData('Sunflower', 'Sunflower', 1.4)],
    });

    assert.deepEqual(entries, [
        {
            blockId: 'sunflower-1',
            blockName: 'Sunflower',
            id: 'sunflower:sunflower-1',
            kind: 'sunflower',
            label: 'Sunflower',
            position: { x: 2, y: 0.7, z: -1 },
        },
    ]);
});

test('finds sunflower special entities by localized block label', () => {
    const stacks: Stack[] = [
        {
            position: new Vector3(0, 0, 3),
            blocks: [
                { id: 'ground-1', name: 'Block_Grass', rotation: 0 },
                { id: 'reward-1', name: 'Special_Reward', rotation: 0 },
            ],
        },
    ];

    const entries = getSpecialEntityDebugEntries({
        stacks,
        blockData: [
            blockData('Block_Grass', 'Grass', 0.4),
            blockData('Special_Reward', 'Suncokret', 1.2),
        ],
    });

    assert.deepEqual(entries, [
        {
            blockId: 'reward-1',
            blockName: 'Special_Reward',
            id: 'sunflower:reward-1',
            kind: 'sunflower',
            label: 'Suncokret',
            position: { x: 0, y: 1, z: 3 },
        },
    ]);
});

test('ignores non-sunflower entities', () => {
    const stacks: Stack[] = [
        {
            position: new Vector3(0, 0, 0),
            blocks: [{ id: 'tree-1', name: 'Tree', rotation: 0 }],
        },
    ];

    assert.deepEqual(
        getSpecialEntityDebugEntries({
            stacks,
            blockData: [blockData('Tree', 'Tree', 1.8)],
        }),
        [],
    );
});
