import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Stack } from '@gredice/ui/Stack';
import { AdminBreadcrumbLevelSelector } from '../../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { auth } from '../../../../../lib/auth/auth';
import { KnownPages } from '../../../../../src/KnownPages';
import { createCmsPageAction } from '../actions';
import { CmsPageForm, type CmsPageFormTemplate } from '../CmsPageForm';

export const dynamic = 'force-dynamic';

type CmsPageTemplateKey = 'blog' | 'changelog';

const blogTemplate: CmsPageFormTemplate = {
    contentKind: 'blog',
    category: 'Vrt',
    tags: ['Vrt'],
    content: JSON.stringify(
        [
            {
                component: 'PageHeader',
                header: 'Naslov blog objave',
                description: 'Kratki uvod u temu blog objave.',
            },
            {
                component: 'MarkdownBlock',
                markdown:
                    '## Uvod\n\nOvdje upiši tekst blog objave.\n\n## Detalji\n\nDodaj savjete, primjere i poveznice.',
            },
        ],
        null,
        2,
    ),
};

const changelogTemplate: CmsPageFormTemplate = {
    contentKind: 'changelog',
    tags: ['Vrt'],
    content: JSON.stringify(
        [
            {
                component: 'MediaBlock',
                tagline: 'Što je novo',
                header: 'Naziv novosti',
                description: 'Kratki sažetak promjene ili nove značajke.',
                assetUrl: '',
                assetAlt: '',
            },
            {
                component: 'MarkdownBlock',
                markdown:
                    '## Što se promijenilo?\n\nOpiši promjenu, kome pomaže i kako je korisnici mogu isprobati.',
            },
        ],
        null,
        2,
    ),
};

function cmsPageTemplate(key: string | undefined) {
    const templateKey = key as CmsPageTemplateKey | undefined;
    if (templateKey === 'blog') {
        return blogTemplate;
    }

    if (templateKey === 'changelog') {
        return changelogTemplate;
    }

    return undefined;
}

function pageHeading(template: CmsPageFormTemplate | undefined) {
    if (template?.contentKind === 'blog') {
        return 'Nova Blog objava';
    }

    if (template?.contentKind === 'changelog') {
        return 'Novi changelog zapis';
    }

    return 'Nova stranica';
}

export default async function CreateCmsPagePage({
    searchParams,
}: {
    searchParams: Promise<{ template?: string }>;
}) {
    await auth(['admin']);
    const { template: templateKey } = await searchParams;
    const template = cmsPageTemplate(templateKey);
    const heading = pageHeading(template);

    return (
        <Stack spacing={8}>
            <CmsPageForm
                action={createCmsPageAction}
                formId="cms-page-create-form"
                template={template}
                breadcrumbs={
                    <Breadcrumbs
                        items={[
                            {
                                label: <AdminBreadcrumbLevelSelector />,
                            },
                            {
                                label: 'Stranice',
                                href: KnownPages.CmsPages,
                            },
                            { label: heading },
                        ]}
                    />
                }
                heading={heading}
            />
        </Stack>
    );
}
