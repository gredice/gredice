import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import type { Stack } from '../types/Stack';
import {
    createEntityBlockInstanceIndex,
    getIndexedEntityBlocks,
    hasIndexedEntityBlocks,
} from './entityBlockInstanceIndex';

const stacks: Stack[] = [
    {
        position: new Vector3(4, 0, -2),
        blocks: [
            { id: 'legacy-pillow', name: 'Cat_Pillow', rotation: 0 },
            { id: 'tree-a', name: 'Tree', rotation: 1 },
        ],
    },
    {
        position: new Vector3(-1, 0, 3),
        blocks: [
            { id: 'canonical-pillow', name: 'CatPillow', rotation: 2 },
            { id: 'tree-b', name: 'Tree', rotation: 3 },
        ],
    },
];

describe('createEntityBlockInstanceIndex', () => {
    it('indexes block names and drag target identities in one stack-order pass', () => {
        const index = createEntityBlockInstanceIndex(stacks);

        assert.equal(hasIndexedEntityBlocks(index, 'Tree'), true);
        assert.equal(hasIndexedEntityBlocks(index, 'Bush'), false);
        assert.deepEqual(
            getIndexedEntityBlocks(index, 'Tree', undefined).map(
                ({ block }) => block.id,
            ),
            ['tree-a', 'tree-b'],
        );
        assert.equal(
            index.blockNameByActiveDragTargetKey.get('4|-2|legacy-pillow|0'),
            'Cat_Pillow',
        );
    });

    it('preserves original stack and block order when aliases are combined', () => {
        const index = createEntityBlockInstanceIndex(stacks);

        assert.deepEqual(
            getIndexedEntityBlocks(index, 'CatPillow', [
                'CatPillow',
                'Cat_Pillow',
            ]).map(({ block }) => block.id),
            ['legacy-pillow', 'canonical-pillow'],
        );
    });
});
