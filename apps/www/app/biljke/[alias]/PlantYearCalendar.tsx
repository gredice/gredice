import type { PlantData } from '@gredice/client';
import { Row } from '@gredice/ui/Row';
import { Typography } from '@gredice/ui/Typography';
import { Fragment } from 'react';
import { getCalendarRangePosition } from '../calendarRangePosition';

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

const calendarActivityTypes = {
    propagating: {
        name: 'Sijanje unutra',
        color: 'bg-blue-400',
    },
    sowing: {
        name: 'Sijanje vani',
        color: 'bg-yellow-400',
    },
    planting: {
        name: 'Presađivanje',
        color: 'bg-amber-600',
    },
    harvest: {
        name: 'Berba',
        color: 'bg-lime-400',
    },
} as const;

export type PlantYearCalendarProps = {
    activities: PlantData['calendar'];
    now?: Date;
};

export function PlantYearCalendar({ activities, now }: PlantYearCalendarProps) {
    const currentDate = now ?? new Date();
    const currentMonth = currentDate.getMonth(); // 0-indexed
    const currentMonthProgress =
        currentDate.getDate() /
        new Date(currentDate.getFullYear(), currentMonth, 0).getDate();

    return (
        <div className="w-full overflow-x-auto">
            <div className="grid min-w-[34rem] grid-cols-[clamp(124px,32%,150px)_repeat(12,minmax(0,1fr))] rounded-lg text-sm relative">
                <div></div>
                {plantCalendarMonths.map((month) => (
                    <Typography
                        key={month}
                        level="body2"
                        center
                        className="min-w-0 overflow-hidden border-l py-2 text-center"
                    >
                        {month}
                    </Typography>
                ))}
                {Object.entries(calendarActivityTypes).map(
                    ([activityTypeName, activityType]) => {
                        if (
                            !Object.keys(activities).some(
                                (a) => a === activityTypeName,
                            )
                        )
                            return null;

                        return (
                            <Fragment key={activityTypeName}>
                                <Row
                                    justifyContent="space-between"
                                    spacing={2}
                                    className="mx-2 min-w-0 overflow-hidden"
                                >
                                    <Typography
                                        level="body2"
                                        title={activityType.name}
                                        className="min-w-0 truncate whitespace-nowrap"
                                    >
                                        {activityType.name}
                                    </Typography>
                                    <div
                                        className={`size-4 rounded-full inline-block ml-2 ${activityType.color}`}
                                    ></div>
                                </Row>
                                {plantCalendarMonths.map((monthName, index) => {
                                    const month = index + 1;
                                    const currentActivities =
                                        activities[
                                            activityTypeName as keyof typeof calendarActivityTypes
                                        ];
                                    const position = getCalendarRangePosition(
                                        currentActivities,
                                        month,
                                    );

                                    return (
                                        <div
                                            key={monthName}
                                            className="relative border-l"
                                        >
                                            {position && (
                                                <div
                                                    className={`absolute inset-y-1 -ml-[1px] ${activityType.color} ${position.isStart ? 'rounded-l-full' : ''} ${position.isEnd ? 'rounded-r-full' : ''}`}
                                                    style={{
                                                        left: position.left,
                                                        right: position.right,
                                                    }}
                                                ></div>
                                            )}
                                        </div>
                                    );
                                })}
                            </Fragment>
                        );
                    },
                )}
                <div className="grid grid-cols-subgrid [grid-column:2/-1] relative">
                    <div
                        className="absolute bottom-0 w-0.5 bg-red-600"
                        style={{
                            top: `${-(Object.keys(calendarActivityTypes).length + 1) * 20}px`,
                            left: `${((currentMonth + currentMonthProgress) / 12) * 100}%`,
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
