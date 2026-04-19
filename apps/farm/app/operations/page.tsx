import {
    AuthProtectedSection,
    SignedOut,
} from '@signalco/auth-server/components';
import { Typography } from '@signalco/ui-primitives/Typography';
import LoginDialog from '../../components/auth/LoginDialog';
import { HomeButton } from '../../components/HomeButton';
import { auth } from '../../lib/auth/auth';
import { getFarmScheduleOperationsData } from '../schedule/scheduleData';
import { OperationsHandbook } from './OperationsHandbook';

export const dynamic = 'force-dynamic';

async function OperationsHandbookContent() {
    await auth(['farmer', 'admin']);
    const operationsData = (await getFarmScheduleOperationsData()) ?? [];

    return (
        <div className="max-w-5xl mx-auto w-full p-4 space-y-4">
            <div className="space-y-2">
                <HomeButton />
                <Typography level="h4" component="h1" semiBold>
                    Priručnik operacija
                </Typography>
                <Typography className="text-muted-foreground">
                    Pregled svih operacija i ključnih detalja za brži rad na
                    farmi.
                </Typography>
            </div>
            {operationsData.length > 0 ? (
                <OperationsHandbook operationsData={operationsData} />
            ) : (
                <div className="rounded-lg border bg-white p-6">
                    <Typography className="text-muted-foreground">
                        Trenutno nema dostupnih operacija.
                    </Typography>
                </div>
            )}
        </div>
    );
}

export default function OperationsHandbookPage() {
    const authFarmer = auth.bind(null, ['farmer', 'admin']);

    return (
        <div className="min-h-[100dvh] w-full bg-muted">
            <AuthProtectedSection auth={authFarmer}>
                <OperationsHandbookContent />
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
