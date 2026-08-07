import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import { Typography } from '@gredice/ui/Typography';
import LoginDialog from '../../components/auth/LoginDialog';
import { auth } from '../../lib/auth/auth';
import { getFarmSchedulePlantSorts } from '../schedule/scheduleData';
import { PlantsHandbook } from './PlantsHandbook';

export const dynamic = 'force-dynamic';

async function PlantsHandbookContent() {
    await auth(['farmer', 'admin']);
    const plantSortsData = (await getFarmSchedulePlantSorts()) ?? [];

    return (
        <div className="max-w-5xl mx-auto w-full p-4 space-y-4">
            <Typography component="h1" level="h5" semiBold>
                Biljke
            </Typography>
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
        <div className="min-h-[100dvh] w-full bg-background">
            <AuthProtectedSection auth={authFarmer}>
                <PlantsHandbookContent />
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
