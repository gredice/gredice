import {
    gardenPackInventoryKeys,
    getGardenPackInventory,
} from '@gredice/client';
import { useInfiniteQuery } from '@tanstack/react-query';
import { canQueryGardenPackInventory } from '../hud/ownedGardenPackInventory';
import { useGameState } from '../useGameState';
import { useCurrentAccount } from './useCurrentAccount';
import { useCurrentGarden } from './useCurrentGarden';
import { useCurrentUser } from './useCurrentUser';
import { useGardenAccountGroups } from './useGardenAccountGroups';

export function useGardenPackInventory(open: boolean) {
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
    const { data: accountGroups } = useGardenAccountGroups(
        !authEnabled || !user,
    );
    const activeAccountId = accountGroups?.find(
        (group) => group.isCurrent,
    )?.accountId;
    const { data: garden } = useCurrentGarden();
    const eligible = canQueryGardenPackInventory({
        rolloutEnabled,
        authenticatedQueriesEnabled,
        isMock,
        isLocalSandbox,
        isSandbox: garden?.isSandbox,
        userId: user?.id,
        accountId:
            account?.id === activeAccountId ? activeAccountId : undefined,
    });
    const query = useInfiniteQuery({
        queryKey: [...gardenPackInventoryKeys.all, user?.id, activeAccountId],
        initialPageParam: getInitialCursor(),
        queryFn: async ({ pageParam, signal }) => {
            try {
                const response = await getGardenPackInventory({
                    cursor: pageParam ?? undefined,
                    signal,
                });
                if (response.enabled && response.accountId !== activeAccountId)
                    throw new Error('Account changed');
                return response;
            } catch {
                throw new Error(
                    'Pakete trenutačno nije moguće učitati. Pokušaj ponovno.',
                );
            }
        },
        getNextPageParam: (page) =>
            page.enabled ? (page.nextCursor ?? undefined) : undefined,
        enabled: eligible && open,
        retry: false,
        staleTime: 30_000,
    });
    const visible = eligible && query.data?.pages[0]?.enabled !== false;
    const purchases = visible
        ? (query.data?.pages.flatMap((page) => page.purchases) ?? [])
        : [];
    return { ...query, visible, purchases };
}

function getInitialCursor(): string | null {
    return null;
}
