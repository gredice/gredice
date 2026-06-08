export type OperationVisualRewardKind =
    | 'agrotextile'
    | 'harvest'
    | 'mulch'
    | 'photographyUpdate'
    | 'removeAgrotextile'
    | 'removeMulch'
    | 'supports'
    | 'watering'
    | 'weeding';

export type OperationVisualRewardFamily =
    | 'agrotextile'
    | 'harvest'
    | 'mulch'
    | 'photography'
    | 'supports'
    | 'watering'
    | 'weeds';

export type OperationVisualRewardPolarity = 'apply' | 'remove' | 'update';

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

const removalKeywords = [
    'ciscenje',
    'makn',
    'odstran',
    'remove',
    'removal',
    'skid',
    'uklanj',
];

const operationKeywordGroups = {
    agrotextile: [
        'agro textile',
        'agrotekstil',
        'agrotextil',
        'agrotextile',
        'agril',
        'agryl',
    ],
    harvest: ['berba', 'branje', 'harvest', 'ubiranje'],
    mulch: ['hay', 'malc', 'malcir', 'mulch', 'sijeno', 'slama', 'straw'],
    photography: ['foto', 'fotograf', 'photo', 'photography', 'slika'],
    supports: [
        'kolac',
        'kolci',
        'potpor',
        'stake',
        'staking',
        'support',
        'tie',
        'vezanje',
        'veziv',
    ],
    watering: ['navodnj', 'watering', 'zalijev'],
    weeds: ['korov', 'plijev', 'pljev', 'weed', 'weeding'],
};

function normalizeSearchText(value: string | null | undefined) {
    return (value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function textIncludesAny(text: string, keywords: string[]) {
    return keywords.some((keyword) =>
        text.includes(normalizeSearchText(keyword)),
    );
}

function operationSearchText(operation: OperationVisualDefinitionInput) {
    return normalizeSearchText(
        [
            operation.slug,
            operation.information?.name,
            operation.information?.label,
            operation.information?.shortDescription,
            operation.information?.description,
            operation.information?.instructions,
            operation.attributes?.application,
            operation.attributes?.stage?.information?.name,
            operation.attributes?.stage?.information?.label,
            operation.image?.cover?.url,
        ]
            .filter((value): value is string => typeof value === 'string')
            .join(' '),
    );
}

function operationStageText(operation: OperationVisualDefinitionInput) {
    return normalizeSearchText(
        [
            operation.attributes?.stage?.information?.name,
            operation.attributes?.stage?.information?.label,
        ]
            .filter((value): value is string => typeof value === 'string')
            .join(' '),
    );
}

function hasRemovalIntent(text: string) {
    return textIncludesAny(text, removalKeywords);
}

export function resolveOperationVisualRewardKind(
    operation: OperationVisualDefinitionInput | undefined,
): OperationVisualRewardKind | null {
    if (!operation) {
        return null;
    }

    const text = operationSearchText(operation);
    const stageText = operationStageText(operation);
    const isRemoval = hasRemovalIntent(text);

    if (textIncludesAny(text, operationKeywordGroups.photography)) {
        return 'photographyUpdate';
    }

    if (
        textIncludesAny(stageText, operationKeywordGroups.watering) ||
        textIncludesAny(text, operationKeywordGroups.watering)
    ) {
        return 'watering';
    }

    if (
        textIncludesAny(stageText, operationKeywordGroups.harvest) ||
        textIncludesAny(text, operationKeywordGroups.harvest)
    ) {
        return 'harvest';
    }

    if (textIncludesAny(text, operationKeywordGroups.agrotextile)) {
        return isRemoval ? 'removeAgrotextile' : 'agrotextile';
    }

    if (textIncludesAny(text, operationKeywordGroups.mulch)) {
        return isRemoval ? 'removeMulch' : 'mulch';
    }

    if (textIncludesAny(text, operationKeywordGroups.weeds)) {
        return 'weeding';
    }

    if (textIncludesAny(text, operationKeywordGroups.supports)) {
        return 'supports';
    }

    return null;
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
        case 'photographyUpdate':
            return 'photography';
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
        case 'photographyUpdate':
            return 'update';
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
        if (!isAppliedOperationVisualStatus(appliedOperation.status)) {
            continue;
        }

        const kind = resolveOperationVisualRewardKind(
            operationsById.get(appliedOperation.entityId),
        );

        if (!kind || kind === 'photographyUpdate') {
            continue;
        }

        rewards.push(createOperationVisualReward(appliedOperation, kind));
    }

    for (const operationItem of operationItems) {
        if (!isAppliedOperationVisualStatus(operationItem.status)) {
            continue;
        }

        const kind = resolveOperationVisualRewardKind(
            operationsById.get(operationItem.entityId),
        );

        if (kind !== 'photographyUpdate' || !operationItem.imageUrls?.length) {
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
