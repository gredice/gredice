import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    cmsPageCacheKeysForSlug,
    cmsPages,
    createCmsPage,
    getCmsPage,
    getCmsPageBySlug,
    getCmsPageRevisions,
    getCmsPageSlugValidationError,
    getCmsPages,
    getPublishedCmsNewsPages,
    normalizeCmsPageSlug,
    restoreCmsPageRevision,
    softDeleteCmsPage,
    storage,
    updateCmsPage,
    updateCmsPageState,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
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
    assert.equal(
        normalizeCmsPageSlug('test123---dsadase21321!@#$%^&*(fdsfdsdq'),
        'test123-dsadase21321-fdsfdsdq',
    );
    await assert.rejects(
        () =>
            createCmsPage({
                slug: '/biljke/sezonski-vodic',
                title: 'Conflicting page',
            }),
        /reserved route/,
    );
    await assert.rejects(
        () =>
            createCmsPage({
                slug: '/novosti',
                title: 'Conflicting news index',
            }),
        /reserved route/,
    );
});

test('CMS news page slugs follow blog and changelog namespaces', async () => {
    createTestDb();
    const suffix = randomUUID();

    assert.equal(
        getCmsPageSlugValidationError('/novosti/vrtni-dnevnik', {
            contentKind: 'blog',
        }),
        null,
    );
    assert.equal(
        getCmsPageSlugValidationError('/novosti/sto-je-novo/nova-gredica', {
            contentKind: 'changelog',
        }),
        null,
    );
    assert.match(
        getCmsPageSlugValidationError('/novosti/sto-je-novo', {
            contentKind: 'blog',
        }) ?? '',
        /changelog route/,
    );
    assert.match(
        getCmsPageSlugValidationError('/novosti/vrt', {
            contentKind: 'changelog',
        }) ?? '',
        /Changelog page slug/,
    );

    const blogId = await createCmsPage({
        slug: `/novosti/${suffix}`,
        title: 'Blog objava',
        contentKind: 'blog',
        category: '  Vrt   dnevnik ',
        tags: ['Vrt', 'Biljke', 'vrt', ' '],
    });

    const blog = await getCmsPage(blogId);
    assert.equal(blog?.contentKind, 'blog');
    assert.equal(blog?.category, 'Vrt dnevnik');
    assert.deepEqual(blog?.tags, ['Vrt', 'Biljke']);
});

test('CMS blog pages require category before publishing', async () => {
    createTestDb();
    const content = JSON.stringify([
        { component: 'MarkdownBlock', markdown: '## Objave' },
    ]);
    const pageId = await createCmsPage({
        slug: `/novosti/${randomUUID()}`,
        title: 'Blog without category',
        contentKind: 'blog',
        content,
        metaTitle: 'Blog without category',
        metaDescription: 'Missing category should block publishing.',
    });

    await assert.rejects(
        () => updateCmsPageState(pageId, 'published'),
        /Blog category is required/,
    );

    await updateCmsPage({
        id: pageId,
        category: 'Vrt',
        state: 'published',
    });

    const page = await getCmsPage(pageId);
    assert.equal(page?.state, 'published');
});

