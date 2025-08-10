export const KnownPages = {
    Landing: '/',

    Delivery: '/dostava',
    Plants: '/biljke',
    Plant: (alias: string) => `/biljke/${encodeURIComponent(alias)}`,
    PlantSort: (alias: string, sortName: string) => `/biljke/${encodeURIComponent(alias)}/sorte/${encodeURIComponent(sortName)}`,
    Blocks: '/blokovi',
    Sunflowers: '/suncokreti',
    RaisedBeds: '/podignuta-gredica',
    Block: (alias: string) => `/blokovi/${encodeURIComponent(alias)}`,
    Operations: '/radnje',
    Operation: (alias: string) => `/radnje/${encodeURIComponent(alias)}`,
    AboutUs: '/o-nama',
    FAQ: '/cesta-pitanja',
    Contact: '/kontakt',

    LegalPrivacy: '/legalno/politika-privatnosti',
    LegalTerms: '/legalno/uvjeti-koristenja',
    LegalCookies: '/legalno/politika-kolacica',
    LegalLicense: '/legalno/licenca',
    LegalThirdParty: '/legalno/trece-strane',
    LegalCompany: '/legalno/tvrtka',

    GardenApp: 'https://vrt.gredice.com',
}