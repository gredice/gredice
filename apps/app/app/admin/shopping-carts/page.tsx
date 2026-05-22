import { Card, CardOverflow } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { auth } from '../../../lib/auth/auth';
import { ShoppingCartsTable } from './ShoppingCartsTable';

export const dynamic = 'force-dynamic';

export default async function ShoppingCartsPage() {
    await auth(['admin']);

    return (
        <Stack spacing={4}>
            <Card>
                <CardOverflow>
                    <ShoppingCartsTable />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
