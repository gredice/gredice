const variants = [
    {
        name: 'HarvestCrate',
        label: 'Ukrasni sanduk s bundevama',
        shortDescription:
            'Drveni sanduk s krupnim narančastim i krem bundevama.',
        height: 0.44,
    },
    {
        name: 'HarvestCrateOrchard',
        label: 'Ukrasni sanduk s jabukama i kruškama',
        shortDescription:
            'Drveni sanduk s crvenim jabukama i zelenim kruškama.',
        height: 0.5,
    },
] satisfies {
    name: 'HarvestCrate' | 'HarvestCrateOrchard';
    label: string;
    shortDescription: string;
    height: number;
}[];

export const harvestCrates = variants.map((variant) => ({
    name: variant.name,
    information: {
        label: variant.label,
        shortDescription: variant.shortDescription,
        fullDescription: `${variant.shortDescription} Mali ukras za jesenski kutak vrta ili izložbeni stol. Zauzima jedno polje. Sadržaj je stalan i služi samo za ukrašavanje; ne prikazuje stvarni urod, količinu ni dostupnost plodova i nije spremnik za berbu.`,
    },
    attributes: {
        type: 'decoration',
        height: variant.height,
        hitboxHeight: variant.height,
        hitboxWidth: 0.86,
        hitboxDepth: 0.74,
        spanWidth: 1,
        spanDepth: 1,
        stackable: false,
        placeableOnWater: false,
        nightOnlyPurchase: false,
    },
    sunflowers: 60,
}));

export const harvestCrateNames = harvestCrates.map((item) => item.name);

export function getHarvestCrate(name: string) {
    return harvestCrates.find((item) => item.name === name);
}
