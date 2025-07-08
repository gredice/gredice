import { client } from "@gredice/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useShoppingCart, useShoppingCartQueryKey } from "./useShoppingCart";

export function useSetShoppingCartItem() {
    const queryClient = useQueryClient();
    const { data: cart } = useShoppingCart();
    return useMutation({
        mutationFn: async (item: {
            id?: number,
            entityTypeName: string,
            entityId: string;
            amount: number,
            gardenId?: number,
            raisedBedId?: number,
            positionIndex?: number,
            additionalData?: string | null,
            currency?: string | null,
            forceCreate?: boolean;
        }) => {
            if (!cart) {
                throw new Error('Shopping cart is not available');
            }

            const response = await client().api["shopping-cart"].$post({
                json: {
                    ...item,
                    cartId: cart.id
                },
            });
            if (response.status !== 200) {
                throw new Error('Failed to set shopping cart item');
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: useShoppingCartQueryKey
            })
        },
        scope: {
            id: 'setShoppingCartItem'
        }
    });
}