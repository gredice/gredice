import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameState } from '../useGameState';
import { currentGardenKeys } from './useCurrentGarden';
import { inventoryQueryKey } from './useInventory';

export function useOpenGiftBox() {
    const queryClient = useQueryClient();
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(winterMode);

    return useMutation({
        mutationFn: async ({
            gardenId,
            blockId,
        }: {
            gardenId: number;
            blockId: string;
        }) => {
            const response = await client().api.gardens[':gardenId'].blocks[
                ':blockId'
            ]['open-gift-box'].$post({
                param: {
                    gardenId: gardenId.toString(),
                    blockId,
                },
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                const errorMessage =
                    payload &&
                    typeof payload === 'object' &&
                    'error' in payload &&
                    typeof payload.error === 'string'
                        ? payload.error
                        : 'Poklon kutija još nije dostupna ili se ne može otvoriti.';
                throw new Error(errorMessage);
            }

            return payload;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: gardenQueryKey });
            queryClient.invalidateQueries({ queryKey: inventoryQueryKey });
        },
    });
}
