import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useGameSceneRuntimeActive } from '../scene/sceneRuntimeActivity';
import { useGameState } from '../useGameState';
import { useCurrentGarden } from './useCurrentGarden';

export function detailedRaisedBedInspectionReportsQueryKey(
    gardenId: number | null | undefined,
) {
    return [
        'detailed-raised-bed-inspection-reports',
        gardenId ?? null,
    ] as const;
}

async function getDetailedRaisedBedInspectionReports(
    gardenId: number,
    signal?: AbortSignal,
) {
    const response = await clientAuthenticated().api.gardens[':gardenId'][
        'detailed-inspection-reports'
    ].$get(
        {
            param: { gardenId: gardenId.toString() },
        },
        { init: { signal } },
    );

    if (!response.ok) {
        throw new Error(
            'Failed to load detailed raised bed inspection reports',
        );
    }

    return response.json();
}

export type DetailedRaisedBedInspectionReport = Awaited<
    ReturnType<typeof getDetailedRaisedBedInspectionReports>
>['reports'][number];
type DetailedRaisedBedInspectionReportsResponse = Awaited<
    ReturnType<typeof getDetailedRaisedBedInspectionReports>
>;

export function useDetailedRaisedBedInspectionReports() {
    const { data: currentGarden } = useCurrentGarden();
    const runtimeActive = useGameSceneRuntimeActive();
    const queryClient = useQueryClient();
    const isMock = useGameState((state) => state.isMock);
    const localSandboxStorageKey = useGameState(
        (state) => state.localSandboxStorageKey,
    );
    const enabled =
        runtimeActive &&
        currentGarden?.id != null &&
        !currentGarden.isSandbox &&
        !isMock &&
        localSandboxStorageKey === null;

    useEffect(() => {
        if (runtimeActive) {
            return;
        }
        void queryClient.cancelQueries({
            exact: true,
            queryKey: detailedRaisedBedInspectionReportsQueryKey(
                currentGarden?.id,
            ),
        });
    }, [currentGarden?.id, queryClient, runtimeActive]);

    return useQuery({
        queryKey: detailedRaisedBedInspectionReportsQueryKey(currentGarden?.id),
        queryFn: async ({ signal }) => {
            if (currentGarden?.id == null) {
                throw new Error(
                    'Garden ID is required to load detailed inspection reports',
                );
            }
            return getDetailedRaisedBedInspectionReports(
                currentGarden.id,
                signal,
            );
        },
        enabled,
        refetchInterval: enabled ? 60_000 : false,
        staleTime: 30_000,
    });
}

export function useMarkDetailedRaisedBedInspectionReportsSeen() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            gardenId,
            notificationIds,
        }: {
            gardenId: number;
            notificationIds: string[];
        }) => {
            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ]['detailed-inspection-reports'].seen.$post({
                param: { gardenId: gardenId.toString() },
                json: { notificationIds },
            });

            if (!response.ok) {
                throw new Error(
                    'Failed to dismiss detailed raised bed inspection reports',
                );
            }

            return response.json();
        },
        onMutate: async (variables) => {
            const queryKey = detailedRaisedBedInspectionReportsQueryKey(
                variables.gardenId,
            );
            await queryClient.cancelQueries({ queryKey });
            const previous =
                queryClient.getQueryData<DetailedRaisedBedInspectionReportsResponse>(
                    queryKey,
                );
            const dismissedIds = new Set(variables.notificationIds);
            queryClient.setQueryData<DetailedRaisedBedInspectionReportsResponse>(
                queryKey,
                (current) =>
                    current
                        ? {
                              ...current,
                              reports: current.reports.filter(
                                  (report) =>
                                      !dismissedIds.has(report.notificationId),
                              ),
                          }
                        : current,
            );
            return { previous, queryKey };
        },
        onError: (_error, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(context.queryKey, context.previous);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
        onSettled: (_data, _error, variables) => {
            queryClient.invalidateQueries({
                queryKey: detailedRaisedBedInspectionReportsQueryKey(
                    variables.gardenId,
                ),
            });
        },
    });
}
