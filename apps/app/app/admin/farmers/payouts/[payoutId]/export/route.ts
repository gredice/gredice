import { getPayoutRequestWithDetails } from '@gredice/storage';
import { auth } from '../../../../../../lib/auth/auth';

export const dynamic = 'force-dynamic';

function csvCell(value: string | number | Date | null | undefined) {
    if (value === null || value === undefined) {
        return '';
    }

    const normalized =
        value instanceof Date ? value.toISOString() : String(value);

    return `"${normalized.replaceAll('"', '""')}"`;
}

function csvRow(values: (string | number | Date | null | undefined)[]) {
    return values.map(csvCell).join(',');
}

function payoutExportFilename(payoutId: number) {
    return `farmer-payout-${payoutId}.csv`;
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ payoutId: string }> },
) {
    await auth(['admin']);

    const { payoutId } = await params;
    const id = Number.parseInt(payoutId, 10);
    if (Number.isNaN(id)) {
        return new Response('Payout request not found.', { status: 404 });
    }

    const payout = await getPayoutRequestWithDetails(id);
    if (!payout) {
        return new Response('Payout request not found.', { status: 404 });
    }

    const rows = [
        csvRow([
            'Payout ID',
            'Farmer',
            'Farm',
            'Status',
            'Requested amount',
            'Currency',
            'Requested at',
            'Approved at',
            'Paid at',
        ]),
        csvRow([
            payout.id,
            payout.displayName ?? payout.userName,
            payout.farmName,
            payout.status,
            payout.requestedAmount,
            payout.currency,
            payout.createdAt,
            payout.approvedAt,
            payout.paidAt,
        ]),
        '',
        csvRow([
            'Type',
            'Label',
            'Entity type',
            'Entity ID',
            'Operation count',
            'Duration per item (min)',
            'Total duration (min)',
            'Price per item',
            'Total amount',
            'Currency',
        ]),
        ...payout.items.map((item) =>
            csvRow([
                'item',
                item.label,
                item.entityTypeName,
                item.entityId,
                item.operationCount,
                item.durationMinutes,
                item.totalDurationMinutes,
                item.pricePerUnit,
                item.totalAmount,
                item.currency,
            ]),
        ),
        ...payout.adjustments.map((adjustment) =>
            csvRow([
                'adjustment',
                adjustment.label,
                '',
                '',
                '',
                '',
                '',
                '',
                adjustment.amount,
                adjustment.currency,
            ]),
        ),
    ];
    const csv = `\uFEFF${rows.join('\n')}\n`;

    return new Response(csv, {
        headers: {
            'Cache-Control': 'no-store',
            'Content-Disposition': `attachment; filename="${payoutExportFilename(
                payout.id,
            )}"`,
            'Content-Type': 'text/csv; charset=utf-8',
        },
    });
}
