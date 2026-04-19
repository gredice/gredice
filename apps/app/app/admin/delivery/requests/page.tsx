import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { auth } from '../../../../lib/auth/auth';
import { DeliveryRequestsFilters } from './DeliveryRequestsFilters';
import { DeliveryRequestsTable } from './DeliveryRequestsTable';

export const dynamic = 'force-dynamic';

export default async function AdminDeliveryRequestsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await auth(['admin']);

    const params = await searchParams;

    return (
        <Stack spacing={2}>
            <DeliveryRequestsFilters />
            <Card>
                <CardOverflow>
                    <DeliveryRequestsTable searchParams={params} />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
