import { Card, CardOverflow } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
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
        <Stack spacing={4}>
            <DeliveryRequestsFilters />
            <Card>
                <CardOverflow>
                    <DeliveryRequestsTable searchParams={params} />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
