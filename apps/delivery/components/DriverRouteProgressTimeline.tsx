'use client';

import { Chip } from '@gredice/ui/Chip';
import {
    Check,
    ExpandDown,
    Hourglass,
    Lock,
    MapPin,
    Navigate,
    Reset,
    Timer,
    Truck,
    Warning,
} from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import {
    type KeyboardEvent,
    type ReactNode,
    useEffect,
    useId,
    useRef,
    useState,
} from 'react';
import {
    formatDeliveryTime,
    formatTravelDuration,
} from '../lib/deliveryFormatting';
import type {
    DriverRouteTimelineItem,
    DriverRouteTimelineState,
} from '../lib/deliveryRouteTimelinePresentation';

function stateLabel(state: DriverRouteTimelineState) {
    switch (state) {
        case 'completed':
            return 'Dovršeno';
        case 'syncing':
            return 'Dovršeno · čeka sinkronizaciju';
        case 'current':
            return 'Trenutačna stanica';
        case 'next':
            return 'Sljedeća stanica';
        case 'upcoming':
            return 'Nadolazeća stanica';
        case 'retry':
            return 'Ponovni pokušaj';
        case 'exception':
            return 'Iznimka';
        case 'locked':
            return 'Čeka redoslijed';
    }
}

function stateColor(state: DriverRouteTimelineState) {
    switch (state) {
        case 'completed':
            return 'success' as const;
        case 'syncing':
            return 'info' as const;
        case 'current':
        case 'next':
            return 'info' as const;
        case 'retry':
            return 'warning' as const;
        case 'exception':
            return 'error' as const;
        case 'upcoming':
        case 'locked':
            return 'neutral' as const;
    }
}

function stateBorder(state: DriverRouteTimelineState) {
    switch (state) {
        case 'completed':
            return 'border-l-emerald-600';
        case 'syncing':
            return 'border-l-sky-600 bg-sky-50/40 dark:bg-sky-950/20';
        case 'current':
            return 'border-l-primary bg-primary/5';
        case 'next':
            return 'border-l-sky-600';
        case 'retry':
            return 'border-l-amber-600';
        case 'exception':
            return 'border-l-destructive';
        case 'locked':
            return 'border-l-muted-foreground/40 bg-muted/30';
        case 'upcoming':
            return 'border-l-border';
    }
}

function StateIcon({ state }: { state: DriverRouteTimelineState }) {
    const className = 'size-4';
    switch (state) {
        case 'completed':
            return <Check aria-hidden className={className} />;
        case 'syncing':
            return <Hourglass aria-hidden className={className} />;
        case 'current':
            return <MapPin aria-hidden className={className} />;
        case 'next':
            return <Navigate aria-hidden className={className} />;
        case 'retry':
            return <Reset aria-hidden className={className} />;
        case 'exception':
            return <Warning aria-hidden className={className} />;
        case 'locked':
            return <Lock aria-hidden className={className} />;
        case 'upcoming':
            return <Timer aria-hidden className={className} />;
    }
}

function countLabel(count: number) {
    return `${count} ${count === 1 ? 'urod' : 'uroda'}`;
}

function focusTimelineTrigger(
    itemIds: readonly string[],
    triggerRefs: Map<string, HTMLButtonElement>,
    currentId: string,
    key: KeyboardEvent<HTMLButtonElement>['key'],
) {
    const currentIndex = itemIds.indexOf(currentId);
    if (currentIndex < 0) return false;
    let nextIndex: number | null = null;
    if (key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % itemIds.length;
    } else if (key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + itemIds.length) % itemIds.length;
    } else if (key === 'Home') {
        nextIndex = 0;
    } else if (key === 'End') {
        nextIndex = itemIds.length - 1;
    }
    const nextId = nextIndex === null ? null : itemIds[nextIndex];
    if (!nextId) return false;
    triggerRefs.get(nextId)?.focus();
    return true;
}

