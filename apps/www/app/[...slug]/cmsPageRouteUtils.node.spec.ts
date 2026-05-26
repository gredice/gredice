import assert from 'node:assert/strict';
import test from 'node:test';
import {
    hasReservedFirstSegment,
    normalizeCmsRouteSlug,
    parseCmsPageRenderMaxWidth,
    parseCmsPageRenderMode,
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

test('CMS page render layout parsers normalize invalid API values', () => {
    assert.equal(parseCmsPageRenderMode('fullWidth'), 'fullWidth');
    assert.equal(parseCmsPageRenderMode('unexpected'), 'container');
    assert.equal(parseCmsPageRenderMaxWidth('xl'), 'xl');
    assert.equal(parseCmsPageRenderMaxWidth('wide'), 'lg');
});

test('hasReservedFirstSegment flags static route conflicts', () => {
    assert.equal(hasReservedFirstSegment('legalno/politika-privatnosti'), true);
    assert.equal(hasReservedFirstSegment('cms/about-us'), false);
});
