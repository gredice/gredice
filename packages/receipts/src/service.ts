import 'server-only';
import { getReceipt, updateReceiptPdfMetadata } from '@gredice/storage';
import { buildReceiptPdfBuffer } from './generator';

type ReceiptWithRelations = NonNullable<Awaited<ReturnType<typeof getReceipt>>>;

type UploadResult = {
    storagePath: string;
};

type UploadHandler = (payload: {
    fileName: string;
    data: Buffer;
}) => Promise<UploadResult>;

type DownloadResult = {
    data: Buffer;
    contentType?: string;
    contentLength?: number;
};

type DownloadHandler = (storagePath: string) => Promise<DownloadResult>;

type ReceiptPdfResult =
    | {
          status: 'succeeded';
          storagePath: string;
          fileName: string;
      }
    | {
          status: 'skipped';
          reason: 'not_fiscalized' | 'already_generated';
          storagePath?: string;
          fileName?: string;
      }
    | {
          status: 'failed';
          error: string;
      };

function sanitizeForFileName(value: string | null | undefined) {
    if (!value) {
        return undefined;
    }
    return value.replace(/[^a-zA-Z0-9-_]+/g, '-');
}

function resolveFileName(receipt: ReceiptWithRelations) {
    const base =
        sanitizeForFileName(receipt.yearReceiptNumber) ||
        sanitizeForFileName(receipt.receiptNumber) ||
        `receipt-${receipt.id}`;
    return `Fiskalni-racun-${base}.pdf`;
}

export async function ensureReceiptPdf(
    receiptId: number,
    uploader: UploadHandler,
    options?: { force?: boolean },
): Promise<ReceiptPdfResult> {
    const receipt = await getReceipt(receiptId);
    if (!receipt) {
        return { status: 'failed', error: 'Receipt not found' };
    }

    if (receipt.cisStatus !== 'confirmed') {
        return { status: 'skipped', reason: 'not_fiscalized' };
    }

    if (!options?.force && receipt.pdfStatus === 'succeeded' && receipt.pdfStoragePath) {
        return {
            status: 'skipped',
            reason: 'already_generated',
            storagePath: receipt.pdfStoragePath,
            fileName: resolveFileName(receipt),
        };
    }

    const attemptStartedAt = new Date();
    await updateReceiptPdfMetadata(receiptId, {
        pdfStatus: 'processing',
        pdfErrorMessage: null,
        pdfLastAttemptAt: attemptStartedAt,
    });

    try {
        const pdfBuffer = await buildReceiptPdfBuffer(receipt);
        const fileName = resolveFileName(receipt);
        const { storagePath } = await uploader({ fileName, data: pdfBuffer });

        await updateReceiptPdfMetadata(receiptId, {
            pdfStatus: 'succeeded',
            pdfStoragePath: storagePath,
            pdfGeneratedAt: new Date(),
            pdfErrorMessage: null,
        });

        return { status: 'succeeded', storagePath, fileName };
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : 'Unexpected error while generating receipt PDF';
        console.error('Failed to generate receipt PDF', error);
        await updateReceiptPdfMetadata(receiptId, {
            pdfStatus: 'failed',
            pdfErrorMessage: message,
        });
        return { status: 'failed', error: message };
    }
}

export async function getReceiptPdfAsset(
    receiptId: number,
    downloader: DownloadHandler,
) {
    const receipt = await getReceipt(receiptId);
    if (!receipt) {
        throw new Error('Receipt not found');
    }
    if (!receipt.pdfStoragePath || receipt.pdfStatus !== 'succeeded') {
        throw new Error('Receipt PDF is not available');
    }

    const download = await downloader(receipt.pdfStoragePath);
    return {
        ...download,
        fileName: resolveFileName(receipt),
        generatedAt: receipt.pdfGeneratedAt ?? null,
    };
}
