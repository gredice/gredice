import { Alert } from '@gredice/ui/Alert';
import { Calendar, Droplets } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Spinner } from '@gredice/ui/Spinner';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import {
    buildWateringCalendarMonths,
    type WateringCalendarDay,
    type WateringCalendarEntry,
    type WateringCalendarMonth,
} from './wateringCalendarModel';

const weekDays = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];
const monthFormatter = new Intl.DateTimeFormat('hr-HR', {
    month: 'long',
    year: 'numeric',
});
const dayFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
});

function markerClassName(day: WateringCalendarDay) {
    if (day.tone === 'preview') {
        return 'border-sky-600 bg-sky-100/70 border-dashed';
    }

    if (day.tone === 'cart') {
        return 'border-sky-600 bg-sky-200/80 shadow-sm shadow-sky-300/50';
    }

    if (day.tone === 'scheduled') {
        return 'border-sky-500 bg-sky-100/70';
    }

    return 'border-sky-500 bg-sky-500/20';
}

function dayTitle(day: WateringCalendarDay) {
    if (day.entries.length === 0) {
        return dayFormatter.format(day.date);
    }

    const labels = day.entries.map((entry) => entry.label).join(', ');
    return `${dayFormatter.format(day.date)}: ${labels}`;
}

function WateringCalendarMonthView({
    month,
}: {
    month: WateringCalendarMonth;
}) {
    return (
        <section className="space-y-2" data-watering-calendar-month={month.key}>
            <Row spacing={2} className="text-slate-700 dark:text-slate-200">
                <Calendar className="size-4 shrink-0 text-sky-600" />
                <Typography level="body2" semiBold className="capitalize">
                    {monthFormatter.format(month.date)}
                </Typography>
            </Row>
            <div className="grid grid-cols-7 gap-1 text-center">
                {weekDays.map((weekDay) => (
                    <div
                        key={weekDay}
                        className="text-[0.65rem] font-semibold uppercase text-muted-foreground"
                    >
                        {weekDay}
                    </div>
                ))}
                {month.weeks.flatMap((week, weekIndex) =>
                    week.map((day, dayIndex) => (
                        <div
                            key={
                                day?.key ??
                                `${month.key}-${weekIndex}-${dayIndex}`
                            }
                            className="grid h-8 place-items-center"
                        >
                            {day ? (
                                <div
                                    className={cx(
                                        'relative grid size-8 place-items-center rounded-full text-xs tabular-nums',
                                        day.entries.length > 0 &&
                                            'font-semibold text-slate-950 dark:text-white',
                                    )}
                                    title={dayTitle(day)}
                                >
                                    {day.entries.length > 0 ? (
                                        <span
                                            aria-hidden
                                            className={cx(
                                                'absolute rounded-full border-2',
                                                markerClassName(day),
                                            )}
                                            data-watering-calendar-marker
                                            data-watering-calendar-tone={
                                                day.tone
                                            }
                                            style={{
                                                height: day.markerSize,
                                                width: day.markerSize,
                                            }}
                                        />
                                    ) : null}
                                    <span className="relative z-10">
                                        {day.dayOfMonth}
                                    </span>
                                </div>
                            ) : null}
                        </div>
                    )),
                )}
            </div>
        </section>
    );
}

export function WateringOperationsCalendar({
    className,
    entries,
    error,
    isLoading,
    referenceDate,
}: {
    className?: string;
    entries: WateringCalendarEntry[];
    error?: boolean;
    isLoading?: boolean;
    referenceDate?: Date;
}) {
    const months = buildWateringCalendarMonths(entries, referenceDate);
    const visibleMonths = [...months].reverse();

    return (
        <Stack
            spacing={3}
            className={cx(
                'rounded-lg border bg-card/80 p-3 shadow-sm',
                className,
            )}
            data-watering-calendar
        >
            <Row spacing={2} justifyContent="space-between">
                <Row spacing={2}>
                    <Droplets className="size-4 shrink-0 text-sky-600" />
                    <Typography level="body1" semiBold>
                        Kalendar zalijevanja
                    </Typography>
                </Row>
                {entries.length > 0 ? (
                    <Typography level="body3" className="text-sky-700">
                        {entries.length}
                    </Typography>
                ) : null}
            </Row>
            {error ? (
                <Alert color="danger">
                    Kalendar zalijevanja nije dostupan.
                </Alert>
            ) : null}
            {isLoading ? (
                <Row spacing={2}>
                    <Spinner loadingLabel="Učitavanje kalendara" />
                    <Typography level="body2" secondary>
                        Učitavanje...
                    </Typography>
                </Row>
            ) : null}
            {!error && !isLoading && months.length === 0 ? (
                <Typography level="body2" secondary>
                    Još nema zabilježenih zalijevanja.
                </Typography>
            ) : null}
            {months.length > 0 ? (
                <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
                    {visibleMonths.map((month) => (
                        <WateringCalendarMonthView
                            key={month.key}
                            month={month}
                        />
                    ))}
                </div>
            ) : null}
        </Stack>
    );
}
