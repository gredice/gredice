import type { BlockData } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import type { useBlockData } from '../hooks/useBlockData';
import type { useGardenPackInventory } from '../hooks/useGardenPackInventory';
import { GardenPackInventoryPurchase } from './GardenPackInventoryPurchase';
import type { GardenPackInventoryPlacement } from './ownedGardenPackInventory';

export function GardenPackInventory({
    inventory,
    blockData,
    catalogue,
    placement,
    onPlaced,
    previewLayouts = false,
}: {
    inventory: ReturnType<typeof useGardenPackInventory>;
    blockData: BlockData[] | null | undefined;
    catalogue?: Pick<
        ReturnType<typeof useBlockData>,
        'isPending' | 'isError' | 'isFetching' | 'refetch'
    >;
    placement?: GardenPackInventoryPlacement;
    onPlaced: () => void;
    previewLayouts?: boolean;
}) {
    if (!inventory.visible) return null;
    return (
        <div
            className="min-w-0 space-y-3"
            aria-busy={inventory.isFetching || catalogue?.isFetching}
        >
            {catalogue?.isPending && <p role="status">Učitavanje predmeta…</p>}
            {catalogue?.isError && (
                <div role="alert" className="space-y-2">
                    <p>
                        Predmete trenutačno nije moguće učitati. Pokušaj
                        ponovno.
                    </p>
                    <Button
                        size="sm"
                        disabled={catalogue.isFetching}
                        onClick={() => {
                            void catalogue.refetch();
                        }}
                    >
                        Osvježi predmete
                    </Button>
                </div>
            )}
            {inventory.isPending && (
                <p role="status">Učitavanje kupljenih paketa…</p>
            )}
            {inventory.isError && (
                <div role="alert" className="space-y-2">
                    <p>
                        Pakete trenutačno nije moguće učitati. Pokušaj ponovno.
                    </p>
                    <Button
                        size="sm"
                        disabled={inventory.isFetching}
                        onClick={() => {
                            void inventory.refetch();
                        }}
                    >
                        Pokušaj ponovno
                    </Button>
                </div>
            )}
            {!inventory.isPending &&
                !inventory.isError &&
                inventory.purchases.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        Još nema kupljenih paketa.
                    </p>
                )}
            {inventory.purchases.map((pack) => (
                <GardenPackInventoryPurchase
                    key={pack.purchaseId}
                    pack={pack}
                    blockData={blockData}
                    catalogueUnavailable={
                        catalogue?.isPending || catalogue?.isError
                    }
                    placement={placement}
                    onPlaced={onPlaced}
                    previewLayouts={previewLayouts}
                />
            ))}
            {inventory.purchases.length > 0 && (
                <Button
                    size="sm"
                    variant="plain"
                    disabled={inventory.isFetching}
                    onClick={() => {
                        void inventory.refetch();
                    }}
                >
                    Osvježi pakete
                </Button>
            )}
            {inventory.hasNextPage && (
                <Button
                    size="sm"
                    disabled={inventory.isFetching}
                    onClick={() => {
                        void inventory.fetchNextPage();
                    }}
                >
                    {inventory.isFetchingNextPage
                        ? 'Učitavanje…'
                        : 'Učitaj još paketa'}
                </Button>
            )}
        </div>
    );
}
