import type { PlantData } from '@gredice/client';
import { AiWatermark } from '@gredice/ui/AiWatermark';
import {
    PlantYieldTooltip,
    SeedTimeInformationBadge,
} from '@gredice/ui/plants';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { PlantImage } from '../../components/plants/PlantImage';
import { ItemCard } from '../../components/shared/ItemCard';
import { KnownPages } from '../../src/KnownPages';

export type PlantsGalleryItemProps = Pick<
    PlantData,
    'information' | 'attributes' | 'image'
> &
    Partial<Pick<PlantData, 'prices'>> & {
        isRecommended?: boolean;
    };

export function PlantsGalleryItem(props: PlantsGalleryItemProps) {
    const { information, prices, attributes, isRecommended } = props;
    return (
        <ItemCard
            label={
                <Stack>
                    <Row justifyContent="space-between">
                        <Typography>{information.name}</Typography>
                        <Typography
                            level="body3"
                            tertiary
                            className="text-right"
                            component="div"
                        >
                            <PlantYieldTooltip
                                plant={{ information, attributes }}
                            />
                        </Typography>
                    </Row>
                    <Typography level="body2" className="self-end">
                        {prices?.perPlant?.toFixed(2) ?? 'Nepoznato'}€
                    </Typography>
                </Stack>
            }
            href={KnownPages.Plant(information.name)}
        >
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
