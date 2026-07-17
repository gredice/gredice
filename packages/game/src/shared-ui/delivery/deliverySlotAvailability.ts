interface DeliverySlotAvailability {
    effectiveClosesAt: Date | string;
    startAt: Date | string;
    status: string;
}

export function isDeliverySlotAvailable(
    slot: DeliverySlotAvailability,
    referenceDate: Date | string,
) {
    const referenceTime = new Date(referenceDate).getTime();

    return (
        slot.status === 'scheduled' &&
        new Date(slot.startAt).getTime() > referenceTime &&
        new Date(slot.effectiveClosesAt).getTime() > referenceTime
    );
}
