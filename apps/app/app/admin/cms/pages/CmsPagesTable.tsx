import type { SelectCmsPage } from '@gredice/storage';
import { List, ListItem } from '@gredice/ui/List';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Typography } from '@gredice/ui/Typography';
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

function contentKindLabel(page: SelectCmsPage) {
    switch (page.contentKind) {
        case 'blog':
            return 'Blog';
        case 'changelog':
            return 'Changelog';
        default:
            return 'Stranica';
    }
}

export function CmsPagesTable({ pages }: { pages: SelectCmsPage[] }) {
    const sortedPages = [...pages].sort(comparePagesByPublishDate);

    if (pages.length === 0) {
        return (
            <div className="p-4">
                <NoDataPlaceholder />
            </div>
        );
    }

    return (
        <List className="divide-y" spacing={0}>
            {sortedPages.map((page) => (
                <ListItem
                    key={page.id}
                    href={KnownPages.CmsPageEdit(page.id)}
                    className="rounded-none px-3 py-3 hover:bg-muted/40 sm:px-4"
                    label={
                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <Typography
                                component="span"
                                className="min-w-0 truncate"
                                semiBold
                            >
                                {page.title}
                            </Typography>
                            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
                                <Typography
                                    level="body3"
                                    component="span"
                                    className="whitespace-nowrap text-muted-foreground"
                                >
                                    {contentKindLabel(page)}
                                </Typography>
                                <CmsPageStateChip state={page.state} />
                                <Typography
                                    level="body3"
                                    component="span"
                                    className="whitespace-nowrap text-muted-foreground"
                                >
                                    Objavljeno:{' '}
                                    {page.publishedAt ? (
                                        <LocalDateTime time={false}>
                                            {page.publishedAt}
                                        </LocalDateTime>
                                    ) : (
                                        '-'
                                    )}
                                </Typography>
                            </div>
                        </div>
                    }
                />
            ))}
        </List>
    );
}
