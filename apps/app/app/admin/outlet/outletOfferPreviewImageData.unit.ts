import assert from 'node:assert/strict';
import test from 'node:test';
import { outletOfferPreviewImages } from './outletOfferPreviewImageData';

test('outletOfferPreviewImages trims, deduplicates, and limits attached images', () => {
    assert.deepEqual(
        outletOfferPreviewImages([
            ' https://cdn.gredice.com/outlet-1.jpg ',
            '',
            'https://cdn.gredice.com/outlet-2.jpg',
            'https://cdn.gredice.com/outlet-1.jpg',
            'https://cdn.gredice.com/outlet-3.jpg',
            'https://cdn.gredice.com/outlet-4.jpg',
        ]),
        {
            imageUrls: [
                'https://cdn.gredice.com/outlet-1.jpg',
                'https://cdn.gredice.com/outlet-2.jpg',
                'https://cdn.gredice.com/outlet-3.jpg',
            ],
            hiddenImageCount: 1,
        },
    );
});

test('outletOfferPreviewImages keeps rows stable without attached images', () => {
    assert.deepEqual(outletOfferPreviewImages([undefined, null, ' ']), {
        imageUrls: [],
        hiddenImageCount: 0,
    });
});

test('outletOfferPreviewImages honors a custom preview limit', () => {
    assert.deepEqual(
        outletOfferPreviewImages(
            [
                'https://cdn.gredice.com/outlet-1.jpg',
                'https://cdn.gredice.com/outlet-2.jpg',
            ],
            1,
        ),
        {
            imageUrls: ['https://cdn.gredice.com/outlet-1.jpg'],
            hiddenImageCount: 1,
        },
    );
});
