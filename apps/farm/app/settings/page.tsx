import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import LoginDialog from '../../components/auth/LoginDialog';
import { HomeButton } from '../../components/HomeButton';
import { auth } from '../../lib/auth/auth';
import { NotificationSettings } from './_components/NotificationSettings';

export const dynamic = 'force-dynamic';

function FarmSettingsContent() {
    return (
        <div className="max-w-5xl mx-auto w-full p-4 space-y-4">
            <div className="flex min-w-0 items-center gap-2">
                <HomeButton />
                <Typography level="h4" component="h1">
                    Postavke
                </Typography>
            </div>
            <Stack spacing={6}>
                <Stack spacing={2}>
                    <Typography level="h5" semiBold>
                        Obavijesti
                    </Typography>
                    <Typography level="body2" secondary>
                        Uključi web push obavijesti kako bi te sustav
                        obavijestio kada ti je dodijeljena nova radnja na farmi.
                    </Typography>
                </Stack>
                <NotificationSettings />
            </Stack>
        </div>
    );
}

export default function FarmSettingsPage() {
    const authFarmer = auth.bind(null, ['farmer', 'admin']);

    return (
        <div className="min-h-[100dvh] w-full bg-muted">
            <AuthProtectedSection auth={authFarmer}>
                <FarmSettingsContent />
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
