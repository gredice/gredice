import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { qualityHarvestSafetyFaqEntries } from '../../lib/plants/qualityHarvestSafetyFaq.ts';
import {
    faqCategoryArtwork,
    getFaqCategoryArtwork,
    resolveFaqCategoryImage,
} from './faqCategoryArtwork.ts';
import { groupFaqCategories } from './groupFaqCategories.ts';

test('all known FAQ categories have a distinct checked-in asset', () => {
    assert.equal(new Set(faqCategoryArtwork.map((item) => item.file)).size, 5);
    for (const artwork of faqCategoryArtwork) {
        assert.ok(
            existsSync(
                new URL(
                    `../../public/assets/faq-categories/${artwork.file}`,
                    import.meta.url,
                ),
            ),
        );
    }
});

test('editor-selected images override defaults, including for new categories', () => {
    for (const name of ['usage', 'new-category']) {
        assert.equal(
            resolveFaqCategoryImage({
                information: { name },
                image: {
                    cover: { url: 'https://images.example.com/custom.webp' },
                },
            }),
            'https://images.example.com/custom.webp',
        );
    }
});

test('bundled canonical images resolve locally so PR previews do not need a production deployment', () => {
    const path = getFaqCategoryArtwork('usage');
    assert.equal(
        resolveFaqCategoryImage({
            image: { cover: { url: `https://www.gredice.com${path}` } },
        }),
        path,
    );
});

test('blank and invalid image URLs use category defaults; unknown categories request no broken image', () => {
    for (const url of [
        '',
        '   ',
        'javascript:alert(1)',
        '//example.com/image.webp',
    ]) {
        assert.equal(
            resolveFaqCategoryImage({
                information: { name: 'usage' },
                image: { cover: { url } },
            }),
            getFaqCategoryArtwork('usage'),
        );
    }
    assert.equal(
        resolveFaqCategoryImage({ information: { name: 'unknown' } }),
        undefined,
    );
});

test('category grouping keeps complete entries and uses stable names when labels change', () => {
    const original = qualityHarvestSafetyFaqEntries[0];
    const renamed = {
        ...qualityHarvestSafetyFaqEntries[1],
        attributes: {
            category: {
                ...original.attributes.category,
                information: {
                    ...original.attributes.category.information,
                    label: 'Novi naslov',
                },
            },
        },
    };
    const sections = groupFaqCategories([original, renamed]);
    assert.equal(sections.length, 1);
    assert.deepEqual(sections[0].entries, [original, renamed]);
    assert.ok(resolveFaqCategoryImage(sections[0].category));
    assert.deepEqual(groupFaqCategories([]), []);
});
