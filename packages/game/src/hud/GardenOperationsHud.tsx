import { Button } from '@gredice/ui/Button';
import { Divider } from '@gredice/ui/Divider';
import { DotIndicator } from '@gredice/ui/DotIndicator';
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
    ShoppingCart,
} from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { OperationImage } from '@gredice/ui/OperationImage';
import { Popper } from '@gredice/ui/Popper';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { type ComponentType, useCallback, useMemo, useRef } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { SegmentedProgress } from '../controls/components/SegmentedProgress';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import {
    type GardenOperationItem,
    type GardenOperationStatus,
    useGardenOperations,
} from '../hooks/useGardenOperations';
import { useOperations } from '../hooks/useOperations';
import { useSorts } from '../hooks/usePlantSorts';
import {
    type ShoppingCartItemData,
    useShoppingCart,
} from '../hooks/useShoppingCart';
import { useShoppingCartOpenParam } from '../useUrlState';

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
const cartOperationEntityType = 'operation' as const;
const cartPlantSortEntityType = 'plantSort' as const;
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
    nextStep: string;
};

const statusConfig: Record<GardenOperationStatus, StatusConfig> = {
    new: {
        label: 'Kreirano',
        icon: Inbox,
        colorClass: 'text-sky-600',
        nextStep: 'Sljedeći korak: zakazivanje',
    },
    planned: {
        label: 'Planirano',
        icon: Calendar,
        colorClass: 'text-indigo-600',
        nextStep: 'Sljedeći korak: dodjela',
    },
    assigned: {
        label: 'Dodijeljeno',
        icon: MailCheck,
        colorClass: 'text-violet-600',
        nextStep: 'Sljedeći korak: potvrda',
    },
    confirmed: {
        label: 'Potvrđeno',
        icon: Hourglass,
        colorClass: 'text-amber-600',
        nextStep: 'Sljedeći korak: verifikacija',
    },
    completed: {
        label: 'Završeno',
        icon: Approved,
        colorClass: 'text-green-600',
        nextStep: 'Radnja završena',
    },
    failed: {
        label: 'Neuspjelo',
        icon: ErrorIcon,
        colorClass: 'text-red-600',
        nextStep: 'Sljedeći korak: ponovni pokušaj',
    },
    canceled: {
        label: 'Otkazano',
        icon: Close,
        colorClass: 'text-neutral-500',
        nextStep: 'Radnja je otkazana',
    },
};

