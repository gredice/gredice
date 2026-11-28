import {
    type BlockData,
    type GardenBlockBatchPurchaseBody,
    type GardenBlockBatchPurchaseResponse,
    placeGardenBlockBatch,
} from '@gredice/client';
import { normalizeGardenBlockRotation } from '@gredice/js/gardenBlocks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import {
    type BlockExpandEditingState,
    blockPlaceBatchMutationKey,
} from '../blockOptions/blockEditingState';
import {
    BlockExpandPlanChangedError,
    blockExpandPlacementsEqual,
    resolveBlockExpandFailure,
    withBlockSunflowerPrice,
} from '../blockOptions/expand/blockExpandRequest';
import {
    type PendingBlockExpand,
    savePendingBlockExpand,
} from '../blockOptions/expand/pendingBlockExpand';
import {
    createLocalSandboxBlockId,
    persistLocalSandboxGarden,
} from '../localSandboxGarden';
import { useGameState, useGameStateStore } from '../useGameState';
import {
    applyOptimisticBatchPlacement,
    confirmOptimisticBatchPlacement,
    type OptimisticBatchPlacement,
    rollbackOptimisticBatchPlacement,
    selectBatchPlacementEffects,
} from './blockPlaceBatchOptimistic';
import { withGardenOptimisticMutationLock } from './gardenOptimisticMutationLock';
import { useBlockData } from './useBlockData';
import { updateCurrentAccountSunflowers } from './useBlockPlace';
import { currentAccountKeys } from './useCurrentAccount';
import {
    type CurrentGarden,
    currentGardenKeys,
    useCurrentGarden,
} from './useCurrentGarden';
import { tutorialChecklistKeys } from './useTutorialChecklist';

type CachedAccount = Parameters<typeof updateCurrentAccountSunflowers>[0];

/** `useBlockPlace`'s key; it prefix-matches single placements and batches. */
const blockPlaceMutationKey = blockPlaceBatchMutationKey.slice(0, 3);

type BlockPlaceBatchVariables =
    | {
          /** Potvrdi: a new plan, applied optimistically. */
          kind: 'confirm';
          command: PendingBlockExpand;
          /** Keys the stored pending command; null when unknown. */
          userId: string | null;
          /** The Expand session that was confirmed (re-planned in onMutate). */
          editing: BlockExpandEditingState;
          /** Client ids of the copies, in request order. */
          placements: OptimisticBatchPlacement[];
      }
    | {
          /** "Provjeri isti zahtjev": the stored command, sent unchanged. */
          kind: 'retry';
          command: PendingBlockExpand;
          userId: string | null;
      };

function createOptimisticBatchBlockId(
    blockName: string,
    localSandbox: boolean,
) {
    return localSandbox
        ? createLocalSandboxBlockId(blockName)
        : `optimistic-block:${blockName}:${globalThis.crypto.randomUUID()}`;
}

/** The local sandbox has no server: its "receipt" keeps the client ids. */
function createLocalSandboxReceipt(
    body: GardenBlockBatchPurchaseBody,
    placements: readonly OptimisticBatchPlacement[],
): GardenBlockBatchPurchaseResponse {
    return {
        operationId: body.operationId,
        blockName: body.blockName,
        rotation: normalizeGardenBlockRotation(body.rotation),
        unitPrice: 0,
        chargedSunflowers: 0,
        placements: placements.map((placement) => ({
            id: placement.blockId,
            position: { x: placement.position.x, y: placement.position.y },
        })),
        replayed: false,
    };
}

/**
 * Places an Expand batch: one atomic `POST /api/gardens/:gardenId/blocks/batch`
 * (spec §7.7).
 *
 * - `confirm` re-plans against the latest garden cache under the optimistic
 *   lock (a changed plan aborts without sending), adds every copy with one
 *   cache write, takes the cost from the cached balance and queues at most
 *   12 drop animations and one sunflower fly-in. The command is stored
 *   before it is sent.
 * - `retry` sends a stored command again with the same `operationId`; the
 *   server replays it if it was applied, so nothing is charged twice.
 *
 * Success swaps the ids with one cache write, clears the stored command and
 * closes the confirmed Expand. A definitive error rolls everything back and
 * clears the command (a changed price also puts the server's price in the
 * block catalogue); an uncertain one rolls back, refetches and keeps the
 * command (and the Expand locked) for "Provjeri isti zahtjev". The local
 * sandbox never calls the server.
 */
