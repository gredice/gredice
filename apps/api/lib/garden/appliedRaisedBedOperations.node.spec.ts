import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    isAppliedOperationCurrentForRaisedBedFields,
    serializeAppliedRaisedBedOperation,
} from './appliedRaisedBedOperations';

describe('isAppliedOperationCurrentForRaisedBedFields', () => {
    it('keeps full raised-bed operations active across plant cycles', () => {
        assert.equal(
            isAppliedOperationCurrentForRaisedBedFields(
                {
                    raisedBedFieldId: null,
                    createdAt: new Date('2026-05-01T08:00:00.000Z'),
                    completedAt: new Date('2026-05-01T09:00:00.000Z'),
                },
                [],
            ),
            true,
        );
    });

    it('drops field operations from an earlier plant cycle', () => {
        assert.equal(
            isAppliedOperationCurrentForRaisedBedFields(
                {
                    raisedBedFieldId: 10,
                    createdAt: new Date('2026-05-01T08:00:00.000Z'),
                    completedAt: new Date('2026-05-01T09:00:00.000Z'),
                },
                [
                    {
                        id: 10,
                        active: true,
                        plantCycles: [
                            {
                                active: false,
                                startedAt: new Date('2026-04-01T08:00:00.000Z'),
                            },
                            {
                                active: true,
                                startedAt: new Date('2026-05-02T08:00:00.000Z'),
                            },
                        ],
                    },
                ],
            ),
            false,
        );
    });

    it('drops field operations before the active plant sowing date', () => {
        assert.equal(
            isAppliedOperationCurrentForRaisedBedFields(
                {
                    raisedBedFieldId: 10,
                    createdAt: new Date('2026-06-01T08:00:00.000Z'),
                    completedAt: new Date('2026-06-01T09:00:00.000Z'),
                },
                [
                    {
                        id: 10,
                        active: true,
                        plantSowDate: new Date('2026-06-02T08:00:00.000Z'),
                        plantCycles: [
                            {
                                active: true,
                                plantSowDate: new Date(
                                    '2026-06-02T08:00:00.000Z',
                                ),
                                startedAt: new Date(
                                    '2026-05-01T08:00:00.000Z',
                                ),
                            },
                        ],
                    },
                ],
            ),
            false,
        );
    });

    it('keeps field operations after the active plant sowing date', () => {
        assert.equal(
            isAppliedOperationCurrentForRaisedBedFields(
                {
                    raisedBedFieldId: 10,
                    createdAt: new Date('2026-06-02T08:10:00.000Z'),
                    completedAt: new Date('2026-06-02T09:00:00.000Z'),
                },
                [
                    {
                        id: 10,
                        active: true,
                        plantSowDate: new Date('2026-06-02T08:00:00.000Z'),
                        plantCycles: [
                            {
                                active: true,
                                plantSowDate: new Date(
                                    '2026-06-02T08:00:00.000Z',
                                ),
                                startedAt: new Date(
                                    '2026-05-01T08:00:00.000Z',
                                ),
                            },
                        ],
                    },
                ],
            ),
            true,
        );
    });

    it('keeps field operations applied during the active plant cycle', () => {
        assert.equal(
            isAppliedOperationCurrentForRaisedBedFields(
                {
                    raisedBedFieldId: 10,
                    createdAt: new Date('2026-05-02T08:10:00.000Z'),
                    completedAt: new Date('2026-05-02T09:00:00.000Z'),
                },
                [
                    {
                        id: 10,
                        active: true,
                        plantCycles: [
                            {
                                active: true,
                                startedAt: new Date('2026-05-02T08:00:00.000Z'),
                            },
                        ],
                    },
                ],
            ),
            true,
        );
    });

    it('drops field operations when the referenced field is no longer active', () => {
        assert.equal(
            isAppliedOperationCurrentForRaisedBedFields(
                {
                    raisedBedFieldId: 10,
                    createdAt: new Date('2026-05-02T08:10:00.000Z'),
                    completedAt: new Date('2026-05-02T09:00:00.000Z'),
                },
                [
                    {
                        id: 10,
                        active: false,
                        plantCycles: [
                            {
                                active: false,
                                startedAt: new Date('2026-05-02T08:00:00.000Z'),
                            },
                        ],
                    },
                ],
            ),
            false,
        );
    });
});

describe('serializeAppliedRaisedBedOperation', () => {
    it('includes raised-bed identity for whole-bed visual rewards', () => {
        assert.deepStrictEqual(
            serializeAppliedRaisedBedOperation({
                id: 2057,
                entityId: 9406,
                raisedBedId: 459,
                raisedBedFieldId: null,
                status: 'completed',
                createdAt: new Date('2026-05-13T23:17:16.911Z'),
                completedAt: new Date('2026-05-14T16:39:28.536Z'),
                scheduledDate: new Date('2026-05-14T09:00:00.000Z'),
            }),
            {
                id: 2057,
                entityId: 9406,
                raisedBedId: 459,
                raisedBedFieldId: null,
                status: 'completed',
                createdAt: '2026-05-13T23:17:16.911Z',
                completedAt: '2026-05-14T16:39:28.536Z',
                scheduledDate: '2026-05-14T09:00:00.000Z',
            },
        );
    });
});
