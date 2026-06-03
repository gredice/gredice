import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGardensKeys } from './useGardens';
import { queryKeys as raisedBedDiaryQueryKeys } from './useRaisedBedDiaryEntries';
import { queryKeys as raisedBedFieldDiaryQueryKeys } from './useRaisedBedFieldDiaryEntries';

export type DiaryRescheduleTarget =
    | {
          type: 'operation';
          operationId: number;
          raisedBedId: number | null;
          raisedBedFieldId: number | null;
          positionIndex?: number;
          scheduledDate: string;
      }
    | {
          type: 'raisedBedFieldPlant';
          raisedBedId: number;
          positionIndex: number;
          scheduledDate: string;
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

    const scheduledDate = new Date(target.scheduledDate);
    if (Number.isNaN(scheduledDate.getTime())) {
        return false;
    }

    return (
        startOfUtcDay(scheduledDate).getTime() >=
        getMinimumRescheduleDate(referenceDate).getTime()
    );
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
        },
    });
}