export function useBlockPlaceBatch() {
    const queryClient = useQueryClient();
    const store = useGameStateStore();
    const { data: garden } = useCurrentGarden();
    const { data: blockData } = useBlockData();
    const localSandboxStorageKey = useGameState(
        (state) => state.localSandboxStorageKey,
    );
    const winterMode = useGameState((state) => state.winterMode);
    const { track } = useGameAnalytics();
    const gardenQueryKey = currentGardenKeys(
        winterMode,
        garden?.id,
        undefined,
        localSandboxStorageKey,
    );

    const mutation = useMutation({
        mutationKey: blockPlaceBatchMutationKey,
        mutationFn: async (
            variables: BlockPlaceBatchVariables,
        ): Promise<GardenBlockBatchPurchaseResponse> => {
            const { command } = variables;
            if (localSandboxStorageKey) {
                if (variables.kind !== 'confirm') {
                    throw new Error('Local sandbox batches are never pending');
                }
                return createLocalSandboxReceipt(
                    command.body,
                    variables.placements,
                );
            }

            if (variables.userId) {
                savePendingBlockExpand(
                    variables.userId,
                    command.gardenId,
                    command,
                );
            }
            return await placeGardenBlockBatch({
                gardenId: command.gardenId,
                ...command.body,
            });
        },
        onMutate: async (variables) => {
            if (variables.kind !== 'confirm') {
                return null;
            }

            const { body, gardenId } = variables.command;
            // Loaded on use: the planner imports the 3D entity modules, and
            // this hook is part of the HUD the 2D overview bundles too. In
            // 3D the module is already loaded.
            const { planBlockExpansionForGarden } = await import(
                '../blockOptions/expand/expansionPlanInput'
            );
            return await withGardenOptimisticMutationLock(
                JSON.stringify(gardenQueryKey),
                async () => {
                    await queryClient.cancelQueries({
                        queryKey: gardenQueryKey,
                    });
                    await queryClient.cancelQueries({
                        queryKey: currentAccountKeys,
                    });
                    const currentGarden =
                        queryClient.getQueryData<CurrentGarden | null>(
                            gardenQueryKey,
                        ) ?? garden;
                    const plan =
                        currentGarden?.id === gardenId
                            ? planBlockExpansionForGarden({
                                  blockData,
                                  editing: variables.editing,
                                  garden: currentGarden,
                              })
                            : null;
                    if (
                        !currentGarden ||
                        !plan ||
                        !blockExpandPlacementsEqual(
                            plan.placements,
                            body.placements,
                        )
                    ) {
                        throw new BlockExpandPlanChangedError();
                    }

                    const { placements } = variables;
                    const sunflowerAmount =
                        body.expectedUnitPrice * placements.length;
                    const effects = selectBatchPlacementEffects(placements);
                    const animatedIds = effects.animatedIndices.flatMap(
                        (index) => placements[index]?.blockId ?? [],
                    );
                    const sunflowerEffectId =
                        sunflowerAmount > 0 &&
                        effects.sunflowerEffectIndex !== null
                            ? (placements[effects.sunflowerEffectIndex]
                                  ?.blockId ?? null)
                            : null;
                    // Queued before the copies reach the cache, so each one
                    // mounts with its animation and the fly-in waiting.
                    const state = store.getState();
                    for (const blockId of animatedIds) {
                        state.queueBlockPlacementDropAnimation(blockId);
                    }
                    if (sunflowerEffectId) {
                        state.queuePlacedBlockEffect(sunflowerEffectId, {
                            kind: 'sunflowers',
                            amount: sunflowerAmount,
                        });
                    }

                    const nextGarden = applyOptimisticBatchPlacement(
                        currentGarden,
                        {
                            blockName: body.blockName,
                            placements,
                            rotation: body.rotation,
                        },
                    );
                    queryClient.setQueryData<CurrentGarden | null>(
                        gardenQueryKey,
                        nextGarden,
                    );
                    if (localSandboxStorageKey) {
                        persistLocalSandboxGarden(
                            localSandboxStorageKey,
                            nextGarden,
                        );
                    }
                    if (sunflowerAmount > 0) {
                        queryClient.setQueryData<CachedAccount>(
                            currentAccountKeys,
                            (account) =>
                                updateCurrentAccountSunflowers(
                                    account,
                                    -sunflowerAmount,
                                ),
                        );
                    }

                    return {
                        blockIds: placements.map(
                            (placement) => placement.blockId,
                        ),
                        animatedIds,
                        sunflowerEffectId,
                        sunflowerAmount,
                    };
                },
            );
        },
        onSuccess: (data, variables, context) => {
            const state = store.getState();
            if (variables.kind === 'confirm' && context) {
                // The client verified the receipt: placements come back in
                // request order, at the requested cells.
                const pairs = variables.placements.flatMap(
                    (placement, index): [string, string][] => {
                        const saved = data.placements[index];
                        return saved ? [[placement.blockId, saved.id]] : [];
                    },
                );
                // The local sandbox has no server price to refund.
                const paidSunflowers = localSandboxStorageKey
                    ? undefined
                    : data.unitPrice;
                queryClient.setQueryData<CurrentGarden | null>(
                    gardenQueryKey,
                    (current) =>
                        current
                            ? confirmOptimisticBatchPlacement(current, pairs, {
                                  paidSunflowers,
                              })
                            : current,
                );
                const animated = new Set(context.animatedIds);
                for (const [from, to] of pairs) {
                    if (animated.has(from)) {
                        state.confirmBlockPlacementDropAnimation(from, to);
                    }
                }
                state.remapBlockEditingBlockIds(pairs);
            }
            if (!localSandboxStorageKey && variables.userId) {
                savePendingBlockExpand(
                    variables.userId,
                    variables.command.gardenId,
                    null,
                );
            }

            const editing = store.getState().blockEditing;
            if (editing?.mode === 'expand' && editing.pending) {
                store.getState().closeBlockEditing();
            }
            track('game_block_expand_completed', {
                block_name: variables.command.body.blockName,
                count: data.placements.length,
                outcome: data.replayed ? 'replayed' : 'placed',
            });
        },
        onError: (error, variables, context) => {
            const failure = resolveBlockExpandFailure(error);
            const state = store.getState();
            if (context) {
                queryClient.setQueryData<CurrentGarden | null>(
                    gardenQueryKey,
                    (current) => {
                        if (!current) {
                            return current;
                        }
                        const restored = rollbackOptimisticBatchPlacement(
                            current,
                            context.blockIds,
                        );
                        if (localSandboxStorageKey) {
                            persistLocalSandboxGarden(
                                localSandboxStorageKey,
                                restored,
                            );
                        }
                        return restored;
                    },
                );
                if (context.sunflowerAmount > 0) {
                    queryClient.setQueryData<CachedAccount>(
                        currentAccountKeys,
                        (account) =>
                            updateCurrentAccountSunflowers(
                                account,
                                context.sunflowerAmount,
                            ),
                    );
                }
                for (const blockId of context.animatedIds) {
                    state.cancelBlockPlacementDropAnimation(blockId);
                }
                if (context.sunflowerEffectId) {
                    state.consumePlacedBlockEffect(context.sunflowerEffectId);
                }
            }
            if (
                !failure.uncertain &&
                !localSandboxStorageKey &&
                variables.userId
            ) {
                savePendingBlockExpand(
                    variables.userId,
                    variables.command.gardenId,
                    null,
                );
            }

            // An uncertain request keeps the Expand locked until the same
            // request is checked again or discarded.
            const editing = store.getState().blockEditing;
            if (
                !failure.uncertain &&
                editing?.mode === 'expand' &&
                editing.pending
            ) {
                store.getState().setBlockExpandPending(false);
            }

            if (failure.refresh.garden) {
                void queryClient.invalidateQueries({
                    queryKey: gardenQueryKey,
                });
            }
            if (failure.refresh.account && !localSandboxStorageKey) {
                void queryClient.invalidateQueries({
                    queryKey: currentAccountKeys,
                });
            }
            if (failure.refresh.blockData) {
                void queryClient.invalidateQueries({ queryKey: ['blocks'] });
            }
            const serverUnitPrice = failure.unitPrice;
            if (serverUnitPrice !== null) {
                // The bar's total and the next confirm use the server's
                // price; a refetch could come from the HTTP cache.
                queryClient.setQueriesData<BlockData[] | null>(
                    { queryKey: ['blocks'] },
                    (blocks) =>
                        withBlockSunflowerPrice(
                            blocks,
                            variables.command.body.blockName,
                            serverUnitPrice,
                        ),
                );
            }
            if (!(error instanceof BlockExpandPlanChangedError)) {
                console.error('Expand batch failed', failure.outcome, error);
            }
            track('game_block_expand_completed', {
                block_name: variables.command.body.blockName,
                count: variables.command.body.placements.length,
                outcome: failure.outcome,
            });
        },
        onSettled: () => {
            if (localSandboxStorageKey) {
                return;
            }

            // As `useBlockPlace`: the last placement in flight refreshes the
            // balance, the garden and the tutorial checklist. Not awaited,
            // so the bar shows the result without waiting for the refetch.
            if (
                queryClient.isMutating({
                    mutationKey: blockPlaceMutationKey,
                }) === 1
            ) {
                void Promise.all([
                    queryClient.invalidateQueries({
                        queryKey: currentAccountKeys,
                    }),
                    queryClient.invalidateQueries({
                        queryKey: gardenQueryKey,
                    }),
                    queryClient.invalidateQueries({
                        queryKey: tutorialChecklistKeys,
                    }),
                ]);
            }
        },
    });

    return {
        isPending: mutation.isPending,
        /**
         * Sends a confirmed plan. Call `setBlockExpandPending(true)` first,
         * so the corner is locked while it is in flight.
         */
        confirm: ({
            command,
            editing,
            userId,
        }: {
            command: PendingBlockExpand;
            editing: BlockExpandEditingState;
            userId: string | null;
        }) =>
            mutation.mutateAsync({
                kind: 'confirm',
                command,
                editing,
                userId,
                placements: command.body.placements.map((placement) => ({
                    blockId: createOptimisticBatchBlockId(
                        command.body.blockName,
                        localSandboxStorageKey !== null,
                    ),
                    position: {
                        x: placement.position.x,
                        y: placement.position.y,
                    },
                })),
            }),
        /** Sends a stored command again, unchanged. */
        retry: ({
            command,
            userId,
        }: {
            command: PendingBlockExpand;
            userId: string | null;
        }) => mutation.mutateAsync({ kind: 'retry', command, userId }),
    };
}
