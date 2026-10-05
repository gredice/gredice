import { useQueryClient } from '@tanstack/react-query';
import { useCurrentGarden } from '../../../packages/game/src/hooks/useCurrentGarden';
import { useGardenPackUnitPlace } from '../../../packages/game/src/hooks/useGardenPackUnitPlace';
import { InventoryHud } from '../../../packages/game/src/hud/InventoryHud';
import { createOwnedGardenPackFixture } from '../../../packages/game/tests/ownedGardenPackFixture';

export function GardenPackPlacementFixture() {
    const placement = useGardenPackUnitPlace();
    const queryClient = useQueryClient();
    const { data: garden } = useCurrentGarden();
    return (
        <>
            <InventoryHud
                packPlacement={{
                    place: placement.mutateAsync,
                    isPending: placement.isPending,
                    error: placement.error,
                }}
            />
            <button
                type="button"
                onClick={() =>
                    queryClient.setQueryData(['accounts', 'current'], {
                        id: 'other-account',
                        sunflowers: { amount: 987 },
                    })
                }
            >
                Switch fixture account
            </button>
            <button
                type="button"
                onClick={() => {
                    const pack = createOwnedGardenPackFixture();
                    const line = pack.lines[0];
                    if (line)
                        placement.mutate({
                            purchaseId: pack.purchaseId,
                            lineId: line.lineId,
                            unitOrdinal: 2,
                            entityId: line.entityId,
                            modelName: line.modelName,
                            variant: line.variant,
                        });
                }}
            >
                Try fixture prepaid placement
            </button>
            <output data-testid="pack-placement-error">
                {placement.error?.message}
            </output>
            <output data-testid="pack-placement-state">
                {JSON.stringify({
                    stacks: garden?.stacks,
                    account: queryClient.getQueryData(['accounts', 'current']),
                })}
            </output>
        </>
    );
}
