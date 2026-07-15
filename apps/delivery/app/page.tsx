import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import { cache, Suspense } from 'react';
import { LoginPanel } from '../components/auth/LoginPanel';
import { DeliveryDashboard } from '../components/DeliveryDashboard';
import { auth } from '../lib/auth/auth';

export const dynamic = 'force-dynamic';

type DeliveryAuth = () => ReturnType<typeof auth>;

async function AuthenticatedDeliveryDashboard({
    deliveryAuth,
}: {
    deliveryAuth: DeliveryAuth;
}) {
    const session = await deliveryAuth();
    return (
        <DeliveryDashboard
            authenticatedUserId={session.userId}
            authenticatedRole={session.user.role}
        />
    );
}

export default function Home() {
    const deliveryAuth = cache(() =>
        auth(['user', 'farmer', 'driver', 'admin']),
    );

    return (
        <div className="min-h-[100dvh] w-full bg-background">
            <AuthProtectedSection auth={deliveryAuth}>
                <Suspense>
                    <AuthenticatedDeliveryDashboard
                        deliveryAuth={deliveryAuth}
                    />
                </Suspense>
            </AuthProtectedSection>
            <SignedOut auth={deliveryAuth}>
                <LoginPanel />
            </SignedOut>
        </div>
    );
}
