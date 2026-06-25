import { Button } from '@gredice/ui/Button';
import { Divider } from '@gredice/ui/Divider';
import { DotIndicator } from '@gredice/ui/DotIndicator';
import { ImageGallery } from '@gredice/ui/ImageGallery';
import {
    Approved,
    Calendar,
    Close,
    Error as ErrorIcon,
    History,
    Hourglass,
    Inbox,
    ListTodo,
    MailCheck,
    Navigate,
    ShoppingCart,
} from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { OperationImage } from '@gredice/ui/OperationImage';
import { Popper } from '@gredice/ui/Popper';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Tooltip, TooltipContent, TooltipTrigger } from '@gredice/ui/Tooltip';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import {
    type ComponentType,
    type ReactNode,
    useCallback,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import {
    getDiaryCancelDisabledReason,
    isDiaryCancelTargetEligible,
} from '../hooks/useCancelDiaryEntry';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import {
    type GardenOperationItem,
    type GardenOperationStatus,
    useGardenOperations,
} from '../hooks/useGardenOperations';
import { useLiveTime } from '../hooks/useLiveTime';
import { useOperations } from '../hooks/useOperations';
import { useSorts } from '../hooks/usePlantSorts';
import {
    type DiaryRescheduleTarget,
    getDiaryRescheduleDisabledReason,
    isDiaryRescheduleTargetEligible,
} from '../hooks/useRescheduleDiaryEntry';
import {
    type ShoppingCartItemData,
    useShoppingCart,
} from '../hooks/useShoppingCart';
import { ScrollView } from '../shared-ui/ScrollView';
import { useShoppingCartOpenParam } from '../useUrlState';
import { sortOperationTasksNewestFirst } from './gardenOperationOrdering';
import { RaisedBedDiaryCancelAction } from './raisedBed/RaisedBedDiaryCancelAction';
import { RaisedBedDiaryRescheduleAction } from './raisedBed/RaisedBedDiaryRescheduleAction';

type OperationData = NonNullable<
    ReturnType<typeof useOperations>['data']
>[number];
type PlantSortData = NonNullable<ReturnType<typeof useSorts>['data']>[number];
type CurrentGardenData = NonNullable<
    ReturnType<typeof useCurrentGarden>['data']
>;
type RaisedBedData = CurrentGardenData['raisedBeds'][number];
type RaisedBedFieldData = RaisedBedData['fields'][number];
type GardenOperationHudItem = GardenOperationItem;
type OperationTargetDetails =
    | {
          type: 'raisedBed';
          fieldLabel: string | null;
          raisedBedName: string;
          raisedBedPhysicalId: string | number | null;
          fallbackLabel: string;
      }
    | {
          type: 'text';
          label: string;
      };
type SowingPlantLifecycleEntry = {
    active?: boolean | null;
    assignedAt?: string | Date | null;
    assignedUserId?: string | null;
    assignedUserIds?: string[] | null;
    createdAt?: string | Date | null;
    endedAt?: string | Date | null;
    plantPlaceEventId?: number | null;
    plantScheduledDate?: string | Date | null;
    plantSowDate?: string | Date | null;
    plantStatus?: string | null;
    plantSortId?: number | null;
    startedAt?: string | Date | null;
    stoppedDate?: string | Date | null;
    updatedAt?: string | Date | null;
};

function formatRaisedBedTargetLabel(
    raisedBedName: string,
    fieldLabel: string | null,
) {
    return fieldLabel ? `${raisedBedName} › ${fieldLabel}` : raisedBedName;
}

const uiPipeline: GardenOperationStatus[] = [
    'new',
    'planned',
    'assigned',
    'confirmed',
    'completed',
];

const terminalFailureStatuses = new Set<GardenOperationStatus>([
    'failed',
    'canceled',
]);

const hiddenFromActive = new Set<GardenOperationStatus>([
    'completed',
    'failed',
    'canceled',
]);
const nonEditableStatuses = new Set<GardenOperationStatus>([
    'completed',
    'canceled',
]);
const cartOperationEntityType = 'operation' as const;
export const cartPlantSortEntityType = 'plantSort' as const;
const plantingOperationLabel = 'Sadnja';
const plantSortFallbackLabel = 'Sorta';
const sowingCompletedStatuses = new Set([
    'sowed',
    'sprouted',
    'firstFlowers',
    'firstFruitSet',
    'ready',
    'harvested',
    'notSprouted',
    'died',
    'removed',
]);

type StatusConfig = {
    label: string;
    icon: ComponentType<{ className?: string }>;
    colorClass: string;
};
type OperationDisplayStatus = GardenOperationStatus | 'scheduled';
type OperationStatusProgressStep = {
    status: OperationDisplayStatus;
    date: string | null;
    reached: boolean;
    current: boolean;
    pending: boolean;
    failed?: boolean;
    skipped?: boolean;
};

const statusConfig: Record<GardenOperationStatus, StatusConfig> = {
    new: {
        label: 'Kreirano',
        icon: Inbox,
        colorClass: 'text-sky-600',
    },
    planned: {
        label: 'Planirano',
        icon: Calendar,
        colorClass: 'text-indigo-600',
    },
    assigned: {
        label: 'Dodijeljeno',
        icon: MailCheck,
        colorClass: 'text-violet-600',
    },
    confirmed: {
        label: 'Potvrđeno',
        icon: Hourglass,
        colorClass: 'text-amber-600',
    },
    completed: {
        label: 'Završeno',
        icon: Approved,
        colorClass: 'text-green-600',
    },
    failed: {
        label: 'Neuspjelo',
        icon: ErrorIcon,
        colorClass: 'text-red-600',
    },
    canceled: {
        label: 'Otkazano',
        icon: Close,
        colorClass: 'text-neutral-500',
    },
};
const scheduledStatusConfig: StatusConfig = {
    label: 'Zakazano',
    icon: Calendar,
    colorClass: 'text-indigo-600',
};

function getDisplayStatusConfig(status: OperationDisplayStatus) {
    return status === 'scheduled'
        ? scheduledStatusConfig
        : statusConfig[status];
}

function formatDate(value?: string | null) {
    if (!value) return null;
    return new Date(value).toLocaleDateString('hr-HR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parseScheduledDate(additionalData: string | null | undefined) {
    if (!additionalData) return null;

    try {
        const parsed: unknown = JSON.parse(additionalData);
        if (!isRecord(parsed) || typeof parsed.scheduledDate !== 'string') {
            return null;
        }

        const date = new Date(parsed.scheduledDate);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    } catch {
        return null;
    }
}

function getTomorrowDate() {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
}

function getCartItemScheduledDate(item: ShoppingCartItemData) {
    const scheduledDate = parseScheduledDate(item.additionalData);
    return scheduledDate ? new Date(scheduledDate) : getTomorrowDate();
}

function getTimestamp(value: string | Date | null | undefined) {
    const timestamp = value ? new Date(value).getTime() : 0;
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function getStartOfNextLocalDay(referenceDate: Date) {
    return new Date(
        referenceDate.getFullYear(),
        referenceDate.getMonth(),
        referenceDate.getDate() + 1,
    );
}

function isScheduledForLaterDate(
    scheduledDate: string | null | undefined,
    referenceDate: Date,
) {
    if (!scheduledDate) {
        return false;
    }

    const scheduledTimestamp = new Date(scheduledDate).getTime();
    if (!Number.isFinite(scheduledTimestamp)) {
        return false;
    }

    return (
        scheduledTimestamp >= getStartOfNextLocalDay(referenceDate).getTime()
    );
}

function isScheduledUnassignedOperation(
    operation: GardenOperationHudItem,
    referenceDate: Date,
) {
    return (
        operation.status === 'planned' &&
        isScheduledForLaterDate(operation.scheduledDate, referenceDate)
    );
}

function toIsoString(value: string | Date | null | undefined) {
    if (!value) return null;

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getSowingEntryCreatedAt(
    entry: SowingPlantLifecycleEntry,
    field: RaisedBedFieldData,
) {
    return (
        toIsoString(entry.startedAt) ??
        toIsoString(entry.createdAt) ??
        toIsoString(field.createdAt) ??
        toIsoString(entry.plantScheduledDate) ??
        toIsoString(field.updatedAt) ??
        new Date(0).toISOString()
    );
}

function getSowingEntryCompletedAt(entry: SowingPlantLifecycleEntry) {
    return (
        toIsoString(entry.plantSowDate) ??
        toIsoString(entry.endedAt) ??
        toIsoString(entry.updatedAt)
    );
}

function hasAssignedSowingUser(entry: SowingPlantLifecycleEntry) {
    return (
        (entry.assignedUserIds?.length ?? 0) > 0 ||
        Boolean(entry.assignedUserId)
    );
}

function getSowingOperationStatus(
    entry: SowingPlantLifecycleEntry,
): GardenOperationStatus | null {
    const status = entry.plantStatus ?? 'new';

    if (status === 'deleted' || status === 'canceled') {
        return 'canceled';
    }

    if (sowingCompletedStatuses.has(status)) {
        return 'completed';
    }

    if (status === 'pendingVerification') {
        return 'confirmed';
    }

    if (hasAssignedSowingUser(entry)) {
        return 'assigned';
    }

    if (status === 'planned' || entry.plantScheduledDate) {
        return 'planned';
    }

    if (status === 'new') {
        return 'new';
    }

    return null;
}

function buildSowingStatusHistory(
    entry: SowingPlantLifecycleEntry,
    field: RaisedBedFieldData,
    status: GardenOperationStatus,
): GardenOperationItem['statusHistory'] {
    const createdAt = getSowingEntryCreatedAt(entry, field);
    const plannedAt = toIsoString(entry.plantScheduledDate);
    const assignedAt = toIsoString(entry.assignedAt);
    const completedAt = getSowingEntryCompletedAt(entry);
    const canceledAt =
        status === 'canceled'
            ? (toIsoString(entry.stoppedDate) ??
              toIsoString(entry.updatedAt) ??
              createdAt)
            : null;
    const history: GardenOperationItem['statusHistory'] = [
        {
            status: 'new',
            changedAt: createdAt,
        },
    ];

    if (
        plannedAt ||
        status === 'planned' ||
        status === 'assigned' ||
        status === 'confirmed' ||
        status === 'completed'
    ) {
        history.push({
            status: 'planned',
            changedAt: plannedAt ?? createdAt,
        });
    }

    if (
        assignedAt ||
        status === 'assigned' ||
        (status === 'confirmed' && hasAssignedSowingUser(entry))
    ) {
        history.push({
            status: 'assigned',
            changedAt: assignedAt ?? plannedAt ?? createdAt,
        });
    }

    if (status === 'confirmed') {
        history.push({
            status: 'confirmed',
            changedAt: completedAt ?? assignedAt ?? plannedAt ?? createdAt,
        });
    }

    if (status === 'completed') {
        history.push({
            status: 'completed',
            changedAt: completedAt ?? plannedAt ?? createdAt,
        });
    }

    if (status === 'canceled') {
        history.push({
            status: 'canceled',
            changedAt: canceledAt ?? createdAt,
        });
    }

    return history;
}

function getSowingEntries(
    field: RaisedBedFieldData,
): SowingPlantLifecycleEntry[] {
    if (field.plantCycles && field.plantCycles.length > 0) {
        return field.plantCycles.map((plantCycle) => plantCycle);
    }

    return [field];
}

export function buildSowingOperationItems(
    garden: CurrentGardenData | null | undefined,
): GardenOperationHudItem[] {
    if (!garden) {
        return [];
    }

    return garden.raisedBeds.flatMap((raisedBed) =>
        raisedBed.fields.flatMap((field) =>
            getSowingEntries(field).flatMap((entry) => {
                if (typeof entry.plantSortId !== 'number') {
                    return [];
                }

                const status = getSowingOperationStatus(entry);
                if (!status) {
                    return [];
                }

                const createdAt = getSowingEntryCreatedAt(entry, field);
                const completedAt = getSowingEntryCompletedAt(entry);
                const scheduledDate = toIsoString(entry.plantScheduledDate);
                const canceledAt =
                    status === 'canceled'
                        ? (toIsoString(entry.stoppedDate) ??
                          toIsoString(entry.updatedAt))
                        : null;
                const sourceId =
                    typeof entry.plantPlaceEventId === 'number'
                        ? entry.plantPlaceEventId
                        : field.id;

                return [
                    {
                        id: -sourceId,
                        entityId: entry.plantSortId,
                        entityTypeName: cartPlantSortEntityType,
                        raisedBedId: raisedBed.id,
                        raisedBedFieldId: field.id,
                        status,
                        createdAt,
                        scheduledDate,
                        scheduledAt: scheduledDate,
                        completedAt:
                            status === 'completed' || status === 'confirmed'
                                ? completedAt
                                : null,
                        verifiedAt: status === 'completed' ? completedAt : null,
                        canceledAt,
                        imageUrls: [],
                        completionNotes: null,
                        targetLabel: formatRaisedBedTargetLabel(
                            raisedBed.name,
                            `Polje ${field.positionIndex + 1}`,
                        ),
                        statusHistory: buildSowingStatusHistory(
                            entry,
                            field,
                            status,
                        ),
                    },
                ];
            }),
        ),
    );
}

function getRaisedBedFieldLabel(
    raisedBed: RaisedBedData,
    raisedBedFieldId: number | null,
) {
    if (raisedBedFieldId == null) {
        return null;
    }

    const field = raisedBed.fields.find(
        (raisedBedField) => raisedBedField.id === raisedBedFieldId,
    );

    return field ? `Polje ${field.positionIndex + 1}` : null;
}

function getOperationTargetDetails(
    operation: GardenOperationHudItem,
    garden: CurrentGardenData | null | undefined,
): OperationTargetDetails {
    const raisedBed = operation.raisedBedId
        ? garden?.raisedBeds.find((bed) => bed.id === operation.raisedBedId)
        : null;

    if (!raisedBed) {
        return {
            type: 'text',
            label: operation.targetLabel,
        };
    }

    const fieldLabel = getRaisedBedFieldLabel(
        raisedBed,
        operation.raisedBedFieldId,
    );

    return {
        type: 'raisedBed',
        fieldLabel,
        raisedBedName: raisedBed.name,
        raisedBedPhysicalId: raisedBed.physicalId,
        fallbackLabel: formatRaisedBedTargetLabel(raisedBed.name, fieldLabel),
    };
}

function getOperationFieldPositionIndex(
    operation: GardenOperationHudItem,
    garden: CurrentGardenData | null | undefined,
) {
    if (operation.raisedBedFieldId == null) {
        return undefined;
    }

    for (const raisedBed of garden?.raisedBeds ?? []) {
        const field = raisedBed.fields.find(
            (candidate) => candidate.id === operation.raisedBedFieldId,
        );
        if (field) {
            return field.positionIndex;
        }
    }

    return undefined;
}

function getOperationField(
    operation: GardenOperationHudItem,
    garden: CurrentGardenData | null | undefined,
) {
    if (operation.raisedBedFieldId == null) {
        return null;
    }

    for (const raisedBed of garden?.raisedBeds ?? []) {
        const field = raisedBed.fields.find(
            (candidate) => candidate.id === operation.raisedBedFieldId,
        );
        if (field) {
            return field;
        }
    }

    return null;
}

function getOperationFieldPlantSortId(
    operation: GardenOperationHudItem,
    garden: CurrentGardenData | null | undefined,
) {
    return getOperationField(operation, garden)?.plantSortId ?? null;
}

export function getGardenOperationRescheduleTarget(
    operation: GardenOperationHudItem,
    garden: CurrentGardenData | null | undefined,
): DiaryRescheduleTarget | null {
    if (isFinishedOperation(operation)) {
        return null;
    }

    const positionIndex = getOperationFieldPositionIndex(operation, garden);

    if (operation.entityTypeName === cartOperationEntityType) {
        return {
            type: 'operation',
            operationId: operation.id,
            raisedBedId: operation.raisedBedId,
            raisedBedFieldId: operation.raisedBedFieldId,
            positionIndex,
            scheduledDate: operation.scheduledDate,
        };
    }

    if (
        operation.entityTypeName === cartPlantSortEntityType &&
        operation.raisedBedId &&
        typeof positionIndex === 'number'
    ) {
        return {
            type: 'raisedBedFieldPlant',
            raisedBedId: operation.raisedBedId,
            positionIndex,
            scheduledDate: operation.scheduledDate,
        };
    }

    return null;
}

export function getGardenOperationCancelTarget(
    operation: GardenOperationHudItem,
    garden: CurrentGardenData | null | undefined,
): DiaryRescheduleTarget | null {
    if (isFinishedOperation(operation) || !operation.scheduledDate) {
        return null;
    }

    const positionIndex = getOperationFieldPositionIndex(operation, garden);

    if (operation.entityTypeName === cartOperationEntityType) {
        return {
            type: 'operation',
            operationId: operation.id,
            raisedBedId: operation.raisedBedId,
            raisedBedFieldId: operation.raisedBedFieldId,
            positionIndex,
            scheduledDate: operation.scheduledDate,
        };
    }

    if (
        operation.entityTypeName === cartPlantSortEntityType &&
        operation.raisedBedId &&
        typeof positionIndex === 'number'
    ) {
        return {
            type: 'raisedBedFieldPlant',
            raisedBedId: operation.raisedBedId,
            positionIndex,
            scheduledDate: operation.scheduledDate,
        };
    }

    return null;
}

function getOperationDisplayStatus(
    operation: GardenOperationHudItem,
    referenceDate: Date,
): OperationDisplayStatus {
    return isScheduledUnassignedOperation(operation, referenceDate)
        ? 'scheduled'
        : operation.status;
}

function getLatestStatusHistoryDate(operation: GardenOperationHudItem) {
    return operation.statusHistory.reduce<string | null>((latest, entry) => {
        const entryTime = new Date(entry.changedAt).getTime();
        if (!Number.isFinite(entryTime)) {
            return latest;
        }

        if (!latest || entryTime > new Date(latest).getTime()) {
            return entry.changedAt;
        }

        return latest;
    }, null);
}

function getOperationDisplayStatusDate(
    operation: GardenOperationHudItem,
    displayStatus: OperationDisplayStatus,
) {
    if (displayStatus === 'scheduled') {
        return operation.scheduledDate;
    }

    const matchingHistoryDate = [...operation.statusHistory]
        .reverse()
        .find((entry) => entry.status === operation.status)?.changedAt;

    return (
        matchingHistoryDate ??
        operation.verifiedAt ??
        operation.completedAt ??
        operation.canceledAt ??
        operation.scheduledAt ??
        getLatestStatusHistoryDate(operation)
    );
}

export function canRescheduleGardenOperation(
    operation: GardenOperationHudItem,
    garden: CurrentGardenData | null | undefined,
    referenceDate: Date,
) {
    const target = getGardenOperationRescheduleTarget(operation, garden);
    return Boolean(
        target && isDiaryRescheduleTargetEligible(target, referenceDate),
    );
}

export function canCancelGardenOperation(
    operation: GardenOperationHudItem,
    garden: CurrentGardenData | null | undefined,
    referenceDate: Date,
) {
    const target = getGardenOperationCancelTarget(operation, garden);
    return Boolean(
        target && isDiaryCancelTargetEligible(target, referenceDate),
    );
}

export function GardenOperationRescheduleAction({
    entryName,
    garden,
    operation,
    referenceDate,
    triggerLabel,
}: {
    entryName: string;
    garden: CurrentGardenData | null | undefined;
    operation: GardenOperationHudItem;
    referenceDate: Date;
    triggerLabel?: ReactNode;
}) {
    if (!garden) {
        return null;
    }

    const target = getGardenOperationRescheduleTarget(operation, garden);
    if (!target || !isDiaryRescheduleTargetEligible(target, referenceDate)) {
        return null;
    }

    return (
        <RaisedBedDiaryRescheduleAction
            entryName={entryName}
            gardenId={garden.id}
            target={target}
            triggerLabel={triggerLabel}
        />
    );
}

export function GardenOperationCancelAction({
    entryName,
    garden,
    operation,
    referenceDate,
}: {
    entryName: string;
    garden: CurrentGardenData | null | undefined;
    operation: GardenOperationHudItem;
    referenceDate: Date;
}) {
    if (!garden) {
        return null;
    }

    const target = getGardenOperationCancelTarget(operation, garden);
    if (!target) {
        return null;
    }

    return (
        <RaisedBedDiaryCancelAction
            disabledReason={getDiaryCancelDisabledReason(target, referenceDate)}
            entryName={entryName}
            gardenId={garden.id}
            target={target}
        />
    );
}

function isFinishedOperation(operation: GardenOperationHudItem) {
    return Boolean(
        nonEditableStatuses.has(operation.status) ||
            terminalFailureStatuses.has(operation.status) ||
            operation.completedAt ||
            operation.verifiedAt ||
            operation.canceledAt,
    );
}

function OperationScheduleText({ label }: { label: string }) {
    return (
        <Row spacing={1} className="min-w-0 text-muted-foreground">
            <Calendar className="size-3.5 shrink-0" />
            <Typography level="body3" noWrap className="min-w-0">
                {label}
            </Typography>
        </Row>
    );
}

export function GardenOperationScheduleAction({
    entryName,
    garden,
    operation,
    referenceDate,
}: {
    entryName: string;
    garden: CurrentGardenData | null | undefined;
    operation: GardenOperationHudItem;
    referenceDate: Date;
}) {
    const scheduledDateLabel = formatDate(operation.scheduledDate);

    if (isFinishedOperation(operation)) {
        return scheduledDateLabel ? (
            <OperationScheduleText label={scheduledDateLabel} />
        ) : null;
    }

    if (!garden) {
        return scheduledDateLabel ? (
            <OperationScheduleText label={scheduledDateLabel} />
        ) : null;
    }

    const target = getGardenOperationRescheduleTarget(operation, garden);
    if (!target) {
        return scheduledDateLabel ? (
            <OperationScheduleText label={scheduledDateLabel} />
        ) : null;
    }

    return (
        <RaisedBedDiaryRescheduleAction
            disabledReason={getDiaryRescheduleDisabledReason(
                target,
                referenceDate,
            )}
            entryName={entryName}
            gardenId={garden.id}
            target={target}
            triggerLabel={scheduledDateLabel ?? 'Zakaži'}
        />
    );
}

function getCartOperationTargetDetails(
    item: ShoppingCartItemData,
    garden: CurrentGardenData,
): OperationTargetDetails {
    const raisedBed = item.raisedBedId
        ? garden.raisedBeds.find((bed) => bed.id === item.raisedBedId)
        : null;

    if (!raisedBed) {
        return {
            type: 'text',
            label: garden.name || 'Vrt',
        };
    }

    const fieldLabel =
        typeof item.positionIndex === 'number'
            ? `Polje ${item.positionIndex + 1}`
            : null;

    return {
        type: 'raisedBed',
        fieldLabel,
        raisedBedName: raisedBed.name,
        raisedBedPhysicalId: raisedBed.physicalId,
        fallbackLabel: formatRaisedBedTargetLabel(raisedBed.name, fieldLabel),
    };
}

function isCartOperationsPopupItem(item: ShoppingCartItemData) {
    return (
        item.entityTypeName === cartOperationEntityType ||
        item.entityTypeName === cartPlantSortEntityType
    );
}

function StatusBadge({
    status,
    size = 'sm',
    className,
}: {
    status: OperationDisplayStatus;
    size?: 'sm' | 'md';
    className?: string;
}) {
    const config = getDisplayStatusConfig(status);
    const Icon = config.icon;
    const iconSize = size === 'md' ? 'size-4' : 'size-3.5';
    const textLevel = size === 'md' ? 'body2' : 'body3';
    return (
        <span
            className={cx(
                'flex min-w-0 max-w-full flex-row items-center gap-1',
                config.colorClass,
                className,
            )}
        >
            <Icon className={cx(iconSize, 'shrink-0')} />
            <Typography
                level={textLevel}
                semiBold
                noWrap
                component="span"
                className="min-w-0"
            >
                {config.label}
            </Typography>
        </span>
    );
}

function buildStatusProgressSteps(
    operation: GardenOperationHudItem,
    displayStatus: OperationDisplayStatus,
): OperationStatusProgressStep[] {
    if (displayStatus === 'scheduled') {
        return [
            {
                status: 'scheduled',
                date: operation.scheduledDate ?? null,
                reached: true,
                current: true,
                pending: false,
            },
        ];
    }

    const historyByStatus = new Map(
        operation.statusHistory.map((entry) => [entry.status, entry.changedAt]),
    );
    const isTerminalFailure = terminalFailureStatuses.has(operation.status);
    const displayStatusDate =
        getOperationDisplayStatusDate(operation, displayStatus) ?? null;

    const hasReached = (status: GardenOperationStatus) => {
        if (historyByStatus.has(status)) return true;
        const idx = uiPipeline.indexOf(status);
        if (idx === -1) return false;
        return uiPipeline
            .slice(idx + 1)
            .some((later) => historyByStatus.has(later));
    };

    const currentIdx = uiPipeline.indexOf(operation.status);
    const pipelineToShow = uiPipeline.filter((status, idx) => {
        if (hasReached(status)) return true;
        if (isTerminalFailure) return true;
        if (currentIdx >= 0 && idx >= currentIdx) return true;
        return false;
    });
    const firstPendingIdx = pipelineToShow.findIndex((s) => !hasReached(s));

    const steps: OperationStatusProgressStep[] = pipelineToShow.map(
        (status, idx) => {
            const reached = hasReached(status);
            const current = !isTerminalFailure && status === operation.status;

            return {
                status,
                date:
                    historyByStatus.get(status) ??
                    (current ? displayStatusDate : null),
                reached,
                current,
                pending:
                    !isTerminalFailure && !reached && idx === firstPendingIdx,
                skipped: isTerminalFailure && !reached,
            };
        },
    );

    if (isTerminalFailure) {
        steps.push({
            status: operation.status,
            date:
                historyByStatus.get(operation.status) ??
                operation.canceledAt ??
                operation.completedAt ??
                displayStatusDate,
            reached: true,
            current: true,
            pending: false,
            failed: true,
        });
    }

    return steps;
}

function OperationStatusProgressIndicator({
    steps,
    label,
}: {
    steps: OperationStatusProgressStep[];
    label?: string;
}) {
    const dots = steps.map((step) => (
        <span
            key={step.status}
            className={cx(
                'size-1.5 rounded-full border border-tertiary bg-background',
                step.reached && !step.failed && 'border-green-600 bg-green-500',
                step.pending &&
                    'animate-pulse border-green-500 bg-green-500/20',
                step.skipped && 'border-muted-foreground/30 bg-muted',
                step.failed && 'border-red-500 bg-red-500/20',
                step.current && 'size-2.5 border-2',
            )}
        />
    ));

    if (label) {
        return (
            <span
                aria-label={label}
                className="flex shrink-0 items-center gap-0.5"
                data-operation-status-progress
                role="img"
            >
                {dots}
            </span>
        );
    }

    return (
        <span
            aria-hidden
            className="flex shrink-0 items-center gap-0.5"
            data-operation-status-progress
        >
            {dots}
        </span>
    );
}

function OperationStatusTooltipContent({
    steps,
}: {
    steps: OperationStatusProgressStep[];
}) {
    return (
        <Stack spacing={1} className="min-w-52">
            <Typography
                level="body3"
                semiBold
                component="span"
                className="text-popover-foreground"
            >
                Statusi radnje
            </Typography>
            <Stack spacing={0.75}>
                {steps.map((step) => {
                    const config = getDisplayStatusConfig(step.status);
                    const Icon = config.icon;
                    const dateLabel = formatDate(step.date);
                    const fallbackLabel = step.current
                        ? 'Trenutno'
                        : step.skipped
                          ? 'Preskočeno'
                          : 'Čeka';

                    return (
                        <Row
                            key={step.status}
                            spacing={2}
                            justifyContent="space-between"
                            className="min-w-0"
                        >
                            <span
                                className={cx(
                                    'flex min-w-0 items-center gap-1',
                                    config.colorClass,
                                )}
                            >
                                <Icon className="size-3.5 shrink-0" />
                                <Typography
                                    level="body3"
                                    component="span"
                                    noWrap
                                    className="min-w-0 text-popover-foreground"
                                >
                                    {config.label}
                                </Typography>
                            </span>
                            <Typography
                                level="body3"
                                component="span"
                                noWrap
                                className="shrink-0 text-popover-foreground/75"
                            >
                                {dateLabel ?? fallbackLabel}
                            </Typography>
                        </Row>
                    );
                })}
            </Stack>
        </Stack>
    );
}

function OperationStatusSummary({
    operation,
    status,
}: {
    operation: GardenOperationHudItem;
    status: OperationDisplayStatus;
}) {
    const config = getDisplayStatusConfig(status);
    const steps = useMemo(
        () => buildStatusProgressSteps(operation, status),
        [operation, status],
    );
    const progressLabel = status === 'scheduled' ? undefined : 'Tijek radnje';
    const tooltipIntentRef = useRef(false);
    const [tooltipOpen, setTooltipOpen] = useState(false);
    const handleTooltipOpenChange = useCallback((nextOpen: boolean) => {
        if (!nextOpen) {
            setTooltipOpen(false);
            return;
        }

        if (tooltipIntentRef.current) {
            setTooltipOpen(true);
        }
    }, []);
    const clearTooltipIntent = useCallback(() => {
        tooltipIntentRef.current = false;
        setTooltipOpen(false);
    }, []);

    return (
        <Tooltip
            delayDuration={100}
            onOpenChange={handleTooltipOpenChange}
            open={tooltipOpen}
        >
            <TooltipTrigger asChild>
                <button
                    type="button"
                    aria-label={`Status radnje: ${config.label}`}
                    className="flex max-w-[48%] shrink-0 flex-col items-end rounded-md px-1 py-0.5 text-right transition hover:bg-muted/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    onBlur={clearTooltipIntent}
                    onClick={() => {
                        tooltipIntentRef.current = true;
                        setTooltipOpen(true);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            clearTooltipIntent();
                            return;
                        }

                        if (event.key !== 'Enter' && event.key !== ' ') {
                            return;
                        }

                        event.preventDefault();
                        tooltipIntentRef.current = true;
                        setTooltipOpen((currentOpen) => !currentOpen);
                    }}
                    onPointerDown={() => {
                        tooltipIntentRef.current = true;
                    }}
                    onPointerEnter={() => {
                        tooltipIntentRef.current = true;
                    }}
                    onPointerLeave={clearTooltipIntent}
                >
                    <span className="flex min-w-0 max-w-full items-center justify-end gap-1.5">
                        <StatusBadge status={status} className="justify-end" />
                        <OperationStatusProgressIndicator
                            label={progressLabel}
                            steps={steps}
                        />
                    </span>
                </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end" className="max-w-72 p-2">
                <OperationStatusTooltipContent steps={steps} />
            </TooltipContent>
        </Tooltip>
    );
}

function useInfiniteScroll(fetchNextPage: () => void, hasNextPage?: boolean) {
    const observerRef = useRef<IntersectionObserver | null>(null);

    return useCallback(
        (node: HTMLDivElement | null) => {
            if (observerRef.current) {
                observerRef.current.disconnect();
                observerRef.current = null;
            }

            if (!node || !hasNextPage) return;

            const scrollRoot = node.closest<HTMLElement>(
                '[data-infinite-scroll-root]',
            );

            observerRef.current = new IntersectionObserver(
                (entries) => {
                    if (entries[0]?.isIntersecting && hasNextPage) {
                        fetchNextPage();
                    }
                },
                {
                    root: scrollRoot ?? null,
                    rootMargin: '0px 0px 200px 0px',
                },
            );

            observerRef.current.observe(node);
        },
        [fetchNextPage, hasNextPage],
    );
}

function OperationSchedule({
    operation,
    cancelAction,
    scheduleAction,
}: {
    operation: GardenOperationItem;
    cancelAction?: ReactNode;
    scheduleAction?: ReactNode;
}) {
    const scheduledDate = formatDate(operation.scheduledDate);
    const scheduleContent = scheduleAction ? (
        <div className="w-fit max-w-full">{scheduleAction}</div>
    ) : scheduledDate ? (
        <Row spacing={1} className="w-fit max-w-full text-muted-foreground">
            <Calendar aria-hidden className="size-3.5 shrink-0" />
            <Typography level="body3" secondary noWrap>
                {scheduledDate}
            </Typography>
        </Row>
    ) : null;

    if (!scheduleContent && !cancelAction) {
        return null;
    }

    return (
        <Row spacing={1} className="w-fit max-w-full items-center">
            {scheduleContent}
            {cancelAction}
        </Row>
    );
}

function OperationEvidence({ operation }: { operation: GardenOperationItem }) {
    const imageUrls = operation.imageUrls;
    const completionNotes = operation.completionNotes?.trim();

    if (!imageUrls.length && !completionNotes) {
        return null;
    }

    return (
        <Stack spacing={1} className="min-w-0 max-w-full">
            {imageUrls.length > 0 && (
                <div
                    className="min-w-0 max-w-full overflow-hidden"
                    data-operation-images
                >
                    <ImageGallery
                        images={imageUrls.map((url) => ({
                            src: url,
                            alt: operation.targetLabel,
                        }))}
                        previewWidth={72}
                        previewHeight={72}
                        previewAs="div"
                        previewVariant="carousel"
                    />
                </div>
            )}
            {completionNotes && (
                <Typography
                    level="body2"
                    className="break-words"
                    data-operation-notes
                >
                    {completionNotes}
                </Typography>
            )}
        </Stack>
    );
}

function OperationTargetLabel({
    targetDetails,
    className,
    iconClassName,
}: {
    targetDetails: OperationTargetDetails;
    className?: string;
    iconClassName?: string;
}) {
    if (targetDetails.type === 'text') {
        return (
            <Typography level="body3" secondary className={className}>
                {targetDetails.label}
            </Typography>
        );
    }

    return (
        <Row
            spacing={1}
            className="min-w-0 max-w-full items-center flex-wrap gap-y-0.5"
            aria-label={targetDetails.fallbackLabel}
        >
            <Row spacing={1} className="min-w-0 items-center">
                <RaisedBedIcon
                    physicalId={targetDetails.raisedBedPhysicalId}
                    containerClassName="h-6 w-6 min-w-6 overflow-visible"
                    className={cx(
                        'size-5 text-tertiary-foreground',
                        iconClassName,
                    )}
                />
                <Typography
                    level="body3"
                    secondary
                    noWrap
                    component="span"
                    className={cx('min-w-0', className)}
                >
                    {targetDetails.raisedBedName}
                </Typography>
            </Row>
            {targetDetails.fieldLabel && (
                <>
                    <Navigate
                        aria-hidden
                        className="size-3 shrink-0 text-tertiary-foreground"
                    />
                    <Typography
                        level="body3"
                        secondary
                        noWrap
                        component="span"
                        className={cx('shrink-0', className)}
                    >
                        {targetDetails.fieldLabel}
                    </Typography>
                </>
            )}
        </Row>
    );
}

function getActiveOperationName({
    operation,
    operationName,
    plantSortName,
}: {
    operation: GardenOperationHudItem;
    operationName?: string;
    plantSortName?: string;
}) {
    if (operation.entityTypeName === cartPlantSortEntityType) {
        return plantSortName
            ? `${plantingOperationLabel}: ${plantSortName}`
            : plantingOperationLabel;
    }

    if (operationName) {
        return operationName;
    }

    if (operation.raisedBedFieldId != null) {
        return plantingOperationLabel;
    }

    return `Radnja #${operation.id}`;
}

function OperationMedia({
    operationData,
    plantSortData,
    targetPlantSortData,
}: {
    operationData?: OperationData;
    plantSortData?: PlantSortData;
    targetPlantSortData?: PlantSortData;
}) {
    const primaryPlantSort = plantSortData ?? targetPlantSortData;
    const shouldShowOperationBadge = Boolean(
        operationData && targetPlantSortData,
    );

    if (primaryPlantSort) {
        return (
            <div
                className="relative size-12 shrink-0"
                data-operation-media="plant"
            >
                <div className="flex size-12 items-center justify-center overflow-hidden rounded-lg bg-card">
                    <PlantOrSortImage
                        plantSort={primaryPlantSort}
                        alt={primaryPlantSort.information.name}
                        width={44}
                        height={44}
                    />
                </div>
                {shouldShowOperationBadge && operationData && (
                    <span
                        className="-right-1 -top-1 absolute flex size-6 items-center justify-center rounded-full border bg-background text-foreground shadow-xs"
                        data-operation-media-badge
                    >
                        <OperationImage operation={operationData} size={18} />
                    </span>
                )}
            </div>
        );
    }

    if (operationData) {
        return (
            <div
                className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-card"
                data-operation-media="operation"
            >
                <OperationImage operation={operationData} size={40} />
            </div>
        );
    }

    return (
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-card">
            <Typography level="body3" secondary>
                🌱
            </Typography>
        </div>
    );
}

export function GardenOperationCard({
    operation,
    operationName,
    operationData,
    plantSortData,
    targetPlantSortData,
    currentGarden,
    referenceDate,
    cancelAction,
    scheduleAction,
    action,
}: {
    operation: GardenOperationHudItem;
    operationName?: string;
    operationData?: OperationData;
    plantSortData?: PlantSortData;
    targetPlantSortData?: PlantSortData;
    currentGarden?: CurrentGardenData | null;
    referenceDate: Date;
    cancelAction?: ReactNode;
    scheduleAction?: ReactNode;
    action?: ReactNode;
}) {
    const resolvedOperationName = getActiveOperationName({
        operation,
        operationName,
        plantSortName: plantSortData?.information.name,
    });
    const targetDetails = getOperationTargetDetails(operation, currentGarden);
    const displayStatus = getOperationDisplayStatus(operation, referenceDate);

    return (
        <div
            className="w-full max-w-full shrink-0 overflow-hidden rounded-xl border bg-card p-3 shadow-xs"
            data-garden-operation-card
        >
            <Row
                spacing={3}
                alignItems="start"
                className="w-full min-w-0 max-w-full"
            >
                <OperationMedia
                    operationData={operationData}
                    plantSortData={plantSortData}
                    targetPlantSortData={targetPlantSortData}
                />
                <Stack
                    spacing={1.5}
                    className="min-w-0 max-w-full flex-1 overflow-hidden"
                >
                    <Stack spacing={0.75}>
                        <Row
                            spacing={1}
                            alignItems="start"
                            className="min-w-0 max-w-full gap-y-1"
                        >
                            <Stack spacing={0.5} className="min-w-0 flex-1">
                                <Typography
                                    level="body2"
                                    semiBold
                                    noWrap
                                    className="min-w-0"
                                >
                                    {resolvedOperationName}
                                </Typography>
                                <OperationTargetLabel
                                    targetDetails={targetDetails}
                                />
                            </Stack>
                            <OperationStatusSummary
                                operation={operation}
                                status={displayStatus}
                            />
                        </Row>
                    </Stack>
                    <OperationSchedule
                        operation={operation}
                        cancelAction={cancelAction}
                        scheduleAction={scheduleAction}
                    />
                    <OperationEvidence operation={operation} />
                    {action && <div className="flex justify-end">{action}</div>}
                </Stack>
            </Row>
        </div>
    );
}

function CartOperationCard({
    item,
    operationData,
    targetDetails,
    onOpenCart,
}: {
    item: ShoppingCartItemData;
    operationData?: OperationData;
    targetDetails: OperationTargetDetails;
    onOpenCart: () => void;
}) {
    const scheduledDate = getCartItemScheduledDate(item);
    const scheduledDateLabel = parseScheduledDate(item.additionalData)
        ? formatDate(scheduledDate.toISOString())
        : 'sutra';
    const plantSort =
        item.entityTypeName === cartPlantSortEntityType
            ? item.entityData
            : null;
    const operationName =
        item.entityTypeName === cartPlantSortEntityType
            ? `${plantingOperationLabel}: ${item.shopData.name ?? `${plantSortFallbackLabel} #${item.entityId}`}`
            : (operationData?.information.label ??
              item.shopData.name ??
              `Radnja #${item.entityId}`);

    return (
        <div className="shrink-0 rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-400/60 dark:bg-amber-900/30">
            <Row spacing={3} alignItems="start">
                <div className="size-12 rounded-lg bg-card flex items-center justify-center overflow-hidden shrink-0">
                    {plantSort ? (
                        <PlantOrSortImage
                            plantSort={plantSort}
                            alt={item.shopData.name ?? plantingOperationLabel}
                            width={40}
                            height={40}
                        />
                    ) : operationData ? (
                        <OperationImage operation={operationData} size={40} />
                    ) : (
                        <ShoppingCart className="size-5 text-amber-600 dark:text-amber-300" />
                    )}
                </div>
                <Stack spacing={1.5} className="min-w-0 flex-1">
                    <Stack spacing={0.5}>
                        <Typography
                            level="body2"
                            semiBold
                            noWrap
                            className="dark:text-amber-50"
                        >
                            {operationName}
                        </Typography>
                        <OperationTargetLabel
                            targetDetails={targetDetails}
                            className="dark:text-amber-100/85"
                            iconClassName="dark:text-amber-100/85"
                        />
                    </Stack>
                    <Row spacing={2} className="flex-wrap">
                        <Typography
                            level="body3"
                            secondary
                            className="dark:text-amber-100/80"
                        >
                            U košari, još nije kupljeno
                        </Typography>
                        <Typography
                            level="body3"
                            secondary
                            className="dark:text-amber-100/80"
                        >
                            Zakazano: {scheduledDateLabel}
                        </Typography>
                    </Row>
                    <Row justifyContent="space-between" spacing={2}>
                        <Row
                            spacing={1}
                            className="text-amber-600 dark:text-amber-300"
                        >
                            <ShoppingCart className="size-3.5 shrink-0" />
                            <Typography
                                level="body3"
                                semiBold
                                className="dark:text-amber-200"
                            >
                                U košari
                            </Typography>
                        </Row>
                        <Button
                            variant="link"
                            size="sm"
                            className="px-0 dark:text-amber-50 dark:hover:text-white"
                            onClick={onOpenCart}
                        >
                            Otvori košaru
                        </Button>
                    </Row>
                </Stack>
            </Row>
        </div>
    );
}

function HistoryModal({
    trigger,
    operations,
    operationDataById,
    plantSortById,
    currentGarden,
    listRef,
    referenceDate,
}: {
    trigger: React.ReactElement;
    operations: GardenOperationHudItem[];
    operationDataById: Map<number, OperationData>;
    plantSortById: Map<number, PlantSortData>;
    currentGarden?: CurrentGardenData | null;
    listRef: (node: HTMLDivElement | null) => void;
    referenceDate: Date;
}) {
    return (
        <Modal
            title="Povijest radnji"
            trigger={trigger}
            className="md:max-w-4xl"
        >
            <Stack spacing={4}>
                <Stack spacing={1}>
                    <Typography level="h5">Povijest radnji</Typography>
                    <Typography level="body2" secondary>
                        Pregled svih radnji u tvom vrtu.
                    </Typography>
                </Stack>
                <Divider />
                <ScrollView
                    className="-mx-6"
                    viewportClassName="max-h-[70vh]"
                    contentClassName="px-6 pr-4"
                    viewportProps={{ 'data-infinite-scroll-root': 'true' }}
                >
                    <Stack spacing={2}>
                        {operations.length === 0 ? (
                            <Typography level="body3" secondary>
                                Nema radnji.
                            </Typography>
                        ) : (
                            operations.map((operation) => (
                                <GardenOperationCard
                                    key={`${operation.entityTypeName}-${operation.id}`}
                                    operation={operation}
                                    operationName={
                                        operation.entityTypeName ===
                                        cartOperationEntityType
                                            ? operationDataById.get(
                                                  operation.entityId,
                                              )?.information.label
                                            : undefined
                                    }
                                    operationData={
                                        operation.entityTypeName ===
                                        cartOperationEntityType
                                            ? operationDataById.get(
                                                  operation.entityId,
                                              )
                                            : undefined
                                    }
                                    plantSortData={
                                        operation.entityTypeName ===
                                        cartPlantSortEntityType
                                            ? plantSortById.get(
                                                  operation.entityId,
                                              )
                                            : undefined
                                    }
                                    targetPlantSortData={
                                        operation.entityTypeName ===
                                        cartOperationEntityType
                                            ? (plantSortById.get(
                                                  getOperationFieldPlantSortId(
                                                      operation,
                                                      currentGarden,
                                                  ) ?? 0,
                                              ) ?? undefined)
                                            : undefined
                                    }
                                    currentGarden={currentGarden}
                                    referenceDate={referenceDate}
                                />
                            ))
                        )}
                        <div ref={listRef} className="h-1" />
                    </Stack>
                </ScrollView>
            </Stack>
        </Modal>
    );
}

export function sortNewestFirst(operations: GardenOperationHudItem[]) {
    return sortOperationTasksNewestFirst(operations);
}

export function GardenOperationsHud() {
    const { track } = useGameAnalytics();
    const referenceDate = useLiveTime();
    const { data: currentGarden } = useCurrentGarden();
    const { data: operationsData } = useOperations();
    const { data: cart } = useShoppingCart();
    const [, setShoppingCartOpen] = useShoppingCartOpenParam();
    const pending = useGardenOperations({
        includeCompleted: false,
        pageSize: 10,
    });
    const history = useGardenOperations({
        includeCompleted: true,
        pageSize: 20,
    });
    const sowingOperations = useMemo(
        () => buildSowingOperationItems(currentGarden),
        [currentGarden],
    );
    const sowingPlantSortIds = useMemo(
        () =>
            Array.from(
                new Set(
                    sowingOperations.map((operation) => operation.entityId),
                ),
            ),
        [sowingOperations],
    );
    const fieldPlantSortIds = useMemo(
        () =>
            Array.from(
                new Set(
                    (currentGarden?.raisedBeds ?? []).flatMap((raisedBed) =>
                        raisedBed.fields.flatMap((field) =>
                            typeof field.plantSortId === 'number'
                                ? [field.plantSortId]
                                : [],
                        ),
                    ),
                ),
            ),
        [currentGarden],
    );
    const operationPlantSortIds = useMemo(
        () =>
            Array.from(new Set([...sowingPlantSortIds, ...fieldPlantSortIds])),
        [fieldPlantSortIds, sowingPlantSortIds],
    );
    const { data: operationPlantSorts } = useSorts(
        operationPlantSortIds.length > 0 ? operationPlantSortIds : undefined,
    );

    const pendingOperations = useMemo(
        () =>
            sortNewestFirst(
                [
                    ...(pending.data?.pages.flatMap((page) => page.items) ??
                        []),
                    ...sowingOperations,
                ].filter(
                    (operation) => !hiddenFromActive.has(operation.status),
                ),
            ),
        [pending.data?.pages, sowingOperations],
    );
    const historyOperations = useMemo(
        () =>
            sortNewestFirst([
                ...(history.data?.pages.flatMap((page) => page.items) ?? []),
                ...sowingOperations,
            ]),
        [history.data?.pages, sowingOperations],
    );

    const pendingRef = useInfiniteScroll(
        () => pending.fetchNextPage(),
        pending.hasNextPage,
    );
    const historyRef = useInfiniteScroll(
        () => history.fetchNextPage(),
        history.hasNextPage,
    );

    const operationDataById = useMemo(
        () =>
            new Map(
                (operationsData ?? []).map((operation) => [
                    operation.id,
                    operation,
                ]),
            ),
        [operationsData],
    );
    const plantSortById = useMemo(
        () =>
            new Map(
                (operationPlantSorts ?? []).map((plantSort) => [
                    plantSort.id,
                    plantSort,
                ]),
            ),
        [operationPlantSorts],
    );
    const cartOperations = useMemo(() => {
        if (!currentGarden) {
            return [];
        }

        return (cart?.items ?? [])
            .flatMap((item) => {
                if (
                    !isCartOperationsPopupItem(item) ||
                    item.status !== 'new' ||
                    (item.gardenId != null &&
                        item.gardenId !== currentGarden.id)
                ) {
                    return [];
                }

                const operationId = Number(item.entityId);
                const scheduledDate = getCartItemScheduledDate(item);
                return [
                    {
                        item,
                        scheduledDate,
                        operationData: Number.isFinite(operationId)
                            ? operationDataById.get(operationId)
                            : undefined,
                        targetDetails: getCartOperationTargetDetails(
                            item,
                            currentGarden,
                        ),
                    },
                ];
            })
            .sort((a, b) => {
                const dateDiff =
                    getTimestamp(b.scheduledDate) -
                    getTimestamp(a.scheduledDate);

                return dateDiff !== 0 ? dateDiff : b.item.id - a.item.id;
            });
    }, [cart?.items, currentGarden, operationDataById]);
    const activeOperationCount =
        pendingOperations.length + cartOperations.length;

    return (
        <Popper
            side="bottom"
            sideOffset={12}
            className="w-[28rem] max-w-[90vw] overflow-hidden border-tertiary border-b-4"
            trigger={
                <Button
                    variant="plain"
                    className="relative rounded-full p-0 aspect-square"
                    title="Status radnji"
                    onClick={() =>
                        track('game_operations_opened', {
                            source: 'quick_panel',
                        })
                    }
                >
                    {activeOperationCount > 0 && (
                        <div className="absolute right-1 top-1">
                            <DotIndicator color={'success'} />
                        </div>
                    )}
                    <ListTodo className="size-5" />
                </Button>
            }
        >
            <Stack>
                <Row
                    className="bg-background px-4 py-2"
                    justifyContent="space-between"
                >
                    <Typography level="body2" bold>
                        Aktivne radnje
                    </Typography>
                </Row>
                <Divider />
                <ScrollView
                    viewportClassName="max-h-[50vh]"
                    contentClassName="py-2 pl-3 pr-1"
                    viewportProps={{ 'data-infinite-scroll-root': 'true' }}
                >
                    <Stack spacing={1.5}>
                        {activeOperationCount === 0 ? (
                            <Typography level="body3" secondary>
                                Nema nedovršenih radnji.
                            </Typography>
                        ) : (
                            <>
                                {cartOperations.length > 0 && (
                                    <Stack spacing={1.5}>
                                        <Row
                                            justifyContent="space-between"
                                            alignItems="center"
                                        >
                                            <Typography level="body3" semiBold>
                                                Radnje u košari
                                            </Typography>
                                            <Button
                                                variant="link"
                                                size="sm"
                                                className="px-0"
                                                onClick={() =>
                                                    setShoppingCartOpen(true)
                                                }
                                            >
                                                Otvori košaru
                                            </Button>
                                        </Row>
                                        {cartOperations.map((cartOperation) => (
                                            <CartOperationCard
                                                key={cartOperation.item.id}
                                                item={cartOperation.item}
                                                operationData={
                                                    cartOperation.operationData
                                                }
                                                targetDetails={
                                                    cartOperation.targetDetails
                                                }
                                                onOpenCart={() =>
                                                    setShoppingCartOpen(true)
                                                }
                                            />
                                        ))}
                                    </Stack>
                                )}
                                {cartOperations.length > 0 &&
                                    pendingOperations.length > 0 && <Divider />}
                                {pendingOperations.map((operation) => {
                                    const operationData =
                                        operation.entityTypeName ===
                                        cartOperationEntityType
                                            ? operationDataById.get(
                                                  operation.entityId,
                                              )
                                            : undefined;
                                    const plantSortData =
                                        operation.entityTypeName ===
                                        cartPlantSortEntityType
                                            ? plantSortById.get(
                                                  operation.entityId,
                                              )
                                            : undefined;
                                    const operationName =
                                        operationData?.information.label;
                                    const entryName = getActiveOperationName({
                                        operation,
                                        operationName,
                                        plantSortName:
                                            plantSortData?.information.name,
                                    });
                                    const scheduleAction = (
                                        <GardenOperationScheduleAction
                                            entryName={entryName}
                                            garden={currentGarden}
                                            operation={operation}
                                            referenceDate={referenceDate}
                                        />
                                    );
                                    const cancelTarget =
                                        getGardenOperationCancelTarget(
                                            operation,
                                            currentGarden,
                                        );
                                    const cancelAction = cancelTarget ? (
                                        <GardenOperationCancelAction
                                            entryName={entryName}
                                            garden={currentGarden}
                                            operation={operation}
                                            referenceDate={referenceDate}
                                        />
                                    ) : undefined;

                                    return (
                                        <GardenOperationCard
                                            key={`${operation.entityTypeName}-${operation.id}`}
                                            operation={operation}
                                            operationName={operationName}
                                            operationData={operationData}
                                            plantSortData={plantSortData}
                                            targetPlantSortData={
                                                operation.entityTypeName ===
                                                cartOperationEntityType
                                                    ? (plantSortById.get(
                                                          getOperationFieldPlantSortId(
                                                              operation,
                                                              currentGarden,
                                                          ) ?? 0,
                                                      ) ?? undefined)
                                                    : undefined
                                            }
                                            currentGarden={currentGarden}
                                            referenceDate={referenceDate}
                                            scheduleAction={scheduleAction}
                                            cancelAction={cancelAction}
                                        />
                                    );
                                })}
                            </>
                        )}
                        <div ref={pendingRef} className="h-1" />
                    </Stack>
                </ScrollView>
                <Divider />
                <HistoryModal
                    operations={historyOperations}
                    operationDataById={operationDataById}
                    plantSortById={plantSortById}
                    currentGarden={currentGarden}
                    listRef={historyRef}
                    referenceDate={referenceDate}
                    trigger={
                        <Button
                            variant="plain"
                            size="sm"
                            fullWidth
                            className="rounded-t-none"
                            startDecorator={<History className="size-4" />}
                        >
                            Prikaži sve radnje
                        </Button>
                    }
                />
            </Stack>
        </Popper>
    );
}
