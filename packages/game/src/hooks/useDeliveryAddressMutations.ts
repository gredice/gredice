import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deliveryAddressesQueryKey } from './useDeliveryAddresses';

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
            const response = await client().api.delivery.addresses.$post({
                json: data,
            });
            if (!response.ok) {
                throw new Error('Failed to create delivery address');
            }
            return await response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: deliveryAddressesQueryKey,
            });
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
            const response = await client().api.delivery.addresses[
                ':id'
            ].$patch({
                param: { id: id.toString() },
                json: updateData,
            });
            if (!response.ok) {
                throw new Error('Failed to update delivery address');
            }
            return await response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: deliveryAddressesQueryKey,
            });
        },
    });
}

export function useDeleteDeliveryAddress() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: number) => {
            const response = await client().api.delivery.addresses[
                ':id'
            ].$delete({
                param: { id: id.toString() },
            });
            if (!response.ok) {
                throw new Error('Failed to delete delivery address');
            }
            return await response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: deliveryAddressesQueryKey,
            });
        },
    });
}
