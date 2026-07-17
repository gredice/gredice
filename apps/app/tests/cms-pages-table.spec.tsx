import type { SelectCmsPage } from '@gredice/storage';
import { expect, test } from '@playwright/experimental-ct-react';
import { CmsPagesTable } from '../app/admin/cms/pages/CmsPagesTable';

const coverUrl =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="160" height="100"%3E%3Cpath fill="%236b8e23" d="M0 0h160v100H0z"/%3E%3C/svg%3E';
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

    await expect(thumbnail).toHaveAttribute('src', coverUrl);
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
