'use client';

import { Markdown } from '@gredice/ui/Markdown';
import {
    DirectorySearchResultVisual,
    type SearchCategoryValue,
    searchPageHref,
    searchPageLimit,
} from '@gredice/ui/PublicChrome';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { usePostHog } from '@posthog/next';
import type { Route } from 'next';
import { useCallback, useEffect, useRef, useState } from 'react';

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

function SearchResultSummary({ summary }: { summary: string }) {
    const summaryRef = useRef<HTMLDivElement>(null);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const measureOverflow = useCallback(() => {
        const element = summaryRef.current;
        if (!element) {
            return;
        }

        setIsOverflowing(element.scrollHeight > element.clientHeight + 1);
    }, []);

    useEffect(() => {
        const element = summaryRef.current;
        const frame = window.requestAnimationFrame(measureOverflow);
        let resizeObserver: ResizeObserver | null = null;

        if (element && typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(measureOverflow);
            resizeObserver.observe(element);
            const content = element.firstElementChild;
            if (content) {
                resizeObserver.observe(content);
            }
        }

        window.addEventListener('resize', measureOverflow);

        return () => {
            window.cancelAnimationFrame(frame);
            resizeObserver?.disconnect();
            window.removeEventListener('resize', measureOverflow);
        };
    }, [measureOverflow]);

    return (
        <div
            ref={summaryRef}
            data-search-result-summary=""
            data-overflowing={isOverflowing ? 'true' : 'false'}
            style={{ maxHeight: '7rem' }}
            className={cx(
                'relative mt-1 max-h-28 overflow-hidden',
                isOverflowing &&
                    'after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-8 after:bg-gradient-to-b after:from-transparent after:to-card group-hover:after:to-muted group-focus-visible:after:to-muted',
            )}
        >
            <Markdown className="text-sm text-muted-foreground prose-headings:my-1 prose-headings:text-sm prose-headings:font-medium prose-headings:text-muted-foreground prose-li:my-0 prose-ol:my-1 prose-p:my-1 prose-strong:text-muted-foreground prose-ul:my-1">
                {summary}
            </Markdown>
        </div>
    );
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
            {results.length > 0 ? (
                <Stack spacing={2}>
                    {results.map((result, index) => (
                        <a
                            key={`${result.entityType}-${result.entityId}`}
                            href={localHref(result.href)}
                            className="group flex gap-3 rounded-lg border border-border/70 bg-card p-3 outline-hidden transition-colors hover:bg-muted/60 focus-visible:bg-muted/60"
                            onClick={() =>
                                posthog?.capture(
                                    'public_search_result_clicked',
                                    {
                                        category: selectedCategory,
                                        href: result.href,
                                        page,
                                        rank:
                                            (page - 1) * searchPageLimit +
                                            index +
                                            1,
                                        queryLength: query.trim().length,
                                    },
                                )
                            }
                        >
                            <DirectorySearchResultVisual
                                result={result}
                                imageSize={56}
                                className="size-14 rounded-lg"
                                iconClassName="size-6"
                            />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="truncate text-base font-medium">
                                        {result.title}
                                    </span>
                                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                        {result.categoryLabel}
                                    </span>
                                </div>
                                {result.summary ? (
                                    <SearchResultSummary
                                        summary={result.summary}
                                    />
                                ) : null}
                            </div>
                        </a>
                    ))}
                </Stack>
            ) : null}
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
