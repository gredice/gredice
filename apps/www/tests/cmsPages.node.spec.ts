import assert from 'node:assert/strict';
import test from 'node:test';
import { hasReservedFirstSegment } from '../app/[...slug]/cmsPageRouteUtils.ts';
import {
    COMPANION_PLANTING_PATH,
    COMPANION_PLANTING_SLUG,
    companionPlantingCmsPage,
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

test('companion planting source CMS page is published and canonical', () => {
    assert.equal(companionPlantingCmsPage.slug, COMPANION_PLANTING_SLUG);
    assert.equal(companionPlantingCmsPage.state, 'published');
    assert.equal(companionPlantingCmsPage.noIndex, false);
    assert.equal(
        companionPlantingCmsPage.canonicalPath,
        COMPANION_PLANTING_PATH,
    );
    assert.ok(companionPlantingCmsPage.metaTitle);
    assert.ok(companionPlantingCmsPage.metaDescription.length <= 160);
    assert.ok(getSourceCmsPageBySlug(COMPANION_PLANTING_SLUG));
});

test('companion planting source CMS page has editable explanation sections', () => {
    const components = companionPlantingCmsPage.content.map(
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
        JSON.stringify(companionPlantingCmsPage.content),
        /Nije strogo pravilo niti jamstvo prinosa/u,
    );
    assert.match(
        JSON.stringify(companionPlantingCmsPage.content),
        /Kada se izvori razilaze/u,
    );
});

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

test('public CMS catch-all keeps outlet route reserved', () => {
    assert.equal(hasReservedFirstSegment('outlet'), true);
    assert.equal(hasReservedFirstSegment('outlet/sezonska-ponuda'), true);
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
