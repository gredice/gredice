import {
    cmsPagePublicPath,
    getCmsPage,
    getCmsPageRevisions,
    type SelectCmsPage,
} from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Button } from '@gredice/ui/Button';
import { Card } from '@gredice/ui/Card';
import { Divider } from '@gredice/ui/Divider';
import { Delete, Edit, ExternalLink, Megaphone } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    EntityDetailsPanelCard,
    EntityDetailsPropertiesLayout,
    EntityDetailsPropertiesPanel,
    EntityDetailsPropertiesProvider,
    EntityDetailsPropertiesToggle,
    EntityDetailsPropertyList,
    type EntityDetailsPropertyListItem,
} from '../../../../../components/admin/details';
import { AdminPageHeader } from '../../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { Field } from '../../../../../components/shared/fields/Field';
import { FieldSet } from '../../../../../components/shared/fields/FieldSet';
import { auth } from '../../../../../lib/auth/auth';
import { KnownPages } from '../../../../../src/KnownPages';
import {
    deleteCmsPageAction,
    publishCmsPageAction,
    restoreCmsPageRevisionAction,
    unpublishCmsPageAction,
} from '../actions';
import { CmsPageStateChip } from '../CmsPageStateChip';

export const dynamic = 'force-dynamic';

function keyedCmsPageSection(
    section: { component: string },
    occurrence: number,
) {
    return {
        key: `${section.component}-${occurrence}`,
        section,
    };
}

function parseCmsPageSections(content: string | null) {
    if (!content) {
        return [];
    }

    try {
        const parsed: unknown = JSON.parse(content);
        if (!Array.isArray(parsed)) {
            return [];
        }

        const sectionCounts = new Map<string, number>();
        return parsed
            .filter(
                (section): section is { component: string } =>
                    Boolean(section) &&
                    typeof section === 'object' &&
                    'component' in section &&
                    typeof section.component === 'string',
            )
            .map((section) => {
                const occurrence = sectionCounts.get(section.component) ?? 0;
                sectionCounts.set(section.component, occurrence + 1);
                return keyedCmsPageSection(section, occurrence);
            });
    } catch {
        return [];
    }
}

function publishedAtValue(page: SelectCmsPage) {
    if (!page.publishedAt) {
        return '-';
    }

    return <LocalDateTime time={false}>{page.publishedAt}</LocalDateTime>;
}

