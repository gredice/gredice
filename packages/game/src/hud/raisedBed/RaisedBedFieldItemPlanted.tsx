import { useCurrentGarden } from "../../hooks/useCurrentGarden";
import { Warning } from "@signalco/ui-icons";
import { usePlantSort } from "../../hooks/usePlantSorts";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Chip } from "@signalco/ui-primitives/Chip";
import { RaisedBedFieldItemButton } from "./RaisedBedFieldItemButton";

export function RaisedBedFieldItemPlanted({ raisedBedId, positionIndex }: { raisedBedId: number; positionIndex: number; }) {
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
    const plantScheduledDate = field.plantScheduledDate
        ? new Date(field.plantScheduledDate)
        : null;
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
                <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                    <Typography level="body2">Status</Typography>
                    <div className="flex items-start">
                        <Chip>{localizedStatus}</Chip>
                    </div>
                    {plantScheduledDate && (
                        <>
                            <Typography level="body2">Planirani datum</Typography>
                            <div className="flex items-start">
                                <Chip>{plantScheduledDate?.toLocaleDateString() || 'Nepoznato'}</Chip>
                            </div>
                        </>
                    )}
                </div>
            </Stack>
        </Modal>
    );

}
