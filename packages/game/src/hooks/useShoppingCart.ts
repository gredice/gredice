import { client } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const useShoppingCartQueryKey = ['shopping-cart'];

export function useShoppingCart() {
    return useQuery({
        queryKey: useShoppingCartQueryKey,
        queryFn: async () => {
            const response = await client().api['shopping-cart'].$get();
            if (response.status !== 200) {
                throw new Error('Failed to fetch shopping cart');
            }
            return await response.json();
        },
    });
}

export type ShoppingCartData = NonNullable<
    Awaited<ReturnType<typeof useShoppingCart>['data']>
>;
export type ShoppingCartItemData = ShoppingCartData['items'][0];
