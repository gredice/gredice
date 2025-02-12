export type BlockData = {
    id: string,
    information: {
        name: string,
        label: string,
        shortDescription: string,
        fullDescription: string,
    },
    attributes: {
        height: number,
        stackable?: boolean
    },
    prices: {
        sunflowers: number
    }
}