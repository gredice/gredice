import { PublicDirectoryPaths } from '@gredice/directory-types';
import type { Route } from 'next';
import { QUALITY_HARVEST_SAFETY_PATH } from './publicPagePaths';

// TODO: Deprecate KnownPages in favor of using route types directly
export const KnownPages = {
    Landing: '/',

    Delivery: '/dostava',
    DeliverySlots: '/dostava/termini',
    Plants: PublicDirectoryPaths.Plants as Route,
    Plant: (alias: string) => PublicDirectoryPaths.Plant(alias) as Route,
    PlantSort: (alias: string, sortName: string) =>
        PublicDirectoryPaths.PlantSort(alias, sortName) as Route,
    Blocks: PublicDirectoryPaths.Blocks as Route,
    Block: (alias: string) => PublicDirectoryPaths.Block(alias) as Route,
    BlockPlants: PublicDirectoryPaths.BlockPlants as Route,
    BlockPlant: (alias: string) =>
        PublicDirectoryPaths.BlockPlant(alias) as Route,
    BlockPlantGenerator: '/blokovi/biljke/generator' as Route,
    Sunflowers: '/suncokreti',
    RaisedBeds: '/podignuta-gredica',
    Sowing: '/sjetva',
    Operations: PublicDirectoryPaths.Operations as Route,
    Operation: (alias: string) =>
        PublicDirectoryPaths.Operation(alias) as Route,
    Recipes: '/recepti',
    Recipe: (slug: string) => `/recepti/${encodeURIComponent(slug)}` as Route,
    AboutUs: '/o-nama',
    FAQ: PublicDirectoryPaths.FAQ as Route,
    QualityHarvestSafety: QUALITY_HARVEST_SAFETY_PATH as Route,
    Contact: '/kontakt',
    Pricing: '/cjenik',
    Refunds: '/povrati-i-povrat-novca',
    Referrals: '/preporuke',

    LegalPrivacy: '/legalno/politika-privatnosti',
    LegalTerms: '/legalno/uvjeti-koristenja',
    LegalCookies: '/legalno/politika-kolacica',
    LegalLicense: '/legalno/licenca',
    LegalThirdParty: '/legalno/trece-strane',
    LegalCompany: '/legalno/tvrtka',
    LegalOccasions: PublicDirectoryPaths.LegalOccasions as Route,

    GardenApp: 'https://vrt.gredice.com',
    GardenReferrals: 'https://vrt.gredice.com/?pregled=preporuke',
    Status: 'https://status.gredice.com',
    GoogleMapsGrediceHQ: 'https://maps.app.goo.gl/hJbidDQzhHWGCZwS6',
} as const;
