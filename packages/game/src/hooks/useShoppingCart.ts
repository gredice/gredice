import { client } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';

export const useShoppingCartQueryKey = ['shopping-cart'];

export function useShoppingCart() {
    const { data: currentUser } = useCurrentUser();
    return useQuery({
        queryKey: useShoppingCartQueryKey,
        queryFn: async () => {
            const response = await client().api['shopping-cart'].$get();
            if (response.status === 401) {
                return null;
            }
            if (response.status !== 200) {
                throw new Error('Failed to fetch shopping cart');
            }
            return await response.json();
        },
        enabled: !!currentUser,
    });
}

export type ShoppingCartData = NonNullable<
    Awaited<ReturnType<typeof useShoppingCart>['data']>
>;
export type ShoppingCartItemData = ShoppingCartData['items'][0];
