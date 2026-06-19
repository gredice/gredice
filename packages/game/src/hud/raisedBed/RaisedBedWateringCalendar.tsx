import type { OperationData } from '@gredice/client';
import { useEffect, useMemo } from 'react';
import {
    type GardenOperationItem,
    useGardenOperations,
} from '../../hooks/useGardenOperations';
import { useLiveTime } from '../../hooks/useLiveTime';
import { useOperations } from '../../hooks/useOperations';
import {
    type ShoppingCartItemData,
    useShoppingCart,
} from '../../hooks/useShoppingCart';
import { WateringOperationsCalendar } from './WateringOperationsCalendar';
import type {
    WateringCalendarEntry,
    WateringCalendarEntrySource,
} from './wateringCalendarModel';

const wateringCalendarPageSize = 50;
const fallbackOperationWeight = 30;

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseAdditionalData(additionalData?: string | null) {
    if (!additionalData) {
        return {};
    }

    try {
        const parsed = JSON.parse(additionalData);
        return isRecord(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function dateFromUnknown(value: unknown) {
    if (typeof value !== 'string' && !(value instanceof Date)) {
        return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function getTomorrowDate(referenceDate: Date) {
    return new Date(
        referenceDate.getFullYear(),
        referenceDate.getMonth(),
        referenceDate.getDate() + 1,
    );
}

function parseOperationId(value: string | number) {
    const operationId = Number(value);
    return Number.isInteger(operationId) && operationId > 0
        ? operationId
        : null;
}

export function isWateringOperation(
    operation: OperationData | undefined,
): operation is OperationData {
    return operation?.attributes.stage.information?.name === 'watering';
}

function operationWeight(operation: OperationData | undefined) {
    const duration = operation?.attributes.duration;
    return typeof duration === 'number' && duration > 0
        ? duration
        : fallbackOperationWeight;
}

function operationDate(operation: GardenOperationItem) {
    if (operation.status === 'canceled' || operation.status === 'failed') {
        return null;
    }

    if (operation.status === 'completed') {
        return (
            dateFromUnknown(operation.verifiedAt) ??
            dateFromUnknown(operation.completedAt) ??
            dateFromUnknown(operation.scheduledDate) ??
            dateFromUnknown(operation.createdAt)
        );
    }

    if (operation.status === 'confirmed') {
        return (
            dateFromUnknown(operation.completedAt) ??
            dateFromUnknown(operation.scheduledDate) ??
            dateFromUnknown(operation.createdAt)
        );
    }

    return (
        dateFromUnknown(operation.scheduledDate) ??
        dateFromUnknown(operation.scheduledAt)
    );
}

function operationSource(
    operation: GardenOperationItem,
): WateringCalendarEntrySource {
    return operation.status === 'completed' || operation.status === 'confirmed'
        ? 'completed'
        : 'scheduled';
}

function cartItemMatchesRaisedBed({
    gardenId,
    item,
    raisedBedId,
}: {
    gardenId: number;
    item: ShoppingCartItemData;
    raisedBedId: number;
}) {
    return (
        item.entityTypeName === 'operation' &&
        item.status === 'new' &&
        item.gardenId === gardenId &&
        item.raisedBedId === raisedBedId
    );
}

function cartItemDate(item: ShoppingCartItemData, referenceDate: Date) {
    const additionalData = parseAdditionalData(item.additionalData);
    return (
        dateFromUnknown(additionalData.scheduledDate) ??
        getTomorrowDate(referenceDate)
    );
}

function buildOperationEntries({
    operationItems,
    operationsById,
}: {
    operationItems: GardenOperationItem[];
    operationsById: Map<number, OperationData>;
}) {
    return operationItems.flatMap((item): WateringCalendarEntry[] => {
        const operation = operationsById.get(item.entityId);
        if (!isWateringOperation(operation)) {
            return [];
        }

        const date = operationDate(item);
        if (!date) {
            return [];
        }

        return [
            {
                id: `operation-${item.id}`,
                date,
                label: `${operation?.information.label ?? 'Zalijevanje'} - ${item.targetLabel}`,
                source: operationSource(item),
                weight: operationWeight(operation),
            },
        ];
    });
}

function buildCartEntries({
    cartItems,
    gardenId,
    operationsById,
    raisedBedId,
    referenceDate,
}: {
    cartItems: ShoppingCartItemData[];
    gardenId: number;
    operationsById: Map<number, OperationData>;
    raisedBedId: number;
    referenceDate: Date;
}) {
    return cartItems.flatMap((item): WateringCalendarEntry[] => {
        if (!cartItemMatchesRaisedBed({ gardenId, item, raisedBedId })) {
            return [];
        }

        const operationId = parseOperationId(item.entityId);
        const operation =
            operationId == null ? undefined : operationsById.get(operationId);
        if (!isWateringOperation(operation)) {
            return [];
        }

        return [
            {
                id: `cart-${item.id}`,
                date: cartItemDate(item, referenceDate),
                label: `${operation?.information.label ?? 'Zalijevanje'} - u košari`,
                source: 'cart',
                weight: operationWeight(operation) * Math.max(1, item.amount),
            },
        ];
    });
}

function buildPreviewEntry({
    operation,
    previewDate,
}: {
    operation?: OperationData;
    previewDate?: Date | null;
}): WateringCalendarEntry[] {
    if (!previewDate || !isWateringOperation(operation)) {
        return [];
    }

    return [
        {
            id: `preview-${operation.id}`,
            date: previewDate,
            label: `${operation.information.label} - novi termin`,
            source: 'preview',
            weight: operationWeight(operation),
        },
    ];
}

export function RaisedBedWateringCalendar({
    className,
    gardenId,
    maxSelectableDate,
    minSelectableDate,
    onDateSelect,
    operationId,
    previewDate,
    previewOperation,
    raisedBedId,
    selectedDate,
    visibleFrom,
    visibleTo,
}: {
    className?: string;
    gardenId: number;
    maxSelectableDate?: Date;
    minSelectableDate?: Date;
    onDateSelect?: (date: Date) => void;
    operationId?: number;
    previewDate?: Date | null;
    previewOperation?: OperationData;
    raisedBedId: number;
    selectedDate?: Date | null;
    visibleFrom?: Date;
    visibleTo?: Date;
}) {
    const referenceDate = useLiveTime();
    const { data: operations, isError: isOperationsError } = useOperations();
    const { data: cart } = useShoppingCart();
    const history = useGardenOperations({
        includeCompleted: true,
        pageSize: wateringCalendarPageSize,
        raisedBedId,
    });

    const hasNextHistoryPage = history.hasNextPage;
    const isFetchingNextHistoryPage = history.isFetchingNextPage;
    const fetchNextHistoryPage = history.fetchNextPage;

    useEffect(() => {
        if (hasNextHistoryPage && !isFetchingNextHistoryPage) {
            void fetchNextHistoryPage();
        }
    }, [fetchNextHistoryPage, hasNextHistoryPage, isFetchingNextHistoryPage]);

    const operationsById = useMemo(
        () =>
            new Map(
                (operations ?? []).map((operation) => [
                    operation.id,
                    operation,
                ]),
            ),
        [operations],
    );
    const contextOperation =
        previewOperation ??
        (operationId == null ? undefined : operationsById.get(operationId));
    const shouldHideForContext =
        contextOperation !== undefined &&
        !isWateringOperation(contextOperation);
    const hasMissingContext =
        operationId != null &&
        contextOperation === undefined &&
        operations !== undefined;

    const entries = useMemo(
        () => [
            ...buildOperationEntries({
                operationItems:
                    history.data?.pages.flatMap((page) => page.items) ?? [],
                operationsById,
            }),
            ...buildCartEntries({
                cartItems: cart?.items ?? [],
                gardenId,
                operationsById,
                raisedBedId,
                referenceDate,
            }),
            ...buildPreviewEntry({
                operation: previewOperation,
                previewDate,
            }),
        ],
        [
            cart?.items,
            gardenId,
            history.data?.pages,
            operationsById,
            previewDate,
            previewOperation,
            raisedBedId,
            referenceDate,
        ],
    );

    if (shouldHideForContext || hasMissingContext) {
        return null;
    }

    return (
        <WateringOperationsCalendar
            className={className}
            entries={entries}
            error={history.isError || isOperationsError}
            isLoading={
                history.isLoading ||
                history.isFetchingNextPage ||
                operations === undefined
            }
            maxSelectableDate={maxSelectableDate}
            minSelectableDate={minSelectableDate}
            onDateSelect={onDateSelect}
            referenceDate={referenceDate}
            selectedDate={selectedDate}
            visibleFrom={visibleFrom}
            visibleTo={visibleTo}
        />
    );
}
