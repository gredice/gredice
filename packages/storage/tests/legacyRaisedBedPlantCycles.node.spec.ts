import assert from 'node:assert/strict';
import test from 'node:test';
import {
    type LegacyRaisedBedPlantCycleEvent,
    LegacyRaisedBedPlantCycleProjectionError,
    projectLegacyRaisedBedPlantCycles,
} from '../src/helpers/legacyRaisedBedPlantCycles';

function event(
    id: number,
    type: string,
    data?: unknown,
): LegacyRaisedBedPlantCycleEvent {
    return {
        id,
        type,
        version: 1,
        aggregateId: '12|0',
        data,
        createdAt: new Date(
            `2026-05-${id.toString().padStart(2, '0')}T08:00:00.000Z`,
        ),
    };
}

test('projects replace, removal, reactivation, deletion, and later-cycle boundaries', () => {
    const sourceEvents = [
        event(1, 'raisedBedField.plantPlace', { plantSortId: '10' }),
        event(2, 'raisedBedField.plantReplaceSort', { plantSortId: 11 }),
        event(3, 'raisedBedField.plantUpdate', { status: 'removed' }),
        event(4, 'raisedBedField.plantUpdate', { status: 'planned' }),
        event(5, 'raisedBedField.plantBlock'),
        event(6, 'raisedBedField.plantUpdate', { status: 'notSprouted' }),
        event(7, 'raisedBedField.plantUpdate', { status: 'died' }),
        event(8, 'raisedBedField.plantUpdate', { status: 'harvested' }),
        event(9, 'raisedBedField.delete'),
        event(10, 'raisedBedField.plantPlace', { plantSortId: '20' }),
    ];

    const projections = projectLegacyRaisedBedPlantCycles(
        [...sourceEvents].reverse(),
    );

    assert.deepStrictEqual(
        projections.map((projection) => ({
            sourceEventId: projection.sourceEventId,
            plantSortId: projection.plantSortId,
            isActive: projection.isActive,
            stoppedAt: projection.stoppedAt,
            versionEventId: projection.versionEventId,
        })),
        [
            {
                sourceEventId: 1,
                plantSortId: 11,
                isActive: false,
                stoppedAt: sourceEvents[9]?.createdAt,
                versionEventId: 10,
            },
            {
                sourceEventId: 10,
                plantSortId: 20,
                isActive: true,
                stoppedAt: null,
                versionEventId: 10,
            },
        ],
    );
    assert.equal(
        projections[0]?.startedAt.getTime(),
        sourceEvents[0]?.createdAt.getTime(),
    );
});

test('rejects unsupported legacy event versions', () => {
    assert.throws(
        () =>
            projectLegacyRaisedBedPlantCycles([
                {
                    ...event(1, 'raisedBedField.plantPlace', {
                        plantSortId: '10',
                    }),
                    version: 2,
                },
            ]),
        (error) => {
            assert.ok(
                error instanceof LegacyRaisedBedPlantCycleProjectionError,
            );
            assert.equal(error.code, 'unsupported_event_version');
            return true;
        },
    );
});

test('preserves terminal stopped dates while active corrections clear them', () => {
    for (const status of ['notSprouted', 'died', 'harvested']) {
        const terminalEvent = event(2, 'raisedBedField.plantUpdate', {
            status,
            effectiveDate: '2026-05-02T07:00:00.000Z',
        });
        const [terminalCycle] = projectLegacyRaisedBedPlantCycles([
            event(1, 'raisedBedField.plantPlace', { plantSortId: '10' }),
            terminalEvent,
        ]);
        assert.equal(terminalCycle?.isActive, true);
        assert.equal(
            terminalCycle?.stoppedAt?.getTime(),
            new Date('2026-05-02T07:00:00.000Z').getTime(),
        );

        const [correctedCycle] = projectLegacyRaisedBedPlantCycles([
            event(1, 'raisedBedField.plantPlace', { plantSortId: '10' }),
            terminalEvent,
            event(3, 'raisedBedField.plantUpdate', { status: 'ready' }),
        ]);
        assert.equal(correctedCycle?.isActive, true);
        assert.equal(correctedCycle?.stoppedAt, null);
    }
});
