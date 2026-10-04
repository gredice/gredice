import assert from 'node:assert/strict';
import test from 'node:test';
import {
    publicFaqCategories,
    publicFaqEntries,
} from '../../../../packages/storage/src/data/publicFaq.ts';
import { resolveFaqSections } from '../../../../packages/ui/src/cms/resolveFaqSections.ts';
import { collectRevalidationPaths } from '../../app/api/revalidate/directories/revalidationPaths.ts';
import { faqPlacements } from './faqPlacements.ts';
import { faqTestEntries } from './faqTestEntries.ts';
import { groupFaqCategories } from './groupFaqCategories.ts';

test('every placement resolves to unique, reviewed entries and valid categories', () => {
    const names = new Set(publicFaqEntries.map((entry) => entry.name));
    assert.equal(names.size, publicFaqEntries.length);
    const categories = new Set(
        publicFaqCategories.map((category) => category.name),
    );
    assert.equal(categories.size, 8);
    for (const entry of publicFaqEntries) {
        assert.ok(categories.has(entry.category), entry.name);
        assert.doesNotMatch(
            `${entry.header} ${entry.content}`,
            /(?<!\p{L})(vi|vam|vas|vaš|vaša|vaše|posjetite|odaberete|zaboravio|zaboravila|zadovoljan|zadovoljna)(?!\p{L})/iu,
        );
        assert.doesNotMatch(entry.content, /\/kontakt\.|\\n/u);
    }
    for (const placement of Object.values(faqPlacements)) {
        assert.equal(new Set(placement.slugs).size, placement.slugs.length);
        assert.ok(placement.slugs.length >= 3 && placement.slugs.length <= 5);
        for (const slug of placement.slugs) assert.ok(names.has(slug), slug);
    }
});

test('CMS shared references preserve order, deduplicate and never show stale unpublished answers', () => {
    const legacy = {
        component: 'Faq1',
        features: [{ header: 'Legacy answer', description: 'Outdated' }],
    };
    const sections = resolveFaqSections(
        [
            { ...legacy, faqSlugs: 'pitanje-2,missing\npitanje-1 pitanje-2' },
            legacy,
        ],
        faqTestEntries,
    );
    assert.deepEqual(
        sections[0].features?.map((entry) => entry.header),
        ['Drugo pitanje', 'Prvo pitanje'],
    );
    assert.equal(sections[1], legacy);
    assert.deepEqual(
        resolveFaqSections(
            [{ ...legacy, faqSlugs: 'missing' }],
            faqTestEntries,
        )[0].features,
        [],
    );
});

test('category order follows the customer journey and unknown categories remain visible', () => {
    const entries = ['unknown', 'delivery', 'service', 'pricing'].map(
        (name, index) => ({
            ...faqTestEntries[0],
            id: index,
            attributes: {
                category: { id: index, information: { name, label: name } },
            },
        }),
    );
    assert.deepEqual(
        groupFaqCategories(entries).map(
            (section) => section.category.information.name,
        ),
        ['service', 'pricing', 'delivery', 'unknown'],
    );
});

test('FAQ and category edits invalidate embedded answers, including arbitrary CMS routes', () => {
    assert.deepEqual(collectRevalidationPaths(['faq', 'faq-category']), [
        { path: '/', type: 'layout' },
    ]);
});
