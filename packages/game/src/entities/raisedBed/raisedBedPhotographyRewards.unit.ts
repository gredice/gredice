import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
    OperationHistoryVisualInput,
    OperationVisualDefinitionInput,
} from '../../operationVisualRewards';
import { resolveOperationVisualRewards } from '../../operationVisualRewards';
import { resolveRaisedBedPhotographyMarkers } from './raisedBedPhotographyRewards';

function operation(id: number): OperationVisualDefinitionInput {
    return {
        id,
        attributes: {
            application: 'raisedBedFull',
        },
        information: {
            description: 'Fotografiranje gredice',
            instructions: '',
            label: 'Fotografiranje gredice',
            name: 'raisedBedPhotography',
            shortDescription: 'Fotografija novog stanja',
        },
        slug: 'raised-bed-photography',
    };
}

const operations = [operation(1)];

function operationItem(
    id: number,
    input: {
        completedAt: string;
        imageUrls?: string[];
        raisedBedFieldId?: number | null;
        raisedBedId: number;
    },
): OperationHistoryVisualInput {
    return {
        id,
        completedAt: input.completedAt,
        createdAt: input.completedAt,
        entityId: 1,
        imageUrls: input.imageUrls ?? ['https://cdn.gredice.com/proof.jpg'],
        raisedBedFieldId: input.raisedBedFieldId,
        raisedBedId: input.raisedBedId,
        status: 'completed',
        verifiedAt: input.completedAt,
    };
}

test('raised-bed photography reward creates a centered proof marker', () => {
    const visualRewards = resolveOperationVisualRewards({
        operationItems: [
            operationItem(101, {
                completedAt: '2026-06-01T08:00:00.000Z',
                imageUrls: [
                    'https://cdn.gredice.com/photo-1.jpg',
                    'https://cdn.gredice.com/photo-2.jpg',
                ],
                raisedBedId: 10,
            }),
        ],
        operations,
    });

    assert.deepStrictEqual(
        resolveRaisedBedPhotographyMarkers({
            blockOffset: 0,
            fields: [],
            raisedBedId: 10,
            visualRewards,
        }),
        [
            {
                imageCount: 2,
                positionIndex: 4,
                scope: 'raisedBed',
                timestampMs: Date.parse('2026-06-01T08:00:00.000Z'),
            },
        ],
    );
});

test('field photography reward creates a marker on the matching field', () => {
    const visualRewards = resolveOperationVisualRewards({
        operationItems: [
            operationItem(201, {
                completedAt: '2026-06-01T08:00:00.000Z',
                raisedBedFieldId: 51,
                raisedBedId: 10,
            }),
        ],
        operations,
    });

    assert.deepStrictEqual(
        resolveRaisedBedPhotographyMarkers({
            blockOffset: 9,
            fields: [
                { active: true, id: 50, positionIndex: 9 },
                { active: true, id: 51, positionIndex: 10 },
            ],
            raisedBedId: 10,
            visualRewards,
        }),
        [
            {
                imageCount: 1,
                positionIndex: 1,
                scope: 'field',
                timestampMs: Date.parse('2026-06-01T08:00:00.000Z'),
            },
        ],
    );
});

test('photography markers require matching raised bed and images', () => {
    const visualRewards = resolveOperationVisualRewards({
        operationItems: [
            operationItem(301, {
                completedAt: '2026-06-01T08:00:00.000Z',
                imageUrls: [],
                raisedBedId: 10,
            }),
            operationItem(302, {
                completedAt: '2026-06-01T08:00:00.000Z',
                raisedBedId: 11,
            }),
        ],
        operations,
    });

    assert.deepStrictEqual(
        resolveRaisedBedPhotographyMarkers({
            blockOffset: 0,
            fields: [{ active: true, id: 50, positionIndex: 0 }],
            raisedBedId: 10,
            visualRewards,
        }),
        [],
    );
});
