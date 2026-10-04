import { expect, test } from '@playwright/test';
import {
    getScheduleTaskBlockerReason,
    getScheduleTaskBlockerTargetKey,
    parseScheduleTaskBlockerTarget,
    scheduleTaskBlockerReasonRequiresNote,
} from './scheduleTaskBlocker';

test('parses operation and planting blocker targets into immutable task keys', () => {
    const operationTarget = parseScheduleTaskBlockerTarget({
        expectedEntityId: 701,
        expectedTaskVersionEventId: 0,
        kind: 'operation',
        operationId: 42,
    });
    const plantingTarget = parseScheduleTaskBlockerTarget({
        expectedPlantCycleEventId: 801,
        expectedPlantCycleVersionEventId: 802,
        expectedPlantSortId: 901,
        kind: 'planting',
        positionIndex: 0,
        raisedBedId: 12,
    });

    expect(operationTarget).toEqual({
        expectedEntityId: 701,
        expectedTaskVersionEventId: 0,
        kind: 'operation',
        operationId: 42,
    });
    expect(getScheduleTaskBlockerTargetKey(operationTarget)).toBe(
        'operation-42-entity-701-version-0',
    );
    expect(plantingTarget).toEqual({
        expectedPlantCycleEventId: 801,
        expectedPlantCycleVersionEventId: 802,
        expectedPlantSortId: 901,
        kind: 'planting',
        positionIndex: 0,
        raisedBedId: 12,
    });
    expect(getScheduleTaskBlockerTargetKey(plantingTarget)).toBe(
        'planting-12-0-cycle-801-version-802-sort-901',
    );
});

test('rejects malformed blocker targets before upload or mutation', () => {
    const invalidTargets: unknown[] = [
        null,
        {},
        { kind: 'unknown' },
        { kind: 'operation', operationId: 42 },
        { kind: 'operation', operationId: 0 },
        { kind: 'operation', operationId: 1.5 },
        { kind: 'operation', operationId: '42' },
        { expectedEntityId: 0, kind: 'operation', operationId: 42 },
        {
            expectedEntityId: 701,
            expectedTaskVersionEventId: -1,
            kind: 'operation',
            operationId: 42,
        },
        { kind: 'planting', positionIndex: 0, raisedBedId: 12 },
        { kind: 'planting', positionIndex: -1, raisedBedId: 12 },
        { kind: 'planting', positionIndex: 0, raisedBedId: 0 },
        { kind: 'planting', positionIndex: '0', raisedBedId: 12 },
        {
            expectedPlantCycleEventId: 801,
            expectedPlantCycleVersionEventId: 0,
            expectedPlantSortId: 901,
            kind: 'planting',
            positionIndex: 0,
            raisedBedId: 12,
        },
    ];

    for (const target of invalidTargets) {
        expect(() => parseScheduleTaskBlockerTarget(target)).toThrow();
    }
});

test('accepts only controlled blocker reasons and requires context where needed', () => {
    expect(getScheduleTaskBlockerReason('missing_materials')).toEqual({
        code: 'missing_materials',
        label: 'Nedostaje materijal ili oprema',
    });
    expect(scheduleTaskBlockerReasonRequiresNote('missing_materials')).toBe(
        false,
    );
    expect(scheduleTaskBlockerReasonRequiresNote('task_not_applicable')).toBe(
        true,
    );
    expect(scheduleTaskBlockerReasonRequiresNote('other')).toBe(true);
    expect(() => getScheduleTaskBlockerReason('custom reason')).toThrow(
        'Odabrani razlog nije ispravan.',
    );
    expect(() => getScheduleTaskBlockerReason(undefined)).toThrow(
        'Odaberi razlog',
    );
});
