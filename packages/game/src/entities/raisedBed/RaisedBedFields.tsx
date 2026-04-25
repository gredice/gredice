import { useGameSceneDetails } from '../../GameSceneDetailContext';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useShoppingCart } from '../../hooks/useShoppingCart';
import {
    findRaisedBedByBlockId,
    getRaisedBedBlockIds,
} from '../../utils/raisedBedBlocks';
import { isRaisedBedFieldOccupied } from '../../utils/raisedBedFields';
import { RaisedBedPlantField } from './RaisedBedPlantField';

export function RiasedBedFields({ blockId }: { blockId: string }) {
    const { renderDetails } = useGameSceneDetails();
    const { data: currentGarden } = useCurrentGarden();
    const { data: cart } = useShoppingCart(renderDetails);
    const raisedBed = findRaisedBedByBlockId(currentGarden, blockId);
    const orientation = raisedBed?.orientation ?? 'vertical';

    const blockIds =
        raisedBed && currentGarden
            ? getRaisedBedBlockIds(currentGarden, raisedBed.id)
            : [];

    // Bottom-right most block (last in position-sorted list) is offset 0;
    // other blocks get increasing offsets based on distance from bottom-right
    const blockIndex = blockIds.indexOf(blockId);
    const blockOffset = Math.max(blockIds.length - 1 - blockIndex, 0) * 9;

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
                isRaisedBedFieldOccupied(field) &&
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

    if (!renderDetails) {
        return null;
    }

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
                        blockIndex={blockIndex}
                        orientation={orientation}
                    />
                );
            })}
        </>
    );
}
