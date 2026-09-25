export const harvestWheelbarrow = {
    name: 'HarvestWheelbarrow',
    information: {
        label: 'Ukrasna kolica s bundevama',
        shortDescription:
            'Drvena vrtna kolica puna narančastih i krem bundeva.',
        fullDescription:
            'Nagnuta drvena kolica s jednim kotačem, dvjema ručkama i ukrasnim bundevama. Zauzimaju dva susjedna polja na istoj visini. Postavi ih uz rub jesenskog kutka i ostavi slobodan prilaz gredici. Kolica su nepomičan ukras: ne prevoze urod, a bundeve ne prikazuju stvarnu količinu ni dostupnost plodova.',
    },
    attributes: {
        type: 'decoration',
        height: 0.89,
        hitboxHeight: 0.89,
        hitboxWidth: 1.88,
        hitboxDepth: 0.8,
        spanWidth: 2,
        spanDepth: 1,
        stackable: false,
        placeableOnWater: false,
        nightOnlyPurchase: false,
    },
    sunflowers: 120,
} satisfies {
    name: 'HarvestWheelbarrow';
    information: Record<string, string>;
    attributes: Record<string, string | number | boolean>;
    sunflowers: number;
};
