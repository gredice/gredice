import {
    GardenPackGroupPlacementRequestError,
    type GardenPackGroupPlacementResponse,
    gardenPackInventoryKeys,
    placeGardenPackLayout,
} from '@gredice/client';
import {
    getGardenPackLayoutCells,
    resolveGardenPackLayoutPlacements,
} from '@gredice/js/gardenPackLayouts';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { packLayoutGardenSignature } from '../packLayouts/packLayoutPreviewState';
import {
    type OfferedPackLayout,
    resolveOwnedPackLayout,
} from '../packLayouts/packLayoutProjection';
import {
    type PendingPackLayout,
    readPendingPackLayout,
    savePendingPackLayout,
} from '../packLayouts/pendingPackLayout';
import { useGameState, useGameStateStore } from '../useGameState';
import { currentAccountKeys } from './useCurrentAccount';
import {
    type CurrentGarden,
    currentGardenKeys,
    useCurrentGarden,
} from './useCurrentGarden';
import {
    type GardenAccountGroups,
    gardenAccountGroupsKeys,
} from './useGardenAccountGroups';
import { useGardenPackStorefrontContext } from './useGardenPackStorefrontContext';

export function useGardenPackLayoutPlacement() {
    const context = useGardenPackStorefrontContext();
    const { data: garden } = useCurrentGarden();
    const store = useGameStateStore();
    const selection = useGameState((state) => state.packLayoutPreview);
    const winterMode = useGameState((state) => state.winterMode);
    const client = useQueryClient();
    const latestSource = useRef({ context, garden });
    latestSource.current = { context, garden };
    const owner = JSON.stringify([
        context.userId,
        context.accountId,
        garden?.id,
    ]);
    const sessions = useRef(
        new Map<
            string,
            {
                command: PendingPackLayout | null;
                error: string | null;
                receipt: GardenPackGroupPlacementResponse | null;
                pending: boolean;
            }
        >(),
    );
    const [, render] = useState(0);
    const changed = () => render((value) => value + 1);
    if (
        context.eligible &&
        context.userId &&
        context.accountId &&
        garden &&
        !sessions.current.has(owner)
    ) {
        const command = readPendingPackLayout(
            context.userId,
            context.accountId,
            garden.id,
        );
        sessions.current.set(owner, {
            command,
            error: command
                ? 'Postavljanje čeka potvrdu. Provjeri isti zahtjev.'
                : null,
            receipt: null,
            pending: false,
        });
    }
    const session = context.eligible ? sessions.current.get(owner) : undefined;
    useEffect(() => {
        if (
            selection &&
            (!context.eligible ||
                selection.userId !== context.userId ||
                selection.accountId !== context.accountId ||
                selection.gardenId !== garden?.id)
        ) {
            store.getState().setPackLayoutPreview(null);
            store.getState().setPackLayoutPreviewLocked(false);
        }
    }, [
        context.eligible,
        context.userId,
        context.accountId,
        garden?.id,
        selection,
        store,
    ]);
    useEffect(() => {
        store
            .getState()
            .setPackLayoutPreviewLocked(
                Boolean(session?.command || session?.pending),
            );
    }, [session?.command, session?.pending, store]);
    function authority(userId: string, accountId: string, gardenId: number) {
        const group = client
            .getQueryData<GardenAccountGroups>(gardenAccountGroupsKeys)
            ?.find((item) => item.isCurrent);
        const account = client.getQueryData<{ id: string }>(currentAccountKeys);
        const user = client.getQueryData<{ id: string }>(['currentUser']);
        return (
            latestSource.current.context.eligible &&
            user?.id === userId &&
            account?.id === accountId &&
            group?.accountId === accountId &&
            group.gardens.some((item) => item.id === gardenId) &&
            latestSource.current.garden?.id === gardenId
        );
    }
    async function confirm(
        layout: OfferedPackLayout | undefined,
        blockData: Parameters<typeof resolveOwnedPackLayout>[0]['blockData'],
    ) {
        if (
            !session ||
            session.pending ||
            !garden ||
            !context.userId ||
            !context.accountId ||
            !authority(context.userId, context.accountId, garden.id)
        )
            return;
        if (!session.command) {
            const currentGarden = client.getQueryData<CurrentGarden>(
                currentGardenKeys(winterMode, garden.id),
            );
            if (!currentGarden || currentGarden.id !== garden.id) return;
            if (
                !selection ||
                !layout ||
                selection.gardenId !== garden.id ||
                selection.accountId !== context.accountId ||
                selection.userId !== context.userId ||
                selection.layoutId !== layout.id ||
                selection.gardenSignature !==
                    packLayoutGardenSignature(currentGarden)
            )
                return;
            const preview = resolveOwnedPackLayout({
                layout,
                pack: selection.pack,
                blockData,
                garden: currentGarden,
                anchor: selection.anchor,
                rotation: selection.rotation,
            });
            if (
                !preview.valid ||
                !store.getState().packLayoutPreviewReady ||
                !store.getState().packLayoutPreviewFramed
            )
                return;
            const cells = getGardenPackLayoutCells(
                resolveGardenPackLayoutPlacements(
                    layout,
                    selection.anchor,
                    selection.rotation,
                ),
            );
            session.command = {
                purchaseId: selection.pack.purchaseId,
                layoutId: layout.id,
                body: {
                    operationId: crypto.randomUUID(),
                    expectedAccountId: context.accountId,
                    gardenId: garden.id,
                    layoutVersionId: layout.versionId,
                    anchor: { ...selection.anchor },
                    rotation: selection.rotation,
                    units: preview.units,
                    expectedStacks: cells.map((cell) => ({
                        ...cell,
                        blocks:
                            currentGarden.stacks
                                .find(
                                    (stack) =>
                                        stack.position.x === cell.positionX &&
                                        stack.position.z === cell.positionY,
                                )
                                ?.blocks.map((block) => block.id) ?? [],
                    })),
                },
            };
        }
        const command = session.command;
        const userId = context.userId;
        const accountId = context.accountId;
        const gardenId = command.body.gardenId;
        savePendingPackLayout(userId, accountId, gardenId, command);
        session.pending = true;
        session.error = null;
        store.getState().setPackLayoutPreviewLocked(true);
        changed();
        try {
            if (!authority(userId, accountId, gardenId))
                throw new Error('Račun ili vrt se promijenio.');
            session.receipt = await placeGardenPackLayout({
                purchaseId: command.purchaseId,
                layoutId: command.layoutId,
                ...command.body,
            });
            session.command = null;
            savePendingPackLayout(userId, accountId, gardenId, null);
            if (store.getState().packLayoutPreview?.key === selection?.key)
                store.getState().setPackLayoutPreview(null);
            await Promise.all([
                client.invalidateQueries({
                    queryKey: currentGardenKeys(winterMode, gardenId),
                    refetchType: authority(userId, accountId, gardenId)
                        ? 'active'
                        : 'none',
                }),
                client.invalidateQueries({
                    queryKey: gardenPackInventoryKeys.all,
                    refetchType: authority(userId, accountId, gardenId)
                        ? 'active'
                        : 'none',
                }),
                client.invalidateQueries({
                    queryKey: ['garden-pack-layouts'],
                    refetchType: 'none',
                }),
            ]);
        } catch (error) {
            const definitive =
                error instanceof GardenPackGroupPlacementRequestError &&
                !error.uncertain;
            if (definitive) {
                session.command = null;
                savePendingPackLayout(userId, accountId, gardenId, null);
                if (
                    authority(userId, accountId, gardenId) &&
                    store.getState().packLayoutPreview?.key === selection?.key
                )
                    store.getState().setPackLayoutPreview(null);
            }
            session.error = definitive
                ? 'Raspored nije postavljen. Osvježi vrt i paket pa pokušaj ponovno.'
                : 'Potvrda nije stigla. Provjeri isti zahtjev; novi predmeti se neće naplatiti.';
            if (definitive)
                await Promise.all([
                    client.invalidateQueries({
                        queryKey: currentGardenKeys(winterMode, gardenId),
                        refetchType: authority(userId, accountId, gardenId)
                            ? 'active'
                            : 'none',
                    }),
                    client.invalidateQueries({
                        queryKey: gardenPackInventoryKeys.all,
                        refetchType: authority(userId, accountId, gardenId)
                            ? 'active'
                            : 'none',
                    }),
                    client.invalidateQueries({
                        queryKey: ['garden-pack-layouts'],
                        refetchType: 'none',
                    }),
                ]);
        } finally {
            session.pending = false;
            if (authority(userId, accountId, gardenId))
                store
                    .getState()
                    .setPackLayoutPreviewLocked(Boolean(session.command));
            changed();
        }
    }
    return {
        context,
        session,
        confirm,
        dismiss: () => {
            if (session && !session.command && !session.pending) {
                session.receipt = null;
                session.error = null;
                changed();
            }
        },
    };
}
