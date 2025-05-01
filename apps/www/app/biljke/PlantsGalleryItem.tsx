import { ItemCard } from "../../components/shared/ItemCard";
import { PlantData } from "./[alias]/page";
import { KnownPages } from "../../src/KnownPages";
import { PlantImage } from "../../components/plants/PlantImage";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { cx } from "@signalco/ui-primitives/cx";

export type PlantsGalleryItemProps =
    Pick<PlantData, 'information' | 'image'> &
    Partial<Pick<PlantData, 'prices'>> & {
        showPrices?: boolean;
    }

export function PlantsGalleryItem(props: PlantsGalleryItemProps) {
    const { information, prices, showPrices = true } = props;
    return (
        <ItemCard
            label={(
                <Row spacing={1} justifyContent={cx(showPrices ? "space-between" : 'center')}>
                    <Typography>{information.name}</Typography>
                    {(showPrices && prices) && (
                        <Typography level="body3" className="text-muted-foreground">
                            <span>{prices.perPlant}€</span>
                            <span className="hidden md:inline-block">&nbsp;po sadnji</span>
                            <span className="md:hidden">/sadnji</span>
                        </Typography>
                    )}
                </Row>
            )}
            href={KnownPages.Plant(information.name)}>
            <PlantImage plant={props} fill />
        </ItemCard>
    );
}
