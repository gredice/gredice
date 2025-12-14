import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deliveryRequestsQueryKey } from './useDeliveryRequests';

export function useCancelDeliveryRequest() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: {
            requestId: string;
            cancelReason: string;
            note?: string;
        }) => {
            const { requestId, ...cancelData } = data;
            const response = await client().api.delivery.requests[
                ':id'
            ].cancel.$patch({
                param: { id: requestId },
                json: cancelData,
            });
            if (!response.ok) {
                const errorData = await response.json();
                if (
                    'error' in errorData &&
                    errorData.error === 'CUTOFF_EXPIRED'
                ) {
                    throw new Error(
                        'Cutoff time has passed. Cannot cancel delivery request.',
                    );
                }
                throw new Error('Failed to cancel delivery request');
            }
            return await response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: deliveryRequestsQueryKey,
            });
        },
    });
}
