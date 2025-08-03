import { getAllTransactions } from "@gredice/storage";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Chip } from "@signalco/ui-primitives/Chip";
import { auth } from "../../../lib/auth/auth";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { TransactionsTable } from "./TransactionsTable";

export const dynamic = 'force-dynamic';

export default async function TransactionsPage() {
    await auth(['admin']);
    const allTransactions = await getAllTransactions();

    // Sort transactions by newest first (createdAt descending)
    const transactions = (allTransactions || []).sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const transactionsWithoutInvoices = transactions.filter(t => (t.invoices?.length || 0) === 0);

    return (
        <Stack spacing={2}>
            <Row spacing={1}>
                <Typography level="h1" className="text-2xl" semiBold>{"Transakcije"}</Typography>
                <Chip color="primary" size="sm">{transactions.length}</Chip>
                {transactionsWithoutInvoices.length > 0 && (
                    <Chip color="success" size="sm">
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