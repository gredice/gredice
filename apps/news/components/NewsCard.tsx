import type { NewsListItem } from '../lib/news';
import { formatNewsDate } from '../lib/news';

export function NewsCard({
    entry,
    href,
}: {
    entry: NewsListItem;
    href: string;
}) {
    return (
        <article className="grid overflow-hidden rounded-md border bg-card shadow-xs md:grid-cols-[minmax(0,1fr)_220px]">
            <a className="grid gap-4 p-5 md:p-6" href={href}>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                    {entry.category ? <span>{entry.category}</span> : null}
                    {entry.publishedAt ? (
                        <span>{formatNewsDate(entry.publishedAt)}</span>
                    ) : null}
                </div>
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
                {entry.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {entry.tags.map((tag) => (
                            <span
                                key={tag}
                                className="rounded-sm bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                ) : null}
            </a>
            {entry.metaImageUrl ? (
                <a
                    aria-label={`Pročitaj: ${entry.title}`}
                    className="block min-h-48 border-t bg-muted/30 md:border-l md:border-t-0"
                    href={href}
                >
                    {/* biome-ignore lint/performance/noImgElement: CMS images are remote author content. */}
                    <img
                        alt=""
                        className="h-full min-h-48 w-full object-cover"
                        src={entry.metaImageUrl}
                    />
                </a>
            ) : null}
        </article>
    );
}
