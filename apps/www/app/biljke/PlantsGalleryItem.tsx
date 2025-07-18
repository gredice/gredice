import { ItemCard } from "../../components/shared/ItemCard";
import { KnownPages } from "../../src/KnownPages";
import { PlantImage } from "../../components/plants/PlantImage";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { PlantData } from "@gredice/client";
import { PlantYieldTooltip, SeedTimeInformationBadge } from "@gredice/ui/plants";
import { Stack } from "@signalco/ui-primitives/Stack";
import { AiWatermark } from "@gredice/ui/AiWatermark";

export type PlantsGalleryItemProps =
    Pick<PlantData, 'information' | 'attributes' | 'image'> &
    Partial<Pick<PlantData, 'prices'>> & {
        isRecommended?: boolean;
    }

export function PlantsGalleryItem(props: PlantsGalleryItemProps) {
    const { information, prices, attributes, isRecommended } = props;
    let plantsPerRow = Math.floor(30 / (attributes?.seedingDistance ?? 30));
    if (plantsPerRow < 1) {
        console.warn(`Plants per row is less than 1 (${plantsPerRow}) for ${information.name}. Setting to 1.`);
        plantsPerRow = 1;
    }
    const totalPlants = Math.floor(plantsPerRow * plantsPerRow);
    const pricePerPlant = prices?.perPlant ? (prices.perPlant / totalPlants).toFixed(2) : null;

    return (
        <ItemCard
            label={(
                <Stack>
                    <Row justifyContent="space-between">
                        <Typography>{information.name}</Typography>
                        <Typography level="body3" tertiary className="text-right">
                            <PlantYieldTooltip plant={{ information, attributes }} />
                        </Typography>
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
            <AiWatermark
                reason="Primjer ploda biljke visoke rezolucije bez nedostataka."
                aiPrompt={`Realistic and not perfect image of requested plant on white background. No Text Or Banners. Square image. ${information.name}`}
                aiModel="ChatGPT-4o"
            >
                <PlantImage
                    plant={props}
                    fill
                    priority
                    sizes="(max-width: 768px) 50vw, (min-width: 768px) 33vw, (min-width: 1200px) 9vw"
                />
            </AiWatermark>
            {isRecommended && (
                <div className="absolute top-1 right-1 -m-2 md:-m-6">
                    <SeedTimeInformationBadge size="sm" />
                </div>
            )}
        </ItemCard>
    );
}
