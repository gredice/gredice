import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAppliedOperationCurrentForRaisedBedFields } from './appliedRaisedBedOperations';

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
