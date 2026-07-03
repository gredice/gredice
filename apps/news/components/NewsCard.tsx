import type { Route } from 'next';
import { formatNewsDate } from '../lib/news';

export type NewsCardKind = 'blog' | 'changelog';

export type NewsCardEntry = {
    category?: string | null;
    excerpt?: string | null;
    metaImageUrl?: string | null;
    publishedAt?: string | null;
    slug: string;
    tags: string[];
    title: string;
};

const kindLabels = {
    blog: 'Blog',
    changelog: 'Što je novo',
} satisfies Record<NewsCardKind, string>;

export function NewsCard({
    entry,
    href,
    kind,
    showDate = true,
    showKindLabel = true,
    viewTransitionName,
}: {
    entry: NewsCardEntry;
    href: Route;
    kind: NewsCardKind;
    showDate?: boolean;
    showKindLabel?: boolean;
    viewTransitionName?: string;
}) {
    const dateLabel =
        showDate && entry.publishedAt
            ? formatNewsDate(entry.publishedAt)
            : null;
    const hasMetadata = showKindLabel || entry.category || dateLabel;

    return (
        <article className="w-full">
            <a
                className={`news-card-view-transition grid overflow-hidden rounded-md border bg-card shadow-xs transition-colors hover:bg-muted/20 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                    entry.metaImageUrl
                        ? 'md:grid-cols-[minmax(0,1fr)_10rem]'
                        : ''
                }`}
                href={href}
                style={viewTransitionName ? { viewTransitionName } : undefined}
            >
                <div className="grid content-start gap-3 p-5">
                    {entry.tags.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                            {entry.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="rounded-sm border bg-secondary px-2 py-1 text-xs font-semibold uppercase tracking-normal text-secondary-foreground"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    ) : null}
                    {hasMetadata ? (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold uppercase text-muted-foreground">
                            {showKindLabel ? (
                                <span className="rounded-sm border bg-background px-2 py-1 text-foreground">
                                    {kindLabels[kind]}
                                </span>
                            ) : null}
                            {entry.category ? (
                                <span>{entry.category}</span>
                            ) : null}
                            {dateLabel ? <span>{dateLabel}</span> : null}
                        </div>
                    ) : null}
                    <div className="grid gap-2">
                        <h2 className="text-xl font-bold leading-tight">
                            {entry.title}
                        </h2>
                        {entry.excerpt ? (
                            <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                                {entry.excerpt}
                            </p>
                        ) : null}
                    </div>
                </div>
                {entry.metaImageUrl ? (
                    <div className="aspect-[16/9] border-t bg-muted/30 md:aspect-auto md:min-h-36 md:border-l md:border-t-0">
                        {/* biome-ignore lint/performance/noImgElement: CMS images are remote author content. */}
                        <img
                            alt=""
                            className="h-full w-full object-cover"
                            src={entry.metaImageUrl}
                        />
                    </div>
                ) : null}
            </a>
        </article>
    );
}
