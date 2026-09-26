export const hedgehogShelter = {
    name: 'HedgehogShelter',
    information: {
        label: 'Sklonište za ježa',
        shortDescription: 'Nisko drveno sklonište za povremeni posjet ježa.',
        fullDescription:
            'Lučni drveni zaklon zauzima jedno polje. Kada uz otvor ima dovoljno slobodnog tla, može ga povremeno posjetiti jedan jež. Posjet je kratak i završava povratkom u sklonište. Ne traži hranu, ne daje predmete i ne mijenja zdravlje ni urod biljaka. Na zaklon se ne slažu drugi predmeti.',
    },
    attributes: {
        type: 'decoration',
        height: 0.49,
        hitboxHeight: 0.49,
        hitboxWidth: 0.9,
        hitboxDepth: 0.9,
        spanWidth: 1,
        spanDepth: 1,
        stackable: false,
        placeableOnWater: false,
        nightOnlyPurchase: false,
    },
    sunflowers: 70,
};
export const hedgehogShelterNames = [hedgehogShelter.name];
export function getHedgehogShelter(name: string) {
    return name === hedgehogShelter.name ? hedgehogShelter : undefined;
}
