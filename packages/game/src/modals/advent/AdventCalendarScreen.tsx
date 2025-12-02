'use client';

import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { SantaCapIcon } from '../../icons/SantaCap';
import { AdventDayCell, getDayVariant } from './AdventDayCell';
import { adventTitleFont } from './fonts';

type AdventDay = {
    day: number;
    opened: boolean;
};

type DayClickType = 'canOpen' | 'opened' | 'missed' | 'future';

type AdventCalendarScreenProps = {
    days: AdventDay[];
    currentDay: number;
    onDayClick: (day: number, type: DayClickType) => void;
    isLoading?: boolean;
    todayOpened?: boolean;
};

// Calendar grid layout - shuffled positions for visual interest
// Day 24 spans 2 columns, so we have 23 entries + day 24 taking 2 spaces = 25 grid cells (5x5)
const calendarLayout = [
    15, 21, 3, 18, 5, 6, 22, 16, 12, 1, 9, 2, 23, 10, 14, 19, 8, 7, 17, 4, 11,
    13, 20, 24,
];

export function AdventCalendarScreen({
    days,
    currentDay,
    onDayClick,
    isLoading,
    todayOpened,
}: AdventCalendarScreenProps) {
    const dayMap = new Map(days.map((d) => [d.day, d]));

    const subtitleMessage = todayOpened
        ? 'Već sutra te čekaju novi pokloni! Do tad uživaj u svom vrtu.'
        : 'Otvori današnje polje i pripremi se za iznenađenje 🤩';

    return (
        <Stack spacing={2} className="p-4 px-8">
            {/* Header */}
            <div className="flex items-center gap-2 pr-8 md:pr-12">
                <Stack spacing={0}>
                    <Typography
                        level="h4"
                        className={`font-bold ${adventTitleFont.className}`}
                    >
                        Adventski kalendar
                    </Typography>
                    <Typography level="body2" className="text-balance">
                        {subtitleMessage}
                    </Typography>
                </Stack>
            </div>

            {/* Calendar grid */}
            <div className="bg-[#C1977C] p-3 border-4 border-[#E6CAB5] aspect-[0.625] relative">
                <div className="grid grid-cols-5 gap-0 grid-rows-[repeat(5,1fr)] h-full">
                    {calendarLayout.map((dayNum) => {
                        const dayData = dayMap.get(dayNum);
                        const isOpen = dayData?.opened ?? false;
                        const isToday = dayNum === currentDay;
                        const isFuture = dayNum > currentDay;
                        const isPast = dayNum < currentDay;
                        const canOpen = dayNum <= currentDay && !isOpen;

                        const handleDayClick = () => {
                            if (isFuture) {
                                // Future days - wobble is handled in AdventDayCell
                                return;
                            }
                            if (isOpen) {
                                onDayClick(dayNum, 'opened');
                            } else if (isPast) {
                                onDayClick(dayNum, 'missed');
                            } else if (canOpen) {
                                onDayClick(dayNum, 'canOpen');
                            }
                        };

                        return (
                            <AdventDayCell
                                key={dayNum}
                                day={dayNum}
                                variant={getDayVariant(dayNum)}
                                isOpen={isOpen}
                                isToday={isToday}
                                isFuture={isFuture}
                                disabled={isLoading}
                                onClick={handleDayClick}
                                colSpan={dayNum === 24 ? 2 : 1}
                            />
                        );
                    })}
                </div>
                <SantaCapIcon
                    className="size-24 md:size-36 absolute right-[-40px] top-[-80px] md:right-[-54px] md:top-[-120px]"
                    width={512}
                    height={512}
                />
            </div>
        </Stack>
    );
}
