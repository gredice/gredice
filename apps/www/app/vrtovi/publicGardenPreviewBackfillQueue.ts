import {
    gardenPreviewHeight,
    gardenPreviewRendererVersion,
    gardenPreviewWidth,
} from '@gredice/js/gardenPreviews';

export type PublicGardenPreviewBackfillImage = {
    height: number;
    rendererVersion: string;
    sourceRevision: string;
    width: number;
};

export type PublicGardenPreviewBackfillSource<TGarden> = {
    garden: TGarden;
    previewImage: PublicGardenPreviewBackfillImage | null;
    sourceRevision: string;
};

type PublicGardenPreviewBackfillOptions<TGarden> = {
    captureGarden: (
        source: PublicGardenPreviewBackfillSource<TGarden>,
        signal: AbortSignal,
    ) => Promise<Blob>;
    gardenIds: number[];
    loadGarden: (
        gardenId: number,
        signal: AbortSignal,
    ) => Promise<PublicGardenPreviewBackfillSource<TGarden>>;
    onGardenError?: (gardenId: number, error: unknown) => void;
    onGardenSuccess?: (gardenId: number) => void;
    signal: AbortSignal;
    uploadPreview: (
        gardenId: number,
        sourceRevision: string,
        blob: Blob,
        signal: AbortSignal,
    ) => Promise<void>;
    waitBeforeRetry?: (signal: AbortSignal, error: unknown) => Promise<void>;
};

const maximumAttemptsPerGarden = 2;
const retryDelayMs = 1250;
const maximumRetryAfterMs = 30_000;

export function isPublicGardenPreviewCurrent<TGarden>({
    previewImage,
    sourceRevision,
}: PublicGardenPreviewBackfillSource<TGarden>) {
    return (
        previewImage?.sourceRevision === sourceRevision &&
        previewImage.rendererVersion === gardenPreviewRendererVersion &&
        previewImage.width === gardenPreviewWidth &&
        previewImage.height === gardenPreviewHeight
    );
}

export class PublicGardenPreviewBackfillHttpError extends Error {
    readonly retryable: boolean;
    readonly retryAfterMs?: number;
    readonly status: number;

    constructor(
        status: number,
        operation: 'load' | 'upload',
        retryAfterMs?: number,
    ) {
        super(
            `Garden preview ${operation} failed with status ${status.toString()}.`,
        );
        this.name = 'PublicGardenPreviewBackfillHttpError';
        this.status = status;
        this.retryAfterMs = retryAfterMs;
        this.retryable =
            status === 408 ||
            status === 409 ||
            status === 425 ||
            status === 429 ||
            status >= 500;
    }
}

function isAbortError(error: unknown, signal: AbortSignal) {
    return (
        signal.aborted ||
        (error instanceof DOMException && error.name === 'AbortError')
    );
}

function shouldRetry(error: unknown) {
    return !(
        error instanceof PublicGardenPreviewBackfillHttpError &&
        !error.retryable
    );
}

function defaultWaitBeforeRetry(signal: AbortSignal, error: unknown) {
    return new Promise<void>((resolve, reject) => {
        signal.throwIfAborted();
        const waitMs =
            error instanceof PublicGardenPreviewBackfillHttpError &&
            error.retryAfterMs !== undefined
                ? Math.min(error.retryAfterMs, maximumRetryAfterMs)
                : retryDelayMs;
        const timeout = window.setTimeout(() => {
            signal.removeEventListener('abort', handleAbort);
            resolve();
        }, waitMs);
        function handleAbort() {
            window.clearTimeout(timeout);
            reject(signal.reason);
        }
        signal.addEventListener('abort', handleAbort, { once: true });
    });
}

/**
 * Runs the backfill strictly one garden at a time so only one WebGL renderer is
 * ever mounted. A failed garden is retried once, then the queue continues.
 */
export async function runSequentialPublicGardenPreviewBackfill<TGarden>({
    captureGarden,
    gardenIds,
    loadGarden,
    onGardenError,
    onGardenSuccess,
    signal,
    uploadPreview,
    waitBeforeRetry = defaultWaitBeforeRetry,
}: PublicGardenPreviewBackfillOptions<TGarden>) {
    for (const gardenId of gardenIds) {
        let terminalError: unknown;

        for (
            let attempt = 0;
            attempt < maximumAttemptsPerGarden;
            attempt += 1
        ) {
            signal.throwIfAborted();
            try {
                const source = await loadGarden(gardenId, signal);
                if (isPublicGardenPreviewCurrent(source)) {
                    terminalError = undefined;
                    break;
                }
                const blob = await captureGarden(source, signal);
                await uploadPreview(
                    gardenId,
                    source.sourceRevision,
                    blob,
                    signal,
                );
                terminalError = undefined;
                onGardenSuccess?.(gardenId);
                break;
            } catch (error) {
                if (isAbortError(error, signal)) {
                    throw error;
                }

                terminalError = error;
                const hasAnotherAttempt =
                    attempt + 1 < maximumAttemptsPerGarden;
                if (!hasAnotherAttempt || !shouldRetry(error)) {
                    break;
                }
                await waitBeforeRetry(signal, error);
            }
        }

        if (terminalError !== undefined) {
            onGardenError?.(gardenId, terminalError);
        }
    }
}
