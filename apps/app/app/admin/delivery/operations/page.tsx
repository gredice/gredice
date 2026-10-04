import {
    type DeliveryOperationalHealth,
    getDeliveryOperationalHealth,
} from '@gredice/storage';
import { Alert } from '@gredice/ui/Alert';
import { Warning } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import Link from 'next/link';
import {
    AdminPageHeader,
    AdminPageTitle,
} from '../../../../components/admin/navigation';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { DeliveryOperationalDiagnostics } from './DeliveryOperationalDiagnostics';
import { DeliveryOperationalExceptions } from './DeliveryOperationalExceptions';
import { DeliveryOperationalHealthSummary } from './DeliveryOperationalHealthSummary';
import { DeliveryOperationalMetrics } from './DeliveryOperationalMetrics';

export const dynamic = 'force-dynamic';

export default async function AdminDeliveryOperationsPage() {
    await auth(['admin']);

    let health: DeliveryOperationalHealth | null = null;
    try {
        health = await getDeliveryOperationalHealth();
    } catch {
        // The page remains an operator entry point when the bounded query is
        // temporarily unavailable; details stay private and fail closed.
    }

    return (
        <Stack spacing={4}>
            <AdminPageTitle title="Operativno zdravlje dostave" />
            <AdminPageHeader heading="Operativno zdravlje dostave" />

            <Alert color="warning" startDecorator={<Warning />}>
                Akcije koje još čekaju samo na uređaju nisu vidljive
                poslužitelju. Ovdje se prikazuju nakon sinkronizacije kao
                odgođeni zapisi. Aktivni broj provjeri u aplikaciji vozača.
                Pouzdanost obavijesti prati se zasebno na{' '}
                <Link
                    className="underline"
                    href={KnownPages.DeliveryNotifications}
                >
                    stranici obavijesti dostave
                </Link>
                .
            </Alert>

            {!health && (
                <Alert color="danger" startDecorator={<Warning />}>
                    Operativni podaci dostave trenutačno nisu dostupni. Pokušaj
                    ponovno.
                </Alert>
            )}

            {health && (
                <>
                    <DeliveryOperationalHealthSummary health={health} />
                    <DeliveryOperationalMetrics health={health} />
                    <DeliveryOperationalExceptions health={health} />
                    <DeliveryOperationalDiagnostics health={health} />
                </>
            )}
        </Stack>
    );
}
