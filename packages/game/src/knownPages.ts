export const KnownPages = {
    GredicePlants: 'https://www.gredice.com/biljke',
    GredicePlant: (alias: string) => `https://www.gredice.com/biljke/${alias}`,
    GredicePlantSort: (alias: string, sortAlias: string) => `https://www.gredice.com/biljke/${alias}/sorte/${sortAlias}`,
    GrediceOperations: 'https://www.gredice.com/radnje',
    GrediceOperation: (alias: string) => `https://www.gredice.com/radnje/${alias}`,
    GrediceBlocks: 'https://www.gredice.com/blokovi',
    GrediceBlock: (alias: string) => `https://www.gredice.com/blokovi/${alias}`,
    GrediceSunflowers: 'https://www.gredice.com/suncokreti',
    GrediceContact: 'https://www.gredice.com/kontakt',
};