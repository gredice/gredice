import { expect, test } from '@playwright/test';
import {
    assertFarmOperationCompletionImagesStored,
    FARM_OPERATION_COMPLETION_IDEMPOTENT_UPLOAD_CONSTRAINTS,
    FarmOperationCompletionImageMetadataUnavailableError,
    FarmOperationCompletionImagesValidationError,
    getFarmOperationCompletionImageFileError,
    getFarmOperationCompletionSubmissionImagePath,
    isFarmOperationCompletionSubmissionImagePath,
    normalizeFarmOperationCompletionImageUrls,
    parseFarmOperationCompletionAttachmentId,
    parseFarmOperationCompletionSubmissionId,
} from './operationCompletionProof';

const trustedHost = 'myegtvromcktt2y7.public.blob.vercel-storage.com';
const operationId = 12;
const expectedEntityId = 701;
const expectedTaskVersionEventId = 81;
const targetPath = `operations/${operationId}/entity-${expectedEntityId}/version-${expectedTaskVersionEventId}`;
const trustedImageUrl = `https://${trustedHost}/${targetPath}/proof.jpg`;
const submissionId = '11111111-1111-4111-8111-111111111111';
const attachmentId = '2222222a-222b-4222-8222-22222222222c';
const submissionPath = `${targetPath}/submissions/${submissionId}/attachments/${attachmentId}.jpg`;
const trustedSubmissionImageUrl = `https://${trustedHost}/${submissionPath}`;

test('rejects deterministic non-image and oversized phone files before upload', () => {
    expect(
        getFarmOperationCompletionImageFileError({
            size: 1024,
            type: 'application/pdf',
        }),
    ).toContain('datoteku fotografije');
    expect(
        getFarmOperationCompletionImageFileError({
            size: 25 * 1024 * 1024 + 1,
            type: 'image/jpeg',
        }),
    ).toContain('25 MB');
    expect(
        getFarmOperationCompletionImageFileError({
            size: 25 * 1024 * 1024,
            type: 'image/jpeg',
        }),
    ).toBeNull();
});

test('builds one canonical evidence pathname per submission attachment', () => {
    expect(FARM_OPERATION_COMPLETION_IDEMPOTENT_UPLOAD_CONSTRAINTS).toEqual({
        addRandomSuffix: false,
        allowOverwrite: false,
    });
    expect(
        getFarmOperationCompletionSubmissionImagePath(
            operationId,
            expectedEntityId,
            expectedTaskVersionEventId,
            submissionId.toUpperCase(),
            attachmentId.toUpperCase(),
            'Dokaz.JPEG',
        ),
    ).toBe(
        `${targetPath}/submissions/${submissionId}/attachments/${attachmentId}.jpeg`,
    );
    expect(
        getFarmOperationCompletionSubmissionImagePath(
            operationId,
            expectedEntityId,
            expectedTaskVersionEventId,
            submissionId,
            attachmentId,
            'dokaz.nepodrzani-nastavak',
        ),
    ).toBe(
        `${targetPath}/submissions/${submissionId}/attachments/${attachmentId}`,
    );
});

test('accepts only the exact deterministic submission attachment path', () => {
    expect(
        isFarmOperationCompletionSubmissionImagePath(
            submissionPath,
            operationId,
            expectedEntityId,
            expectedTaskVersionEventId,
            submissionId,
            attachmentId,
            'proof.jpg',
        ),
    ).toBe(true);
    expect(
        isFarmOperationCompletionSubmissionImagePath(
            `${targetPath}/submissions/${submissionId}/attachments/${attachmentId}-attempt-2.jpg`,
            operationId,
            expectedEntityId,
            expectedTaskVersionEventId,
            submissionId,
            attachmentId,
            'proof.jpg',
        ),
    ).toBe(false);
    expect(
        isFarmOperationCompletionSubmissionImagePath(
            `${targetPath}/submissions/${submissionId}/attachments/33333333-3333-4333-8333-333333333333.jpg`,
            operationId,
            expectedEntityId,
            expectedTaskVersionEventId,
            submissionId,
            attachmentId,
            'proof.jpg',
        ),
    ).toBe(false);
    expect(
        isFarmOperationCompletionSubmissionImagePath(
            `${targetPath}/submissions/${submissionId}/attachments/${attachmentId}.png`,
            operationId,
            expectedEntityId,
            expectedTaskVersionEventId,
            submissionId,
            attachmentId,
            'proof.jpg',
        ),
    ).toBe(false);
});

