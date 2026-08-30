import { clientAuthenticated } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import { isDeterministicEmptyMockGardenProfile } from '../mockGardenProfilePolicy';
import { useOptionalGameState } from '../useGameState';
import { useCurrentUser } from './useCurrentUser';

export const useShoppingCartQueryKey = ['shopping-cart'];

export function useShoppingCart(enabled = true) {
    const isMock = useOptionalGameState((state) => state.isMock, false);
    const mockGardenProfile = useOptionalGameState(
        (state) => state.mockGardenProfile,
        'default',
    );
    const isDeterministicEmptyMock =
        isMock && isDeterministicEmptyMockGardenProfile(mockGardenProfile);
    const { data: currentUser } = useCurrentUser(
        enabled && !isDeterministicEmptyMock,
    );
    return useQuery({
        queryKey: isDeterministicEmptyMock
            ? [...useShoppingCartQueryKey, mockGardenProfile]
            : useShoppingCartQueryKey,
        queryFn: async () => {
            if (isDeterministicEmptyMock) {
                return null;
            }
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
        enabled: enabled && (isDeterministicEmptyMock || !!currentUser),
    });
}

export type ShoppingCartData = NonNullable<
    Awaited<ReturnType<typeof useShoppingCart>['data']>
>;
export type ShoppingCartItemData = ShoppingCartData['items'][0];
