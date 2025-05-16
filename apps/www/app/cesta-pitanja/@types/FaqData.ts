export type FaqData = {
    id: number,
    information: {
        name: string,
        header: string,
        content: string,
    },
    attributes: {
        category: {
            information: {
                name: string,
                label: string,
            }
        },
    }
}