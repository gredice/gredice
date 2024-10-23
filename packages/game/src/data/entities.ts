export type Entity = {
    name: string,
    alias: string,
    height?: number,
    stackable?: boolean
}

export const entities = {
    BlockGround: {
        name: 'Block_Ground',
        alias: "Zemlja",
        height: 0.4,
        stackable: true
    },
    BlockGrass: {
        name: 'Block_Grass',
        alias: "Trava",
        height: 0.4,
        stackable: true
    },
    RaisedBed: {
        name: 'Raised_Bed',
        alias: "Gredica",
        height: 0.3
    },
    Shade: {
        name: 'Shade',
        alias: "Sjenica",
        height: 1
    }
} satisfies Record<string, Entity>;