import { useQueryClient } from '@tanstack/react-query';
import { currentAccountKeys } from '../../../packages/game/src/hooks/useCurrentAccount';
import { gardenAccountGroupsKeys } from '../../../packages/game/src/hooks/useGardenAccountGroups';
import { useGardenPackPurchase } from '../../../packages/game/src/hooks/useGardenPackPurchase';
import { createGardenPackOfferFixture } from '../../../packages/game/tests/gardenPackStorefrontFixture';

/** Exercise a captured click handler after owner cache changes, before React rerenders. */
export function GardenPackPurchaseProbe() {
    const purchase = useGardenPackPurchase();
    const client = useQueryClient();
    const switchOwner = (accountId: string) => {
        client.setQueryData(currentAccountKeys, {
            id: accountId,
            sunflowers: { amount: 123 },
        });
        client.setQueryData(gardenAccountGroupsKeys, [
            {
                accountId,
                name: 'Fixture',
                isCurrent: true,
                gardens: [{ id: 1, isSandbox: false }],
            },
        ]);
    };
    return (
        <div>
            <button
                type="button"
                onClick={() => purchase.review(createGardenPackOfferFixture())}
            >
                Review fixture purchase
            </button>
            <button
                type="button"
                onClick={() => {
                    void purchase.confirm();
                }}
            >
                Confirm fixture purchase
            </button>
            <button
                type="button"
                onClick={() => {
                    switchOwner('00000000-0000-4000-8000-000000000020');
                    void purchase.confirm();
                }}
            >
                Switch owner and retry fixture
            </button>
            <button
                type="button"
                onClick={() =>
                    switchOwner('00000000-0000-4000-8000-000000000010')
                }
            >
                Restore fixture owner
            </button>
            <output data-testid="pending-command">
                {JSON.stringify({
                    command: purchase.session?.command,
                    uncertain: purchase.session?.uncertain,
                    error: purchase.session?.error,
                })}
            </output>
        </div>
    );
}
