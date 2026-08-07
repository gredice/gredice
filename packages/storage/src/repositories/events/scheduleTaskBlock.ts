export const scheduleTaskBlockReasons = {
    unsafe_conditions: 'Vrijeme ili uvjeti nisu sigurni',
    missing_materials: 'Nedostaje materijal ili oprema',
    location_not_ready: 'Biljka, gredica ili lokacija nije spremna',
    location_inaccessible: 'Ne mogu pristupiti lokaciji',
    task_not_applicable: 'Zadatak ili upute nisu primjenjivi',
    other: 'Drugi razlog',
} as const;

export type ScheduleTaskBlockReasonCode = keyof typeof scheduleTaskBlockReasons;
export type ScheduleTaskBlockReasonLabel =
    (typeof scheduleTaskBlockReasons)[ScheduleTaskBlockReasonCode];

export type ScheduleTaskBlockPayload = {
    blockedBy: string;
    reasonCode: ScheduleTaskBlockReasonCode;
    reasonLabel: ScheduleTaskBlockReasonLabel;
    note?: string;
    images?: string[];
};

export type ScheduleTaskBlockDetails = ScheduleTaskBlockPayload & {
    eventId: number;
    blockedAt: Date;
};

export function getScheduleTaskBlockReason(code: ScheduleTaskBlockReasonCode) {
    return {
        code,
        label: scheduleTaskBlockReasons[code],
    };
}

export function isScheduleTaskBlockReasonCode(
    value: unknown,
): value is ScheduleTaskBlockReasonCode {
    return (
        typeof value === 'string' &&
        Object.hasOwn(scheduleTaskBlockReasons, value)
    );
}

export function scheduleTaskBlockDetailsFromEvent(event: {
    id: number;
    createdAt: Date;
    data: unknown;
}): ScheduleTaskBlockDetails | null {
    if (!event.data || typeof event.data !== 'object') {
        return null;
    }

    const data = event.data as Record<string, unknown>;
    if (
        typeof data.blockedBy !== 'string' ||
        !isScheduleTaskBlockReasonCode(data.reasonCode)
    ) {
        return null;
    }

    const reasonLabel = scheduleTaskBlockReasons[data.reasonCode];
    const note = typeof data.note === 'string' ? data.note : undefined;
    const images = Array.isArray(data.images)
        ? data.images.filter(
              (value): value is string => typeof value === 'string',
          )
        : undefined;

    return {
        blockedBy: data.blockedBy,
        reasonCode: data.reasonCode,
        // Labels are resolved from the controlled code. The persisted label is
        // a historical snapshot, but arbitrary event data cannot change UI copy.
        reasonLabel,
        ...(note ? { note } : {}),
        ...(images ? { images } : {}),
        eventId: event.id,
        blockedAt: event.createdAt,
    };
}
