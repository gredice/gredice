import type { PlantData } from '@gredice/client';
import {
    PlantOrSortImage,
    PlantYieldTooltip,
    SeedTimeInformationBadge,
} from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { ItemCard } from '../../components/shared/ItemCard';
import { KnownPages } from '../../src/KnownPages';

export type PlantsGalleryItemProps = Pick<
    PlantData,
    'information' | 'attributes' | 'image'
> &
    Partial<Pick<PlantData, 'prices'>> & {
        isRecommended?: boolean;
        matchingAlternativeName?: string;
        matchingSortName?: string;
    };

export function PlantsGalleryItem(props: PlantsGalleryItemProps) {
    const {
        information,
        prices,
        attributes,
        isRecommended,
        matchingAlternativeName,
        matchingSortName,
    } = props;
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
                </Stack>
            }
            href={KnownPages.Plant(information.name)}
        >
            <PlantOrSortImage
                plant={props}
                fill
                preload
                sizes="(max-width: 768px) 50vw, (min-width: 768px) 33vw, (min-width: 1200px) 9vw"
            />
            {isRecommended && (
                <div className="absolute top-1 right-1">
                    <SeedTimeInformationBadge size="sm" />
                </div>
            )}
        </ItemCard>
    );
}
