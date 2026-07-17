import type { SelectCmsPage } from '@gredice/storage';
import { expect, test } from '@playwright/experimental-ct-react';
import { CmsPagesTable } from '../app/admin/cms/pages/CmsPagesTable';

const coverUrl =
    'https://test.public.blob.vercel-storage.com/cms/pages/1/cover/test.jpg';
const timestamp = new Date('2026-07-17T08:00:00.000Z');

function cmsPage(
    values: Pick<SelectCmsPage, 'id' | 'metaImageUrl' | 'title'>,
): SelectCmsPage {
    return {
        id: values.id,
        slug: `page-${values.id}`,
        title: values.title,
        content: null,
        contentKind: 'changelog',
        category: null,
        tags: [],
        state: 'draft',
        publishedAt: timestamp,
        metaTitle: null,
        metaDescription: null,
        metaImageUrl: values.metaImageUrl,
        seoImageUrl: null,
        canonicalPath: null,
        noIndex: false,
        createdAt: timestamp,
        updatedAt: timestamp,
        isDeleted: false,
    };
}

test('shows an available cover thumbnail before the page title', async ({
    mount,
}) => {
    const component = await mount(
        <CmsPagesTable
            pages={[
                cmsPage({
                    id: 1,
                    metaImageUrl: coverUrl,
                    title: 'Objava s naslovnicom',
                }),
                cmsPage({
                    id: 2,
                    metaImageUrl: null,
                    title: 'Objava bez naslovnice',
                }),
            ]}
        />,
    );

    const pageWithCover = component.getByRole('link', {
        name: /Objava s naslovnicom/,
    });
    const pageWithoutCover = component.getByRole('link', {
        name: /Objava bez naslovnice/,
    });
    const thumbnail = pageWithCover.locator('img');

    await expect(thumbnail).toHaveAttribute(
        'src',
        /\/_next\/image\?url=.*&w=128&q=75$/,
    );
    await expect(thumbnail).toHaveAttribute(
        'srcset',
        /w=64&q=75 1x, .*w=128&q=75 2x$/,
    );
    await expect(pageWithoutCover.locator('img')).toHaveCount(0);

    const thumbnailPrecedesTitle = await thumbnail.evaluate((image) => {
        const title = [
            ...(image.closest('a')?.querySelectorAll('span') ?? []),
        ].find((element) => element.textContent === 'Objava s naslovnicom');

        return Boolean(
            title &&
                image.compareDocumentPosition(title) &
                    Node.DOCUMENT_POSITION_FOLLOWING,
        );
    });

    expect(thumbnailPrecedesTitle).toBe(true);
});
