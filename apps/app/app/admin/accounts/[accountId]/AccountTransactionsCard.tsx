import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import {
    scrollableTableCardClassName,
    scrollableTableCardOverflowClassName,
} from '../../../../components/admin/cards/tableCardLayout';
import { TransactionsTable } from '../../../../components/admin/tables';

export async function AccountTransactionsCard({
    accountId,
}: {
    accountId: string;
}) {
    return (
        <Card className={scrollableTableCardClassName}>
            <CardHeader>
                <CardTitle>Transakcije</CardTitle>
            </CardHeader>
            <CardOverflow className={scrollableTableCardOverflowClassName}>
                <TransactionsTable accountId={accountId} />
            </CardOverflow>
        </Card>
    );
}
