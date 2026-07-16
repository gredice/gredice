import {
    type DeliveryLifecycleNotificationDiagnostics,
    type DeliveryLifecycleNotificationHealth,
    getDeliveryLifecycleNotificationDiagnostics,
    getDeliveryLifecycleNotificationHealth,
} from '@gredice/storage';
import { Alert } from '@gredice/ui/Alert';
import { Card } from '@gredice/ui/Card';
import { Warning } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import {
    AdminPageHeader,
    AdminPageTitle,
} from '../../../../components/admin/navigation';
import { auth } from '../../../../lib/auth/auth';
import { DeliveryNotificationFilters } from './DeliveryNotificationFilters';
import { DeliveryNotificationHealthCard } from './DeliveryNotificationHealthCard';
import { DeliveryNotificationTimeline } from './DeliveryNotificationTimeline';
import {
    type DeliveryNotificationSearchParams,
    parseDeliveryNotificationFilters,
} from './deliveryNotificationPresentation';

export const dynamic = 'force-dynamic';

type DeliveryNotificationPageData = {
    diagnostics: DeliveryLifecycleNotificationDiagnostics;
    health15Minutes: DeliveryLifecycleNotificationHealth;
    health24Hours: DeliveryLifecycleNotificationHealth;
};

export default async function AdminDeliveryNotificationsPage({
    searchParams,
}: {
    searchParams: Promise<DeliveryNotificationSearchParams>;
}) {
    await auth(['admin']);

    const parsed = parseDeliveryNotificationFilters(await searchParams);
    let data: DeliveryNotificationPageData | null = null;
    let loadFailed = false;

    if (!parsed.hasInvalidFilter) {
        const now = new Date();
        const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
        const twentyFourHoursAgo = new Date(
            now.getTime() - 24 * 60 * 60 * 1000,
        );
        const healthFilters = {
            channel: parsed.filters.channel,
            milestone: parsed.filters.milestone,
            requestId: parsed.filters.requestId,
            sourceId: parsed.filters.sourceId,
            to: now,
        };

        try {
            const [diagnostics, health15Minutes, health24Hours] =
                await Promise.all([
                    getDeliveryLifecycleNotificationDiagnostics({
                        ...parsed.filters,
                        from: twentyFourHoursAgo,
                        limit: 200,
                        to: now,
                    }),
                    getDeliveryLifecycleNotificationHealth({
                        ...healthFilters,
                        from: fifteenMinutesAgo,
                    }),
                    getDeliveryLifecycleNotificationHealth({
                        ...healthFilters,
                        from: twentyFourHoursAgo,
                    }),
                ]);
            data = { diagnostics, health15Minutes, health24Hours };
        } catch {
            loadFailed = true;
        }
    }

    return (
        <Stack spacing={4}>
            <AdminPageTitle title="Pouzdanost obavijesti dostave" />
            <AdminPageHeader heading="Pouzdanost obavijesti dostave" />

            <Card className="p-4">
                <DeliveryNotificationFilters values={parsed.values} />
            </Card>

            {parsed.hasInvalidFilter && (
                <Alert color="warning" startDecorator={<Warning />}>
                    Jedan ili više filtera nije valjano. Koristi točan
                    operativni identifikator i ponuđene vrijednosti filtera.
                </Alert>
            )}

            {loadFailed && (
                <Alert color="danger" startDecorator={<Warning />}>
                    Podaci o obavijestima dostave trenutačno nisu dostupni.
                    Pokušaj ponovno.
                </Alert>
            )}

            {data && (
                <>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <DeliveryNotificationHealthCard
                            health={data.health15Minutes}
                            showOperationalAlerts
                            title="Zadnjih 15 minuta"
                        />
                        <DeliveryNotificationHealthCard
                            health={data.health24Hours}
                            title="Zadnja 24 sata"
                        />
                    </div>
                    <DeliveryNotificationTimeline
                        diagnostics={data.diagnostics}
                    />
                </>
            )}
        </Stack>
    );
}
