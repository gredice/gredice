import type { OperationData } from '@gredice/client';
import {
    EventCalendar,
    type EventCalendarEntry,
} from '@gredice/ui/EventCalendar';
import { OperationImage } from '@gredice/ui/OperationImage';
import { useEffect, useMemo } from 'react';
import {
    type GardenOperationItem,
    useGardenOperations,
} from '../../../hooks/useGardenOperations';
import {
    type ShoppingCartItemData,
    useShoppingCart,
} from '../../../hooks/useShoppingCart';

type OperationScheduleEntrySource =
    | 'cart'
    | 'completed'
    | 'preview'
    | 'scheduled';

const operationCalendarPageSize = 20;

const sourceLabels = {
    cart: 'U košari',
    completed: 'Obavljeno',
    preview: 'Novi termin',
    scheduled: 'Zakazano',
} satisfies Record<OperationScheduleEntrySource, string>;

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

function operationDate(operation: GardenOperationItem) {
    if (operation.status === 'canceled' || operation.status === 'failed') {
        return null;
    }

    const completionDate =
        dateFromUnknown(operation.verifiedAt) ??
        dateFromUnknown(operation.completedAt);

    if (operation.status === 'completed') {
        return (
            completionDate ??
            dateFromUnknown(operation.scheduledDate) ??
            dateFromUnknown(operation.createdAt)
        );
    }

    if (operation.status === 'confirmed') {
        return (
            completionDate ??
            dateFromUnknown(operation.scheduledDate) ??
            dateFromUnknown(operation.scheduledAt) ??
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
): OperationScheduleEntrySource {
    if (operation.status === 'completed') {
        return 'completed';
    }

    if (
        operation.status === 'confirmed' &&
        (dateFromUnknown(operation.verifiedAt) ??
            dateFromUnknown(operation.completedAt))
    ) {
        return 'completed';
    }

    return 'scheduled';
}

function entryMeta({
    source,
    targetLabel,
}: {
    source: OperationScheduleEntrySource;
    targetLabel?: string | null;
}) {
    return [sourceLabels[source], targetLabel].filter(Boolean).join(' · ');
}

function cartItemMatchesOperation({
    gardenId,
    item,
    operation,
    positionIndex,
    raisedBedId,
}: {
    gardenId: number;
    item: ShoppingCartItemData;
    operation: OperationData;
    positionIndex?: number;
    raisedBedId?: number;
}) {
    return (
        item.entityTypeName === operation.entityType.name &&
        item.status === 'new' &&
        item.gardenId === gardenId &&
        Number(item.entityId) === operation.id &&
        (raisedBedId === undefined
            ? true
            : (item.raisedBedId ?? undefined) === raisedBedId) &&
        (positionIndex === undefined
            ? true
            : (item.positionIndex ?? undefined) === positionIndex)
    );
}

function cartItemDate(item: ShoppingCartItemData, referenceDate: Date) {
    const additionalData = parseAdditionalData(item.additionalData);
    return (
        dateFromUnknown(additionalData.scheduledDate) ??
        getTomorrowDate(referenceDate)
    );
}

function operationVisual(operation: OperationData) {
    return <OperationImage operation={operation} size={20} />;
}

function toCalendarEntry({
    date,
    id,
    operation,
    source,
    targetLabel,
}: {
    date: Date;
    id: string;
    operation: OperationData;
    source: OperationScheduleEntrySource;
    targetLabel?: string | null;
}): EventCalendarEntry {
    return {
        id,
        date,
        label: operation.information.label,
        meta: entryMeta({ source, targetLabel }),
        tone: source,
        visual: operationVisual(operation),
    };
}

export function OperationScheduleCalendar({
    className,
    gardenId,
    maxSelectableDate,
    minSelectableDate,
    onDateSelect,
    operation,
    positionIndex,
    previewDate,
    raisedBedId,
    referenceDate = new Date(),
    selectedDate,
    visibleFrom,
    visibleTo,
}: {
    className?: string;
    gardenId: number;
    maxSelectableDate?: Date;
    minSelectableDate?: Date;
    onDateSelect?: (date: Date) => void;
    operation: OperationData;
    positionIndex?: number;
    previewDate?: Date | null;
    raisedBedId?: number;
    referenceDate?: Date;
    selectedDate?: Date | null;
    visibleFrom?: Date;
    visibleTo?: Date;
}) {
    const { data: cart } = useShoppingCart();
    const history = useGardenOperations({
        includeCompleted: true,
        pageSize: operationCalendarPageSize,
        raisedBedId,
        positionIndex,
    });

    const hasNextHistoryPage = history.hasNextPage;
    const isFetchingNextHistoryPage = history.isFetchingNextPage;
    const fetchNextHistoryPage = history.fetchNextPage;

    useEffect(() => {
        if (hasNextHistoryPage && !isFetchingNextHistoryPage) {
            void fetchNextHistoryPage();
        }
    }, [fetchNextHistoryPage, hasNextHistoryPage, isFetchingNextHistoryPage]);

    const entries = useMemo(() => {
        const historyEntries =
            history.data?.pages.flatMap((page) =>
                page.items.flatMap((item): EventCalendarEntry[] => {
                    if (
                        item.entityTypeName !== operation.entityType.name ||
                        item.entityId !== operation.id
                    ) {
                        return [];
                    }

                    const date = operationDate(item);
                    if (!date) {
                        return [];
                    }

                    return [
                        toCalendarEntry({
                            date,
                            id: `operation-${item.id}`,
                            operation,
                            source: operationSource(item),
                            targetLabel: item.targetLabel,
                        }),
                    ];
                }),
            ) ?? [];

        const cartEntries =
            cart?.items.flatMap((item): EventCalendarEntry[] => {
                if (
                    !cartItemMatchesOperation({
                        gardenId,
                        item,
                        operation,
                        positionIndex,
                        raisedBedId,
                    })
                ) {
                    return [];
                }

                return [
                    toCalendarEntry({
                        date: cartItemDate(item, referenceDate),
                        id: `cart-${item.id}`,
                        operation,
                        source: 'cart',
                    }),
                ];
            }) ?? [];

        const previewEntry = previewDate
            ? [
                  toCalendarEntry({
                      date: previewDate,
                      id: `preview-${operation.id}`,
                      operation,
                      source: 'preview',
                  }),
              ]
            : [];

        return [...historyEntries, ...cartEntries, ...previewEntry];
    }, [
        cart?.items,
        gardenId,
        history.data?.pages,
        operation,
        positionIndex,
        previewDate,
        raisedBedId,
        referenceDate,
    ]);

    return (
        <EventCalendar
            className={className}
            emptyLabel={null}
            entries={entries}
            error={history.isError}
            errorLabel="Kalendar radnji nije dostupan."
            isLoading={history.isLoading || history.isFetchingNextPage}
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
