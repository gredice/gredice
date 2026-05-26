import { cx } from '@gredice/ui/utils';

function formatScheduledSowingDateLabel(
    date: Date,
    referenceDate: Date,
): string {
    const day = date.getDate();
    const sameMonthAndYear =
        date.getFullYear() === referenceDate.getFullYear() &&
        date.getMonth() === referenceDate.getMonth();

    if (sameMonthAndYear) {
        return day.toString();
    }

    return `${day}.${date.getMonth() + 1}.`;
}

export function parseScheduledSowingDateValue(
    value: Date | string | null | undefined,
) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function ScheduledSowingDateBadge({
    className,
    date,
    referenceDate = new Date(),
}: {
    className?: string;
    date: Date;
    referenceDate?: Date;
}) {
    const dateLabel = formatScheduledSowingDateLabel(date, referenceDate);
    const fullDateLabel = date.toLocaleDateString('hr-HR');

    return (
        <div
            aria-label={`Zakazano za ${fullDateLabel}`}
            className={cx('absolute left-0.5 bottom-0.5', className)}
            data-scheduled-sowing-badge
            role="img"
            title={`Zakazano za ${fullDateLabel}`}
        >
            <div className="relative size-6 overflow-hidden rounded-lg border-2 border-stone-400 bg-stone-200 text-stone-800 shadow-lg">
                <div className="absolute inset-x-0 top-0 h-1.5 bg-stone-400" />
                <span className="absolute inset-0 flex items-center justify-center pt-1.5 text-[9px] font-semibold leading-none">
                    {dateLabel}
                </span>
            </div>
        </div>
    );
}
