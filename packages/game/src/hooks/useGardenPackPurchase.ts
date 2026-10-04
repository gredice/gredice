import {
    type GardenPackCatalogueOffer,
    type GardenPackPurchaseInput,
    GardenPackPurchaseRequestError,
    type GardenPackPurchaseResponse,
    gardenPackInventoryKeys,
    purchaseGardenPack,
} from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { readStoredGardenPackCommand } from '../hud/gardenPackStorefrontProjection';
import { currentAccountKeys } from './useCurrentAccount';
import type { useCurrentUser } from './useCurrentUser';
import {
    type GardenAccountGroups,
    gardenAccountGroupsKeys,
} from './useGardenAccountGroups';
import { useGardenPackStorefrontContext } from './useGardenPackStorefrontContext';

type Session = {
    offer: GardenPackCatalogueOffer | null;
    command: GardenPackPurchaseInput | null;
    receipt: GardenPackPurchaseResponse | null;
    error: string | null;
    uncertain: boolean;
};
const storageKey = (owner: string) => `gredice:pending-pack-purchase:${owner}`;
function loadCommand(owner: string) {
    try {
        const saved = sessionStorage.getItem(storageKey(owner));
        return saved ? readStoredGardenPackCommand(JSON.parse(saved)) : null;
    } catch {
        return null;
    }
}
function saveCommand(owner: string, command: GardenPackPurchaseInput | null) {
    try {
        if (command)
            sessionStorage.setItem(storageKey(owner), JSON.stringify(command));
        else sessionStorage.removeItem(storageKey(owner));
    } catch {
        /* The mounted session still preserves the exact request. */
    }
}

export function useGardenPackPurchase() {
    const context = useGardenPackStorefrontContext();
    const owner = JSON.stringify([context.userId, context.accountId]);
    const sessions = useRef(new Map<string, Session>());
    const busy = useRef(false);
    const [, render] = useState(0);
    const changed = () => render((value) => value + 1);
    const queryClient = useQueryClient();
    if (context.eligible && !sessions.current.has(owner)) {
        const command = loadCommand(owner);
        sessions.current.set(owner, {
            offer: null,
            command,
            receipt: null,
            error: command
                ? 'Kupnja čeka potvrdu. Provjeri isti zahtjev.'
                : null,
            uncertain: Boolean(command),
        });
    }
    const session = context.eligible ? sessions.current.get(owner) : undefined;
    const mutation = useMutation({
        mutationKey: ['garden-pack-purchase'],
        retry: false,
        mutationFn: async ({
            input,
            accountId,
            userId,
        }: {
            input: GardenPackPurchaseInput;
            accountId: string | undefined;
            userId: string | undefined;
        }) => {
            const currentOwner = queryClient
                .getQueryData<GardenAccountGroups>(gardenAccountGroupsKeys)
                ?.find((group) => group.isCurrent)?.accountId;
            const currentUser = queryClient.getQueryData<
                ReturnType<typeof useCurrentUser>['data']
            >(['currentUser']);
            if (
                !context.eligible ||
                currentOwner !== accountId ||
                currentUser?.id !== userId
            )
                throw new GardenPackPurchaseRequestError(
                    'Račun se promijenio. Vrati se na račun za ovu kupnju.',
                    409,
                    null,
                    false,
                );
            return purchaseGardenPack(input);
        },
    });
    function review(offer: GardenPackCatalogueOffer) {
        if (
            !context.eligible ||
            busy.current ||
            session?.uncertain ||
            session?.receipt
        )
            return;
        sessions.current.set(owner, {
            offer: structuredClone(offer),
            command: null,
            receipt: null,
            error: null,
            uncertain: false,
        });
        changed();
    }
    async function confirm() {
        if (
            !session ||
            !context.eligible ||
            !context.accountId ||
            busy.current ||
            session.receipt ||
            (!session.command && !session.offer)
        )
            return;
        if (!session.command && session.offer)
            session.command = {
                operationId: crypto.randomUUID(),
                expectedAccountId: context.accountId,
                productId: session.offer.productId,
                quote: { ...session.offer.quote },
            };
        if (!session.command) return;
        saveCommand(owner, session.command);
        busy.current = true;
        session.error = null;
        changed();
        try {
            session.receipt = await mutation.mutateAsync({
                input: session.command,
                accountId: session.command.expectedAccountId,
                userId: context.userId,
            });
            session.uncertain = false;
            saveCommand(owner, null);
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: gardenPackInventoryKeys.all,
                }),
                queryClient.invalidateQueries({ queryKey: currentAccountKeys }),
            ]);
        } catch (error) {
            if (session.receipt) return;
            session.uncertain =
                !(error instanceof GardenPackPurchaseRequestError) ||
                error.uncertain ||
                (!error.serverDefinitive && session.uncertain);
            if (!session.uncertain) saveCommand(owner, null);
            session.error =
                error instanceof GardenPackPurchaseRequestError
                    ? error.message
                    : 'Potvrda kupnje nije stigla. Provjeri isti zahtjev.';
        } finally {
            busy.current = false;
            changed();
        }
    }
    function reset() {
        if (busy.current || session?.uncertain) return;
        saveCommand(owner, null);
        sessions.current.delete(owner);
        changed();
    }
    return {
        context,
        session,
        review,
        confirm,
        reset,
        isPending: mutation.isPending || busy.current,
    };
}
