import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useShoppingCart } from '../../hooks/useShoppingCart';
import { RaisedBedPlantField } from './RaisedBedPlantField';

export function RiasedBedFields({ blockId }: { blockId: string }) {
    const { data: currentGarden } = useCurrentGarden();
    const { data: cart } = useShoppingCart();
    const raisedBed = currentGarden?.raisedBeds?.find(
        (rb) => rb.blockId === blockId,
    );

    const cartItems = cart?.items.filter(
        (item) =>
            item.gardenId === currentGarden?.id &&
            item.raisedBedId === raisedBed?.id &&
            item.entityTypeName === 'plantSort',
    );

    const displayedFields = [
        ...(raisedBed?.fields?.filter((f) => f.active) || []),
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
                return <RaisedBedPlantField key={field.id} field={field} />;
            })}
        </>
    );
}
