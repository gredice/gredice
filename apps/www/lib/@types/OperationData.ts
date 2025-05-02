export type OperationData = {
    id: number,
    information: {
        name: string,
        label: string,
        shortDescription: string,
        description: string,
    },
    attributes: {
        stage: string,
        frequency: string,
        application: string,
        relativeDays: number,
    },
    images: {
        cover: { url: string },
    },
    prices: {
        perOperation: number,
    }
};