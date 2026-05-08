import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    cmsPages,
    createCmsPage,
    getCmsPage,
    getCmsPageBySlug,
    getCmsPages,
    normalizeCmsPageSlug,
    softDeleteCmsPage,
    storage,
    updateCmsPage,
    updateCmsPageState,
} from '@gredice/storage';
import { createTestDb } from './testDb';

test('CMS pages normalize slugs and support CRUD lifecycle', async () => {
    createTestDb();
    const suffix = randomUUID();
    const rawSlug = ` /Vodiči/${suffix}/Česta pitanja/ `;
    const originalContent = JSON.stringify([
        { component: 'Feature1', header: 'Original section' },
    ]);
    const updatedContent = JSON.stringify([
        { component: 'Heading1', header: 'Updated section' },
    ]);

    const pageId = await createCmsPage({
        slug: rawSlug,
        title: 'Original title',
        content: originalContent,
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
        content: updatedContent,
        state: 'published',
        metaImageUrl: 'https://www.gredice.com/assets/page.png',
    });

    const updatedSlug = `vodici/${suffix}/objavljena-stranica`;
    const updated = await getCmsPageBySlug(updatedSlug);
    assert.equal(updated?.id, pageId);
    assert.equal(updated?.title, 'Updated title');
    assert.equal(updated?.content, updatedContent);
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

test('CMS page publish readiness uses metadata from the same update', async () => {
    createTestDb();
    const content = JSON.stringify([
        { component: 'Feature1', header: 'Ready section' },
    ]);
    const pageId = await createCmsPage({
        slug: `publish-with-meta-${randomUUID()}`,
        title: 'Publish with meta',
        content,
    });

    await updateCmsPage({
        id: pageId,
        state: 'published',
        metaTitle: 'Publishable meta title',
        metaDescription: 'Publishable meta description',
    });

    const page = await getCmsPage(pageId);
    assert.equal(page?.state, 'published');
    assert.equal(page?.metaTitle, 'Publishable meta title');
    assert.equal(page?.metaDescription, 'Publishable meta description');
    assert.ok(page?.publishedAt instanceof Date);
});

test('CMS page content stores valid SectionData JSON payload', async () => {
    createTestDb();
    const sectionData = [
        {
            component: 'Feature1',
            header: 'Naslov',
            description: 'Opis',
        },
        {
            component: 'Faq1',
            items: [{ question: 'Pitanje', answer: 'Odgovor' }],
        },
    ];

    const pageId = await createCmsPage({
        slug: `section-data-${randomUUID()}`,
        title: 'Section data page',
        content: JSON.stringify(sectionData),
    });

    const page = await getCmsPage(pageId);
    assert.equal(page?.content, JSON.stringify(sectionData));
});

test('CMS page content rejects invalid SectionData JSON payload', async () => {
    createTestDb();
    const slug = `invalid-section-data-${randomUUID()}`;

    await assert.rejects(
        () =>
            createCmsPage({
                slug,
                title: 'Invalid section data page',
                content: '{"component":"Feature1"}',
            }),
        /JSON array of SectionData blocks/,
    );

    await assert.rejects(
        () =>
            createCmsPage({
                slug: `${slug}-component`,
                title: 'Invalid component page',
                content: JSON.stringify([{ component: 'Unknown1' }]),
            }),
        /unsupported component/,
    );
});

test('CMS page update allows legacy plaintext content when unchanged', async () => {
    createTestDb();
    const slug = `legacy-plaintext-${randomUUID()}`;
    const legacyContent = 'Legacy plain text content';

    const [created] = await storage()
        .insert(cmsPages)
        .values({
            slug,
            title: 'Legacy page',
            content: legacyContent,
            state: 'draft',
        })
        .returning({ id: cmsPages.id });

    assert.ok(created);
    await updateCmsPage({
        id: created.id,
        title: 'Legacy page updated',
        content: legacyContent,
    });

    const updated = await getCmsPage(created.id);
    assert.equal(updated?.title, 'Legacy page updated');
    assert.equal(updated?.content, legacyContent);
});
