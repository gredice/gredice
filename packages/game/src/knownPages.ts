export const KnownPages = {
    GredicePlants: 'https://www.gredice.com/biljke',
    GredicePlant: (alias: string) => `https://www.gredice.com/biljke/${alias}`,
    GredicePlantSort: (alias: string, sortAlias: string) => `https://www.gredice.com/biljke/${alias}/sorte/${sortAlias}`,
};