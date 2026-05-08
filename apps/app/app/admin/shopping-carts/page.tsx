import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { auth } from '../../../lib/auth/auth';
import { ShoppingCartsTable } from './ShoppingCartsTable';

export const dynamic = 'force-dynamic';

export default async function ShoppingCartsPage() {
    await auth(['admin']);

    return (
        <Stack spacing={2}>
            <Card>
                <CardOverflow>
                    <ShoppingCartsTable />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
