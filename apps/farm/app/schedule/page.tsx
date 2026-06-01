import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import { ScheduleDateNavigation } from '@gredice/ui/ScheduleDateNavigation';
import { Suspense } from 'react';
import LoginDialog from '../../components/auth/LoginDialog';
import { HomeButton } from '../../components/HomeButton';
import { auth } from '../../lib/auth/auth';
import { FarmScheduleDay } from './FarmScheduleDay';
import { ScheduleDaySummarySection } from './ScheduleDaySummarySection';
import { ScheduleDaySummarySkeleton } from './ScheduleDaySummarySkeleton';
import { ScheduleLabelPrintSection } from './ScheduleLabelPrintSection';
import {
    getFarmScheduleDayData,
    getFarmScheduleOperationsData,
    getFarmSchedulePlantSorts,
} from './scheduleData';

export const dynamic = 'force-dynamic';

async function FarmScheduleContent({ date }: { date: Date }) {
    const { userId } = await auth(['farmer', 'admin']);
    const isToday = new Date().toDateString() === date.toDateString();
    const dateKey = date.toISOString();
    const dayDataPromise = getFarmScheduleDayData(userId, dateKey, isToday);
    const operationsDataPromise = getFarmScheduleOperationsData();
    const plantSortsPromise = getFarmSchedulePlantSorts();

    return (
        <div className="max-w-5xl mx-auto w-full p-4 space-y-4">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex min-w-0 items-center gap-2">
                        <HomeButton />
                    </div>
                    <ScheduleDateNavigation date={date} basePath="/schedule" />
                </div>
                <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
                    <Suspense fallback={<ScheduleDaySummarySkeleton />}>
                        <ScheduleDaySummarySection
                            dayDataPromise={dayDataPromise}
                            operationsDataPromise={operationsDataPromise}
                        />
                    </Suspense>
                    <Suspense fallback={null}>
                        <ScheduleLabelPrintSection
                            dayDataPromise={dayDataPromise}
                            operationsDataPromise={operationsDataPromise}
                            plantSortsPromise={plantSortsPromise}
                        />
                    </Suspense>
                </div>
            </div>
            <FarmScheduleDay
                dayDataPromise={dayDataPromise}
                operationsDataPromise={operationsDataPromise}
                plantSortsPromise={plantSortsPromise}
                userId={userId}
            />
        </div>
    );
}

export default async function FarmSchedulePage({
    searchParams,
}: {
    searchParams: Promise<{ date?: string }>;
}) {
    const { date: dateParam } = await searchParams;
    const date = new Date();
    if (dateParam) {
        const [year, month, day] = dateParam.split('-').map(Number);
        date.setFullYear(year, month - 1, day);
    }
    date.setHours(0, 0, 0, 0);

    const authFarmer = auth.bind(null, ['farmer', 'admin']);

    return (
        <div className="min-h-[100dvh] w-full bg-muted">
            <AuthProtectedSection auth={authFarmer}>
                <FarmScheduleContent date={date} />
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
