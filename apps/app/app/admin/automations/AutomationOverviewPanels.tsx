'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@gredice/ui/Tabs';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { AutomationDefinitionsList } from './AutomationDefinitionsList';
import { AutomationJobsQueueList } from './AutomationJobsQueueTable';
import { isAutomationRunLive } from './AutomationStatusIndicator';
import type { AutomationRunStatusFilter } from './automationRunFilters';
import type { AutomationDefinitionListItem, AutomationRunsPage } from './types';

function activeRunsInPages(pages: AutomationRunsPage[] | undefined) {
    return pages?.some((page) =>
        page.runs.some((run) => isAutomationRunLive(run.status)),
    );
}

async function fetchAutomationRunsPage({
    limit,
    offset,
    runStatusFilter,
}: {
    limit: number;
    offset: number;
    runStatusFilter: AutomationRunStatusFilter;
}) {
    const searchParams = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        runStatus: runStatusFilter,
    });

    const response = await fetch(
        `/api/admin/automations/runs?${searchParams.toString()}`,
        { cache: 'no-store' },
    );

    if (!response.ok) {
        throw new Error('Failed to load automation runs.');
    }

    return (await response.json()) as AutomationRunsPage;
}

export function AutomationOverviewPanels({
    definitions,
    initialRunsPage,
    runStatusFilter,
}: {
    definitions: AutomationDefinitionListItem[];
    initialRunsPage: AutomationRunsPage;
    runStatusFilter: AutomationRunStatusFilter;
}) {
    const runsQuery = useInfiniteQuery({
        queryKey: ['automation-runs', { runStatusFilter }],
        queryFn: ({ pageParam }) =>
            fetchAutomationRunsPage({
                limit: initialRunsPage.pageSize,
                offset: pageParam,
                runStatusFilter,
            }),
        initialData: {
            pages: [initialRunsPage],
            pageParams: [0],
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
        refetchInterval: (query) =>
            activeRunsInPages(query.state.data?.pages) ? 7000 : false,
        refetchIntervalInBackground: false,
        staleTime: 5000,
    });
    const runs = useMemo(
        () => runsQuery.data.pages.flatMap((page) => page.runs),
        [runsQuery.data.pages],
    );
    const definitionsPanel = (
        <AutomationDefinitionsList definitions={definitions} />
    );
    const queuePanel = (
        <AutomationJobsQueueList
            hasMore={runsQuery.hasNextPage}
            isFetching={runsQuery.isFetching}
            isFetchingNextPage={runsQuery.isFetchingNextPage}
            loadMore={() => {
                void runsQuery.fetchNextPage();
            }}
            runs={runs}
        />
    );

    return (
        <>
            <div className="md:hidden">
                <Tabs defaultValue="definitions">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="definitions">
                            Definicije
                        </TabsTrigger>
                        <TabsTrigger value="queue">Red poslova</TabsTrigger>
                    </TabsList>
                    <TabsContent value="definitions">
                        {definitionsPanel}
                    </TabsContent>
                    <TabsContent value="queue">{queuePanel}</TabsContent>
                </Tabs>
            </div>

            <div className="hidden gap-4 md:grid md:grid-cols-[minmax(0,0.92fr)_minmax(360px,1.08fr)] xl:grid-cols-[minmax(0,0.85fr)_minmax(440px,1.15fr)]">
                {definitionsPanel}
                {queuePanel}
            </div>
        </>
    );
}
