import { canQueryGardenPackInventory } from '../hud/ownedGardenPackInventory';
import { useGameState } from '../useGameState';
import { useCurrentAccount } from './useCurrentAccount';
import { useCurrentGarden } from './useCurrentGarden';
import { useCurrentUser } from './useCurrentUser';
import { useGardenAccountGroups } from './useGardenAccountGroups';

export function useGardenPackStorefrontContext() {
    const rolloutEnabled = useGameState((state) => state.gardenPacksEnabled);
    const authenticatedQueriesEnabled = useGameState(
        (state) => state.authenticatedGardenQueriesEnabled,
    );
    const isMock = useGameState((state) => state.isMock);
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );
    const authEnabled =
        rolloutEnabled &&
        authenticatedQueriesEnabled &&
        !isMock &&
        !isLocalSandbox;
    const { data: user } = useCurrentUser(authEnabled);
    const { data: account } = useCurrentAccount(authEnabled && Boolean(user));
    const { data: groups } = useGardenAccountGroups(!authEnabled || !user);
    const group = groups?.find((entry) => entry.isCurrent);
    const { data: garden } = useCurrentGarden();
    const eligible = canQueryGardenPackInventory({
        rolloutEnabled,
        authenticatedQueriesEnabled,
        isMock,
        isLocalSandbox,
        isSandbox: garden?.isSandbox,
        userId: user?.id,
        accountId:
            account?.id === group?.accountId &&
            group?.gardens.some((entry) => entry.id === garden?.id)
                ? account?.id
                : undefined,
    });
    return {
        eligible,
        userId: user?.id,
        accountId: group?.accountId,
        balance: account?.sunflowers.amount ?? 0,
    };
}
