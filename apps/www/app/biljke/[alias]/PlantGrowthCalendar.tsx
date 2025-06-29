import { PlantData } from "@gredice/client";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { CSSProperties, Fragment } from "react";

const plantCalendarMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
type GrowthCalendarWindowItem = {
    name: 'germination' | 'growth' | 'harvest',
    label: string,
    color: string,
    border: string,
    chipColor: string
};
const growthCalendarWindows: GrowthCalendarWindowItem[] = [
    {
        name: 'germination',
        label: 'Klijanje',
        color: 'bg-yellow-400',
        border: 'border-yellow-500',
        chipColor: 'bg-yellow-200'
    },
    {
        name: 'growth',
        label: 'Rast',
        color: 'bg-blue-400',
        border: 'border-blue-500',
        chipColor: 'bg-blue-200'
    },
    {
        name: 'harvest',
        label: 'Branje',
        color: 'bg-lime-400',
        border: 'border-lime-500',
        chipColor: 'bg-lime-200'
    }
];
type GrowthWindowValueNames = keyof Pick<PlantData['attributes'], 'germinationWindowMin' | 'germinationWindowMax' | 'growthWindowMin' | 'growthWindowMax' | 'harvestWindowMin' | 'harvestWindowMax'>;
export type PlantYearCalendarProps = {
    windows: Pick<PlantData['attributes'], GrowthWindowValueNames>,
    now?: Date
}

export function PlantGrowthCalendar({ windows, now }: PlantYearCalendarProps) {
    const currentDate = now ?? new Date();
    const currentMonth = currentDate.getMonth() // 0-indexed
    const currentMonthProgress = currentDate.getDate() / new Date(currentDate.getFullYear(), currentMonth, 0).getDate();
    let lastWindowEndMin = 0;
    let windowsMinMaxDiffs = 0;
    return (
        <div className="grid grid-cols-[130px_repeat(12,1fr)] text-sm rounded-lg overflow-x-auto relative">
            <div></div>
            {plantCalendarMonths.map((month, monthIndex) => (
                <Typography level="body2" center key={monthIndex} className="py-2 text-center min-w-8 border-l">
                    {month}
                </Typography>
            ))}
            {growthCalendarWindows.map((window) => {
                if (!Object.keys(windows).some(a => a === window.name + "WindowMin"))
                    return null;

                const windowMin = windows[`${window.name}WindowMin`];
                const windowMax = windows[`${window.name}WindowMax`];
                const windowStartDate = new Date();
                windowStartDate.setDate(windowStartDate.getDate() + lastWindowEndMin);
                const windowEndDate = new Date(windowStartDate);
                windowEndDate.setDate(windowEndDate.getDate() + windowMax + windowsMinMaxDiffs);
                lastWindowEndMin += windowMin;
                windowsMinMaxDiffs += windowMax - windowMin;

                return (
                    <Fragment key={window.name}>
                        <Row justifyContent="space-between" spacing={1} className="mx-2">
                            <Typography level="body2">
                                {window.label}
                            </Typography>
                            <div className={`text-xs px-1 text-black rounded-full inline-block ml-2 border ${window.border} ${window.chipColor}`}>
                                {windowMin}-{windowMax}d
                            </div>
                        </Row>
                        {plantCalendarMonths.map((_, index) => {
                            const month = index;
                            const minStart = windowStartDate.getMonth() > month ? 0 : windowStartDate.getDate() / 30;
                            const maxEnd = windowEndDate.getMonth() > month ? 1 : windowEndDate.getDate() / 30;
                            const isActivityStart = month === Math.floor(windowStartDate.getMonth());
                            const isActivityEnd = month === Math.floor(windowEndDate.getMonth());
                            const isActivityActive = month >= Math.floor(windowStartDate.getMonth()) && month <= Math.floor(windowEndDate.getMonth());

                            return (
                                <div key={index} className="relative border-l">
                                    {isActivityActive && (
                                        <div
                                            className={`absolute inset-y-1 left-[--activity-left] -ml-[1px] right-[--activity-right] ${window.color} ${isActivityStart ? 'rounded-l-full' : ''} ${isActivityEnd ? 'rounded-r-full' : ''}`}
                                            style={{
                                                '--activity-left': isActivityStart ? `${(minStart) * 100}%` : '0px',
                                                '--activity-right': isActivityEnd ? `${Math.min(75, (1 - maxEnd) * 100)}%` : '0px'
                                            } as CSSProperties}
                                        ></div>
                                    )}
                                </div>
                            );
                        })}
                    </Fragment>
                );
            })}
            <div className="grid grid-cols-subgrid [grid-column:2/-1] relative">
                <div
                    className="absolute bottom-0 w-0.5 bg-red-600"
                    style={{
                        top: `${-(Object.keys(growthCalendarWindows).length + 1) * 20}px`,
                        left: `${((currentMonth + currentMonthProgress) / 12) * 100}%`
                    }}
                />
            </div>
        </div>
    )
}