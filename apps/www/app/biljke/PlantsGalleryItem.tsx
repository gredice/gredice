import { formatPrice } from '@gredice/js/currency';
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
                    <PlantCardFacts plant={props} />
                    <Row
                        justifyContent="space-between"
                        className="border-t pt-2"
                    >
                        {isAvailable ? (
                            <Stack>
                                <Typography className="font-bold">
                                    {formatPrice(prices?.perPlant)}
                                </Typography>
                                <Typography level="body3">
                                    cijena sijanja
                                </Typography>
                            </Stack>
                        ) : (
                            <Typography level="body2">
                                Trenutno nedostupno
                            </Typography>
                        )}
                    </Row>
                </Stack>
            }
            href={KnownPages.Plant(information.name)}
            mediaViewTransitionName={getPlantImageViewTransitionName(id)}
        >
            <PlantOrSortImage
                plant={props}
                fill
                sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
            />
            {isSowingTime && (
                <div className="absolute top-1 right-1">
                    <SeedTimeInformationBadge size="sm" />
                </div>
            )}
        </ItemCard>
    );
}
