import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import { Suspense } from 'react';
import { LoginPanel } from '../components/auth/LoginPanel';
import { DeliveryDashboard } from '../components/DeliveryDashboard';
import { auth } from '../lib/auth/auth';

export const dynamic = 'force-dynamic';

export default function Home() {
    const deliveryAuth = auth.bind(null, ['user', 'farmer', 'driver', 'admin']);

    return (
        <div className="min-h-[100dvh] w-full bg-background">
            <AuthProtectedSection auth={deliveryAuth}>
                <Suspense>
                    <DeliveryDashboard />
                </Suspense>
            </AuthProtectedSection>
            <SignedOut auth={deliveryAuth}>
                <LoginPanel />
            </SignedOut>
        </div>
    );
}
