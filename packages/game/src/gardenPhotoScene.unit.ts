import assert from 'node:assert/strict';
import test from 'node:test';
import { createGardenPhotoScene } from './gardenPhotoScene';
import type { CurrentGarden } from './hooks/useCurrentGarden';

const garden: CurrentGarden = {
    id: 321,
    homeCamera: null,
    name: 'PRIVATE CUSTOMER NAME',
    isSandbox: true,
    isPublic: false,
    backgroundPalette: 'golden',
    location: { lat: 12.34567, lon: 76.54321 },
    raisedBeds: [],
    stacks: [
        {
            position: { x: 4, y: 0, z: -3 },
            blocks: [
                {
                    id: 'private-sign-id',
                    name: 'WoodenSign',
                    rotation: 2,
                    variant: 0,
                    message: 'PRIVATE SIGN NOTE',
                },
            ],
        },
    ],
};
const camera = {
    position: [-10, 20, -30],
    target: [4, 0, -3],
    zoom: 120,
    version: 8,
} satisfies Parameters<typeof createGardenPhotoScene>[1];
test('private photo projection retains selected layout, camera, fixed appearance and aspect ratio while redacting identifiers and sign text', () => {
    const capture = createGardenPhotoScene(garden, camera, {
        width: 2000,
        height: 1000,
    });
    assert.equal(capture.width, 1600);
    assert.equal(capture.height, 800);
    assert.deepEqual(capture.garden.homeCamera, {
        position: [-10, 20, -30],
        target: [4, 0, -3],
        zoom: 96,
    });
    assert.deepEqual(capture.garden.stacks['4']?.['-3'], [
        { id: 'photo-block-1', name: 'WoodenSign', rotation: 2, variant: 0 },
    ]);
    assert.equal(capture.garden.isPublic, false);
    for (const privateValue of [
        'PRIVATE',
        'private-sign-id',
        '12.34567',
        '76.54321',
    ])
        assert.equal(JSON.stringify(capture).includes(privateValue), false);
    assert.equal(garden.stacks[0]?.blocks[0]?.message, 'PRIVATE SIGN NOTE');
});
test('capture never substitutes a default camera for unavailable current view', () => {
    assert.throws(() =>
        createGardenPhotoScene(
            garden,
            { ...camera, zoom: NaN },
            { width: 800, height: 600 },
        ),
    );
    assert.throws(() =>
        createGardenPhotoScene(garden, camera, { width: 0, height: 600 }),
    );
});

test('crop visual projection removes bed names, private notes/photos and authored operation identities', () => {
    const privateGarden: CurrentGarden = {
        ...garden,
        raisedBeds: [
            {
                id: 8787,
                name: 'PRIVATE BED NAME',
                physicalId: 'PRIVATE PHYSICAL ID',
                blockId: 'private-sign-id',
                status: 'active',
                orientation: 'vertical',
                weedState: {
                    level: 'light',
                    source: 'admin',
                    observedAt: '2026-10-02',
                    updatedAt: '2026-10-03',
                    eventId: 6666,
                    notes: 'PRIVATE WEED NOTE',
                },
                abandonReason: null,
                isValid: true,
                createdAt: '',
                updatedAt: '',
                fields: [
                    {
                        id: 9999,
                        raisedBedId: 8787,
                        positionIndex: 3,
                        isDeleted: false,
                        createdAt: '',
                        updatedAt: '',
                        active: true,
                        toBeRemoved: false,
                        plantCycles: [
                            {
                                aggregateId: 'PRIVATE CROP CYCLE',
                                positionIndex: 3,
                                plantPlaceEventId: 8888,
                                eventIds: [8888],
                                startedAt: '2026-10-02T08:00:00Z',
                                endedAt: '2026-10-05T08:00:00Z',
                                endedEventId: 8888,
                                active: true,
                                plantSortId: 337,
                                plantStatus: 'sprouted',
                                sowingLocation: 'direct',
                                plantScheduledDate: undefined,
                                plantSowDate: '2026-10-01T08:00:00Z',
                                plantGrowthDate: '2026-10-05T08:00:00Z',
                                plantReadyDate: undefined,
                                plantDeadDate: undefined,
                                plantHarvestedDate: undefined,
                                plantRemovedDate: undefined,
                                statusChanges: [],
                                stoppedDate: undefined,
                                cancellationReason: 'PRIVATE REASON',
                                toBeRemoved: false,
                            },
                        ],
                        weedState: null,
                        plantSortId: 337,
                        plantStatus: 'sprouted',
                        plantStatusEventId: undefined,
                        plantStatusChangedAt: undefined,
                        plantScheduledDate: undefined,
                        plantReadyDate: undefined,
                        plantDeadDate: undefined,
                        plantHarvestedDate: undefined,
                        plantRemovedDate: undefined,
                        stoppedDate: undefined,
                        cancellationReason: undefined,
                        blockedAt: undefined,
                        blockedEventId: undefined,
                        blockReasonCode: undefined,
                        blockReasonLabel: undefined,
                        sowingLocation: 'direct',
                        plantSowDate: '2026-10-01T08:00:00Z',
                        plantGrowthDate: '2026-10-05T08:00:00Z',
                        blockNote: 'PRIVATE BED NOTE',
                        blockedBy: 'PRIVATE FARMER',
                        blockImageUrls: [
                            'https://private.example/PRIVATE-PHOTO.jpg',
                        ],
                    },
                ],
                appliedOperations: [
                    {
                        id: 7777,
                        entityId: 701,
                        raisedBedId: 8787,
                        raisedBedFieldId: 9999,
                        status: 'completed',
                        createdAt: '2026-10-07',
                        completedAt: '2026-10-08',
                        scheduledDate: '2026-10-07',
                    },
                ],
            },
        ],
    };
    const result = createGardenPhotoScene(privateGarden, camera, {
        width: 800,
        height: 600,
    });
    const serialized = JSON.stringify(result);
    for (const privateValue of [
        'PRIVATE',
        '8787',
        '9999',
        '7777',
        '8888',
        '6666',
        'private.example',
    ])
        assert.equal(serialized.includes(privateValue), false);
    assert.equal(result.garden.raisedBeds[0]?.blockId, 'photo-block-1');
    assert.equal(
        result.garden.raisedBeds[0]?.fields[0]?.plantCycles[0]?.startedAt,
        '2026-10-02T08:00:00Z',
    );
    assert.equal(
        result.garden.raisedBeds[0]?.fields[0]?.plantGrowthDate,
        '2026-10-05T08:00:00Z',
    );
    assert.equal(result.garden.raisedBeds[0]?.fields[0]?.plantSortId, 337);
    assert.equal(
        result.garden.raisedBeds[0]?.appliedOperations[0]?.entityId,
        701,
    );
    assert.equal(
        result.garden.raisedBeds[0]?.appliedOperations[0]?.raisedBedFieldId,
        1,
    );
});
