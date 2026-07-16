import { expect, test } from '@playwright/test';
import {
    assertFarmOperationCompletionImagesStored,
    FarmOperationCompletionImagesValidationError,
    getFarmOperationCompletionImageFileError,
    normalizeFarmOperationCompletionImageUrls,
} from './operationCompletionProof';

const trustedHost = 'myegtvromcktt2y7.public.blob.vercel-storage.com';
const operationId = 12;
const expectedEntityId = 701;
const expectedTaskVersionEventId = 81;
const targetPath = `operations/${operationId}/entity-${expectedEntityId}/version-${expectedTaskVersionEventId}`;
const trustedImageUrl = `https://${trustedHost}/${targetPath}/proof.jpg`;

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
        expect(caughtError.imageUrls).toEqual([
            trustedImageUrl,
            secondImageUrl,
        ]);
    }
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
