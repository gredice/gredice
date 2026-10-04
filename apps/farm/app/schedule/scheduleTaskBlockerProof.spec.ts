import { expect, test } from '@playwright/test';
import {
    assertScheduleTaskBlockerImagesStored,
    getScheduleTaskBlockerImageFileError,
    getScheduleTaskBlockerImagePathPrefix,
    normalizeScheduleTaskBlockerImageUrls,
    ScheduleTaskBlockerImagesValidationError,
} from './scheduleTaskBlockerProof';

const trustedHost = 'myegtvromcktt2y7.public.blob.vercel-storage.com';
const operationTarget = {
    expectedEntityId: 701,
    expectedTaskVersionEventId: 81,
    kind: 'operation',
    operationId: 42,
} as const;
const targetPath = 'schedule-blockers/operation-42-entity-701-version-81';
const trustedImageUrl = `https://${trustedHost}/${targetPath}/proof.jpg`;

test('rejects deterministic non-image and oversized blocker camera files', () => {
    expect(
        getScheduleTaskBlockerImageFileError({
            size: 1024,
            type: 'text/plain',
        }),
    ).toContain('datoteku fotografije');
    expect(
        getScheduleTaskBlockerImageFileError({
            size: 25 * 1024 * 1024 + 1,
            type: 'image/jpeg',
        }),
    ).toContain('25 MB');
    expect(
        getScheduleTaskBlockerImageFileError({
            size: 25 * 1024 * 1024,
            type: 'image/jpeg',
        }),
    ).toBeNull();
});

test('normalizes unique blocker photos bound to the exact task', () => {
    expect(getScheduleTaskBlockerImagePathPrefix(operationTarget)).toBe(
        `${targetPath}/`,
    );
    expect(
        normalizeScheduleTaskBlockerImageUrls(
            [`  ${trustedImageUrl}  `, trustedImageUrl, '   '],
            operationTarget,
        ),
    ).toEqual([trustedImageUrl]);
    expect(
        normalizeScheduleTaskBlockerImageUrls(undefined, operationTarget),
    ).toBeUndefined();
});

test('rejects malformed, untrusted, insecure, and cross-task blocker photos', () => {
    const invalidValues: unknown[] = [
        'not-an-array',
        [trustedImageUrl, 42],
        [`https://example.com/${targetPath}/proof.jpg`],
        [`http://${trustedHost}/${targetPath}/proof.jpg`],
        [
            `https://${trustedHost}/schedule-blockers/operation-42-entity-702-version-81/proof.jpg`,
        ],
        [
            `https://${trustedHost}/schedule-blockers/planting-12-0-cycle-801-version-802-sort-901/proof.jpg`,
        ],
        [`${trustedImageUrl}?forged=true`],
        [`${trustedImageUrl}#forged`],
    ];

    for (const invalidValue of invalidValues) {
        expect(() =>
            normalizeScheduleTaskBlockerImageUrls(
                invalidValue,
                operationTarget,
            ),
        ).toThrow();
    }
});

test('limits one blocker report to five unique photos', () => {
    const imageUrls = Array.from(
        { length: 6 },
        (_, index) => `https://${trustedHost}/${targetPath}/proof-${index}.jpg`,
    );

    expect(() =>
        normalizeScheduleTaskBlockerImageUrls(imageUrls, operationTarget),
    ).toThrow('najviše 5 fotografija');
});

test('requires every blocker photo to resolve to a stored image for the task', async () => {
    const requestedUrls: string[] = [];
    await assertScheduleTaskBlockerImagesStored(
        [trustedImageUrl],
        operationTarget,
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

test('rejects missing, empty, non-image, and mismatched stored blocker photos', async () => {
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
            pathname:
                'schedule-blockers/operation-42-entity-702-version-81/proof.jpg',
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
            await assertScheduleTaskBlockerImagesStored(
                [trustedImageUrl],
                operationTarget,
                loadMetadata,
            );
        } catch {
            rejected = true;
        }
        expect(rejected).toBe(true);
    }
});

test('identifies every blocker photo URL that must be uploaded again', async () => {
    const secondImageUrl = `https://${trustedHost}/${targetPath}/proof-2.jpg`;
    let caughtError: unknown;
    try {
        await assertScheduleTaskBlockerImagesStored(
            [trustedImageUrl, secondImageUrl],
            operationTarget,
            async () => {
                throw new Error('not found');
            },
        );
    } catch (error) {
        caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(
        ScheduleTaskBlockerImagesValidationError,
    );
    if (caughtError instanceof ScheduleTaskBlockerImagesValidationError) {
        expect(caughtError.imageUrls).toEqual([
            trustedImageUrl,
            secondImageUrl,
        ]);
    }
});
