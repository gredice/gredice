'use client';

import { usePostHog } from '@posthog/next';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

type SearchResult = {
    entityId: number;
    entityType: string;
    categoryLabel: string;
    title: string;
    summary: string | null;
    href: string;
};

type CategoryOption = { slug: string; label: string };

export function SearchInteractive({
    categoryOptions,
    query,
    selectedCategory,
    results,
}: {
    categoryOptions: readonly CategoryOption[];
    query: string;
    selectedCategory: string;
    results: SearchResult[];
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
        const key = `${normalizedQuery}:${selectedCategory}`;
        if (emitted.current === key) return;
        emitted.current = key;
        posthog?.capture('public_search_submitted', {
            category: selectedCategory,
            query: normalizedQuery,
            queryLength: normalizedQuery.length,
            resultCount: results.length,
        });
        if (results.length === 0) {
            posthog?.capture('public_search_no_results', {
                category: selectedCategory,
                query: normalizedQuery,
                queryLength: normalizedQuery.length,
            });
        }
    }, [posthog, query, results.length, selectedCategory]);

    const navigateCategory = (nextCategory: string) => {
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
        router.replace(
            nextParams.toString() ? `${pathname}?${nextParams}` : pathname,
        );
    };

    return (
        <>
            <Row spacing={2} className="flex-wrap">
                {categoryOptions.map((option) => (
                    <Button
                        key={option.slug}
                        variant={
                            selectedCategory === option.slug
                                ? 'solid'
                                : 'outlined'
                        }
                        size="sm"
                        onClick={() => navigateCategory(option.slug)}
                    >
                        {option.label}
                    </Button>
                ))}
            </Row>
            <Stack spacing={3}>
                {results.map((result, index) => (
                    <Card key={`${result.entityType}-${result.entityId}`} className="p-4">
                        <Stack spacing={2}>
                            <Row spacing={2} alignItems="center" className="flex-wrap">
                                <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium">
                                    {result.categoryLabel}
                                </span>
                                <a
                                    href={result.href.replace('https://www.gredice.com', '')}
                                    onClick={() =>
                                        posthog?.capture('public_search_result_clicked', {
                                            category: selectedCategory,
                                            href: result.href,
                                            rank: index + 1,
                                            queryLength: query.trim().length,
                                        })
                                    }
                                >
                                    <Typography level="h5">{result.title}</Typography>
                                </a>
                            </Row>
                            {result.summary ? <Typography>{result.summary}</Typography> : null}
                        </Stack>
                    </Card>
                ))}
            </Stack>
        </>
    );
}
