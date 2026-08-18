import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ChangelogWeek } from '../lib/weeklyChangelog';

function changeCountLabel(count: number) {
    return count === 1
        ? '1 promjena'
        : count >= 2 && count <= 4
          ? `${count.toString()} promjene`
          : `${count.toString()} promjena`;
}

export function WeeklyChangelogCard({
    eager = false,
    week,
}: {
    eager?: boolean;
    week: ChangelogWeek;
}) {
    const visibleTags = week.tags.slice(0, 3);

    return (
        <article className="w-full">
            <Link
                className="news-card-view-transition group grid overflow-hidden rounded-md border bg-card shadow-xs transition-colors hover:bg-muted/20 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                href={week.href as Route}
            >
                <div className="relative aspect-[1200/630] overflow-hidden border-b bg-muted/30">
                    <Image
                        alt={week.imageAlt}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
                        height={630}
                        loading={eager ? 'eager' : 'lazy'}
                        sizes="(max-width: 639px) calc(100vw - 4rem), 42vw"
                        src={week.imagePath}
                        unoptimized
                        width={1200}
                    />
                </div>
                <div className="grid content-start gap-3 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                        {week.isCurrentWeek ? (
                            <span className="rounded-sm bg-primary px-2 py-1 text-xs font-semibold uppercase tracking-normal text-primary-foreground">
                                Tjedan još traje
                            </span>
                        ) : null}
                        {visibleTags.map((tag) => (
                            <span
                                className="rounded-sm border bg-secondary px-2 py-1 text-xs font-semibold uppercase tracking-normal text-secondary-foreground"
                                key={tag}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold uppercase text-muted-foreground">
                        <span>{week.rangeLabel}</span>
                        <span aria-hidden>·</span>
                        <span>{changeCountLabel(week.entries.length)}</span>
                    </div>
                    <div className="grid gap-2">
                        <h2 className="text-xl font-bold leading-tight">
                            {week.title}
                        </h2>
                        <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                            {week.description}
                        </p>
                    </div>
                    <span className="text-sm font-semibold text-primary">
                        {week.entries.length > 0
                            ? 'Pogledajte sve promjene'
                            : 'Vratite se po nove promjene'}
                    </span>
                </div>
            </Link>
        </article>
    );
}
