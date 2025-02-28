export const KnownPages = {
    Landing: '/',

    Plants: '/biljke',
    Plant: (alias: string) => `/biljke/${alias}`,
    Blocks: '/blokovi',
    Sunflowers: '/suncokreti',
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