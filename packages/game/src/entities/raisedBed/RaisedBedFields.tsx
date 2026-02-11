import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useShoppingCart } from '../../hooks/useShoppingCart';
import {
    findRaisedBedByBlockId,
    getRaisedBedBlockIds,
} from '../../utils/raisedBedBlocks';
import { RaisedBedPlantField } from './RaisedBedPlantField';

export function RiasedBedFields({ blockId }: { blockId: string }) {
    const { data: currentGarden } = useCurrentGarden();
    const { data: cart } = useShoppingCart();
    const raisedBed = findRaisedBedByBlockId(currentGarden, blockId);
    const orientation = raisedBed?.orientation ?? 'vertical';

    const blockIds =
        raisedBed && currentGarden
            ? getRaisedBedBlockIds(currentGarden, raisedBed.id)
            : [];
    const blockOffset = Math.max(blockIds.indexOf(blockId), 0) * 9;

    const cartItems = cart?.items.filter(
        (item) =>
            item.gardenId === currentGarden?.id &&
            item.raisedBedId === raisedBed?.id &&
            item.entityTypeName === 'plantSort' &&
            typeof item.positionIndex === 'number' &&
            item.positionIndex >= blockOffset &&
            item.positionIndex < blockOffset + 9,
    );

    const displayedFields = [
        ...(raisedBed?.fields?.filter(
            (field) =>
                field.active &&
                field.positionIndex >= blockOffset &&
                field.positionIndex < blockOffset + 9,
        ) || []),
        ...(cartItems?.map((item) => {
            if (item.positionIndex === null) return null;
            const field = {
                id: `cart-item-${item.id}`,
                positionIndex: item.positionIndex,
                plantSortId: Number(item.entityId),
            };
            return field;
        }) || []),
    ];

    return (
        <>
            {displayedFields.map((field) => {
                if (!field) return null;
                return (
                    <RaisedBedPlantField
                        key={field.id}
                        field={{
                            ...field,
                            positionIndex: field.positionIndex - blockOffset,
                        }}
                        orientation={orientation}
                    />
                );
            })}
        </>
    );
}