test('validates canonical submission and attachment UUIDs', () => {
    expect(parseFarmOperationCompletionSubmissionId(submissionId)).toBe(
        submissionId,
    );
    expect(parseFarmOperationCompletionAttachmentId(attachmentId)).toBe(
        attachmentId,
    );
    expect(() =>
        parseFarmOperationCompletionSubmissionId('not-a-uuid'),
    ).toThrow('ID slanja');
    expect(() =>
        parseFarmOperationCompletionAttachmentId(
            '22222222-2222-0222-8222-222222222222',
        ),
    ).toThrow('ID fotografije');
});

test('normalizes trusted proof URLs bound to the exact operation', () => {
    expect(
        normalizeFarmOperationCompletionImageUrls(
            [`  ${trustedImageUrl}  `, trustedImageUrl, '   '],
            operationId,
            expectedEntityId,
            expectedTaskVersionEventId,
        ),
    ).toEqual([trustedImageUrl]);
    expect(
        normalizeFarmOperationCompletionImageUrls(
            undefined,
            operationId,
            expectedEntityId,
            expectedTaskVersionEventId,
        ),
    ).toBeUndefined();
});

test('binds keyed proof URLs to the exact submission and attachment shape', () => {
    expect(
        normalizeFarmOperationCompletionImageUrls(
            [trustedSubmissionImageUrl],
            operationId,
            expectedEntityId,
            expectedTaskVersionEventId,
            submissionId,
        ),
    ).toEqual([trustedSubmissionImageUrl]);
    expect(() =>
        normalizeFarmOperationCompletionImageUrls(
            [trustedImageUrl],
            operationId,
            expectedEntityId,
            expectedTaskVersionEventId,
            submissionId,
        ),
    ).toThrow('učitane kroz ovu radnju');
    expect(() =>
        normalizeFarmOperationCompletionImageUrls(
            [
                `https://${trustedHost}/${targetPath}/submissions/${submissionId}/attachments/${attachmentId}-attempt-2.jpg`,
            ],
            operationId,
            expectedEntityId,
            expectedTaskVersionEventId,
            submissionId,
        ),
    ).toThrow('učitane kroz ovu radnju');
    expect(() =>
        normalizeFarmOperationCompletionImageUrls(
            [
                trustedSubmissionImageUrl.replace(
                    attachmentId,
                    attachmentId.toUpperCase(),
                ),
            ],
            operationId,
            expectedEntityId,
            expectedTaskVersionEventId,
            submissionId,
        ),
    ).toThrow('učitane kroz ovu radnju');
});

test('accepts recovered metadata only from the exact keyed submission path', async () => {
    await assertFarmOperationCompletionImagesStored(
        [trustedSubmissionImageUrl],
        operationId,
        expectedEntityId,
        expectedTaskVersionEventId,
        async () => ({
            contentType: 'image/jpeg',
            pathname: submissionPath,
            size: 128,
            url: trustedSubmissionImageUrl,
        }),
        submissionId,
    );

    await expect(
        assertFarmOperationCompletionImagesStored(
            [trustedSubmissionImageUrl],
            operationId,
            expectedEntityId,
            expectedTaskVersionEventId,
            async () => ({
                contentType: 'image/jpeg',
                pathname: `${targetPath}/submissions/33333333-3333-4333-8333-333333333333/attachments/${attachmentId}.jpg`,
                size: 128,
                url: trustedSubmissionImageUrl,
            }),
            submissionId,
        ),
    ).rejects.toBeInstanceOf(FarmOperationCompletionImagesValidationError);
});

