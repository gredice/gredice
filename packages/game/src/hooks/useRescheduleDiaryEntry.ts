import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGardensKeys } from './useGardens';
import { queryKeys as raisedBedDiaryQueryKeys } from './useRaisedBedDiaryEntries';
import { queryKeys as raisedBedFieldDiaryQueryKeys } from './useRaisedBedFieldDiaryEntries';
import { tutorialChecklistKeys } from './useTutorialChecklist';

export type DiaryRescheduleTarget =
    | {
          type: 'operation';
          expectedEntityId: number;
          expectedTaskVersionEventId: number;
          operationId: number;
          raisedBedId: number | null;
          raisedBedFieldId: number | null;
          positionIndex?: number;
          scheduledDate?: string | null;
      }
    | {
          type: 'raisedBedFieldPlant';
          expectedPlantCycleEventId: number;
          expectedPlantCycleVersionEventId: number;
          expectedPlantSortId: number;
          raisedBedId: number;
          positionIndex: number;
          scheduledDate?: string | null;
      };

const mutationKey = ['gardens', 'diary', 'reschedule'];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

async function getResponseErrorMessage(response: Response) {
    const fallbackMessage = 'Preraspoređivanje nije uspjelo.';
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

function getMinimumRescheduleDate(referenceDate = new Date()) {
    const tomorrow = startOfUtcDay(referenceDate);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return tomorrow;
}

export function formatDiaryRescheduleDateInput(date: Date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getMinimumDiaryRescheduleDateInput(referenceDate = new Date()) {
    return formatDiaryRescheduleDateInput(
        getMinimumRescheduleDate(referenceDate),
    );
}

export function isDiaryRescheduleTargetEligible(
    target: DiaryRescheduleTarget | undefined,
    referenceDate = new Date(),
): target is DiaryRescheduleTarget {
    if (!target) {
        return false;
    }

    if (!target.scheduledDate) {
        return true;
    }

    const scheduledDate = new Date(target.scheduledDate);
    if (Number.isNaN(scheduledDate.getTime())) {
        return false;
    }

    return (
        startOfUtcDay(scheduledDate).getTime() >=
        getMinimumRescheduleDate(referenceDate).getTime()
    );
}

export function getDiaryRescheduleDisabledReason(
    target: DiaryRescheduleTarget | undefined,
    referenceDate = new Date(),
) {
    if (!target?.scheduledDate) {
        return null;
    }

    const scheduledDate = new Date(target.scheduledDate);
    if (Number.isNaN(scheduledDate.getTime())) {
        return 'Datum radnje nije ispravan.';
    }

    if (
        startOfUtcDay(scheduledDate).getTime() <
        getMinimumRescheduleDate(referenceDate).getTime()
    ) {
        return 'Datum radnje zakazane za danas više nije moguće promijeniti.';
    }

    return null;
}

async function rescheduleOperation({
    gardenId,
    scheduledDate,
    target,
}: {
    gardenId: number;
    scheduledDate: string;
    target: Extract<DiaryRescheduleTarget, { type: 'operation' }>;
}) {
    const response = await clientAuthenticated().api.gardens[
        ':gardenId'
    ].operations[':operationId'].reschedule.$post({
        param: {
            gardenId: gardenId.toString(),
            operationId: target.operationId.toString(),
        },
        json: {
            expectedEntityId: target.expectedEntityId,
            expectedTaskVersionEventId: target.expectedTaskVersionEventId,
            scheduledDate,
        },
    });

    if (response.status !== 200) {
        throw new Error(await getResponseErrorMessage(response));
    }
}

async function rescheduleRaisedBedFieldPlant({
    gardenId,
    scheduledDate,
    target,
}: {
    gardenId: number;
    scheduledDate: string;
    target: Extract<DiaryRescheduleTarget, { type: 'raisedBedFieldPlant' }>;
}) {
    const response = await clientAuthenticated().api.gardens[':gardenId'][
        'raised-beds'
    ][':raisedBedId'].fields[':positionIndex'].reschedule.$post({
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
            scheduledDate,
        },
    });

    if (response.status !== 200) {
        throw new Error(await getResponseErrorMessage(response));
    }
}

export function useRescheduleDiaryEntry(gardenId: number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey,
        mutationFn: ({
            scheduledDate,
            target,
        }: {
            scheduledDate: string;
            target: DiaryRescheduleTarget;
        }) => {
            if (target.type === 'operation') {
                return rescheduleOperation({
                    gardenId,
                    scheduledDate,
                    target,
                });
            }

            return rescheduleRaisedBedFieldPlant({
                gardenId,
                scheduledDate,
                target,
            });
        },
        onSuccess: async (_data, { target }) => {
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
                queryKey: tutorialChecklistKeys,
            });
        },
    });
}
