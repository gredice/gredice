import { Suspense } from 'react';
import LoginDialog from '../../components/auth/LoginDialog';
import { auth } from '../../lib/auth/auth';
import { FarmScheduleDay } from './FarmScheduleDay';
import { FarmScheduleNavigationFrame } from './FarmScheduleNavigationFrame';
import { ScheduleDaySummarySection } from './ScheduleDaySummarySection';
import { ScheduleDaySummarySkeleton } from './ScheduleDaySummarySkeleton';
import { ScheduleLabelPrintSection } from './ScheduleLabelPrintSection';
import {
    getFarmScheduleDayData,
    getFarmScheduleOperationsData,
    getFarmScheduleOperationsDayData,
    getFarmSchedulePlantingsDayData,
    getFarmSchedulePlantSorts,
} from './scheduleData';

export const dynamic = 'force-dynamic';

function formatDateParam(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseDateParam(dateParam?: string) {
    if (!dateParam) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateParam);
    if (!match) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
    }

    const year = Number.parseInt(match[1], 10);
    const monthIndex = Number.parseInt(match[2], 10) - 1;
    const day = Number.parseInt(match[3], 10);
    const date = new Date(year, monthIndex, day);
    date.setHours(0, 0, 0, 0);

    if (
        Number.isNaN(date.getTime()) ||
        date.getFullYear() !== year ||
        date.getMonth() !== monthIndex ||
        date.getDate() !== day
    ) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
    }

    return date;
}

async function getFarmAuth() {
    try {
        return await auth(['farmer', 'admin']);
    } catch {
        return null;
    }
}

function FarmScheduleContent({ date, userId }: { date: Date; userId: string }) {
    const isToday = new Date().toDateString() === date.toDateString();
    const dateKey = date.toISOString();
    const selectedDateKey = formatDateParam(date);
    const dayDataPromise = getFarmScheduleDayData(userId, dateKey, isToday);
    const plantingsDayDataPromise = getFarmSchedulePlantingsDayData(
        userId,
        dateKey,
        isToday,
    );
    const operationsDayDataPromise = getFarmScheduleOperationsDayData(
        userId,
        dateKey,
        isToday,
    );
    const operationsDataPromise = getFarmScheduleOperationsData();
    const plantSortsPromise = getFarmSchedulePlantSorts();

    return (
        <FarmScheduleNavigationFrame
            selectedDateKey={selectedDateKey}
            summarySlot={
                <Suspense fallback={<ScheduleDaySummarySkeleton />}>
                    <ScheduleDaySummarySection
                        dayDataPromise={dayDataPromise}
                        operationsDataPromise={operationsDataPromise}
                    />
                </Suspense>
            }
            labelPrintSlot={
                <Suspense fallback={null}>
                    <ScheduleLabelPrintSection
                        dayDataPromise={dayDataPromise}
                        operationsDataPromise={operationsDataPromise}
                        plantSortsPromise={plantSortsPromise}
                        date={date}
                    />
                </Suspense>
            }
        >
            <FarmScheduleDay
                key={selectedDateKey}
                dayDataPromise={dayDataPromise}
                plantingsDayDataPromise={plantingsDayDataPromise}
                operationsDayDataPromise={operationsDayDataPromise}
                operationsDataPromise={operationsDataPromise}
                plantSortsPromise={plantSortsPromise}
                userId={userId}
            />
        </FarmScheduleNavigationFrame>
    );
}

export default async function FarmSchedulePage({
    searchParams,
}: {
    searchParams: Promise<{ date?: string }>;
}) {
    const { date: dateParam } = await searchParams;
    const date = parseDateParam(dateParam);
    const authContext = await getFarmAuth();

    return (
        <div className="min-h-[100dvh] w-full bg-background">
            {authContext ? (
                <FarmScheduleContent date={date} userId={authContext.userId} />
            ) : (
                <LoginDialog />
            )}
        </div>
    );
}
