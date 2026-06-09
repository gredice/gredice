import type { OperationData } from '@gredice/client';
import type { GardenOperationItem } from './hooks/useGardenOperations';
import type { OperationVisualRewardKind } from './operationVisualRewards';

export const operationVisualRewardDebugProfile = 'operation-rewards';
export const operationVisualRewardDebugTimestamp = '2024-06-21T10:00:00.000Z';
export const operationVisualRewardDebugOlderTimestamp =
    '2024-06-21T08:00:00.000Z';
export const operationVisualRewardDebugNewerTimestamp =
    '2024-06-21T09:30:00.000Z';

export const operationVisualRewardDebugOperationIds = {
    agrotextile: 9405,
    harvest: 9408,
    mulch: 9403,
    photographyUpdate: 9409,
    removeAgrotextile: 9406,
    removeMulch: 9404,
    supports: 9407,
    watering: 9401,
    weeding: 9402,
} satisfies Record<OperationVisualRewardKind, number>;

export type OperationVisualRewardDebugBedState = {
    label: 'Before' | 'After';
    raisedBedId: number;
    state: string;
};

export type OperationVisualRewardDebugScenario = {
    after: OperationVisualRewardDebugBedState;
    before: OperationVisualRewardDebugBedState;
    kind: OperationVisualRewardKind;
    operationId: number;
    title: string;
};

export const operationVisualRewardDebugScenarios = [
    {
        title: 'Watering',
        kind: 'watering',
        operationId: operationVisualRewardDebugOperationIds.watering,
        before: {
            label: 'Before',
            raisedBedId: 101,
            state: 'Dry baseline soil',
        },
        after: {
            label: 'After',
            raisedBedId: 102,
            state: 'Moist darkened soil',
        },
    },
    {
        title: 'Weeding',
        kind: 'weeding',
        operationId: operationVisualRewardDebugOperationIds.weeding,
        before: {
            label: 'Before',
            raisedBedId: 103,
            state: 'Heavy visible weeds',
        },
        after: {
            label: 'After',
            raisedBedId: 104,
            state: 'Clean soil after weeding',
        },
    },
    {
        title: 'Mulch',
        kind: 'mulch',
        operationId: operationVisualRewardDebugOperationIds.mulch,
        before: {
            label: 'Before',
            raisedBedId: 105,
            state: 'Bare soil',
        },
        after: {
            label: 'After',
            raisedBedId: 106,
            state: 'Straw mulch layer',
        },
    },
    {
        title: 'Remove mulch',
        kind: 'removeMulch',
        operationId: operationVisualRewardDebugOperationIds.removeMulch,
        before: {
            label: 'Before',
            raisedBedId: 107,
            state: 'Existing straw layer',
        },
        after: {
            label: 'After',
            raisedBedId: 108,
            state: 'Clean planting zone',
        },
    },
    {
        title: 'Agrotextile',
        kind: 'agrotextile',
        operationId: operationVisualRewardDebugOperationIds.agrotextile,
        before: {
            label: 'Before',
            raisedBedId: 109,
            state: 'Exposed bed',
        },
        after: {
            label: 'After',
            raisedBedId: 110,
            state: 'Covered protected bed',
        },
    },
    {
        title: 'Remove agrotextile',
        kind: 'removeAgrotextile',
        operationId: operationVisualRewardDebugOperationIds.removeAgrotextile,
        before: {
            label: 'Before',
            raisedBedId: 111,
            state: 'Covered bed',
        },
        after: {
            label: 'After',
            raisedBedId: 112,
            state: 'Visible plants again',
        },
    },
    {
        title: 'Supports',
        kind: 'supports',
        operationId: operationVisualRewardDebugOperationIds.supports,
        before: {
            label: 'Before',
            raisedBedId: 113,
            state: 'Unsupported plants',
        },
        after: {
            label: 'After',
            raisedBedId: 114,
            state: 'Tied upright plants',
        },
    },
    {
        title: 'Harvest',
        kind: 'harvest',
        operationId: operationVisualRewardDebugOperationIds.harvest,
        before: {
            label: 'Before',
            raisedBedId: 115,
            state: 'Ripe plants',
        },
        after: {
            label: 'After',
            raisedBedId: 116,
            state: 'Harvest crate and reduced ripe visuals',
        },
    },
    {
        title: 'Photo update',
        kind: 'photographyUpdate',
        operationId: operationVisualRewardDebugOperationIds.photographyUpdate,
        before: {
            label: 'Before',
            raisedBedId: 117,
            state: 'Old state without proof marker',
        },
        after: {
            label: 'After',
            raisedBedId: 118,
            state: 'New proof photo marker',
        },
    },
] satisfies OperationVisualRewardDebugScenario[];

type OperationVisualRewardDebugOperationData = OperationData & {
    attributes: OperationData['attributes'] & {
        visualReward: OperationVisualRewardKind;
    };
};

