import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getSourceCmsPageBySlug,
    QUALITY_HARVEST_SAFETY_PATH,
    QUALITY_HARVEST_SAFETY_SLUG,
    qualityHarvestSafetyCmsPage,
} from '../app/[...slug]/sourceCmsPages.ts';

const bannedPublicClaimPhrases = [
    'HACCP certificirani',
    'HACCP certifikat',
    'u potpunosti HACCP compliant',
    'ready-to-eat',
    'oprano i spremno za jelo',
];

test('quality harvest safety source CMS page is published and canonical', () => {
    assert.equal(qualityHarvestSafetyCmsPage.slug, QUALITY_HARVEST_SAFETY_SLUG);
    assert.equal(qualityHarvestSafetyCmsPage.state, 'published');
    assert.equal(qualityHarvestSafetyCmsPage.noIndex, false);
    assert.equal(
        qualityHarvestSafetyCmsPage.canonicalPath,
        QUALITY_HARVEST_SAFETY_PATH,
    );
    assert.ok(qualityHarvestSafetyCmsPage.metaTitle);
    assert.ok(qualityHarvestSafetyCmsPage.metaDescription.length <= 160);
    assert.ok(getSourceCmsPageBySlug(QUALITY_HARVEST_SAFETY_SLUG));
});

test('quality harvest safety source CMS page has real content sections', () => {
    const components = qualityHarvestSafetyCmsPage.content.map(
        (section) => section.component,
    );

    assert.deepEqual(components, [
        'PageHeader',
        'TextBlock',
        'Feature1',
        'CalloutBlock',
        'MarkdownBlock',
        'Faq1',
        'CtaBand',
    ]);
    assert.match(
        JSON.stringify(qualityHarvestSafetyCmsPage.content),
        /Svježi urod treba oprati i pripremiti prije konzumacije/u,
    );
    assert.doesNotMatch(
        JSON.stringify(qualityHarvestSafetyCmsPage.content),
        /Zadnji pregled/u,
    );
});

test('quality harvest safety control items include CMS feature icons', () => {
    const controlsSection = qualityHarvestSafetyCmsPage.content.find(
        (section) => section.component === 'Feature1',
    );

    assert.ok(controlsSection?.features?.length);
    assert.equal(controlsSection.features.length, 6);
    assert.ok(
        controlsSection.features.every(
            (feature) => typeof feature.iconName === 'string',
        ),
    );
});

test('quality harvest safety source CMS page avoids risky public claim phrases', () => {
    const serialized = JSON.stringify(qualityHarvestSafetyCmsPage);

    for (const phrase of bannedPublicClaimPhrases) {
        assert.equal(
            serialized.includes(phrase),
            false,
            `CMS page content must not include "${phrase}"`,
        );
    }
});
