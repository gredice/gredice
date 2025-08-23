import { getTransaction } from "@gredice/storage";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { KnownPages } from "../../../../src/KnownPages";
import { notFound } from "next/navigation";
import { LocalDateTime } from "@gredice/ui/LocalDateTime";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Card, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { Chip } from "@signalco/ui-primitives/Chip";
import { FieldSet } from "../../../../components/shared/fields/FieldSet";
import { Field } from "../../../../components/shared/fields/Field";
import { InvoicesTable } from "../../invoices/InvoicesTable";

export const dynamic = 'force-dynamic';

export default async function TransactionDetailsPage({ params }: { params: Promise<{ transactionId: string }> }) {
    const { transactionId } = await params;
    const transactionIdNumber = parseInt(transactionId, 10);
    if (isNaN(transactionIdNumber)) {
        return notFound();
    }
    const transaction = await getTransaction(transactionIdNumber);
    if (!transaction) {
        return notFound();
    }

    return (
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Breadcrumbs items={[
                    { label: 'Transakcije', href: KnownPages.Transactions },
                    { label: transactionId }
                ]} />
                <Typography level="h1" className="text-2xl" semiBold>Detalji transakcije</Typography>
            </Stack>
            <Stack spacing={2}>
                <FieldSet>
                    <Field name="ID transakcije" value={transaction.id} />
                    <Field name="Tip" value={transaction.status} />
                    <Field name="Iznos" value={`${(transaction.amount / 100).toFixed(2)}€`} />
                    <Field name="Datum kreiranja" value={<LocalDateTime time={false}>{transaction.createdAt}</LocalDateTime>} />
                    <Field name="Računi" value={(
                        <>
                            {(transaction.invoices?.length || 0) === 0 ? (
                                <Chip color="success" className="w-fit">
                                    ✨ Bez računa - dostupna za fakturiranje
                                </Chip>
                            ) : (
                                <Chip color="neutral" className="w-fit">
                                    📋 {transaction.invoices.length} račun{transaction.invoices.length > 1 ? 'a' : ''}
                                </Chip>
                            )}
                        </>
                    )} />
                </FieldSet>
            </Stack>
            <Card>
                <CardHeader>
                    <CardTitle>Ponude</CardTitle>
                </CardHeader>
                <CardOverflow>
                    <InvoicesTable transactionId={transaction.id} />
                </CardOverflow>
            </Card>
        </Stack>
    );
}