test('rejects malformed, untrusted, insecure, and cross-operation proof', () => {
    const invalidValues: unknown[] = [
        'not-an-array',
        [trustedImageUrl, 12],
        [`https://example.com/${targetPath}/proof.jpg`],
        [`http://${trustedHost}/${targetPath}/proof.jpg`],
        [
            `https://${trustedHost}/operations/13/entity-${expectedEntityId}/version-${expectedTaskVersionEventId}/proof.jpg`,
        ],
        [
            `https://${trustedHost}/operations/${operationId}/entity-702/version-${expectedTaskVersionEventId}/proof.jpg`,
        ],
        [
            `https://${trustedHost}/operations/${operationId}/entity-${expectedEntityId}/version-82/proof.jpg`,
        ],
        [`${trustedImageUrl}?forged=true`],
        [`${trustedImageUrl}#forged`],
    ];

    for (const invalidValue of invalidValues) {
        expect(() =>
            normalizeFarmOperationCompletionImageUrls(
                invalidValue,
                operationId,
                expectedEntityId,
                expectedTaskVersionEventId,
            ),
        ).toThrow();
    }
});

test('requires every proof URL to resolve to a stored image for the operation', async () => {
    const requestedUrls: string[] = [];
    await assertFarmOperationCompletionImagesStored(
        [trustedImageUrl],
        operationId,
        expectedEntityId,
        expectedTaskVersionEventId,
        async (imageUrl) => {
            requestedUrls.push(imageUrl);
            return {
                contentType: 'image/jpeg',
                pathname: `${targetPath}/proof.jpg`,
                size: 128,
                url: trustedImageUrl,
            };
        },
    );

    expect(requestedUrls).toEqual([trustedImageUrl]);
});

test('rejects missing, empty, non-image, and mismatched stored proof', async () => {
    const invalidLoaders = [
        async () => {
            throw new Error('not found');
        },
        async () => ({
            contentType: 'image/jpeg',
            pathname: `${targetPath}/proof.jpg`,
            size: 0,
            url: trustedImageUrl,
        }),
        async () => ({
            contentType: 'text/plain',
            pathname: `${targetPath}/proof.jpg`,
            size: 128,
            url: trustedImageUrl,
        }),
        async () => ({
            contentType: 'image/jpeg',
            pathname: `operations/13/entity-${expectedEntityId}/version-${expectedTaskVersionEventId}/proof.jpg`,
            size: 128,
            url: trustedImageUrl,
        }),
        async () => ({
            contentType: 'image/jpeg',
            pathname: `${targetPath}/proof.jpg`,
            size: 128,
            url: `https://${trustedHost}/${targetPath}/other.jpg`,
        }),
    ];

    for (const loadMetadata of invalidLoaders) {
        let rejected = false;
        try {
            await assertFarmOperationCompletionImagesStored(
                [trustedImageUrl],
                operationId,
                expectedEntityId,
                expectedTaskVersionEventId,
                loadMetadata,
            );
        } catch {
            rejected = true;
        }
        expect(rejected).toBe(true);
    }
});

test('identifies every stored proof URL that must be uploaded again', async () => {
    const secondImageUrl = `https://${trustedHost}/${targetPath}/proof-2.jpg`;
    let caughtError: unknown;
    try {
        await assertFarmOperationCompletionImagesStored(
            [trustedImageUrl, secondImageUrl],
            operationId,
            expectedEntityId,
            expectedTaskVersionEventId,
            async () => {
                throw new Error('not found');
            },
        );
    } catch (error) {
        caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(
        FarmOperationCompletionImagesValidationError,
    );
    if (caughtError instanceof FarmOperationCompletionImagesValidationError) {
        expect(caughtError.reason).toBe('missing');
        expect(caughtError.imageUrls).toEqual([
            trustedImageUrl,
            secondImageUrl,
        ]);
    }
});

test('does not misclassify a transient metadata outage as a missing upload', async () => {
    const unavailable =
        new FarmOperationCompletionImageMetadataUnavailableError();
    await expect(
        assertFarmOperationCompletionImagesStored(
            [trustedImageUrl],
            operationId,
            expectedEntityId,
            expectedTaskVersionEventId,
            async () => {
                throw unavailable;
            },
        ),
    ).rejects.toBe(unavailable);
});

test('limits one completion record to twenty unique images', () => {
    const imageUrls = Array.from(
        { length: 21 },
        (_, index) => `https://${trustedHost}/${targetPath}/proof-${index}.jpg`,
    );

    expect(() =>
        normalizeFarmOperationCompletionImageUrls(
            imageUrls,
            operationId,
            expectedEntityId,
            expectedTaskVersionEventId,
        ),
    ).toThrow('najviše 20 slika');
});
