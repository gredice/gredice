import { PlantData, PlantSortData } from "@gredice/client";
import { Card } from "@signalco/ui-primitives/Card";
import { Stack } from "@signalco/ui-primitives/Stack";
import { NoDataPlaceholder } from "@signalco/ui/NoDataPlaceholder";
import { PlantYearCalendar } from "./PlantYearCalendar";
import { FeedbackModal } from "../../../components/shared/feedback/FeedbackModal";
import { PlantGrowthCalendar } from "./PlantGrowthCalendar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@signalco/ui-primitives/Tabs";
import { Calendar, Sprout } from "@signalco/ui-icons";

export function PlantCalendarPicker({ plant, sort }: { plant: PlantData, sort?: PlantSortData }) {
    return (
        <Tabs defaultValue="year">
            <Stack spacing={1} className="group">
                <TabsList className="grid grid-cols-2 border w-fit">
                    <TabsTrigger value="year" className="flex gap-2"><Calendar className="size-5 shrink-0" /><span>Kalendar sijanja</span></TabsTrigger>
                    <TabsTrigger value="growth" className="flex gap-2"><Sprout className="size-5 shrink-0" /><span>Kalendar rasta</span></TabsTrigger>
                </TabsList>
                {(!plant.calendar || Object.keys(plant.calendar).length <= 0) ? (
                    <NoDataPlaceholder>
                        Nema podataka o kalendaru
                    </NoDataPlaceholder>
                ) : (
                    <Card className="p-0">
                        <TabsContent value="year">
                            <PlantYearCalendar activities={plant.calendar} />
                        </TabsContent>
                        <TabsContent value="growth">
                            <PlantGrowthCalendar windows={plant.attributes} />
                        </TabsContent>
                    </Card>
                )}
                <FeedbackModal
                    topic={sort ? "www/plants/sorts/calendar" : "www/plants/calendar"}
                    data={{
                        plantId: plant.id,
                        plantAlias: plant.information.name,
                        sortId: sort?.id,
                        sortAlias: sort?.information.name
                    }}
                    className="self-end group-hover:opacity-100 opacity-0 transition-opacity" />
            </Stack>
        </Tabs>
    )
}