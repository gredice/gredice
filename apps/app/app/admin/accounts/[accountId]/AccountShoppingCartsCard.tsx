import {
    Card,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { auth } from '../../../../lib/auth/auth';
import { ShoppingCartsTable } from '../../shopping-carts/ShoppingCartsTable';

export async function AccountShoppingCartsCard({
    accountId,
}: {
    accountId: string;
}) {
    await auth(['admin']);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Košarice</CardTitle>
            </CardHeader>
            <CardOverflow>
                <ShoppingCartsTable accountId={accountId} />
            </CardOverflow>
        </Card>
    );
}