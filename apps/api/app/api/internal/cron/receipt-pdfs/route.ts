import { ensureReceiptPdf } from '@gredice/receipts';
import { getReceiptsNeedingPdf } from '@gredice/storage';
import type { NextRequest } from 'next/server';
import { uploadReceiptPdf } from '../../../../../lib/r2Client';

export const dynamic = 'force-dynamic';

const DEFAULT_BATCH_SIZE = 5;

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', {
            status: 401,
        });
    }

    try {
        const receipts = await getReceiptsNeedingPdf(DEFAULT_BATCH_SIZE);
        const processed: Array<{
            receiptId: number;
            status: string;
            error?: string;
        }> = [];

        for (const receipt of receipts) {
            const result = await ensureReceiptPdf(
                receipt.id,
                async ({ fileName, data }) => {
                    const key = `receipts/${fileName}`;
                    await uploadReceiptPdf(key, data);
                    return { storagePath: key };
                },
            );
            processed.push({
                receiptId: receipt.id,
                status: result.status,
                error: result.status === 'failed' ? result.error : undefined,
            });
        }

        return Response.json({
            success: true,
            processed,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Failed to regenerate receipt PDFs:', error);
        return Response.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            },
            { status: 500 },
        );
    }
}
