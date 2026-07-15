import { expect, test } from '@playwright/test';
import {
    assertFarmOperationCompletionImagesStored,
    normalizeFarmOperationCompletionImageUrls,
} from './operationCompletionProof';

const trustedHost = 'myegtvromcktt2y7.public.blob.vercel-storage.com';
const operationId = 12;
const trustedImageUrl = `https://${trustedHost}/operations/${operationId}/proof.jpg`;

test('normalizes trusted proof URLs bound to the exact operation', () => {
    expect(
        normalizeFarmOperationCompletionImageUrls(
            [`  ${trustedImageUrl}  `, trustedImageUrl, '   '],
            operationId,
        ),
    ).toEqual([trustedImageUrl]);
    expect(
        normalizeFarmOperationCompletionImageUrls(undefined, operationId),
    ).toBeUndefined();
});

test('rejects malformed, untrusted, insecure, and cross-operation proof', () => {
    const invalidValues: unknown[] = [
        'not-an-array',
        [trustedImageUrl, 12],
        ['https://example.com/operations/12/proof.jpg'],
        [`http://${trustedHost}/operations/12/proof.jpg`],
        [`https://${trustedHost}/operations/13/proof.jpg`],
        [`${trustedImageUrl}?forged=true`],
        [`${trustedImageUrl}#forged`],
    ];

    for (const invalidValue of invalidValues) {
        expect(() =>
            normalizeFarmOperationCompletionImageUrls(
                invalidValue,
                operationId,
            ),
        ).toThrow();
    }
});

test('requires every proof URL to resolve to a stored image for the operation', async () => {
    const requestedUrls: string[] = [];
    await assertFarmOperationCompletionImagesStored(
        [trustedImageUrl],
        operationId,
        async (imageUrl) => {
            requestedUrls.push(imageUrl);
            return {
                contentType: 'image/jpeg',
                pathname: `operations/${operationId}/proof.jpg`,
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
            pathname: `operations/${operationId}/proof.jpg`,
            size: 0,
            url: trustedImageUrl,
        }),
        async () => ({
            contentType: 'text/plain',
            pathname: `operations/${operationId}/proof.jpg`,
            size: 128,
            url: trustedImageUrl,
        }),
        async () => ({
            contentType: 'image/jpeg',
            pathname: 'operations/13/proof.jpg',
            size: 128,
            url: trustedImageUrl,
        }),
        async () => ({
            contentType: 'image/jpeg',
            pathname: `operations/${operationId}/proof.jpg`,
            size: 128,
            url: `https://${trustedHost}/operations/${operationId}/other.jpg`,
        }),
    ];

    for (const loadMetadata of invalidLoaders) {
        let rejected = false;
        try {
            await assertFarmOperationCompletionImagesStored(
                [trustedImageUrl],
                operationId,
                loadMetadata,
            );
        } catch {
            rejected = true;
        }
        expect(rejected).toBe(true);
    }
});

test('limits one completion record to twenty unique images', () => {
    const imageUrls = Array.from(
        { length: 21 },
        (_, index) =>
            `https://${trustedHost}/operations/${operationId}/proof-${index}.jpg`,
    );

    expect(() =>
        normalizeFarmOperationCompletionImageUrls(imageUrls, operationId),
    ).toThrow('najviše 20 slika');
});
