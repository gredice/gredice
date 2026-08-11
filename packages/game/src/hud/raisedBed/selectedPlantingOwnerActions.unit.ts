import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getSelectedPlantingOwnerActionModel,
    readSelectedPlantingOwnerTaskSnapshot,
    type SelectedPlantingOwnerActionSnapshot,
    selectedPlantingOwnerTaskStatusLabel,
} from './selectedPlantingOwnerActions';

const referenceDate = new Date('2026-08-10T12:00:00.000Z');

function snapshot(
    overrides: Partial<SelectedPlantingOwnerActionSnapshot> = {},
): SelectedPlantingOwnerActionSnapshot {
    return {
        expectedLifecycleVersionEventId: 109,
        lifecycleStatus: 'planned',
        plantSortId: 42,
        selectedTask: {
            scheduledDate: '2026-08-12T00:00:00.000Z',
            sowingLocation: 'direct',
            status: 'planned',
            verified: false,
        },
        ...overrides,
    };
}

describe('selected planting owner actions', () => {
    it('projects only the owner-safe task fields from the Garden DTO', () => {
        assert.deepEqual(
            readSelectedPlantingOwnerTaskSnapshot({
                assignedUserIds: ['private-worker'],
                completion: null,
                eventId: 800,
                scheduledDate: '2026-08-12T00:00:00.000Z',
                sowingLocation: 'greenhouse',
                status: 'planned',
                verification: null,
            }),
            {
                scheduledDate: '2026-08-12T00:00:00.000Z',
                sowingLocation: 'greenhouse',
                status: 'planned',
                verified: false,
            },
        );
    });

    it('allows rescheduling and future cancellation only before sowing', () => {
        assert.deepEqual(
            getSelectedPlantingOwnerActionModel(snapshot(), referenceDate),
            {
                canCancel: true,
                canReschedule: true,
                cancelDisabledReason: null,
                lifecycleTargets: [],
                waitingForVerification: false,
            },
        );
        assert.equal(
            getSelectedPlantingOwnerActionModel(
                snapshot({
                    selectedTask: {
                        scheduledDate: '2026-08-10T00:00:00.000Z',
                        sowingLocation: 'direct',
                        status: 'planned',
                        verified: false,
                    },
                }),
                referenceDate,
            ).canCancel,
            false,
        );
        assert.equal(
            getSelectedPlantingOwnerActionModel(
                snapshot({ lifecycleStatus: 'sowed' }),
                referenceDate,
            ).canReschedule,
            false,
        );
    });

    it('waits for pending Farm verification and enables both completed paths', () => {
        assert.equal(
            selectedPlantingOwnerTaskStatusLabel({
                status: 'completed',
            }),
            'Sijanje je dovršeno',
        );
        assert.deepEqual(
            getSelectedPlantingOwnerActionModel(
                snapshot({
                    lifecycleStatus: 'pendingVerification',
                    selectedTask: {
                        scheduledDate: '2026-08-10T00:00:00.000Z',
                        sowingLocation: 'direct',
                        status: 'pendingVerification',
                        verified: false,
                    },
                }),
                referenceDate,
            ),
            {
                canCancel: false,
                canReschedule: false,
                cancelDisabledReason: null,
                lifecycleTargets: [],
                waitingForVerification: true,
            },
        );

        const adminCompleted = getSelectedPlantingOwnerActionModel(
            snapshot({
                lifecycleStatus: 'sowed',
                selectedTask: {
                    scheduledDate: '2026-08-10T00:00:00.000Z',
                    sowingLocation: 'direct',
                    status: 'completed',
                    verified: false,
                },
            }),
            referenceDate,
        );
        const farmerCompletedAndVerified = getSelectedPlantingOwnerActionModel(
            snapshot({
                lifecycleStatus: 'sowed',
                selectedTask: {
                    scheduledDate: '2026-08-10T00:00:00.000Z',
                    sowingLocation: 'direct',
                    status: 'completed',
                    verified: true,
                },
            }),
            referenceDate,
        );
        assert.deepEqual(adminCompleted.lifecycleTargets, ['sprouted']);
        assert.deepEqual(farmerCompletedAndVerified.lifecycleTargets, [
            'sprouted',
        ]);
        assert.deepEqual(
            getSelectedPlantingOwnerActionModel(
                snapshot({ expectedLifecycleVersionEventId: null }),
                referenceDate,
            ).lifecycleTargets,
            [],
        );
    });

    it('mirrors the owner lifecycle graph without farmer-only targets', () => {
        const completedTask = {
            scheduledDate: '2026-08-10T00:00:00.000Z',
            sowingLocation: 'direct' as const,
            status: 'completed' as const,
            verified: true,
        };
        assert.deepEqual(
            getSelectedPlantingOwnerActionModel(
                snapshot({
                    lifecycleStatus: 'sprouted',
                    selectedTask: completedTask,
                }),
                referenceDate,
            ).lifecycleTargets,
            ['sowed', 'notSprouted', 'died', 'ready'],
        );
        assert.deepEqual(
            getSelectedPlantingOwnerActionModel(
                snapshot({
                    lifecycleStatus: 'harvested',
                    selectedTask: completedTask,
                }),
                referenceDate,
            ).lifecycleTargets,
            ['removed'],
        );
        assert.deepEqual(
            getSelectedPlantingOwnerActionModel(
                snapshot({
                    lifecycleStatus: 'firstFlowers',
                    selectedTask: completedTask,
                }),
                referenceDate,
            ).lifecycleTargets,
            [],
        );
    });

    it('fails closed when the concurrency identity is unavailable', () => {
        assert.deepEqual(
            getSelectedPlantingOwnerActionModel(
                snapshot({ expectedLifecycleVersionEventId: null }),
                referenceDate,
            ),
            {
                canCancel: false,
                canReschedule: false,
                cancelDisabledReason: null,
                lifecycleTargets: [],
                waitingForVerification: false,
            },
        );
    });
});
