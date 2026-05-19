import type { PlantData, PlantSortData } from '@gredice/client';
import { NoDataPlaceholder } from '@signalco/ui/NoDataPlaceholder';
import { Calendar, Sprout } from '@signalco/ui-icons';
import { Card } from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@signalco/ui-primitives/Tabs';
import { Typography } from '@signalco/ui-primitives/Typography';
import { FeedbackModal } from '../../../components/shared/feedback/FeedbackModal';
import { CalendarInfoChip } from '../CalendarInfoChip';
import { PlantGrowthCalendar } from './PlantGrowthCalendar';
import { PlantYearCalendar } from './PlantYearCalendar';

export function PlantCalendarPicker({
    plant,
    sort,
}: {
    plant: PlantData;
    sort?: PlantSortData;
}) {
    const hasCalendarData =
        Boolean(plant.calendar) && Object.keys(plant.calendar).length > 0;

    return (
        <Stack spacing={1} className="group">
            <Stack
                spacing={0}
                className="bg-muted p-2 rounded-lg border shadow-sm"
            >
                {hasCalendarData ? (
                    <Tabs defaultValue="year">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <TabsList className="grid min-w-0 max-w-full grid-cols-2">
                                <TabsTrigger
                                    value="year"
                                    className="flex min-w-0 gap-1 px-2"
                                >
                                    <Calendar className="size-4 shrink-0" />
                                    <span className="truncate">
                                        Kalendar sijanja
                                    </span>
                                </TabsTrigger>
                                <TabsTrigger
                                    value="growth"
                                    className="flex min-w-0 gap-1 px-2"
                                >
                                    <Sprout className="size-4 shrink-0" />
                                    <span className="truncate">
                                        Kalendar rasta
                                    </span>
                                </TabsTrigger>
                            </TabsList>
                            <CalendarInfoChip className="self-center" />
                        </div>
                        <TabsContent value="year">
                            <Card className="overflow-hidden bg-white">
                                <div className="overflow-x-auto rounded-md bg-white pb-2">
                                    <div className="min-w-[34rem]">
                                        <PlantYearCalendar
                                            activities={plant.calendar}
                                        />
                                    </div>
                                </div>
                            </Card>
                            <Typography
                                level="body2"
                                className="italic text-right text-balance"
                            >
                                Kalendar sijanja prikazuje smjernice za sjetvu i
                                razvoj biljke kroz godinu.
                            </Typography>
                        </TabsContent>
                        <TabsContent value="growth">
                            <Card className="overflow-hidden bg-white">
                                <div className="overflow-x-auto rounded-md bg-white pb-2">
                                    <div className="min-w-[34rem]">
                                        <PlantGrowthCalendar
                                            windows={plant.attributes}
                                        />
                                    </div>
                                </div>
                            </Card>
                            <Typography
                                level="body2"
                                className="italic text-right text-balance"
                            >
                                Kalendar rasta prikazuje faze biljke ako se
                                biljka sije danas.
                            </Typography>
                        </TabsContent>
                    </Tabs>
                ) : (
                    <NoDataPlaceholder>
                        Nema podataka o kalendaru
                    </NoDataPlaceholder>
                )}
            </Stack>
            <FeedbackModal
                topic={
                    sort ? 'www/plants/sorts/calendar' : 'www/plants/calendar'
                }
                data={{
                    plantId: plant.id,
                    plantAlias: plant.information.name,
                    sortId: sort?.id,
                    sortAlias: sort?.information.name,
                }}
                className="self-end group-hover:opacity-100 opacity-0 transition-opacity"
            />
        </Stack>
    );
}
