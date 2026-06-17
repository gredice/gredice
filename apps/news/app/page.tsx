import { Container } from '@gredice/ui/Container';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { EmptyNewsState } from '../components/EmptyNewsState';
import { FilterPills } from '../components/FilterPills';
import {
    NewsCard,
    type NewsCardEntry,
    type NewsCardKind,
} from '../components/NewsCard';
import { NewsTagFilters } from '../components/NewsTagFilters';
import {
    getBlogPosts,
    getChangelogEntries,
    getPrimaryNewsTags,
    uniqueNewsValues,
} from '../lib/news';

export const dynamic = 'force-dynamic';

const newsTypeFilters = [
    { label: 'Blog', value: 'blog' },
    { label: 'Što je novo', value: 'changelog' },
] satisfies { label: string; value: NewsCardKind }[];

type NewsLandingItem = {
    entry: NewsCardEntry;
    href: Route;
    kind: NewsCardKind;
    sortTime: number;
};

function normalizedTime(value: string | null | undefined) {
    if (!value) {
        return 0;
    }

    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
}

function normalizeNewsTypeFilter(value: string | undefined) {
    return value === 'blog' || value === 'changelog' ? value : undefined;
}

function normalizeFilterValue(value: string | undefined) {
    return value?.trim().toLocaleLowerCase('hr-HR');
}

function changelogTagRedirectPath(tag: string): Route {
    return `/sto-je-novo?tag=${encodeURIComponent(tag)}` as Route;
}

export default async function NewsHomePage({
    searchParams,
}: {
    searchParams: Promise<{ category?: string; tag?: string; type?: string }>;
}) {
    const { category, tag, type } = await searchParams;
    const requestedTag = tag?.trim();
    if (requestedTag) {
        redirect(changelogTagRedirectPath(requestedTag));
    }

    const activeType = normalizeNewsTypeFilter(type);
    const activeCategory = activeType === 'changelog' ? undefined : category;
    const normalizedCategory = normalizeFilterValue(activeCategory);
    const [allPosts, allChangelogEntries] = await Promise.all([
        getBlogPosts(),
        getChangelogEntries(),
    ]);
    const allItems: NewsLandingItem[] = [
        ...allPosts.map((entry) => ({
            entry,
            href: `/${entry.slug}` as Route,
            kind: 'blog' as const,
            sortTime: normalizedTime(entry.publishedAt),
        })),
        ...allChangelogEntries.map((entry) => ({
            entry,
            href: `/sto-je-novo/${entry.slug}` as Route,
            kind: 'changelog' as const,
            sortTime: normalizedTime(entry.publishedAt),
        })),
    ].sort((left, right) => right.sortTime - left.sortTime);
    const currentFilters = { category: activeCategory, type: activeType };
    const categories =
        activeType === 'changelog'
            ? []
            : uniqueNewsValues(allPosts, (item) => item.category);
    const tags = uniqueNewsValues(allChangelogEntries, (item) => item.tags);
    const primaryTags = getPrimaryNewsTags(allChangelogEntries);
    const primaryTagKeys = new Set(
        primaryTags.map((value) => value.toLocaleLowerCase('hr-HR')),
    );
    const dropdownTags = tags.filter(
        (value) => !primaryTagKeys.has(value.toLocaleLowerCase('hr-HR')),
    );
    const visibleItems = allItems.filter((item) => {
        if (activeType && item.kind !== activeType) {
            return false;
        }

        if (
            normalizedCategory &&
            normalizeFilterValue(item.entry.category ?? undefined) !==
                normalizedCategory
        ) {
            return false;
        }

        return true;
    });

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
                    Blog objave i promjene proizvoda koje pomažu pratiti što se
                    događa u Gredicama.
                </p>
            </section>
            <aside className="grid gap-4 rounded-md border bg-muted/15 p-4">
                <FilterPills
                    active={activeType}
                    currentFilters={currentFilters}
                    label="Vrsta"
                    param="type"
                    values={newsTypeFilters}
                />
                <FilterPills
                    active={activeCategory}
                    currentFilters={currentFilters}
                    label="Kategorije"
                    param="category"
                    values={categories}
                />
                {tags.length > 0 ? (
                    <div className="grid gap-2">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                            Tagovi
                        </p>
                        <NewsTagFilters
                            dropdownTags={dropdownTags}
                            primaryTags={primaryTags}
                        />
                    </div>
                ) : null}
            </aside>
            {visibleItems.length > 0 ? (
                <section className="grid gap-4 md:grid-cols-2">
                    {visibleItems.map((item) => (
                        <NewsCard
                            key={`${item.kind}-${item.href}`}
                            entry={item.entry}
                            href={item.href}
                            kind={item.kind}
                        />
                    ))}
                </section>
            ) : (
                <EmptyNewsState title="Još nema objava">
                    Trenutačno nema objavljenih novosti.
                </EmptyNewsState>
            )}
        </Container>
    );
}
