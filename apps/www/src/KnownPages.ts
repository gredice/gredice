import type { Route } from 'next';

export const KnownPages = {
    Landing: '/',

    Delivery: '/dostava',
    DeliverySlots: '/dostava/termini',
    Plants: '/biljke',
    Plant: (alias: string) => `/biljke/${encodeURIComponent(alias)}` as Route,
    PlantSort: (alias: string, sortName: string) =>
        `/biljke/${encodeURIComponent(alias)}/sorte/${encodeURIComponent(sortName)}` as Route,
    Blocks: '/blokovi',
    Block: (alias: string) => `/blokovi/${encodeURIComponent(alias)}` as Route,
    Sunflowers: '/suncokreti',
    RaisedBeds: '/podignuta-gredica',
    Operations: '/radnje',
    Operation: (alias: string) =>
        `/radnje/${encodeURIComponent(alias)}` as Route,
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

    GoogleMapsGrediceHQ: 'https://maps.app.goo.gl/hJbidDQzhHWGCZwS6',
} as const;
