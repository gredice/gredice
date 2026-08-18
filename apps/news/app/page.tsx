import { Container } from '@gredice/ui/Container';
import { Timeline, TimelineEntry, TimelineGroup } from '@gredice/ui/Timeline';
import type { Metadata, Route } from 'next';
import { permanentRedirect } from 'next/navigation';
import { EmptyNewsState } from '../components/EmptyNewsState';
import { FilterPills } from '../components/FilterPills';
import { NewsArchiveNavigation } from '../components/NewsArchiveNavigation';
import { NewsCard } from '../components/NewsCard';
import { WeeklyChangelogCard } from '../components/WeeklyChangelogCard';
import {
    formatNewsDate,
    getBlogPosts,
    getChangelogEntries,
    uniqueNewsValues,
} from '../lib/news';
import { newsArchiveMetadata } from '../lib/newsArchiveMetadata';
import {
    isKnownNewsFilter,
    normalizeNewsFilterValue,
} from '../lib/newsFilters';
import { buildNewsTimeline } from '../lib/newsTimeline';
import { getNewsArticleViewTransitionName } from '../lib/viewTransitions';
import { buildChangelogWeeks } from '../lib/weeklyChangelog';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = newsArchiveMetadata;

function changelogTagRedirectPath(tag: string): Route {
    return `/sto-je-novo?tag=${encodeURIComponent(tag)}` as Route;
}

function blogArchivePath(category: string | undefined): Route {
    const requestedCategory = category?.trim();
    return requestedCategory
        ? (`/?category=${encodeURIComponent(requestedCategory)}` as Route)
        : '/';
}

export default async function NewsHomePage({
    searchParams,
}: {
    searchParams: Promise<{ category?: string; tag?: string; type?: string }>;
}) {
    const { category, tag, type } = await searchParams;
    const requestedTag = tag?.trim();
    if (requestedTag) {
        permanentRedirect(changelogTagRedirectPath(requestedTag));
    }

    if (type === 'changelog') {
        permanentRedirect('/sto-je-novo');
    }
    if (type) {
        permanentRedirect(blogArchivePath(category));
    }

    const activeCategory = category?.trim() || undefined;
    const normalizedCategory = normalizeNewsFilterValue(activeCategory);
    const [allPosts, changelogEntries] = await Promise.all([
        getBlogPosts(),
        getChangelogEntries(),
    ]);
    const currentFilters = { category: activeCategory };
    const categories = uniqueNewsValues(allPosts, (item) => item.category);
    if (!isKnownNewsFilter(categories, activeCategory)) {
        permanentRedirect('/');
    }
    const visiblePosts = allPosts.filter((post) => {
        if (
            normalizedCategory &&
            normalizeNewsFilterValue(post.category ?? undefined) !==
                normalizedCategory
        ) {
            return false;
        }

        return true;
    });
    const changelogWeeks = activeCategory
        ? []
        : buildChangelogWeeks(changelogEntries);
    const timelineGroups = buildNewsTimeline(visiblePosts, changelogWeeks);
    const totalItems = timelineGroups.reduce(
        (total, group) => total + group.items.length,
        0,
    );
    let itemIndex = 0;

    return (
        <Container className="grid gap-8 py-10">
            <section className="grid gap-3">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Novosti
                </p>
                <h1 className="max-w-3xl text-3xl font-bold leading-tight md:text-4xl">
                    Novosti iz Gredica
                </h1>
                <p className="max-w-2xl text-lg text-muted-foreground">
                    Blog objave i tjedni pregledi novih mogućnosti, poboljšanja i
                    promjena u Gredicama.
                </p>
            </section>
            <NewsArchiveNavigation active="news" />
            {categories.length > 0 ? (
                <aside className="grid gap-4 rounded-md border bg-muted/15 p-4">
                    <FilterPills
                        active={activeCategory}
                        currentFilters={currentFilters}
                        label="Blog kategorije"
                        param="category"
                        values={categories}
                    />
                </aside>
            ) : null}
            {totalItems > 0 ? (
                <Timeline>
                    {timelineGroups.map((group, groupIndex) => (
                        <TimelineGroup
                            hasItems={group.items.length > 0}
                            isFirst={groupIndex === 0}
                            key={group.monthKey}
                            label={group.monthLabel}
                        >
                            {group.items.map((item) => {
                                const currentItemIndex = itemIndex;
                                itemIndex += 1;

                                return (
                                    <TimelineEntry
                                        index={currentItemIndex}
                                        isLast={
                                            currentItemIndex === totalItems - 1
                                        }
                                        key={item.key}
                                        label={
                                            item.kind === 'blog'
                                                ? (formatNewsDate(
                                                      item.blog.publishedAt,
                                                  ) ?? 'Bez datuma')
                                                : item.week.rangeLabel
                                        }
                                    >
                                        {item.kind === 'blog' ? (
                                            <NewsCard
                                                entry={item.blog}
                                                href={`/${item.blog.slug}` as Route}
                                                kind="blog"
                                                viewTransitionName={getNewsArticleViewTransitionName(
                                                    'blog',
                                                    item.blog.slug,
                                                )}
                                            />
                                        ) : (
                                            <WeeklyChangelogCard
                                                week={item.week}
                                            />
                                        )}
                                    </TimelineEntry>
                                );
                            })}
                        </TimelineGroup>
                    ))}
                </Timeline>
            ) : (
                <EmptyNewsState title="Još nema novosti">
                    Trenutačno nema objavljenih novosti.
                </EmptyNewsState>
            )}
        </Container>
    );
}
