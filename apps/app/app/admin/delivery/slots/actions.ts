'use server';

import {
    archiveTimeSlot,
    closeTimeSlot,
    createTimeSlot,
    getTimeSlot,
    TimeSlotStatuses,
    updateTimeSlot,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../../../lib/auth/auth';

const DEFAULT_TIME_ZONE = 'Europe/Zagreb';
const SLOT_DURATION_MS = 2 * 60 * 60 * 1000;
const SLOT_DURATION_MINUTES = 120;

type DateInputParts = {
    year: number;
    month: number;
    day: number;
};

function getStringValue(formData: FormData, key: string) {
    const value = formData.get(key);

    return typeof value === 'string' ? value : '';
}

function getTimeZone(formData: FormData) {
    const timeZone = getStringValue(formData, 'timeZone');

    try {
        Intl.DateTimeFormat(undefined, {
            timeZone: timeZone || DEFAULT_TIME_ZONE,
        }).format(new Date());
        return timeZone || DEFAULT_TIME_ZONE;
    } catch {
        return DEFAULT_TIME_ZONE;
    }
}

function parseDateInput(dateString: string): DateInputParts {
    const [year, month, day] = dateString.split('-').map(Number);

    if (
        !year ||
        !month ||
        !day ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31
    ) {
        throw new Error('Unesite ispravan datum');
    }

    return { year, month, day };
}

function parseTimeInput(timeString: string) {
    const [hours, minutes = 0] = timeString.split(':').map(Number);

    if (
        Number.isNaN(hours) ||
        Number.isNaN(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        throw new Error('Unesite ispravno vrijeme');
    }

    return { hours, minutes };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).formatToParts(date);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    const year = Number(values.get('year'));
    const month = Number(values.get('month'));
    const day = Number(values.get('day'));
    const hour = Number(values.get('hour'));
    const minute = Number(values.get('minute'));
    const second = Number(values.get('second'));

    return (
        Date.UTC(year, month - 1, day, hour, minute, second) - date.getTime()
    );
}

function zonedDateTimeToUtc(
    dateParts: DateInputParts,
    timeString: string,
    timeZone: string,
) {
    const { hours, minutes } = parseTimeInput(timeString);
    const utcGuess = new Date(
        Date.UTC(
            dateParts.year,
            dateParts.month - 1,
            dateParts.day,
            hours,
            minutes,
            0,
            0,
        ),
    );
    const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
    const adjusted = new Date(utcGuess.getTime() - offset);
    const adjustedOffset = getTimeZoneOffsetMs(adjusted, timeZone);

    if (adjustedOffset !== offset) {
        return new Date(utcGuess.getTime() - adjustedOffset);
    }

    return adjusted;
}

function getCalendarDay(dateParts: DateInputParts) {
    return new Date(
        Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day),
    ).getUTCDay();
}

function addDays(dateParts: DateInputParts, days: number): DateInputParts {
    const date = new Date(
        Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day),
    );
    date.setUTCDate(date.getUTCDate() + days);

    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
    };
}

function getDateInputTime(dateParts: DateInputParts) {
    return Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day);
}

export async function createTimeSlotAction(
    _prevState: unknown,
    formData: FormData,
) {
    try {
        await auth(['admin']);

        const locationId = parseInt(formData.get('locationId') as string, 10);
        const type = formData.get('type') as 'delivery' | 'pickup';
        const startDate = parseDateInput(getStringValue(formData, 'startDate'));
        const startTime = getStringValue(formData, 'startTime');
        const timeZone = getTimeZone(formData);
        const startAt = zonedDateTimeToUtc(startDate, startTime, timeZone);
        const endAt = new Date(startAt.getTime() + SLOT_DURATION_MS);

        await createTimeSlot({
            locationId,
            type,
            startAt,
            endAt,
            status: TimeSlotStatuses.SCHEDULED,
        });

        revalidatePath('/admin/delivery/slots');
        return { success: true, message: 'Slot je uspješno kreiran' };
    } catch (error) {
        console.error('Failed to create time slot:', error);
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Greška pri kreiranju slota',
        };
    }
}

