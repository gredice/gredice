import { clientAuthenticated } from '@gredice/client';
import { useMutation } from '@tanstack/react-query';

type SwitchGardenAccountVariables = {
    accountId: string;
};

export function useSwitchGardenAccount() {
    return useMutation({
        mutationFn: async ({ accountId }: SwitchGardenAccountVariables) => {
            const response =
                await clientAuthenticated().api.accounts.switch.$post({
                    json: { accountId },
                });
            if (!response.ok) {
                throw new Error(
                    `Failed to switch account: ${response.status} ${response.statusText}`,
                );
            }

            return response.json();
        },
    });
}
