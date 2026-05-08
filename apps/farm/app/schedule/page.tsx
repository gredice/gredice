import {
    AuthProtectedSection,
    SignedOut,
} from '@signalco/auth-server/components';
import { Row } from '@signalco/ui-primitives/Row';
import { Typography } from '@signalco/ui-primitives/Typography';
import { Suspense } from 'react';
import LoginDialog from '../../components/auth/LoginDialog';
import { HomeButton } from '../../components/HomeButton';
import { auth } from '../../lib/auth/auth';
import { FarmScheduleDay } from './FarmScheduleDay';
import { ScheduleDateNavigation } from './ScheduleDateNavigation';
import { ScheduleDaySummarySection } from './ScheduleDaySummarySection';
import { ScheduleDaySummarySkeleton } from './ScheduleDaySummarySkeleton';
import {
    getFarmScheduleDayData,
    getFarmScheduleOperationsData,
} from './scheduleData';

export const dynamic = 'force-dynamic';

async function FarmScheduleContent({ date }: { date: Date }) {
    const { userId } = await auth(['farmer', 'admin']);
    const isToday = new Date().toDateString() === date.toDateString();
    const dateKey = date.toISOString();
    const dayDataPromise = getFarmScheduleDayData(userId, dateKey, isToday);
    const operationsDataPromise = getFarmScheduleOperationsData();

    return (
        <div className="max-w-5xl mx-auto w-full p-4 space-y-4">
            <Row spacing={2} justifyContent="space-between">
                <Row spacing={1}>
                    <HomeButton />
                    <Typography level="h4" component="h1">
                        Raspored
                    </Typography>
                </Row>
                <ScheduleDateNavigation date={date} />
                <Suspense fallback={<ScheduleDaySummarySkeleton />}>
                    <ScheduleDaySummarySection
                        dayDataPromise={dayDataPromise}
                        operationsDataPromise={operationsDataPromise}
                    />
                </Suspense>
            </Row>
            <FarmScheduleDay
                dayDataPromise={dayDataPromise}
                operationsDataPromise={operationsDataPromise}
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
