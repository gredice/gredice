import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { TransactionsTable } from '../../transactions/TransactionsTable';

export async function AccountTransactionsCard({
    accountId,
}: {
    accountId: string;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Transakcije</CardTitle>
            </CardHeader>
            <CardOverflow>
                <TransactionsTable accountId={accountId} />
            </CardOverflow>
        </Card>
    );
}
