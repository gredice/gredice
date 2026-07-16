import {
    getTimeZoneDateKey,
    getUser,
    isCalendarDateKey,
} from '@gredice/storage';
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
import { FARM_SCHEDULE_TIME_ZONE } from './scheduleShared';

export const dynamic = 'force-dynamic';

function parseDateParam(dateParam?: string) {
    return dateParam && isCalendarDateKey(dateParam)
        ? dateParam
        : getTimeZoneDateKey(new Date(), FARM_SCHEDULE_TIME_ZONE);
}

async function getFarmAuth() {
    try {
        return await auth(['farmer', 'admin']);
    } catch {
        return null;
    }
}

async function FarmScheduleContent({
    accountId,
    selectedDateKey,
    sessionIncarnation,
    userId,
}: {
    accountId: string;
    selectedDateKey: string;
    sessionIncarnation: string;
    userId: string;
}) {
    const userPromise = getUser(userId);
    const isToday =
        getTimeZoneDateKey(new Date(), FARM_SCHEDULE_TIME_ZONE) ===
        selectedDateKey;
    const dayDataPromise = getFarmScheduleDayData(
        userId,
        selectedDateKey,
        isToday,
    );
    const plantingsDayDataPromise = getFarmSchedulePlantingsDayData(
        userId,
        selectedDateKey,
        isToday,
    );
    const operationsDayDataPromise = getFarmScheduleOperationsDayData(
        userId,
        selectedDateKey,
        isToday,
    );
    const operationsDataPromise = getFarmScheduleOperationsData();
    const plantSortsPromise = getFarmSchedulePlantSorts();
    const user = await userPromise;

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
                        dateKey={selectedDateKey}
                    />
                </Suspense>
            }
        >
            <FarmScheduleDay
                key={selectedDateKey}
                accountId={accountId}
                selectedDateKey={selectedDateKey}
                dayDataPromise={dayDataPromise}
                plantingsDayDataPromise={plantingsDayDataPromise}
                operationsDayDataPromise={operationsDayDataPromise}
                operationsDataPromise={operationsDataPromise}
                plantSortsPromise={plantSortsPromise}
                groupWateringOperations={
                    user?.farmScheduleGroupedWateringEnabled ?? true
                }
                sessionIncarnation={sessionIncarnation}
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
    const selectedDateKey = parseDateParam(dateParam);
    const authContext = await getFarmAuth();

    return (
        <div className="min-h-[100dvh] w-full bg-background">
            {authContext ? (
                <FarmScheduleContent
                    accountId={authContext.accountId}
                    selectedDateKey={selectedDateKey}
                    sessionIncarnation={authContext.sessionIncarnation}
                    userId={authContext.userId}
                />
            ) : (
                <LoginDialog />
            )}
        </div>
    );
}
