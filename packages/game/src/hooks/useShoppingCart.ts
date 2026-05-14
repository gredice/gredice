import { clientAuthenticated } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';

export const useShoppingCartQueryKey = ['shopping-cart'];

export function useShoppingCart(enabled = true) {
    const { data: currentUser } = useCurrentUser();
    return useQuery({
        queryKey: useShoppingCartQueryKey,
        queryFn: async () => {
            const response =
                await clientAuthenticated().api['shopping-cart'].$get();
            if (response.status === 401) {
                return null;
            }
            if (response.status !== 200) {
                throw new Error('Failed to fetch shopping cart');
            }
            return await response.json();
        },
        retry: false,
        staleTime: 1000 * 60 * 5, // 5 minutes
        enabled: enabled && !!currentUser,
    });
}

export type ShoppingCartData = NonNullable<
    Awaited<ReturnType<typeof useShoppingCart>['data']>
>;
export type ShoppingCartItemData = ShoppingCartData['items'][0];
