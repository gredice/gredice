import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { auth } from '../../../lib/auth/auth';
import { ShoppingCartsTable } from './ShoppingCartsTable';

export const dynamic = 'force-dynamic';

export default async function ShoppingCartsPage() {
    await auth(['admin']);

    return (
        <Stack spacing={2}>
            <Typography level="h1" className="text-2xl" semiBold>
                Košarice
            </Typography>
            <Card>
                <CardOverflow>
                    <ShoppingCartsTable />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
