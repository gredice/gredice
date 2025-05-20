import { client } from "@gredice/client";
import { useQuery } from "@tanstack/react-query";

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