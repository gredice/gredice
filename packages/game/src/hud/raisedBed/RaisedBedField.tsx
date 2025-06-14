import { cx } from "@signalco/ui-primitives/cx";
import { PlantPicker } from "./RaisedBedPlantPicker";
import { PlantingSeed } from "../../icons/PlantingSeed";
import { useCurrentGarden } from "../../hooks/useCurrentGarden";
import { useShoppingCart } from "../../hooks/useShoppingCart";
import { DotIndicator } from "@signalco/ui-primitives/DotIndicator";
import { ShoppingCart, Warning } from "@signalco/ui-icons";
import { usePlantSort } from "../../hooks/usePlantSorts";
import { Spinner } from "@signalco/ui-primitives/Spinner";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Chip } from "@signalco/ui-primitives/Chip";

type RaisedBedFieldItemButtonProps =
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
        isLoading?: boolean;
    };

function RaisedBedFieldItemButton({ isLoading, children, className, ...rest }: RaisedBedFieldItemButtonProps) {
    return (
        <button
            type="button"
            className={cx(
                'relative',
                "bg-gradient-to-br from-lime-100/90 to-lime-100/80 size-full flex items-center justify-center rounded-sm",
                "hover:bg-white cursor-pointer",
                "transition-colors",
                className
            )} {...rest}>
            {isLoading && (
                <div className="absolute right-1 top-1">
                    <Spinner loadingLabel={"Učitavanje..."} />
                </div>
            )}
            {children}
        </button>
    );
}

function RaisedBedFieldItemEmpty({ gardenId, raisedBedId, positionIndex }: { raisedBedId: number; gardenId: number; positionIndex: number }) {
    const { data: cart, isPending: isCartPending } = useShoppingCart();
    const { data: garden, isPending: isGardenPending } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    if (!raisedBed) {
        return null;
    }

    const cartItems = cart?.items.filter(item =>
        item.raisedBedId === raisedBedId &&
        item.positionIndex === positionIndex);
    const cartPlantItem = cartItems?.find(item => item.entityTypeName === 'plantSort' && item.status === 'new');
    const cartPlantSortId = cartPlantItem ? Number(cartPlantItem.entityId) : null;
    const { data: cartPlantSort, isPending: isCartPlantSortPending } = usePlantSort(cartPlantSortId);
    const cartPlantId = cartPlantSort?.information.plant.id;
    const additionalDataRaw = cartPlantItem?.additionalData ? JSON.parse(cartPlantItem.additionalData) : null;
    const cartPlantOptions = {
        scheduledDate: additionalDataRaw?.scheduledDate ? new Date(additionalDataRaw.scheduledDate) : null,
    };

    const isLoading = isCartPending || isGardenPending || (Boolean(cartPlantSortId) && isCartPlantSortPending);
    if (isLoading) {
        return (
            <RaisedBedFieldItemButton isLoading={true} />
        );
    }

    return (
        <PlantPicker
            trigger={(
                <RaisedBedFieldItemButton isLoading={isLoading}>
                    {(isLoading || !cartPlantItem) && <PlantingSeed className="size-10 stroke-green-800" />}
                    {(!isLoading && cartPlantItem) && (
                        <>
                            <img
                                src={`https://www.gredice.com/${cartPlantItem.shopData.image}`}
                                alt={cartPlantItem.shopData.name}
                                width={60}
                                height={60}
                            />
                            <div className="absolute right-1 top-1">
                                <DotIndicator
                                    size={30}
                                    color={"success"}
                                    content={
                                        <ShoppingCart className="size-6 stroke-white" />
                                    }
                                />
                            </div>
                        </>
                    )}
                </RaisedBedFieldItemButton>
            )}
            gardenId={gardenId}
            raisedBedId={raisedBedId}
            positionIndex={positionIndex}
            inShoppingCart={Boolean(cartPlantItem)}
            selectedPlantId={cartPlantId}
            selectedSortId={cartPlantSortId}
            selectedPlantOptions={cartPlantOptions}
        />
    );
}

