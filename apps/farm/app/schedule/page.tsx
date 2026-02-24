import { DailySchedule } from '@gredice/ui/DailySchedule';
import {
    AuthProtectedSection,
    SignedOut,
} from '@signalco/auth-server/components';
import { ArrowLeft } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import LoginDialog from '../../components/auth/LoginDialog';
import { LogoutButton } from '../../components/auth/LogoutButton';
import { auth } from '../../lib/auth/auth';
import { FarmScheduleDay } from './FarmScheduleDay';

export const dynamic = 'force-dynamic';
export default function FarmSchedulePage() {
    const authFarmer = auth.bind(null, ['farmer', 'admin']);

    return (
        <div className="min-h-[100dvh] w-full bg-muted">
            <AuthProtectedSection auth={authFarmer}>
                <div className="max-w-5xl mx-auto w-full px-4 py-10 space-y-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <Stack spacing={1}>
                            <Typography level="h1" className="text-3xl" semiBold>
                                Raspored
                            </Typography>
                            <Typography className="text-muted-foreground">
                                Pregledaj dnevne zadatke i planiraj nadolazeće
                                aktivnosti.
                            </Typography>
                        </Stack>
                        <Stack spacing={2} className="items-end">
                            <Button
                                variant="outlined"
                                size="sm"
                                href="/"
                                startDecorator={<ArrowLeft className="size-4" />}
                            >
                                Povratak na početnu
                            </Button>
                            <LogoutButton />
                        </Stack>
                    </div>
                    <DailySchedule
                        renderDay={({ date, isToday }) => (
                            <FarmScheduleDay date={date} isToday={isToday} />
                        )}
                    />
                </div>
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