export async function bulkGenerateSlotsAction(
    _prevState: unknown,
    formData: FormData,
) {
    try {
        await auth(['admin']);

        const locationId = parseInt(formData.get('locationId') as string, 10);
        const type = formData.get('type') as 'delivery' | 'pickup';
        const startDate = parseDateInput(getStringValue(formData, 'startDate'));
        const endDate = parseDateInput(getStringValue(formData, 'endDate'));
        const startTime = getStringValue(formData, 'startTime');
        const endTime = getStringValue(formData, 'endTime');
        const timeZone = getTimeZone(formData);
        const daysOfWeek = formData
            .getAll('daysOfWeek')
            .map((day) => parseInt(day as string, 10));
        const startDateTime = getDateInputTime(startDate);
        const endDateTime = getDateInputTime(endDate);

        // Validate required fields and date validity
        if (
            !locationId ||
            !type ||
            Number.isNaN(startDateTime) ||
            Number.isNaN(endDateTime) ||
            !startTime ||
            !endTime ||
            daysOfWeek.length === 0
        ) {
            return {
                success: false,
                message:
                    'Molimo popunite sva obavezna polja ili unesite ispravne datume',
            };
        }

        // Validate date range
        if (endDateTime < startDateTime) {
            return {
                success: false,
                message: 'Datum završetka mora biti nakon datuma početka',
            };
        }

        // Generate time windows based on start time, end time, and slot duration
        const windows: string[] = [];
        const { hours: startHours, minutes: startMinutes } =
            parseTimeInput(startTime);
        const { hours: endHours, minutes: endMinutes } =
            parseTimeInput(endTime);

        const startTotalMinutes = startHours * 60 + startMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;

        for (
            let minutes = startTotalMinutes;
            minutes + SLOT_DURATION_MINUTES <= endTotalMinutes;
            minutes += SLOT_DURATION_MINUTES
        ) {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            windows.push(
                `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`,
            );
        }

        if (windows.length === 0) {
            return {
                success: false,
                message:
                    'Nema dostupnih slotova za generiranje s odabranim parametrima',
            };
        }

        // Calculate total days between start and end date
        const timeDiff = endDateTime - startDateTime;
        const totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include the end date

        // Filter dates by selected days of week and generate slots
        let created = 0;
        let skippedExisting = 0;

        for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
            const currentDate = addDays(startDate, dayOffset);

            // Check if this day of week is selected (0 = Sunday, 1 = Monday, etc.)
            const dayOfWeek = getCalendarDay(currentDate);
            if (!daysOfWeek.includes(dayOfWeek)) {
                continue;
            }

            for (const window of windows) {
                const startAt = zonedDateTimeToUtc(
                    currentDate,
                    window,
                    timeZone,
                );
                const endAt = new Date(startAt.getTime() + SLOT_DURATION_MS);

                try {
                    await createTimeSlot({
                        locationId,
                        type,
                        startAt,
                        endAt,
                        status: TimeSlotStatuses.SCHEDULED,
                    });
                    created++;
                } catch (error) {
                    if (
                        error instanceof Error &&
                        error.message.includes('already exists')
                    ) {
                        skippedExisting++;
                    } else {
                        throw error;
                    }
                }
            }
        }

        revalidatePath('/admin/delivery/slots');
        return {
            success: true,
            message: `Kreirano ${created} slotova, preskočeno ${skippedExisting} postojećih slotova`,
        };
    } catch (error) {
        console.error('Failed to bulk generate slots:', error);
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Greška pri kreiranju slotova',
        };
    }
}

export async function closeTimeSlotAction(slotId: number) {
    try {
        await auth(['admin']);
        await closeTimeSlot(slotId);
        revalidatePath('/admin/delivery/slots');
        return { success: true, message: 'Slot je uspješno zatvoren' };
    } catch (error) {
        console.error('Failed to close slot:', error);
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Greška pri zatvaranju slota',
        };
    }
}

export async function archiveTimeSlotAction(slotId: number) {
    try {
        await auth(['admin']);
        await archiveTimeSlot(slotId);
        revalidatePath('/admin/delivery/slots');
        return { success: true, message: 'Slot je uspješno arhiviran' };
    } catch (error) {
        console.error('Failed to archive slot:', error);
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Greška pri arhiviranju slota',
        };
    }
}

export async function archiveClosedTimeSlotsAction(slotIds: number[]) {
    try {
        await auth(['admin']);

        if (slotIds.length === 0) {
            return {
                success: false,
                message: 'Nema zatvorenih slotova za arhiviranje',
            };
        }

        const now = new Date();
        const eligibleSlotIds: number[] = [];

        await Promise.all(
            slotIds.map(async (slotId) => {
                const slot = await getTimeSlot(slotId);
                if (
                    slot &&
                    slot.status === TimeSlotStatuses.CLOSED &&
                    new Date(slot.endAt) < now
                ) {
                    eligibleSlotIds.push(slotId);
                }
            }),
        );

        if (eligibleSlotIds.length === 0) {
            return {
                success: false,
                message: 'Nema zatvorenih slotova koji se mogu arhivirati',
            };
        }

        await Promise.all(
            eligibleSlotIds.map(async (slotId) => {
                await archiveTimeSlot(slotId);
            }),
        );

        revalidatePath('/admin/delivery/slots');
        return {
            success: true,
            message: `Arhivirano ${eligibleSlotIds.length} zatvorenih slotova`,
        };
    } catch (error) {
        console.error('Failed to archive closed slots:', error);
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Greška pri arhiviranju zatvorenih slotova',
        };
    }
}

export async function updateTimeSlotStatusAction(
    slotId: number,
    status: string,
) {
    try {
        await auth(['admin']);
        await updateTimeSlot({ id: slotId, status });
        revalidatePath('/admin/delivery/slots');
        return { success: true, message: 'Status slota je uspješno ažuriran' };
    } catch (error) {
        console.error('Failed to update slot status:', error);
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Greška pri ažuriranju statusa slota',
        };
    }
}
