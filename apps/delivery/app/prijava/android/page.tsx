import { getEligibleDeliveryNativeAccounts } from '@gredice/storage';
import { Alert } from '@gredice/ui/Alert';
import { Warning } from '@gredice/ui/icons';
import type { Metadata } from 'next';
import { LoginPanel } from '../../../components/auth/LoginPanel';
import { auth } from '../../../lib/auth/auth';
import {
    deliveryNativeAuthorizationReturnTarget,
    parseDeliveryNativeAuthorizationRequest,
} from '../../../lib/deliveryNativeAuthorization';
import { NativeAuthorizationPanel } from './NativeAuthorizationPanel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Povezivanje Android Auto',
    referrer: 'no-referrer',
    robots: { index: false, follow: false },
};

type AndroidAuthorizationPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AndroidAuthorizationPage({
    searchParams,
}: AndroidAuthorizationPageProps) {
    const request = parseDeliveryNativeAuthorizationRequest(await searchParams);
    if (!request) {
        return (
            <main className="flex min-h-[100dvh] items-center justify-center p-4">
                <Alert
                    color="danger"
                    startDecorator={<Warning className="size-5" />}
                >
                    Zahtjev aplikacije nije valjan. Pokrenite povezivanje
                    ponovno u aplikaciji Gredice Dostava.
                </Alert>
            </main>
        );
    }

    let session: Awaited<ReturnType<typeof auth>>;
    try {
        session = await auth(['user', 'farmer', 'driver', 'admin']);
    } catch {
        return (
            <LoginPanel
                returnTarget={deliveryNativeAuthorizationReturnTarget(request)}
            />
        );
    }

    if (session.user.role !== 'driver' && session.user.role !== 'admin') {
        return (
            <main className="flex min-h-[100dvh] items-center justify-center p-4">
                <Alert
                    color="danger"
                    startDecorator={<Warning className="size-5" />}
                >
                    Za povezivanje je potrebna uloga dostavljača ili
                    administratora.
                </Alert>
            </main>
        );
    }

    const accounts = await getEligibleDeliveryNativeAccounts(session.userId);
    return <NativeAuthorizationPanel request={request} accounts={accounts} />;
}
