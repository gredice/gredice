export type OperationVisualRewardKind =
    | 'agrotextile'
    | 'harvest'
    | 'mulch'
    | 'removeAgrotextile'
    | 'removeMulch'
    | 'supports'
    | 'watering'
    | 'weeding';

export type OperationVisualRewardFamily =
    | 'agrotextile'
    | 'harvest'
    | 'mulch'
    | 'supports'
    | 'watering'
    | 'weeds';

export type OperationVisualRewardPolarity = 'apply' | 'remove';

export type OperationVisualRewardScope = 'field' | 'garden' | 'raisedBed';

export type OperationVisualDefinitionInput = {
    id: number;
    slug?: string | null;
    attributes?: {
        application?: string | null;
        stage?: {
            information?: {
                label?: string | null;
                name?: string | null;
            } | null;
        } | null;
        visualReward?: string | null;
    } | null;
    image?: {
        cover?: {
            url?: string | null;
        } | null;
    } | null;
    information?: {
        description?: string | null;
        instructions?: string | null;
        label?: string | null;
        name?: string | null;
        shortDescription?: string | null;
    } | null;
};

export type AppliedOperationVisualInput = {
    id: number;
    entityId: number;
    raisedBedFieldId?: number | null;
    raisedBedId?: number | null;
    status: string;
    completedAt?: Date | string | null;
    createdAt?: Date | string | null;
    scheduledDate?: Date | string | null;
};

export type OperationHistoryVisualInput = AppliedOperationVisualInput & {
    canceledAt?: Date | string | null;
    completionNotes?: string | null;
    imageUrls?: string[] | null;
    verifiedAt?: Date | string | null;
};

export type OperationVisualReward = {
    active: boolean;
    completedAt: string | null;
    createdAt: string | null;
    entityId: number;
    family: OperationVisualRewardFamily;
    imageUrls: string[];
    kind: OperationVisualRewardKind;
    operationId: number;
    polarity: OperationVisualRewardPolarity;
    raisedBedFieldId: number | null;
    raisedBedId: number | null;
    scope: OperationVisualRewardScope;
    status: string;
    timestampMs: number;
    verifiedAt: string | null;
};

export type ResolveOperationVisualRewardsInput = {
    appliedOperations?: AppliedOperationVisualInput[];
    operationItems?: OperationHistoryVisualInput[];
    operations: OperationVisualDefinitionInput[];
};

const activeAppliedStatuses = new Set([
    'completed',
    'confirmed',
    'pendingVerification',
]);
const harvestRequestStatuses = new Set([
    'assigned',
    'completed',
    'confirmed',
    'pendingVerification',
    'planned',
]);

export function parseOperationVisualRewardKind(
    value: string | null | undefined,
): OperationVisualRewardKind | null {
    switch (value) {
        case 'agrotextile':
        case 'harvest':
        case 'mulch':
        case 'removeAgrotextile':
        case 'removeMulch':
        case 'supports':
        case 'watering':
        case 'weeding':
            return value;
        default:
            return null;
    }
}

export function resolveOperationVisualRewardKind(
    operation: OperationVisualDefinitionInput | undefined,
): OperationVisualRewardKind | null {
    if (!operation) {
        return null;
    }

    return parseOperationVisualRewardKind(operation.attributes?.visualReward);
}

export function getOperationVisualRewardFamily(
    kind: OperationVisualRewardKind,
): OperationVisualRewardFamily {
    switch (kind) {
        case 'agrotextile':
        case 'removeAgrotextile':
            return 'agrotextile';
        case 'harvest':
            return 'harvest';
        case 'mulch':
        case 'removeMulch':
            return 'mulch';
        case 'supports':
            return 'supports';
        case 'watering':
            return 'watering';
        case 'weeding':
            return 'weeds';
    }
}

export function getOperationVisualRewardPolarity(
    kind: OperationVisualRewardKind,
): OperationVisualRewardPolarity {
    switch (kind) {
        case 'removeAgrotextile':
        case 'removeMulch':
        case 'weeding':
            return 'remove';
        default:
            return 'apply';
    }
}

function dateToIso(value: Date | string | null | undefined) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    const timestamp = date.getTime();

    return Number.isFinite(timestamp) ? date.toISOString() : null;
}

function dateToTimestamp(value: Date | string | null | undefined) {
    if (!value) {
        return null;
    }

    const timestamp =
        value instanceof Date ? value.getTime() : Date.parse(value);

    return Number.isFinite(timestamp) ? timestamp : null;
}

function operationTimestampMs(
    operation: AppliedOperationVisualInput | OperationHistoryVisualInput,
) {
    return (
        dateToTimestamp(operation.completedAt) ??
        ('verifiedAt' in operation
            ? dateToTimestamp(operation.verifiedAt)
            : null) ??
        dateToTimestamp(operation.createdAt) ??
        dateToTimestamp(operation.scheduledDate) ??
        0
    );
}

