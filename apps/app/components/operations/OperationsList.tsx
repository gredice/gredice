'use client';

import { Button } from '@gredice/ui/Button';
import { LoaderSpinner } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { defaultOperationsListSort } from '../../app/admin/operations/operationsListConfig';
import {
    createOperationsListQueryKey,
    createOperationsListSearchParams,
} from '../../app/admin/operations/operationsListQuery';
import type {
    OperationsListPage,
    OperationsListRecordType,
    OperationsListSort,
} from '../../app/admin/operations/operationsListTypes';
import { NoDataPlaceholder } from '../shared/placeholders/NoDataPlaceholder';
import { OperationListItem } from './OperationListItem';
import { OperationsListToolbar } from './OperationsListToolbar';

async function fetchOperationsPage({
    direction,
    fromFilter,
    limit,
    offset,
    operationEntityIds,
    recordType,
    sortKey,
}: {
    direction: OperationsListSort['direction'];
    fromFilter: string;
    limit: number;
    offset: number;
    operationEntityIds: number[];
    recordType: OperationsListRecordType;
    sortKey: OperationsListSort['key'];
}) {
    const searchParams = createOperationsListSearchParams({
        direction,
        fromFilter,
        limit,
        offset,
        operationEntityIds,
        recordType,
        sortKey,
    });
    const response = await fetch(
        `/api/admin/operations?${searchParams.toString()}`,
        { cache: 'no-store' },
    );

    if (!response.ok) {
        throw new Error('Failed to load operations.');
    }

    const page: OperationsListPage = await response.json();
    return page;
}

export function OperationsList({
    fromFilter,
    initialPage,
    operationEntityIds,
    recordType,
}: {
    fromFilter: string;
    initialPage: OperationsListPage;
    operationEntityIds: number[];
    recordType: OperationsListRecordType;
}) {
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const [sort, setSort] = useState<OperationsListSort>(
        defaultOperationsListSort,
    );
    const shouldUseInitialPage =
        sort.key === defaultOperationsListSort.key &&
        sort.direction === defaultOperationsListSort.direction;
    const operationsQuery = useInfiniteQuery({
        queryKey: createOperationsListQueryKey({
            fromFilter,
            operationEntityIds,
            recordType,
            sort,
        }),
        queryFn: ({ pageParam }) =>
            fetchOperationsPage({
                direction: sort.direction,
                fromFilter,
                limit: initialPage.pageSize,
                offset: pageParam,
                operationEntityIds,
                recordType,
                sortKey: sort.key,
            }),
        initialData: shouldUseInitialPage
            ? {
                  pages: [initialPage],
                  pageParams: [0],
              }
            : undefined,
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
        staleTime: 5000,
    });
    const pages = operationsQuery.data?.pages ?? [];
    const operations = useMemo(
        () => pages.flatMap((page) => page.operations),
        [pages],
    );
    const totalCount = pages[0]?.totalCount ?? initialPage.totalCount;

    useEffect(() => {
        const sentinel = sentinelRef.current;

        if (
            !sentinel ||
            !operationsQuery.hasNextPage ||
            operationsQuery.isFetchingNextPage
        ) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    void operationsQuery.fetchNextPage();
                }
            },
            { rootMargin: '360px 0px' },
        );

        observer.observe(sentinel);

        return () => observer.disconnect();
    }, [
        operationsQuery.fetchNextPage,
        operationsQuery.hasNextPage,
        operationsQuery.isFetchingNextPage,
    ]);

    return (
        <div className="min-w-0">
            <OperationsListToolbar
                isRefreshing={
                    operationsQuery.isFetching &&
                    !operationsQuery.isFetchingNextPage
                }
                onSortChange={setSort}
                sort={sort}
                totalCount={totalCount}
            />

            {operationsQuery.isPending ? (
                <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
                    <LoaderSpinner className="size-4 animate-spin" />
                    <Typography level="body2">Učitavanje zapisa</Typography>
                </div>
            ) : operationsQuery.isError ? (
                <div className="p-4">
                    <NoDataPlaceholder>
                        Nije moguće učitati zapise.
                    </NoDataPlaceholder>
                </div>
            ) : operations.length === 0 ? (
                <div className="p-4">
                    <NoDataPlaceholder />
                </div>
            ) : (
                <ul className="divide-y">
                    {operations.map((operation) => (
                        <OperationListItem
                            key={operation.rowId}
                            operation={operation}
                        />
                    ))}
                </ul>
            )}

            <div ref={sentinelRef} className="h-px" aria-hidden />

            {operationsQuery.hasNextPage ? (
                <div className="border-t p-3">
                    <Button
                        type="button"
                        variant="outlined"
                        color="neutral"
                        fullWidth
                        loading={operationsQuery.isFetchingNextPage}
                        onClick={() => {
                            void operationsQuery.fetchNextPage();
                        }}
                    >
                        Učitaj još
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
