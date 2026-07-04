import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    createLocalSandboxBlockId,
    persistLocalSandboxGarden,
} from '../localSandboxGarden';
import { useGameState } from '../useGameState';
import {
    createOptimisticBlockPlacement,
    getPreferredBlockPlacementPosition,
    removeOptimisticBlockId,
    replaceOptimisticBlockId,
} from './optimisticBlockPlacement';
import { useBlockData } from './useBlockData';
import {
    currentAccountKeys,
    type useCurrentAccount,
} from './useCurrentAccount';
import { currentGardenKeys, useCurrentGarden } from './useCurrentGarden';
import { tutorialChecklistKeys } from './useTutorialChecklist';

const mutationKey = ['gardens', 'current', 'blockPlace'];
const optimisticBlockIdPrefix = 'optimistic-block';

type CurrentAccountData = NonNullable<
    ReturnType<typeof useCurrentAccount>['data']
>;

type CurrentGardenData = NonNullable<
    ReturnType<typeof useCurrentGarden>['data']
>;

type BlockPlaceVariables = {
    blockName: string;
    expectedExistingBlocks?: string[];
    localBlockId?: string;
    position?: BlockPlacePosition;
};

type BlockPlacePosition = {
    x: number;
    y: number;
};

const placementQueues = new Map<string, Promise<void>>();

async function getBlockPlacementError(response: Response) {
    const responseText = await response.text();
    if (!responseText) {
        return 'Failed to place block';
    }

    try {
        const parsedResponse = JSON.parse(responseText) as {
            error?: string;
        };
        return parsedResponse.error ?? responseText;
    } catch {
        return responseText;
    }
}

function createOptimisticBlockId(blockName: string) {
    const timestamp = Date.now().toString(36);
    const randomSuffix = Math.random().toString(36).slice(2);
    return `${optimisticBlockIdPrefix}:${blockName}:${timestamp}:${randomSuffix}`;
}

function updateCurrentAccountSunflowers(
    currentAccount: CurrentAccountData | null | undefined,
    amountDelta: number,
) {
    if (!currentAccount) {
        return currentAccount;
    }

    const nextAmount = Math.max(
        0,
        currentAccount.sunflowers.amount + amountDelta,
    );
    if (nextAmount === currentAccount.sunflowers.amount) {
        return currentAccount;
    }

    return {
        ...currentAccount,
        sunflowers: {
            ...currentAccount.sunflowers,
            amount: nextAmount,
        },
    };
}

async function runQueuedPlacement<T>(
    queueKey: string,
    task: () => Promise<T>,
): Promise<T> {
    const previous = placementQueues.get(queueKey) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    const currentQueue = current.then(
        () => undefined,
        () => undefined,
    );
    placementQueues.set(queueKey, currentQueue);

    try {
        return await current;
    } finally {
        if (placementQueues.get(queueKey) === currentQueue) {
            placementQueues.delete(queueKey);
        }
    }
}

