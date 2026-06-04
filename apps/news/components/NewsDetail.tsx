import { parseSectionData, SectionsView } from '@gredice/ui/cms';
import type { NewsDetail as NewsDetailEntry } from '../lib/news';
import { formatNewsDate } from '../lib/news';
import { sectionsComponentRegistry } from './shared/sectionsComponentRegistry';

export function NewsDetail({ entry }: { entry: NewsDetailEntry }) {
    return (
        <article className="grid gap-8">
            <header className="mx-auto grid w-full max-w-4xl gap-4 px-4 pt-10 sm:px-6 lg:px-8">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                    {entry.category ? <span>{entry.category}</span> : null}
                    {entry.publishedAt ? (
                        <span>{formatNewsDate(entry.publishedAt)}</span>
                    ) : null}
                </div>
                <h1 className="text-3xl font-bold leading-tight md:text-5xl">
                    {entry.title}
                </h1>
                {entry.excerpt ? (
                    <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
                        {entry.excerpt}
                    </p>
                ) : null}
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
            </header>
            {entry.metaImageUrl ? (
                <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
                    <div className="overflow-hidden rounded-md border bg-muted/20">
                        {/* biome-ignore lint/performance/noImgElement: CMS images are remote author content. */}
                        <img
                            alt=""
                            className="max-h-[520px] w-full object-cover"
                            src={entry.metaImageUrl}
                        />
                    </div>
                </div>
            ) : null}
            <SectionsView
                componentsRegistry={sectionsComponentRegistry}
                renderMaxWidth={entry.renderMaxWidth}
                renderMode={entry.renderMode}
                sectionsData={parseSectionData(entry.content)}
            />
        </article>
    );
}
