import Link from 'next/link';
import { calendarMonthNames } from '../../lib/plants/calendarActivities';
import type { RegionalCalendarRow } from '../../lib/plants/regionalCalendar';
import { KnownPages } from '../../src/KnownPages';

export function RegionalCalendarTable({
    rows,
}: {
    rows: readonly RegionalCalendarRow[];
}) {
    return (
        <section
            aria-label="Kalendar po mjesecima"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll the wide month table.
            tabIndex={0}
            className="relative w-full overflow-x-auto rounded-lg border focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
            <table className="w-full min-w-[72rem] table-fixed border-collapse text-sm">
                <caption className="p-4 text-left font-semibold">
                    Moguće vrijeme uzgoja — kontinentalna Hrvatska
                </caption>
                <colgroup>
                    <col className="w-44" />
                    {calendarMonthNames.map((month) => (
                        <col key={month} />
                    ))}
                </colgroup>
                <thead>
                    <tr className="bg-muted text-left">
                        <th scope="col" className="p-3">
                            Biljka i radnja
                        </th>
                        {calendarMonthNames.map((month) => (
                            <th
                                key={month}
                                scope="col"
                                className="border-l p-2 text-center"
                            >
                                {month}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.key} className="border-t">
                            <th
                                scope="row"
                                className="p-3 text-left font-normal"
                            >
                                <Link
                                    href={KnownPages.Plant(row.slug)}
                                    className="font-semibold text-primary underline"
                                >
                                    {row.plantName}
                                </Link>
                                <span className="block font-medium">
                                    {row.label}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                    {row.environment} · {row.period}
                                </span>
                            </th>
                            {row.months.map((active, index) => (
                                <td
                                    key={calendarMonthNames[index]}
                                    className="border-l px-1 py-3 text-center"
                                >
                                    {active ? (
                                        <span
                                            className={`inline-block rounded px-2 py-1 text-black ${row.color}`}
                                        >
                                            Moguće
                                        </span>
                                    ) : (
                                        <>
                                            <span aria-hidden>—</span>
                                            <span className="sr-only">
                                                Nema preporuke
                                            </span>
                                        </>
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                    {!rows.length && (
                        <tr>
                            <td colSpan={13} className="p-6 text-center">
                                Za ovaj odabir nema pregledanih preporuka.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </section>
    );
}
