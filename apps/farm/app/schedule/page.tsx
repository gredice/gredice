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
        <div className="max-w-5xl mx-auto w-full space-y-4 px-2 py-4 sm:p-4">
            <div className="space-y-2">
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-1 sm:gap-2">
                    <div className="justify-self-start">
                        <HomeButton className="h-8 sm:h-10" />
                    </div>
                    <div className="min-w-0 justify-self-center">
                        <ScheduleDateNavigation
                            date={date}
                            basePath="/schedule"
                            compact
                        />
                    </div>
                    <div className="min-w-0 justify-self-end">
                        <Suspense fallback={<ScheduleDaySummarySkeleton />}>
                            <ScheduleDaySummarySection
                                dayDataPromise={dayDataPromise}
                                operationsDataPromise={operationsDataPromise}
                            />
                        </Suspense>
                    </div>
                </div>
                <div className="flex min-w-0 justify-end">
                    <Suspense fallback={null}>
                        <ScheduleLabelPrintSection
                            dayDataPromise={dayDataPromise}
                            operationsDataPromise={operationsDataPromise}
                            plantSortsPromise={plantSortsPromise}
                            date={date}
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
