import { ItemCard } from "../../components/shared/ItemCard";
import { KnownPages } from "../../src/KnownPages";
import { PlantImage } from "../../components/plants/PlantImage";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { cx } from "@signalco/ui-primitives/cx";
import { PlantData } from "../../lib/@types/PlantData";

export type PlantsGalleryItemProps =
    Pick<PlantData, 'information' | 'attributes' | 'image'> &
    Partial<Pick<PlantData, 'prices'>> & {
        showPrices?: boolean;
    }

export function PlantsGalleryItem(props: PlantsGalleryItemProps) {
    const { information, prices, attributes, showPrices = true } = props;
    let plantsPerRow = 30 / (attributes?.seedingDistance ?? 30);
    if (plantsPerRow < 1) {
        console.warn(`Plants per row is less than 1 (${plantsPerRow}) for ${information.name}. Setting to 1.`);
        plantsPerRow = 1;
    }
    const totalPlants = Math.floor(plantsPerRow * plantsPerRow);
    const pricePerPlant = prices?.perPlant ? (prices.perPlant / totalPlants).toFixed(2) : null;

    return (
        <ItemCard
            label={(
                <Row spacing={1} justifyContent={cx(showPrices ? "space-between" : 'center')}>
                    <Typography>{information.name}</Typography>
                    {(showPrices && pricePerPlant) && (
                        <Stack>
                            <Typography level="body3" tertiary>
                                <span>{pricePerPlant}€</span>
                                <span className="hidden md:inline-block">&nbsp;po biljci</span>
                                <span className="md:hidden">/biljci</span>
                            </Typography>
                            <Typography level="body3" tertiary className="text-right">
                                min. {totalPlants} kom
                            </Typography>
                        </Stack>
                    )}
                </Row>
            )}
            href={KnownPages.Plant(information.name)}>
            <PlantImage
                plant={props}
                fill
                priority
                sizes="(max-width: 768px) 50vw, (min-width: 768px) 33vw, (min-width: 1200px) 9vw"
            />
        </ItemCard>
    );
}
