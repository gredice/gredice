import { cx } from '@gredice/ui/utils';
import { DashboardColumnStack } from './DashboardColumnStack';

export type DashboardColumnChartSeries<TKey extends string> = {
    key: TKey;
    label: string;
    colorClassName: string;
    /** Draws the series below the baseline, for example spent amounts. */
    below?: boolean;
};

export type DashboardColumnChartColumn<TKey extends string> = {
    key: string;
    label: string;
    description: string;
    /** Leave empty for columns without data yet, such as future days. */
    values?: Record<TKey, number>;
};

function stackTotal<TKey extends string>(
    values: Record<TKey, number> | undefined,
    series: DashboardColumnChartSeries<TKey>[],
) {
    if (!values) {
        return 0;
    }

    return series.reduce(
        (total, item) => total + Math.max(0, values[item.key]),
        0,
    );
}

/**
 * Small stacked column chart for dashboard cards. The columns are a visual
 * summary only; screen readers get the same values from a hidden table.
 */
export function DashboardColumnChart<TKey extends string>({
    title,
    series,
    columns,
    formatValue,
    formatPeakLabel = formatValue,
    emptyMessage,
}: {
    title: string;
    series: DashboardColumnChartSeries<TKey>[];
    columns: DashboardColumnChartColumn<TKey>[];
    formatValue: (value: number) => string;
    /** Shorter format for the peak labels drawn above narrow columns. */
    formatPeakLabel?: (value: number) => string;
    emptyMessage: string;
}) {
    const aboveSeries = series.filter((item) => !item.below);
    const belowSeries = series.filter((item) => item.below);
    const aboveTotals = columns.map((column) =>
        stackTotal(column.values, aboveSeries),
    );
    const belowTotals = columns.map((column) =>
        stackTotal(column.values, belowSeries),
    );
    const maxAbove = Math.max(0, ...aboveTotals);
    const maxBelow = Math.max(0, ...belowTotals);
    const hasData = maxAbove + maxBelow > 0;
    const aboveShare = hasData ? maxAbove / (maxAbove + maxBelow) : 1;
    const peakAboveIndex = maxAbove > 0 ? aboveTotals.indexOf(maxAbove) : -1;
    const peakBelowIndex = maxBelow > 0 ? belowTotals.indexOf(maxBelow) : -1;
    const gridTemplateColumns = `repeat(${columns.length}, minmax(0, 1fr))`;
    const dataColumns = columns.filter((column) => column.values);

    return (
        <div className="flex flex-col gap-1">
            <div
                className={cx(
                    'relative h-32',
                    maxAbove > 0 && 'pt-4',
                    maxBelow > 0 && 'pb-4',
                )}
            >
                <div aria-hidden className="relative h-full">
                    <div
                        className="absolute inset-x-0 h-px bg-border"
                        style={{ top: `${aboveShare * 100}%` }}
                    />
                    <div
                        className="relative grid h-full gap-1"
                        style={{ gridTemplateColumns }}
                    >
                        {columns.map((column, index) => {
                            const values = column.values;
                            const aboveTotal = aboveTotals[index] ?? 0;
                            const belowTotal = belowTotals[index] ?? 0;
                            const aboveHeight =
                                maxAbove > 0
                                    ? (aboveTotal / maxAbove) * 100
                                    : 0;
                            const belowHeight =
                                maxBelow > 0
                                    ? (belowTotal / maxBelow) * 100
                                    : 0;

                            return (
                                <div
                                    key={column.key}
                                    className={cx(
                                        'group relative flex h-full flex-col rounded-sm',
                                        values && 'hover:bg-accent',
                                    )}
                                >
                                    <div
                                        className="relative flex flex-col items-center justify-end"
                                        style={{
                                            height: `${aboveShare * 100}%`,
                                        }}
                                    >
                                        {values && index === peakAboveIndex ? (
                                            <span
                                                className="absolute inset-x-0 mb-0.5 truncate text-center text-[10px] leading-3 text-muted-foreground"
                                                style={{
                                                    bottom: `${aboveHeight}%`,
                                                }}
                                            >
                                                {formatPeakLabel(aboveTotal)}
                                            </span>
                                        ) : null}
                                        {values ? (
                                            <DashboardColumnStack
                                                direction="up"
                                                heightPercent={aboveHeight}
                                                segments={aboveSeries.map(
                                                    (item) => ({
                                                        key: item.key,
                                                        value: values[item.key],
                                                        colorClassName:
                                                            item.colorClassName,
                                                    }),
                                                )}
                                            />
                                        ) : null}
                                    </div>
                                    <div
                                        className="relative flex flex-col items-center justify-start"
                                        style={{
                                            height: `${(1 - aboveShare) * 100}%`,
                                        }}
                                    >
                                        {values ? (
                                            <DashboardColumnStack
                                                direction="down"
                                                heightPercent={belowHeight}
                                                segments={belowSeries.map(
                                                    (item) => ({
                                                        key: item.key,
                                                        value: values[item.key],
                                                        colorClassName:
                                                            item.colorClassName,
                                                    }),
                                                )}
                                            />
                                        ) : null}
                                        {values && index === peakBelowIndex ? (
                                            <span
                                                className="absolute inset-x-0 mt-0.5 truncate text-center text-[10px] leading-3 text-muted-foreground"
                                                style={{
                                                    top: `${belowHeight}%`,
                                                }}
                                            >
                                                {formatPeakLabel(belowTotal)}
                                            </span>
                                        ) : null}
                                    </div>
                                    {values ? (
                                        <div
                                            className={cx(
                                                'pointer-events-none absolute bottom-full z-10 mb-1 hidden min-w-max flex-col gap-0.5 rounded-md border bg-popover px-2 py-1.5 text-xs text-popover-foreground shadow-md group-hover:flex',
                                                index === 0
                                                    ? 'left-0'
                                                    : index ===
                                                        columns.length - 1
                                                      ? 'right-0'
                                                      : 'left-1/2 -translate-x-1/2',
                                            )}
                                        >
                                            <span className="font-medium text-foreground">
                                                {column.description}
                                            </span>
                                            {series.map((item) => (
                                                <span
                                                    key={item.key}
                                                    className="flex items-center gap-1.5"
                                                >
                                                    <span
                                                        className={cx(
                                                            'size-2 shrink-0 rounded-xs',
                                                            item.colorClassName,
                                                        )}
                                                    />
                                                    {item.label}
                                                    <span className="ml-auto pl-3 font-medium text-foreground tabular-nums">
                                                        {formatValue(
                                                            values[item.key],
                                                        )}
                                                    </span>
                                                </span>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </div>
                {!hasData ? (
                    <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-muted-foreground">
                        {emptyMessage}
                    </p>
                ) : null}
            </div>
            <div
                aria-hidden
                className="grid gap-1 text-center text-xs text-muted-foreground"
                style={{ gridTemplateColumns }}
            >
                {columns.map((column) => (
                    <span key={column.key} className="truncate">
                        {column.label}
                    </span>
                ))}
            </div>
            {hasData ? (
                // Tables ignore the 1px sr-only width, so the wrapper hides it.
                <div className="sr-only">
                    <table>
                        <caption>{title}</caption>
                        <thead>
                            <tr>
                                <th scope="col">Dan</th>
                                {series.map((item) => (
                                    <th key={item.key} scope="col">
                                        {item.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {dataColumns.map((column) => (
                                <tr key={column.key}>
                                    <th scope="row">{column.description}</th>
                                    {series.map((item) => (
                                        <td key={item.key}>
                                            {formatValue(
                                                column.values?.[item.key] ?? 0,
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </div>
    );
}
