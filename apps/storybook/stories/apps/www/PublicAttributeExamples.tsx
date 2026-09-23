import { GrowthAttributeCards } from '@apps/www/app/biljke/[alias]/GrowthAttributeCards';
import { HarvestAttributeCards } from '@apps/www/app/biljke/[alias]/HarvestAttributeCards';
import { SowingAttributeCards } from '@apps/www/app/biljke/[alias]/SowingAttributeCards';
import { WateringAttributeCards } from '@apps/www/app/biljke/[alias]/WateringAttributeCards';
import { BlockAttributeCards } from '@apps/www/app/blokovi/[alias]/BlockAttributeCards';
import { OperationAttributesCards } from '@apps/www/app/radnje/[alias]/OperationAttributesCards';
import { SeedAttributeCards } from '@apps/www/app/sjeme/[slug]/SeedAttributeCards';
import { PriceAttributeCard } from '@apps/www/components/attributes/PriceAttributeCard';
import { GameCoinsIcon, GameReceiptIcon } from '@gredice/ui/GameIcons';
import type { ComponentProps } from 'react';

const plantAttributes = {
    seedingDistance: 90,
    seedingDepth: 1.5,
    gernimationTemperature: 18,
    germinationType: 'Klijanje u mraku',
    germinationWindowMin: 14,
    germinationWindowMax: 28,
    growthWindowMin: 90,
    growthWindowMax: 120,
    harvestWindowMin: 30,
    harvestWindowMax: 120,
    light: 0.5,
    soil: 'Srednje (ilovasto)',
    nutrients: 'Srednje potrebe',
    water: 'Vlažno tlo',
    yieldMin: 50,
    yieldMax: 200,
    yieldType: 'perField',
    cleanHarvest: false,
    maxHarvestDaysBeforeDelivery: 0,
} satisfies ComponentProps<typeof SowingAttributeCards>['attributes'];
const operationAttributes = {
    application: 'raisedBedFull',
    frequency: 'weekly',
    duration: 15,
    deliverable: false,
    stage: { id: 1, information: { name: 'growth', label: 'Rast' } },
} satisfies ComponentProps<typeof OperationAttributesCards>['attributes'];

export function PublicAttributeExamples({
    missing = false,
}: {
    missing?: boolean;
}) {
    const attributes = missing ? undefined : plantAttributes;
    return (
        <section aria-label="Public attribute cards" className="space-y-6">
            <h2 className="text-xl font-semibold">
                Informacije o biljkama i proizvodima
            </h2>
            <div className="grid items-start gap-8 lg:grid-cols-2">
                <section aria-label="Plant attributes" className="space-y-4">
                    <h3 className="text-lg font-semibold">
                        Biljke i sorte · Ljupčac
                    </h3>
                    <PriceAttributeCard
                        icon={<GameCoinsIcon aria-hidden />}
                        header="Cijena sijanja"
                        currentPrice={2.99}
                        availability={missing ? 'unavailable' : 'available'}
                        description="Cijena jedne biljke uključuje troškove sjemena, pripreme tla, sjetve i sezonske pogodnosti."
                        navigateHref="/sjetva"
                        navigateLabel="Više o sjetvi"
                    />
                    <SowingAttributeCards
                        attributes={attributes}
                        plantName="Ljupčac"
                    />
                    <GrowthAttributeCards attributes={attributes} />
                    <WateringAttributeCards attributes={attributes} />
                    <HarvestAttributeCards
                        attributes={attributes}
                        plantName="Ljupčac"
                    />
                </section>
                <section
                    aria-label="Operation attributes"
                    className="space-y-4"
                >
                    <h3 className="text-lg font-semibold">
                        Radnje · Njega gredice
                    </h3>
                    <PriceAttributeCard
                        icon={<GameReceiptIcon aria-hidden />}
                        header="Cijena"
                        currentPrice={0.5}
                        availability={missing ? 'unavailable' : 'available'}
                    />
                    <OperationAttributesCards
                        attributes={missing ? undefined : operationAttributes}
                    />
                    <h3 className="text-lg font-semibold">Blokovi</h3>
                    <BlockAttributeCards
                        attributes={{
                            height: 0.3,
                            stackable: !missing,
                            type: 'decoration',
                            nightOnlyPurchase: false,
                        }}
                        prices={{ sunflowers: missing ? 0 : 120 }}
                    />
                </section>
            </div>
            <section aria-label="Seed attributes" className="space-y-4">
                <h3 className="text-lg font-semibold">
                    Sjeme · Informacije o pakiranju
                </h3>
                <SeedAttributeCards
                    seed={{
                        attributes: missing
                            ? { price: 0, weight: 0 }
                            : {
                                  price: 2.99,
                                  weight: 5,
                                  germinationPercentage: 85,
                              },
                        application: missing
                            ? undefined
                            : { applicationArea: 2, applicationPlants: 24 },
                        information: missing
                            ? { barcode: '' }
                            : {
                                  barcode: '3851234567890',
                                  countryOfOrigin: 'Hrvatska',
                              },
                    }}
                />
            </section>
        </section>
    );
}
