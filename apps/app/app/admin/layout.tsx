import { getEntityTypesOrganizedByCategories } from '@gredice/storage';
import {
    AuthProtectedSection,
    SignedOut,
} from '@signalco/auth-server/components';
import { type PropsWithChildren, Suspense } from 'react';
import {
    LoginDialog,
    MobileHeader,
    Nav,
} from '../../components/admin/navigation';
import { AdminClientProvider } from '../../components/admin/providers';
import { AuthAppProvider } from '../../components/providers/AuthAppProvider';
import { auth } from '../../lib/auth/auth';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: PropsWithChildren) {
    const authAdmin = auth.bind(null, ['admin']);
    const { categorizedTypes, uncategorizedTypes } =
        await getEntityTypesOrganizedByCategories();

    return (
        <AuthAppProvider>
            <AdminClientProvider
                categorizedTypes={categorizedTypes}
                uncategorizedTypes={uncategorizedTypes}
            >
                <div className="grow bg-secondary">
                    <MobileHeader />
                    <main className="relative h-full md:h-full min-h-[calc(100vh-3.5rem)] md:min-h-screen">
                        <div className="flex flex-row min-h-full">
                            {/* Desktop Navigation */}
                            <div className="hidden md:block p-4 min-w-64">
                                <Nav />
                            </div>
                            {/* Main Content */}
                            <div className="min-h-full grow md:pt-2">
                                <div className="p-2 md:p-4 bg-background rounded-t-xl md:border-l md:border-t md:rounded-tr-none min-h-full">
                                    <AuthProtectedSection auth={authAdmin}>
                                        <Suspense>{children}</Suspense>
                                    </AuthProtectedSection>
                                </div>
                            </div>
                        </div>
                        <SignedOut auth={authAdmin}>
                            <LoginDialog />
                        </SignedOut>
                    </main>
                </div>
            </AdminClientProvider>
        </AuthAppProvider>
    );
}
