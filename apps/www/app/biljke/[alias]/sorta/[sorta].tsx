import { notFound } from "next/navigation";
import { getPlantsData } from "../../../lib/plants/getPlantsData";
import { getPlantSortsData } from "../../../lib/plants/getPlantSortsData";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Card } from "@signalco/ui-primitives/Card";
import { PlantAttributeCards } from "../PlantAttributeCards";
import { PlantImage } from "../../../components/plants/PlantImage";

export default async function PlantSortPage({ params }: { params: { alias: string, sorta: string } }) {
    const { alias, sorta } = params;
    const plants = await getPlantsData();
    const sorts = await getPlantSortsData();
    const basePlant = plants.find(p => p.information.name.toLowerCase() === alias.toLowerCase());
    const sort = sorts.find(s => s.information.name.toLowerCase() === sorta.toLowerCase() && s.information.plant.information?.name?.toLowerCase() === alias.toLowerCase());
    if (!basePlant || !sort) notFound();
    const sortInfo = sort.information.plant.information;
    const baseInfo = basePlant.information;
    function diff(val1: any, val2: any) {
        return val1 !== val2;
    }
    return (
        <Stack spacing={4}>
            <Typography level="h1" className="text-3xl">{sort.information.name}</Typography>
            <Typography level="body1" className="italic">Sorta biljke: {baseInfo.name}</Typography>
            <PlantImage plant={{ image: sort.information.plant.image, information: sortInfo }} width={120} height={120} />
            <Card className="p-4">
                <Typography level="h2" className="text-xl mb-2">Opis</Typography>
                <Typography level="body2">
                    {sortInfo.description}
                    {diff(sortInfo.description, baseInfo.description) && <span className="ml-2 text-green-700 font-semibold">(razlika)</span>}
                </Typography>
            </Card>
            <Card className="p-4">
                <Typography level="h2" className="text-xl mb-2">Svojstva</Typography>
                <PlantAttributeCards attributes={sortInfo.attributes} />
                {Object.keys(sortInfo.attributes || {}).map(key => diff(sortInfo.attributes?.[key], baseInfo.attributes?.[key]) && (
                    <div key={key} className="text-green-700 text-sm">{key}: {sortInfo.attributes?.[key]} (razlika)</div>
                ))}
            </Card>
            <Card className="p-4">
                <Typography level="h2" className="text-xl mb-2">Ostale informacije</Typography>
                <ul className="list-disc ml-6">
                    {Object.entries(sortInfo).map(([key, value]) => {
                        if (["description", "attributes", "name", "latinName"].includes(key)) return null;
                        if (typeof value === "string" && diff(value, baseInfo[key])) {
                            return <li key={key}><span className="font-semibold">{key}:</span> {value} <span className="text-green-700">(razlika)</span></li>;
                        } else if (typeof value === "string") {
                            return <li key={key}><span className="font-semibold">{key}:</span> {value}</li>;
                        }
                        return null;
                    })}
                </ul>
            </Card>
        </Stack>
    );
}
