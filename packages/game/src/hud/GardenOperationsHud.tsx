import { OperationImage } from '@gredice/ui/OperationImage';
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
} from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { cx } from '@signalco/ui-primitives/cx';
import { Divider } from '@signalco/ui-primitives/Divider';
import { DotIndicator } from '@signalco/ui-primitives/DotIndicator';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Popper } from '@signalco/ui-primitives/Popper';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { type ComponentType, useCallback, useMemo, useRef } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { SegmentedProgress } from '../controls/components/SegmentedProgress';
import {
    type GardenOperationItem,
    type GardenOperationStatus,
    useGardenOperations,
} from '../hooks/useGardenOperations';
import { useOperations } from '../hooks/useOperations';

type OperationData = NonNullable<
    ReturnType<typeof useOperations>['data']
>[number];

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
        <Row spacing={0.5} className={config.colorClass}>
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

            if (!node) return;

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
            return {
                value: 100,
                label: config.label,
                title,
            };
        }

        if (isTerminalFailure) {
            return {
                value: 0,
                failed: true,
                label: config.label,
                title: `${config.label} — preskočeno`,
            };
        }

        const isNextPending = idx === firstPendingIdx;
        return {
            value: isNextPending ? 50 : 0,
            indeterminate: isNextPending,
            highlighted: isNextPending,
            label: config.label,
            title,
        };
    });

    if (isTerminalFailure) {
        const terminalConfig = statusConfig[operation.status];
        segments.push({
            value: 0,
            failed: true,
            label: terminalConfig.label,
            title: `${terminalConfig.label} — ${
                formatDateTime(
                    operation.canceledAt ?? operation.completedAt ?? null,
                ) ?? ''
            }`.trim(),
        });
    }

    return segments;
}

function OperationProgress({ operation }: { operation: GardenOperationItem }) {
    const segments = useMemo(() => buildSegments(operation), [operation]);

    return (
        <Stack spacing={1}>
            <SegmentedProgress className="pb-5 pr-4" segments={segments} />
            <Row
                justifyContent="space-between"
                spacing={1}
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
        <Row spacing={1} className="flex-wrap">
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

function OperationCard({
    operation,
    operationName,
    operationData,
}: {
    operation: GardenOperationItem;
    operationName?: string;
    operationData?: OperationData;
}) {
    return (
        <div className="rounded-xl border p-3">
            <Row spacing={1.5} alignItems="start">
                <div className="size-12 rounded-lg bg-card flex items-center justify-center overflow-hidden shrink-0">
                    {operationData ? (
                        <OperationImage operation={operationData} size={40} />
                    ) : (
                        <Typography level="body3" secondary>
                            🌱
                        </Typography>
                    )}
                </div>
                <Stack spacing={0.75} className="min-w-0 flex-1">
                    <Stack spacing={0.25}>
                        <Typography level="body2" semiBold noWrap>
                            {operationName ?? `Radnja #${operation.id}`}
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

function HistoryModal({
    trigger,
    operations,
    operationDataById,
    listRef,
}: {
    trigger: React.ReactElement;
    operations: GardenOperationItem[];
    operationDataById: Map<number, OperationData>;
    listRef: (node: HTMLDivElement | null) => void;
}) {
    return (
        <Modal
            title="Povijest radnji"
            trigger={trigger}
            className="md:max-w-4xl"
        >
            <Stack spacing={2}>
                <Stack spacing={0.5}>
                    <Typography level="h5">Povijest radnji</Typography>
                    <Typography level="body2" secondary>
                        Pregled svih radnji u tvom vrtu. Zadrži pokazivač iznad
                        točke napretka za datum promjene statusa.
                    </Typography>
                </Stack>
                <Divider />
                <Stack
                    spacing={1.5}
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
                                key={operation.id}
                                operation={operation}
                                operationName={
                                    operationDataById.get(operation.entityId)
                                        ?.information.label
                                }
                                operationData={operationDataById.get(
                                    operation.entityId,
                                )}
                            />
                        ))
                    )}
                    <div ref={listRef} className="h-1" />
                </Stack>
            </Stack>
        </Modal>
    );
}

function sortNewestFirst(operations: GardenOperationItem[]) {
    return [...operations].sort((a, b) => {
        const aDate = new Date(
            a.canceledAt ?? a.verifiedAt ?? a.completedAt ?? a.createdAt,
        ).getTime();
        const bDate = new Date(
            b.canceledAt ?? b.verifiedAt ?? b.completedAt ?? b.createdAt,
        ).getTime();
        return bDate - aDate;
    });
}

export function GardenOperationsHud() {
    const { track } = useGameAnalytics();
    const { data: operationsData } = useOperations();
    const pending = useGardenOperations({
        includeCompleted: false,
        pageSize: 10,
    });
    const history = useGardenOperations({
        includeCompleted: true,
        pageSize: 20,
    });

    const pendingOperations = useMemo(
        () =>
            sortNewestFirst(
                (
                    pending.data?.pages.flatMap((page) => page.items) ?? []
                ).filter(
                    (operation) => !hiddenFromActive.has(operation.status),
                ),
            ),
        [pending.data?.pages],
    );
    const historyOperations = useMemo(
        () =>
            sortNewestFirst(
                history.data?.pages.flatMap((page) => page.items) ?? [],
            ),
        [history.data?.pages],
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
                    {pendingOperations.length > 0 && (
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
                    spacing={1}
                    data-infinite-scroll-root
                    className="max-h-[50vh] overflow-y-auto p-3"
                >
                    {pendingOperations.length === 0 ? (
                        <Typography level="body3" secondary>
                            Nema nedovršenih radnji.
                        </Typography>
                    ) : (
                        pendingOperations.map((operation) => (
                            <OperationCard
                                key={operation.id}
                                operation={operation}
                                operationName={
                                    operationDataById.get(operation.entityId)
                                        ?.information.label
                                }
                                operationData={operationDataById.get(
                                    operation.entityId,
                                )}
                            />
                        ))
                    )}
                    <div ref={pendingRef} className="h-1" />
                </Stack>
                <Divider />
                <HistoryModal
                    operations={historyOperations}
                    operationDataById={operationDataById}
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
