import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    createCmsPage,
    getCmsPage,
    getCmsPageBySlug,
    getCmsPages,
    normalizeCmsPageSlug,
    softDeleteCmsPage,
    updateCmsPage,
    updateCmsPageState,
} from '@gredice/storage';
import { createTestDb } from './testDb';

test('CMS pages normalize slugs and support CRUD lifecycle', async () => {
    createTestDb();
    const suffix = randomUUID();
    const rawSlug = ` /Vodiči/${suffix}/Česta pitanja/ `;

    const pageId = await createCmsPage({
        slug: rawSlug,
        title: 'Original title',
        content: 'Original content',
        metaTitle: 'Original meta title',
        metaDescription: 'Original meta description',
    });

    const expectedSlug = `vodici/${suffix}/cesta-pitanja`;
    const created = await getCmsPage(pageId);
    assert.equal(created?.slug, expectedSlug);
    assert.equal(created?.title, 'Original title');
    assert.equal(created?.state, 'draft');
    assert.equal(created?.publishedAt, null);

    await updateCmsPage({
        id: pageId,
        slug: `Vodiči/${suffix}/Objavljena stranica`,
        title: 'Updated title',
        content: 'Updated content',
        state: 'published',
        metaImageUrl: 'https://www.gredice.com/assets/page.png',
    });

    const updatedSlug = `vodici/${suffix}/objavljena-stranica`;
    const updated = await getCmsPageBySlug(updatedSlug);
    assert.equal(updated?.id, pageId);
    assert.equal(updated?.title, 'Updated title');
    assert.equal(updated?.content, 'Updated content');
    assert.equal(updated?.state, 'published');
    assert.ok(updated?.publishedAt instanceof Date);

    await updateCmsPageState(pageId, 'draft');
    const unpublished = await getCmsPage(pageId);
    assert.equal(unpublished?.state, 'draft');

    await softDeleteCmsPage(pageId);
    assert.equal(await getCmsPage(pageId), undefined);

    const activePages = await getCmsPages();
    assert.equal(
        activePages.some((page) => page.id === pageId),
        false,
    );
});

test('CMS page slugs must be unique across active pages', async () => {
    createTestDb();
    const suffix = randomUUID();
    const slug = `cms-page-${suffix}`;

    const pageId = await createCmsPage({
        slug,
        title: 'First page',
    });
    const secondPageId = await createCmsPage({
        slug: `other-cms-page-${suffix}`,
        title: 'Second page',
    });

    await assert.rejects(
        () =>
            createCmsPage({
                slug: `/${slug}/`,
                title: 'Duplicate page',
            }),
        /already exists/,
    );
    await assert.rejects(
        () =>
            updateCmsPage({
                id: secondPageId,
                slug,
            }),
        /already exists/,
    );

    await softDeleteCmsPage(pageId);

    const replacementPageId = await createCmsPage({
        slug,
        title: 'Replacement page',
    });
    assert.notEqual(replacementPageId, pageId);
});

test('CMS page slugs reject reserved static route conflicts', async () => {
    createTestDb();

    assert.equal(normalizeCmsPageSlug('/Česta pitanja/'), 'cesta-pitanja');
    await assert.rejects(
        () =>
            createCmsPage({
                slug: '/biljke/sezonski-vodic',
                title: 'Conflicting page',
            }),
        /reserved route/,
    );
});
