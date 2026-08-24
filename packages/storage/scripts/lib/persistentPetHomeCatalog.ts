export type PersistentPetHomeBlockSpec = {
    attributes: Record<string, string>;
    name: string;
};

function persistentPetHomeBlockSpec({
    fullDescription,
    height,
    hitboxDepth,
    hitboxWidth,
    label,
    name,
    shortDescription,
    spanDepth,
    spanWidth,
    sunflowers,
}: {
    fullDescription: string;
    height: number;
    hitboxDepth: number;
    hitboxWidth: number;
    label: string;
    name: string;
    shortDescription: string;
    spanDepth: number;
    spanWidth: number;
    sunflowers: number;
}): PersistentPetHomeBlockSpec {
    const heightValue = height.toString();

    return {
        name,
        attributes: {
            'attributes.height': heightValue,
            'attributes.hitboxDepth': hitboxDepth.toString(),
            'attributes.hitboxHeight': heightValue,
            'attributes.hitboxWidth': hitboxWidth.toString(),
            'attributes.nightOnlyPurchase': 'false',
            'attributes.placeableOnWater': 'false',
            'attributes.spanDepth': spanDepth.toString(),
            'attributes.spanWidth': spanWidth.toString(),
            'attributes.stackable': 'false',
            'attributes.type': 'decoration',
            'functions.raisedBed': 'false',
            'functions.recycler': 'false',
            'image.cover': JSON.stringify({
                url: `https://www.gredice.com/assets/blocks/${name}.webp`,
            }),
            'information.fullDescription': fullDescription,
            'information.label': label,
            'information.name': name,
            'information.shortDescription': shortDescription,
            'prices.sunflowers': sunflowers.toString(),
        },
    };
}

export const persistentPetHomeBlockSpecs = [
    persistentPetHomeBlockSpec({
        name: 'RabbitHutch',
        label: 'Kućica za zeca',
        shortDescription:
            'Mala drvena kućica koja u vrt dovodi znatiželjnog zeca.',
        fullDescription:
            'Postavi malu drvenu kućicu uz prohodnu stazu i u vrt će stići znatiželjni zec. Skakutat će po sigurnom tlu, njuškati, uređivati krzno i kratko grickati travu.',
        height: 0.971,
        hitboxDepth: 1.021,
        hitboxWidth: 0.89,
        spanDepth: 1,
        spanWidth: 1,
        sunflowers: 350,
    }),
    persistentPetHomeBlockSpec({
        name: 'HorseStable',
        label: 'Staja za konja',
        shortDescription:
            'Otvorena drvena staja koja u vrt dovodi konja s bojom dlake po tvojem izboru.',
        fullDescription:
            'Postavi otvorenu drvenu staju, odaberi boju konjske dlake i u vrt će stići miran konj. Past će, osluškivati okolinu i obilaziti sigurne staze oko svojega doma.',
        height: 1.703,
        hitboxDepth: 1.72,
        hitboxWidth: 1.869,
        spanDepth: 2,
        spanWidth: 2,
        sunflowers: 500,
    }),
    persistentPetHomeBlockSpec({
        name: 'CowShelter',
        label: 'Zaklon za kravu',
        shortDescription:
            'Prostran otvoreni zaklon koji u vrt dovodi mirnu kravu.',
        fullDescription:
            'Postavi prostrani drveni zaklon uz travnati dio vrta i u njega će stići mirna krava. Past će, preživati i polako istraživati prohodnu okolicu.',
        height: 1.485,
        hitboxDepth: 1.65,
        hitboxWidth: 1.88,
        spanDepth: 2,
        spanWidth: 2,
        sunflowers: 850,
    }),
    persistentPetHomeBlockSpec({
        name: 'GoatShelter',
        label: 'Zaklon za kozu',
        shortDescription:
            'Kompaktan drveni zaklon koji u vrt dovodi znatiželjnu kozu.',
        fullDescription:
            'Postavi kompaktni zaklon uz kamenu ili šljunčanu stazu i u vrt će stići znatiželjna koza. Brstit će, preživati i povremeno razigrano poskočiti.',
        height: 1,
        hitboxDepth: 0.979,
        hitboxWidth: 0.98,
        spanDepth: 1,
        spanWidth: 1,
        sunflowers: 500,
    }),
    persistentPetHomeBlockSpec({
        name: 'SheepFold',
        label: 'Tor za ovcu',
        shortDescription:
            'Ograđeni tor sa zaklonom koji u vrt dovodi pitomu ovcu.',
        fullDescription:
            'Postavi ograđeni tor uz travnati dio vrta i u njega će stići pitoma ovca. Mirno će pasti, preživati i držati ugodan razmak od drugih ovaca.',
        height: 1.445,
        hitboxDepth: 1.52,
        hitboxWidth: 1.72,
        spanDepth: 2,
        spanWidth: 2,
        sunflowers: 500,
    }),
] as const satisfies readonly PersistentPetHomeBlockSpec[];

export function getPersistentPetHomeBlockSpec(name: string) {
    return (
        persistentPetHomeBlockSpecs.find((spec) => spec.name === name) ?? null
    );
}
