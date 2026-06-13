import {
    closeStorage,
    createCmsPage,
    getCmsPageBySlug,
    updateCmsPage,
} from '@gredice/storage';
import { companionPlantingCmsPage } from '../app/[...slug]/sourceCmsPages.ts';

const apply = process.argv.includes('--apply');
const updateExisting = process.argv.includes('--update-existing');

function contentDocument() {
    const document: {
        renderMode?: typeof companionPlantingCmsPage.renderMode;
        renderMaxWidth?: typeof companionPlantingCmsPage.renderMaxWidth;
        sections: typeof companionPlantingCmsPage.content;
    } = {
        sections: companionPlantingCmsPage.content,
    };

    if (companionPlantingCmsPage.renderMode !== 'container') {
        document.renderMode = companionPlantingCmsPage.renderMode;
    }

    if (
        companionPlantingCmsPage.renderMode === 'container' &&
        companionPlantingCmsPage.renderMaxWidth !== 'lg'
    ) {
        document.renderMaxWidth = companionPlantingCmsPage.renderMaxWidth;
    }

    return JSON.stringify(document);
}

function cmsPagePayload() {
    return {
        slug: companionPlantingCmsPage.slug,
        title: companionPlantingCmsPage.title,
        content: contentDocument(),
        contentKind: companionPlantingCmsPage.contentKind,
        category: companionPlantingCmsPage.category,
        tags: companionPlantingCmsPage.tags,
        state: companionPlantingCmsPage.state,
        metaTitle: companionPlantingCmsPage.metaTitle,
        metaDescription: companionPlantingCmsPage.metaDescription,
        metaImageUrl: companionPlantingCmsPage.metaImageUrl,
        seoImageUrl: companionPlantingCmsPage.seoImageUrl,
        canonicalPath: companionPlantingCmsPage.canonicalPath,
        noIndex: companionPlantingCmsPage.noIndex,
        publishedAt: companionPlantingCmsPage.publishedAt,
    };
}

async function main() {
    const existing = await getCmsPageBySlug(companionPlantingCmsPage.slug);
    const payload = cmsPagePayload();

    if (!apply) {
        const action = existing
            ? updateExisting
                ? 'update'
                : 'skip existing'
            : 'create';
        console.log(
            `[dry-run] ${action} CMS page /${companionPlantingCmsPage.slug}`,
        );
        return;
    }

    if (existing) {
        if (!updateExisting) {
            console.log(
                `CMS page /${companionPlantingCmsPage.slug} already exists with id ${existing.id.toString()}; leaving existing DB content unchanged.`,
            );
            return;
        }

        await updateCmsPage(
            {
                id: existing.id,
                ...payload,
            },
            {
                id: 'source-cms-page-seed',
                name: 'Source CMS page seed',
            },
        );
        console.log(
            `Updated CMS page /${companionPlantingCmsPage.slug} with id ${existing.id.toString()}.`,
        );
        return;
    }

    const pageId = await createCmsPage(payload, {
        id: 'source-cms-page-seed',
        name: 'Source CMS page seed',
    });
    console.log(
        `Created CMS page /${companionPlantingCmsPage.slug} with id ${pageId.toString()}.`,
    );
}

try {
    await main();
} finally {
    await closeStorage();
}
