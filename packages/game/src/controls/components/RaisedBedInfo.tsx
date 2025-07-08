import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Divider } from "@signalco/ui-primitives/Divider";
import { BlockImage } from "../../shared-ui/BlockImage";
import { useCurrentGarden } from "../../hooks/useCurrentGarden";
import { EditableInput } from "@signalco/ui/EditableInput";
import { useUpdateRaisedBed } from "../../hooks/useUpdateRaisedBed";
import { useAllSorts } from "../../hooks/usePlantSorts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@signalco/ui-primitives/Tabs";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { RaisedBedDiary } from "../../hud/raisedBed/RaisedBedDiary";
import { Book, Info } from "@signalco/ui-icons";

export function RaisedBedInfo({ gardenId, raisedBed }: { gardenId: number, raisedBed: NonNullable<Awaited<ReturnType<typeof useCurrentGarden>>['data']>['raisedBeds'][0] }) {
    const updateRaisedBed = useUpdateRaisedBed(gardenId, raisedBed.id);

    function handleNameChange(newName: string) {
        updateRaisedBed.mutate({ name: newName });
    }

    // Get all raised bed fields and calculate average, min and max yield based on plant sorts
    const { data: sorts } = useAllSorts()
    const yieldStats = raisedBed.fields.reduce(
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
    );

    return (
        <Stack spacing={2}>
            <Row spacing={3}>
                <BlockImage blockName="Raised_Bed" className="size-20" />
                <Stack>
                    <Typography level="body2">Naziv gredice</Typography>
                    <EditableInput value={raisedBed.name} onChange={handleNameChange} className="w-full" />
                </Stack>
            </Row>
            <Tabs defaultValue="diary" className="flex flex-col">
                <TabsList className="border w-fit self-center">
                    <TabsTrigger value="diary">
                        <Row spacing={1}>
                            <Book className="size-4 shrink-0" />
                            <Typography>Dnevnik</Typography>
                        </Row>
                    </TabsTrigger>
                    <TabsTrigger value="info">
                        <Row spacing={1}>
                            <Info className="size-4 shrink-0" />
                            <Typography>Informacije</Typography>
                        </Row>
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="info">
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
                </TabsContent>
                <TabsContent value="diary">
                    <Card>
                        <CardOverflow className="overflow-auto max-h-96">
                            <RaisedBedDiary gardenId={gardenId} raisedBedId={raisedBed.id} />
                        </CardOverflow>
                    </Card>
                </TabsContent>
            </Tabs>
        </Stack>
    );
}