export default async function CmsPageDetailsPage({
    params,
    searchParams,
}: {
    params: Promise<{ pageId: string }>;
    searchParams: Promise<{ publishError?: string }>;
}) {
    await auth(['admin']);

    const { pageId } = await params;
    const resolvedSearchParams = await searchParams;
    const id = Number.parseInt(pageId, 10);
    if (Number.isNaN(id)) {
        notFound();
    }

    const [page, revisions] = await Promise.all([
        getCmsPage(id),
        getCmsPageRevisions(id),
    ]);
    if (!page) {
        notFound();
    }

    const pageSections = parseCmsPageSections(page.content);
    const publishAction = publishCmsPageAction.bind(null, id);
    const unpublishAction = unpublishCmsPageAction.bind(null, id);
    const deleteAction = deleteCmsPageAction.bind(null, id);
    const isPublished = page.state === 'published';
    const propertyItems: EntityDetailsPropertyListItem[] = [
        { id: 'path', label: 'Putanja', value: cmsPagePublicPath(page) },
        {
            id: 'status',
            label: 'Status',
            value: <CmsPageStateChip state={page.state} />,
        },
        {
            id: 'published-at',
            label: 'Datum objave',
            value: publishedAtValue(page),
        },
        { id: 'created-at', label: 'Datum kreiranja', value: page.createdAt },
        {
            id: 'updated-at',
            label: 'Datum zadnje izmjene',
            value: page.updatedAt,
        },
        {
            id: 'meta-title',
            label: 'Meta naslov',
            value: page.metaTitle ?? '-',
        },
        {
            id: 'meta-description',
            label: 'Meta opis',
            value: page.metaDescription ? (
                <span className="whitespace-pre-line">
                    {page.metaDescription}
                </span>
            ) : (
                '-'
            ),
        },
        {
            id: 'meta-image',
            label: 'Meta slika',
            value: page.metaImageUrl ?? '-',
        },
    ];
    const propertiesPanel = (
        <EntityDetailsPropertiesPanel>
            <EntityDetailsPanelCard title="Detalji">
                <EntityDetailsPropertyList items={propertyItems} />
            </EntityDetailsPanelCard>
        </EntityDetailsPropertiesPanel>
    );

    return (
        <EntityDetailsPropertiesProvider>
            <Stack spacing={8}>
                <AdminPageHeader
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
                                { label: page.title },
                            ]}
                        />
                    }
                    actions={
                        <Row spacing={2} className="items-center">
                            <Link href={KnownPages.CmsPageEdit(id)}>
                                <Row
                                    spacing={2}
                                    className="text-sm font-medium px-3 py-2 rounded-md border hover:bg-accent transition-colors"
                                >
                                    <Edit className="size-4" />
                                    <span>Uredi</span>
                                </Row>
                            </Link>
                            <Link
                                href={KnownPages.CmsPagePreview(id)}
                                target="_blank"
                            >
                                <Row
                                    spacing={2}
                                    className="text-sm font-medium px-3 py-2 rounded-md border hover:bg-accent transition-colors"
                                >
                                    <ExternalLink className="size-4" />
                                    <span>Preview</span>
                                </Row>
                            </Link>
                            <form
                                action={
                                    isPublished
                                        ? unpublishAction
                                        : publishAction
                                }
                            >
                                <Button
                                    variant={isPublished ? 'outlined' : 'solid'}
                                    type="submit"
                                    startDecorator={
                                        <Megaphone className="size-4" />
                                    }
                                >
                                    {isPublished ? 'Vrati u izradu' : 'Objavi'}
                                </Button>
                            </form>
                            <form action={deleteAction}>
                                <Button
                                    variant="solid"
                                    color="danger"
                                    type="submit"
                                    startDecorator={
                                        <Delete className="size-4" />
                                    }
                                >
                                    Obriši
                                </Button>
                            </form>
                            <EntityDetailsPropertiesToggle />
                        </Row>
                    }
                    heading={page.title}
                />
                <EntityDetailsPropertiesLayout properties={propertiesPanel}>
                    <Stack spacing={8}>
                        {resolvedSearchParams.publishError && (
                            <Card className="border-red-200 bg-red-50 px-4 py-3 text-red-700">
                                {resolvedSearchParams.publishError}
                            </Card>
                        )}
                        <Card className="max-w-4xl p-6">
                            <Stack spacing={4}>
                                <Typography level="h3" semiBold>
                                    Sekcije stranice
                                </Typography>
                                {pageSections.length === 0 ? (
                                    <Typography level="body2" secondary>
                                        Nema konfiguriranih sekcija.
                                    </Typography>
                                ) : (
                                    pageSections.map(
                                        ({ key, section }, index) => (
                                            <Stack spacing={2} key={key}>
                                                <Typography level="body2">
                                                    {index + 1}.{' '}
                                                    {section.component}
                                                </Typography>
                                                <Divider />
                                            </Stack>
                                        ),
                                    )
                                )}
                            </Stack>
                        </Card>
                        <FieldSet>
                            {revisions.length === 0 ? (
                                <Field name="Historija" value="Nema promjena" />
                            ) : (
                                revisions.map((revision) => (
                                    <Field
                                        key={revision.id}
                                        name={`${revision.action} • ${revision.actorName ?? 'Nepoznat korisnik'}`}
                                        value={
                                            <Row
                                                spacing={4}
                                                className="items-center"
                                            >
                                                <span>
                                                    {revision.createdAt.toISOString()}
                                                </span>
                                                <form
                                                    action={restoreCmsPageRevisionAction.bind(
                                                        null,
                                                        id,
                                                        revision.id,
                                                    )}
                                                >
                                                    <Button
                                                        variant="plain"
                                                        type="submit"
                                                        className="text-xs"
                                                    >
                                                        Vrati ovu verziju
                                                    </Button>
                                                </form>
                                            </Row>
                                        }
                                    />
                                ))
                            )}
                        </FieldSet>
                    </Stack>
                </EntityDetailsPropertiesLayout>
            </Stack>
        </EntityDetailsPropertiesProvider>
    );
}
