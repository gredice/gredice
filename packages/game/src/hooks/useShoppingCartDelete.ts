import { client } from "@gredice/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useShoppingCartQueryKey } from "./useShoppingCart";

export function useShoppingCartDelete() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => client().api["shopping-cart"].$delete(),
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: useShoppingCartQueryKey
            })
        },
        scope: {
            id: 'shoppingCartDelete'
        }
    });
}