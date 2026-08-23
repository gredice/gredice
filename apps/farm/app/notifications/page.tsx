import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import { Typography } from '@gredice/ui/Typography';
import LoginDialog from '../../components/auth/LoginDialog';
import { auth } from '../../lib/auth/auth';
import { FarmNotificationsPanel } from './FarmNotificationsPanel';

export const dynamic = 'force-dynamic';

function FarmNotificationsContent() {
    return (
        <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
            <Typography component="h1" level="h5" semiBold>
                Obavijesti
            </Typography>
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
