import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    gardenPreviewMinimumUploadIntervalMs,
    gardenPreviewRendererVersion,
} from '@gredice/js/gardenPreviews';
import {
    canAccessGardenPreviewSource,
    createGardenPreviewSourceRevision,
    type GardenPreviewRevisionInput,
    getGardenPreviewUploadDecision,
    readWebpDimensions,
} from './gardenPreview';

function storedPreview(
    overrides: Partial<{
        capturedAt: Date;
        height: number;
        rendererVersion: string;
        sourceRevision: string;
        width: number;
    }> = {},
) {
    return {
        capturedAt: new Date('2026-07-11T10:00:00.000Z'),
        height: 630,
        rendererVersion: gardenPreviewRendererVersion,
        sourceRevision: 'revision-1',
        width: 1200,
        ...overrides,
    };
}

describe('getGardenPreviewUploadDecision', () => {
    it('returns the existing preview when the current render is unchanged', () => {
        const preview = storedPreview();

        assert.deepEqual(
            getGardenPreviewUploadDecision({
                currentPreview: preview,
                height: 630,
                now: new Date('2026-07-11T10:00:01.000Z'),
                rendererVersion: gardenPreviewRendererVersion,
                sourceRevision: 'revision-1',
                width: 1200,
            }),
            { preview, status: 'unchanged' },
        );
    });

    it('rate-limits a changed render captured inside the minimum interval', () => {
        const capturedAt = new Date('2026-07-11T10:00:00.000Z');
        const now = new Date(
            capturedAt.getTime() + gardenPreviewMinimumUploadIntervalMs - 5000,
        );

        assert.deepEqual(
            getGardenPreviewUploadDecision({
                currentPreview: storedPreview({ capturedAt }),
                height: 630,
                now,
                rendererVersion: gardenPreviewRendererVersion,
                sourceRevision: 'revision-2',
                width: 1200,
            }),
            { retryAfterSeconds: 5, status: 'rate-limited' },
        );
    });

    it('allows missing, expired, and old-renderer previews to proceed', () => {
        const inputs = [
            null,
            storedPreview({
                capturedAt: new Date(
                    Date.parse('2026-07-11T10:00:00.000Z') -
                        gardenPreviewMinimumUploadIntervalMs,
                ),
            }),
            storedPreview({ rendererVersion: 'garden-preview-v0' }),
        ];

        for (const currentPreview of inputs) {
            assert.deepEqual(
                getGardenPreviewUploadDecision({
                    currentPreview,
                    height: 630,
                    now: new Date('2026-07-11T10:00:00.000Z'),
                    rendererVersion: gardenPreviewRendererVersion,
                    sourceRevision: 'revision-2',
                    width: 1200,
                }),
                { status: 'proceed' },
            );
        }
    });
});

describe('canAccessGardenPreviewSource', () => {
    it('allows owners to capture private or public gardens', () => {
        assert.equal(
            canAccessGardenPreviewSource({
                gardenAccountId: 'owner-account',
                gardenIsPublic: false,
                requestAccountId: 'owner-account',
                requestRole: 'user',
            }),
            true,
        );
    });

    it('allows administrators to capture another account public garden', () => {
        assert.equal(
            canAccessGardenPreviewSource({
                gardenAccountId: 'owner-account',
                gardenIsPublic: true,
                requestAccountId: 'admin-account',
                requestRole: 'admin',
            }),
            true,
        );
    });

    it('does not expose another account private garden to administrators', () => {
        assert.equal(
            canAccessGardenPreviewSource({
                gardenAccountId: 'owner-account',
                gardenIsPublic: false,
                requestAccountId: 'admin-account',
                requestRole: 'admin',
            }),
            false,
        );
    });

    it('does not let ordinary users capture another account public garden', () => {
        assert.equal(
            canAccessGardenPreviewSource({
                gardenAccountId: 'owner-account',
                gardenIsPublic: true,
                requestAccountId: 'other-account',
                requestRole: 'user',
            }),
            false,
        );
    });
});

function previewSource(
    overrides: Partial<GardenPreviewRevisionInput> = {},
): GardenPreviewRevisionInput {
    return {
        backgroundPalette: 'current',
        farmId: 1,
        homeCamera: {
            position: [10, 10, 10],
            target: [0, 0, 0],
            zoom: 100,
        },
        isSandbox: false,
        latitude: 45.8,
        longitude: 16,
        raisedBeds: [
            {
                id: 2,
                fields: [{ id: 22, positionIndex: 1, plantStatus: 'sowed' }],
                appliedOperations: [],
            },
            {
                id: 1,
                fields: [{ id: 11, positionIndex: 0, plantStatus: 'ready' }],
                appliedOperations: [],
            },
        ],
        stacks: {
            '0': {
                '0': [
                    {
                        id: 'block-1',
                        name: 'Block_Grass',
                        rotation: 0,
                        variant: null,
                    },
                ],
            },
        },
        ...overrides,
    };
}

