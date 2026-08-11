import {
    detailedRaisedBedInspectionNotificationType,
    operationCanceledNotificationType,
    operationCompletedNotificationType,
    raisedBedFieldPhotoCompletedNotificationType,
    raisedBedPhotoCompletedNotificationType,
} from '@gredice/js/notifications';

export type RaisedBedGardenNotificationPriority =
    | 'critical'
    | 'high'
    | 'normal'
    | 'low';

export type RaisedBedGardenNotification = {
    id: string;
    header: string;
    content: string;
    category: string;
    type: string;
    priority: RaisedBedGardenNotificationPriority;
    gardenId: number | null;
    raisedBedId: number | null;
    imageUrl: string | null;
    iconUrl: string | null;
    linkUrl: string | null;
    metadata: Record<string, unknown>;
    readAt: Date | null;
    timestamp: Date;
    createdAt: Date;
};

export type RaisedBedGardenNotificationKind =
    | 'raisedBedPhoto'
    | 'raisedBedFieldPhoto'
    | 'visual'
    | 'fieldOrPlantUpdate'
    | 'text';

export type SelectedRaisedBedGardenNotification = Omit<
    RaisedBedGardenNotification,
    'raisedBedId'
> & {
    kind: RaisedBedGardenNotificationKind;
    raisedBedId: number;
};

const kindPriority: Record<RaisedBedGardenNotificationKind, number> = {
    raisedBedPhoto: 0,
    raisedBedFieldPhoto: 1,
    visual: 2,
    fieldOrPlantUpdate: 3,
    text: 4,
};

const storedPriority: Record<RaisedBedGardenNotificationPriority, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
};

const fieldOrPlantTypePattern = /(?:^|_)(?:field|plant|planting)(?:_|$)/u;

function hasMedia(notification: RaisedBedGardenNotification) {
    return Boolean(
        notification.imageUrl?.trim() || notification.iconUrl?.trim(),
    );
}

function hasFieldTarget(metadata: Record<string, unknown>) {
    return (
        (typeof metadata.positionIndex === 'number' &&
            Number.isSafeInteger(metadata.positionIndex) &&
            metadata.positionIndex >= 0) ||
        (typeof metadata.raisedBedFieldId === 'number' &&
            Number.isSafeInteger(metadata.raisedBedFieldId) &&
            metadata.raisedBedFieldId > 0)
    );
}

function hasFieldLinkTarget(linkUrl: string | null) {
    if (!linkUrl) {
        return false;
    }

    try {
        const fieldParam = new URL(
            linkUrl,
            'https://vrt.gredice.test',
        ).searchParams.get('polje');
        if (!fieldParam || !/^\d+$/u.test(fieldParam)) {
            return false;
        }
        const fieldNumber = Number(fieldParam);
        return Number.isSafeInteger(fieldNumber) && fieldNumber > 0;
    } catch {
        return false;
    }
}

function classifyRaisedBedGardenNotification(
    notification: RaisedBedGardenNotification,
): RaisedBedGardenNotificationKind {
    const hasImage = Boolean(notification.imageUrl?.trim());
    if (
        hasImage &&
        notification.type === raisedBedPhotoCompletedNotificationType
    ) {
        return 'raisedBedPhoto';
    }
    if (
        hasImage &&
        (notification.type === raisedBedFieldPhotoCompletedNotificationType ||
            hasFieldLinkTarget(notification.linkUrl))
    ) {
        return 'raisedBedFieldPhoto';
    }
    if (hasMedia(notification)) {
        return 'visual';
    }
    if (
        notification.type === operationCompletedNotificationType ||
        notification.type === operationCanceledNotificationType
    ) {
        return 'text';
    }
    if (
        hasFieldTarget(notification.metadata) ||
        hasFieldLinkTarget(notification.linkUrl) ||
        fieldOrPlantTypePattern.test(notification.type)
    ) {
        return 'fieldOrPlantUpdate';
    }
    return 'text';
}

function timestampValue(value: Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function compareNotifications(
    left: SelectedRaisedBedGardenNotification,
    right: SelectedRaisedBedGardenNotification,
) {
    const kindDifference = kindPriority[left.kind] - kindPriority[right.kind];
    if (kindDifference !== 0) {
        return kindDifference;
    }

    const storedPriorityDifference =
        storedPriority[left.priority] - storedPriority[right.priority];
    if (storedPriorityDifference !== 0) {
        return storedPriorityDifference;
    }

    const timestampDifference =
        timestampValue(right.timestamp) - timestampValue(left.timestamp);
    if (timestampDifference !== 0) {
        return timestampDifference;
    }

    const createdAtDifference =
        timestampValue(right.createdAt) - timestampValue(left.createdAt);
    if (createdAtDifference !== 0) {
        return createdAtDifference;
    }

    if (left.id === right.id) {
        return 0;
    }
    return left.id > right.id ? -1 : 1;
}

function isEligibleRaisedBedGardenNotification({
    gardenId,
    notification,
    raisedBedIds,
}: {
    gardenId: number;
    notification: RaisedBedGardenNotification;
    raisedBedIds: ReadonlySet<number>;
}) {
    if (
        notification.readAt !== null ||
        notification.gardenId !== gardenId ||
        notification.raisedBedId === null ||
        !raisedBedIds.has(notification.raisedBedId) ||
        notification.type === detailedRaisedBedInspectionNotificationType
    ) {
        return false;
    }

    return (
        notification.category === 'garden' ||
        notification.category === 'general' ||
        hasMedia(notification)
    );
}

export function selectRaisedBedGardenNotifications({
    gardenId,
    notifications,
    raisedBedIds,
}: {
    gardenId: number;
    notifications: readonly RaisedBedGardenNotification[];
    raisedBedIds: readonly number[];
}): SelectedRaisedBedGardenNotification[] {
    const eligibleRaisedBedIds = new Set(raisedBedIds);
    const selectedByRaisedBedId = new Map<
        number,
        SelectedRaisedBedGardenNotification
    >();

    for (const notification of notifications) {
        if (
            !isEligibleRaisedBedGardenNotification({
                gardenId,
                notification,
                raisedBedIds: eligibleRaisedBedIds,
            }) ||
            notification.raisedBedId === null
        ) {
            continue;
        }

        const candidate: SelectedRaisedBedGardenNotification = {
            ...notification,
            kind: classifyRaisedBedGardenNotification(notification),
            raisedBedId: notification.raisedBedId,
        };
        const selected = selectedByRaisedBedId.get(candidate.raisedBedId);
        if (!selected || compareNotifications(candidate, selected) < 0) {
            selectedByRaisedBedId.set(candidate.raisedBedId, candidate);
        }
    }

    const emittedRaisedBedIds = new Set<number>();
    return raisedBedIds.flatMap((raisedBedId) => {
        if (emittedRaisedBedIds.has(raisedBedId)) {
            return [];
        }
        emittedRaisedBedIds.add(raisedBedId);
        const selected = selectedByRaisedBedId.get(raisedBedId);
        return selected ? [selected] : [];
    });
}
