import { getReceiptsByStatus } from "@gredice/storage";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Table } from "@signalco/ui-primitives/Table";
import { auth } from "../../../lib/auth/auth";
import { KnownPages } from "../../../src/KnownPages";
import Link from "next/link";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";
import { LocaleDateTime } from "../../../components/shared/LocaleDateTime";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";

export const dynamic = 'force-dynamic';

function getCisStatusColor(cisStatus: string) {
    switch (cisStatus) {
        case 'sent': return 'success';
        case 'pending': return 'warning';
        case 'failed': return 'error';
        default: return 'neutral';
    }
}

function getCisStatusLabel(cisStatus: string) {
    switch (cisStatus) {
        case 'sent': return 'Poslano';
        case 'pending': return 'Na čekanju';
        case 'failed': return 'Neuspješno';
        default: return cisStatus;
    }
}

export default async function ReceiptsPage() {
    await auth(['admin']);

    // Get receipts with all statuses - this is a simplified approach
    const [sentReceipts, pendingReceipts, failedReceipts] = await Promise.all([
        getReceiptsByStatus('sent'),
        getReceiptsByStatus('pending'),
        getReceiptsByStatus('failed')
    ]);

    const receipts = [...sentReceipts, ...pendingReceipts, ...failedReceipts];

    return (
        <Stack spacing={2}>
            <Row spacing={1}>
                <Typography level="h1" className="text-2xl" semiBold>{"Fiskalni računi"}</Typography>
                <Chip color="primary" size="sm">{receipts.length}</Chip>
            </Row>
            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Račun</Table.Head>
                                <Table.Head>JIR</Table.Head>
                                <Table.Head>ZKI</Table.Head>
                                <Table.Head>CIS Status</Table.Head>
                                <Table.Head>Iznos</Table.Head>
                                <Table.Head>Datum izdavanja</Table.Head>
                                <Table.Head>Datum fiskaalizacije</Table.Head>
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
                            {receipts.map((receipt: any) => (
                                <Table.Row key={receipt.id}>
                                    <Table.Cell>
                                        <Link href={KnownPages.Receipt(receipt.id)}>
                                            {receipt.invoice?.invoiceNumber || `#${receipt.invoiceId}`}
                                        </Link>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Typography className="font-mono text-sm">
                                            {receipt.jir || 'N/A'}
                                        </Typography>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Typography className="font-mono text-sm">
                                            {receipt.zki || 'N/A'}
                                        </Typography>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Chip color={getCisStatusColor(receipt.cisStatus)} size="sm" className="w-fit">
                                            <Typography noWrap>
                                                {getCisStatusLabel(receipt.cisStatus)}
                                            </Typography>
                                        </Chip>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Chip color="success" size="sm" className="w-fit">
                                            <Typography noWrap>
                                                {receipt.invoice?.currency === 'EUR' ? '€' : receipt.invoice?.currency || 'EUR'} {receipt.totalAmount}
                                            </Typography>
                                        </Chip>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <LocaleDateTime time={false}>
                                            {receipt.invoice?.issueDate}
                                        </LocaleDateTime>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <LocaleDateTime>
                                            {receipt.cisTimestamp}
                                        </LocaleDateTime>
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
