import assert from 'node:assert/strict';
import test from 'node:test';
import {
    hasReservedFirstSegment,
    normalizeCmsRouteSlug,
    parseCmsSectionData,
} from './cmsPageRouteUtils';

test('normalizeCmsRouteSlug builds nested slug segments', () => {
    assert.equal(normalizeCmsRouteSlug([' cms ', 'about-us ']), 'cms/about-us');
});

test('parseCmsSectionData returns section-like objects only', () => {
    const sections = parseCmsSectionData([
        { component: 'Feature1', header: 'Title' },
        { component: 5 },
        null,
        'section',
    ]);

    assert.deepEqual(sections, [{ component: 'Feature1', header: 'Title' }]);
});

test('parseCmsSectionData returns empty array for invalid payloads', () => {
    assert.deepEqual(parseCmsSectionData({ component: 'Feature1' }), []);
});

test('hasReservedFirstSegment flags static route conflicts', () => {
    assert.equal(hasReservedFirstSegment('legalno/politika-privatnosti'), true);
    assert.equal(hasReservedFirstSegment('cms/about-us'), false);
});
