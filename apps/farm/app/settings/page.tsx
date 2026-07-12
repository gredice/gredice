import { getUser } from '@gredice/storage';
import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import LoginDialog from '../../components/auth/LoginDialog';
import { HomeButton } from '../../components/HomeButton';
import { auth } from '../../lib/auth/auth';
import { FarmSchedulePreferences } from './_components/FarmSchedulePreferences';
import { NotificationSettings } from './_components/NotificationSettings';

export const dynamic = 'force-dynamic';

async function FarmSettingsContent() {
    const { userId } = await auth(['farmer', 'admin']);
    const user = await getUser(userId);

    return (
        <div className="max-w-5xl mx-auto w-full p-4 space-y-4">
            <div className="flex min-w-0 items-center gap-2">
                <HomeButton />
            </div>
            <FarmSchedulePreferences
                groupWateringOperations={
                    user?.farmScheduleGroupedWateringEnabled ?? true
                }
            />
            <NotificationSettings />
        </div>
    );
}

export default function FarmSettingsPage() {
    const authFarmer = auth.bind(null, ['farmer', 'admin']);

    return (
        <div className="min-h-[100dvh] w-full bg-background">
            <AuthProtectedSection auth={authFarmer}>
                <FarmSettingsContent />
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
