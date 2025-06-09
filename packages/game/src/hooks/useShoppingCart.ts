import { client } from "@gredice/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useShoppingCart() {
    return useQuery({
        queryKey: ['shopping-cart'],
        queryFn: async () => {
            const response = await client().api["shopping-cart"].$get();
            if (response.status !== 200) {
                throw new Error('Failed to fetch shopping cart');
            }
            return await response.json();
        },
    });
}

export function useSetShoppingCartItem() {
    const queryClient = useQueryClient();
    const { data: cart } = useShoppingCart();
    return useMutation({
        mutationFn: async (item: { entityTypeName: string, entityId: string; amount: number }) => {
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
            return await response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['shopping-cart']
            })
        },
    });
}