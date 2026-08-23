import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { currentAccountKeys } from './useCurrentAccount';
import { useGardensKeys } from './useGardens';
import { notificationsQueryKey } from './useNotifications';
import { queryKeys as raisedBedDiaryQueryKeys } from './useRaisedBedDiaryEntries';
import { queryKeys as raisedBedFieldDiaryQueryKeys } from './useRaisedBedFieldDiaryEntries';
import type { DiaryRescheduleTarget } from './useRescheduleDiaryEntry';
import { tutorialChecklistKeys } from './useTutorialChecklist';

export type DiaryCancelTarget = DiaryRescheduleTarget;

const mutationKey = ['gardens', 'diary', 'cancel'];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

async function getResponseErrorMessage(response: Response) {
    const fallbackMessage = 'Otkazivanje nije uspjelo.';
    const text = await response.text();
    if (!text.trim()) {
        return fallbackMessage;
    }

    try {
        const parsed: unknown = JSON.parse(text);
        if (
            isRecord(parsed) &&
            typeof parsed.error === 'string' &&
            parsed.error.trim()
        ) {
            return parsed.error;
        }
    } catch {
        return text;
    }

    return fallbackMessage;
}

function startOfUtcDay(date: Date) {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
}

function getMinimumCancelDate(referenceDate = new Date()) {
    const tomorrow = startOfUtcDay(referenceDate);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return tomorrow;
}

export function isDiaryCancelTargetEligible(
    target: DiaryCancelTarget | undefined,
    referenceDate = new Date(),
): target is DiaryCancelTarget {
    if (!target?.scheduledDate) {
        return false;
    }

    const scheduledDate = new Date(target.scheduledDate);
    if (Number.isNaN(scheduledDate.getTime())) {
        return false;
    }

    return (
        startOfUtcDay(scheduledDate).getTime() >=
        getMinimumCancelDate(referenceDate).getTime()
    );
}

export function getDiaryCancelDisabledReason(
    target: DiaryCancelTarget | undefined,
    referenceDate = new Date(),
) {
    if (!target?.scheduledDate) {
        return 'Otkazati možeš samo zakazane buduće radnje.';
    }

    const scheduledDate = new Date(target.scheduledDate);
    if (Number.isNaN(scheduledDate.getTime())) {
        return 'Datum radnje nije ispravan.';
    }

    if (
        startOfUtcDay(scheduledDate).getTime() <
        getMinimumCancelDate(referenceDate).getTime()
    ) {
        return 'Radnju zakazanu za danas više nije moguće otkazati.';
    }

    return null;
}

async function cancelOperation({
    gardenId,
    target,
}: {
    gardenId: number;
    target: Extract<DiaryCancelTarget, { type: 'operation' }>;
}) {
    const response = await clientAuthenticated().api.gardens[
        ':gardenId'
    ].operations[':operationId'].cancel.$post({
        param: {
            gardenId: gardenId.toString(),
            operationId: target.operationId.toString(),
        },
        json: {
            expectedEntityId: target.expectedEntityId,
            expectedTaskVersionEventId: target.expectedTaskVersionEventId,
        },
    });

    if (response.status !== 200) {
        throw new Error(await getResponseErrorMessage(response));
    }
}

async function cancelRaisedBedFieldPlant({
    gardenId,
    target,
}: {
    gardenId: number;
    target: Extract<DiaryCancelTarget, { type: 'raisedBedFieldPlant' }>;
}) {
    const response = await clientAuthenticated().api.gardens[':gardenId'][
        'raised-beds'
    ][':raisedBedId'].fields[':positionIndex'].cancel.$post({
        param: {
            gardenId: gardenId.toString(),
            raisedBedId: target.raisedBedId.toString(),
            positionIndex: target.positionIndex.toString(),
        },
        json: {
            expectedPlantCycleEventId: target.expectedPlantCycleEventId,
            expectedPlantCycleVersionEventId:
                target.expectedPlantCycleVersionEventId,
            expectedPlantSortId: target.expectedPlantSortId,
        },
    });

    if (response.status !== 200) {
        throw new Error(await getResponseErrorMessage(response));
    }
}

export function useCancelDiaryEntry(gardenId: number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey,
        mutationFn: (target: DiaryCancelTarget) => {
            if (target.type === 'operation') {
                return cancelOperation({ gardenId, target });
            }

            return cancelRaisedBedFieldPlant({ gardenId, target });
        },
        onSuccess: async (_data, target) => {
            if (target.raisedBedId) {
                await queryClient.invalidateQueries({
                    queryKey: raisedBedDiaryQueryKeys.byId(target.raisedBedId),
                });
            }

            if (target.type === 'raisedBedFieldPlant') {
                await queryClient.invalidateQueries({
                    queryKey: raisedBedFieldDiaryQueryKeys.byId(
                        target.raisedBedId,
                        target.positionIndex,
                    ),
                });
            }

            if (
                target.type === 'operation' &&
                target.raisedBedId &&
                typeof target.positionIndex === 'number'
            ) {
                await queryClient.invalidateQueries({
                    queryKey: raisedBedFieldDiaryQueryKeys.byId(
                        target.raisedBedId,
                        target.positionIndex,
                    ),
                });
            }

            await queryClient.invalidateQueries({
                queryKey: ['garden-operations', gardenId],
            });
            await queryClient.invalidateQueries({
                queryKey: useGardensKeys,
            });
            await queryClient.invalidateQueries({
                queryKey: currentAccountKeys,
            });
            await queryClient.invalidateQueries({
                queryKey: notificationsQueryKey,
            });
            await queryClient.invalidateQueries({
                queryKey: tutorialChecklistKeys,
            });
        },
    });
}
