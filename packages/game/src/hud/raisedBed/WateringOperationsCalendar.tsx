'use client';

import {
    EventCalendar,
    type EventCalendarEntry,
} from '@gredice/ui/EventCalendar';
import { OperationCategoryIcon } from '@gredice/ui/OperationImage';
import {
    toWateringEventCalendarEntry,
    type WateringCalendarEntry,
} from './wateringCalendarModel';

const sourceLabels = {
    cart: 'U košari',
    completed: 'Obavljeno',
    preview: 'Novi termin',
    scheduled: 'Zakazano',
} satisfies Record<WateringCalendarEntry['source'], string>;

function entryMeta(entry: WateringCalendarEntry) {
    return sourceLabels[entry.source];
}

function toEventCalendarEntry(
    entry: WateringCalendarEntry,
    referenceDate: Date,
): EventCalendarEntry {
    const calendarEntry = toWateringEventCalendarEntry(entry, referenceDate);

    return {
        ...calendarEntry,
        meta: entryMeta(entry),
        visual: (
            <OperationCategoryIcon
                categoryName="watering"
                className="size-4 shrink-0"
            />
        ),
    };
}

export function WateringOperationsCalendar({
    className,
    entries,
    error,
    isLoading,
    maxSelectableDate,
    minSelectableDate,
    onDateSelect,
    referenceDate,
    selectedDate,
    visibleFrom,
    visibleTo,
}: {
    className?: string;
    entries: WateringCalendarEntry[];
    error?: boolean;
    isLoading?: boolean;
    maxSelectableDate?: Date;
    minSelectableDate?: Date;
    onDateSelect?: (date: Date) => void;
    referenceDate?: Date;
    selectedDate?: Date | null;
    visibleFrom?: Date;
    visibleTo?: Date;
}) {
    const resolvedReferenceDate = referenceDate ?? new Date();

    return (
        <EventCalendar
            accent="blue"
            className={className}
            data-watering-calendar
            emptyLabel="Još nema zabilježenih zalijevanja."
            entries={entries.map((entry) =>
                toEventCalendarEntry(entry, resolvedReferenceDate),
            )}
            error={error}
            errorLabel="Kalendar zalijevanja nije dostupan."
            isLoading={isLoading}
            maxSelectableDate={maxSelectableDate}
            minSelectableDate={minSelectableDate}
            onDateSelect={onDateSelect}
            referenceDate={resolvedReferenceDate}
            selectedDate={selectedDate}
            visibleFrom={visibleFrom}
            visibleTo={visibleTo}
        />
    );
}
