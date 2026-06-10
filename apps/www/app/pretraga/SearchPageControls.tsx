'use client';

import {
    SearchCategoryFilters,
    type SearchCategoryValue,
} from '@gredice/ui/PublicChrome';
import { usePostHog } from '@posthog/next';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef } from 'react';
import { PageFilterInputNoSSR } from '../../components/shared/PageFilterInputNoSSR';

export function SearchPageControls({
    query,
    selectedCategory,
}: {
    query: string;
    selectedCategory: SearchCategoryValue;
}) {
    const posthog = usePostHog();
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const previousCategory = useRef(selectedCategory);

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
        if (nextCategory === 'all') {
            nextParams.delete('kategorija');
        } else {
            nextParams.set('kategorija', nextCategory);
        }
        nextParams.delete('stranica');

        const nextHref = (
            nextParams.toString() ? `${pathname}?${nextParams}` : pathname
        ) as Route;
        router.replace(nextHref);
    };

    return (
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <PageFilterInputNoSSR
                searchParamName="pretraga"
                fieldName="global-search"
                initialValue={query}
                className="w-full min-w-0 xl:w-[42rem] xl:flex-none"
                navigateOnChange
                placeholder="Pretraga..."
                resetSearchParamNamesOnChange={['stranica']}
            />
            <SearchCategoryFilters
                activeCategory={selectedCategory}
                onSelect={navigateCategory}
                className="min-w-0 px-0 py-0 xl:shrink-0"
                withBorder={false}
            />
        </div>
    );
}
