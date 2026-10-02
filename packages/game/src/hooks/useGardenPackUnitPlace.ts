import { placeGardenPackUnit } from '@gredice/client';
import { resolveGardenPackLineVariant } from '@gredice/js/gardenPackAppearanceVariant';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameState } from '../useGameState';
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
};
const mutationKey = ['gardens', 'current', 'pack-unit-place'];
export function useGardenPackUnitPlace() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    const { data: account } = useCurrentAccount();
    const { data: user } = useCurrentUser();
    const { data: blockData } = useBlockData();
    const enabled = useGameState((state) => state.gardenPacksEnabled);
    const authenticated = useGameState(
        (state) => state.authenticatedGardenQueriesEnabled,
    );
    const isMock = useGameState((state) => state.isMock);
    const sandboxKey = useGameState((state) => state.localSandboxStorageKey);
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
                !garden ||
                !input.operationId ||
                !input.position ||
                !input.expectedExistingBlocks
            )
                throw new Error('Neispravno postavljanje predmeta iz paketa.');
            return placeGardenPackUnit({
                purchaseId: input.purchaseId,
                lineId: input.lineId,
                unitOrdinal: input.unitOrdinal,
                gardenId: garden.id,
                operationId: input.operationId,
                position: input.position,
                expectedExistingBlocks: input.expectedExistingBlocks,
                variant: input.variant,
            });
        },
        onMutate: async (input) => {
            assertEnabled();
            if (!garden) throw new Error('Vrt nije odabran.');
            // Keep the exact command on variables so network retry can reuse its durable identity.
            input.operationId ??= globalThis.crypto.randomUUID();
            const variant = resolveGardenPackLineVariant(input);
            await queryClient.cancelQueries({ queryKey });
            const current =
                queryClient.getQueryData<CurrentGarden>(queryKey) ?? garden;
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
            queueAnimation(optimisticId);
            queryClient.setQueryData<CurrentGarden>(queryKey, {
                ...current,
                stacks: placement.stacks,
            });
            return { optimisticId, queryKey };
        },
        onSuccess: (result, _input, context) => {
            if (!context) return;
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
            if (!context) return;
            cancelAnimation(context.optimisticId);
            queryClient.setQueryData<CurrentGarden>(
                context.queryKey,
                (current) =>
                    current
                        ? removeOptimisticBlockId(current, context.optimisticId)
                        : current,
            );
        },
        onSettled: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey }),
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
