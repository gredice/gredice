import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deliveryAddressesQueryKey } from './useDeliveryAddresses';
import { tutorialChecklistKeys } from './useTutorialChecklist';

async function deliveryAddressMutationError(
    response: Response,
    fallback: string,
) {
    const body: unknown = await response.json().catch(() => null);
    return typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof body.error === 'string'
        ? body.error
        : fallback;
}

export function useCreateDeliveryAddress() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: {
            label: string;
            contactName: string;
            phone: string;
            street1: string;
            street2?: string;
            city: string;
            postalCode: string;
            countryCode?: string;
            isDefault?: boolean;
        }) => {
            const response =
                await clientAuthenticated().api.delivery.addresses.$post({
                    json: data,
                });
            if (!response.ok) {
                throw new Error(
                    await deliveryAddressMutationError(
                        response,
                        'Adresu nije moguće dodati.',
                    ),
                );
            }
            return await response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: deliveryAddressesQueryKey,
            });
            queryClient.invalidateQueries({ queryKey: tutorialChecklistKeys });
        },
    });
}

export function useUpdateDeliveryAddress() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: {
            id: number;
            label?: string;
            contactName?: string;
            phone?: string;
            street1?: string;
            street2?: string;
            city?: string;
            postalCode?: string;
            countryCode?: string;
            isDefault?: boolean;
        }) => {
            const { id, ...updateData } = data;
            const response = await clientAuthenticated().api.delivery.addresses[
                ':id'
            ].$patch({
                param: { id: id.toString() },
                json: updateData,
            });
            if (!response.ok) {
                throw new Error(
                    await deliveryAddressMutationError(
                        response,
                        'Adresu nije moguće ažurirati.',
                    ),
                );
            }
            return await response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: deliveryAddressesQueryKey,
            });
            queryClient.invalidateQueries({ queryKey: tutorialChecklistKeys });
        },
    });
}

export function useDeleteDeliveryAddress() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: number) => {
            const response = await clientAuthenticated().api.delivery.addresses[
                ':id'
            ].$delete({
                param: { id: id.toString() },
            });
            if (!response.ok) {
                throw new Error(
                    await deliveryAddressMutationError(
                        response,
                        'Adresu nije moguće obrisati.',
                    ),
                );
            }
            return await response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: deliveryAddressesQueryKey,
            });
            queryClient.invalidateQueries({ queryKey: tutorialChecklistKeys });
        },
    });
}
