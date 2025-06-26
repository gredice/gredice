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
            localizedStatus = 'Čeka sijanje';
            break;
        case 'planned':
            icon = <span className="mr-0.5">{'⌛'}</span>;
            localizedStatus = 'Planirana';
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

    const maxDuration =
        (plantSort.information.plant.attributes?.germinationWindowMax ?? 0) +
        (plantSort.information.plant.attributes?.growthWindowMax ?? 0) +
        (plantSort.information.plant.attributes?.harvestWindowMax ?? 0);
    const germinationPercentage = plantSort.information.plant.attributes?.germinationWindowMax
        ? Math.max(10, Math.min(100, plantSort.information.plant.attributes.germinationWindowMax / (maxDuration ?? 0) * 100))
        : 0;
    const harvestPercentage = plantSort.information.plant.attributes?.harvestWindowMax
        ? Math.min(100, plantSort.information.plant.attributes.harvestWindowMax / (maxDuration ?? 0) * 100)
        : 0;
    const growthPercentage = 100 - germinationPercentage - harvestPercentage;
    const germinationWindowMs = (plantSort.information.plant.attributes?.germinationWindowMax ?? 0) * 24 * 60 * 60 * 1000;
    const growthWindowMs = (plantSort.information.plant.attributes?.growthWindowMax ?? 0) * 24 * 60 * 60 * 1000;
    const germinationValue = field.plantGrowthDate
        ? 100
        : (field.plantSowDate
            ? Math.min(100, ((Date.now() - new Date(field.plantSowDate).getTime())) / (germinationWindowMs || 1) * 100)
            : 0);
    const germinatingDays = Math.round(((field.plantGrowthDate
        ? new Date(field.plantGrowthDate).getTime()
        : Date.now()) - (field.plantSowDate
            ? new Date(field.plantSowDate).getTime()
            : Date.now())) / (1000 * 60 * 60 * 24));
    const germinatingDaysDayPlural = germinatingDays === 1 ? 'dan' : 'dana';

    const growthValue = field.plantReadyDate ?
        100
        : (field.plantGrowthDate
            ? Math.min(100, (Date.now() - new Date(field.plantGrowthDate).getTime()) / (growthWindowMs || 1) * 100)
            : 0);
    const growingDays = Math.round(((field.plantReadyDate
        ? new Date(field.plantReadyDate).getTime()
        : Date.now()) - (field.plantGrowthDate
            ? new Date(field.plantGrowthDate).getTime()
            : Date.now())) / (1000 * 60 * 60 * 24));
    const growingDaysDayPlural = growingDays === 1 ? 'dan' : 'dana';

    const harvestValue = field.plantReadyDate
        ? Math.min(100, (Date.now() - new Date(field.plantReadyDate).getTime()) / (plantSort.information.plant.attributes?.harvestWindowMax ?? 1) * 100)
        : 0;
    const readyDays = Math.round(((Date.now() - (field.plantReadyDate
        ? new Date(field.plantReadyDate).getTime()
        : Date.now())) / (1000 * 60 * 60 * 24)));
    const readyDaysDayPlural = readyDays === 1 ? 'dan' : 'dana';

    return (
        <Modal
            title={`Biljka "${plantSort.information.name}"`}
            trigger={(
                <RaisedBedFieldItemButton>
                    <SegmentedCircularProgress
                        size={80}
                        strokeWidth={4}
                        segments={[
                            { value: germinationValue, percentage: germinationPercentage, color: "stroke-yellow-500", trackColor: "stroke-yellow-50", pulse: !field.plantGrowthDate },
                            { value: growthValue, percentage: growthPercentage, color: "stroke-green-500", trackColor: "stroke-green-50", pulse: !field.plantReadyDate },
                            { value: harvestValue, percentage: harvestPercentage, color: "stroke-blue-500", trackColor: "stroke-blue-50", pulse: Boolean(harvestValue) },
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
                    {plantScheduledDate && (
                        <>
                            <Typography level="body2">Planirani datum</Typography>
                            <div className="flex items-start">
                                <Chip>{plantScheduledDate?.toLocaleDateString("hr-HR") || 'Nepoznato'}</Chip>
                            </div>
                        </>
                    )}
                    <Stack spacing={1}>
                        <Row spacing={2}>
                            <SegmentedCircularProgress
                                size={140}
                                strokeWidth={3}
                                segments={[
                                    { value: germinationValue, percentage: germinationPercentage, color: "stroke-yellow-500", trackColor: "stroke-yellow-200 dark:stroke-yellow-50", pulse: !field.plantGrowthDate },
                                    { value: growthValue, percentage: growthPercentage, color: "stroke-green-500", trackColor: "stroke-green-200 dark:stroke-green-50", pulse: !field.plantReadyDate },
                                    { value: harvestValue, percentage: harvestPercentage, color: "stroke-blue-500", trackColor: "stroke-blue-200 dark:stroke-blue-50", pulse: Boolean(harvestValue) },
                                ]}
                            >
                                <Stack alignItems="center" className="border bg-card rounded-full shrink-0 size-[100px] aspect-square shadow flex items-center justify-center">
                                    <span className="text-2xl">{icon}</span>
                                    <Typography level="body1" className="text-center" semiBold>
                                        {localizedStatus}
                                    </Typography>
                                </Stack>
                            </SegmentedCircularProgress>
                            <Stack spacing={1}>
                                <Stack>
                                    <Typography level="body2" secondary>Klijanje ({plantSort.information.plant.attributes?.germinationWindowMin}-{plantSort.information.plant.attributes?.germinationWindowMax} dana)</Typography>
                                    <div className="grid gap-x-2 items-center grid-cols-[auto_auto_auto] md:grid-cols-[repeat(4,auto)]">
                                        <Typography>
                                            {field.plantSowDate
                                                ? new Date(field.plantSowDate).toLocaleDateString("hr-HR")
                                                : 'Nije posijano'}
                                        </Typography>
                                        {field.plantSowDate && (
                                            <>
                                                <span>-</span>
                                                <Typography noWrap>
                                                    {field.plantGrowthDate
                                                        ? new Date(field.plantGrowthDate).toLocaleDateString("hr-HR")
                                                        : 'U tijeku...'}
                                                </Typography>
                                                <Typography>
                                                    ({germinatingDays} {germinatingDaysDayPlural})
                                                </Typography>
                                            </>
                                        )}
                                    </div>
                                </Stack>
                                <Stack>
                                    <Typography level="body2" secondary>Rast ({plantSort.information.plant.attributes?.growthWindowMin}-{plantSort.information.plant.attributes?.growthWindowMax} dana)</Typography>
                                    <div className="grid gap-x-2 items-center grid-cols-[auto_auto_auto] md:grid-cols-[repeat(4,auto)]">
                                        <Typography>
                                            {field.plantGrowthDate
                                                ? new Date(field.plantGrowthDate).toLocaleDateString("hr-HR")
                                                : 'Nije u fazi rasta'}
                                        </Typography>
                                        {field.plantGrowthDate && (
                                            <>
                                                <span>-</span>
                                                <Typography noWrap>
                                                    {field.plantReadyDate
                                                        ? new Date(field.plantReadyDate).toLocaleDateString("hr-HR")
                                                        : 'U tijeku...'}
                                                </Typography>
                                                <Typography>
                                                    ({growingDays} {growingDaysDayPlural})
                                                </Typography>
                                            </>
                                        )}
                                    </div>
                                </Stack>
                                <Stack>
                                    <Typography level="body2" secondary>Berba ({plantSort.information.plant.attributes?.harvestWindowMin}-{plantSort.information.plant.attributes?.harvestWindowMax} dana)</Typography>
                                    <Row spacing={0.5}>
                                        <Typography>
                                            {field.plantReadyDate
                                                ? new Date(field.plantReadyDate).toLocaleDateString("hr-HR")
                                                : 'Nije u fazi berbe'}
                                        </Typography>
                                        {field.plantReadyDate && (
                                            <Typography>
                                                ({readyDays} {readyDaysDayPlural})
                                            </Typography>
                                        )}
                                    </Row>
                                </Stack>
                            </Stack>
                        </Row>
                    </Stack>
                </div>
            </Stack>
        </Modal>
    );

}
