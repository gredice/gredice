import {
    AuthProtectedSection,
    SignedOut,
} from '@signalco/auth-server/components';
import { Typography } from '@signalco/ui-primitives/Typography';
import LoginDialog from '../../components/auth/LoginDialog';
import { HomeButton } from '../../components/HomeButton';
import { auth } from '../../lib/auth/auth';
import { getFarmSchedulePlantSorts } from '../schedule/scheduleData';
import { PlantsHandbook } from './PlantsHandbook';

export const dynamic = 'force-dynamic';

async function PlantsHandbookContent() {
    await auth(['farmer', 'admin']);
    const plantSortsData = (await getFarmSchedulePlantSorts()) ?? [];

    return (
        <div className="max-w-5xl mx-auto w-full p-4 space-y-4">
            <div className="space-y-2">
                <HomeButton />
                <Typography level="h4" component="h1" semiBold>
                    Priručnik biljaka
                </Typography>
                <Typography className="text-muted-foreground">
                    Pregled sorti, atributa i kalendara uzgoja za planiranje
                    rada na farmi.
                </Typography>
            </div>
            {plantSortsData.length > 0 ? (
                <PlantsHandbook plantSortsData={plantSortsData} />
            ) : (
                <div className="rounded-lg border bg-white p-6">
                    <Typography className="text-muted-foreground">
                        Trenutno nema dostupnih sorti biljaka.
                    </Typography>
                </div>
            )}
        </div>
    );
}

export default function PlantsHandbookPage() {
    const authFarmer = auth.bind(null, ['farmer', 'admin']);

    return (
        <div className="min-h-[100dvh] w-full bg-muted">
            <AuthProtectedSection auth={authFarmer}>
                <PlantsHandbookContent />
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
