import {
    clientAuthenticated,
    type GardenVisitSummaryResponse,
} from '@gredice/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useGameState } from '../useGameState';
import {
    DEFAULT_GARDEN_VISIT_SUMMARY_DISPLAY_ITEMS,
    formatGardenVisitSummaryFacts,
    gardenVisitSummaryQueryKey,
} from './gardenVisitSummary';
import { useCurrentGarden } from './useCurrentGarden';

export type {
    GardenVisitSummaryDisplayItem,
    GardenVisitSummaryFact,
    GardenVisitSummarySource,
    GardenVisitSummaryTarget,
} from './gardenVisitSummary';
export {
    formatGardenVisitSummaryFacts,
    gardenVisitSummaryQueryKey,
} from './gardenVisitSummary';

type MarkGardenVisitSummarySeenVariables = {
    factsHash?: string | null;
};

async function getGardenVisitSummary(
    gardenId: number,
): Promise<GardenVisitSummaryResponse> {
    const response = await clientAuthenticated().api.gardens[':gardenId'][
        'visit-summary'
    ].$get({
        param: {
            gardenId: gardenId.toString(),
        },
    });

    if (response.status === 401) {
        throw new Error('Login required to load garden visit summary');
    }

    if (response.status === 404) {
        throw new Error('Garden visit summary not found');
    }

    if (!response.ok) {
        throw new Error(
            `Failed to load garden visit summary: ${response.status.toString()} ${response.statusText}`,
        );
    }

    return response.json();
}

export function useGardenVisitSummary({
    enabled = true,
    maxItems = DEFAULT_GARDEN_VISIT_SUMMARY_DISPLAY_ITEMS,
}: {
    enabled?: boolean;
    maxItems?: number;
} = {}) {
    const currentGardenQuery = useCurrentGarden();
    const currentGarden = currentGardenQuery.data;
    const isMock = useGameState((state) => state.isMock);
    const localSandboxStorageKey = useGameState(
        (state) => state.localSandboxStorageKey,
    );
    const canLoadSummary =
        enabled &&
        currentGarden?.id != null &&
        !isMock &&
        localSandboxStorageKey === null;
    const query = useQuery({
        queryKey: gardenVisitSummaryQueryKey(currentGarden?.id),
        queryFn: async () => {
            if (currentGarden?.id == null) {
                throw new Error('Garden ID is required to load visit summary');
            }

            return getGardenVisitSummary(currentGarden.id);
        },
        enabled: canLoadSummary,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    });
    const displayItems = useMemo(
        () =>
            formatGardenVisitSummaryFacts(query.data?.facts ?? [], {
                maxItems,
            }),
        [query.data?.facts, maxItems],
    );

    return {
        ...query,
        displayItems,
        facts: query.data?.facts ?? [],
        factsHash: query.data?.factsHash ?? null,
        canLoadSummary,
        gardenReady: currentGardenQuery.isFetched || currentGardenQuery.isError,
        hasDisplayItems: displayItems.length > 0,
    };
}

export function useMarkGardenVisitSummarySeen() {
    const queryClient = useQueryClient();
    const { data: currentGarden } = useCurrentGarden();
    const gardenId = currentGarden?.id;

    return useMutation({
        mutationFn: async ({
            factsHash,
        }: MarkGardenVisitSummarySeenVariables = {}) => {
            if (gardenId == null) {
                throw new Error(
                    'Garden ID is required to mark visit summary seen',
                );
            }

            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ]['visit-summary'].seen.$post({
                param: {
                    gardenId: gardenId.toString(),
                },
                json: {
                    factsHash: factsHash ?? null,
                },
            });

            if (!response.ok) {
                throw new Error(
                    `Failed to mark garden visit summary seen: ${response.status.toString()} ${response.statusText}`,
                );
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: gardenVisitSummaryQueryKey(gardenId),
            });
        },
    });
}