test('CMS pages support in-review state before publishing', async () => {
    createTestDb();
    const content = JSON.stringify([
        { component: 'MarkdownBlock', markdown: '## Ready for review' },
    ]);

    await assert.rejects(
        () =>
            createCmsPage({
                slug: `review-not-ready-${randomUUID()}`,
                title: 'Review without metadata',
                content,
                state: 'in-review',
            }),
        /Page is not ready for publishing/,
    );

    const pageId = await createCmsPage({
        slug: `review-ready-${randomUUID()}`,
        title: 'Review ready page',
        content,
        state: 'in-review',
        metaTitle: 'Review ready page',
        metaDescription: 'Ready for publishing, but not published yet.',
    });

    const reviewPage = await getCmsPage(pageId);
    assert.equal(reviewPage?.state, 'in-review');
    assert.equal(reviewPage?.publishedAt, null);

    const reviewPages = await getCmsPages({ state: 'in-review' });
    assert.equal(
        reviewPages.some((page) => page.id === pageId),
        true,
    );

    await updateCmsPageState(pageId, 'published');
    const publishedPage = await getCmsPage(pageId);
    assert.equal(publishedPage?.state, 'published');
    assert.ok(publishedPage?.publishedAt instanceof Date);
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

test('CMS pages use requested published dates for publish ordering', async () => {
    createTestDb();
    const content = JSON.stringify([
        { component: 'MarkdownBlock', markdown: '## Changelog' },
    ]);
    const olderPublishedAt = new Date('2026-05-03T08:00:00.000Z');
    const newerPublishedAt = new Date('2026-05-05T08:00:00.000Z');
    const draftPublishedAt = new Date('2026-05-04T08:00:00.000Z');

    const olderPageId = await createCmsPage({
        slug: `/novosti/sto-je-novo/older-${randomUUID()}`,
        title: 'Older changelog',
        contentKind: 'changelog',
        content,
        state: 'published',
        publishedAt: olderPublishedAt,
        metaTitle: 'Older changelog',
        metaDescription: 'Older changelog entry.',
    });
    const newerPageId = await createCmsPage({
        slug: `/novosti/sto-je-novo/newer-${randomUUID()}`,
        title: 'Newer changelog',
        contentKind: 'changelog',
        content,
        state: 'published',
        publishedAt: newerPublishedAt.toISOString(),
        metaTitle: 'Newer changelog',
        metaDescription: 'Newer changelog entry.',
    });
    const draftPageId = await createCmsPage({
        slug: `/novosti/sto-je-novo/draft-${randomUUID()}`,
        title: 'Draft changelog',
        contentKind: 'changelog',
        content,
        publishedAt: draftPublishedAt,
        metaTitle: 'Draft changelog',
        metaDescription: 'Draft changelog entry.',
    });

    const draft = await getCmsPage(draftPageId);
    assert.equal(draft?.state, 'draft');
    assert.equal(
        draft?.publishedAt?.toISOString(),
        draftPublishedAt.toISOString(),
    );

    await updateCmsPageState(draftPageId, 'published');
    const publishedDraft = await getCmsPage(draftPageId);
    assert.equal(
        publishedDraft?.publishedAt?.toISOString(),
        draftPublishedAt.toISOString(),
    );

    const entries = await getPublishedCmsNewsPages({
        contentKind: 'changelog',
    });
    assert.deepEqual(
        entries.map((page) => page.id),
        [newerPageId, draftPageId, olderPageId],
    );
});

test('CMS pages reject invalid published dates', async () => {
    createTestDb();

    await assert.rejects(
        () =>
            createCmsPage({
                slug: `invalid-published-date-${randomUUID()}`,
                title: 'Invalid published date',
                publishedAt: 'not-a-date',
            }),
        /Published date must be a valid date/,
    );
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

test('CMS page content stores page render layout document', async () => {
    createTestDb();
    const content = {
        renderMode: 'container',
        renderMaxWidth: 'xl',
        sections: [
            {
                component: 'Feature1',
                header: 'Contained section',
                renderMode: 'container',
                renderMaxWidth: 'md',
            },
            {
                component: 'MediaBlock',
                renderMode: 'fullWidth',
                renderMaxWidth: 'xs',
                header: 'Full width section',
            },
            {
                component: 'TextBlock',
                renderMode: 'component',
                renderMaxWidth: 'xl',
                header: 'Legacy section',
                description: 'Legacy render mode is normalized away.',
            },
        ],
    };

    const pageId = await createCmsPage({
        slug: `section-layout-${randomUUID()}`,
        title: 'Section layout page',
        content: JSON.stringify(content),
    });

    const page = await getCmsPage(pageId);
    assert.deepEqual(page?.content ? JSON.parse(page.content) : null, {
        sections: [
            {
                component: 'Feature1',
                header: 'Contained section',
                renderMode: 'container',
                renderMaxWidth: 'md',
            },
            {
                component: 'MediaBlock',
                renderMode: 'fullWidth',
                header: 'Full width section',
            },
            {
                component: 'TextBlock',
                header: 'Legacy section',
                description: 'Legacy render mode is normalized away.',
            },
        ],
        renderMaxWidth: 'xl',
    });
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

test('CMS page revisions are recorded and can be restored', async () => {
    createTestDb();
    const slug = `history-${randomUUID()}`;
    const firstContent = JSON.stringify([
        { component: 'Feature1', header: 'V1' },
    ]);
    const secondContent = JSON.stringify([
        { component: 'Heading1', header: 'V2' },
    ]);

    const pageId = await createCmsPage({
        slug,
        title: 'V1 title',
        content: firstContent,
        canonicalPath: '/history-v1',
        noIndex: true,
    });
    await updateCmsPage({
        id: pageId,
        title: 'V2 title',
        content: secondContent,
        canonicalPath: '/history-v2',
        noIndex: false,
    });

    const revisions = await getCmsPageRevisions(pageId);
    assert.equal(revisions.length >= 2, true);
    const latest = revisions[0];
    assert.equal(latest?.action, 'cms_page.updated');

    if (!latest) {
        throw new Error('Latest revision missing.');
    }
    await restoreCmsPageRevision(pageId, latest.id);
    const restored = await getCmsPage(pageId);
    assert.equal(restored?.title, 'V1 title');
    assert.equal(restored?.content, firstContent);
    assert.equal(restored?.canonicalPath, '/history-v1');
    assert.equal(restored?.noIndex, true);
});

test('CMS page cache keys include normalized page and list variants', () => {
    const keys = cmsPageCacheKeysForSlug(' /Vodiči/Cesta pitanja/ ');

    assert.deepEqual(keys, [
        'cms:page:slug:vodici/cesta-pitanja:v1',
        'cms:pages:list:all:v1',
        'cms:pages:list:draft:v1',
        'cms:pages:list:in-review:v1',
        'cms:pages:list:published:v1',
    ]);
});

test('CMS page metadata is preserved when updating only content', async () => {
    createTestDb();
    const pageId = await createCmsPage({
        slug: `meta-preserve-${randomUUID()}`,
        title: 'Metadata preserve page',
        content: JSON.stringify([{ component: 'Feature1', header: 'Initial' }]),
        metaTitle: 'Meta title',
        metaDescription: 'Meta description',
        metaImageUrl: 'https://www.gredice.com/meta.png',
    });

    await updateCmsPage({
        id: pageId,
        content: JSON.stringify([{ component: 'Heading1', header: 'Updated' }]),
    });

    const page = await getCmsPage(pageId);
    assert.equal(page?.metaTitle, 'Meta title');
    assert.equal(page?.metaDescription, 'Meta description');
    assert.equal(page?.metaImageUrl, 'https://www.gredice.com/meta.png');
});

test('published CMS news pages list only published blog and changelog entries', async () => {
    createTestDb();
    const testTag = `news-test-${randomUUID()}`;
    const content = JSON.stringify([
        { component: 'MarkdownBlock', markdown: '## Novost' },
    ]);
    const blogId = await createCmsPage({
        slug: `/novosti/blog-${randomUUID()}`,
        title: 'Published blog',
        contentKind: 'blog',
        category: 'Vrt',
        tags: ['Vrt', 'Biljke', testTag],
        content,
        state: 'published',
        metaTitle: 'Published blog',
        metaDescription: 'A published blog post for filtering.',
    });
    const changelogId = await createCmsPage({
        slug: `/novosti/sto-je-novo/changelog-${randomUUID()}`,
        title: 'Published changelog',
        contentKind: 'changelog',
        tags: ['Vrt', testTag],
        content,
        state: 'published',
        metaTitle: 'Published changelog',
        metaDescription: 'A published changelog entry for filtering.',
    });
    const unrelatedBlogId = await createCmsPage({
        slug: `/novosti/unrelated-${randomUUID()}`,
        title: 'Unrelated published blog',
        contentKind: 'blog',
        category: 'Vrt',
        tags: ['Unrelated'],
        content,
        state: 'published',
        metaTitle: 'Unrelated published blog',
        metaDescription: 'A newer blog post without the requested tag.',
    });
    await createCmsPage({
        slug: `/novosti/draft-${randomUUID()}`,
        title: 'Draft blog',
        contentKind: 'blog',
        category: 'Vrt',
        tags: ['Vrt'],
        content,
        metaTitle: 'Draft blog',
        metaDescription: 'Draft content must not be listed.',
    });
    await createCmsPage({
        slug: `/novosti/review-${randomUUID()}`,
        title: 'In-review blog',
        contentKind: 'blog',
        category: 'Vrt',
        tags: ['Vrt', testTag],
        content,
        state: 'in-review',
        metaTitle: 'In-review blog',
        metaDescription: 'Review content must not be listed.',
    });
    await createCmsPage({
        slug: `generic-${randomUUID()}`,
        title: 'Generic published page',
        content,
        state: 'published',
        metaTitle: 'Generic page',
        metaDescription: 'Generic pages are not news entries.',
    });

    const afterDate = new Date('2026-01-02T00:00:00.000Z');
    await storage()
        .update(cmsPages)
        .set({ publishedAt: new Date('2026-01-01T00:00:00.000Z') })
        .where(eq(cmsPages.id, blogId));
    await storage()
        .update(cmsPages)
        .set({ publishedAt: new Date('2026-01-03T00:00:00.000Z') })
        .where(eq(cmsPages.id, changelogId));
    await storage()
        .update(cmsPages)
        .set({ publishedAt: new Date('2026-01-04T00:00:00.000Z') })
        .where(eq(cmsPages.id, unrelatedBlogId));

    const allNews = await getPublishedCmsNewsPages({ tag: testTag });
    assert.deepEqual(
        allNews.map((page) => page.id),
        [changelogId, blogId],
    );

    const blogEntries = await getPublishedCmsNewsPages({
        contentKind: 'blog',
        category: 'vrt',
        tag: 'biljke',
    });
    assert.deepEqual(
        blogEntries.map((page) => page.id),
        [blogId],
    );

    const recentEntries = await getPublishedCmsNewsPages({
        publishedAfter: afterDate,
        tag: testTag,
    });
    assert.deepEqual(
        recentEntries.map((page) => page.id),
        [changelogId],
    );

    const limitedTaggedEntries = await getPublishedCmsNewsPages({
        tag: testTag,
        limit: 1,
    });
    assert.deepEqual(
        limitedTaggedEntries.map((page) => page.id),
        [changelogId],
    );
});
