export const KnownPages = {
    Landing: '/',

    Delivery: '/dostava',
    Plants: '/biljke',
    Plant: (alias: string) => `/biljke/${alias}`,
    PlantSort: (alias: string, sortName: string) => `/biljke/${alias}/sorte/${sortName}`,
    Blocks: '/blokovi',
    Sunflowers: '/suncokreti',
    RaisedBeds: '/podignuta-gredica',
    Block: (alias: string) => `/blokovi/${alias}`,
    AboutUs: '/o-nama',
    FAQ: '/cesta-pitanja',

    LegalPrivacy: '/legalno/politika-privatnosti',
    LegalTerms: '/legalno/uvjeti-koristenja',
    LegalCookies: '/legalno/politika-kolacica',
    LegalLicense: '/legalno/licenca',
    LegalThirdParty: '/legalno/trece-strane',
    LegalCompany: '/legalno/tvrtka',

    GardenApp: 'https://vrt.gredice.com',
}