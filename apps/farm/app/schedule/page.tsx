import { DailySchedule } from '@gredice/ui/DailySchedule';
import {
    AuthProtectedSection,
    SignedOut,
} from '@signalco/auth-server/components';
import { Row } from '@signalco/ui-primitives/Row';
import { Typography } from '@signalco/ui-primitives/Typography';
import LoginDialog from '../../components/auth/LoginDialog';
import { PageBackButton } from '../../components/PageBackButton';
import { auth } from '../../lib/auth/auth';
import { FarmScheduleDay } from './FarmScheduleDay';

export const dynamic = 'force-dynamic';

async function FarmScheduleContent() {
    const { userId } = await auth(['farmer', 'admin']);

    return (
        <div className="max-w-5xl mx-auto w-full px-4 py-10 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <Row spacing={1}>
                    <PageBackButton />
                    <Typography level="h1" className="text-3xl" semiBold>
                        Raspored
                    </Typography>
                </Row>
            </div>
            <DailySchedule
                renderDay={({ date, isToday }) => (
                    <FarmScheduleDay
                        date={date}
                        isToday={isToday}
                        userId={userId}
                    />
                )}
            />
        </div>
    );
}

export default function FarmSchedulePage() {
    const authFarmer = auth.bind(null, ['farmer', 'admin']);

    return (
        <div className="min-h-[100dvh] w-full bg-muted">
            <AuthProtectedSection auth={authFarmer}>
                <FarmScheduleContent />
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
