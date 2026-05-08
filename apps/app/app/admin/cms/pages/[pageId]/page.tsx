import {
    cmsPagePublicPath,
    getCmsPage,
    getCmsPageRevisions,
    type SelectCmsPage,
} from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Delete, Edit, ExternalLink, Megaphone } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Separator } from '@signalco/ui-primitives/Separator';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { notFound } from 'next/navigation';
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


function parseCmsPageSections(content: string | null) {
    if (!content) {
        return [];
    }

    try {
        const parsed: unknown = JSON.parse(content);
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter(
            (section): section is { component: string } =>
                Boolean(section) &&
                typeof section === 'object' &&
                'component' in section &&
                typeof section.component === 'string',
        );
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

    const publishAction = publishCmsPageAction.bind(null, id);
    const unpublishAction = unpublishCmsPageAction.bind(null, id);
    const deleteAction = deleteCmsPageAction.bind(null, id);
    const isPublished = page.state === 'published';

    return (
        <Stack spacing={4}>
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
                    <Row spacing={1} className="items-center">
                        <Link href={KnownPages.CmsPageEdit(id)}>
                            <Row
                                spacing={1}
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
                                spacing={1}
                                className="text-sm font-medium px-3 py-2 rounded-md border hover:bg-accent transition-colors"
                            >
                                <ExternalLink className="size-4" />
                                <span>Preview</span>
                            </Row>
                        </Link>
                        <form
                            action={
                                isPublished ? unpublishAction : publishAction
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
                                startDecorator={<Delete className="size-4" />}
                            >
                                Obriši
                            </Button>
                        </form>
                    </Row>
                }
                heading={page.title}
            />
            <Stack spacing={2}>
                {resolvedSearchParams.publishError && (
                    <Card className="border-red-200 bg-red-50 px-4 py-3 text-red-700">
                        {resolvedSearchParams.publishError}
                    </Card>
                )}
                <Typography level="h2" className="text-2xl" semiBold>
                    {page.title}
                </Typography>
                <FieldSet>
                    <Field name="Putanja" value={cmsPagePublicPath(page)} />
                    <Field
                        name="Status"
                        value={<CmsPageStateChip state={page.state} />}
                    />
                    <Field name="Datum objave" value={publishedAtValue(page)} />
                    <Field name="Datum kreiranja" value={page.createdAt} />
                    <Field name="Datum zadnje izmjene" value={page.updatedAt} />
                    <Field name="Meta naslov" value={page.metaTitle ?? '-'} />
                    <Field
                        name="Meta opis"
                        value={page.metaDescription ?? '-'}
                    />
                    <Field name="Meta slika" value={page.metaImageUrl ?? '-'} />
                </FieldSet>
            </Stack>
            <Card className="max-w-4xl p-6">
                <Stack spacing={2}>
                    <Typography level="h3" semiBold>
                        Sekcije stranice
                    </Typography>
                    {parseCmsPageSections(page.content).length === 0 ? (
                        <Typography level="body2" secondary>
                            Nema konfiguriranih sekcija.
                        </Typography>
                    ) : (
                        parseCmsPageSections(page.content).map((section, index) => (
                            <Stack spacing={1} key={`${section.component}-${index}`}>
                                <Typography level="body2">
                                    {index + 1}. {section.component}
                                </Typography>
                                <Separator />
                            </Stack>
                        ))
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
                                <Row spacing={2} className="items-center">
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
    );
}
