import { getReceiptsByStatus } from "@gredice/storage";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Table } from "@signalco/ui-primitives/Table";
import { auth } from "../../../lib/auth/auth";
import { KnownPages } from "../../../src/KnownPages";
import Link from "next/link";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";
import { LocalDateTime } from "@gredice/ui/LocalDateTime";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";

export const dynamic = 'force-dynamic';

function getCisStatusColor(cisStatus: string) {
    switch (cisStatus) {
        case 'sent': return 'info';
        case 'pending': return 'warning';
        case 'failed': return 'error';
        case 'confirmed': return 'success';
        default: return 'neutral';
    }
}

function getCisStatusLabel(cisStatus: string) {
    switch (cisStatus) {
        case 'sent': return 'Poslano';
        case 'pending': return 'Na čekanju';
        case 'failed': return 'Neuspješno';
        case 'confirmed': return 'Potvrđeno';
        default: return cisStatus;
    }
}

export default async function ReceiptsPage() {
    await auth(['admin']);

    // Get receipts with all statuses - this is a simplified approach
    const [sentReceipts, pendingReceipts, failedReceipts, confirmedReceipts] = await Promise.all([
        getReceiptsByStatus('sent'),
        getReceiptsByStatus('pending'),
        getReceiptsByStatus('failed'),
        getReceiptsByStatus('confirmed'),
    ]);

    const receipts = [...sentReceipts, ...pendingReceipts, ...failedReceipts, ...confirmedReceipts];

    return (
        <Stack spacing={2}>
            <Row spacing={1}>
                <Typography level="h1" className="text-2xl" semiBold>{"Fiskalni računi"}</Typography>
                <Chip color="primary">{receipts.length}</Chip>
            </Row>
            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Datum izdavanja</Table.Head>
                                <Table.Head>Račun</Table.Head>
                                <Table.Head>CIS Status</Table.Head>
                                <Table.Head>Iznos</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {receipts.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={7}>
                                        <NoDataPlaceholder>
                                            Nema fiskalnih računa
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {receipts.map((receipt) => (
                                <Table.Row key={receipt.id}>
                                    <Table.Cell>
                                        <LocalDateTime>
                                            {receipt.createdAt}
                                        </LocalDateTime>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Link href={KnownPages.Receipt(receipt.id)}>
                                            {receipt.yearReceiptNumber}
                                        </Link>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Chip color={getCisStatusColor(receipt.cisStatus)} className="w-fit">
                                            {getCisStatusLabel(receipt.cisStatus)}
                                        </Chip>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Chip className="w-fit">
                                            {receipt.totalAmount}{receipt.currency === 'eur' ? '€' : receipt.currency || 'eur'}
                                        </Chip>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </CardOverflow>
            </Card>
        </Stack>
    );
}
