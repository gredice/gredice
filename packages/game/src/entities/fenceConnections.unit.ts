import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    doesFenceOwnMixedSpan,
    doesFenceOwnSpan,
    fenceBlockNames,
    fenceGateBlockNames,
    getFenceExtensionRotations,
    isFenceBlockName,
    isFenceGateBlockName,
    isFenceTopologyBlockName,
    resolveFenceConnection,
} from './fenceConnections';

function neighbors(...directions: Array<'e' | 'n' | 's' | 'w'>) {
    return {
        e: directions.includes('e'),
        n: directions.includes('n'),
        s: directions.includes('s'),
        total: directions.length,
        w: directions.includes('w'),
    };
}

describe('fence connections', () => {
    it('recognizes every connectable fence material', () => {
        assert.deepEqual(fenceBlockNames, [
            'Fence',
            'WhiteFence',
            'StoneFence',
            'PolishedStoneFence',
        ]);
        assert.ok(fenceBlockNames.every(isFenceBlockName));
        assert.equal(isFenceBlockName('RaisedBed'), false);
    });

    it('recognizes every gate as part of the fence topology family', () => {
        assert.deepEqual(fenceGateBlockNames, [
            'FenceGate',
            'WhiteFenceGate',
            'StoneFenceGate',
            'PolishedStoneFenceGate',
        ]);
        assert.ok(fenceGateBlockNames.every(isFenceGateBlockName));
        assert.ok(fenceGateBlockNames.every(isFenceTopologyBlockName));
        assert.equal(isFenceGateBlockName('Fence'), false);
    });

    it('assigns every mixed span to exactly one material', () => {
        for (const [sourceIndex, sourceName] of fenceBlockNames.entries()) {
            for (const neighborName of fenceBlockNames.slice(sourceIndex + 1)) {
                assert.equal(doesFenceOwnSpan(sourceName, neighborName), true);
                assert.equal(doesFenceOwnSpan(neighborName, sourceName), false);
                assert.equal(
                    doesFenceOwnMixedSpan(sourceName, neighborName),
                    true,
                );
            }
        }

        assert.equal(
            doesFenceOwnMixedSpan('Fence', 'PolishedStoneFence'),
            true,
        );
        assert.equal(doesFenceOwnMixedSpan('Fence', 'Fence'), false);
    });

    it('connects a fence half-span to a gate without extending through it', () => {
        for (const gateName of fenceGateBlockNames) {
            assert.equal(doesFenceOwnSpan('Fence', gateName), true);
            assert.equal(doesFenceOwnMixedSpan('Fence', gateName), false);
            assert.equal(doesFenceOwnSpan(gateName, 'Fence'), false);
        }
    });

    it('maps owned extensions to their cardinal rotations', () => {
        assert.deepEqual(
            getFenceExtensionRotations(neighbors('e', 'n', 'w')),
            [0, 2, 3],
        );
    });

    it('keeps the placed rotation for an isolated picket', () => {
        assert.deepEqual(resolveFenceConnection(neighbors(), 3), {
            rotation: 3,
            shape: 'Solo',
        });
    });

    it('points each end piece toward its only neighbor', () => {
        assert.deepEqual(resolveFenceConnection(neighbors('e'), 2), {
            rotation: 0,
            shape: 'Single',
        });
        assert.deepEqual(resolveFenceConnection(neighbors('n'), 2), {
            rotation: 3,
            shape: 'Single',
        });
        assert.deepEqual(resolveFenceConnection(neighbors('s'), 2), {
            rotation: 1,
            shape: 'Single',
        });
        assert.deepEqual(resolveFenceConnection(neighbors('w'), 2), {
            rotation: 2,
            shape: 'Single',
        });
    });

    it('resolves straight, corner, T, and cross topologies', () => {
        assert.deepEqual(resolveFenceConnection(neighbors('e', 'w'), 3), {
            rotation: 0,
            shape: 'Middle',
        });
        assert.deepEqual(resolveFenceConnection(neighbors('n', 's'), 3), {
            rotation: 1,
            shape: 'Middle',
        });
        assert.deepEqual(resolveFenceConnection(neighbors('e', 's'), 3), {
            rotation: 1,
            shape: 'Corner',
        });
        assert.deepEqual(resolveFenceConnection(neighbors('e', 's', 'w'), 3), {
            rotation: 1,
            shape: 'T',
        });
        assert.deepEqual(
            resolveFenceConnection(neighbors('e', 'n', 's', 'w'), 3),
            { rotation: 3, shape: 'Cross' },
        );
    });
});
