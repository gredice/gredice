import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { BlockImage } from "@gredice/ui/BlockImage";
import { useCurrentGarden } from "../../hooks/useCurrentGarden";
import { EditableInput } from "@signalco/ui/EditableInput";
import { useUpdateRaisedBed } from "../../hooks/useUpdateRaisedBed";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@signalco/ui-primitives/Tabs";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { RaisedBedDiary } from "./RaisedBedDiary";
import { Book, Hammer, Info } from "@signalco/ui-icons";
import { RaisedBedInfoTab } from "./RaisedBedInfoTab";
import { RaisedBedOperationsTab } from "./RaisedBedOperationsTab";

export function RaisedBedInfo({ gardenId, raisedBed }: { gardenId: number, raisedBed: NonNullable<Awaited<ReturnType<typeof useCurrentGarden>>['data']>['raisedBeds'][0] }) {
    const updateRaisedBed = useUpdateRaisedBed(gardenId, raisedBed.id);

    function handleNameChange(newName: string) {
        updateRaisedBed.mutate({ name: newName });
    }

    return (
        <Stack spacing={2}>
            <Row spacing={3}>
                <BlockImage blockName="Raised_Bed" width={80} height={80} className="size-20" />
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
                    <TabsTrigger value="operations">
                        <Row spacing={1}>
                            <Hammer className="size-4 shrink-0" />
                            <Typography>Radnje</Typography>
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
                    <RaisedBedInfoTab gardenId={gardenId} raisedBedId={raisedBed.id} />
                </TabsContent>
                <TabsContent value="diary">
                    <Card>
                        <CardOverflow className="overflow-auto max-h-96">
                            <RaisedBedDiary gardenId={gardenId} raisedBedId={raisedBed.id} />
                        </CardOverflow>
                    </Card>
                </TabsContent>
                <TabsContent value="operations">
                    <RaisedBedOperationsTab gardenId={gardenId} raisedBedId={raisedBed.id} />
                </TabsContent>
            </Tabs>
        </Stack>
    );
}