import { client } from "@gredice/client";
import { clientStripe } from "@gredice/stripe/client";
import { useMutation } from "@tanstack/react-query";

export function useCheckout() {
    return useMutation({
        mutationFn: async (cartId: number) => {
            const response = await client().api.checkout.checkout.$post({
                json: {
                    cartId: cartId,
                }
            });
            if (!response.ok) {
                console.error("Failed to create checkout session:", response.statusText);
                // TODO: Show notification to user
                return;
            }

            const responseData = await response.json();

            if (!responseData || !responseData.sessionId) {
                console.error("Failed to create checkout session");
                return;
            }
            const { sessionId } = responseData;
            const stripe = await clientStripe();
            const result = await stripe?.redirectToCheckout({
                sessionId
            });
            if (result?.error) {
                console.error("Stripe checkout error:", result.error);
                // TODO: Show notification to user
            }
        }
    })
}
