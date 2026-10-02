import { placeGardenPackUnit } from '@gredice/client';
import { resolveGardenPackLineVariant } from '@gredice/js/gardenPackAppearanceVariant';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useGameState } from '../useGameState';
import { withGardenOptimisticMutationLock } from './gardenOptimisticMutationLock';
import {
    createOptimisticBlockPlacement,
    getPreferredBlockPlacementPosition,
    removeOptimisticBlockId,
    replaceOptimisticBlockId,
} from './optimisticBlockPlacement';
import { useBlockData } from './useBlockData';
import { useCurrentAccount } from './useCurrentAccount';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';
import { useCurrentUser } from './useCurrentUser';
import { tutorialChecklistKeys } from './useTutorialChecklist';

type CurrentGarden = NonNullable<ReturnType<typeof useCurrentGarden>['data']>;
export type GardenPackUnitPlaceInput = {
    purchaseId: string;
    lineId: string;
    unitOrdinal: number;
    entityId: string;
    modelName: string;
    variant: { versionId: string; appearance: Record<string, string> } | null;
    operationId?: string;
    position?: { x: number; y: number };
    expectedExistingBlocks?: string[];
    gardenId?: number;
    accountId?: string;
};
const mutationKey = ['gardens', 'current', 'pack-unit-place'];
export function useGardenPackUnitPlace() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    const { data: blockData } = useBlockData();
    const enabled = useGameState((state) => state.gardenPacksEnabled);
    const authenticated = useGameState(
        (state) => state.authenticatedGardenQueriesEnabled,
    );
    const isMock = useGameState((state) => state.isMock);
    const sandboxKey = useGameState((state) => state.localSandboxStorageKey);
    const authEnabled = enabled && authenticated && !isMock && !sandboxKey;
    const { data: user } = useCurrentUser(authEnabled);
    const { data: account } = useCurrentAccount(authEnabled && Boolean(user));
    const pendingCommands = useRef(new Map<string, GardenPackUnitPlaceInput>());
    const unitKey = (input: GardenPackUnitPlaceInput) =>
        JSON.stringify([
            input.accountId,
            input.gardenId,
            input.purchaseId,
            input.lineId,
            input.unitOrdinal,
        ]);
    const winterMode = useGameState((state) => state.winterMode);
    const camera = useGameState((state) => state.gameCamera);
    const queueAnimation = useGameState(
        (state) => state.queueBlockPlacementDropAnimation,
    );
    const confirmAnimation = useGameState(
        (state) => state.confirmBlockPlacementDropAnimation,
    );
    const cancelAnimation = useGameState(
        (state) => state.cancelBlockPlacementDropAnimation,
    );
    const queryKey = currentGardenKeys(
        winterMode,
        garden?.id,
        undefined,
        sandboxKey,
    );
    function assertEnabled() {
        if (
            !enabled ||
            !authenticated ||
            isMock ||
            sandboxKey ||
            !user ||
            !garden ||
            garden.isSandbox ||
            account?.id !== garden.accountId
        )
            throw new Error(
                'Odaberi vlastiti vrt za postavljanje predmeta iz paketa.',
            );
    }
    return useMutation({
        mutationKey,
        retry: false,
        mutationFn: async (input: GardenPackUnitPlaceInput) => {
            assertEnabled();
            if (
                !input.gardenId ||
                input.accountId !== account?.id ||
                !input.operationId ||
                !input.position ||
                !input.expectedExistingBlocks
            )
                throw new Error('Neispravno postavljanje predmeta iz paketa.');
            return placeGardenPackUnit({
                purchaseId: input.purchaseId,
                lineId: input.lineId,
                unitOrdinal: input.unitOrdinal,
                gardenId: input.gardenId,
                operationId: input.operationId,
                position: input.position,
                expectedExistingBlocks: input.expectedExistingBlocks,
                variant: input.variant,
            });
        },
        onMutate: async (input) => {
            assertEnabled();
            if (!garden) throw new Error('Vrt nije odabran.');
            input.gardenId = garden.id;
            input.accountId = garden.accountId;
            const key = unitKey(input);
            const pending = pendingCommands.current.get(key);
            if (pending) {
                Object.assign(input, pending);
                // An earlier response may have been lost after commit; replay without requiring free space again.
                return { queryKey, key, optimisticId: undefined };
            }
            return withGardenOptimisticMutationLock(
                JSON.stringify(queryKey),
                async () => {
                    input.operationId ??= globalThis.crypto.randomUUID();
                    const variant = resolveGardenPackLineVariant(input);
                    await queryClient.cancelQueries({ queryKey });
                    const current =
                        queryClient.getQueryData<CurrentGarden>(queryKey) ??
                        garden;
                    const optimisticId = `optimistic-pack:${input.operationId}`;
                    const placement = createOptimisticBlockPlacement(
                        current,
                        blockData,
                        input.modelName,
                        optimisticId,
                        {
                            preferredPosition:
                                input.position ??
                                getPreferredBlockPlacementPosition(
                                    camera?.getSnapshot(),
                                ),
                            requestedPosition: input.position,
                            variant: variant ?? undefined,
                        },
                    );
                    if (!placement)
                        throw new Error(
                            'U vrtu nema odgovarajućeg mjesta za ovaj predmet.',
                        );
                    input.position ??= {
                        x: placement.position.x,
                        y: placement.position.z,
                    };
                    input.expectedExistingBlocks ??= placement.existingBlocks;
                    pendingCommands.current.set(key, structuredClone(input));
                    queueAnimation(optimisticId);
                    queryClient.setQueryData<CurrentGarden>(queryKey, {
                        ...current,
                        stacks: placement.stacks,
                    });
                    return { optimisticId, queryKey, key };
                },
            );
        },
        onSuccess: (result, _input, context) => {
            if (!context) return;
            pendingCommands.current.delete(context.key);
            if (!context.optimisticId) return;
            confirmAnimation(context.optimisticId, result.blockId);
            queryClient.setQueryData<CurrentGarden>(
                context.queryKey,
                (current) =>
                    current
                        ? replaceOptimisticBlockId(
                              current,
                              context.optimisticId,
                              result.blockId,
                              result.variant,
                          )
                        : current,
            );
        },
        onError: (_error, _input, context) => {
            if (!context?.optimisticId) return;
            cancelAnimation(context.optimisticId);
            queryClient.setQueryData<CurrentGarden>(
                context.queryKey,
                (current) =>
                    current
                        ? removeOptimisticBlockId(current, context.optimisticId)
                        : current,
            );
        },
        onSettled: async (_result, _error, _input, context) => {
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: context?.queryKey ?? queryKey,
                }),
                queryClient.invalidateQueries({
                    queryKey: ['garden-pack-inventory'],
                }),
                queryClient.invalidateQueries({
                    queryKey: tutorialChecklistKeys,
                }),
            ]);
        },
    });
}
