import { Card, CardOverflow } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { auth } from '../../../../lib/auth/auth';
import { DeliveryRequestsFilters } from './DeliveryRequestsFilters';
import { DeliveryRequestsList } from './DeliveryRequestsList';

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
                    <DeliveryRequestsList searchParams={params} />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