function formatDate(value?: string | null) {
    if (!value) return null;
    return new Date(value).toLocaleDateString('hr-HR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function formatDateTime(value?: string | null) {
    if (!value) return null;
    return new Date(value).toLocaleString('hr-HR');
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

    const hasAssignedUser = hasAssignedSowingUser(entry);
    if (status === 'planned' && hasAssignedUser) {
        return 'confirmed';
    }

    if (hasAssignedUser) {
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

function buildSowingOperationItems(
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
                        targetLabel: `Polje ${field.positionIndex + 1} • ${
                            raisedBed.name
                        }`,
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

function getCartOperationTargetLabel(
    item: ShoppingCartItemData,
    garden: CurrentGardenData,
) {
    const raisedBed = item.raisedBedId
        ? garden.raisedBeds.find((bed) => bed.id === item.raisedBedId)
        : null;

    if (raisedBed && typeof item.positionIndex === 'number') {
        return `Polje ${item.positionIndex + 1} • ${raisedBed.name}`;
    }

    if (raisedBed) {
        return `Gredica: ${raisedBed.name}`;
    }

    return garden.name || 'Vrt';
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
}: {
    status: GardenOperationStatus;
    size?: 'sm' | 'md';
}) {
    const config = statusConfig[status];
    const Icon = config.icon;
    const iconSize = size === 'md' ? 'size-4' : 'size-3.5';
    const textLevel = size === 'md' ? 'body2' : 'body3';
    return (
        <Row spacing={1} className={config.colorClass}>
            <Icon className={cx(iconSize, 'shrink-0')} />
            <Typography level={textLevel} semiBold>
                {config.label}
            </Typography>
        </Row>
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

function buildSegments(operation: GardenOperationItem) {
    const historyByStatus = new Map(
        operation.statusHistory.map((entry) => [entry.status, entry.changedAt]),
    );
    const isTerminalFailure = terminalFailureStatuses.has(operation.status);

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

    const segments = pipelineToShow.map((status, idx) => {
        const reached = hasReached(status);
        const config = statusConfig[status];
        const date = historyByStatus.get(status);
        const tooltipParts = [config.label];
        const dateStr = formatDateTime(date ?? null);
        if (dateStr) tooltipParts.push(dateStr);
        const title = tooltipParts.join(' — ');

        if (reached) {
            const StatusIcon = config.icon;
            return {
                value: 100,
                label: config.label,
                icon: (
                    <StatusIcon
                        className={cx('size-3.5 shrink-0', config.colorClass)}
                    />
                ),
                title,
            };
        }

        if (isTerminalFailure) {
            const StatusIcon = config.icon;
            return {
                value: 0,
                failed: true,
                label: config.label,
                icon: (
                    <StatusIcon
                        className={cx('size-3.5 shrink-0', config.colorClass)}
                    />
                ),
                title: `${config.label} — preskočeno`,
            };
        }

        const isNextPending = idx === firstPendingIdx;
        const StatusIcon = config.icon;
        return {
            value: isNextPending ? 50 : 0,
            indeterminate: isNextPending,
            highlighted: isNextPending,
            label: config.label,
            icon: (
                <StatusIcon
                    className={cx('size-3.5 shrink-0', config.colorClass)}
                />
            ),
            title,
        };
    });

    if (isTerminalFailure) {
        const terminalConfig = statusConfig[operation.status];
        const StatusIcon = terminalConfig.icon;
        segments.push({
            value: 0,
            failed: true,
            label: terminalConfig.label,
            icon: (
                <StatusIcon
                    className={cx(
                        'size-3.5 shrink-0',
                        terminalConfig.colorClass,
                    )}
                />
            ),
            title: `${terminalConfig.label} — ${
                formatDateTime(
                    operation.canceledAt ?? operation.completedAt ?? null,
                ) ?? ''
            }`.trim(),
        });
    }

    return segments;
}

function OperationProgress({
    operation,
}: {
    operation: GardenOperationHudItem;
}) {
    const segments = useMemo(() => buildSegments(operation), [operation]);

    return (
        <Stack spacing={2}>
            <SegmentedProgress className="pb-5 pr-4" segments={segments} />
            <Row
                justifyContent="space-between"
                spacing={2}
                className="flex-wrap"
            >
                <StatusBadge status={operation.status} />
                <Typography level="body3" secondary>
                    {statusConfig[operation.status].nextStep}
                </Typography>
            </Row>
        </Stack>
    );
}

function OperationDates({ operation }: { operation: GardenOperationItem }) {
    const createdAt = formatDate(operation.createdAt);
    const scheduledDate = formatDate(operation.scheduledDate);

    return (
        <Row spacing={2} className="flex-wrap">
            {createdAt && (
                <Typography level="body3" secondary>
                    Kreirano: {createdAt}
                </Typography>
            )}
            {scheduledDate && (
                <Typography level="body3" secondary>
                    Zakazano: {scheduledDate}
                </Typography>
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

function OperationCard({
    operation,
    operationName,
    operationData,
    plantSortData,
}: {
    operation: GardenOperationHudItem;
    operationName?: string;
    operationData?: OperationData;
    plantSortData?: PlantSortData;
}) {
    const resolvedOperationName = getActiveOperationName({
        operation,
        operationName,
        plantSortName: plantSortData?.information.name,
    });

    return (
        <div className="rounded-xl border p-3">
            <Row spacing={3} alignItems="start">
                <div className="size-12 rounded-lg bg-card flex items-center justify-center overflow-hidden shrink-0">
                    {plantSortData ? (
                        <PlantOrSortImage
                            plantSort={plantSortData}
                            alt={plantSortData.information.name}
                            width={40}
                            height={40}
                        />
                    ) : operationData ? (
                        <OperationImage operation={operationData} size={40} />
                    ) : (
                        <Typography level="body3" secondary>
                            🌱
                        </Typography>
                    )}
                </div>
                <Stack spacing={1.5} className="min-w-0 flex-1">
                    <Stack spacing={0.5}>
                        <Typography level="body2" semiBold noWrap>
                            {resolvedOperationName}
                        </Typography>
                        <Typography level="body3" secondary>
                            {operation.targetLabel}
                        </Typography>
                    </Stack>
                    <OperationDates operation={operation} />
                    <OperationProgress operation={operation} />
                </Stack>
            </Row>
        </div>
    );
}

function CartOperationCard({
    item,
    operationData,
    targetLabel,
    onOpenCart,
}: {
    item: ShoppingCartItemData;
    operationData?: OperationData;
    targetLabel: string;
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
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-400/60 dark:bg-amber-900/30">
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
                        <Typography
                            level="body3"
                            secondary
                            className="dark:text-amber-100/85"
                        >
                            {targetLabel}
                        </Typography>
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
    listRef,
}: {
    trigger: React.ReactElement;
    operations: GardenOperationHudItem[];
    operationDataById: Map<number, OperationData>;
    plantSortById: Map<number, PlantSortData>;
    listRef: (node: HTMLDivElement | null) => void;
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
                        Pregled svih radnji u tvom vrtu. Zadrži pokazivač iznad
                        točke napretka za datum promjene statusa.
                    </Typography>
                </Stack>
                <Divider />
                <Stack
                    spacing={3}
                    data-infinite-scroll-root
                    className="max-h-[70vh] overflow-y-auto pr-1"
                >
                    {operations.length === 0 ? (
                        <Typography level="body3" secondary>
                            Nema radnji.
                        </Typography>
                    ) : (
                        operations.map((operation) => (
                            <OperationCard
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
                                        ? plantSortById.get(operation.entityId)
                                        : undefined
                                }
                            />
                        ))
                    )}
                    <div ref={listRef} className="h-1" />
                </Stack>
            </Stack>
        </Modal>
    );
}

function getLatestOperationChangeTime(operation: GardenOperationHudItem) {
    let latest = new Date(operation.createdAt).getTime();

    for (const entry of operation.statusHistory) {
        const changedAt = new Date(entry.changedAt).getTime();
        if (Number.isFinite(changedAt) && changedAt > latest) {
            latest = changedAt;
        }
    }

    return latest;
}

function sortNewestFirst(operations: GardenOperationHudItem[]) {
    return [...operations].sort((a, b) => {
        const dateDiff =
            getLatestOperationChangeTime(b) - getLatestOperationChangeTime(a);

        return dateDiff !== 0 ? dateDiff : b.id - a.id;
    });
}

function sortScheduledSoonestFirst(operations: GardenOperationHudItem[]) {
    return [...operations].sort((a, b) => {
        const aDate = new Date(a.scheduledDate ?? a.createdAt).getTime();
        const bDate = new Date(b.scheduledDate ?? b.createdAt).getTime();
        const dateDiff = aDate - bDate;

        return dateDiff !== 0 ? dateDiff : a.id - b.id;
    });
}

export function GardenOperationsHud() {
    const { track } = useGameAnalytics();
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
    const { data: sowingPlantSorts } = useSorts(
        sowingPlantSortIds.length > 0 ? sowingPlantSortIds : undefined,
    );

    const pendingOperations = useMemo(
        () =>
            sortScheduledSoonestFirst(
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
                (sowingPlantSorts ?? []).map((plantSort) => [
                    plantSort.id,
                    plantSort,
                ]),
            ),
        [sowingPlantSorts],
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
                        targetLabel: getCartOperationTargetLabel(
                            item,
                            currentGarden,
                        ),
                    },
                ];
            })
            .sort((a, b) => {
                const dateDiff =
                    getTimestamp(a.scheduledDate) -
                    getTimestamp(b.scheduledDate);

                return dateDiff !== 0 ? dateDiff : a.item.id - b.item.id;
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
                <Stack
                    spacing={2}
                    data-infinite-scroll-root
                    className="max-h-[50vh] overflow-y-auto p-3"
                >
                    {activeOperationCount === 0 ? (
                        <Typography level="body3" secondary>
                            Nema nedovršenih radnji.
                        </Typography>
                    ) : (
                        <>
                            {cartOperations.length > 0 && (
                                <Stack spacing={2}>
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
                                            targetLabel={
                                                cartOperation.targetLabel
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
                            {pendingOperations.map((operation) => (
                                <OperationCard
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
                                />
                            ))}
                        </>
                    )}
                    <div ref={pendingRef} className="h-1" />
                </Stack>
                <Divider />
                <HistoryModal
                    operations={historyOperations}
                    operationDataById={operationDataById}
                    plantSortById={plantSortById}
                    listRef={historyRef}
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
