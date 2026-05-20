'use client';

import { usePostHog } from '@posthog/next';
import { cx } from '@signalco/ui-primitives/cx';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { DirectorySearchResultVisual } from '../../components/search/DirectorySearchResultVisual';
import { SearchCategoryFilters } from '../../components/search/SearchCategoryFilters';
import {
    type SearchCategoryValue,
    searchPageHref,
    searchPageLimit,
} from '../../components/search/searchCategories';

type SearchResult = {
    entityId: number;
    entityType: string;
    categoryLabel: string;
    title: string;
    summary?: string | null;
    imageUrl?: string | null;
    imageAlt?: string | null;
    visualKey?: string | null;
    href: string;
};

function localHref(href: string) {
    try {
        const parsed = new URL(href, 'https://www.gredice.com');
        if (parsed.hostname === 'www.gredice.com') {
            return `${parsed.pathname}${parsed.search}${parsed.hash}` as Route;
        }
    } catch {
        return href as Route;
    }

    return href as Route;
}

export function SearchInteractive({
    query,
    selectedCategory,
    results,
    page,
    hasNextPage,
}: {
    query: string;
    selectedCategory: SearchCategoryValue;
    results: SearchResult[];
    page: number;
    hasNextPage: boolean;
}) {
    const posthog = usePostHog();
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const previousCategory = useRef(selectedCategory);
    const emitted = useRef<string | null>(null);

    useEffect(() => {
        const normalizedQuery = query.trim();
        if (normalizedQuery.length < 2) return;
        const key = `${normalizedQuery}:${selectedCategory}:${page}`;
        if (emitted.current === key) return;
        emitted.current = key;
        posthog?.capture('public_search_submitted', {
            category: selectedCategory,
            page,
            queryLength: normalizedQuery.length,
            resultCount: results.length,
        });
        if (results.length === 0) {
            posthog?.capture('public_search_no_results', {
                category: selectedCategory,
                page,
                queryLength: normalizedQuery.length,
            });
        }
    }, [page, posthog, query, results.length, selectedCategory]);

    const navigateCategory = (nextCategory: SearchCategoryValue) => {
        if (previousCategory.current !== nextCategory) {
            posthog?.capture('public_search_category_filter_changed', {
                category: nextCategory,
                previousCategory: previousCategory.current,
                queryLength: query.trim().length,
            });
        }
        previousCategory.current = nextCategory;
        const nextParams = new URLSearchParams(params.toString());
        if (nextCategory === 'all') nextParams.delete('kategorija');
        else nextParams.set('kategorija', nextCategory);
        nextParams.delete('stranica');
        const nextHref = (
            nextParams.toString() ? `${pathname}?${nextParams}` : pathname
        ) as Route;
        router.replace(nextHref);
    };

    const previousHref =
        page > 1
            ? searchPageHref({
                  query,
                  category: selectedCategory,
                  page: page - 1,
              })
            : null;
    const nextHref = hasNextPage
        ? searchPageHref({
              query,
              category: selectedCategory,
              page: page + 1,
          })
        : null;

    return (
        <>
            <SearchCategoryFilters
                activeCategory={selectedCategory}
                onSelect={navigateCategory}
                className="px-0 py-0"
                withBorder={false}
            />
            <Stack spacing={2}>
                {results.map((result, index) => (
                    <a
                        key={`${result.entityType}-${result.entityId}`}
                        href={localHref(result.href)}
                        className="flex gap-3 rounded-lg border border-border/70 bg-card p-3 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60"
                        onClick={() =>
                            posthog?.capture('public_search_result_clicked', {
                                category: selectedCategory,
                                href: result.href,
                                page,
                                rank: (page - 1) * searchPageLimit + index + 1,
                                queryLength: query.trim().length,
                            })
                        }
                    >
                        <DirectorySearchResultVisual
                            result={result}
                            imageSize={56}
                            className="size-14 rounded-lg"
                            iconClassName="size-6"
                        />
                        <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                                <span className="truncate text-base font-medium">
                                    {result.title}
                                </span>
                                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                    {result.categoryLabel}
                                </span>
                            </span>
                            {result.summary ? (
                                <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
                                    {result.summary}
                                </span>
                            ) : null}
                        </span>
                    </a>
                ))}
            </Stack>
            {previousHref || nextHref ? (
                <nav
                    className="flex items-center justify-between gap-3"
                    aria-label="Stranice rezultata"
                >
                    {previousHref ? (
                        <a
                            href={previousHref}
                            className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                        >
                            Prethodno
                        </a>
                    ) : (
                        <span />
                    )}
                    <Typography level="body2" className="text-muted-foreground">
                        Stranica {page}
                    </Typography>
                    {nextHref ? (
                        <a
                            href={nextHref}
                            className={cx(
                                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                                'bg-primary text-primary-foreground hover:bg-primary/90',
                            )}
                        >
                            Sljedeće
                        </a>
                    ) : (
                        <span />
                    )}
                </nav>
            ) : null}
        </>
    );
}
