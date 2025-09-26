import { ensureReceiptPdf, getReceiptPdfAsset } from '@gredice/receipts';
import { getReceipt } from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { authValidator } from '../../lib/hono/authValidator';
import { downloadReceiptPdf, uploadReceiptPdf } from '../../lib/r2Client';

const app = new Hono().get(
    '/:receiptId/pdf',
    describeRoute({
        description: 'Download receipt PDF',
    }),
    authValidator(['user', 'admin']),
    async (context) => {
        const { receiptId } = context.req.param();
        const id = Number.parseInt(receiptId, 10);
        if (Number.isNaN(id)) {
            return context.json({ error: 'Invalid receipt id' }, 400);
        }

        const authContext = context.get('authContext');
        const receipt = await getReceipt(id);
        if (!receipt) {
            return context.json({ error: 'Receipt not found' }, 404);
        }

        const isAdmin = authContext.role === 'admin';
        if (!isAdmin) {
            const accountId = authContext.accountId;
            if (!accountId || receipt.invoice?.accountId !== accountId) {
                return context.json({ error: 'Forbidden' }, 403);
            }
        }

        if (!receipt.pdfStoragePath || receipt.pdfStatus !== 'succeeded') {
            const pdfResult = await ensureReceiptPdf(
                id,
                async ({ fileName, data }) => {
                    const key = `receipts/${fileName}`;
                    await uploadReceiptPdf(key, data);
                    return { storagePath: key };
                },
                { force: true },
            );
            if (pdfResult.status === 'failed') {
                return context.json({ error: pdfResult.error ?? 'Failed to generate PDF' }, 500);
            }
        }

        const asset = await getReceiptPdfAsset(id, async (storagePath) => {
            return downloadReceiptPdf(storagePath);
        });

        return new Response(asset.data, {
            headers: {
                'Content-Type': asset.contentType ?? 'application/pdf',
                'Content-Length': asset.contentLength?.toString() ?? asset.data.length.toString(),
                'Content-Disposition': `attachment; filename="${asset.fileName}"`,
            },
        });
    },
);

export default app;
