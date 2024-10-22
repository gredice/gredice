export type Entity = {
    name: string,
    height?: number,
    stackable?: boolean
}

export const entities = {
    BlockGround: {
        name: 'Block_Ground',
        height: 0.4,
        stackable: true
    },
    BlockGrass: {
        name: 'Block_Grass',
        height: 0.4,
        stackable: true
    },
    RaisedBed: {
        name: 'Raised_Bed',
        height: 0.3
    },
    Shade: {
        name: 'Shade',
        height: 1
    }
} satisfies Record<string, Entity>;