function resolveOperationScope(
    operation: AppliedOperationVisualInput | OperationHistoryVisualInput,
): OperationVisualRewardScope {
    if (operation.raisedBedFieldId != null) {
        return 'field';
    }

    if (operation.raisedBedId != null) {
        return 'raisedBed';
    }

    return 'garden';
}

function createOperationVisualReward(
    operation: AppliedOperationVisualInput | OperationHistoryVisualInput,
    kind: OperationVisualRewardKind,
): OperationVisualReward {
    const polarity = getOperationVisualRewardPolarity(kind);

    return {
        active: polarity !== 'remove',
        completedAt: dateToIso(operation.completedAt),
        createdAt: dateToIso(operation.createdAt),
        entityId: operation.entityId,
        family: getOperationVisualRewardFamily(kind),
        imageUrls:
            'imageUrls' in operation
                ? Array.from(
                      new Set(
                          (operation.imageUrls ?? []).filter(
                              (url) =>
                                  typeof url === 'string' && url.length > 0,
                          ),
                      ),
                  )
                : [],
        kind,
        operationId: operation.id,
        polarity,
        raisedBedFieldId: operation.raisedBedFieldId ?? null,
        raisedBedId: operation.raisedBedId ?? null,
        scope: resolveOperationScope(operation),
        status: operation.status,
        timestampMs: operationTimestampMs(operation),
        verifiedAt:
            'verifiedAt' in operation ? dateToIso(operation.verifiedAt) : null,
    };
}

function rewardConflictKey(reward: OperationVisualReward) {
    return [
        reward.scope,
        reward.raisedBedId ?? 'garden',
        reward.raisedBedFieldId ?? 'all',
        reward.family,
    ].join(':');
}

function compareRewardRecency(
    next: OperationVisualReward,
    current: OperationVisualReward,
) {
    if (next.timestampMs !== current.timestampMs) {
        return next.timestampMs - current.timestampMs;
    }

    return next.operationId - current.operationId;
}

function resolveLatestRewards(rewards: OperationVisualReward[]) {
    const latestByKey = new Map<string, OperationVisualReward>();

    for (const reward of rewards) {
        const key = rewardConflictKey(reward);
        const current = latestByKey.get(key);

        if (!current || compareRewardRecency(reward, current) >= 0) {
            latestByKey.set(key, reward);
        }
    }

    return Array.from(latestByKey.values()).sort((a, b) => {
        const timestampDiff = b.timestampMs - a.timestampMs;
        return timestampDiff === 0
            ? b.operationId - a.operationId
            : timestampDiff;
    });
}

export function isAppliedOperationVisualStatus(status: string) {
    return activeAppliedStatuses.has(status);
}

function isOperationVisualRewardStatus(
    status: string,
    kind: OperationVisualRewardKind,
) {
    if (kind === 'harvest') {
        return harvestRequestStatuses.has(status);
    }

    return isAppliedOperationVisualStatus(status);
}

export function resolveOperationVisualRewards({
    appliedOperations = [],
    operationItems = [],
    operations,
}: ResolveOperationVisualRewardsInput) {
    const operationsById = new Map(
        operations.map((operation) => [operation.id, operation]),
    );
    const rewards: OperationVisualReward[] = [];

    for (const appliedOperation of appliedOperations) {
        const kind = resolveOperationVisualRewardKind(
            operationsById.get(appliedOperation.entityId),
        );

        if (
            !kind ||
            !isOperationVisualRewardStatus(appliedOperation.status, kind)
        ) {
            continue;
        }

        rewards.push(createOperationVisualReward(appliedOperation, kind));
    }

    for (const operationItem of operationItems) {
        const kind = resolveOperationVisualRewardKind(
            operationsById.get(operationItem.entityId),
        );

        if (
            kind !== 'harvest' ||
            !isOperationVisualRewardStatus(operationItem.status, kind)
        ) {
            continue;
        }

        rewards.push(createOperationVisualReward(operationItem, kind));
    }

    return resolveLatestRewards(rewards);
}

export function filterOperationVisualRewards(
    rewards: OperationVisualReward[],
    scope: {
        raisedBedFieldId?: number | null;
        raisedBedId?: number | null;
    },
) {
    return rewards.filter((reward) => {
        if (reward.scope === 'garden') {
            return true;
        }

        if (scope.raisedBedFieldId != null) {
            return (
                (reward.scope === 'raisedBed' &&
                    reward.raisedBedId === scope.raisedBedId) ||
                reward.raisedBedFieldId === scope.raisedBedFieldId
            );
        }

        return (
            reward.scope === 'raisedBed' &&
            scope.raisedBedId != null &&
            reward.raisedBedId === scope.raisedBedId
        );
    });
}
