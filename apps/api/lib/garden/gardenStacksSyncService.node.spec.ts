import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getRaisedBedMergeCandidates } from './gardenStacksSyncService';

describe('getRaisedBedMergeCandidates', () => {
    it('does not miss a valid pair when an orphan raised-bed block is checked first', () => {
        const mergeCandidates = getRaisedBedMergeCandidates({
            placements: [
                {
                    blockId: 'active-a',
                    index: 1,
                    x: 0,
                    y: 0,
                },
                {
                    blockId: 'orphan-bed',
                    index: 1,
                    x: 0,
                    y: -1,
                },
                {
                    blockId: 'active-b',
                    index: 1,
                    x: 1,
                    y: 0,
                },
            ],
            raisedBeds: [
                {
                    id: 10,
                    blockId: 'active-a',
                    status: 'new',
                },
                {
                    id: 11,
                    blockId: 'active-b',
                    status: 'new',
                },
            ],
        });

        assert.deepStrictEqual(mergeCandidates, [
            {
                targetRaisedBedId: 10,
                sourceRaisedBedId: 11,
            },
        ]);
    });
});
