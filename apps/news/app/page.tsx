import { Container } from '@gredice/ui/Container';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { EmptyNewsState } from '../components/EmptyNewsState';
import { FilterPills } from '../components/FilterPills';
import { NewsArchiveNavigation } from '../components/NewsArchiveNavigation';
import { NewsCard } from '../components/NewsCard';
import { getBlogPosts, uniqueNewsValues } from '../lib/news';
import { getNewsArticleViewTransitionName } from '../lib/viewTransitions';

export const dynamic = 'force-dynamic';

function normalizeFilterValue(value: string | undefined) {
    return value?.trim().toLocaleLowerCase('hr-HR');
}

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
        redirect(changelogTagRedirectPath(requestedTag));
    }

    if (type === 'changelog') {
        redirect('/sto-je-novo');
    }
    if (type) {
        redirect(blogArchivePath(category));
    }

    const activeCategory = category;
    const normalizedCategory = normalizeFilterValue(activeCategory);
    const allPosts = await getBlogPosts();
    const currentFilters = { category: activeCategory };
    const categories = uniqueNewsValues(allPosts, (item) => item.category);
    const visiblePosts = allPosts.filter((post) => {
        if (
            normalizedCategory &&
            normalizeFilterValue(post.category ?? undefined) !==
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
            <NewsArchiveNavigation active="blog" />
            {categories.length > 0 ? (
                <aside className="grid gap-4 rounded-md border bg-muted/15 p-4">
                    <FilterPills
                        active={activeCategory}
                        currentFilters={currentFilters}
                        label="Kategorije"
                        param="category"
                        values={categories}
                    />
                </aside>
            ) : null}
            {visiblePosts.length > 0 ? (
                <section className="grid items-start gap-4 md:grid-cols-2">
                    {visiblePosts.map((entry) => (
                        <NewsCard
                            key={entry.id}
                            entry={entry}
                            href={`/${entry.slug}` as Route}
                            kind="blog"
                            viewTransitionName={getNewsArticleViewTransitionName(
                                'blog',
                                entry.slug,
                            )}
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
