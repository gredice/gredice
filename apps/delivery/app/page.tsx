import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import { cache, Suspense } from 'react';
import { LoginPanel } from '../components/auth/LoginPanel';
import { DeliveryDashboard } from '../components/DeliveryDashboard';
import { auth } from '../lib/auth/auth';
import {
    buildDeliveryReturnTarget,
    type DeliveryDeepLinkTarget,
    deliveryLoginFailureSearchParam,
    parseDeliveryDeepLink,
    parseDeliveryLoginFailure,
} from '../lib/deliveryDeepLink';

export const dynamic = 'force-dynamic';

type DeliveryAuth = () => ReturnType<typeof auth>;

async function AuthenticatedDeliveryDashboard({
    deliveryAuth,
    deliveryTarget,
}: {
    deliveryAuth: DeliveryAuth;
    deliveryTarget: DeliveryDeepLinkTarget;
}) {
    const session = await deliveryAuth();
    return (
        <DeliveryDashboard
            authenticatedUserId={session.userId}
            authenticatedRole={session.user.role}
            deliveryTarget={deliveryTarget}
        />
    );
}

type HomeProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function serializeSearchParams(
    searchParams: Record<string, string | string[] | undefined>,
) {
    const serialized = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
        if (key === deliveryLoginFailureSearchParam) continue;
        if (typeof value === 'string') {
            serialized.append(key, value);
        } else if (Array.isArray(value)) {
            for (const item of value) serialized.append(key, item);
        }
    }
    return serialized.toString();
}

export default async function Home({ searchParams }: HomeProps) {
    const deliveryAuth = cache(() =>
        auth(['user', 'farmer', 'driver', 'admin']),
    );
    const resolvedSearchParams = await searchParams;
    const deliveryTarget = parseDeliveryDeepLink(resolvedSearchParams.delivery);
    const loginFailure = parseDeliveryLoginFailure(
        resolvedSearchParams[deliveryLoginFailureSearchParam],
    );
    const returnTarget = buildDeliveryReturnTarget(
        '/',
        serializeSearchParams(resolvedSearchParams),
    );

    return (
        <div className="min-h-[100dvh] w-full bg-background">
            <AuthProtectedSection auth={deliveryAuth}>
                <Suspense>
                    <AuthenticatedDeliveryDashboard
                        deliveryAuth={deliveryAuth}
                        deliveryTarget={deliveryTarget}
                    />
                </Suspense>
            </AuthProtectedSection>
            <SignedOut auth={deliveryAuth}>
                <LoginPanel
                    returnTarget={returnTarget}
                    loginFailure={loginFailure}
                />
            </SignedOut>
        </div>
    );
}