function vp8xWebp(width: number, height: number) {
    const bytes = new Uint8Array(48);
    bytes.set(Buffer.from('RIFF'), 0);
    bytes.set(Buffer.from('WEBP'), 8);
    bytes.set(Buffer.from('VP8X'), 12);
    bytes[16] = 10;

    const storedWidth = width - 1;
    const storedHeight = height - 1;
    bytes[24] = storedWidth & 0xff;
    bytes[25] = (storedWidth >> 8) & 0xff;
    bytes[26] = (storedWidth >> 16) & 0xff;
    bytes[27] = storedHeight & 0xff;
    bytes[28] = (storedHeight >> 8) & 0xff;
    bytes[29] = (storedHeight >> 16) & 0xff;
    bytes.set(Buffer.from('VP8 '), 30);
    bytes[34] = 10;
    bytes.set([0x9d, 0x01, 0x2a], 41);
    bytes[44] = width & 0xff;
    bytes[45] = (width >> 8) & 0x3f;
    bytes[46] = height & 0xff;
    bytes[47] = (height >> 8) & 0x3f;
    return bytes;
}

function animatedVp8xWebp(width: number, height: number) {
    const bytes = new Uint8Array(56);
    bytes.set(vp8xWebp(width, height));
    bytes[20] = 0x02;
    bytes.set(Buffer.from('ANIM'), 48);
    return bytes;
}

function vp8Webp(width: number, height: number) {
    const bytes = new Uint8Array(30);
    bytes.set(Buffer.from('RIFF'), 0);
    bytes.set(Buffer.from('WEBP'), 8);
    bytes.set(Buffer.from('VP8 '), 12);
    bytes[16] = 10;
    bytes.set([0x9d, 0x01, 0x2a], 23);
    bytes[26] = width & 0xff;
    bytes[27] = (width >> 8) & 0x3f;
    bytes[28] = height & 0xff;
    bytes[29] = (height >> 8) & 0x3f;
    return bytes;
}

function vp8lWebp(width: number, height: number) {
    const bytes = new Uint8Array(26);
    const storedWidth = width - 1;
    const storedHeight = height - 1;
    bytes.set(Buffer.from('RIFF'), 0);
    bytes.set(Buffer.from('WEBP'), 8);
    bytes.set(Buffer.from('VP8L'), 12);
    bytes[16] = 5;
    bytes[20] = 0x2f;
    bytes[21] = storedWidth & 0xff;
    bytes[22] = ((storedWidth >> 8) & 0x3f) | ((storedHeight & 0x03) << 6);
    bytes[23] = (storedHeight >> 2) & 0xff;
    bytes[24] = (storedHeight >> 10) & 0x0f;
    return bytes;
}

describe('createGardenPreviewSourceRevision', () => {
    it('is stable across object keys and raised-bed query ordering', () => {
        const source = previewSource();
        const reordered = previewSource({
            raisedBeds: [...(source.raisedBeds as unknown[])].reverse(),
            stacks: {
                '0': {
                    '0': [
                        {
                            variant: null,
                            rotation: 0,
                            name: 'Block_Grass',
                            id: 'block-1',
                        },
                    ],
                },
            },
        });

        assert.equal(
            createGardenPreviewSourceRevision(
                source,
                new Date('2026-07-11T10:00:00.000Z'),
            ),
            createGardenPreviewSourceRevision(
                reordered,
                new Date('2026-07-11T22:00:00.000Z'),
            ),
        );
    });

    it('changes when a render-relevant plant state changes', () => {
        const source = previewSource();
        const changed = previewSource({
            raisedBeds: [
                {
                    id: 1,
                    fields: [
                        {
                            id: 11,
                            positionIndex: 0,
                            plantStatus: 'harvested',
                        },
                    ],
                    appliedOperations: [],
                },
                (source.raisedBeds as unknown[])[0],
            ],
        });

        assert.notEqual(
            createGardenPreviewSourceRevision(
                source,
                new Date('2026-07-11T10:00:00.000Z'),
            ),
            createGardenPreviewSourceRevision(
                changed,
                new Date('2026-07-11T10:00:00.000Z'),
            ),
        );
    });

    it('changes once per UTC render day as plants grow', () => {
        const source = previewSource();

        assert.notEqual(
            createGardenPreviewSourceRevision(
                source,
                new Date('2026-07-11T23:59:59.000Z'),
            ),
            createGardenPreviewSourceRevision(
                source,
                new Date('2026-07-12T00:00:00.000Z'),
            ),
        );
    });
});

describe('readWebpDimensions', () => {
    it('reads extended WebP canvas dimensions', () => {
        assert.deepEqual(readWebpDimensions(vp8xWebp(1200, 630)), {
            width: 1200,
            height: 630,
        });
    });

    it('reads the lossy and lossless formats emitted by browser encoders', () => {
        const expected = { width: 1200, height: 630 };

        assert.deepEqual(readWebpDimensions(vp8Webp(1200, 630)), expected);
        assert.deepEqual(readWebpDimensions(vp8lWebp(1200, 630)), expected);
    });

    it('rejects truncated and non-WebP data', () => {
        assert.equal(readWebpDimensions(new Uint8Array([1, 2, 3])), null);
        assert.equal(
            readWebpDimensions(vp8xWebp(1200, 630).slice(0, 20)),
            null,
        );
        assert.equal(
            readWebpDimensions(vp8xWebp(1200, 630).slice(0, 30)),
            null,
        );
    });

    it('rejects animated WebP uploads', () => {
        assert.equal(readWebpDimensions(animatedVp8xWebp(1200, 630)), null);
    });
});
