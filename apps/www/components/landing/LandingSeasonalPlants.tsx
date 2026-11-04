import { Button } from '@gredice/ui/Button';
import { GameCalendarIcon } from '@gredice/ui/GameIcons';
import { getLandingSeasonalPlants } from '../../app/getLandingSeasonalPlants';
import { PlantsShowcase } from '../../app/PlantsShowcase';
import { calendarMonthLocativeNames } from '../../lib/plants/calendarActivities';
import { KnownPages } from '../../src/KnownPages';
import { LandingSectionHeader } from './LandingSectionHeader';

export const landingSeasonalPlantsId = 'sad-u-sezoni';

export async function LandingSeasonalPlants() {
    const seasonal = await getLandingSeasonalPlants();
    if (!seasonal || seasonal.plants.length === 0) {
        return null;
    }

    const monthLocative =
        calendarMonthLocativeNames[seasonal.currentMonth - 1] ?? '';
    // Only promise "this month" when every card shown can be sown now.
    const allSeasonal =
        seasonal.sowablePlants.length === seasonal.plants.length;

    return (
        <section
            aria-labelledby="landing-seasonal-plants-title"
            className="scroll-mt-24 py-14 sm:py-20"
            id={landingSeasonalPlantsId}
        >
            <div className="flex flex-col gap-8">
                <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
                    <LandingSectionHeader
                        id="landing-seasonal-plants-title"
                        eyebrow={
                            seasonal.isSeasonal
                                ? 'Sad u sezoni'
                                : 'Povrće iz tvog vrta'
                        }
                        title={
                            allSeasonal
                                ? `Što možeš posaditi u ${monthLocative}`
                                : seasonal.isSeasonal
                                  ? 'Biljke za tvoju gredicu'
                                  : 'Koje povrće možeš posaditi?'
                        }
                        description={
                            allSeasonal
                                ? 'Ponuda prati kalendar sjetve, pa uvijek vidiš što ima smisla posaditi baš sada.'
                                : 'Ponuda prati kalendar sjetve: biljke s oznakom „Vrijeme za sijanje” upravo su u sezoni.'
                        }
                        className="min-w-0 flex-[1_1_32rem]"
                    />
                    <Button
                        href={KnownPages.SowingCalendar}
                        size="lg"
                        color="brand"
                        variant="soft"
                        startDecorator={
                            <GameCalendarIcon
                                aria-hidden
                                className="size-6 shrink-0"
                            />
                        }
                    >
                        Kalendar sjetve
                    </Button>
                </div>
                <PlantsShowcase
                    plants={seasonal.plants}
                    previewPlants={seasonal.previewPlants}
                    totalPlants={seasonal.totalPlants}
                    currentMonth={seasonal.currentMonth}
                />
            </div>
        </section>
    );
}
