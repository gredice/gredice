import type { PlantData, PlantSortData } from '@gredice/client';
import { NoDataPlaceholder } from '@signalco/ui/NoDataPlaceholder';
import { Calendar, Sprout } from '@signalco/ui-icons';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@signalco/ui-primitives/Tabs';
import { Typography } from '@signalco/ui-primitives/Typography';
import { FeedbackModal } from '../../../components/shared/feedback/FeedbackModal';
import { PlantGrowthCalendar } from './PlantGrowthCalendar';
import { PlantYearCalendar } from './PlantYearCalendar';

export function PlantCalendarPicker({
    plant,
    sort,
}: {
    plant: PlantData;
    sort?: PlantSortData;
}) {
    return (
        <Tabs defaultValue="year">
            <Stack spacing={0} className="group">
                <TabsList className="grid grid-cols-2 border w-fit">
                    <TabsTrigger value="year" className="flex gap-2">
                        <Calendar className="size-5 shrink-0" />
                        <span>Kalendar sijanja</span>
                    </TabsTrigger>
                    <TabsTrigger value="growth" className="flex gap-2">
                        <Sprout className="size-5 shrink-0" />
                        <span>Kalendar rasta</span>
                    </TabsTrigger>
                </TabsList>
                {!plant.calendar || Object.keys(plant.calendar).length <= 0 ? (
                    <NoDataPlaceholder>
                        Nema podataka o kalendaru
                    </NoDataPlaceholder>
                ) : (
                    <>
                        <TabsContent value="year">
                            <Card>
                                <CardOverflow>
                                    <PlantYearCalendar
                                        activities={plant.calendar}
                                    />
                                </CardOverflow>
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
                            <Card>
                                <CardOverflow>
                                    <PlantGrowthCalendar
                                        windows={plant.attributes}
                                    />
                                </CardOverflow>
                            </Card>
                            <Typography
                                level="body2"
                                className="italic text-right text-balance"
                            >
                                Kalendar rasta prikazuje faze biljke ako se
                                biljka sije danas.
                            </Typography>
                        </TabsContent>
                    </>
                )}
                <FeedbackModal
                    topic={
                        sort
                            ? 'www/plants/sorts/calendar'
                            : 'www/plants/calendar'
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
        </Tabs>
    );
}
