import { useCurrentGarden } from "../../hooks/useCurrentGarden";
import { Warning } from "@signalco/ui-icons";
import { usePlantSort } from "../../hooks/usePlantSorts";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Chip } from "@signalco/ui-primitives/Chip";
import { RaisedBedFieldItemButton } from "./RaisedBedFieldItemButton";
import { SegmentedCircularProgress } from "./SegmentedCircularProgress";
import { ReactNode } from "react";

export function RaisedBedFieldItemPlanted({ raisedBedId, positionIndex }: { raisedBedId: number; positionIndex: number; }) {
    const { data: garden, isPending: isGardenPending } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    if (!raisedBed) {
        return null;
    }

    const field = raisedBed.fields.find(field => field.positionIndex === positionIndex);
    if (!field || !field.plantSortId) {
        console.debug('fields', raisedBed.fields)
        console.log(`Field not found for raised bed ${raisedBedId} at position index ${positionIndex}`);
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

    let icon: ReactNode | null = null;
    let localizedStatus = field.plantStatus;
    switch (localizedStatus) {
        case 'new':
            icon = <span className="mr-0.5">{'🌟'}</span>;
            localizedStatus = 'Nova - čeka na sijanje';
            break;
        case 'planned':
            icon = <span className="mr-0.5">{'⌛'}</span>;
            localizedStatus = 'Planirana - čeka na sijanje';
            break;
        case 'sowed':
            icon = <span className="mr-0.5">{'𓇢'}</span>;
            localizedStatus = 'Posijana';
            break;
        case 'sprouted':
            icon = <span className="mr-0.5">{'🌱'}</span>;
            localizedStatus = 'Proklijala';
            break;
        case 'ready':
            icon = <span className="mr-0.5">{'🌿'}</span>;
            localizedStatus = 'Spremna za berbu';
            break;
        case 'harvested':
            icon = <span className="mr-0.5">{'✅'}</span>;
            localizedStatus = 'Ubrana';
            break;
        case 'died':
            icon = <span className="mr-0.5">{'💀'}</span>;
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
                    <SegmentedCircularProgress
                        size={80}
                        strokeWidth={2}
                        segments={[
                            { value: 100, percentage: 20, color: "stroke-yellow-500", trackColor: "stroke-yellow-50" },
                            { value: 50, percentage: 30, color: "stroke-green-500", trackColor: "stroke-green-50", pulse: true },
                            { value: 0, percentage: 10, color: "stroke-blue-500", trackColor: "stroke-blue-50" },
                        ]}
                    >
                        <img
                            src={`https://www.gredice.com/${plantSort.image?.cover?.url || plantSort.information.plant.image?.cover?.url}`}
                            alt={plantSort.information.name}
                            className="absolute top-1/2 start-1/2 transform -translate-y-1/2 -translate-x-1/2"
                            width={60}
                            height={60} />
                    </SegmentedCircularProgress>
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
                        <Chip startDecorator={icon}>{localizedStatus}</Chip>
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