function RaisedBedFieldItemPlanted({ raisedBedId, positionIndex }: { raisedBedId: number; positionIndex: number; }) {
    const { data: garden, isPending: isGardenPending } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    if (!raisedBed) {
        return null;
    }

    const field = raisedBed.fields.find(field => field.positionIndex === positionIndex);
    if (!field || !field.plantSortId) {
        return null;
    }

    const plantSortId = field.plantSortId;
    const { data: plantSort, isPending: isPlantSortPending } = usePlantSort(plantSortId);

    const isLoading = isGardenPending || (Boolean(plantSortId) && isPlantSortPending);
    if (isLoading) {
        return (
            <RaisedBedFieldItemButton isLoading={true} />
        );
    }

    if (!plantSort) {
        return (
            <RaisedBedFieldItemButton>
                <Warning className="size-10" />
            </RaisedBedFieldItemButton>
        );
    }

    let localizedStatus = field.plantStatus;
    switch (localizedStatus) {
        case 'new':
            localizedStatus = 'Nova - čeka na odobrenje';
            break;
        case 'approved':
            localizedStatus = 'Odobrena - čeka na sadnju';
            break;
        case 'planted':
            localizedStatus = 'Zasađena';
            break;
        case 'harvested':
            localizedStatus = 'Ubrana';
            break;
        case 'died':
            localizedStatus = 'Uginula';
            break;
        case 'uprooted':
            localizedStatus = 'Uklonjena';
            break;
        default:
            localizedStatus = 'Nepoznato';
            break;
    }

    return (
        <Modal
            title={`Biljka "${plantSort.information.name}"`}
            trigger={(
                <RaisedBedFieldItemButton>
                    {/* TODO: Extract into a separate component */}
                    <img
                        src={`https://www.gredice.com/${plantSort.image?.cover?.url || plantSort.information.plant.image?.cover?.url}`}
                        alt={plantSort.information.name}
                        width={60}
                        height={60} />
                </RaisedBedFieldItemButton>
            )}>
            <Stack spacing={4}>
                <Row spacing={2}>
                    <img
                        src={`https://www.gredice.com/${plantSort.image?.cover?.url || plantSort.information.plant.image?.cover?.url}`}
                        alt={plantSort.information.name}
                        width={60}
                        height={60}
                    />
                    <Typography level="h3">{plantSort.information.name}</Typography>
                </Row>
                <Row spacing={1}>
                    <Typography level="body2">Status</Typography>
                    <Chip>{localizedStatus}</Chip>
                </Row>
            </Stack>
        </Modal>
    );

}

function RaisedBedFieldItem({ gardenId, raisedBedId, positionIndex }: { raisedBedId: number; gardenId: number; positionIndex: number }) {
    const { data: garden, isPending: isGardenPending } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    if (!raisedBed) {
        return null;
    }

    const field = raisedBed.fields.find(field => field.positionIndex === positionIndex);
    const hasField = Boolean(field);

    if (isGardenPending) {
        return (
            <RaisedBedFieldItemButton isLoading={true} />
        );
    }

    if (!hasField) {
        return (
            <RaisedBedFieldItemEmpty
                gardenId={gardenId}
                raisedBedId={raisedBedId}
                positionIndex={positionIndex}
            />
        );
    }

    return (
        <RaisedBedFieldItemPlanted
            raisedBedId={raisedBedId}
            positionIndex={positionIndex}
        />
    )
}

export function RaisedBedField({
    gardenId,
    raisedBedId
}: {
    gardenId: number;
    raisedBedId: number;
}) {
    return (
        <div className="size-full grid grid-rows-3">
            {[...Array(3)].map((_, rowIndex) => (
                <div key={`${rowIndex}`} className="size-full grid grid-cols-3">
                    {[...Array(3)].map((_, colIndex) => (
                        <div key={`${rowIndex}-${colIndex}`} className="size-full p-0.5">
                            <RaisedBedFieldItem
                                gardenId={gardenId}
                                raisedBedId={raisedBedId}
                                positionIndex={(2 - rowIndex) * 3 + (2 - colIndex)}
                            />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
