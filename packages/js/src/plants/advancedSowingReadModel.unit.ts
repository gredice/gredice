import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildRaisedBedPlantingReadModels,
    findCanonicalLegacyPlantingForTask,
    type RaisedBedPlantingReadModelInput,
} from './advancedSowingReadModel';

function planting(
    overrides: Partial<RaisedBedPlantingReadModelInput> = {},
): RaisedBedPlantingReadModelInput {
    return {
        configurationSource: 'selected',
        id: 10,
        isActive: true,
        layoutKey: 'v1:fields:2x2:plants:1x1',
        legacyPlantPlaceEventId: null,
        lifecycleStartedAt: new Date('2026-08-01T08:00:00.000Z'),
        lifecycleStoppedAt: null,
        lifecycleVersionEventId: null,
        memberships: [
            {
                raisedBedField: { positionIndex: 3 },
            },
            {
                raisedBedField: { positionIndex: 0 },
            },
            {
                raisedBedField: { positionIndex: 1 },
            },
            {
                raisedBedField: { positionIndex: 0 },
            },
        ],
        plantCount: 1,
        plantSortId: 42,
        plantsPerAxis: 1,
        selectedSeedingDistanceCm: 60,
        spanColumns: 2,
        spanRows: 2,
        ...overrides,
    };
}

test('presents one selected planting from its immutable density and footprint snapshots', () => {
    assert.deepEqual(buildRaisedBedPlantingReadModels([planting()]), [
        {
            configurationSource: 'selected',
            id: 10,
            isActive: true,
            layoutStatus: 'selected',
            lifecycleStartedAt: new Date('2026-08-01T08:00:00.000Z'),
            lifecycleStoppedAt: null,
            plantCount: 1,
            plantSortId: 42,
            plantsPerAxis: 1,
            positionNumbers: [1, 2, 4],
            selectedSeedingDistanceCm: 60,
            spanColumns: 2,
            spanRows: 2,
        },
    ]);
});

test('keeps legacy layout unknown instead of deriving it from current catalogue data', () => {
    const [readModel] = buildRaisedBedPlantingReadModels([
        planting({
            configurationSource: 'legacy',
            layoutKey: null,
            legacyPlantPlaceEventId: 801,
            lifecycleVersionEventId: 804,
            plantCount: null,
            plantsPerAxis: null,
            selectedSeedingDistanceCm: null,
            spanColumns: 1,
            spanRows: 1,
        }),
    ]);

    assert.equal(readModel?.layoutStatus, 'legacy-unknown');
    assert.equal(readModel?.selectedSeedingDistanceCm, null);
    assert.equal(readModel?.plantsPerAxis, null);
    assert.equal(readModel?.plantCount, null);
    assert.equal(readModel?.spanRows, null);
    assert.equal(readModel?.spanColumns, null);
});

test('surfaces an incomplete selected snapshot without presenting invalid geometry', () => {
    const [readModel] = buildRaisedBedPlantingReadModels([
        planting({ plantCount: 0 }),
    ]);

    assert.equal(readModel?.layoutStatus, 'selected-incomplete');
    assert.equal(readModel?.selectedSeedingDistanceCm, null);
    assert.equal(readModel?.plantCount, null);
    assert.equal(readModel?.spanRows, null);
});

test('sorts logical plantings once with active records first', () => {
    const rows = buildRaisedBedPlantingReadModels([
        planting({
            id: 11,
            isActive: false,
            lifecycleStartedAt: '2026-08-02T08:00:00.000Z',
            lifecycleStoppedAt: '2026-08-03T08:00:00.000Z',
        }),
        planting({ id: 10 }),
    ]);

    assert.deepEqual(
        rows.map((row) => row.id),
        [10, 11],
    );
});

test('matches a legacy task only with the exact active cycle identity and version', () => {
    const legacy = planting({
        configurationSource: 'legacy',
        layoutKey: null,
        legacyPlantPlaceEventId: 801,
        lifecycleVersionEventId: 804,
        plantCount: null,
        plantsPerAxis: null,
        selectedSeedingDistanceCm: null,
        spanColumns: 1,
        spanRows: 1,
    });
    const identity = {
        expectedPlantCycleEventId: 801,
        expectedPlantCycleVersionEventId: 804,
        expectedPlantSortId: 42,
    };

    assert.equal(
        findCanonicalLegacyPlantingForTask([legacy], identity),
        legacy,
    );
    assert.equal(
        findCanonicalLegacyPlantingForTask([legacy], {
            ...identity,
            expectedPlantCycleVersionEventId: 805,
        }),
        null,
    );
    assert.equal(
        findCanonicalLegacyPlantingForTask(
            [planting({ legacyPlantPlaceEventId: 801 })],
            identity,
        ),
        null,
    );
    assert.equal(findCanonicalLegacyPlantingForTask([legacy], null), null);
});
