import { getReceiptsByStatus } from '@gredice/storage';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';

export const dynamic = 'force-dynamic';

function getCisStatusColor(cisStatus: string) {
    switch (cisStatus) {
        case 'sent':
            return 'info';
        case 'pending':
            return 'warning';
        case 'failed':
            return 'error';
        case 'confirmed':
            return 'success';
        default:
            return 'neutral';
    }
}

function getCisStatusLabel(cisStatus: string) {
    switch (cisStatus) {
        case 'sent':
            return 'Poslano';
        case 'pending':
            return 'Na čekanju';
        case 'failed':
            return 'Neuspješno';
        case 'confirmed':
            return 'Potvrđeno';
        default:
            return cisStatus;
    }
}

export default async function ReceiptsPage() {
    await auth(['admin']);

    // Get receipts with all statuses - this is a simplified approach
    const [sentReceipts, pendingReceipts, failedReceipts, confirmedReceipts] =
        await Promise.all([
            getReceiptsByStatus('sent'),
            getReceiptsByStatus('pending'),
            getReceiptsByStatus('failed'),
            getReceiptsByStatus('confirmed'),
        ]);

    const receipts = [
        ...sentReceipts,
        ...pendingReceipts,
        ...failedReceipts,
        ...confirmedReceipts,
    ];

    return (
        <Stack spacing={4}>
            <Row spacing={2}>
                <Chip color="primary">{receipts.length}</Chip>
            </Row>
            <Card>
                <CardOverflow>
                    {receipts.length === 0 ? (
                        <div className="p-4">
                            <NoDataPlaceholder>
                                Nema fiskalnih računa
                            </NoDataPlaceholder>
                        </div>
                    ) : (
                        <ul className="divide-y">
                            {receipts.map((receipt) => (
                                <li
                                    key={receipt.id}
                                    className="flex min-w-0 flex-col gap-3 px-3 py-3 hover:bg-muted/40 sm:px-4 md:flex-row md:items-center md:justify-between"
                                >
                                    <Stack spacing={1} className="min-w-0">
                                        <Typography
                                            level="body1"
                                            component="h3"
                                            semiBold
                                            className="min-w-0"
                                        >
                                            <Link
                                                href={KnownPages.Receipt(
                                                    receipt.id,
                                                )}
                                            >
                                                {receipt.yearReceiptNumber}
                                            </Link>
                                        </Typography>
                                        <Typography
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            Datum izdavanja:{' '}
                                            <LocalDateTime>
                                                {receipt.createdAt}
                                            </LocalDateTime>
                                        </Typography>
                                    </Stack>
                                    <div className="flex min-w-0 flex-wrap items-center gap-2 md:justify-end">
                                        <Chip
                                            color={getCisStatusColor(
                                                receipt.cisStatus,
                                            )}
                                        >
                                            CIS:{' '}
                                            {getCisStatusLabel(
                                                receipt.cisStatus,
                                            )}
                                        </Chip>
                                        <Chip>
                                            Iznos: {receipt.totalAmount}
                                            {receipt.currency === 'eur'
                                                ? '€'
                                                : receipt.currency || 'eur'}
                                        </Chip>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardOverflow>
            </Card>
        </Stack>
    );
}
