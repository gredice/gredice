'use client';

import { Calendar, Check, LoaderSpinner } from '@gredice/ui/icons';
import { TimeRange } from '@gredice/ui/LocalDateTime';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import { Typography } from '@gredice/ui/Typography';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { TimeSlotDisplay } from '../components';
import { changeDeliveryRequestSlotAction } from './actions';
import { useDeliveryRequestSlots } from './DeliveryRequestSlotsProvider';
import type {
    DeliveryRequestActionData,
    DeliveryRequestSlotOption,
} from './DeliveryRequestTypes';

function slotDateValue(slot: DeliveryRequestSlotOption) {
    return typeof slot.startAt === 'string'
        ? new Date(slot.startAt)
        : slot.startAt;
}

function sortSlotsByStartAt(
    left: DeliveryRequestSlotOption,
    right: DeliveryRequestSlotOption,
) {
    return slotDateValue(left).getTime() - slotDateValue(right).getTime();
}

function slotMatchesMode(
    request: DeliveryRequestActionData,
    slot: DeliveryRequestSlotOption,
) {
    return !request.mode || !slot.type || slot.type === request.mode;
}

export function DeliveryRequestSlotAction({
    request,
}: {
    request: DeliveryRequestActionData;
}) {
    const router = useRouter();
    const slots = useDeliveryRequestSlots();
    const [loadingSlotId, setLoadingSlotId] = useState<number | null>(null);
    const matchingSlots = useMemo(
        () =>
            slots
                .filter((slot) => slotMatchesMode(request, slot))
                .toSorted(sortSlotsByStartAt),
        [request, slots],
    );
    const canChangeSlot = request.state !== 'fulfilled';

    async function updateSlot(slotId: number) {
        setLoadingSlotId(slotId);

        try {
            const formData = new FormData();
            formData.set('requestId', request.id);
            formData.set('slotId', String(slotId));

            const result = await changeDeliveryRequestSlotAction(
                null,
                formData,
            );
            if (!result.success) {
                alert(result.message);
                return;
            }

            router.refresh();
        } finally {
            setLoadingSlotId(null);
        }
    }

    const triggerContent = (
        <>
            <Calendar className="size-4 shrink-0" />
            <span className="min-w-0 truncate">
                <TimeSlotDisplay
                    slot={request.slot}
                    fallback="Bez termina"
                    className="text-inherit"
                />
            </span>
        </>
    );

    if (!canChangeSlot) {
        return (
            <span className="inline-flex h-8 min-w-0 max-w-full items-center gap-2 rounded-full border border-transparent px-2 text-xs text-muted-foreground">
                {triggerContent}
            </span>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="inline-flex h-8 min-w-0 max-w-full items-center gap-2 rounded-full border border-input bg-background px-2 text-left text-xs text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                    aria-label="Promijeni termin dostave"
                    disabled={loadingSlotId !== null}
                >
                    {triggerContent}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Otvoreni termini</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {matchingSlots.length === 0 ? (
                    <DropdownMenuItem disabled>
                        Nema otvorenih termina
                    </DropdownMenuItem>
                ) : (
                    matchingSlots.map((slot) => {
                        const isCurrentSlot = request.slot?.id === slot.id;
                        const isLoading = loadingSlotId === slot.id;

                        return (
                            <DropdownMenuItem
                                key={slot.id}
                                className="cursor-pointer justify-between gap-3"
                                disabled={
                                    isCurrentSlot || loadingSlotId !== null
                                }
                                onClick={() => {
                                    void updateSlot(slot.id);
                                }}
                            >
                                <Typography
                                    level="body2"
                                    component="span"
                                    className="min-w-0 truncate"
                                >
                                    <TimeRange
                                        startAt={slot.startAt}
                                        endAt={slot.endAt}
                                    />
                                </Typography>
                                {isLoading ? (
                                    <LoaderSpinner className="size-4 shrink-0 animate-spin" />
                                ) : isCurrentSlot ? (
                                    <Check className="size-4 shrink-0" />
                                ) : null}
                            </DropdownMenuItem>
                        );
                    })
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
