import type { SelectCmsPage } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../../src/KnownPages';
import { CmsPageStateChip } from './CmsPageStateChip';

function publishedAtTime(page: SelectCmsPage) {
    if (!page.publishedAt) {
        return null;
    }

    const time = new Date(page.publishedAt).getTime();
    return Number.isNaN(time) ? null : time;
}

function comparePagesByPublishDate(a: SelectCmsPage, b: SelectCmsPage) {
    const aPublishedAt = publishedAtTime(a);
    const bPublishedAt = publishedAtTime(b);

    if (aPublishedAt !== null && bPublishedAt !== null) {
        const publishDateDifference = bPublishedAt - aPublishedAt;

        if (publishDateDifference !== 0) {
            return publishDateDifference;
        }
    }

    if (aPublishedAt !== null) {
        return -1;
    }

    if (bPublishedAt !== null) {
        return 1;
    }

    return b.id - a.id;
}

export function CmsPagesTable({ pages }: { pages: SelectCmsPage[] }) {
    const sortedPages = [...pages].sort(comparePagesByPublishDate);

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>Naslov</Table.Head>
                    <Table.Head>Vrsta</Table.Head>
                    <Table.Head>Objavljeno</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {pages.length === 0 && (
                    <Table.Row>
                        <Table.Cell colSpan={3}>
                            <NoDataPlaceholder />
                        </Table.Cell>
                    </Table.Row>
                )}
                {sortedPages.map((page) => (
                    <Table.Row key={page.id}>
                        <Table.Cell>
                            <div className="flex min-w-0 items-center gap-2">
                                {page.state !== 'published' ? (
                                    <CmsPageStateChip state={page.state} />
                                ) : null}
                                <Link
                                    className="min-w-0"
                                    href={KnownPages.CmsPageEdit(page.id)}
                                >
                                    <Typography
                                        component="span"
                                        className="block truncate"
                                    >
                                        {page.title}
                                    </Typography>
                                </Link>
                            </div>
                        </Table.Cell>
                        <Table.Cell>
                            <Typography secondary>
                                {page.contentKind === 'blog'
                                    ? 'Blog'
                                    : page.contentKind === 'changelog'
                                      ? 'Changelog'
                                      : 'Stranica'}
                            </Typography>
                        </Table.Cell>
                        <Table.Cell>
                            <Typography secondary>
                                {page.publishedAt ? (
                                    <LocalDateTime time={false}>
                                        {page.publishedAt}
                                    </LocalDateTime>
                                ) : (
                                    '-'
                                )}
                            </Typography>
                        </Table.Cell>
                    </Table.Row>
                ))}
            </Table.Body>
        </Table>
    );
}
