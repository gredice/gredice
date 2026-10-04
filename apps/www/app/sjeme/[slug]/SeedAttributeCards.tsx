import type { SeedData } from '@gredice/client';
import { BarcodeValue } from '@gredice/ui/Barcode';
import {
    GameGardenPlanIcon,
    GameLocationIcon,
    GameReceiptIcon,
    GameSeedlingIcon,
    GameTagIcon,
    GameWeightIcon,
} from '@gredice/ui/GameIcons';
import { AttributeCard } from '../../../components/attributes/DetailCard';
import { formatPrice } from '../../../lib/formatPrice';
import { formatSeedArea, formatSeedWeight } from '../seedPresentation';

export function SeedAttributeCards({
    seed,
}: {
    seed: Pick<SeedData, 'attributes' | 'application'> & {
        information: Pick<
            SeedData['information'],
            'barcode' | 'countryOfOrigin'
        >;
    };
}) {
    return (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {typeof seed.attributes.price === 'number' ? (
                <AttributeCard
                    icon={<GameReceiptIcon aria-hidden />}
                    header="Cijena"
                    value={formatPrice(seed.attributes.price)}
                />
            ) : null}
            <AttributeCard
                icon={<GameWeightIcon aria-hidden />}
                header="Težina"
                value={
                    typeof seed.attributes.weight === 'number'
                        ? formatSeedWeight(seed.attributes.weight)
                        : undefined
                }
            />
            {seed.attributes.germinationPercentage != null ? (
                <AttributeCard
                    icon={<GameSeedlingIcon aria-hidden />}
                    header="Klijavost"
                    value={`${seed.attributes.germinationPercentage}%`}
                />
            ) : null}
            {seed.application?.applicationArea != null ? (
                <AttributeCard
                    icon={<GameGardenPlanIcon aria-hidden />}
                    header="Površina primjene"
                    value={formatSeedArea(seed.application.applicationArea)}
                />
            ) : null}
            {seed.application?.applicationPlants != null ? (
                <AttributeCard
                    icon={<GameSeedlingIcon aria-hidden />}
                    header="Broj biljaka"
                    value={seed.application.applicationPlants}
                />
            ) : null}
            {seed.information.barcode ? (
                <AttributeCard
                    icon={<GameTagIcon aria-hidden />}
                    header="Barkod"
                    value={<BarcodeValue value={seed.information.barcode} />}
                />
            ) : null}
            {seed.information.countryOfOrigin ? (
                <AttributeCard
                    icon={<GameLocationIcon aria-hidden />}
                    header="Zemlja podrijetla"
                    value={seed.information.countryOfOrigin}
                />
            ) : null}
        </div>
    );
}
