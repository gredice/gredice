import { getAllTransactions } from '@gredice/storage';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { TransactionsTable } from '../../../components/admin/tables';
import { auth } from '../../../lib/auth/auth';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage() {
    await auth(['admin']);
    const allTransactions = await getAllTransactions();

    // Sort transactions by newest first (createdAt descending)
    const transactions = (allTransactions || []).sort(
        (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const transactionsWithoutInvoices = transactions.filter(
        (t) => (t.invoices?.length || 0) === 0,
    );

    return (
        <Stack spacing={4}>
            <Row spacing={2}>
                <Chip color="primary">{transactions.length}</Chip>
                {transactionsWithoutInvoices.length > 0 && (
                    <Chip color="success">
                        ✨ {transactionsWithoutInvoices.length} bez računa
                    </Chip>
                )}
            </Row>
            <Card>
                <CardOverflow>
                    <TransactionsTable />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
