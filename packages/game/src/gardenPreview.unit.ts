import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    type GardenPreviewImage,
    gardenPreviewHeight,
    gardenPreviewRendererVersion,
    gardenPreviewRendererVersionHeader,
    gardenPreviewSourceRevisionHeader,
    gardenPreviewWidth,
    getGardenPreviewCaptureDelayMs,
    getGardenPreviewUploadHeaders,
    getGardenPreviewUploadUrl,
    shouldCaptureGardenPreview,
    staleGardenPreviewQuietPeriodMs,
} from './gardenPreview';

function previewImage(
    overrides: Partial<GardenPreviewImage> = {},
): GardenPreviewImage {
    return {
        url: 'https://blob.example/garden.webp',
        width: gardenPreviewWidth,
        height: gardenPreviewHeight,
        capturedAt: '2026-07-11T10:00:00.000Z',
        sourceRevision: 'revision-1',
        rendererVersion: gardenPreviewRendererVersion,
        ...overrides,
    };
}

describe('garden preview capture policy', () => {
    it('captures only authenticated public gardens with a stale preview', () => {
        assert.equal(
            shouldCaptureGardenPreview({
                enabled: true,
                isPublic: true,
                previewImage: null,
                sourceRevision: 'revision-1',
            }),
            true,
        );
        assert.equal(
            shouldCaptureGardenPreview({
                enabled: true,
                isPublic: true,
                previewImage: previewImage(),
                sourceRevision: 'revision-1',
            }),
            false,
        );
        assert.equal(
            shouldCaptureGardenPreview({
                enabled: false,
                isPublic: true,
                previewImage: null,
                sourceRevision: 'revision-1',
            }),
            false,
        );
        assert.equal(
            shouldCaptureGardenPreview({
                enabled: true,
                isPublic: false,
                previewImage: null,
                sourceRevision: 'revision-1',
            }),
            false,
        );
        assert.equal(
            shouldCaptureGardenPreview({
                enabled: true,
                isPublic: true,
                previewImage: null,
                sourceRevision: null,
            }),
            false,
        );
    });

    it('recaptures when source, renderer, or dimensions change', () => {
        for (const stalePreview of [
            previewImage({ sourceRevision: 'revision-0' }),
            previewImage({ rendererVersion: 'garden-preview-v0' }),
            previewImage({ width: 800 }),
            previewImage({ height: 420 }),
        ]) {
            assert.equal(
                shouldCaptureGardenPreview({
                    enabled: true,
                    isPublic: true,
                    previewImage: stalePreview,
                    sourceRevision: 'revision-1',
                }),
                true,
            );
        }
    });
});

describe('garden preview API contract', () => {
    it('builds the proxied raw upload request metadata', () => {
        assert.equal(
            getGardenPreviewUploadUrl(42),
            '/api/gredice/api/gardens/42/preview',
        );
        assert.deepEqual(getGardenPreviewUploadHeaders('revision-1'), {
            'Content-Type': 'image/webp',
            [gardenPreviewSourceRevisionHeader]: 'revision-1',
            [gardenPreviewRendererVersionHeader]: gardenPreviewRendererVersion,
        });
    });
});

describe('garden preview capture scheduling', () => {
    it('coalesces rapid edits after a recent capture', () => {
        const now = Date.parse('2026-07-11T10:00:30.000Z');

        assert.equal(
            getGardenPreviewCaptureDelayMs({
                now,
                previewImage: previewImage({
                    capturedAt: '2026-07-11T10:00:00.000Z',
                    sourceRevision: 'revision-0',
                }),
                sourceRevision: 'revision-1',
            }),
            staleGardenPreviewQuietPeriodMs,
        );
    });

    it('captures missing, renderer-stale, and older previews promptly', () => {
        const now = Date.parse('2026-07-11T11:00:00.000Z');

        assert.equal(
            getGardenPreviewCaptureDelayMs({
                now,
                previewImage: null,
                sourceRevision: 'revision-1',
            }),
            0,
        );
        assert.equal(
            getGardenPreviewCaptureDelayMs({
                now,
                previewImage: previewImage({
                    capturedAt: '2026-07-11T10:59:30.000Z',
                    rendererVersion: 'garden-preview-v0',
                }),
                sourceRevision: 'revision-1',
            }),
            0,
        );
        assert.equal(
            getGardenPreviewCaptureDelayMs({
                now,
                previewImage: previewImage({
                    capturedAt: '2026-07-11T10:00:00.000Z',
                    sourceRevision: 'revision-0',
                }),
                sourceRevision: 'revision-1',
            }),
            0,
        );
    });
});
