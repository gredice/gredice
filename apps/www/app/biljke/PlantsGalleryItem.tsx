import { formatPrice } from '@gredice/js/currency';
import { gardenActionUrl } from '@gredice/js/gardenActions';
import { Button } from '@gredice/ui/Button';
import { Add } from '@gredice/ui/icons';
import { PlantOrSortImage, SeedTimeInformationBadge } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { ItemCard } from '../../components/shared/ItemCard';
import { KnownPages } from '../../src/KnownPages';
import { PlantCardFacts } from './PlantCardFacts';
import { PlantSeasonStrip } from './PlantSeasonStrip';
import type { PlantCatalogueItem } from './plantCatalogue';
import { isPlantAvailableInStore, isPlantSowableInMonth } from './plantSeason';
import { getPlantImageViewTransitionName } from './plantViewTransition';

export type PlantsGalleryItemProps = Omit<PlantCatalogueItem, 'id'> & {
    id: string;
    currentMonth: number;
    matchingAlternativeName?: string;
    matchingSortName?: string;
};

export function PlantsGalleryItem(props: PlantsGalleryItemProps) {
    const {
        id,
        currentMonth,
        information,
        prices,
        matchingAlternativeName,
        matchingSortName,
    } = props;
    const isAvailable = isPlantAvailableInStore(props);
    const isSowingTime =
        isAvailable && isPlantSowableInMonth(props, currentMonth);

    return (
        <ItemCard
            label={
                <Stack spacing={2.5}>
                    <div className="min-w-0">
                        <Typography className="font-semibold">
                            {information.name}
                        </Typography>
                        {information.latinName && (
                            <Typography
                                level="body3"
                                className="truncate italic"
                            >
                                {information.latinName}
                            </Typography>
                        )}
                        {matchingSortName && (
                            <Typography level="body3" secondary>
                                Sorta: {matchingSortName}
                            </Typography>
                        )}
                        {matchingAlternativeName && (
                            <Typography level="body3" secondary>
                                Poznato i kao: {matchingAlternativeName}
                            </Typography>
                        )}
                    </div>
                    <PlantSeasonStrip
                        plant={props}
                        currentMonth={currentMonth}
                    />
                </Stack>
            }
            footer={
                <Stack spacing={2.5} className="pt-1">
                    <PlantCardFacts plant={props} />
                    <Row
                        justifyContent="space-between"
                        spacing={2}
                        className="flex-wrap border-t pt-2"
                    >
                        {(isAvailable ||
                            typeof prices?.perPlant === 'number') && (
                            <Stack>
                                <Typography className="font-bold">
                                    {formatPrice(prices?.perPlant)}
                                </Typography>
                                <Typography level="body3">
                                    cijena sijanja
                                </Typography>
                            </Stack>
                        )}
                        {isAvailable ? (
                            <Button
                                href={gardenActionUrl(KnownPages.GardenApp, {
                                    type: 'sow',
                                    plantId: Number(id),
                                })}
                                navigation="document"
                                size="sm"
                                startDecorator={
                                    <Add
                                        aria-hidden
                                        className="size-4 shrink-0"
                                    />
                                }
                                aria-label={`Posadi u gredicu: ${information.name}`}
                                className="ml-auto shrink-0 bg-green-800 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                            >
                                Posadi
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                disabled
                                size="sm"
                                variant="outlined"
                                aria-label={`Nedostupno za sjetvu: ${information.name}`}
                                className="ml-auto shrink-0"
                            >
                                Nedostupno
                            </Button>
                        )}
                    </Row>
                </Stack>
            }
            badge={isSowingTime && <SeedTimeInformationBadge size="sm" />}
            href={KnownPages.Plant(information.name)}
            mediaViewTransitionName={getPlantImageViewTransitionName(id)}
        >
            <PlantOrSortImage
                plant={props}
                fill
                sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
            />
        </ItemCard>
    );
}
