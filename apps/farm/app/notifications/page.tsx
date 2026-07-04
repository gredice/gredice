import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import LoginDialog from '../../components/auth/LoginDialog';
import { HomeButton } from '../../components/HomeButton';
import { auth } from '../../lib/auth/auth';
import { FarmNotificationsPanel } from './FarmNotificationsPanel';

export const dynamic = 'force-dynamic';

function FarmNotificationsContent() {
    return (
        <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                <HomeButton />
                <Stack spacing={0} className="min-w-0">
                    <Typography level="h3" semiBold>
                        Obavijesti
                    </Typography>
                </Stack>
            </div>
            <FarmNotificationsPanel />
        </div>
    );
}

export default function FarmNotificationsPage() {
    const authFarmer = auth.bind(null, ['farmer', 'admin']);

    return (
        <div className="min-h-[100dvh] w-full bg-background">
            <AuthProtectedSection auth={authFarmer}>
                <FarmNotificationsContent />
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