function debugOperation({
    application,
    id,
    kind,
    label,
    name,
}: {
    application: string;
    id: number;
    kind: OperationVisualRewardKind;
    label: string;
    name: string;
}): OperationVisualRewardDebugOperationData {
    return {
        id,
        entityType: { id: 10, name: 'operation', label: 'Radnje' },
        slug: `debug-${name}`,
        attributes: {
            frequency: 'once',
            stage: {
                id,
                information: {
                    name: 'debug',
                    label: 'Debug',
                },
            },
            application,
            deliverable: false,
            duration: 15,
            visualReward: kind,
        },
        information: {
            description: `${label} visual reward debug operation.`,
            shortDescription: `${label} visual reward.`,
            name,
            label,
            instructions: `${label} debug instruction.`,
        },
        prices: {
            perOperation: 0,
        },
        image: { cover: { url: '' } },
        conditions: {
            completionAttachImages: kind === 'photographyUpdate',
            completionAttachImagesRequired: kind === 'photographyUpdate',
            completionAttachNotes: false,
            completionAttachNotesRequired: false,
        },
        createdAt: operationVisualRewardDebugTimestamp,
        updatedAt: operationVisualRewardDebugTimestamp,
    };
}

export const operationVisualRewardDebugOperationDefinitions = [
    debugOperation({
        id: operationVisualRewardDebugOperationIds.watering,
        kind: 'watering',
        name: 'debugWateringReward',
        label: 'Debug watering reward',
        application: 'raisedBedFull',
    }),
    debugOperation({
        id: operationVisualRewardDebugOperationIds.weeding,
        kind: 'weeding',
        name: 'debugWeedingReward',
        label: 'Debug weeding reward',
        application: 'plant',
    }),
    debugOperation({
        id: operationVisualRewardDebugOperationIds.mulch,
        kind: 'mulch',
        name: 'debugMulchReward',
        label: 'Debug mulch reward',
        application: 'raisedBedFull',
    }),
    debugOperation({
        id: operationVisualRewardDebugOperationIds.removeMulch,
        kind: 'removeMulch',
        name: 'debugRemoveMulchReward',
        label: 'Debug remove mulch reward',
        application: 'raisedBedFull',
    }),
    debugOperation({
        id: operationVisualRewardDebugOperationIds.agrotextile,
        kind: 'agrotextile',
        name: 'debugAgrotextileReward',
        label: 'Debug agrotextile reward',
        application: 'raisedBedFull',
    }),
    debugOperation({
        id: operationVisualRewardDebugOperationIds.removeAgrotextile,
        kind: 'removeAgrotextile',
        name: 'debugRemoveAgrotextileReward',
        label: 'Debug remove agrotextile reward',
        application: 'raisedBedFull',
    }),
    debugOperation({
        id: operationVisualRewardDebugOperationIds.supports,
        kind: 'supports',
        name: 'debugSupportsReward',
        label: 'Debug supports reward',
        application: 'raisedBedFull',
    }),
    debugOperation({
        id: operationVisualRewardDebugOperationIds.harvest,
        kind: 'harvest',
        name: 'debugHarvestReward',
        label: 'Debug harvest reward',
        application: 'raisedBedFull',
    }),
    debugOperation({
        id: operationVisualRewardDebugOperationIds.photographyUpdate,
        kind: 'photographyUpdate',
        name: 'debugPhotographyUpdateReward',
        label: 'Debug photo update reward',
        application: 'raisedBedFull',
    }),
] satisfies OperationVisualRewardDebugOperationData[];

export const operationVisualRewardDebugOperationItems = [
    {
        id: 9601,
        entityId: operationVisualRewardDebugOperationIds.photographyUpdate,
        entityTypeName: 'operation',
        raisedBedId: 118,
        raisedBedFieldId: null,
        status: 'completed',
        createdAt: operationVisualRewardDebugOlderTimestamp,
        scheduledDate: null,
        scheduledAt: null,
        completedAt: operationVisualRewardDebugNewerTimestamp,
        verifiedAt: operationVisualRewardDebugNewerTimestamp,
        canceledAt: null,
        imageUrls: [
            'https://cdn.gredice.com/debug/operation-reward-proof-1.jpg',
            'https://cdn.gredice.com/debug/operation-reward-proof-2.jpg',
        ],
        completionNotes: 'Debug proof photos for operation reward marker.',
        targetLabel: 'Raised bed 118',
        statusHistory: [
            {
                status: 'completed',
                changedAt: operationVisualRewardDebugNewerTimestamp,
            },
        ],
    },
] satisfies GardenOperationItem[];

export function isOperationVisualRewardDebugProfile(
    value: string | null | undefined,
) {
    return value === operationVisualRewardDebugProfile;
}
