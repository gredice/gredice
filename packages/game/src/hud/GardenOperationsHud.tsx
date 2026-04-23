import { OperationImage } from '@gredice/ui/OperationImage';
import { Button } from '@signalco/ui-primitives/Button';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Popper } from '@signalco/ui-primitives/Popper';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useMemo, useRef } from 'react';
import {
    type GardenOperationItem,
    type GardenOperationStatus,
    useGardenOperations,
} from '../hooks/useGardenOperations';
import { useOperations } from '../hooks/useOperations';
import { HudCard } from './components/HudCard';

type OperationData = NonNullable<
    ReturnType<typeof useOperations>['data']
>[number];

const statusOrder: GardenOperationStatus[] = [
    'new',
    'planned',
    'pendingVerification',
    'completed',
    'failed',
    'canceled',
];

const statusLabel: Record<GardenOperationStatus, string> = {
    new: 'Kreirano',
    planned: 'Planirano',
    pendingVerification: 'Čeka potvrdu',
    completed: 'Završeno',
    failed: 'Neuspjelo',
    canceled: 'Otkazano',
};

const nextStepLabel: Record<GardenOperationStatus, string> = {
    new: 'Sljedeći korak: zakazivanje',
    planned: 'Sljedeći korak: izvršenje radnje',
    pendingVerification: 'Sljedeći korak: verifikacija',
    completed: 'Radnja završena',
    failed: 'Sljedeći korak: ponovni pokušaj',
    canceled: 'Radnja je otkazana',
};

function formatDateTime(value?: string | null) {
    if (!value) return '—';
    return new Date(value).toLocaleString('hr-HR');
}

function useInfiniteScroll(fetchNextPage: () => void, hasNextPage?: boolean) {
    const observerRef = useRef<IntersectionObserver | null>(null);

    return (node: HTMLDivElement | null) => {
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        observerRef.current = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting && hasNextPage) {
                fetchNextPage();
            }
        });

        if (node) observerRef.current.observe(node);
    };
}

function OperationProgress({ operation }: { operation: GardenOperationItem }) {
    const currentStep = statusOrder.indexOf(operation.status);
    const maxIndex = statusOrder.indexOf('completed');
    const progress = Math.max(0, Math.min(100, (currentStep / maxIndex) * 100));

    return (
        <Stack spacing={0.5}>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                />
            </div>
            <Row justifyContent="space-between">
                <Typography level="body3" secondary>
                    {statusLabel[operation.status]}
                </Typography>
                <Typography level="body3" secondary>
                    {nextStepLabel[operation.status]}
                </Typography>
            </Row>
        </Stack>
    );
}

function OperationCard({
    operation,
    showStatusHistory,
    operationName,
    operationData,
}: {
    operation: GardenOperationItem;
    showStatusHistory?: boolean;
    operationName?: string;
    operationData?: OperationData;
}) {
    return (
        <div className="rounded-xl border p-2">
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
                <Stack spacing={0.5} className="min-w-0 flex-1">
                    <Typography level="body2" semiBold noWrap>
                        {operationName ?? `Radnja #${operation.id}`}
                    </Typography>
                    <Typography level="body3" secondary>
                        {operation.targetLabel}
                    </Typography>
                    <OperationProgress operation={operation} />
                    {showStatusHistory && (
                        <div className="pt-1">
                            {operation.statusHistory.map((entry) => (
                                <Row
                                    key={`${operation.id}-${entry.status}-${entry.changedAt}`}
                                    justifyContent="space-between"
                                >
                                    <Typography level="body3" secondary>
                                        {statusLabel[entry.status]}
                                    </Typography>
                                    <Typography level="body3" secondary>
                                        {formatDateTime(entry.changedAt)}
                                    </Typography>
                                </Row>
                            ))}
                        </div>
                    )}
                </Stack>
            </Row>
        </div>
    );
}

export function GardenOperationsHud() {
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
        () => pending.data?.pages.flatMap((page) => page.items) ?? [],
        [pending.data?.pages],
    );
    const historyOperations = useMemo(
        () => history.data?.pages.flatMap((page) => page.items) ?? [],
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
        <HudCard open position="floating" className="p-0.5 static">
            <Popper
                side="bottom"
                sideOffset={12}
                className="w-[28rem] max-w-[90vw] border-tertiary border-b-4"
                trigger={
                    <Button
                        variant="plain"
                        className="rounded-full px-3 h-10"
                        title="Status radnji"
                    >
                        Radnje{' '}
                        {pendingOperations.length > 0
                            ? `(${pendingOperations.length})`
                            : ''}
                    </Button>
                }
            >
                <Stack spacing={1.5} className="p-3">
                    <Row justifyContent="space-between" alignItems="center">
                        <Typography level="body1" semiBold>
                            Aktivne radnje
                        </Typography>
                        <Modal
                            title="Historija radnji"
                            trigger={
                                <Button size="sm" variant="plain">
                                    Sva historija
                                </Button>
                            }
                        >
                            <Stack
                                spacing={1.5}
                                className="max-h-[70vh] overflow-y-auto pr-1"
                            >
                                {historyOperations.map((operation) => (
                                    <OperationCard
                                        key={operation.id}
                                        operation={operation}
                                        showStatusHistory
                                        operationName={
                                            operationDataById.get(
                                                operation.entityId,
                                            )?.information.label
                                        }
                                        operationData={operationDataById.get(
                                            operation.entityId,
                                        )}
                                    />
                                ))}
                                <div ref={historyRef} className="h-1" />
                            </Stack>
                        </Modal>
                    </Row>
                    <Stack
                        spacing={1}
                        className="max-h-[50vh] overflow-y-auto pr-1"
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
                                        operationDataById.get(
                                            operation.entityId,
                                        )?.information.label
                                    }
                                    operationData={operationDataById.get(
                                        operation.entityId,
                                    )}
                                />
                            ))
                        )}
                        <div ref={pendingRef} className="h-1" />
                    </Stack>
                </Stack>
            </Popper>
        </HudCard>
    );
}
