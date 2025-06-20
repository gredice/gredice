import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { useState } from "react";
import { PlantSortData } from "@gredice/client";
import { Input } from "@signalco/ui-primitives/Input";
import { Row } from "@signalco/ui-primitives/Row";
import { usePlantSorts } from "../../hooks/usePlantSorts";

export type PlantPickerOptionsProps = {
    selectedPlantId: number;
    selectedSortId: number;
    selectedOptions: { scheduledDate: Date | null | undefined } | null;
    onChange: (options: { scheduledDate: Date | null | undefined }) => void;
};

// Helper to format date as YYYY-MM-DD in local time
function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function PlantPickerOptions({ selectedPlantId, selectedSortId, selectedOptions, onChange }: PlantPickerOptionsProps) {
    // Use local time for tomorrow and 3 months from now
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const threeMonthsFromTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth() + 3, tomorrow.getDate());
    const [plantDate, setPlantDate] = useState<string>(formatLocalDate(selectedOptions?.scheduledDate ?? tomorrow));

    const { data: plantSorts } = usePlantSorts(selectedPlantId);
    const selectedSort = plantSorts?.find((sort: PlantSortData) => sort.id === selectedSortId);

    if (!selectedSort) {
        return <Typography level="body1">Nema dostupnih sorti za odabranu biljku.</Typography>;
    }

    function handlePlantDateChange(date: string) {
        const parsedDate = date ? new Date(date) : null;
        setPlantDate(date);
        onChange({ scheduledDate: parsedDate });
    }

    const min = formatLocalDate(tomorrow);
    const max = formatLocalDate(threeMonthsFromTomorrow);
    const price = selectedSort.information.plant.prices?.perPlant
        ? selectedSort.information.plant.prices.perPlant.toFixed(2)
        : 'Nepoznato';

    return (
        <Stack spacing={2}>
            <Row spacing={1} justifyContent="space-between" className="bg-card rounded-md border p-2 pr-4">
                <Row spacing={1}>
                    <img
                        src={'https://www.gredice.com/' + (selectedSort.image?.cover?.url ?? selectedSort.information.plant.image?.cover?.url)}
                        alt={selectedSort.information.name}
                        className="size-10"
                    />
                    <Typography level="body1">
                        {selectedSort.information.name}
                    </Typography>
                </Row>
                <Typography level="body1" semiBold>
                    {price}€
                </Typography>
            </Row>
            <Input
                type="date"
                label="Datum sadnje"
                name="plantDate"
                className="w-full"
                value={plantDate}
                onChange={(e) => handlePlantDateChange(e.target.value)}
                min={min}
                max={max}
            />
        </Stack>
    );
}