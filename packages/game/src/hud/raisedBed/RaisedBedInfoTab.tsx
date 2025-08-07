import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { useAllSorts } from "../../hooks/usePlantSorts";
import { useCurrentGarden } from "../../hooks/useCurrentGarden";

export function RaisedBedInfoTab({ gardenId, raisedBedId }: { gardenId: number, raisedBedId: number }) {
    const { data: currentGarden } = useCurrentGarden();
    if (currentGarden?.id !== gardenId) return null;
    const raisedBed = currentGarden?.raisedBeds.find(bed => bed.id === raisedBedId);

    // Get all raised bed fields and calculate average, min and max yield based on plant sorts
    const { data: sorts } = useAllSorts()
    const yieldStats = raisedBed?.fields.reduce(
        (acc, field) => {
            const sortData = sorts?.find(sort => sort.id === field.plantSortId);
            if (!sortData) return acc;
            const plantYieldMin = sortData.information.plant.attributes?.yieldMin ?? 0;
            const plantYieldMax = sortData.information.plant.attributes?.yieldMax ?? 0;
            const plantYieldAvg = (plantYieldMin + plantYieldMax) / 2;
            return {
                min: acc.min + plantYieldMin,
                max: acc.max + plantYieldMax,
                avg: acc.avg + plantYieldAvg,
            };
        },
        { min: 0, max: 0, avg: 0 }
    ) ?? { min: 0, max: 0, avg: 0 };

    if (!raisedBed) return null;

    return (
        <div className="grid grid-cols-2 gap-y-2 gap-x-6">
            <Stack>
                <Typography level="body2">Dimenzije</Typography>
                <Typography level="body1">2m x 1m x 20cm</Typography>
            </Stack>
            <Stack>
                <Typography level="body2">Površina</Typography>
                <Typography level="body1">1m²</Typography>
            </Stack>
            <Stack>
                <Typography level="body2">Broj popunjenih polja</Typography>
                <Typography level="body1">{raisedBed.fields.length}</Typography>
            </Stack>
            <Stack>
                <Typography level="body2">Očekivani prinos</Typography>
                <Stack>
                    <Typography level="body1">
                        ~{(yieldStats.avg / 1000).toFixed(2)} kg
                    </Typography>
                    <Typography level="body2">
                        {((yieldStats.min / 1000).toFixed(2))} kg - {((yieldStats.max / 1000).toFixed(2))} kg
                    </Typography>
                </Stack>
            </Stack>
        </div>
    );
}