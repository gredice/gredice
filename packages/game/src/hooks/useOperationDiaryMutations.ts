import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys as raisedBedDiaryQueryKeys } from './useRaisedBedDiaryEntries';

type RescheduleVariables = {
    gardenId: number;
    raisedBedId: number;
    operationId: number;
    scheduledDate: string;
};

type CancelVariables = {
    gardenId: number;
    raisedBedId: number;
    operationId: number;
    reason: string;
};

export function useRescheduleOperationMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            gardenId,
            raisedBedId,
            operationId,
            scheduledDate,
        }: RescheduleVariables) => {
            const response = await client().api.gardens[':gardenId'][
                'raised-beds'
            ][':raisedBedId'].operations[':operationId'].reschedule.$post({
                param: {
                    gardenId: gardenId.toString(),
                    raisedBedId: raisedBedId.toString(),
                    operationId: operationId.toString(),
                },
                json: { scheduledDate },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                const message =
                    errorData && typeof errorData.error === 'string'
                        ? errorData.error
                        : 'Failed to reschedule operation';
                throw new Error(message);
            }

            return response.json().catch(() => ({ success: true }));
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: raisedBedDiaryQueryKeys.byId(variables.raisedBedId),
            });
        },
    });
}

export function useCancelOperationMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            gardenId,
            raisedBedId,
            operationId,
            reason,
        }: CancelVariables) => {
            const response = await client().api.gardens[':gardenId'][
                'raised-beds'
            ][':raisedBedId'].operations[':operationId'].cancel.$post({
                param: {
                    gardenId: gardenId.toString(),
                    raisedBedId: raisedBedId.toString(),
                    operationId: operationId.toString(),
                },
                json: { reason },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                const message =
                    errorData && typeof errorData.error === 'string'
                        ? errorData.error
                        : 'Failed to cancel operation';
                throw new Error(message);
            }

            return response.json().catch(() => ({ success: true }));
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: raisedBedDiaryQueryKeys.byId(variables.raisedBedId),
            });
        },
    });
}
