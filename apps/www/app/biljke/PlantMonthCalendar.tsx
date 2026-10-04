import { Row } from '@gredice/ui/Row';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { Fragment, type ReactNode } from 'react';
import {
    type CalendarRangeInput,
    getCalendarRangePosition,
} from './calendarRangePosition';

const plantCalendarMonths = [
    'I',
    'II',
    'III',
    'IV',
    'V',
    'VI',
    'VII',
    'VIII',
    'IX',
    'X',
    'XI',
    'XII',
];

export type PlantMonthCalendarRow = {
    color: string;
    key: string;
    label: string;
    leading?: ReactNode;
    ranges?: readonly CalendarRangeInput[];
    title?: string;
    trailing?: ReactNode;
};

export type PlantMonthCalendarProps = {
    gridClassName?: string;
    labelCellClassName?: string;
    monthCellClassName?: string;
    monthHeaderClassName?: string;
    now?: Date;
    rows: readonly PlantMonthCalendarRow[];
    showToday?: boolean;
};

export function PlantMonthCalendar({
    gridClassName = 'grid min-w-[34rem] grid-cols-[clamp(124px,32%,150px)_repeat(12,minmax(0,1fr))] rounded-lg text-sm relative',
    labelCellClassName = 'mx-2 min-w-0 overflow-hidden',
    monthCellClassName = 'relative border-l',
    monthHeaderClassName = 'min-w-0 overflow-hidden border-l py-2 text-center',
    now,
    rows,
    showToday = true,
}: PlantMonthCalendarProps) {
    if (rows.length === 0) {
        return null;
    }

    const currentDate = now ?? new Date();
    const currentMonth = currentDate.getMonth();
    const daysInCurrentMonth = new Date(
        currentDate.getFullYear(),
        currentMonth + 1,
        0,
    ).getDate();
    const currentMonthProgress = currentDate.getDate() / daysInCurrentMonth;

    return (
        <div className="w-full overflow-x-auto">
            <div className={gridClassName}>
                <div></div>
                {plantCalendarMonths.map((month) => (
                    <Typography
                        key={month}
                        level="body2"
                        center
                        className={monthHeaderClassName}
                    >
                        {month}
                    </Typography>
                ))}
                {rows.map((row) => (
                    <Fragment key={row.key}>
                        <Row
                            justifyContent="space-between"
                            spacing={2}
                            className={labelCellClassName}
                        >
                            <Row spacing={2} className="min-w-0">
                                {row.leading}
                                <Typography
                                    level="body2"
                                    title={row.title ?? row.label}
                                    className="min-w-0 truncate whitespace-nowrap"
                                >
                                    {row.label}
                                </Typography>
                            </Row>
                            {row.trailing ?? (
                                <div
                                    className={cx(
                                        'ml-2 inline-block size-4 shrink-0 rounded-full',
                                        row.color,
                                    )}
                                />
                            )}
                        </Row>
                        {plantCalendarMonths.map((monthName, index) => {
                            const month = index + 1;
                            const position = getCalendarRangePosition(
                                row.ranges,
                                month,
                            );

                            return (
                                <div
                                    key={`${row.key}-${monthName}`}
                                    className={monthCellClassName}
                                >
                                    {position && (
                                        <div
                                            className={cx(
                                                'absolute inset-y-1 -ml-[1px]',
                                                row.color,
                                                position.isStart
                                                    ? 'rounded-l-full'
                                                    : '',
                                                position.isEnd
                                                    ? 'rounded-r-full'
                                                    : '',
                                            )}
                                            style={{
                                                left: position.left,
                                                right: position.right,
                                            }}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </Fragment>
                ))}
                {showToday ? (
                    <div className="relative grid grid-cols-subgrid [grid-column:2/-1]">
                        <div
                            className="absolute bottom-0 w-0.5 bg-red-600"
                            style={{
                                top: `${-(rows.length + 1) * 20}px`,
                                left: `${((currentMonth + currentMonthProgress) / 12) * 100}%`,
                            }}
                        />
                    </div>
                ) : null}
            </div>
        </div>
    );
}
