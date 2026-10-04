import assert from 'node:assert/strict';
import test from 'node:test';
import type { RaisedBedFieldPlantCycle } from '@gredice/storage';
import {
    type GreenhouseFieldCycleContext,
    type GreenhouseOperationCycleCandidate,
    getSeedlingTransplantingOperationTimestamp,
    isOperationInActivePlantCycle,
} from './operationMatching.ts';

const previousCycleStart = new Date('2026-01-01T08:00:00Z');
const previousCycleEnd = new Date('2026-02-01T08:00:00Z');
const activeCycleStart = new Date('2026-03-01T08:00:00Z');
const sproutedAt = new Date('2026-03-07T08:00:00Z');
const now = new Date('2026-03-08T08:00:00Z');

function buildCycle(
    overrides: Partial<RaisedBedFieldPlantCycle>,
): RaisedBedFieldPlantCycle {
    return {
        active: true,
        aggregateId: '1|0',
        assignedAt: undefined,
        assignedBy: undefined,
        assignedUserId: undefined,
        assignedUserIds: [],
        endedAt: sproutedAt,
        endedEventId: 2,
        eventIds: [1, 2],
        plantDeadDate: undefined,
        plantGrowthDate: sproutedAt,
        plantHarvestedDate: undefined,
        plantPlaceEventId: 1,
        plantReadyDate: undefined,
        plantRemovedDate: undefined,
        plantScheduledDate: undefined,
        plantSortId: 100,
        plantSowDate: undefined,
        plantStatus: 'sprouted',
        positionIndex: 0,
        sowingLocation: 'greenhouse',
        startedAt: activeCycleStart,
        statusChanges: [],
        stoppedDate: undefined,
        toBeRemoved: false,
        ...overrides,
    };
}

function buildField(
    overrides: Partial<GreenhouseFieldCycleContext> = {},
): GreenhouseFieldCycleContext {
    return {
        id: 10,
        plantGrowthDate: sproutedAt,
        plantCycles: [buildCycle({})],
        ...overrides,
    };
}

function buildOperation(
    overrides: Partial<GreenhouseOperationCycleCandidate> = {},
): GreenhouseOperationCycleCandidate {
    return {
        status: 'completed',
        timestamp: now,
        ...overrides,
    };
}

test('old transplant operation before active plant cycle is ignored', () => {
    assert.equal(
        isOperationInActivePlantCycle(
            buildOperation({ timestamp: previousCycleEnd }),
            buildField({
                plantCycles: [
                    buildCycle({
                        active: false,
                        endedAt: previousCycleEnd,
                        plantGrowthDate: previousCycleStart,
                        startedAt: previousCycleStart,
                    }),
                    buildCycle({}),
                ],
            }),
        ),
        false,
    );
});

test('transplant operation inside active plant cycle is current', () => {
    assert.equal(
        isOperationInActivePlantCycle(
            buildOperation({ timestamp: activeCycleStart }),
            buildField(),
        ),
        true,
    );
});

test('canceled transplant operation in active plant cycle is ignored', () => {
    assert.equal(
        isOperationInActivePlantCycle(
            buildOperation({ status: 'canceled', timestamp: activeCycleStart }),
            buildField(),
        ),
        false,
    );
});

test('new transplant operation timestamp follows sprouted date', () => {
    assert.equal(
        getSeedlingTransplantingOperationTimestamp(
            buildField(),
            now,
        ).toISOString(),
        sproutedAt.toISOString(),
    );
});

test('new transplant operation timestamp falls back to now without sprouted date', () => {
    assert.equal(
        getSeedlingTransplantingOperationTimestamp(
            buildField({
                plantGrowthDate: null,
                plantCycles: [buildCycle({ plantGrowthDate: undefined })],
            }),
            now,
        ).toISOString(),
        now.toISOString(),
    );
});
