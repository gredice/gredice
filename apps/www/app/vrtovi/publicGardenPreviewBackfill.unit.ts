import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    gardenPreviewHeight,
    gardenPreviewRendererVersion,
    gardenPreviewWidth,
} from '@gredice/js/gardenPreviews';
import {
    PublicGardenPreviewBackfillHttpError,
    runSequentialPublicGardenPreviewBackfill,
} from './publicGardenPreviewBackfillQueue.ts';

function source(
    gardenId: number,
    previewImage: {
        height: number;
        rendererVersion: string;
        sourceRevision: string;
        width: number;
    } | null = null,
) {
    return {
        garden: { id: gardenId },
        previewImage,
        sourceRevision: `revision-${gardenId.toString()}`,
    };
}

function currentPreview(gardenId: number) {
    return {
        height: gardenPreviewHeight,
        rendererVersion: gardenPreviewRendererVersion,
        sourceRevision: `revision-${gardenId.toString()}`,
        width: gardenPreviewWidth,
    };
}

describe('runSequentialPublicGardenPreviewBackfill', () => {
    it('loads, captures, and uploads exactly one garden at a time', async () => {
        const events: string[] = [];
        const signal = new AbortController().signal;

        await runSequentialPublicGardenPreviewBackfill({
            gardenIds: [1, 2],
            signal,
            loadGarden: async (gardenId) => {
                events.push(`load:${gardenId.toString()}`);
                return source(gardenId);
            },
            captureGarden: async ({ garden }) => {
                events.push(`capture:${garden.id.toString()}`);
                return new Blob(['preview'], { type: 'image/webp' });
            },
            uploadPreview: async (gardenId) => {
                events.push(`upload:${gardenId.toString()}`);
            },
        });

        assert.deepEqual(events, [
            'load:1',
            'capture:1',
            'upload:1',
            'load:2',
            'capture:2',
            'upload:2',
        ]);
    });

    it('inspects current previews without capture, upload, or success accounting', async () => {
        const events: string[] = [];
        const failed: number[] = [];
        const succeeded: number[] = [];
        const signal = new AbortController().signal;

        await runSequentialPublicGardenPreviewBackfill({
            gardenIds: [1, 2],
            signal,
            loadGarden: async (gardenId) => {
                events.push(`load:${gardenId.toString()}`);
                return source(gardenId, currentPreview(gardenId));
            },
            captureGarden: async ({ garden }) => {
                events.push(`capture:${garden.id.toString()}`);
                return new Blob(['preview'], { type: 'image/webp' });
            },
            uploadPreview: async (gardenId) => {
                events.push(`upload:${gardenId.toString()}`);
            },
            onGardenError: (gardenId) => failed.push(gardenId),
            onGardenSuccess: (gardenId) => succeeded.push(gardenId),
        });

        assert.deepEqual(events, ['load:1', 'load:2']);
        assert.deepEqual(failed, []);
        assert.deepEqual(succeeded, []);
    });

    it('captures previews with stale revision, renderer, or dimensions', async () => {
        const captured: number[] = [];
        const uploaded: number[] = [];
        const succeeded: number[] = [];
        const signal = new AbortController().signal;
        const previews = new Map([
            [
                1,
                {
                    ...currentPreview(1),
                    sourceRevision: 'stale-revision',
                },
            ],
            [
                2,
                {
                    ...currentPreview(2),
                    rendererVersion: 'garden-preview-old',
                },
            ],
            [
                3,
                {
                    ...currentPreview(3),
                    width: gardenPreviewWidth - 1,
                },
            ],
            [
                4,
                {
                    ...currentPreview(4),
                    height: gardenPreviewHeight - 1,
                },
            ],
        ]);

        await runSequentialPublicGardenPreviewBackfill({
            gardenIds: [1, 2, 3, 4, 5],
            signal,
            loadGarden: async (gardenId) =>
                source(
                    gardenId,
                    gardenId === 5
                        ? currentPreview(gardenId)
                        : (previews.get(gardenId) ?? null),
                ),
            captureGarden: async ({ garden }) => {
                captured.push(garden.id);
                return new Blob(['preview'], { type: 'image/webp' });
            },
            uploadPreview: async (gardenId) => {
                uploaded.push(gardenId);
            },
            onGardenSuccess: (gardenId) => succeeded.push(gardenId),
        });

        assert.deepEqual(captured, [1, 2, 3, 4]);
        assert.deepEqual(uploaded, [1, 2, 3, 4]);
        assert.deepEqual(succeeded, [1, 2, 3, 4]);
    });

    it('retries transient failures once and continues past terminal failures', async () => {
        const attempts = new Map<number, number>();
        const succeeded: number[] = [];
        const failed: number[] = [];
        const signal = new AbortController().signal;

        await runSequentialPublicGardenPreviewBackfill({
            gardenIds: [1, 2, 3],
            signal,
            loadGarden: async (gardenId) => {
                if (gardenId === 2) {
                    throw new PublicGardenPreviewBackfillHttpError(404, 'load');
                }
                return source(gardenId);
            },
            captureGarden: async () =>
                new Blob(['preview'], { type: 'image/webp' }),
            uploadPreview: async (gardenId) => {
                const attempt = (attempts.get(gardenId) ?? 0) + 1;
                attempts.set(gardenId, attempt);
                if (gardenId === 1 && attempt === 1) {
                    throw new PublicGardenPreviewBackfillHttpError(
                        503,
                        'upload',
                    );
                }
            },
            onGardenError: (gardenId) => failed.push(gardenId),
            onGardenSuccess: (gardenId) => succeeded.push(gardenId),
            waitBeforeRetry: async () => undefined,
        });

        assert.deepEqual(succeeded, [1, 3]);
        assert.deepEqual(failed, [2]);
        assert.equal(attempts.get(1), 2);
        assert.equal(attempts.has(2), false);
    });

    it('passes Retry-After timing to the bounded retry wait', async () => {
        const waits: unknown[] = [];
        let uploadAttempt = 0;
        const signal = new AbortController().signal;

        await runSequentialPublicGardenPreviewBackfill({
            gardenIds: [1],
            signal,
            loadGarden: async () => source(1),
            captureGarden: async () =>
                new Blob(['preview'], { type: 'image/webp' }),
            uploadPreview: async () => {
                uploadAttempt += 1;
                if (uploadAttempt === 1) {
                    throw new PublicGardenPreviewBackfillHttpError(
                        429,
                        'upload',
                        5000,
                    );
                }
            },
            waitBeforeRetry: async (_signal, error) => {
                waits.push(error);
            },
        });

        assert.equal(uploadAttempt, 2);
        assert.equal(waits.length, 1);
        const retryError = waits[0];
        assert.ok(retryError instanceof PublicGardenPreviewBackfillHttpError);
        assert.equal(retryError.retryAfterMs, 5000);
    });
});
