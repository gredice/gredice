import assert from 'node:assert/strict';
import test from 'node:test';
import type { OperationData } from '@gredice/client';
import { resolveGardenAction } from './gardenActionTarget';
import type { AdvancedSowingGardenPlantingInput } from './raisedBed/advancedSowingGardenVisuals';
import type { RaisedBedFieldTargetGarden } from './raisedBed/plantPickerNavigation';

const operation: OperationData = {
    id: 501,
    entityType: { id: 10, name: 'operation', label: 'Radnje' },
    slug: 'okopavanje',
    attributes: {
        frequency: 'once',
        stage: { id: 1, information: { name: 'growth', label: 'Rast' } },
        application: 'plant',
        appliesToAllTargets: true,
        deliverable: false,
        duration: 30,
    },
    information: {
        description: '',
        shortDescription: '',
        name: 'okopavanje',
        label: 'Okopavanje',
        instructions: '',
    },
    prices: { perOperation: 3 },
    image: { cover: { url: '' } },
    conditions: {
        completionAttachImages: false,
        completionAttachImagesRequired: false,
        completionAttachNotes: false,
        completionAttachNotesRequired: false,
    },
    createdAt: '',
    updatedAt: '',
};
const sorts = [
    {
        id: 101,
        information: { plant: { id: 1, information: { operations: [] } } },
    },
];
const bed = {
    blockId: 'bed',
    id: 11,
    name: 'Prva',
    isValid: true,
    status: 'active',
    fields: [{ positionIndex: 0, active: true, plantSortId: 101 }],
};
const garden = {
    id: 1,
    isSandbox: false,
    stacks: [],
    raisedBeds: [bed],
} satisfies RaisedBedFieldTargetGarden;
const options = { garden, sorts, operations: [operation], cartItems: [] };
const planting = {
    id: 901,
    anchorPositionIndex: 0,
    configurationSource: 'selected',
    isActive: true,
    layoutKey: 'v1:fields:1x1:plants:1x1',
    layoutVersion: 1,
    lifecycleStartedAt: '2026-08-10T08:00:00.000Z',
    lifecycleStatus: 'growing',
    lifecycleVersionEventId: 902,
    memberships: [
        { isAnchor: true, positionIndex: 0, relativeColumn: 0, relativeRow: 0 },
    ],
    plantCount: 1,
    plantSortId: 101,
    plantsPerAxis: 1,
    selectedSeedingDistanceCm: 30,
    spanColumns: 1,
    spanRows: 1,
    selectedTask: {
        scheduledDate: '2026-08-10',
        sowingLocation: 'direct',
        status: 'completed',
        verification: { verifiedAt: '2026-08-10T08:00:00.000Z' },
    },
} satisfies AdvancedSowingGardenPlantingInput;

test('sowing skips occupied and cart-reserved fields', () => {
    const result = resolveGardenAction({
        ...options,
        action: { type: 'sow', plantId: 1 },
        cartItems: [
            {
                gardenId: 1,
                raisedBedId: 11,
                positionIndex: 1,
                entityTypeName: 'plantSort',
                status: 'new',
            },
        ],
    });
    assert.deepEqual(result, {
        type: 'sow',
        plantId: 1,
        gardenId: 1,
        raisedBedId: 11,
        raisedBedName: 'Prva',
        positionIndex: 2,
    });
});

test('sowing falls through a full or inactive bed to the first eligible bed', () => {
    const fullBed = {
        ...bed,
        fields: Array.from({ length: 18 }, (_, positionIndex) => ({
            positionIndex,
            active: true,
            plantSortId: 101,
        })),
    };
    const result = resolveGardenAction({
        ...options,
        action: { type: 'sow', plantId: 1, sortId: 101 },
        garden: {
            ...garden,
            raisedBeds: [
                fullBed,
                { ...bed, id: 12, status: 'abandoned' },
                { ...bed, id: 13 },
            ],
        },
    });
    assert.equal(result.type, 'sow');
    if (result.type === 'sow') assert.equal(result.raisedBedId, 13);
});

test('rejects mismatched varieties and sandbox requests', () => {
    assert.equal(
        resolveGardenAction({
            ...options,
            action: { type: 'sow', plantId: 2, sortId: 101 },
        }).type,
        'unavailable',
    );
    assert.equal(
        resolveGardenAction({
            ...options,
            action: { type: 'sow', plantId: 1 },
            garden: { ...garden, isSandbox: true },
        }).type,
        'unavailable',
    );
});

test('operation scopes keep garden, bed and planted field targets distinct', () => {
    for (const application of [
        'garden',
        'raisedBedFull',
        'raisedBed1m',
        'plant',
    ]) {
        const result = resolveGardenAction({
            ...options,
            action: { type: 'operation', operationId: 501 },
            operations: [
                {
                    ...operation,
                    attributes: { ...operation.attributes, application },
                },
            ],
        });
        assert.equal(result.type, 'operation');
        if (result.type !== 'operation') continue;
        assert.equal(
            result.raisedBedId,
            application === 'garden' ? undefined : 11,
        );
        assert.equal(
            result.positionIndex,
            application === 'plant' ? 0 : undefined,
        );
    }
});

test('rejects internal and plant-incompatible operations', () => {
    for (const attributes of [
        { ...operation.attributes, internal: true },
        { ...operation.attributes, appliesToAllTargets: false },
    ]) {
        assert.equal(
            resolveGardenAction({
                ...options,
                action: { type: 'operation', operationId: 501 },
                operations: [{ ...operation, attributes }],
            }).type,
            'unavailable',
        );
    }
});

test('empty-field operations skip pending cart sowing', () => {
    const result = resolveGardenAction({
        ...options,
        action: { type: 'operation', operationId: 501 },
        garden: { ...garden, raisedBeds: [{ ...bed, fields: [] }] },
        operations: [
            {
                ...operation,
                attributes: {
                    ...operation.attributes,
                    appliesToEmptyFields: true,
                },
            },
        ],
        cartItems: [
            {
                gardenId: 1,
                raisedBedId: 11,
                positionIndex: 0,
                entityTypeName: 'plantSort',
                status: 'new',
            },
        ],
    });
    assert.equal(result.type, 'operation');
    if (result.type === 'operation') assert.equal(result.positionIndex, 1);
});

test('selected plantings preserve versioned operation identity', () => {
    const result = resolveGardenAction({
        ...options,
        action: { type: 'operation', operationId: 501 },
        garden: { ...garden, raisedBeds: [{ ...bed, plantings: [planting] }] },
    });
    assert.equal(result.type, 'operation');
    if (result.type === 'operation')
        assert.deepEqual(result.plantingTarget, {
            plantingId: 901,
            expectedPlantSortId: 101,
            expectedLifecycleVersionEventId: 902,
        });
});

test('pending or terminal selected plantings cannot fall back to legacy fields', () => {
    for (const candidate of [
        {
            ...planting,
            selectedTask: { ...planting.selectedTask, status: 'new' },
        },
        { ...planting, lifecycleStatus: 'died' },
        { ...planting, lifecycleVersionEventId: null },
    ]) {
        assert.equal(
            resolveGardenAction({
                ...options,
                action: { type: 'operation', operationId: 501 },
                garden: {
                    ...garden,
                    raisedBeds: [{ ...bed, plantings: [candidate] }],
                },
            }).type,
            'unavailable',
        );
    }
});
