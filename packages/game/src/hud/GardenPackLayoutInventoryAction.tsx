import type { BlockData } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { currentAccountKeys } from '../hooks/useCurrentAccount';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import {
    type GardenAccountGroups,
    gardenAccountGroupsKeys,
} from '../hooks/useGardenAccountGroups';
import { useOwnedPackLayouts } from '../hooks/useOwnedPackLayouts';
import { packLayoutGardenSignature } from '../packLayouts/packLayoutPreviewState';
import { useGameState } from '../useGameState';
import {
    getOwnedPackLineBlock,
    type OwnedGardenPack,
} from './ownedGardenPackInventory';

export function GardenPackLayoutInventoryAction({
    pack,
    blockData,
    onPreview,
}: {
    pack: OwnedGardenPack;
    blockData: BlockData[] | null | undefined;
    onPreview: () => void;
}) {
    const layouts = useOwnedPackLayouts(pack.purchaseId);
    const { data: garden } = useCurrentGarden();
    const client = useQueryClient();
    const source = useRef({ garden, context: layouts.context });
    source.current = { garden, context: layouts.context };
    const locked = useGameState((state) => state.packLayoutPreviewLocked);
    const camera = useGameState((state) => state.gameCamera);
    const setReady = useGameState((state) => state.setPackLayoutPreviewReady);
    const select = useGameState((state) => state.setPackLayoutPreview);
    const setLocked = useGameState((state) => state.setPackLayoutPreviewLocked);
    const [error, setError] = useState<string | null>(null);
    const available = pack.lines.every((line) =>
        getOwnedPackLineBlock(line, blockData),
    );
    return (
        <div className="space-y-2 pt-3">
            <Button
                size="sm"
                disabled={
                    !layouts.context.eligible ||
                    !available ||
                    layouts.isFetching
                }
                onClick={async () => {
                    setError(null);
                    if (locked) {
                        onPreview();
                        return;
                    }
                    const accountId = layouts.context.accountId;
                    const userId = layouts.context.userId;
                    if (!garden || !accountId || !userId) return;
                    const response = await layouts.refetch();
                    const layout = response.data?.layouts[0];
                    const currentAccount = client.getQueryData<{ id: string }>(
                        currentAccountKeys,
                    )?.id;
                    const group = client
                        .getQueryData<GardenAccountGroups>(
                            gardenAccountGroupsKeys,
                        )
                        ?.find((item) => item.isCurrent);
                    if (
                        source.current.garden?.id !== garden.id ||
                        source.current.context.userId !== userId ||
                        client.getQueryData<{ id: string }>(['currentUser'])
                            ?.id !== userId ||
                        !source.current.context.eligible ||
                        currentAccount !== accountId ||
                        group?.accountId !== accountId ||
                        !group.gardens.some((item) => item.id === garden.id)
                    )
                        return;
                    if (!layout || response.isError) {
                        setError(
                            'Raspored trenutačno nije dostupan. Predmeti ostaju u paketu.',
                        );
                        return;
                    }
                    setLocked(false);
                    setReady(false);
                    select({
                        key: crypto.randomUUID(),
                        userId,
                        accountId,
                        gardenId: garden.id,
                        pack,
                        layoutId: layout.id,
                        anchor: {
                            x: Math.round(camera?.getSnapshot().target[0] ?? 0),
                            y: Math.round(camera?.getSnapshot().target[2] ?? 0),
                        },
                        rotation: 0,
                        gardenSignature: packLayoutGardenSignature(
                            source.current.garden ?? garden,
                        ),
                    });
                    onPreview();
                }}
            >
                {layouts.isFetching
                    ? 'Učitavanje rasporeda…'
                    : 'Postavi kao na slici'}
            </Button>
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}
