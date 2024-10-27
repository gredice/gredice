export type Entity = {
    name: string,
    alias: string,
    description: string,
    height?: number,
    stackable?: boolean
}

export const entities = {
    BlockGround: {
        name: 'Block_Ground',
        alias: "Zemlja",
        description: "Zemlja je osnovni blok na koji se postavljaju ostali blokovi.",
        height: 0.4,
        stackable: true
    },
    BlockGrass: {
        name: 'Block_Grass',
        alias: "Trava",
        description: "Trava je osnovni blok na koji se postavljaju ostali blokovi.",
        height: 0.4,
        stackable: true
    },
    RaisedBed: {
        name: 'Raised_Bed',
        alias: "Gredica",
        description: "Gredica se koristi za sadnju biljaka.",
        height: 0.3
    },
    Shade: {
        name: 'Shade',
        alias: "Sjenica",
        description: "Sjenica se koristi za stvaranje hladovine.",
        height: 1.05
    },
    Fence: {
        name: 'Fence',
        alias: "Ograda",
        description: "Ograda se koristi za ograđivanje vrta.",
        height: 0.575
    },
    Bucket: {
        name: 'Bucket',
        alias: "Kantica",
        description: "Kantica se koristi za prenošenje vode.",
        height: 0.66
    }
} satisfies Record<string, Entity>;

export const entitiesArray = Object.values(entities);