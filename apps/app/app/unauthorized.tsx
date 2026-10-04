import { LoginDialog } from '../components/admin/navigation';
import { AuthAppProvider } from '../components/providers/AuthAppProvider';

export default function UnauthorizedPage() {
    return (
        <AuthAppProvider>
            <div className="grow bg-secondary/40">
                <main className="relative h-full min-h-screen">
                    <LoginDialog />
                </main>
            </div>
        </AuthAppProvider>
    );
}
