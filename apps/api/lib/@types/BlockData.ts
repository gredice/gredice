// TODO: Share from storage types or somewhere else so we don't have to duplicate them
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