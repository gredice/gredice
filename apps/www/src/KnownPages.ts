import type { Route } from 'next';
import { toPageAlias } from './pageAliases';

// TODO: Deprecate KnownPages in favor of using route types directly
export const KnownPages = {
    Landing: '/',

    Delivery: '/dostava',
    DeliverySlots: '/dostava/termini',
    Plants: '/biljke',
    Plant: (alias: string) => `/biljke/${toPageAlias(alias)}` as Route,
    PlantSort: (alias: string, sortName: string) =>
        `/biljke/${toPageAlias(alias)}/sorte/${toPageAlias(sortName)}` as Route,
    Blocks: '/blokovi',
    Block: (alias: string) => `/blokovi/${toPageAlias(alias)}` as Route,
    BlockPlants: '/blokovi/biljke',
    BlockPlant: (alias: string) =>
        `/blokovi/biljke/${toPageAlias(alias)}` as Route,
    BlockPlantGenerator: '/blokovi/biljke/generator' as Route,
    Sunflowers: '/suncokreti',
    RaisedBeds: '/podignuta-gredica',
    Sowing: '/sjetva',
    Operations: '/radnje',
    Operation: (alias: string) => `/radnje/${toPageAlias(alias)}` as Route,
    Recipes: '/recepti',
    Recipe: (slug: string) => `/recepti/${encodeURIComponent(slug)}` as Route,
    AboutUs: '/o-nama',
    FAQ: '/cesta-pitanja',
    Contact: '/kontakt',
    Pricing: '/cjenik',

    LegalPrivacy: '/legalno/politika-privatnosti',
    LegalTerms: '/legalno/uvjeti-koristenja',
    LegalCookies: '/legalno/politika-kolacica',
    LegalLicense: '/legalno/licenca',
    LegalThirdParty: '/legalno/trece-strane',
    LegalCompany: '/legalno/tvrtka',
    LegalOccasions: '/legalno/natjecaji',

    GardenApp: 'https://vrt.gredice.com',
    GoogleMapsGrediceHQ: 'https://maps.app.goo.gl/hJbidDQzhHWGCZwS6',
} as const;
