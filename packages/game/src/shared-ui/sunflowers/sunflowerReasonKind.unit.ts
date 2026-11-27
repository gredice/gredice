import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    gardenBlockReasonLabels,
    getGardenBlockReasonKind,
    getSunflowerHistoryReasonGroup,
} from './sunflowerReasonKind';

describe('getGardenBlockReasonKind', () => {
    it('reads the kind of garden block purchases, Expand debits and refunds', () => {
        assert.equal(
            getGardenBlockReasonKind(
                'gardenBlock:12:purchase:5f3c2b1a-0000-4000-8000-000000000001',
            ),
            'purchase',
        );
        assert.equal(
            getGardenBlockReasonKind(
                'gardenBlock:12:expand:5f3c2b1a-0000-4000-8000-000000000002',
            ),
            'expand',
        );
        assert.equal(
            getGardenBlockReasonKind('gardenBlock:12:recycle:block-77'),
            'recycle',
        );
    });

    it('ignores other reasons, legacy block reasons and unknown kinds', () => {
        for (const reason of [
            'blocks:Block_Grass',
            'block:Block_Grass',
            'recycle:Block_Grass',
            'gardenBlock:12:rotate:x',
            'gardenBlock',
            'gardenBlocks:12:purchase:x',
            'refund:operation:1',
            '',
        ]) {
            assert.equal(getGardenBlockReasonKind(reason), null, reason);
        }
    });

    it('labels each kind in Croatian', () => {
        assert.deepEqual(gardenBlockReasonLabels, {
            purchase: 'Postavljanje bloka',
            expand: 'Proširivanje bloka',
            recycle: 'Recikliranje bloka',
        });
    });
});

describe('getSunflowerHistoryReasonGroup', () => {
    it('keeps purchases, Expand debits and refunds of the same amount apart', () => {
        const purchase = getSunflowerHistoryReasonGroup(
            'gardenBlock:12:purchase:a',
        );
        const expand = getSunflowerHistoryReasonGroup(
            'gardenBlock:12:expand:b',
        );
        const recycle = getSunflowerHistoryReasonGroup(
            'gardenBlock:12:recycle:c',
        );
        assert.equal(purchase, 'gardenBlock:purchase');
        assert.equal(expand, 'gardenBlock:expand');
        assert.equal(recycle, 'gardenBlock:recycle');
        assert.equal(new Set([purchase, expand, recycle]).size, 3);
    });

    it('groups the same kind across gardens and operations', () => {
        assert.equal(
            getSunflowerHistoryReasonGroup('gardenBlock:12:purchase:a'),
            getSunflowerHistoryReasonGroup('gardenBlock:40:purchase:b'),
        );
    });

    it('keeps the existing groups for other reasons', () => {
        assert.equal(
            getSunflowerHistoryReasonGroup('refund:operation:1'),
            'refund:operation',
        );
        assert.equal(
            getSunflowerHistoryReasonGroup('refund:raisedBedField:1:0:100'),
            'refund:raisedBedField',
        );
        assert.equal(getSunflowerHistoryReasonGroup('daily:7'), 'daily');
        assert.equal(getSunflowerHistoryReasonGroup('gift'), 'gift');
        assert.equal(
            getSunflowerHistoryReasonGroup('block:Block_Grass'),
            'block',
        );
        assert.equal(
            getSunflowerHistoryReasonGroup('gardenBlock:12:other:x'),
            'gardenBlock',
        );
        assert.equal(getSunflowerHistoryReasonGroup(null), 'unknown');
        assert.equal(getSunflowerHistoryReasonGroup(undefined), 'unknown');
    });
});