export function DriverRouteProgressTimeline({
    items,
    renderDetails,
    onSelectionChange,
    selectedId,
    label = 'Tijek dostavne rute',
}: {
    items: readonly DriverRouteTimelineItem[];
    renderDetails: (item: DriverRouteTimelineItem) => ReactNode;
    onSelectionChange?: (item: DriverRouteTimelineItem | null) => void;
    selectedId?: string | null;
    label?: string;
}) {
    const [internalExpandedId, setInternalExpandedId] = useState<string | null>(
        null,
    );
    const expandedId =
        selectedId === undefined ? internalExpandedId : selectedId;
    const timelineId = useId();
    const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
    const itemIds = items.map((item) => item.id);

    useEffect(() => {
        if (expandedId && !items.some((item) => item.id === expandedId)) {
            setInternalExpandedId(null);
            onSelectionChange?.(null);
        }
    }, [expandedId, items, onSelectionChange]);

    return (
        <ol aria-label={label} className="space-y-2">
            {items.map((item) => {
                const expanded = expandedId === item.id;
                const triggerId = `${timelineId}-${item.id}-trigger`;
                const panelId = `${timelineId}-${item.id}-details`;
                return (
                    <li
                        key={item.id}
                        data-route-state={item.state}
                        className={`overflow-hidden rounded-lg border border-l-4 bg-card shadow-sm ${stateBorder(item.state)}`}
                    >
                        <button
                            ref={(element) => {
                                if (element) {
                                    triggerRefs.current.set(item.id, element);
                                } else {
                                    triggerRefs.current.delete(item.id);
                                }
                            }}
                            id={triggerId}
                            type="button"
                            aria-controls={panelId}
                            aria-expanded={expanded}
                            aria-current={
                                item.state === 'current' ? 'step' : undefined
                            }
                            className="flex min-h-16 w-full items-start gap-3 px-3 py-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                            onClick={() => {
                                const nextExpandedId = expanded
                                    ? null
                                    : item.id;
                                setInternalExpandedId(nextExpandedId);
                                onSelectionChange?.(
                                    nextExpandedId ? item : null,
                                );
                            }}
                            onKeyDown={(event) => {
                                if (
                                    focusTimelineTrigger(
                                        itemIds,
                                        triggerRefs.current,
                                        item.id,
                                        event.key,
                                    )
                                ) {
                                    event.preventDefault();
                                }
                            }}
                        >
                            <span className="sr-only">
                                Stanica {item.sequence}.{' '}
                            </span>
                            <span
                                aria-hidden
                                className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-background text-sm font-semibold tabular-nums"
                            >
                                {item.sequence}
                            </span>
                            <span className="min-w-0 flex-1 space-y-1.5">
                                <span className="flex flex-wrap items-center gap-1.5">
                                    <Chip
                                        color={stateColor(item.state)}
                                        size="sm"
                                        startDecorator={
                                            <StateIcon state={item.state} />
                                        }
                                    >
                                        {stateLabel(item.state)}
                                    </Chip>
                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                        {item.kind === 'pickup' ? (
                                            <MapPin
                                                aria-hidden
                                                className="size-3.5"
                                            />
                                        ) : (
                                            <Truck
                                                aria-hidden
                                                className="size-3.5"
                                            />
                                        )}
                                        {item.kind === 'pickup'
                                            ? 'Preuzimanje'
                                            : 'Dostava'}
                                    </span>
                                </span>
                                <span className="block truncate font-semibold">
                                    {item.title}
                                </span>
                                <span className="block truncate text-sm text-muted-foreground">
                                    {item.destination}
                                </span>
                                <span className="sr-only">
                                    {`${countLabel(item.deliveryCount)}${
                                        item.estimatedArrivalAt
                                            ? `, procijenjeni dolazak ${formatDeliveryTime(item.estimatedArrivalAt)}`
                                            : ''
                                    }${
                                        item.estimatedTravelSeconds !== null
                                            ? `, ${formatTravelDuration(item.estimatedTravelSeconds)} vožnje`
                                            : ''
                                    }`}
                                </span>
                                <span
                                    aria-hidden
                                    className="block truncate text-xs text-muted-foreground"
                                >
                                    {countLabel(item.deliveryCount)}
                                    {item.estimatedArrivalAt ? (
                                        <>
                                            <span aria-hidden> · </span>ETA{' '}
                                            {formatDeliveryTime(
                                                item.estimatedArrivalAt,
                                            )}
                                        </>
                                    ) : null}
                                    {item.estimatedTravelSeconds !== null ? (
                                        <>
                                            <span aria-hidden> · </span>
                                            {formatTravelDuration(
                                                item.estimatedTravelSeconds,
                                            )}
                                        </>
                                    ) : null}
                                </span>
                                {item.statusMessage ? (
                                    <span className="block text-xs text-sky-800 dark:text-sky-200">
                                        {item.statusMessage}
                                    </span>
                                ) : null}
                            </span>
                            <ExpandDown
                                aria-hidden
                                className={`mt-2 size-5 shrink-0 transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
                            />
                        </button>
                        {expanded ? (
                            <section
                                id={panelId}
                                aria-labelledby={triggerId}
                                className="border-t bg-background p-3"
                            >
                                <Typography level="body3" className="sr-only">
                                    Detalji stanice {item.sequence}
                                </Typography>
                                {renderDetails(item)}
                            </section>
                        ) : null}
                    </li>
                );
            })}
        </ol>
    );
}
