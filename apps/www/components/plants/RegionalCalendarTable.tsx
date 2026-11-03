import { GameCalendarIcon } from '@gredice/ui/GameIcons';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { cx } from '@gredice/ui/utils';
import Link from 'next/link';
import { getCalendarRangePosition } from '../../app/biljke/calendarRangePosition';
import {
    calendarActivities,
    calendarActivityKeys,
    calendarMonthNames,
    calendarMonthShortNames,
} from '../../lib/plants/calendarActivities';
import type { RegionalCalendarCrop } from '../../lib/plants/regionalCalendar';
import { KnownPages } from '../../src/KnownPages';
import { RegionalCalendarStatusChip } from './RegionalCalendarStatusChip';

export function RegionalCalendarLegend() {
    return (
        <ul
            aria-label="Legenda kalendara"
            className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground"
        >
            {calendarActivityKeys.map((key) => (
                <li key={key} className="flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className={cx(
                            'h-2.5 w-5 rounded-full',
                            calendarActivities[key].color,
                        )}
                    />
                    {calendarActivities[key].name}
                </li>
            ))}
            <li className="flex items-center gap-1.5">
                <span
                    aria-hidden
                    className="h-2.5 w-5 rounded-full border border-dashed border-muted-foreground/60"
                />
                Termin nije naveden
            </li>
        </ul>
    );
}

export function RegionalCalendarTable({
    crops,
    currentMonth,
    selectedMonth,
}: {
    crops: readonly RegionalCalendarCrop[];
    currentMonth: number;
    selectedMonth?: number;
}) {
    const visibleCrops = crops.filter((crop) => crop.rows.length > 0);

    return (
        <section
            aria-label="Kalendar po mjesecima"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll the wide month table.
            tabIndex={0}
            className="relative isolate w-full overflow-x-auto rounded-xl border bg-card shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
            <table className="w-full min-w-[44rem] table-fixed sm:min-w-[52rem] border-collapse text-sm">
                <caption className="sr-only">
                    Moguće vrijeme uzgoja — kontinentalna Hrvatska
                </caption>
                <colgroup>
                    <col className="w-36 sm:w-52" />
                    {calendarMonthNames.map((month) => (
                        <col key={month} />
                    ))}
                </colgroup>
                <thead>
                    <tr className="border-b">
                        <th
                            scope="col"
                            className="sticky left-0 z-20 bg-card px-3 py-3 text-left sm:px-4 text-xs font-medium text-muted-foreground"
                        >
                            Biljka i radnja
                        </th>
                        {calendarMonthNames.map((month, index) => {
                            const isCurrent = index + 1 === currentMonth;
                            return (
                                <th
                                    key={month}
                                    scope="col"
                                    aria-current={
                                        isCurrent ? 'date' : undefined
                                    }
                                    title={month}
                                    className={cx(
                                        'px-0.5 py-3 text-center text-xs font-medium text-muted-foreground',
                                        index + 1 === selectedMonth &&
                                            'bg-primary/5',
                                    )}
                                >
                                    <span
                                        aria-hidden
                                        className={cx(
                                            'inline-block min-w-9 rounded-full px-1.5 py-0.5',
                                            isCurrent &&
                                                'bg-primary text-primary-foreground',
                                        )}
                                    >
                                        {calendarMonthShortNames[index]}
                                    </span>
                                    <span className="sr-only">{month}</span>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                {visibleCrops.map((crop) => (
                    <tbody
                        key={crop.plantId}
                        className="border-b last:border-b-0"
                    >
                        <tr>
                            <td
                                colSpan={13}
                                className="bg-muted/50 px-3 py-2 sm:px-4"
                            >
                                <div className="sticky left-3 flex w-fit sm:left-4 items-center gap-2.5">
                                    <PlantOrSortImage
                                        plant={{
                                            image: crop.image,
                                            information: { name: crop.name },
                                        }}
                                        alt=""
                                        width={28}
                                        height={28}
                                        className="size-7"
                                    />
                                    <Link
                                        href={KnownPages.Plant(crop.slug)}
                                        className="font-semibold hover:underline"
                                    >
                                        {crop.name}
                                    </Link>
                                    <RegionalCalendarStatusChip
                                        status={crop.status}
                                    />
                                </div>
                            </td>
                        </tr>
                        {crop.rows.map((row) => (
                            <tr
                                key={row.key}
                                className="border-t border-border/60"
                            >
                                <th
                                    scope="row"
                                    className="sticky left-0 z-10 bg-card px-3 py-2.5 text-left sm:px-4 align-middle font-normal"
                                >
                                    <span className="flex items-center gap-2">
                                        <span
                                            aria-hidden
                                            className={cx(
                                                'size-2.5 shrink-0 rounded-full',
                                                row.color,
                                            )}
                                        />
                                        <span className="font-medium leading-tight">
                                            <span className="sr-only">
                                                {row.plantName},{' '}
                                            </span>
                                            {row.label}
                                        </span>
                                    </span>
                                    {row.ranges.length > 0 && (
                                        <span className="mt-0.5 block pl-4.5 text-xs text-muted-foreground">
                                            {row.environment}
                                            <span className="hidden sm:inline">
                                                {' '}
                                                · {row.period}
                                            </span>
                                        </span>
                                    )}
                                </th>
                                {row.ranges.length > 0 ? (
                                    calendarMonthNames.map((month, index) => {
                                        const position =
                                            getCalendarRangePosition(
                                                row.ranges,
                                                index + 1,
                                            );
                                        return (
                                            <td
                                                key={month}
                                                className={cx(
                                                    'relative h-12 border-l border-border/40 p-0',
                                                    index + 1 ===
                                                        selectedMonth &&
                                                        'bg-primary/5',
                                                )}
                                            >
                                                {position && (
                                                    <span
                                                        aria-hidden
                                                        className={cx(
                                                            'absolute top-1/2 -ml-px h-4 -translate-y-1/2',
                                                            row.color,
                                                            position.isStart &&
                                                                'rounded-l-full',
                                                            position.isEnd &&
                                                                'rounded-r-full',
                                                        )}
                                                        style={{
                                                            left: position.left,
                                                            right: position.right,
                                                        }}
                                                    />
                                                )}
                                                <span className="sr-only">
                                                    {position
                                                        ? 'Moguće'
                                                        : 'Nema preporuke'}
                                                </span>
                                            </td>
                                        );
                                    })
                                ) : (
                                    <td colSpan={12} className="px-2 py-2.5">
                                        <span className="flex h-6 items-center justify-start rounded-full border border-dashed px-3 sm:justify-center border-muted-foreground/40 text-xs text-muted-foreground">
                                            {crop.status === 'reviewed'
                                                ? 'Nema preporuke u ovom kalendaru'
                                                : 'Termin čeka provjeru uzgajivača'}
                                        </span>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                ))}
                {visibleCrops.length === 0 && (
                    <tbody>
                        <tr>
                            <td colSpan={13} className="px-4 py-12">
                                <span className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                                    <GameCalendarIcon
                                        aria-hidden
                                        className="size-10"
                                    />
                                    Za ovaj odabir nema pregledanih preporuka.
                                </span>
                            </td>
                        </tr>
                    </tbody>
                )}
            </table>
        </section>
    );
}
