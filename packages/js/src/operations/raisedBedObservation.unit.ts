import assert from 'node:assert/strict';
import test from 'node:test';
import {
    assertObservationImageMetadata,
    getObservationImagePathPrefix,
    isObservationImageUploadPath,
    normalizeObservationContent,
    parseRaisedBedObservationTarget,
} from './raisedBedObservation';

const submissionId = 'cbb50f4c-a2c6-44cb-a57e-33e2d7b706c0';
const prefix = getObservationImagePathPrefix(12, 'farmer', submissionId);
const image = `https://myegtvromcktt2y7.public.blob.vercel-storage.com/${prefix}photo.jpg`;

test('observations accept text, photos or both and bound their content', () => {
    assert.deepEqual(
        normalizeObservationContent('  Žuti listovi  ', [], prefix),
        { notes: 'Žuti listovi', imageUrls: [] },
    );
    assert.deepEqual(normalizeObservationContent('', [image], prefix), {
        notes: '',
        imageUrls: [image],
    });
    assert.throws(() => normalizeObservationContent(' ', [], prefix));
    assert.throws(() =>
        normalizeObservationContent('a'.repeat(2001), [], prefix),
    );
    assert.throws(() =>
        normalizeObservationContent('', Array(21).fill(image), prefix),
    );
    assert.throws(() =>
        normalizeObservationContent('', [image, image], prefix),
    );
});

test('upload tokens reject path escapes and stored image proof rejects forged or oversized metadata', () => {
    assert.equal(
        isObservationImageUploadPath(`${prefix}${submissionId}.jpg`, prefix),
        true,
    );
    for (const suffix of [
        '../photo.jpg',
        'subfolder/photo.jpg',
        'photo.jpg',
        `${submissionId}.jpg/other`,
    ])
        assert.equal(
            isObservationImageUploadPath(`${prefix}${suffix}`, prefix),
            false,
        );
    const metadata = {
        url: image,
        pathname: new URL(image).pathname.slice(1),
        contentType: 'image/jpeg',
        size: 1024,
    };
    assert.doesNotThrow(() =>
        assertObservationImageMetadata(image, prefix, metadata),
    );
    for (const invalid of [
        { ...metadata, contentType: 'text/html' },
        { ...metadata, size: 25 * 1024 * 1024 + 1 },
        { ...metadata, size: Number.NaN },
        { ...metadata, size: 0 },
        { ...metadata, url: `${image}?forged=1` },
        { ...metadata, pathname: 'other/photo.jpg' },
    ])
        assert.throws(() =>
            assertObservationImageMetadata(image, prefix, invalid),
        );
});

test('observation photos are restricted to the actor, bed and submission', () => {
    for (const badImage of [
        image.replace('/farmer/', '/other/'),
        image.replace('/12/', '/13/'),
        image.replace(submissionId, 'b57fca3d-e9ba-4658-b478-112205389734'),
        image.replace('https:', 'http:'),
        image.replace(
            'myegtvromcktt2y7.public.blob.vercel-storage.com',
            'attacker.example',
        ),
        'javascript:alert(1)',
    ]) {
        assert.throws(() =>
            normalizeObservationContent('', [badImage], prefix),
        );
    }
});

test('crop targets require exact legacy cycle or selected planting identity', () => {
    assert.deepEqual(
        parseRaisedBedObservationTarget({ kind: 'bed', raisedBedId: 12 }),
        { kind: 'bed', raisedBedId: 12 },
    );
    for (const target of [
        null,
        { kind: 'bed', raisedBedId: -1 },
        { kind: 'field', raisedBedId: 12, positionIndex: 0 },
        {
            kind: 'planting',
            raisedBedId: 12,
            plantingId: 2,
            expectedPlantSortId: 3,
            expectedLifecycleVersionEventId: 0,
        },
    ]) {
        assert.throws(() => parseRaisedBedObservationTarget(target));
    }
});
