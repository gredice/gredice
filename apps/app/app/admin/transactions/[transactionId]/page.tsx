import { getTransaction } from "@gredice/storage";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { KnownPages } from "../../../../src/KnownPages";
import { notFound } from "next/navigation";
import { Table } from "@signalco/ui-primitives/Table";
import { NoDataPlaceholder } from "../../../../components/shared/placeholders/NoDataPlaceholder";
import { LocaleDateTime } from "../../../../components/shared/LocaleDateTime";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";

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
                <Row spacing={2}>
                    <Typography level="body1">ID: {transaction.id}</Typography>
                    <Typography level="body1">Tip: {transaction.status}</Typography>
                    <Typography level="body1">Iznos: {transaction.amount}</Typography>
                    <Typography level="body1">Datum kreiranja: <LocaleDateTime>{transaction.createdAt}</LocaleDateTime></Typography>
                </Row>
            </Stack>
            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>ID entiteta</Table.Head>
                                <Table.Head>Tip entiteta</Table.Head>
                                <Table.Head>ID entiteta</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {transaction.transactionEntities.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={3}>
                                        <NoDataPlaceholder>
                                            Nema povezanih entiteta
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {transaction.transactionEntities.map(entity => (
                                <Table.Row key={entity.id}>
                                    <Table.Cell>{entity.id}</Table.Cell>
                                    <Table.Cell>{entity.entityTypeName}</Table.Cell>
                                    <Table.Cell>{entity.entityId}</Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </CardOverflow>
            </Card>
        </Stack>
    );
}