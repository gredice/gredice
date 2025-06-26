import { ItemCard } from "../../components/shared/ItemCard";
import { KnownPages } from "../../src/KnownPages";
import { PlantImage } from "../../components/plants/PlantImage";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { PlantData } from "@gredice/client";
import { PlantYieldTooltip, PlantRecommendedBadge } from "@gredice/ui/plants";
import { Stack } from "@signalco/ui-primitives/Stack";

export type PlantsGalleryItemProps =
    Pick<PlantData, 'information' | 'attributes' | 'image'> &
    Partial<Pick<PlantData, 'prices'>> & {
        showPrices?: boolean;
        isRecommended?: boolean;
    }

export function PlantsGalleryItem(props: PlantsGalleryItemProps) {
    const { information, prices, attributes, showPrices = true, isRecommended } = props;
    let plantsPerRow = Math.floor(30 / (attributes?.seedingDistance ?? 30));
    if (plantsPerRow < 1) {
        console.warn(`Plants per row is less than 1 (${plantsPerRow}) for ${information.name}. Setting to 1.`);
        plantsPerRow = 1;
    }
    const totalPlants = Math.floor(plantsPerRow * plantsPerRow);
    const pricePerPlant = prices?.perPlant ? (prices.perPlant / totalPlants).toFixed(2) : null;
    const expectedYieldAverage = (attributes.yieldMax ?? 0 - attributes.yieldMin ?? 0) / 2 + (attributes.yieldMin ?? 0);
    const expectedYieldPerField = attributes.yieldType === 'perField' ? expectedYieldAverage : expectedYieldAverage * totalPlants;

    return (
        <ItemCard
            label={(
                <Stack>
                    <Row justifyContent="space-between">
                        <Typography>{information.name}</Typography>
                        <PlantYieldTooltip plant={{ information, attributes }}>
                            <Typography level="body3" tertiary className="text-right">
                                prinos ~{(expectedYieldPerField / 1000).toFixed(1)} kg
                            </Typography>
                        </PlantYieldTooltip>
                    </Row>
                    <Row justifyContent="space-between">
                        <Typography level="body2">{prices?.perPlant?.toFixed(2) ?? 'Nepoznato'}€</Typography>
                        <Typography level="body3" tertiary>
                            <span>{pricePerPlant}€</span>
                            <span className="hidden md:inline-block">&nbsp;po biljci</span>
                            <span className="md:hidden">/biljci</span>
                        </Typography>
                    </Row>
                </Stack>
            )}
            href={KnownPages.Plant(information.name)}>
            <PlantImage
                plant={props}
                fill
                priority
                sizes="(max-width: 768px) 50vw, (min-width: 768px) 33vw, (min-width: 1200px) 9vw"
            />
            <div className="absolute top-1 right-1 -m-6">
                <PlantRecommendedBadge isRecommended={isRecommended} size="sm" />
            </div>
        </ItemCard>
    );
}
