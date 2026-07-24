import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    readPlacementAnimationProfileMetrics,
    recordPlacementAnimationChunkRebuild,
    recordPlacementAnimationChunkUpdate,
    resetPlacementAnimationProfileMetrics,
    shouldRecordPlacementAnimationChunkRebuild,
} from './placementAnimationProfileMetrics';

describe('placement animation profile metrics', () => {
    it('separates logical chunk touches from physical overlay rebuilds', () => {
        resetPlacementAnimationProfileMetrics();
        recordPlacementAnimationChunkUpdate({ touchedChunkCount: 1 });
        recordPlacementAnimationChunkRebuild({
            durationMs: 1,
            transformedInstanceCount: 7,
        });
        recordPlacementAnimationChunkRebuild({
            durationMs: 2,
            transformedInstanceCount: 7,
        });
        recordPlacementAnimationChunkRebuild({
            durationMs: 3,
            transformedInstanceCount: 7,
        });

        assert.deepEqual(readPlacementAnimationProfileMetrics(), {
            placementChunkLogicalTouchedCount: 1,
            placementChunkLogicalUpdateCount: 1,
            placementChunkPhysicalRebuildCount: 3,
            placementChunkPhysicalRebuildDurationMaxMs: 3,
            placementChunkPhysicalRebuildDurationP95Ms: 3,
            placementChunkPhysicalTransformedInstanceCount: 21,
        });

        resetPlacementAnimationProfileMetrics();
        assert.deepEqual(readPlacementAnimationProfileMetrics(), {
            placementChunkLogicalTouchedCount: 0,
            placementChunkLogicalUpdateCount: 0,
            placementChunkPhysicalRebuildCount: 0,
            placementChunkPhysicalRebuildDurationMaxMs: 0,
            placementChunkPhysicalRebuildDurationP95Ms: 0,
            placementChunkPhysicalTransformedInstanceCount: 0,
        });
    });

    it('records hidden instance-reference rebuilds only while placement is involved', () => {
        const previousInstances = [{}];
        const currentInstances = [{}];

        assert.equal(
            shouldRecordPlacementAnimationChunkRebuild({
                currentInstances,
                currentPlacementSignature: '["a"]',
                previousInstances,
                previousPlacementSignature: '["a"]',
            }),
            true,
        );
        assert.equal(
            shouldRecordPlacementAnimationChunkRebuild({
                currentInstances,
                currentPlacementSignature: '',
                previousInstances,
                previousPlacementSignature: '',
            }),
            false,
        );
        assert.equal(
            shouldRecordPlacementAnimationChunkRebuild({
                currentInstances,
                currentPlacementSignature: '["a"]',
                previousInstances: currentInstances,
                previousPlacementSignature: '',
            }),
            false,
        );
    });
});