export function useBlockPlace() {
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    const { data: blockData } = useBlockData();
    const gameCamera = useGameState((state) => state.gameCamera);
    const localSandboxStorageKey = useGameState(
        (state) => state.localSandboxStorageKey,
    );
    const winterMode = useGameState((state) => state.winterMode);
    const queuePlacedBlockEffect = useGameState(
        (state) => state.queuePlacedBlockEffect,
    );
    const queueBlockPlacementDropAnimation = useGameState(
        (state) => state.queueBlockPlacementDropAnimation,
    );
    const gardenQueryKey = currentGardenKeys(
        winterMode,
        garden?.id,
        undefined,
        localSandboxStorageKey,
    );

    return useMutation({
        mutationKey,
        mutationFn: async (variables: BlockPlaceVariables) => {
            if (!garden) {
                throw new Error('No garden selected');
            }

            if (localSandboxStorageKey) {
                return {
                    id:
                        variables.localBlockId ??
                        createLocalSandboxBlockId(variables.blockName),
                };
            }

            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ].blocks.$post({
                param: {
                    gardenId: garden.id.toString(),
                },
                json: {
                    blockName: variables.blockName,
                    ...(variables.expectedExistingBlocks
                        ? {
                              expectedExistingBlocks:
                                  variables.expectedExistingBlocks,
                          }
                        : {}),
                    ...(variables.position
                        ? { position: variables.position }
                        : {}),
                },
            });
            if (!response.ok) {
                throw new Error(await getBlockPlacementError(response));
            }

            return await response.json();
        },
        onMutate: async (variables) => {
            if (!garden) {
                return;
            }

            return await runQueuedPlacement(
                JSON.stringify(gardenQueryKey),
                async () => {
                    await queryClient.cancelQueries({
                        queryKey: gardenQueryKey,
                    });
                    await queryClient.cancelQueries({
                        queryKey: currentAccountKeys,
                    });
                    const currentGarden =
                        queryClient.getQueryData<CurrentGardenData>(
                            gardenQueryKey,
                        ) ?? garden;
                    const optimisticBlockId = localSandboxStorageKey
                        ? createLocalSandboxBlockId(variables.blockName)
                        : createOptimisticBlockId(variables.blockName);
                    variables.localBlockId = localSandboxStorageKey
                        ? optimisticBlockId
                        : undefined;
                    const optimisticPlacement = createOptimisticBlockPlacement(
                        currentGarden,
                        blockData,
                        variables.blockName,
                        optimisticBlockId,
                        {
                            preferredPosition:
                                variables.position ??
                                getPreferredBlockPlacementPosition(
                                    gameCamera?.getSnapshot(),
                                ),
                            requestedPosition: variables.position,
                        },
                    );
                    if (!optimisticPlacement) {
                        return;
                    }

                    variables.position = {
                        x: optimisticPlacement.position.x,
                        y: optimisticPlacement.position.z,
                    };
                    variables.expectedExistingBlocks =
                        optimisticPlacement.existingBlocks;
                    const nextGarden = {
                        ...currentGarden,
                        stacks: optimisticPlacement.stacks,
                    };
                    queueBlockPlacementDropAnimation(optimisticBlockId);
                    queryClient.setQueryData<CurrentGardenData>(
                        gardenQueryKey,
                        nextGarden,
                    );
                    if (localSandboxStorageKey) {
                        persistLocalSandboxGarden(
                            localSandboxStorageKey,
                            nextGarden,
                        );
                    }

                    const placedBlockData = blockData?.find(
                        (block) =>
                            block.information.name === variables.blockName,
                    );
                    // Sandbox gardens build for free — no sunflowers are spent.
                    const amount = garden.isSandbox
                        ? 0
                        : (placedBlockData?.prices.sunflowers ?? 0);
                    if (amount > 0) {
                        queuePlacedBlockEffect(optimisticBlockId, {
                            kind: 'sunflowers',
                            amount,
                        });
                        queryClient.setQueryData<CurrentAccountData | null>(
                            currentAccountKeys,
                            (currentAccount) =>
                                updateCurrentAccountSunflowers(
                                    currentAccount,
                                    -amount,
                                ),
                        );
                    }

                    return {
                        optimisticBlockId,
                        sunflowerAmount: amount,
                    };
                },
            );
        },
        onSuccess: (data, _variables, context) => {
            if (!context?.optimisticBlockId) {
                return;
            }

            queryClient.setQueryData<CurrentGardenData | null>(
                gardenQueryKey,
                (currentGarden) =>
                    currentGarden
                        ? replaceOptimisticBlockId(
                              currentGarden,
                              context.optimisticBlockId,
                              data.id,
                          )
                        : currentGarden,
            );
        },
        onError: (error, _variables, context) => {
            console.error('Error creating block', error);
            if (context?.optimisticBlockId) {
                queryClient.setQueryData<CurrentGardenData | null>(
                    gardenQueryKey,
                    (currentGarden) =>
                        currentGarden
                            ? removeOptimisticBlockId(
                                  currentGarden,
                                  context.optimisticBlockId,
                              )
                            : currentGarden,
                );
            }
            if (context?.sunflowerAmount) {
                queryClient.setQueryData<CurrentAccountData | null>(
                    currentAccountKeys,
                    (currentAccount) =>
                        updateCurrentAccountSunflowers(
                            currentAccount,
                            context.sunflowerAmount,
                        ),
                );
            }
        },
        onSettled: async () => {
            if (localSandboxStorageKey) {
                return;
            }

            if (queryClient.isMutating({ mutationKey }) === 1) {
                await queryClient.invalidateQueries({
                    queryKey: currentAccountKeys,
                });
                await queryClient.invalidateQueries({
                    queryKey: gardenQueryKey,
                });
                await queryClient.invalidateQueries({
                    queryKey: tutorialChecklistKeys,
                });
            }
        },
    });
}
