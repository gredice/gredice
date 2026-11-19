type BookableSlot = {
    type: 'delivery' | 'pickup';
    startAt: string;
    effectiveClosesAt: string;
    status: string;
};

/**
 * The earliest slot of one type that can still be booked at `now`: scheduled,
 * not started yet and with its booking window still open.
 */
export function findNextOpenSlot<TSlot extends BookableSlot>(
    slots: readonly TSlot[],
    type: BookableSlot['type'],
    now: number,
): TSlot | null {
    let next: TSlot | null = null;
    let nextStartAt = Number.POSITIVE_INFINITY;

    for (const slot of slots) {
        if (slot.type !== type || slot.status !== 'scheduled') {
            continue;
        }

        const startAt = new Date(slot.startAt).getTime();
        const closesAt = new Date(slot.effectiveClosesAt).getTime();
        if (Number.isNaN(startAt) || startAt <= now) {
            continue;
        }
        if (!Number.isNaN(closesAt) && closesAt <= now) {
            continue;
        }

        if (startAt < nextStartAt) {
            next = slot;
            nextStartAt = startAt;
        }
    }

    return next;
}
